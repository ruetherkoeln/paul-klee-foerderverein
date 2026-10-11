// Austritt aus dem Verein über die Website (/mitgliedschaft-kuendigen/).
// Nur serverseitig importieren.
//
// Ablauf: Das Mitglied gibt Name und E-Mail ein und bekommt einen signierten
// Bestätigungslink an genau diese Adresse. Erst wer den Link öffnet und dort
// bestätigt, ist ausgetreten. So kann niemand ein anderes Mitglied austragen,
// nur weil er dessen Namen kennt — er bräuchte Zugriff auf dessen Postfach.
//
// Die Satzung (§ 4) verlangt eine schriftliche Erklärung gegenüber dem
// Vorstand. Deshalb geht jeder bestätigte Austritt als Mail an den Verein —
// auch dann, wenn kein passender Eintrag in der Online-Liste existiert
// (ältere Mitglieder stehen nur in der Excel-Liste des Vorstands).
import crypto from 'node:crypto';
import { Resend } from 'resend';
import { getEnv } from './zuwendung.ts';
import { esc, huelle } from './erfassung-mail.ts';
import { ERFASSUNG } from '../data/erfassung.ts';

export interface AustrittDaten {
  vorname: string;
  nachname: string;
  email: string;
}

// ── Signierter Link ─────────────────────────────────────────────────────────
// Der Link trägt die Angaben selbst (keine Datenbankzeile für offene
// Anfragen nötig) und ist sieben Tage gültig.
const GUELTIG_MS = 1000 * 60 * 60 * 24 * 7;

const b64url = (b: Buffer) =>
  b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const vonB64url = (s: string) =>
  Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function schluessel(): string {
  const s = getEnv('ERFASSUNG_SIGNING_SECRET');
  if (!s) throw new Error('ERFASSUNG_SIGNING_SECRET fehlt');
  // Eigener Zweck im Schlüssel: Ein Link aus der Erfassung lässt sich so
  // nicht als Austrittslink verwenden und umgekehrt.
  return `austritt:${s}`;
}

export function austrittToken(d: AustrittDaten, ts = Date.now()): string {
  const nutzlast = b64url(Buffer.from(JSON.stringify({ v: d.vorname, n: d.nachname, e: d.email, t: ts }), 'utf8'));
  const sig = b64url(crypto.createHmac('sha256', schluessel()).update(nutzlast).digest());
  return `${nutzlast}.${sig}`;
}

export function austrittPruefen(token: string): (AustrittDaten & { angefordertAm: number }) | null {
  const [nutzlast, sig] = (token || '').split('.');
  if (!nutzlast || !sig) return null;
  const erwartet = b64url(crypto.createHmac('sha256', schluessel()).update(nutzlast).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(erwartet);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const o = JSON.parse(vonB64url(nutzlast).toString('utf8'));
    if (typeof o.t !== 'number' || Date.now() - o.t > GUELTIG_MS) return null;
    if (![o.v, o.n, o.e].every((x) => typeof x === 'string' && x.length > 0)) return null;
    return { vorname: o.v, nachname: o.n, email: o.e, angefordertAm: o.t };
  } catch {
    return null;
  }
}

// ── Mails ───────────────────────────────────────────────────────────────────
function mailer() {
  const apiKey = getEnv('RESEND_API_KEY');
  const from = getEnv('MAIL_FROM');
  if (!apiKey || !from) throw new Error('RESEND_API_KEY oder MAIL_FROM fehlt');
  return { resend: new Resend(apiKey), from };
}

// Das SDK wirft bei abgelehnten Sendungen nicht, sondern liefert { error } —
// beide Wege prüfen (siehe erfassung-mail.ts).
async function senden(to: string, subject: string, html: string): Promise<void> {
  const { resend, from } = mailer();
  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) throw new Error(`Resend lehnte ab: ${error.name} — ${error.message}`);
}

const fuss = () => {
  const v = ERFASSUNG.verein;
  return `<p style="font-size:12px;color:#5b6070;margin-top:22px">
    ${esc(v.name)} · ${esc(v.strasse)} · ${esc(v.plz)} ${esc(v.ort)} · ${esc(v.email)}</p>`;
};

