// Der Vorstand — gemeinsame Quelle für Impressum und Kontaktseite.
//
// Beide Seiten nennen dieselben vier Personen. Getrennt gepflegt würden sie
// nach einer Neuwahl auseinanderlaufen, und ein Impressum mit einem
// ausgeschiedenen Vorstand ist nicht nur unschön, sondern fehlerhaft.
//
// Schreibweise mit abgekürztem Vornamen, wie das Impressum sie bisher führt.

export interface Vorstandsmitglied {
  name: string;
  funktion: string;
}

export const VORSTAND: Vorstandsmitglied[] = [
  { name: 'A. Ruether',  funktion: '1. Vorsitzender' },
  { name: 'S. Buchwald', funktion: '2. Vorsitzende' },
  { name: 'P. Müller',   funktion: 'Kassenwartin' },
  { name: 'H. Bassit',   funktion: 'Beisitzerin' },
];

/** Sitzung, in der dieser Vorstand gewählt wurde. */
export const VORSTAND_GEWAEHLT = 'Mitgliederversammlung vom 21. April 2026';
