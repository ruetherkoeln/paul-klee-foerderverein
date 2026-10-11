// Datenzugriff für den Vorstandsbereich. Nur serverseitig importieren.
//
// Die Mitgliederliste wird hier mit ausdrücklich genannten Spalten gelesen,
// nie mit SELECT * — die verschlüsselten Bankdaten und die Mandats-Unterschrift
// sollen gar nicht erst in die Seite gelangen, auch nicht versehentlich.
import { neon } from '@neondatabase/serverless';
import { getEnv } from './zuwendung.ts';
import { schemaSicherstellen } from './erfassung-db.ts';

function sql() {
  const url = getEnv('DATABASE_URL');
  if (!url) throw new Error('DATABASE_URL fehlt — Neon-Integration im Vercel-Projekt einrichten');
  return neon(url);
}

// ── Mitglieder ──────────────────────────────────────────────────────────────
export interface Mitglied {
  id: number;
  erstellt_am: string;
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
  zahlweise: string;
  mandatsreferenz: string | null;
  einwilligung_ansprache: boolean;
  quelle: string | null;
  ausgetreten_am: string | null;
}

export async function mitglieder(): Promise<Mitglied[]> {
  await schemaSicherstellen();
  return (await sql()`
    SELECT id, erstellt_am, vorname, nachname, strasse, plz, ort, email, telefon,
           kind_name, klasse, beitrag_eur, zahlweise, mandatsreferenz,
           einwilligung_ansprache, quelle, ausgetreten_am
      FROM mitglieder_erfassung
     ORDER BY lower(nachname), lower(vorname), id`) as Mitglied[];
}

export interface Kennzahlen {
  aktiv: number;
  ausgetreten: number;
  sepa: number;
  beitraegeJahr: number;
}

export async function kennzahlen(): Promise<Kennzahlen> {
  await schemaSicherstellen();
  const rows = (await sql()`
    SELECT
      count(*) FILTER (WHERE ausgetreten_am IS NULL)                      AS aktiv,
      count(*) FILTER (WHERE ausgetreten_am IS NOT NULL)                  AS ausgetreten,
      count(*) FILTER (WHERE ausgetreten_am IS NULL AND zahlweise = 'sepa') AS sepa,
      coalesce(sum(beitrag_eur) FILTER (WHERE ausgetreten_am IS NULL), 0) AS beitraege
    FROM mitglieder_erfassung`) as Record<string, string | number>[];
  const r = rows[0] ?? {};
  return {
    aktiv: Number(r.aktiv ?? 0),
    ausgetreten: Number(r.ausgetreten ?? 0),
    sepa: Number(r.sepa ?? 0),
    beitraegeJahr: Number(r.beitraege ?? 0),
  };
}

export interface Bewegung {
  id: number;
  art: 'antrag' | 'austritt';
  am: string;
  vorname: string;
  nachname: string;
  kind_name: string | null;
  klasse: string | null;
  zahlweise: string;
  beitrag_eur: number;
  mandatsreferenz: string | null;
}

/** Neue Mitgliedsanträge und Austritte der letzten Tage, neueste zuerst.
 *  Bestandserfassungen zählen nicht als neu — das sind Mitglieder, die nur
 *  ihre Angaben nachgetragen haben. */
export async function bewegungen(tage: number): Promise<Bewegung[]> {
  await schemaSicherstellen();
  return (await sql()`
    SELECT id, 'antrag' AS art, erstellt_am AS am, vorname, nachname, kind_name, klasse,
           zahlweise, beitrag_eur, mandatsreferenz
      FROM mitglieder_erfassung
     WHERE quelle = 'mitgliedsantrag'
       AND erstellt_am > now() - make_interval(days => ${tage})
    UNION ALL
    SELECT id, 'austritt' AS art, ausgetreten_am AS am, vorname, nachname, kind_name, klasse,
           zahlweise, beitrag_eur, mandatsreferenz
      FROM mitglieder_erfassung
     WHERE ausgetreten_am > now() - make_interval(days => ${tage})
     ORDER BY am DESC`) as Bewegung[];
}

// ── Dokumente ───────────────────────────────────────────────────────────────
// Liegen in der Datenbank und nicht im Repository: Das Repository ist
// öffentlich, alles darin kann jeder auf GitHub lesen. Ein Hochladen über die
// Seite erspart dem Vorstand ausserdem den Umweg über Git.
//
// Inhalt als base64-Text statt bytea: Der HTTP-Treiber von Neon reicht Text
// verlässlich durch, bei Binärparametern ist das nicht garantiert. Der
// Mehrbedarf von einem Drittel fällt bei einer Handvoll PDFs nicht ins Gewicht.
let dokumenteGeprueft = false;
async function dokumenteSchema(): Promise<void> {
  if (dokumenteGeprueft) return;
  await sql()`
    CREATE TABLE IF NOT EXISTS vorstand_dokumente (
      id              SERIAL PRIMARY KEY,
      hochgeladen_am  TIMESTAMPTZ NOT NULL DEFAULT now(),
      titel           TEXT        NOT NULL,
      dateiname       TEXT        NOT NULL,
      typ             TEXT        NOT NULL,
      groesse         INTEGER     NOT NULL,
      inhalt_b64      TEXT        NOT NULL
    )`;
  dokumenteGeprueft = true;
}

