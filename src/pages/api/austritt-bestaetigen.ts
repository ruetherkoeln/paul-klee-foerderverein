// POST /api/austritt-bestaetigen
//
// Zweite Stufe: Der Link aus der Mail wurde geöffnet und der Austritt dort
// ausdrücklich bestätigt. Bewusst ein POST hinter einem Knopf und nicht schon
// der Aufruf des Links — Virenscanner mancher Mailprogramme öffnen Links
// automatisch, das darf niemanden austreten lassen.
//
// Reihenfolge: erst die Meldung an den Vorstand, dann der Eintrag in der
// Datenbank. Scheitert die Mail, ist noch nichts geändert und der Link lässt
// sich erneut verwenden. Die Satzung (§ 4) verlangt die Erklärung gegenüber
// dem Vorstand — ein stiller Datenbankeintrag allein genügt nicht.
import type { APIRoute } from 'astro';
import { baseUrl } from '../../lib/zuwendung.ts';
import { schemaSicherstellen, aktiveEintraegeZu, austrittEintragen } from '../../lib/erfassung-db.ts';
import { austrittPruefen, sendeVorstandHinweis, sendeAustrittBestaetigt } from '../../lib/austritt.ts';

export const prerender = false;

const SEITE = '/mitgliedschaft-kuendigen/';
const weiter = (base: string, pfad: string) =>
  new Response(null, { status: 303, headers: { Location: `${base}${SEITE}${pfad}` } });

export const GET: APIRoute = async ({ request }) =>
  new Response(null, { status: 303, headers: { Location: `${baseUrl(request)}${SEITE}` } });

export const POST: APIRoute = async ({ request }) => {
  const base = baseUrl(request);
  let token = '';
  try {
    token = String((await request.formData()).get('t') ?? '');
  } catch {
    return weiter(base, '?fehler=technik');
  }
  const d = austrittPruefen(token);
  if (!d) return weiter(base, '?fehler=link');

  const jetzt = new Date();
  try {
    await schemaSicherstellen();
    const treffer = await aktiveEintraegeZu(d.vorname, d.nachname, d.email);
    await sendeVorstandHinweis(d, jetzt, treffer);
    await austrittEintragen(d.vorname, d.nachname, d.email);
  } catch (e) {
    console.error('Austritt bestaetigen:', (e as Error).message);
    return weiter(base, `bestaetigen/?t=${encodeURIComponent(token)}&fehler=technik`);
  }

  // Die Bestätigung an das Mitglied ist nachrangig — der Vorstand weiß Bescheid.
  try {
    await sendeAustrittBestaetigt(d, jetzt);
  } catch (e) {
    console.error('Austritt: Bestätigung an das Mitglied fehlgeschlagen:', (e as Error).message);
  }
  return weiter(base, 'erledigt/');
};
