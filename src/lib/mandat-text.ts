// Wortlaut des SEPA-Lastschriftmandats an einer Stelle, damit Formular und
// PDF nicht auseinanderlaufen. Kein node:-Import — wird auch im Browser genutzt.
import { ERFASSUNG } from '../data/erfassung.ts';

export interface MandatAngaben {
  glaeubigerId: string;
  /** Mandatsreferenz — vor dem Absenden noch unbekannt. */
  referenz?: string;
}

export const REFERENZ_OFFEN = 'wird Ihnen mit der Bestätigung mitgeteilt';

export function mandatstext({ glaeubigerId, referenz }: MandatAngaben): string[] {
  const v = ERFASSUNG.verein;
  return [
    `Ich ermächtige den ${v.name}, Zahlungen von meinem Konto mittels ` +
      `Lastschrift einzuziehen. Zugleich weise ich mein Kreditinstitut an, die ` +
      `vom ${v.name} auf mein Konto gezogenen Lastschriften einzulösen.`,
    'Hinweis: Ich kann innerhalb von acht Wochen, beginnend mit dem ' +
      'Belastungsdatum, die Erstattung des belasteten Betrages verlangen. Es ' +
      'gelten dabei die mit meinem Kreditinstitut vereinbarten Bedingungen.',
    `Zahlungsempfänger: ${v.name}, ${v.strasse}, ${v.plz} ${v.ort}`,
    `Gläubiger-Identifikationsnummer: ${glaeubigerId}`,
    `Mandatsreferenz: ${referenz ?? REFERENZ_OFFEN}`,
    'Art der Zahlung: wiederkehrende Zahlung des Jahresbeitrags.',
  ];
}
