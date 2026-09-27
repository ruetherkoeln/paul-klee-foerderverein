// POST /api/mitgliedsantrag
//
// Nimmt den Mitgliedsantrag entgegen — dieselbe Strecke wie die
// Bestandserfassung: serverseitige Prüfung, Verschlüsselung der Bankdaten,
// fortlaufende Mandatsreferenz, Bestätigungsmail, Mandat als PDF.
//
// Warum eine eigene Route und nicht die der Erfassung: Der Antrag ist ein
// Aufnahmeantrag mit Beitragspflicht, über den der Vorstand erst entscheidet.
// Er braucht die zusätzliche Erklärung zur Rechtsverbindlichkeit und darf
// nicht von ERFASSUNG_AKTIV oder dem Enddatum der Erfassung abhängen — die
// Erfassung läuft am 30.11.2026 aus, Mitglied werden kann man danach weiter.
//
// Gespeichert wird in dieselbe Tabelle. Die Spalte `quelle` unterscheidet
// beide Wege, und der Verein hat eine einzige Liste statt zweier.
import type { APIRoute } from 'astro';
import { baseUrl } from '../../lib/zuwendung.ts';
import { ERFASSUNG } from '../../data/erfassung.ts';
import { pruefeIban, normalisiereIban } from '../../lib/iban.ts';
import { verschluesseln, ipHash, clientIp, signId } from '../../lib/erfassung-crypto.ts';
import {
  schemaSicherstellen,
  limitUeberschritten,
  naechsteMandatsreferenz,
  speichern,
} from '../../lib/erfassung-db.ts';
import { sendeBestaetigung } from '../../lib/erfassung-mail.ts';

export const prerender = false;

const FORMULAR = '/foerderverein/mitglied-werden/';
const MAX_SIGNATUR_BYTES = 400_000;

const zurueck = (base: string, fehler: string) =>
  new Response(null, {
    status: 303,
    headers: { Location: `${base}${FORMULAR}?fehler=${encodeURIComponent(fehler)}` },
  });

export const GET: APIRoute = async ({ request }) =>
  new Response(null, { status: 303, headers: { Location: `${baseUrl(request)}${FORMULAR}` } });

