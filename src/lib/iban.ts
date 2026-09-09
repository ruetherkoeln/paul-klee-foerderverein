// IBAN-Prüfung und -Formatierung. Bewusst ohne Abhängigkeit — die Regeln
// sind kurz und stabil (ISO 13616 / Modulo 97-10 nach ISO 7064).
// Wird von Browser UND Server importiert, daher kein node:crypto hier.

// SEPA-Teilnehmerländer mit ihrer jeweiligen IBAN-Länge.
export const SEPA_LAENGEN: Record<string, number> = {
  AD: 24, AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18,
  EE: 20, ES: 24, FI: 18, FR: 27, GB: 22, GI: 23, GR: 27, HR: 21, HU: 28,
  IE: 22, IS: 26, IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MT: 31,
  NL: 18, NO: 15, PL: 28, PT: 25, RO: 24, SE: 24, SI: 19, SK: 24, SM: 27,
  VA: 22,
};

/** Entfernt Leerzeichen und vereinheitlicht auf Großbuchstaben. */
export function normalisiereIban(eingabe: string): string {
  return (eingabe || '').replace(/[\s -]/g, '').toUpperCase();
}

/** Setzt die IBAN in Vierergruppen: DE81 3005 0110 0037 0362 66 */
export function formatiereIban(eingabe: string): string {
  return normalisiereIban(eingabe).replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Prüft Länderkennung, Länge und Prüfziffer.
 * Gibt null zurück, wenn alles stimmt — sonst eine Meldung im Klartext.
 */
export function pruefeIban(eingabe: string): string | null {
  const iban = normalisiereIban(eingabe);
  if (!iban) return 'Bitte geben Sie eine IBAN ein.';
  if (!/^[A-Z]{2}[0-9A-Z]+$/.test(iban)) {
    return 'Bitte geben Sie eine gültige IBAN ein. Sie beginnt mit zwei Buchstaben, zum Beispiel DE.';
  }
  const land = iban.slice(0, 2);
  const laenge = SEPA_LAENGEN[land];
  if (!laenge) {
    return `Das Länderkürzel ${land} gehört nicht zum SEPA-Raum. Bitte prüfen Sie Ihre Eingabe.`;
  }
  if (iban.length !== laenge) {
    return `Eine ${land}-IBAN hat ${laenge} Zeichen, Ihre Eingabe hat ${iban.length}.`;
  }
  if (!modulo97(iban)) {
    return 'Die IBAN ist nicht gültig. Bitte prüfen Sie die Ziffern auf einen Zahlendreher.';
  }
  return null;
}

/** Modulo-97-Prüfung: die ersten vier Zeichen nach hinten, Buchstaben zu Zahlen. */
function modulo97(iban: string): boolean {
  const umgestellt = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const zeichen of umgestellt) {
    const code = zeichen.charCodeAt(0);
    // A–Z werden zu 10–35, Ziffern bleiben Ziffern
    const wert = code >= 65 && code <= 90 ? String(code - 55) : zeichen;
    for (const ziffer of wert) {
      rest = (rest * 10 + Number(ziffer)) % 97;
    }
  }
  return rest === 1;
}

/** Nur die letzten vier Stellen — für Bestätigungsmail und Anzeige. */
export function ibanMaskiert(eingabe: string): string {
  const iban = normalisiereIban(eingabe);
  if (iban.length < 4) return '••••';
  return `•••• •••• •••• ${iban.slice(-4)}`;
}
