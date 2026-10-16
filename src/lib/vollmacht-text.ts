// Wortlaut der Abstimmungsvollmacht. Einzige Quelle für die Online-Fassung
// und für das PDF — beide lesen dieselben Absätze.
import { VERSAMMLUNG } from '../data/mv2026.ts';
import { BEVOLLMAECHTIGTE } from '../data/vollmacht.ts';
import { STEUER } from '../data/verein-steuer.ts';
import { SITE } from '../data/site.ts';

// Genitiv des Vereinsnamens — eine Quelle fuer alle Seiten, siehe site.ts.
export const VEREIN_GENITIV = SITE.nameGenitiv;

export const VOLLMACHT_UNTERTITEL =
  `zur Vertretung in der außerordentlichen Mitgliederversammlung 2026 des ${VEREIN_GENITIV}`;

export function versammlungSatz(): string {
  const teile = [VERSAMMLUNG.datum, VERSAMMLUNG.uhrzeit, VERSAMMLUNG.ort].filter(Boolean);
  return teile.join(', ');
}

/** Die Erklärung selbst. Jeder Eintrag ist ein Absatz. */
export function erklaerung(): string[] {
  const v = VEREIN_GENITIV;
  const b = `${BEVOLLMAECHTIGTE.anrede} ${BEVOLLMAECHTIGTE.name}`;
  return [
    `Ich bin Mitglied des ${v} und kann an der außerordentlichen Mitgliederversammlung `
      + 'nicht persönlich teilnehmen.',

    `Hiermit bevollmächtige ich ${b}, mich in der außerordentlichen Mitgliederversammlung `
      + `des ${v} am ${versammlungSatz()} zu vertreten.`,

    'Die Vollmacht umfasst die Teilnahme an der Versammlung, das Rede- und Antragsrecht '
      + 'sowie die Ausübung meines Stimmrechts bei allen Punkten der Tagesordnung, '
      + 'einschließlich etwaiger Änderungs- und Ergänzungsanträge und einschließlich der '
      + 'Abstimmung über die Neufassung der Satzung.',

    'Eine Weisung zum Abstimmungsverhalten erteile ich ausdrücklich nicht. Die '
      + 'bevollmächtigte Person stimmt in allen Punkten nach freiem Ermessen ab.',

    'Die Vollmacht gilt auch für eine Fortsetzung dieser Versammlung sowie für eine '
      + 'wegen Beschlussunfähigkeit erneut einberufene Versammlung mit derselben '
      + 'Tagesordnung. Darüber hinaus gilt sie nicht.',

    'Die Vollmacht ist jederzeit widerruflich. Der Widerruf kann gegenüber dem Vorstand '
      + 'oder gegenüber der bevollmächtigten Person erklärt werden und wirkt bis zur '
      + 'Stimmabgabe. Nehme ich selbst an der Versammlung teil, erlischt die Vollmacht.',
  ];
}

/** Hinweise rund um die Erklärung — nicht Teil des erklärten Willens. */
export function hinweise(): string[] {
  return [
    'Die bevollmächtigte Person muss selbst Mitglied des Vereins sein.',
    'Bitte übergeben Sie die unterschriebene Vollmacht der bevollmächtigten Person oder '
      + `senden Sie sie vorab an ${STEUER.kontakt.email}.`,
    'Je Mitglied kann nur eine Vollmacht erteilt werden. Erscheinen Sie selbst, gilt Ihre '
      + 'eigene Stimme.',
  ];
}

export const DATENSCHUTZ_HINWEIS =
  'Ihre Angaben und Ihre Unterschrift werden ausschließlich zur Durchführung dieser '
  + 'Mitgliederversammlung verwendet, an den Vorstand übermittelt und nach Ablauf der '
  + 'Aufbewahrungsfrist gelöscht. Eine Weitergabe an Dritte findet nicht statt.';
