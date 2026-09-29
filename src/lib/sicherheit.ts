// Gemeinsame Bausteine der Zugangssicherung.
// Nur serverseitig importieren — nutzt node:crypto.
import crypto from 'node:crypto';
import { getEnv } from './zuwendung.ts';

/**
 * Vergleicht zwei Zeichenketten ohne Laufzeitunterschied.
 *
 * Gegenüber einem direkten timingSafeEqual auf den Rohwerten hat der Umweg
 * über den Hash zwei Vorteile: Die verglichenen Puffer sind immer gleich
 * lang (timingSafeEqual wirft sonst), und die Länge des Geheimnisses lässt
 * sich nicht mehr daran ablesen, ob überhaupt verglichen wurde.
 */
export function gleichSicher(a: string, b: string): boolean {
  const x = crypto.createHash('sha256').update(a ?? '', 'utf8').digest();
  const y = crypto.createHash('sha256').update(b ?? '', 'utf8').digest();
  return crypto.timingSafeEqual(x, y);
}

/**
 * Hosts, unter denen diese Site ausgeliefert wird.
 *
 * Auf Vercel ist der Host im Request intern "localhost" — der öffentliche
 * Name steht in x-forwarded-host. Genau daran scheitert auch Astros eigener
 * checkOrigin, der deshalb in astro.config.mjs aus ist.
 */
function eigeneHosts(request: Request): Set<string> {
  const hosts = new Set<string>();
  const env = getEnv('PUBLIC_SITE_URL');
  if (env) {
    try { hosts.add(new URL(env).host); } catch { /* unbrauchbarer Wert */ }
  }
  const weitergereicht = request.headers.get('x-forwarded-host');
  if (weitergereicht) hosts.add(weitergereicht.split(',')[0]!.trim());
  const host = request.headers.get('host');
  if (host) hosts.add(host);
  return hosts;
}

/**
 * Prüft, ob ein POST von der eigenen Site kommt (Schutz vor Cross-Site
 * Request Forgery).
 *
 * Browser senden bei POST immer einen Origin-Header; fehlt er, wird der
 * Referer herangezogen. Fehlen beide, gilt die Anfrage als fremd — ein
 * echtes Formular aus dem Browser kommt nie ohne beides an.
 */
export function originErlaubt(request: Request): boolean {
  const erlaubt = eigeneHosts(request);
  const origin = request.headers.get('origin');
  if (origin) {
    if (origin === 'null') return false; // sandboxed iframe, data:-URL o. ä.
    try { return erlaubt.has(new URL(origin).host); } catch { return false; }
  }
  const referer = request.headers.get('referer');
  if (referer) {
    try { return erlaubt.has(new URL(referer).host); } catch { return false; }
  }
  return false;
}

/**
 * Kopfzeilen für alles, was hinter einem Passwort liegt: nicht
 * zwischenspeichern, nicht indexieren, nicht einbetten.
 *
 * Das no-store ist hier kein Zierrat — ohne es läge eine Unterlage im Cache
 * eines geteilten Rechners oder eines Proxys, an der Anmeldung vorbei.
 */
export const GESCHUETZT_KOPFZEILEN: Record<string, string> = {
  'cache-control': 'private, no-store, max-age=0',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'referrer-policy': 'no-referrer',
};
