// ───────────────────────────────────────────────────────────────────────────
// Shop – reines „Schaufenster" (kein Online-Verkauf/Versand).
// Die Artikel werden in der Schule an die Kinder ausgegeben. Anfrage per E-Mail.
// Max. 5 Artikel.
//
// Bilder: bitte unter public/img/shop/ ablegen (Dateinamen siehe unten).
// Fehlt ein Bild, zeigt die Seite automatisch einen „Foto folgt"-Platzhalter.
// ───────────────────────────────────────────────────────────────────────────

export interface Artikel {
  name: string;
  preis?: string;
  beschreibung: string;
  bild?: string;
}

export const ARTIKEL: Artikel[] = [
  {
    name: 'Trinkflasche',
    preis: '29,99 €',
    beschreibung: 'Isolierte Edelstahl-Trinkflasche mit dem Logo der Paul-Klee-Grundschule. Erhältlich in Schwarz, Rosé und Gelb.',
    bild: '/img/shop/trinkflasche.jpg',
  },
  {
    name: 'Frühstücksbecher',
    preis: '9,99 €',
    beschreibung: 'Keramik-Frühstücksbecher mit Schul-Logo – erhältlich in Weiß und Hellblau.',
    bild: '/img/shop/fruehstuecksbecher.jpg',
  },
  {
    name: 'Brotdose',
    preis: '34,99 €',
    beschreibung: 'Hochwertige Mepal-Brotdose mit Schul-Logo – ideal fürs Pausenbrot.',
    bild: '/img/shop/brotdose.jpg',
  },
  {
    name: 'Poloshirt',
    preis: '29,99 €',
    beschreibung: 'Offizielle Schulkleidung: hellblaues Poloshirt mit Schul-Logo. In verschiedenen Größen (z. B. 128).',
    bild: '/img/shop/poloshirt.jpg',
  },
].slice(0, 5); // Sicherheitsnetz: maximal 5 Artikel
