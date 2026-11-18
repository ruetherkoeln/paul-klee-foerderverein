// ───────────────────────────────────────────────────────────────────────────
// Steuer-/Rechts-Konfiguration für Zuwendungsbescheinigungen
// ───────────────────────────────────────────────────────────────────────────
// ⚠️  WICHTIG: Diese Werte stehen wörtlich auf einem rechtsverbindlichen
//     Steuerdokument. Vor Live-Schaltung von der Steuerberatung prüfen lassen.
//
//  Seit dem Freistellungsbescheid vom 17.11.2026 (FA Düsseldorf-Mitte, VZ 2025)
//  ist die Gemeinnützigkeit wieder anerkannt — AUSSTELLUNG_AKTIV steht auf true.
//  Auf false gesetzt zeigt das Formular einen Hinweis, die API stellt nichts aus.
//  Der Bescheid gilt für Bestätigungen 5 Jahre ab seinem Datum (bis 17.11.2031),
//  danach den neuen Bescheid hier eintragen.
// ───────────────────────────────────────────────────────────────────────────

export const STEUER = {
  // Master-Schalter für die Online-Ausstellung.
  AUSSTELLUNG_AKTIV: true,

  // Aussteller (Verein)
  verein: {
    name: 'Förderverein Paul-Klee-Schule Düsseldorf e. V.',
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
    datum: '17.11.2026', // Datum des Freistellungsbescheids
    veranlagungszeitraum: '2025', // letzter Veranlagungszeitraum laut Bescheid
  },

  // Begünstigte Zwecke laut Bescheid. WICHTIG: als Genitiv-Phrase, die direkt
  // auf das Wort „Förderung" folgt (das Muster setzt „Förderung" davor).
  // Wortlaut laut Bescheid vom 17.11.2026 (§ 52 Abs. 2 Satz 1 Nr. 7 AO).
  zwecke: 'der Volks- und Berufsbildung einschließlich der Studentenhilfe',

  // Sind Mitgliedsbeiträge bei diesem Verein steuerlich abziehbar?
  // (Bei Förderung von Bildung i.d.R. ja → false. Bei Sport/Kultur/Brauchtum
  //  o.ä. ggf. true.) Steuerberatung fragen.
  mitgliedsbeitraege_nicht_abziehbar: false,

  // Unterschriftsberechtigte Person (für die maschinelle Zeichnung im PDF)
  unterschrift: {
    name: 'A. Ruether',
    funktion: '1. Vorsitzender',
    // Optional: Pfad zu einer Unterschrifts-Grafik (PNG, transparent) in /public.
    // Leer lassen für rein maschinelle Ausstellung (zulässig, wenn elektronisch
    // erstellt und versendet).
    grafik: '', // z.B. '/img/unterschrift.png'
  },

  // ── Briefpapier: Angaben für Kopf/Fußzeile der Bescheinigung ───────────────
  kontakt: {
    email: 'info@pks-foerderverein.de',
    web: 'www.pks-foerderverein.de',
  },
  register: {
    gericht: 'Amtsgericht Düsseldorf',
    nummer: 'VR 7008',
  },
  bank: {
    institut: 'Stadtsparkasse Düsseldorf',
    iban: 'DE81 3005 0110 0037 0362 66',
    bic: 'DUSSDEDDXXX',
  },
  vorstand: [
    'A. Ruether (1. Vorsitzender)',
    'S. Buchwald (2. Vorsitzende)',
    'P. Müller (Kassenwartin)',
    'H. Bassit (Beisitzerin)',
    'M. Dambeck (Schriftführerin)',
  ],
} as const;
