// Gibt eine Unterlage der Mitgliederversammlung heraus — aber nur an jemanden,
// der sich zuvor angemeldet hat.
//
// Der Weg ueber diese Route ist der Grund, warum die Dateien nicht unter
// public/ liegen: Was dort liegt, liefert Vercel ohne jede Pruefung aus.
import type { APIRoute } from 'astro';
import { COOKIE, merkmalGueltig } from '../../../lib/mv2026.ts';
import { datei, inhaltstyp } from '../../../lib/mv2026-unterlagen.ts';
import { GESCHUETZT_KOPFZEILEN } from '../../../lib/sicherheit.ts';

export const prerender = false;

export const GET: APIRoute = async ({ params, cookies, redirect }) => {
  if (!merkmalGueltig(cookies.get(COOKIE)?.value)) {
    // Zur Anmeldung schicken statt 403: Wer den Link aus der Einladung
    // anklickt, soll wissen, was zu tun ist.
    return redirect('/mv2026/', 302);
  }

  const name = params.name ?? '';
  // Kein Zusammensetzen von Pfaden — es wird ausschliesslich in der Liste der
  // eingebetteten Dateien nachgeschlagen. Damit sind ".." und Ähnliches
  // wirkungslos.
  const inhalt = datei(name);
  if (!inhalt) return new Response('Nicht gefunden', { status: 404 });

  return new Response(inhalt, {
    headers: {
      'content-type': inhaltstyp(name),
      'content-length': String(inhalt.length),
      // Der Dateiname geht in die Kopfzeile ein. Neben dem Anfuehrungszeichen
      // muessen auch Zeilenumbrueche raus, sonst liesse sich ueber einen
      // praeparierten Dateinamen eine weitere Kopfzeile einschleusen.
      'content-disposition': `inline; filename="${name.replace(/["\r\n]/g, '')}"`,
      // Der Typ steht fest, der Browser soll nicht daran herumraten.
      'x-content-type-options': 'nosniff',
      // Nicht zwischenspeichern, nicht indexieren, keinen Referrer verraten.
      ...GESCHUETZT_KOPFZEILEN,
    },
  });
};
