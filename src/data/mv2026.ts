// Außerordentliche Mitgliederversammlung 2026 — Angaben zur Versammlung und
// die Liste der Unterlagen.
//
// Eine Unterlage erscheint auf der Seite, sobald ihre Datei unter
// src/dokumente/mv2026/ liegt und der nächste Deploy gelaufen ist. Wer hier
// einen Eintrag hinterlegt, bestimmt Reihenfolge, Titel und Erläuterung und
// sieht den Punkt auch vorher schon als „folgt". Eine Datei ohne Eintrag wird
// trotzdem angezeigt; ihr Titel wird dann aus dem Dateinamen gebildet.

export const VERSAMMLUNG = {
  titel: 'Außerordentliche Mitgliederversammlung 2026',
  kurz: 'AO Mitgliederversammlung 2026',
  // Sobald Datum, Uhrzeit und Ort feststehen, hier eintragen — sie erscheinen
  // dann im Kopf der Seite. Leer lassen heißt: wird nicht angezeigt.
  datum: '',
  uhrzeit: '',
  ort: '',
};

export interface Unterlage {
  datei: string;        // Dateiname unter src/dokumente/mv2026/
  titel: string;
  hinweis?: string;
}

export const UNTERLAGEN: Unterlage[] = [
  {
    datei: 'einladung-tagesordnung.pdf',
    titel: 'Einladung mit Tagesordnung',
    hinweis: 'Fristgerechte Einladung des Vorstands samt Tagesordnung der Versammlung.',
  },
  {
    datei: 'vollmacht.pdf',
    titel: 'Vollmachtsformular',
    hinweis: 'Für Mitglieder, die nicht teilnehmen können und sich vertreten lassen möchten. Ausgefüllt und unterschrieben mitgeben oder vorab an den Vorstand senden.',
  },
];
