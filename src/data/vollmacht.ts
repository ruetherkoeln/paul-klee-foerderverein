// Abstimmungsvollmacht für die außerordentliche Mitgliederversammlung.
//
// Hier stehen nur die Stellschrauben. Der Wortlaut der Erklärung steht in
// src/lib/vollmacht-text.ts und wird von der Webseite und vom PDF aus
// derselben Quelle gelesen — die beiden können deshalb nicht auseinander
// laufen.

/** Die Person, der die Vollmacht erteilt wird. Steht so im Formular, im PDF
 *  und in der Mail an den Vorstand. */
export const BEVOLLMAECHTIGTE = {
  anrede: 'Frau',
  name: 'Maike Dambeck',
} as const;

export const VOLLMACHT_FEHLER: Record<string, string> = {
  felder: 'Bitte füllen Sie Vorname, Nachname und Anschrift aus.',
  email: 'Bitte geben Sie eine gültige E-Mail-Adresse an — Sie erhalten Ihre Vollmacht als PDF.',
  signatur: 'Es fehlt die Unterschrift. Bitte zeichnen Sie im Feld.',
  bestaetigt: 'Bitte bestätigen Sie, dass Sie die Vollmacht erteilen.',
  zugang: 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut mit dem Passwort an.',
  versand: 'Die Vollmacht konnte nicht zugestellt werden. Bitte nutzen Sie das PDF zum '
    + 'Ausdrucken oder schreiben Sie uns an info@pks-foerderverein.de.',
  technik: 'Das hat technisch nicht geklappt. Bitte versuchen Sie es noch einmal oder '
    + 'nutzen Sie das PDF zum Ausdrucken.',
};
