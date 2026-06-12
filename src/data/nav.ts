// Top-Navigation des Fördervereins (gewünschte Struktur 2026-06)
// Labels gewünscht: Der Verein · Mitglied werden · Spenden · Kontakt
// URLs: vorerst auf bestehende /foerderverein/-Routen verlinkt
//       (Umzug auf /verein/ in Folge-PR, sobald Inhalte stabil)
export const MAIN_NAV = [
  { label: 'Der Verein', href: '/foerderverein/' },
  { label: 'Mitglied werden', href: '/foerderverein/mitglied-werden/' },
  { label: 'Spenden', href: '/foerderverein/#spenden' },
  { label: 'Kontakt', href: '/kontakt/' }
];

// Backwards-compat: bestehende Komponenten importieren noch SCHOOL_NAV
export const SCHOOL_NAV = MAIN_NAV;

// In-Page-Navigation innerhalb der Vereinsseite (Anker)
export const VEREIN_NAV = [
  { label: 'Über uns', href: '/foerderverein/#ueber-uns' },
  { label: 'Projekte', href: '/foerderverein/#projekte' },
  { label: 'Brennpunkt', href: '/foerderverein/#brennpunkt' },
  { label: 'Zukunft', href: '/foerderverein/#zukunft' }
];
