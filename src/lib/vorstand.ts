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

/** „2026-11-09“ → „Mo., 9. November 2026“ */
export function terminDatum(iso: string): string {
  const [j, m, t] = iso.split('-').map(Number);
  return new Date(Date.UTC(j!, m! - 1, t!)).toLocaleDateString('de-DE', {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** Uhrzeit eines Termins zur Anzeige: „18:30“ → „18:30 Uhr“, „18:00–21:00“ →
 *  „18:00–21:00 Uhr“, „1. Stunde“ bleibt (Schultermine bringen auch solche mit). */
export function zeitText(uhrzeit: string | null): string {
  if (!uhrzeit) return '';
  return /^\d{1,2}:\d{2}/.test(uhrzeit) ? `${uhrzeit} Uhr` : uhrzeit;
}