export interface Dokument {
  id: number;
  hochgeladen_am: string;
  titel: string;
  dateiname: string;
  typ: string;
  groesse: number;
}

export async function dokumente(): Promise<Dokument[]> {
  await dokumenteSchema();
  return (await sql()`
    SELECT id, hochgeladen_am, titel, dateiname, typ, groesse
      FROM vorstand_dokumente
     ORDER BY hochgeladen_am DESC, id DESC`) as Dokument[];
}

export async function dokumentLaden(id: number): Promise<(Dokument & { inhalt: Buffer }) | null> {
  await dokumenteSchema();
  const rows = (await sql()`
    SELECT id, hochgeladen_am, titel, dateiname, typ, groesse, inhalt_b64
      FROM vorstand_dokumente WHERE id = ${id}`) as (Dokument & { inhalt_b64: string })[];
  const r = rows[0];
  if (!r) return null;
  const { inhalt_b64, ...rest } = r;
  return { ...rest, inhalt: Buffer.from(inhalt_b64, 'base64') };
}

export async function dokumentSpeichern(
  titel: string, dateiname: string, typ: string, inhalt: Buffer,
): Promise<void> {
  await dokumenteSchema();
  await sql()`
    INSERT INTO vorstand_dokumente (titel, dateiname, typ, groesse, inhalt_b64)
    VALUES (${titel}, ${dateiname}, ${typ}, ${inhalt.length}, ${inhalt.toString('base64')})`;
}

export async function dokumentLoeschen(id: number): Promise<void> {
  await dokumenteSchema();
  await sql()`DELETE FROM vorstand_dokumente WHERE id = ${id}`;
}

// ── Termine ─────────────────────────────────────────────────────────────────
// Vorstandssitzungen, Fristen, Veranstaltungen. Datum als DATE, Uhrzeit als
// freier Text („18:30“), weil nicht jeder Termin eine hat.
let termineGeprueft = false;
async function termineSchema(): Promise<void> {
  if (termineGeprueft) return;
  await sql()`
    CREATE TABLE IF NOT EXISTS vorstand_termine (
      id           SERIAL PRIMARY KEY,
      erstellt_am  TIMESTAMPTZ NOT NULL DEFAULT now(),
      datum        DATE        NOT NULL,
      uhrzeit      TEXT,
      titel        TEXT        NOT NULL,
      ort          TEXT,
      notiz        TEXT
    )`;
  termineGeprueft = true;
}

export interface Termin {
  id: number;
  datum: string;          // YYYY-MM-DD
  uhrzeit: string | null;
  titel: string;
  ort: string | null;
  notiz: string | null;
}

/** Kommende Termine (ab heute, Berliner Zeit), früheste zuerst. */
export async function kommendeTermine(anzahl = 100): Promise<Termin[]> {
  await termineSchema();
  return (await sql()`
    SELECT id, to_char(datum, 'YYYY-MM-DD') AS datum, uhrzeit, titel, ort, notiz
      FROM vorstand_termine
     WHERE datum >= (now() AT TIME ZONE 'Europe/Berlin')::date
     ORDER BY datum, uhrzeit NULLS FIRST, id
     LIMIT ${anzahl}`) as Termin[];
}

/** Vergangene Termine, jüngste zuerst. */
export async function vergangeneTermine(anzahl = 20): Promise<Termin[]> {
  await termineSchema();
  return (await sql()`
    SELECT id, to_char(datum, 'YYYY-MM-DD') AS datum, uhrzeit, titel, ort, notiz
      FROM vorstand_termine
     WHERE datum < (now() AT TIME ZONE 'Europe/Berlin')::date
     ORDER BY datum DESC, uhrzeit DESC NULLS LAST, id DESC
     LIMIT ${anzahl}`) as Termin[];
}

export async function terminSpeichern(t: Omit<Termin, 'id'>): Promise<void> {
  await termineSchema();
  await sql()`
    INSERT INTO vorstand_termine (datum, uhrzeit, titel, ort, notiz)
    VALUES (${t.datum}, ${t.uhrzeit}, ${t.titel}, ${t.ort}, ${t.notiz})`;
}

export async function terminLoeschen(id: number): Promise<void> {
  await termineSchema();
  await sql()`DELETE FROM vorstand_termine WHERE id = ${id}`;
}
