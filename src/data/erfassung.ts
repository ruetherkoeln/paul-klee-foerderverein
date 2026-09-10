// ───────────────────────────────────────────────────────────────────────────
// Konfiguration der temporären Mitgliederbestands-Erfassung
// ───────────────────────────────────────────────────────────────────────────
// Die Seite /mitglied-werden richtet sich ausschließlich an die bereits
// angeschriebenen Bestandsmitglieder. Sie trägt noindex und wird nach Ablauf
// des Erfassungszeitraums automatisch durch eine Hinweisseite ersetzt.
// ───────────────────────────────────────────────────────────────────────────
import { SITE } from './site.ts';
import { STEUER } from './verein-steuer.ts';

export const ERFASSUNG = {
  // Enddatum des Erfassungszeitraums (einschließlich). Ab dem Folgetag zeigen
  // /mitglied-werden und der API-Endpoint die Hinweisseite bzw. lehnen ab.
  ENDE: '2026-11-30',

  // Beitragsstufen und zulässiger Rahmen für den freien Betrag (in Euro)
  STUFEN: [12, 24, 36, 60] as const,
  MIN_EUR: 12,
  MAX_EUR: 60,

  // Anzeige-Texte, die an mehreren Stellen gebraucht werden
  verein: {
    name: STEUER.verein.name,
    strasse: STEUER.verein.strasse,
    plz: STEUER.verein.plz,
    ort: STEUER.verein.ort,
    email: SITE.email,
    datenschutzUrl: '/datenschutz/',
  },

  // Bankverbindung für Selbstüberweiser (steht bereits in verein-steuer.ts —
  // bewusst nicht zusätzlich als Env-Var, um doppelte Pflege zu vermeiden)
  bank: STEUER.bank,

  // Ratenbegrenzung: höchstens N Absendeversuche pro IP innerhalb des Fensters
  RATE_MAX: 5,
  RATE_FENSTER_MIN: 60,
} as const;

// ── Laufzeit-Schalter ───────────────────────────────────────────────────────
// ERFASSUNG_AKTIV muss ausdrücklich auf "true" stehen; alles andere gilt als
// aus. Zusätzlich greift das Enddatum oben.
export function erfassungAktiv(getEnv: (k: string) => string | undefined): {
  aktiv: boolean;
  grund: 'aktiv' | 'abgeschaltet' | 'abgelaufen';
} {
  // .trim(), weil beim Einfuegen in Vercel leicht ein Leerzeichen oder
  // Zeilenumbruch mit im Wert landet.
  if ((getEnv('ERFASSUNG_AKTIV') ?? '').trim().toLowerCase() !== 'true') {
    return { aktiv: false, grund: 'abgeschaltet' };
  }
  // Vergleich auf Tagesbasis in lokaler Zeit (Europe/Berlin auf Vercel via TZ)
  const heute = new Date().toISOString().slice(0, 10);
  if (heute > ERFASSUNG.ENDE) return { aktiv: false, grund: 'abgelaufen' };
  return { aktiv: true, grund: 'aktiv' };
}

// ⚠️  VOR DEM DEPLOYMENT ZU BEFÜLLEN — siehe MITGLIEDERERFASSUNG.md
//     DATABASE_URL                 (setzt die Neon-Integration selbst)
//     ERFASSUNG_AKTIV=true
//     ERFASSUNG_CRYPTO_KEY         32 Byte, base64 — verschlüsselt IBAN/Inhaber
//     ERFASSUNG_SIGNING_SECRET     signiert die Links zum Mandats-PDF
//     VEREIN_KOPIE_EMAIL           Empfänger der Eintragungs-Kopien
//     RESEND_API_KEY / MAIL_FROM   Versand der Bestätigungen
//     EXPORT_USER / EXPORT_PASSWORT
//     EXPORT_BANK_USER / EXPORT_BANK_PASSWORT

// ── Fehlertexte ─────────────────────────────────────────────────────────────
// Klartext, wird der eintragenden Person direkt angezeigt.
export const FEHLERTEXT: Record<string, string> = {
  inaktiv: 'Die Erfassung ist abgeschlossen. Bitte wenden Sie sich an den Vorstand.',
  pflicht: 'Bitte füllen Sie alle Pflichtfelder aus.',
  plz: 'Die Postleitzahl muss aus genau fünf Ziffern bestehen.',
  email: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
  beitrag: 'Der Jahresbeitrag muss zwischen 12 und 60 Euro liegen.',
  zahlweise: 'Bitte wählen Sie eine Zahlungsweise.',
  iban: 'Bitte geben Sie eine gültige IBAN ein.',
  kontoinhaber: 'Bitte geben Sie den Namen des Kontoinhabers an.',
  signatur: 'Bitte unterschreiben Sie das Mandat im dafür vorgesehenen Feld.',
  mandat: 'Bitte bestätigen Sie das SEPA-Lastschriftmandat.',
  einwilligung:
    'Bitte erteilen Sie beide Einwilligungen, sonst können wir die Daten nicht speichern.',
  limit: 'Es wurden zu viele Anfragen von diesem Anschluss gesendet. Bitte versuchen Sie es später erneut.',
  technik: 'Die Angaben konnten nicht gespeichert werden. Bitte versuchen Sie es später erneut.',
};

// Gläubiger-Identifikationsnummer des Vereins (Deutsche Bundesbank).
// Steht auf jedem erteilten Mandat und auf den Kontoauszügen aller Mitglieder,
// ist also kein Geheimnis — daher hier fest hinterlegt statt als Env-Variable.
// VEREIN_GLAEUBIGER_ID überschreibt den Wert, falls er sich einmal ändert.
export const GLAEUBIGER_ID = 'DE63ZZZ00002943367';
