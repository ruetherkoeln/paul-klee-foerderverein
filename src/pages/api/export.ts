// GET /api/export — Mitgliederliste als CSV, OHNE Bankdaten.
// Zugang über Basic Auth (EXPORT_USER / EXPORT_PASSWORT).
import type { APIRoute } from 'astro';
import { pruefeBasicAuth } from '../../lib/erfassung-crypto.ts';
import { mitgliederCsv, csvAntwort } from '../../lib/export-listen.ts';
import { GESCHUETZT_KOPFZEILEN } from '../../lib/sicherheit.ts';
import {
  bremsen, fehlversuchZaehlen, gesperrt, herkunft, versucheLoeschen,
} from '../../lib/login-schutz.ts';
import { SICHERHEIT } from '../../data/sicherheit.ts';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  // Durchprobieren der Zugangsdaten begrenzen. Gezaehlt wird nur, wenn
  // ueberhaupt Zugangsdaten mitkamen: Der Browser schickt die erste Anfrage
  // grundsaetzlich ohne, und die ist kein Fehlversuch, sondern der normale
  // Auftakt des Dialogs.
  const spur = herkunft('export', request);
  const mitZugangsdaten = Boolean(request.headers.get('authorization'));

  if (mitZugangsdaten && (await gesperrt(spur))) {
    return new Response('Zu viele Fehlversuche. Bitte spaeter erneut versuchen.', {
      status: 429,
      headers: {
        'retry-after': String(SICHERHEIT.LOGIN_FENSTER_MIN * 60),
        ...GESCHUETZT_KOPFZEILEN,
      },
    });
  }

  if (!pruefeBasicAuth(request, 'EXPORT_USER', 'EXPORT_PASSWORT')) {
    if (mitZugangsdaten) {
      await fehlversuchZaehlen(spur);
      await bremsen();
    }
    return new Response('Zugang erforderlich', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Mitgliedererfassung"',
        ...GESCHUETZT_KOPFZEILEN,
      },
    });
  }
  await versucheLoeschen(spur);

  try {
    return csvAntwort(await mitgliederCsv(), 'mitglieder');
  } catch {
    return new Response('Export zurzeit nicht möglich', { status: 500 });
  }
};
