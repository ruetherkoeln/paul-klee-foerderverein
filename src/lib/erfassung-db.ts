// Datenzugriff für die Mitgliederbestands-Erfassung (Neon / Postgres).
// Nur serverseitig importieren.
import { neon } from '@neondatabase/serverless';
import { getEnv } from './zuwendung.ts';
import { ERFASSUNG } from '../data/erfassung.ts';

function sql() {
  const url = getEnv('DATABASE_URL');
  if (!url) throw new Error('DATABASE_URL fehlt — Neon-Integration im Vercel-Projekt einrichten');
  return neon(url);
}

// ── Schema ──────────────────────────────────────────────────────────────────
// Wird vor dem ersten Schreibzugriff angelegt. Alle Anweisungen sind
// idempotent, ein separater Migrationsschritt entfällt bei dieser Datenmenge.
let schemaGeprueft = false;
export async function schemaSicherstellen(): Promise<void> {
  if (schemaGeprueft) return;
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS mitglieder_erfassung (
      id                       SERIAL PRIMARY KEY,
      erstellt_am              TIMESTAMPTZ  NOT NULL DEFAULT now(),
      vorname                  TEXT         NOT NULL,
      nachname                 TEXT         NOT NULL,
      strasse                  TEXT         NOT NULL,
      plz                      TEXT         NOT NULL,
      ort                      TEXT         NOT NULL,
      email                    TEXT         NOT NULL,
      telefon                  TEXT,
      kind_name                TEXT,
      klasse                   TEXT,
      beitrag_eur              INTEGER      NOT NULL,
      zahlweise                TEXT         NOT NULL,
      kontoinhaber_verschluesselt TEXT,
      iban_verschluesselt      TEXT,
      mandatsreferenz          TEXT,
      mandat_signatur          TEXT,
      mandat_erteilt_am        TIMESTAMPTZ,
      einwilligung_speicherung BOOLEAN      NOT NULL,
      einwilligung_ansprache   BOOLEAN      NOT NULL,
      einwilligung_am          TIMESTAMPTZ  NOT NULL DEFAULT now(),
      ip_hash                  TEXT,
      user_agent               TEXT,
      quelle                   TEXT
    )`;
  await db`
    CREATE TABLE IF NOT EXISTS erfassung_zaehler (
      jahr INTEGER PRIMARY KEY,
      wert INTEGER NOT NULL
    )`;
  await db`
    CREATE TABLE IF NOT EXISTS erfassung_ratelimit (
      ip_hash       TEXT PRIMARY KEY,
      fenster_start TIMESTAMPTZ NOT NULL,
      anzahl        INTEGER     NOT NULL
    )`;
  schemaGeprueft = true;
}

// ── Ratenbegrenzung ─────────────────────────────────────────────────────────
// Zählt Absendeversuche je IP-Hash im gleitenden Fenster. Gibt true zurück,
// wenn der Versuch das Limit überschreitet.
export async function limitUeberschritten(ipHash: string): Promise<boolean> {
  const db = sql();
  const rows = (await db`
    INSERT INTO erfassung_ratelimit (ip_hash, fenster_start, anzahl)
    VALUES (${ipHash}, now(), 1)
    ON CONFLICT (ip_hash) DO UPDATE SET
      anzahl = CASE
        WHEN erfassung_ratelimit.fenster_start
             < now() - make_interval(mins => ${ERFASSUNG.RATE_FENSTER_MIN})
        THEN 1 ELSE erfassung_ratelimit.anzahl + 1 END,
      fenster_start = CASE
        WHEN erfassung_ratelimit.fenster_start
             < now() - make_interval(mins => ${ERFASSUNG.RATE_FENSTER_MIN})
        THEN now() ELSE erfassung_ratelimit.fenster_start END
    RETURNING anzahl`) as { anzahl: number }[];
  return (rows[0]?.anzahl ?? 1) > ERFASSUNG.RATE_MAX;
}

// ── Mandatsreferenz ─────────────────────────────────────────────────────────
// Fortlaufend je Kalenderjahr, Format PKS-2026-0001. Der Upsert ist atomar,
// zwei gleichzeitige Anfragen können also keine Nummer doppelt vergeben.
export async function naechsteMandatsreferenz(): Promise<string> {
  const db = sql();
  const jahr = new Date().getFullYear();
  const rows = (await db`
    INSERT INTO erfassung_zaehler (jahr, wert) VALUES (${jahr}, 1)
    ON CONFLICT (jahr) DO UPDATE SET wert = erfassung_zaehler.wert + 1
    RETURNING wert`) as { wert: number }[];
  const wert = rows[0]?.wert ?? 1;
  return `PKS-${jahr}-${String(wert).padStart(4, '0')}`;
}

// ── Datensatz ───────────────────────────────────────────────────────────────
export interface Eintrag {
  vorname: string;
  nachname: string;
  strasse: string;
  plz: string;
  ort: string;
  email: string;
  telefon: string | null;
  kind_name: string | null;
  klasse: string | null;
  beitrag_eur: number;
  zahlweise: 'sepa' | 'ueberweisung';
  kontoinhaber_verschluesselt: string | null;
  iban_verschluesselt: string | null;
  mandatsreferenz: string | null;
  mandat_signatur: string | null;
  mandat_erteilt_am: string | null;
  einwilligung_speicherung: boolean;
  einwilligung_ansprache: boolean;
  ip_hash: string;
  user_agent: string;
  quelle: string;
}

export async function speichern(e: Eintrag): Promise<number> {
  const db = sql();
  const rows = (await db`
    INSERT INTO mitglieder_erfassung (
      vorname, nachname, strasse, plz, ort, email, telefon, kind_name, klasse,
      beitrag_eur, zahlweise, kontoinhaber_verschluesselt, iban_verschluesselt,
      mandatsreferenz, mandat_signatur, mandat_erteilt_am,
      einwilligung_speicherung, einwilligung_ansprache,
      ip_hash, user_agent, quelle
    ) VALUES (
      ${e.vorname}, ${e.nachname}, ${e.strasse}, ${e.plz}, ${e.ort}, ${e.email},
      ${e.telefon}, ${e.kind_name}, ${e.klasse},
      ${e.beitrag_eur}, ${e.zahlweise}, ${e.kontoinhaber_verschluesselt},
      ${e.iban_verschluesselt}, ${e.mandatsreferenz}, ${e.mandat_signatur},
      ${e.mandat_erteilt_am}, ${e.einwilligung_speicherung},
      ${e.einwilligung_ansprache}, ${e.ip_hash}, ${e.user_agent}, ${e.quelle}
    ) RETURNING id`) as { id: number }[];
  return rows[0]!.id;
}

export async function ladeEintrag(id: number): Promise<Record<string, any> | null> {
  const db = sql();
  const rows = (await db`
    SELECT * FROM mitglieder_erfassung WHERE id = ${id}`) as Record<string, any>[];
  return rows[0] ?? null;
}

export async function alleEintraege(): Promise<Record<string, any>[]> {
  const db = sql();
  return (await db`
    SELECT * FROM mitglieder_erfassung ORDER BY id`) as Record<string, any>[];
}
