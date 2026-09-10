// GET /api/export — Mitgliederliste als CSV, OHNE Bankdaten.
// Zugang über Basic Auth (EXPORT_USER / EXPORT_PASSWORT).
import type { APIRoute } from 'astro';
import { pruefeBasicAuth } from '../../lib/erfassung-crypto.ts';
import { alleEintraege, schemaSicherstellen } from '../../lib/erfassung-db.ts';
import { csvDokument, deDatum } from '../../lib/csv.ts';

export const prerender = false;

// Spalten nach Vorgabe; "Empfaenger" ist angehängt, damit sich der Export mit
// der bestehenden Serienbriefliste zusammenführen lässt — die kennt keine
// getrennten Vor-/Nachnamen, sondern nur ein Feld "Empfaenger".
const KOPF = [
  'Vorname', 'Nachname', 'Strasse', 'PLZ', 'Ort', 'Kind', 'Klasse', 'Beitrag',
  'Zahlweise', 'Mandatsreferenz', 'Einwilligung_Speicherung',
  'Einwilligung_Ansprache', 'Erfasst_am', 'Empfaenger',
];

const ZAHLWEISE: Record<string, string> = {
  sepa: 'SEPA-Lastschrift',
  ueberweisung: 'Überweisung',
};

export const GET: APIRoute = async ({ request }) => {
  if (!pruefeBasicAuth(request, 'EXPORT_USER', 'EXPORT_PASSWORT')) {
    return new Response('Zugang erforderlich', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Mitgliedererfassung"' },
    });
  }

  let rows: Record<string, any>[];
  try {
    await schemaSicherstellen();
    rows = await alleEintraege();
  } catch {
    return new Response('Export zurzeit nicht möglich', { status: 500 });
  }

  const zeilen = rows.map((r) => [
    r.vorname,
    r.nachname,
    r.strasse,
    r.plz,
    r.ort,
    r.kind_name ?? '',
    r.klasse ?? '',
    r.beitrag_eur,
    ZAHLWEISE[r.zahlweise] ?? r.zahlweise,
    r.mandatsreferenz ?? '',
    r.einwilligung_speicherung ? 'Ja' : 'Nein',
    r.einwilligung_ansprache ? 'Ja' : 'Nein',
    deDatum(r.erstellt_am),
    `${r.vorname} ${r.nachname}`,
  ]);

  const heute = new Date().toISOString().slice(0, 10);
  return new Response(csvDokument(KOPF, zeilen), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="mitglieder-${heute}.csv"`,
      'cache-control': 'private, no-store',
    },
  });
};
