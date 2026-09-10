// Verschlüsselung der Bankdaten und Pseudonymisierung der IP-Adresse.
// Nur serverseitig importieren — nutzt node:crypto.
import crypto from 'node:crypto';
import { getEnv } from './zuwendung.ts';

// ── Schlüssel ───────────────────────────────────────────────────────────────
// ERFASSUNG_CRYPTO_KEY: 32 Byte, base64-kodiert. Erzeugen mit
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
function key(): Buffer {
  const raw = getEnv('ERFASSUNG_CRYPTO_KEY');
  if (!raw) throw new Error('ERFASSUNG_CRYPTO_KEY fehlt');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error('ERFASSUNG_CRYPTO_KEY muss 32 Byte base64 sein');
  }
  return buf;
}

// ── AES-256-GCM ─────────────────────────────────────────────────────────────
// Ablageformat: v1.<iv>.<authTag>.<ciphertext>, alle Teile base64.
// Das Präfix erlaubt später einen Schlüsselwechsel ohne Ratespiel.
export function verschluesseln(klartext: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(klartext, 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return `v1.${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`;
}

export function entschluesseln(gespeichert: string): string {
  const [version, ivB64, tagB64, ctB64] = (gespeichert || '').split('.');
  if (version !== 'v1' || !ivB64 || !tagB64 || !ctB64) {
    throw new Error('Unbekanntes Format der verschlüsselten Daten');
  }
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));
  d.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([d.update(Buffer.from(ctB64, 'base64')), d.final()]).toString('utf8');
}

// ── IP-Hash (Einwilligungsnachweis, keine Klartext-IP) ──────────────────────
export function ipHash(ip: string): string {
  const salt = getEnv('ERFASSUNG_SIGNING_SECRET') ?? 'kein-salt';
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

// Client-IP aus den Vercel-Headern; ohne Header ein neutraler Platzhalter.
export function clientIp(request: Request): string {
  const h = request.headers;
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return h.get('x-real-ip') ?? 'unbekannt';
}

// ── Signierte Links (Mandats-PDF) ───────────────────────────────────────────
const b64url = (b: Buffer) =>
  b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function linkSecret(): string {
  const s = getEnv('ERFASSUNG_SIGNING_SECRET');
  if (!s) throw new Error('ERFASSUNG_SIGNING_SECRET fehlt');
  return s;
}

export function signId(id: number, ts = Date.now()): string {
  const payload = `${id}.${ts}`;
  const sig = b64url(crypto.createHmac('sha256', linkSecret()).update(payload).digest());
  return `${payload}.${sig}`;
}

// Gültig für 30 Tage — lang genug, um die Bestätigungsmail später zu öffnen.
export function verifyId(token: string, maxAgeMs = 1000 * 60 * 60 * 24 * 30): number | null {
  const teile = (token || '').split('.');
  if (teile.length !== 3) return null;
  const [idRaw, tsRaw, sig] = teile as [string, string, string];
  const expected = b64url(
    crypto.createHmac('sha256', linkSecret()).update(`${idRaw}.${tsRaw}`).digest(),
  );
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const ts = Number(tsRaw);
  const id = Number(idRaw);
  if (!Number.isFinite(ts) || !Number.isFinite(id)) return null;
  if (Date.now() - ts > maxAgeMs) return null;
  return id;
}

// ── Basic Auth für die Export-Routen ────────────────────────────────────────
export function pruefeBasicAuth(
  request: Request,
  userVar: string,
  passVar: string,
): boolean {
  const user = getEnv(userVar);
  const pass = getEnv(passVar);
  if (!user || !pass) return false; // ohne gesetzte Zugangsdaten kein Zugriff
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Basic ')) return false;
  let dekodiert = '';
  try {
    dekodiert = Buffer.from(header.slice(6), 'base64').toString('utf8');
  } catch {
    return false;
  }
  const trenner = dekodiert.indexOf(':');
  if (trenner < 0) return false;
  const erwartet = `${user}:${pass}`;
  const a = Buffer.from(dekodiert);
  const b = Buffer.from(erwartet);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
