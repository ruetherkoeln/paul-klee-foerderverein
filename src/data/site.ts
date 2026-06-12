export const SITE = {
  // Identität: Wir sind der Förderverein, nicht die Schule
  name: 'Förderverein der Paul-Klee-Schule Düsseldorf e. V.',
  shortName: 'Förderverein Paul-Klee-Schule',
  url: 'https://www.foerderverein-paulklee-duesseldorf.de',
  description: 'Wir unterstützen die Städt. Katholische Grundschule Paul-Klee in Düsseldorf-Pempelfort — mit Lernmitteln, Klassenfahrten, Frühstück und digitaler Teilhabe für rund 220 Kinder.',

  // Verein-Anschrift (eigenständige Rechtsperson, Sitz an der Schule)
  address: {
    street: 'Gerresheimer Straße 34/36',
    zip: '40211',
    city: 'Düsseldorf'
  },

  // Externer Verweis auf die Schule, deren Arbeit wir unterstützen
  school: {
    name: 'Paul-Klee-Schule',
    fullName: 'Städt. Katholische Grundschule Paul-Klee Düsseldorf',
    website: 'https://www.grundschule-paul-klee.de',
    logo: '/img/paul-klee-schule-logo.png',
    address: {
      street: 'Gerresheimer Straße 34',
      zip: '40211',
      city: 'Düsseldorf'
    },
    phone: '0211 89 23 752',
    fax: '0211 89 23 756',
    email: 'sekretariat.gerresheimerstr-kg@duesseldorf.de'
  },

  // Kontakt zum Förderverein
  email: 'info@foerderverein-paulklee-duesseldorf.de',

  // Backwards-compat: alte Felder, damit bestehende Komponenten weiter bauen
  // (TODO: nach vollständiger Migration entfernen)
  phone: '0211 89 23 752',
  fax: '0211 89 23 756',
  emailSchool: 'sekretariat.gerresheimerstr-kg@duesseldorf.de',
  emailVerein: 'info@foerderverein-paulklee-duesseldorf.de'
};
