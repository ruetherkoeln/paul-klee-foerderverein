// POST /api/vollmacht
//
// Nimmt die online erteilte Abstimmungsvollmacht entgegen, erzeugt das PDF mit
// der gezeichneten Unterschrift und stellt es dem Vorstand zu. Eine Kopie geht
// an das Mitglied.
//
// Bewusst ohne Datenbank: Die Vollmacht ist das unterschriebene PDF. Scheitert
// die Zustellung an den Vorstand, gilt sie als nicht erteilt — dann kommt das
// Mitglied mit einer Fehlermeldung zurück und kann das Papierformular nutzen.
import type { APIRoute } from 'astro';
import { baseUrl } from '../../lib/zuwendung.ts';
import { COOKIE, merkmalGueltig } from '../../lib/mv2026.ts';
import { originErlaubt } from '../../lib/sicherheit.ts';
import { buildVollmachtPdf } from '../../lib/vollmacht-pdf.ts';
import { sendeVollmacht } from '../../lib/vollmacht-mail.ts';

export const prerender = false;

const SEITE = '/mv2026/vollmacht/';
const zurueck = (base: string, code: string) =>
  new Response(null, { status: 303, headers: { Location: `${base}${SEITE}?fehler=${code}` } });

export const GET: APIRoute = async ({ request }) =>
  new Response(null, { status: 303, headers: { Location: `${baseUrl(request)}${SEITE}` } });

export const POST: APIRoute = async ({ request, cookies }) => {
  const base = baseUrl(request);

  // Astros eigener checkOrigin prüft auf Vercel gegen den internen Host —
  // deshalb hier selbst prüfen.
  if (!originErlaubt(request)) {
    return new Response('Ungültige Anfrage', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  // Nur Mitglieder: dasselbe Merkmal wie für den übrigen Bereich.
  if (!merkmalGueltig(cookies.get(COOKIE)?.value)) return zurueck(base, 'zugang');

  const d: Record<string, string> = {};
  try {
    const fd = await request.formData();
    fd.forEach((v, k) => (d[k] = typeof v === 'string' ? v : ''));
  } catch {
    return zurueck(base, 'technik');
  }

  // Honeypot: still als Erfolg behandeln, damit automatische Eintragungen
  // nicht merken, dass sie erkannt wurden.
  if ((d.botcheck || '').trim()) {
    return new Response(null, { status: 303, headers: { Location: `${base}${SEITE}danke/` } });
  }

  const t = (k: string, max = 120) => (d[k] ?? '').trim().slice(0, max);
  const vorname = t('vorname');
  const nachname = t('nachname');
  const strasse = t('strasse');
  const plz = t('plz', 10);
  const ort = t('ort');
  const email = t('email').toLowerCase();
  // Die Unterschrift ist ein PNG aus dem Canvas; grosszuegig begrenzt, damit
  // kein beliebig grosser Datenblock in das PDF wandert.
  const signatur = (d.signatur ?? '').slice(0, 400_000);

  if (!vorname || !nachname || !strasse || !plz || !ort) return zurueck(base, 'felder');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return zurueck(base, 'email');
  if (!/^data:image\/png;base64,/.test(signatur)) return zurueck(base, 'signatur');
  if (t('bestaetigt') !== 'ja') return zurueck(base, 'bestaetigt');

  try {
    const pdf = await buildVollmachtPdf({
      vorname, nachname, strasse, plz, ort, email,
      signaturDataUrl: signatur,
      erteiltAm: new Date(),
    });

    const sauber = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { ok, fehler } = await sendeVollmacht({
      vorname, nachname, strasse, plz, ort, email, pdf,
      dateiname: `Vollmacht-${sauber(nachname)}-${sauber(vorname)}.pdf`,
    });
    // ok === true mit Hinweis heisst: Vorstand hat sie, nur die Kopie an das
    // Mitglied ging nicht durch. Das ist kein Grund, die Vollmacht abzulehnen.
    if (fehler) console.error('Vollmacht:', fehler);
    if (!ok) return zurueck(base, 'versand');
  } catch (e) {
    console.error('Vollmacht:', (e as Error).message);
    return zurueck(base, 'technik');
  }

  return new Response(null, { status: 303, headers: { Location: `${base}${SEITE}danke/` } });
};
