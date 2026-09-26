// Zugang zum geschützten Bereich der außerordentlichen Mitgliederversammlung.
//
// Warum eigener Code und nicht Basic Auth wie beim CSV-Export: Der Export ist
// ein Werkzeug für den Vorstand, hier kommen Mitglieder auf ihrem Handy an.
// Ein Browser-Dialog ohne Erklärung schreckt dort ab, und abmelden kann man
// sich daraus praktisch nicht. Also ein Formular auf einer erklärten Seite
// und ein signiertes Merkmal im Cookie.
//
// Das Merkmal ist bewusst kein Sitzungs-Schlüssel in einer Datenbank: Es gibt
// nichts Benutzerbezogenes zu speichern. Signiert wird allein der Ablaufpunkt.
import crypto from 'node:crypto';
import { getEnv } from './zuwendung.ts';

export const COOKIE = 'mv2026';
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

function b64url(b: Buffer): string {
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Vergleicht ohne Laufzeitunterschied, damit sich das Passwort nicht Zeichen
 *  für Zeichen erraten lässt. */
function gleich(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function passwortStimmt(eingabe: string): boolean {
  const soll = getEnv('MV_PASSWORT');
  if (!soll) return false;
  return gleich((eingabe || '').trim(), soll);
}

export function merkmalErzeugen(): string {
  const ablauf = String(Date.now() + GUELTIG_MS);
  const sig = b64url(crypto.createHmac('sha256', geheimnis()).update(ablauf).digest());
  return `${ablauf}.${sig}`;
}

export function merkmalGueltig(wert: string | undefined): boolean {
  const teile = (wert || '').split('.');
  if (teile.length !== 2) return false;
  const [ablauf, sig] = teile as [string, string];
  let erwartet: string;
  try {
    erwartet = b64url(crypto.createHmac('sha256', geheimnis()).update(ablauf).digest());
  } catch {
    return false;
  }
  if (!gleich(sig, erwartet)) return false;
  const bis = Number(ablauf);
  return Number.isFinite(bis) && Date.now() < bis;
}

export const COOKIE_OPTIONEN = {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: Math.floor(GUELTIG_MS / 1000),
} as const;
