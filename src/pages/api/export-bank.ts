// GET /api/export-bank — Bankdaten im Klartext für die Einreichung bei der
// Bank. Getrennt geschützt (EXPORT_BANK_USER / EXPORT_BANK_PASSWORT) und
// bewusst von der allgemeinen Mitgliederliste getrennt.
import type { APIRoute } from 'astro';
import { pruefeBasicAuth } from '../../lib/erfassung-crypto.ts';
import { sepaCsv, csvAntwort } from '../../lib/export-listen.ts';
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
  const spur = herkunft('export-bank', request);
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

  if (!pruefeBasicAuth(request, 'EXPORT_BANK_USER', 'EXPORT_BANK_PASSWORT')) {
    if (mitZugangsdaten) {
      await fehlversuchZaehlen(spur);
      await bremsen();
    }
    return new Response('Zugang erforderlich', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="SEPA-Mandate"',
        ...GESCHUETZT_KOPFZEILEN,
      },
    });
  }
  await versucheLoeschen(spur);

  try {
    return csvAntwort(await sepaCsv(), 'sepa-mandate');
  } catch {
    return new Response('Export zurzeit nicht möglich', { status: 500 });
  }
};
