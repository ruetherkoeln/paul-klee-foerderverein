// POST /api/mitglieder-erfassung
// Nimmt die Angaben des Erfassungsassistenten entgegen, prüft sie erneut
// serverseitig, speichert sie und verschickt die Bestätigungen.
import type { APIRoute } from 'astro';
import { getEnv, baseUrl } from '../../lib/zuwendung.ts';
import { ERFASSUNG, erfassungAktiv } from '../../data/erfassung.ts';
import { pruefeIban, normalisiereIban } from '../../lib/iban.ts';
import {
  verschluesseln,
  ipHash,
  clientIp,
  signId,
} from '../../lib/erfassung-crypto.ts';
import {
  schemaSicherstellen,
  limitUeberschritten,
  naechsteMandatsreferenz,
  speichern,
} from '../../lib/erfassung-db.ts';
import { sendeBestaetigung } from '../../lib/erfassung-mail.ts';

export const prerender = false;

const FORMULAR = '/mitglied-werden/';
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

  const status = erfassungAktiv(getEnv);
  if (!status.aktiv) return zurueck(base, 'inaktiv');

  // ── Eingaben einlesen (Formular oder JSON) ────────────────────────────────
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
      headers: { Location: `${base}/mitglied-werden/danke/` },
    });
  }

  const t = (k: string) => (d[k] ?? '').trim();

  // ── Schritt 2: Stammdaten ─────────────────────────────────────────────────
  const pflicht = ['vorname', 'nachname', 'strasse', 'plz', 'ort', 'email'];
  if (pflicht.some((k) => !t(k))) return zurueck(base, 'pflicht');
  if (!/^\d{5}$/.test(t('plz'))) return zurueck(base, 'plz');
  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(t('email'))) return zurueck(base, 'email');

  // ── Schritt 3: Beitrag ────────────────────────────────────────────────────
  const roh = t('beitrag') === 'frei' ? t('beitrag_frei') : t('beitrag');
  const beitrag = Number.parseInt(roh.replace(/[^\d]/g, ''), 10);
  if (
    !Number.isFinite(beitrag) ||
    beitrag < ERFASSUNG.MIN_EUR ||
    beitrag > ERFASSUNG.MAX_EUR
  ) {
    return zurueck(base, 'beitrag');
  }

  // ── Schritt 4: Zahlungsweise ──────────────────────────────────────────────
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

  // ── Schritt 5: Einwilligungen ─────────────────────────────────────────────
  if (t('einwilligung_speicherung') !== 'ja' || t('einwilligung_ansprache') !== 'ja') {
    return zurueck(base, 'einwilligung');
  }

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
      einwilligung_ansprache: true,
      ip_hash: hash,
      user_agent: (request.headers.get('user-agent') ?? '').slice(0, 400),
      quelle: 'mitgliedererfassung-2026',
    });
  } catch (e) {
    // Bewusst ohne Details — Eingaben dürfen nicht in Logs landen
    console.error('Mitgliedererfassung: Speichern fehlgeschlagen');
    return zurueck(base, 'technik');
  }

  // ── Bestätigungen versenden (Fehler hier kippen die Eintragung nicht) ─────
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
      einwilligungAnsprache: true,
      pdfUrl,
    });
    // Ohne Auswertung bliebe ein abgelehnter Versand unbemerkt: die Person
    // sähe die Danke-Seite, bekäme aber nie eine Bestätigung. Der Grund darf
    // ins Log, die Eingaben nicht.
    if (!mail.ok || mail.fehler) {
      console.error(`Mitgliedererfassung: Mailversand — ${mail.fehler ?? 'unbekannt'}`);
    }
  } catch {
    console.error('Mitgliedererfassung: Bestätigungsmail fehlgeschlagen');
  }

  return new Response(null, {
    status: 303,
    headers: { Location: `${base}/mitglied-werden/danke/?t=${encodeURIComponent(token)}` },
  });
};
