// POST /api/zuwendung
// Nimmt die Spender-Eingaben entgegen, signiert sie und schickt dem Vorstand
// eine Freigabe-Mail mit Prüf-Link. Es wird hier noch NICHTS ausgestellt.
import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { STEUER } from '../../data/verein-steuer.ts';
import { getEnv, signSpende, formatEuro, type Spende } from '../../lib/zuwendung.ts';

export const prerender = false;

function parseBetragToCent(raw: string): number {
  // akzeptiert "50", "50,00", "50.00", "1.234,56"
  const s = (raw || '').trim().replace(/\s|€/g, '');
  let norm = s;
  if (s.includes(',')) norm = s.replace(/\./g, '').replace(',', '.'); // deutsches Format
  const val = Number.parseFloat(norm);
  if (!Number.isFinite(val)) return NaN;
  return Math.round(val * 100);
}

const origin = (req: Request) => getEnv('PUBLIC_SITE_URL') || new URL(req.url).origin;
const redirect = (url: string) => new Response(null, { status: 303, headers: { Location: url } });

export const POST: APIRoute = async ({ request }) => {
  const base = origin(request);

  if (!STEUER.AUSSTELLUNG_AKTIV) {
    return redirect(`${base}/spenden/bescheinigung/?status=inaktiv`);
  }

  // Eingaben einlesen (Form oder JSON)
  let data: Record<string, string> = {};
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    data = await request.json();
  } else {
    const fd = await request.formData();
    fd.forEach((v, k) => (data[k] = String(v)));
  }

  // Honeypot
  if (data.botcheck) return redirect(`${base}/danke/?type=zuwendung`);

  const betragCent = parseBetragToCent(data.betrag);
  const pflicht = ['vorname', 'name', 'strasse', 'hausnummer', 'plz', 'ort', 'email', 'datum'];
  const fehlt = pflicht.some((k) => !data[k]?.trim());
  if (fehlt || !Number.isFinite(betragCent) || betragCent <= 0) {
    return redirect(`${base}/spenden/bescheinigung/?status=fehler`);
  }

  const spende: Spende = {
    vorname: data.vorname.trim(),
    name: data.name.trim(),
    strasse: data.strasse.trim(),
    hausnummer: data.hausnummer.trim(),
    plz: data.plz.trim(),
    ort: data.ort.trim(),
    email: data.email.trim(),
    betragCent,
    datum: data.datum.trim(),
    verzicht: data.verzicht === 'on' || data.verzicht === 'true',
    ts: Date.now(),
  };

  const token = signSpende(spende);
  const freigabeUrl = `${base}/api/zuwendung/freigeben?token=${encodeURIComponent(token)}`;

  const vorstand = getEnv('VORSTAND_EMAIL');
  const from = getEnv('MAIL_FROM') || 'Förderverein Paul-Klee-Schule <spenden@pks-foerderverein.de>';
  const apiKey = getEnv('RESEND_API_KEY');
  if (!apiKey || !vorstand) {
    console.error('RESEND_API_KEY oder VORSTAND_EMAIL fehlt');
    return redirect(`${base}/spenden/bescheinigung/?status=fehler`);
  }

  const html = `
    <div style="font-family:Arial,sans-serif;color:#0d1726;line-height:1.6">
      <h2 style="margin:0 0 12px">Neue Anfrage: Zuwendungsbescheinigung</h2>
      <p>Bitte zunächst mit dem <strong>Kontoeingang abgleichen</strong>. Erst nach Bestätigung
      des Zahlungseingangs freigeben — mit dem Klick wird die Bescheinigung erzeugt und an den
      Spender (Kopie an den Verein) gesendet.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#5a6b7b">Spender</td><td><strong>${spende.vorname} ${spende.name}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#5a6b7b">Anschrift</td><td>${spende.strasse} ${spende.hausnummer}, ${spende.plz} ${spende.ort}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#5a6b7b">E-Mail</td><td>${spende.email}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#5a6b7b">Betrag</td><td><strong>${formatEuro(betragCent)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#5a6b7b">Tag der Zuwendung</td><td>${spende.datum}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#5a6b7b">Verzicht auf Aufwendungsersatz</td><td>${spende.verzicht ? 'Ja' : 'Nein'}</td></tr>
      </table>
      <p style="margin:24px 0">
        <a href="${freigabeUrl}" style="background:#caa53d;color:#0d1726;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">
          Freigeben &amp; Bescheinigung senden
        </a>
      </p>
      <p style="font-size:12px;color:#8a97a4">Wenn der Betrag so nicht eingegangen ist: Link einfach ignorieren. Der Link ist 30 Tage gültig.</p>
    </div>`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: vorstand,
      replyTo: spende.email,
      subject: `Freigabe Zuwendungsbescheinigung – ${spende.vorname} ${spende.name} (${formatEuro(betragCent)})`,
      html,
    });
    if (error) throw error;
  } catch (e) {
    console.error('Mailversand an Vorstand fehlgeschlagen:', e);
    return redirect(`${base}/spenden/bescheinigung/?status=fehler`);
  }

  return redirect(`${base}/danke/?type=zuwendung`);
};
