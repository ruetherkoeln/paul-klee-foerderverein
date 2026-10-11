// Die beiden CSV-Listen des Vorstands. Nur serverseitig importieren.
//
// Gemeinsame Quelle für die alten Adressen (/api/export, /api/export-bank,
// Basic Auth) und die Knöpfe im Vorstandsbereich — beide liefern dieselbe
// Datei, damit niemand zwei Fassungen derselben Liste vergleichen muss.
import { entschluesseln } from './erfassung-crypto.ts';
import { alleEintraege, schemaSicherstellen } from './erfassung-db.ts';
import { csvDokument, deDatum } from './csv.ts';
import { formatiereIban } from './iban.ts';
import { GESCHUETZT_KOPFZEILEN } from './sicherheit.ts';

// Seit dem Mitgliedsantrag schreiben zwei Wege in dieselbe Tabelle. Ohne diese
// Angabe liesse sich nicht erkennen, ob jemand neu beitreten will oder ob ein
// Bestandsmitglied nur seine Angaben nachgetragen hat — und nur im ersten
// Fall muss der Vorstand ueber eine Aufnahme entscheiden.
export const HERKUNFT: Record<string, string> = {
  mitgliedsantrag: 'Mitgliedsantrag',
  'mitgliedererfassung-2026': 'Bestandserfassung',
};

export const ZAHLWEISE: Record<string, string> = {
  sepa: 'SEPA-Lastschrift',
  ueberweisung: 'Überweisung',
};

// ── Mitgliederliste (ohne Bankdaten) ────────────────────────────────────────
// Spalten nach Vorgabe; "Empfaenger" ist angehängt, damit sich der Export mit
// der bestehenden Serienbriefliste zusammenführen lässt — die kennt keine
// getrennten Vor-/Nachnamen, sondern nur ein Feld "Empfaenger".
const KOPF_LISTE = [
  'Herkunft', 'Vorname', 'Nachname', 'Strasse', 'PLZ', 'Ort', 'Kind', 'Klasse', 'Beitrag',
  'Zahlweise', 'Mandatsreferenz', 'Einwilligung_Speicherung',
  'Einwilligung_Ansprache', 'Erfasst_am', 'Empfaenger', 'Ausgetreten_am',
];

export async function mitgliederCsv(): Promise<string> {
  await schemaSicherstellen();
  const rows = await alleEintraege();
  const zeilen = rows.map((r) => [
    HERKUNFT[r.quelle] ?? (r.quelle ?? ''),
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
    r.ausgetreten_am ? deDatum(r.ausgetreten_am) : '',
  ]);
  return csvDokument(KOPF_LISTE, zeilen);
}

// ── SEPA-Mandate (Bankdaten im Klartext) ────────────────────────────────────
const KOPF_SEPA = [
  'Mandatsreferenz', 'Kontoinhaber', 'IBAN', 'Beitrag', 'Mandat_erteilt_am',
  'Vorname', 'Nachname', 'Strasse', 'PLZ', 'Ort', 'Email',
];

export async function sepaCsv(): Promise<string> {
  await schemaSicherstellen();
  const rows = await alleEintraege();
  const zeilen = rows
    // Ausgetretene nicht mehr einziehen — siehe /mitgliedschaft-kuendigen/
    .filter((r) => r.zahlweise === 'sepa' && r.iban_verschluesselt && !r.ausgetreten_am)
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
  return csvDokument(KOPF_SEPA, zeilen);
}

/** Antwort mit der CSV als Download. */
export function csvAntwort(inhalt: string, praefix: string): Response {
  const heute = new Date().toISOString().slice(0, 10);
  return new Response(inhalt, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${praefix}-${heute}.csv"`,
      'x-content-type-options': 'nosniff',
      ...GESCHUETZT_KOPFZEILEN,
    },
  });
}
