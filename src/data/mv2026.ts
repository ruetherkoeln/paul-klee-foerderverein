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
  // Übernommen aus der Einladung vom 30.09.2026.
  datum: 'Montag, 9. November 2026',
  uhrzeit: '18:30 Uhr',
  ort: 'Paul-Klee-Schule, Raum gemäß Aushang, Gerresheimer Straße, Düsseldorf',
};

export interface Unterlage {
  datei: string;        // Dateiname unter src/dokumente/mv2026/
  titel: string;
  hinweis?: string;
}

export const UNTERLAGEN: Unterlage[] = [
  {
    datei: '01-einladung-tagesordnung.pdf',
    titel: 'Einladung mit Tagesordnung',
    hinweis: 'Einladung des Vorstands vom 30.09.2026 zur außerordentlichen Mitgliederversammlung, mit der vollständigen Tagesordnung und den Hinweisen zum Ablauf.',
  },
  {
    datei: '02-anlage-1-uebersicht-aenderungen.pdf',
    titel: 'Anlage 1 · Übersicht der vorgesehenen Änderungen',
    hinweis: 'Gegenüberstellung der geltenden und der vorgeschlagenen Satzung, Paragraph für Paragraph, mit einer kurzen Begründung je Änderung.',
  },
  {
    datei: '03-anlage-2-satzung-neufassung.pdf',
    titel: 'Anlage 2 · Satzung in der Neufassung (Entwurf)',
    hinweis: 'Der vollständige Text, über den abgestimmt wird — zwölf Paragraphen statt bisher dreizehn.',
  },
  {
    datei: '04-anlage-3-gewinnermittlung.pdf',
    titel: 'Anlage 3 · Gewinnermittlung 2024/2025 bis Juli',
    hinweis: 'Erstellt durch die beauftragte Kanzlei. Einnahmen 22.377,87 EUR, Ausgaben 24.133,32 EUR.',
  },
];