export const POST: APIRoute = async ({ request }) => {
  const base = baseUrl(request);

  // ── Eingaben einlesen ─────────────────────────────────────────────────────
  let d: Record<string, string> = {};
  const ct = request.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) {
      d = (await request.json()) as Record<string, string>;
    } else {
      const fd = await request.formData();
      fd.forEach((v, k) => (d[k] = typeof v === 'string' ? v : ''));
    }
  } catch {
    return zurueck(base, 'technik');
  }

  // Honeypot: stillschweigend als Erfolg behandeln, nichts speichern
  if ((d.botcheck || '').trim()) {
    return new Response(null, {
      status: 303,
      headers: { Location: `${base}${FORMULAR}danke/` },
    });
  }

  const t = (k: string) => (d[k] ?? '').trim();

  // ── Stammdaten ────────────────────────────────────────────────────────────
  const pflicht = ['vorname', 'nachname', 'strasse', 'plz', 'ort', 'email'];
  if (pflicht.some((k) => !t(k))) return zurueck(base, 'pflicht');
  if (!/^\d{5}$/.test(t('plz'))) return zurueck(base, 'plz');
  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(t('email'))) return zurueck(base, 'email');

  // ── Beitrag ───────────────────────────────────────────────────────────────
  const roh = t('beitrag') === 'frei' ? t('beitrag_frei') : t('beitrag');
  const beitrag = Number.parseInt(roh.replace(/[^\d]/g, ''), 10);
  if (!Number.isFinite(beitrag) || beitrag < ERFASSUNG.MIN_EUR || beitrag > ERFASSUNG.MAX_EUR) {
    return zurueck(base, 'beitrag');
  }

  // ── Zahlungsweise ─────────────────────────────────────────────────────────
  const zahlweise = t('zahlweise');
  if (zahlweise !== 'sepa' && zahlweise !== 'ueberweisung') return zurueck(base, 'zahlweise');

  let ibanKlar: string | null = null;
  let kontoinhaber: string | null = null;
  let signatur: string | null = null;

  if (zahlweise === 'sepa') {
    kontoinhaber = t('kontoinhaber');
    if (!kontoinhaber) return zurueck(base, 'kontoinhaber');
    ibanKlar = normalisiereIban(t('iban'));
    if (pruefeIban(ibanKlar)) return zurueck(base, 'iban');
    signatur = t('signatur');
    if (!signatur.startsWith('data:image/png;base64,')) return zurueck(base, 'signatur');
    if (signatur.length > MAX_SIGNATUR_BYTES) return zurueck(base, 'signatur');
    if (t('mandat_bestaetigt') !== 'ja') return zurueck(base, 'mandat');
  }

  // ── Antragserklärung und Einwilligung ─────────────────────────────────────
  // Ohne die Erklärung zur Rechtsverbindlichkeit liegt kein Aufnahmeantrag
  // vor, sondern nur eine Absichtsbekundung.
  if (t('rechtsverbindlich') !== 'ja') return zurueck(base, 'rechtsverbindlich');
  if (t('einwilligung_speicherung') !== 'ja') return zurueck(base, 'einwilligung');

  // ── Speichern ─────────────────────────────────────────────────────────────
  const hash = ipHash(clientIp(request));
  let id: number;
  let mandatsreferenz: string | null = null;
  try {
    await schemaSicherstellen();
    if (await limitUeberschritten(hash)) return zurueck(base, 'limit');
    if (zahlweise === 'sepa') mandatsreferenz = await naechsteMandatsreferenz();

    id = await speichern({
      vorname: t('vorname'),
      nachname: t('nachname'),
      strasse: t('strasse'),
      plz: t('plz'),
      ort: t('ort'),
      email: t('email'),
      telefon: t('telefon') || null,
      kind_name: t('kind_name') || null,
      klasse: t('klasse') || null,
      beitrag_eur: beitrag,
      zahlweise,
      kontoinhaber_verschluesselt: kontoinhaber ? verschluesseln(kontoinhaber) : null,
      iban_verschluesselt: ibanKlar ? verschluesseln(ibanKlar) : null,
      mandatsreferenz,
      mandat_signatur: signatur,
      mandat_erteilt_am: zahlweise === 'sepa' ? new Date().toISOString() : null,
      einwilligung_speicherung: true,
      einwilligung_ansprache: t('einwilligung_ansprache') === 'ja',
      ip_hash: hash,
      user_agent: (request.headers.get('user-agent') ?? '').slice(0, 400),
      quelle: 'mitgliedsantrag',
    });
  } catch {
    // Bewusst ohne Details — Eingaben dürfen nicht in Logs landen
    console.error('Mitgliedsantrag: Speichern fehlgeschlagen');
    return zurueck(base, 'technik');
  }

  // ── Bestätigungen (ein Fehler hier kippt den Antrag nicht) ────────────────
  const token = signId(id);
  const pdfUrl =
    zahlweise === 'sepa' ? `${base}/api/mitglieder-mandat?t=${encodeURIComponent(token)}` : null;
  try {
    const mail = await sendeBestaetigung({
      vorname: t('vorname'),
      nachname: t('nachname'),
      strasse: t('strasse'),
      plz: t('plz'),
      ort: t('ort'),
      email: t('email'),
      telefon: t('telefon') || null,
      kindName: t('kind_name') || null,
      klasse: t('klasse') || null,
      beitragEur: beitrag,
      zahlweise,
      mandatsreferenz,
      iban: ibanKlar,
      einwilligungAnsprache: t('einwilligung_ansprache') === 'ja',
      pdfUrl,
      art: 'antrag',
    });
    if (!mail.ok || mail.fehler) {
      console.error(`Mitgliedsantrag: Mailversand — ${mail.fehler ?? 'unbekannt'}`);
    }
  } catch {
    console.error('Mitgliedsantrag: Bestätigungsmail fehlgeschlagen');
  }

  return new Response(null, {
    status: 303,
    headers: { Location: `${base}${FORMULAR}danke/?t=${encodeURIComponent(token)}` },
  });
};
