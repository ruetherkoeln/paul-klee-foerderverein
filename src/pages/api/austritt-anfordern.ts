// POST /api/austritt-anfordern
//
// Erste Stufe des Austritts: prüft die Eingaben und schickt einen signierten
// Bestätigungslink an die angegebene Adresse. Es wird noch nichts geändert.
//
// Die Antwort ist immer dieselbe — unabhängig davon, ob Name und Adresse in
// der Online-Liste stehen. Sonst ließe sich über das Formular abfragen, wer
// Mitglied ist. (Die Datei heißt bewusst nicht api/austritt.ts neben einem
// Ordner api/austritt/ — das führt auf Vercel zu einem Routing-Konflikt.)
import type { APIRoute } from 'astro';
import { baseUrl } from '../../lib/zuwendung.ts';
import { ipHash, clientIp } from '../../lib/erfassung-crypto.ts';
import { schemaSicherstellen, limitUeberschritten } from '../../lib/erfassung-db.ts';
import { austrittToken, sendeBestaetigungslink } from '../../lib/austritt.ts';

export const prerender = false;

const SEITE = '/mitgliedschaft-kuendigen/';
const weiter = (base: string, q: string) =>
  new Response(null, { status: 303, headers: { Location: `${base}${SEITE}?${q}` } });

export const GET: APIRoute = async ({ request }) =>
  new Response(null, { status: 303, headers: { Location: `${baseUrl(request)}${SEITE}` } });

export const POST: APIRoute = async ({ request }) => {
  const base = baseUrl(request);
  let d: Record<string, string> = {};
  try {
    const fd = await request.formData();
    fd.forEach((v, k) => (d[k] = typeof v === 'string' ? v : ''));
  } catch {
    return weiter(base, 'fehler=technik');
  }
  // Honeypot: still als Erfolg behandeln
  if ((d.botcheck || '').trim()) return weiter(base, 'gesendet=1');

  const t = (k: string) => (d[k] ?? '').trim().slice(0, 120);
  const vorname = t('vorname');
  const nachname = t('nachname');
  const email = t('email').toLowerCase();
  if (!vorname || !nachname || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return weiter(base, 'fehler=angaben');
  }

  try {
    await schemaSicherstellen();
    if (await limitUeberschritten(ipHash(clientIp(request)))) return weiter(base, 'fehler=limit');
    const token = austrittToken({ vorname, nachname, email });
    await sendeBestaetigungslink(
      { vorname, nachname, email },
      `${base}${SEITE}bestaetigen/?t=${encodeURIComponent(token)}`,
    );
  } catch (e) {
    console.error('Austritt anfordern:', (e as Error).message);
    return weiter(base, 'fehler=technik');
  }
  return weiter(base, 'gesendet=1');
};
