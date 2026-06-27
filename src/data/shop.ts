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
  // Optional: auswählbare Größen (z. B. Kleidung). Wenn gesetzt, zeigt die
  // Shop-Seite ein Größen-Dropdown; die Auswahl wird in die Anfrage-Mail übernommen.
  groessen?: string[];
}

export const ARTIKEL: Artikel[] = [
  {
    name: 'Trinkflasche',
    preis: '19,99 €',
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
    preis: '19,99 €',
    beschreibung: 'Hochwertige Mepal-Brotdose mit Schul-Logo – ideal fürs Pausenbrot.',
    bild: '/img/shop/brotdose.jpg',
  },
  {
    name: 'Poloshirt',
    preis: '29,99 €',
    beschreibung: 'Offizielle Schulkleidung: hellblaues Poloshirt mit Schul-Logo. Bitte gewünschte Größe wählen.',
    bild: '/img/shop/poloshirt.jpg',
    groessen: [
      '110/116 (ca. 5–6 Jahre)',
      '122/128 (ca. 7–8 Jahre)',
      '134/140 (ca. 9–10 Jahre)',
      '146/152 (ca. 10–11 Jahre)',
    ],
  },
  {
    name: 'Sporttasche',
    preis: '19,99 €',
    beschreibung: 'Kleine Sporttasche mit Schul-Logo und abnehmbarem Schultergurt – ideal für die Sportsachen.',
    bild: '/img/shop/sporttasche.jpg',
  },
  {
    name: 'Poster „Revolution des Viaduktes"',
    preis: '7,99 €',
    beschreibung: 'Paul Klee, „Revolution des Viaduktes" (1937) · 60 × 50 cm. Das Logo der Paul-Klee-Schule beruht auf diesem ikonischen Bild des Malers. Ein Poster fürs Kinderzimmer – Erinnerung an den ersten Schritt.',
    bild: '/img/shop/poster-viadukt.jpg',
  },
].slice(0, 6); // Sicherheitsnetz: maximal 6 Artikel
