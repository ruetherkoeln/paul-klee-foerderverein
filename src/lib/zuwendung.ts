// Server-Hilfsfunktionen für Zuwendungsbescheinigungen.
// Nur serverseitig importieren (API-Routen) — nutzt node:crypto.
import crypto from 'node:crypto';

// ── Env ─────────────────────────────────────────────────────────────────────
// Auf Vercel zur Laufzeit aus process.env; lokal Fallback auf import.meta.env.
export function getEnv(key: string): string | undefined {
  const fromProcess = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  // @ts-ignore – import.meta.env existiert in Astro
  const fromMeta = import.meta.env?.[key];
  return fromProcess ?? fromMeta;
}

// Öffentliche Basis-URL der Site. Auf Vercel ist new URL(request.url) intern
// "localhost" — daher aus den Forwarded-Headern bzw. PUBLIC_SITE_URL bilden.
export function baseUrl(request: Request): string {
  const env = getEnv('PUBLIC_SITE_URL');
  if (env) return env.replace(/\/$/, '');
  const h = request.headers;
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  if (host) return `${proto}://${host}`;
  return new URL(request.url).origin;
}

function signingSecret(): string {
  const s = getEnv('ZUWENDUNG_SIGNING_SECRET');
  if (!s) throw new Error('ZUWENDUNG_SIGNING_SECRET fehlt');
  return s;
}

// ── Spenden-Datensatz ────────────────────────────────────────────────────────
export interface Spende {
  vorname: string;
  name: string;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  email: string;
  betragCent: number; // in Cent, vermeidet Float-Fehler
  datum: string; // ISO YYYY-MM-DD (Tag der Zuwendung)
  verzicht: boolean; // Verzicht auf Erstattung von Aufwendungen?
  ts: number; // Erstellzeitpunkt (für Ablauf)
}

// ── Signierter Token (kein DB-Bedarf) ────────────────────────────────────────
const b64url = (buf: Buffer) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) =>
  Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export function signSpende(spende: Spende): string {
  const payload = b64url(Buffer.from(JSON.stringify(spende), 'utf8'));
  const sig = b64url(crypto.createHmac('sha256', signingSecret()).update(payload).digest());
  return `${payload}.${sig}`;
}

// Gibt die Spende zurück oder null bei ungültiger/abgelaufener Signatur.
export function verifySpende(token: string, maxAgeMs = 1000 * 60 * 60 * 24 * 30): Spende | null {
  const [payload, sig] = (token || '').split('.');
  if (!payload || !sig) return null;
  const expected = b64url(crypto.createHmac('sha256', signingSecret()).update(payload).digest());
  // zeitkonstanter Vergleich
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const spende = JSON.parse(fromB64url(payload).toString('utf8')) as Spende;
    if (typeof spende.ts !== 'number' || Date.now() - spende.ts > maxAgeMs) return null;
    return spende;
  } catch {
    return null;
  }
}

// ── Formatierung ─────────────────────────────────────────────────────────────
export function formatEuro(cent: number): string {
  return (cent / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
}

// Betrag in Worten (amtliches Muster verlangt „in Buchstaben").
// Unterstützt 0–999.999,99 €.
export function euroInWorten(cent: number): string {
  const euro = Math.floor(cent / 100);
  const rest = cent % 100;
  const teil = euro === 0 ? 'null' : zahlInWorten(euro);
  let s = `${kapitalisiere(teil)} Euro`;
  if (rest > 0) s += ` und ${zahlInWorten(rest)} Cent`;
  return s;
}

function kapitalisiere(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function zahlInWorten(n: number): string {
  if (n === 0) return 'null';
  const einer = ['', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'];
  const spezial = ['zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
  const zehner = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];

  const unter100 = (x: number): string => {
    if (x < 10) return einer[x];
    if (x < 20) return spezial[x - 10];
    const z = Math.floor(x / 10);
    const e = x % 10;
    return e === 0 ? zehner[z] : `${einer[e]}und${zehner[z]}`;
  };

  const unter1000 = (x: number): string => {
    const h = Math.floor(x / 100);
    const r = x % 100;
    let s = '';
    if (h > 0) s += `${einer[h]}hundert`;
    if (r > 0) s += unter100(r);
    return s;
  };

  if (n < 1000) return unter1000(n);

  const mio = Math.floor(n / 1_000_000);
  const tsd = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  let s = '';
  if (mio > 0) s += mio === 1 ? 'eine Million ' : `${unter1000(mio)} Millionen `;
  if (tsd > 0) s += tsd === 1 ? 'eintausend' : `${unter1000(tsd)}tausend`;
  if (rest > 0) s += unter1000(rest);
  return s.trim();
}
