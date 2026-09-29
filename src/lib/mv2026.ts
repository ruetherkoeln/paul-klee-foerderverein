// Zugang zum geschützten Bereich der außerordentlichen Mitgliederversammlung.
//
// Warum eigener Code und nicht Basic Auth wie beim CSV-Export: Der Export ist
// ein Werkzeug für den Vorstand, hier kommen Mitglieder auf ihrem Handy an.
// Ein Browser-Dialog ohne Erklärung schreckt dort ab, und abmelden kann man
// sich daraus praktisch nicht. Also ein Formular auf einer erklärten Seite
// und ein signiertes Merkmal im Cookie.
//
// Das Merkmal ist bewusst kein Sitzungs-Schlüssel in einer Datenbank: Es gibt
// nichts Benutzerbezogenes zu speichern. Signiert werden allein der
// Ablaufpunkt und ein Abdruck des geltenden Passworts.
import crypto from 'node:crypto';
import { getEnv } from './zuwendung.ts';
import { gleichSicher } from './sicherheit.ts';

// Der Präfix __Host- ist kein Schmuck: Der Browser nimmt ein so benanntes
// Cookie nur an, wenn es über HTTPS gesetzt wurde, für den ganzen Pfad gilt
// und keine Domain trägt. Damit kann keine Nachbar-Subdomain ein Cookie
// dieses Namens unterschieben.
export const COOKIE = '__Host-mv2026';
const GUELTIG_MS = 1000 * 60 * 60 * 12; // ein Tag Sitzung reicht

function geheimnis(): string {
  // Ein eigenes Geheimnis hat Vorrang. Fehlt es, wird eines aus dem bereits
  // vorhandenen Signierschlüssel abgeleitet — mit eigenem Verwendungszweck,
  // damit die beiden Schlüssel nichts voneinander wissen. So muss für diesen
  // Bereich nur das Passwort gesetzt werden und nicht auch noch ein Schlüssel.
  const eigen = getEnv('MV_SIGNING_SECRET');
  if (eigen) return eigen;
  const wurzel = getEnv('ERFASSUNG_SIGNING_SECRET');
  if (!wurzel) throw new Error('MV_SIGNING_SECRET oder ERFASSUNG_SIGNING_SECRET fehlt');
  return crypto.createHmac('sha256', wurzel).update('mv2026-zugang').digest('base64');
}

/**
 * Kurzer Abdruck des geltenden Passworts. Er geht in die Signatur ein, damit
 * ein Passwortwechsel alle ausgegebenen Merkmale sofort entwertet — sonst
 * käme jemand, der das alte Passwort kannte, noch zwölf Stunden weiter hinein.
 */
function passwortMarke(): string {
  const soll = getEnv('MV_PASSWORT') ?? '';
  return crypto.createHash('sha256').update(soll, 'utf8').digest('base64').slice(0, 12);
}

function b64url(b: Buffer): string {
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signatur(ablauf: string): string {
  return b64url(
    crypto.createHmac('sha256', geheimnis()).update(`${ablauf}|${passwortMarke()}`).digest(),
  );
}

export function passwortStimmt(eingabe: string): boolean {
  const soll = getEnv('MV_PASSWORT');
  if (!soll) return false;
  return gleichSicher((eingabe || '').trim(), soll);
}

export function merkmalErzeugen(): string {
  const ablauf = String(Date.now() + GUELTIG_MS);
  return `${ablauf}.${signatur(ablauf)}`;
}

export function merkmalGueltig(wert: string | undefined): boolean {
  const teile = (wert || '').split('.');
  if (teile.length !== 2) return false;
  const [ablauf, sig] = teile as [string, string];
  let erwartet: string;
  try {
    erwartet = signatur(ablauf);
  } catch {
    return false;
  }
  if (!gleichSicher(sig, erwartet)) return false;
  const bis = Number(ablauf);
  return Number.isFinite(bis) && Date.now() < bis;
}

// sameSite bleibt "lax" und wird nicht auf "strict" gezogen: Die Mitglieder
// kommen über den Link aus der Einladungsmail. Bei "strict" käme das Cookie
// bei diesem ersten Klick nicht mit und alle stünden erneut vor dem Formular.
// Für einen Lesezugriff auf Unterlagen ist "lax" der richtige Schnitt.
export const COOKIE_OPTIONEN = {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: Math.floor(GUELTIG_MS / 1000),
} as const;
