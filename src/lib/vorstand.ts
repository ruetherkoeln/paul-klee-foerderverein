// Zugang zum Vorstandsbereich (/vorstand/). Mechanik in zugang.ts.
//
// Ein gemeinsames Passwort für den ganzen Vorstand (VORSTAND_PASSWORT).
// Die Bankdaten (SEPA-Export) verlangen zusätzlich das getrennte
// Bank-Passwort EXPORT_BANK_PASSWORT — die Trennung zwischen Mitgliederliste
// und Kontodaten aus den bisherigen Export-Adressen bleibt damit erhalten.
import { zugang } from './zugang.ts';

export const VORSTAND = zugang({
  cookie: '__Host-vorstand',
  passwortVar: 'VORSTAND_PASSWORT',
  geheimnisVar: 'VORSTAND_SIGNING_SECRET',
  zweck: 'vorstand-zugang',
  // Anders als bei /mv2026/ kommt hier niemand über einen Link aus einer Mail
  // herein. "strict" schickt das Cookie bei keinem Aufruf von fremden Seiten
  // mit — Formulare im Bereich sind damit doppelt gegen CSRF geschützt.
  sameSite: 'strict',
  gueltigMs: 1000 * 60 * 60 * 12,
});

export const KONTAKT = 'info@pks-foerderverein.de';
export const START = '/vorstand/';

/** Umleitung zur Anmeldung, für Unterseiten und Dateien ohne gültiges Cookie. */
export const zurAnmeldung = () =>
  new Response(null, { status: 303, headers: { Location: START } });

/** 2,3 MB bzw. 180 KB — für die Dokumentenliste. */
export function groesse(bytes: number): string {
  const mb = 1024 * 1024;
  if (bytes >= mb) return `${(bytes / mb).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
