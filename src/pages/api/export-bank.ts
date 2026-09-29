// GET /api/export-bank — Bankdaten im Klartext für die Einreichung bei der
// Bank. Getrennt geschützt (EXPORT_BANK_USER / EXPORT_BANK_PASSWORT) und
// bewusst von der allgemeinen Mitgliederliste getrennt.
import type { APIRoute } from 'astro';
import { pruefeBasicAuth, entschluesseln } from '../../lib/erfassung-crypto.ts';
import { alleEintraege, schemaSicherstellen } from '../../lib/erfassung-db.ts';
import { csvDokument, deDatum } from '../../lib/csv.ts';
import { GESCHUETZT_KOPFZEILEN } from '../../lib/sicherheit.ts';
import {
  bremsen, fehlversuchZaehlen, gesperrt, herkunft, versucheLoeschen,
} from '../../lib/login-schutz.ts';
import { SICHERHEIT } from '../../data/sicherheit.ts';
import { formatiereIban } from '../../lib/iban.ts';

export const prerender = false;

const KOPF = [
  'Mandatsreferenz', 'Kontoinhaber', 'IBAN', 'Beitrag', 'Mandat_erteilt_am',
  'Vorname', 'Nachname', 'Strasse', 'PLZ', 'Ort', 'Email',
];

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

  let rows: Record<string, any>[];
  try {
    await schemaSicherstellen();
    rows = await alleEintraege();
  } catch {
    return new Response('Export zurzeit nicht möglich', { status: 500 });
  }

  const zeilen = rows
    .filter((r) => r.zahlweise === 'sepa' && r.iban_verschluesselt)
    .map((r) => {
      let iban = '';
      let inhaber = '';
      try {
        iban = formatiereIban(entschluesseln(r.iban_verschluesselt));
        inhaber = r.kontoinhaber_verschluesselt
          ? entschluesseln(r.kontoinhaber_verschluesselt)
          : '';
      } catch {
        iban = 'ENTSCHLUESSELUNG FEHLGESCHLAGEN';
      }
      return [
        r.mandatsreferenz ?? '',
        inhaber,
        iban,
        r.beitrag_eur,
        deDatum(r.mandat_erteilt_am),
        r.vorname,
        r.nachname,
        r.strasse,
        r.plz,
        r.ort,
        r.email,
      ];
    });

  const heute = new Date().toISOString().slice(0, 10);
  return new Response(csvDokument(KOPF, zeilen), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="sepa-mandate-${heute}.csv"`,
      'x-content-type-options': 'nosniff',
      ...GESCHUETZT_KOPFZEILEN,
    },
  });
};
