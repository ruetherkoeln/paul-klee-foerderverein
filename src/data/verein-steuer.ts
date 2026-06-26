// ───────────────────────────────────────────────────────────────────────────
// Steuer-/Rechts-Konfiguration für Zuwendungsbescheinigungen
// ───────────────────────────────────────────────────────────────────────────
// ⚠️  WICHTIG: Diese Werte stehen wörtlich auf einem rechtsverbindlichen
//     Steuerdokument. Vor Live-Schaltung von der Steuerberatung prüfen lassen.
//
//  AUSSTELLUNG_AKTIV bleibt FALSE, bis der gültige Freistellungsbescheid
//  vorliegt und die Gemeinnützigkeit wiederhergestellt ist. Solange false:
//  Das Formular zeigt einen Hinweis, der API-Endpoint stellt nichts aus.
// ───────────────────────────────────────────────────────────────────────────

export const STEUER = {
  // Master-Schalter. Erst auf true setzen, wenn der gültige Freistellungs-
  // bescheid vorliegt UND die Angaben unten geprüft sind.
  AUSSTELLUNG_AKTIV: false,

  // Aussteller (Verein)
  verein: {
    name: 'Förderverein der Paul-Klee-Schule Düsseldorf e. V.',
    strasse: 'Gerresheimer Straße 34/36',
    plz: '40211',
    ort: 'Düsseldorf',
  },

  // Finanzamt (öffentlich unkritisch)
  finanzamt: 'Finanzamt Düsseldorf-Mitte',
  // Steuernummer NICHT hier hinterlegen (öffentliches Repo) —
  // sie kommt zur Laufzeit aus der Env-Variable VEREIN_STEUERNUMMER
  // (siehe zuwendung-pdf.ts). Auf der Bescheinigung erscheint sie ohnehin.

  // ── Anerkennung der Gemeinnützigkeit ──────────────────────────────────────
  // Art des Bescheids bestimmt den exakten Wortlaut im Muster:
  //   'freistellung' → Freistellungsbescheid
  //   'feststellung' → vorläufige Feststellung nach § 60a AO (Neugründung)
  bescheid: {
    art: 'freistellung' as 'freistellung' | 'feststellung',
    // ⚠️ PLATZHALTER — aus dem GÜLTIGEN Freistellungsbescheid übernehmen:
    datum: 'TT.MM.JJJJ', // Datum des Freistellungsbescheids
    // Bei Freistellungsbescheid: für welche Jahre / welcher Veranlagungszeitraum
    veranlagungszeitraum: 'JJJJ',
  },

  // Begünstigte Zwecke laut Bescheid. WICHTIG: als Genitiv-Phrase, die direkt
  // auf das Wort „Förderung" folgt (das Muster setzt „Förderung" davor).
  // Also z. B. "der Erziehung, Volks- und Berufsbildung" — NICHT mit
  // „Förderung" beginnen.  ⚠️ PLATZHALTER — exakt aus dem Bescheid übernehmen.
  zwecke: 'der Erziehung, Volks- und Berufsbildung',

  // Sind Mitgliedsbeiträge bei diesem Verein steuerlich abziehbar?
  // (Bei Förderung von Bildung i.d.R. ja → false. Bei Sport/Kultur/Brauchtum
  //  o.ä. ggf. true.) Steuerberatung fragen.
  mitgliedsbeitraege_nicht_abziehbar: false,

  // Unterschriftsberechtigte Person (für die maschinelle Zeichnung im PDF)
  unterschrift: {
    name: 'PLATZHALTER Vorstand', // ⚠️ Name eintragen
    funktion: '1. Vorsitzende/r',
    // Optional: Pfad zu einer Unterschrifts-Grafik (PNG, transparent) in /public.
    // Leer lassen für rein maschinelle Ausstellung (zulässig, wenn elektronisch
    // erstellt und versendet).
    grafik: '', // z.B. '/img/unterschrift.png'
  },
} as const;