export async function sendeBestaetigungslink(d: AustrittDaten, link: string): Promise<void> {
  await senden(
    d.email,
    'Bitte bestätigen: Austritt aus dem Förderverein Paul-Klee-Schule',
    huelle(
      'Bitte bestätigen Sie Ihren Austritt',
      `<p style="font-size:14px">Guten Tag ${esc(d.vorname)} ${esc(d.nachname)},</p>
       <p style="font-size:14px">auf unserer Website wurde der Austritt aus dem Förderverein
         für Ihren Namen und diese E-Mail-Adresse angefordert. Wirksam wird er erst, wenn Sie
         ihn über diesen Link bestätigen:</p>
       <p style="font-size:14px"><a href="${link}">Austritt jetzt bestätigen</a></p>
       <p style="font-size:13px;color:#5b6070">Der Link ist sieben Tage gültig. Haben Sie den
         Austritt nicht angefordert oder es sich anders überlegt, ignorieren Sie diese Mail
         einfach — dann bleibt alles, wie es ist. Und darüber würden wir uns freuen.</p>
       ${fuss()}`,
    ),
  );
}

export async function sendeAustrittBestaetigt(d: AustrittDaten, am: Date): Promise<void> {
  const datum = am.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
  await senden(
    d.email,
    'Ihr Austritt aus dem Förderverein Paul-Klee-Schule',
    huelle(
      'Ihr Austritt ist eingegangen',
      `<p style="font-size:14px">Guten Tag ${esc(d.vorname)} ${esc(d.nachname)},</p>
       <p style="font-size:14px">wir haben Ihre Austrittserklärung am ${esc(datum)} erhalten und an
         den Vorstand weitergegeben. Haben Sie per SEPA-Lastschrift gezahlt, wird der Einzug
         beendet.</p>
       <p style="font-size:14px">Danke für alles, was Sie für die Kinder der Paul-Klee-Schule
         getan haben. Unsere Tür bleibt offen — wenn Sie irgendwann wiederkommen möchten,
         freuen wir uns.</p>
       ${fuss()}`,
    ),
  );
}

export async function sendeVorstandHinweis(
  d: AustrittDaten,
  am: Date,
  treffer: { id: number; quelle: string | null; zahlweise: string; mandatsreferenz: string | null }[],
): Promise<void> {
  const an = getEnv('VEREIN_KOPIE_EMAIL') || ERFASSUNG.verein.email;
  const zeit = am.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
  const sepa = treffer.filter((t) => t.zahlweise === 'sepa');
  const liste = treffer.length
    ? `<p style="font-size:14px">In der Online-Mitgliederliste als ausgetreten markiert:</p>
       <ul style="font-size:14px">${treffer
         .map((t) => `<li>Eintrag Nr. ${t.id} (${esc(t.quelle ?? '')})${
           t.mandatsreferenz ? `, Mandatsreferenz <strong>${esc(t.mandatsreferenz)}</strong>` : ''}</li>`)
         .join('')}</ul>`
    : `<p style="font-size:14px"><strong>Kein passender Eintrag in der Online-Liste.</strong>
       Das Mitglied steht vermutlich nur in der bisherigen Mitgliederliste — bitte dort
       austragen.</p>`;
  await senden(
    an,
    `Austritt erklärt: ${d.vorname} ${d.nachname}${sepa.length ? ' — SEPA-Einzug beenden' : ''}`,
    huelle(
      'Austrittserklärung über die Website',
      `<table style="border-collapse:collapse;font-size:14px">
         <tr><td style="padding:4px 14px 4px 0;color:#5b6070">Name</td><td><strong>${esc(d.vorname)} ${esc(d.nachname)}</strong></td></tr>
         <tr><td style="padding:4px 14px 4px 0;color:#5b6070">E-Mail</td><td><strong>${esc(d.email)}</strong></td></tr>
         <tr><td style="padding:4px 14px 4px 0;color:#5b6070">Bestätigt am</td><td><strong>${esc(zeit)}</strong></td></tr>
       </table>
       ${liste}
       ${sepa.length ? '<p style="font-size:14px"><strong>Bitte den SEPA-Einzug für diese Mandatsreferenz beenden.</strong></p>' : ''}
       <p style="font-size:13px;color:#5b6070">Der Austritt wurde über einen Link bestätigt, der
         an die angegebene E-Mail-Adresse ging (Schriftform nach § 4 der Satzung).</p>`,
    ),
  );
}
