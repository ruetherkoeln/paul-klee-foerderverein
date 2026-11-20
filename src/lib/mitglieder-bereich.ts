// Zugang zum Mitgliederbereich (/mitglieder/). Mechanik in zugang.ts.
//
// Ein gemeinsames Passwort für alle Mitglieder (MITGLIEDER_PASSWORT), getrennt
// vom Vorstandspasswort: Wer hier hineinkommt, kommt damit nicht in den
// Vorstandsbereich. Zu sehen sind nur Dokumente, die der Vorstand unter
// /vorstand/dokumente/ ausdrücklich für Mitglieder freigegeben hat.
import { zugang } from './zugang.ts';
import { GESCHUETZT_KOPFZEILEN } from './sicherheit.ts';
import type { Dokument } from './vorstand-db.ts';

export const MITGLIEDER = zugang({
  cookie: '__Host-mitglieder',
  passwortVar: 'MITGLIEDER_PASSWORT',
  geheimnisVar: 'MITGLIEDER_SIGNING_SECRET',
  zweck: 'mitglieder-zugang',
  // "lax" wie bei /mv2026/: Mitglieder kommen auch über Links aus Mails.
  // Der Bereich ist reiner Lesezugriff, Formulare gibt es außer An-/Abmelden keine.
  sameSite: 'lax',
  // 30 Tage — Mitglieder schauen selten vorbei und sollen das Passwort nicht
  // jedes Mal heraussuchen müssen. Ein Passwortwechsel entwertet alle Anmeldungen.
  gueltigMs: 1000 * 60 * 60 * 24 * 30,
});

export const START = '/mitglieder/';

/**
 * Antwort mit einer Datei. PDF und Bilder zeigt der Browser direkt an, alles
 * andere wird heruntergeladen; mit herunterladen=true immer Download.
 * Der Dateiname ist beim Hochladen schon von Anführungszeichen und
 * Zeilenumbrüchen befreit; der Name in UTF-8 steht zusätzlich in filename*.
 */
export function dateiAntwort(dok: Dokument & { inhalt: Buffer }, herunterladen = false): Response {
  const anzeigen = !herunterladen && (dok.typ === 'application/pdf' || dok.typ.startsWith('image/'));
  const ascii = dok.dateiname.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');
  return new Response(new Uint8Array(dok.inhalt), {
    headers: {
      'content-type': dok.typ,
      'content-length': String(dok.inhalt.length),
      'content-disposition': `${anzeigen ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(dok.dateiname)}`,
      'x-content-type-options': 'nosniff',
      ...GESCHUETZT_KOPFZEILEN,
    },
  });
}
