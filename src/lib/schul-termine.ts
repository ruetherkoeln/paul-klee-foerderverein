// Übernimmt die Termine der Schulwebsite in den Vorstandsbereich.
// Nur serverseitig importieren.
//
// Die Schulseite läuft auf WordPress (IONOS), die Schnittstelle (wp-json) ist
// dort abgeschaltet. Also wird die öffentliche Seite gelesen: Inhalt aus
// <main>, Tabellenzeilen und Absätze als einzelne Zeilen, und in jeder Zeile
// nach einem deutschen Datum gesucht. Was davor oder dahinter steht, wird
// der Titel.
//
// Weil niemand weiss, in welcher Form die Schule ihre Termine einstellen wird,
// bleibt zusätzlich der vollständige Text der Seite gespeichert und wird im
// Vorstandsbereich angezeigt. So geht nichts verloren, auch wenn eine Zeile
// nicht als Termin erkannt wird.
import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { getEnv } from './zuwendung.ts';
import { schulTermineAbgleichen, type SchulTermin } from './vorstand-db.ts';

export const SCHUL_TERMINE_URL = 'https://www.grundschule-paul-klee.de/termine/';

const MONATE: Record<string, number> = {
  januar: 1, jan: 1, februar: 2, feb: 2, märz: 3, maerz: 3, mär: 3, april: 4, apr: 4,
  mai: 5, juni: 6, jun: 6, juli: 7, jul: 7, august: 8, aug: 8, september: 9, sept: 9, sep: 9,
  oktober: 10, okt: 10, november: 11, nov: 11, dezember: 12, dez: 12,
};

// ── Text aus der Seite ──────────────────────────────────────────────────────
const ENTITAETEN: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', hellip: '…',
};
function entschluesseln(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITAETEN[n] ?? m);
}

/** Inhalt der Seite als Zeilen — Tabellenzellen einer Zeile durch „ | “ getrennt. */
export function zeilenAusHtml(html: string): string[] {
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html;
  const ohne = main
    .replace(/<(script|style|noscript|svg|nav|header|footer)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h\d)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return entschluesseln(ohne)
    .split('\n')
    .map((z) => z.replace(/\s+/g, ' ').replace(/(\s*\|\s*)+$/, '').replace(/^(\s*\|\s*)+/, '').trim())
    .filter(Boolean);
}

// ── Datum erkennen ──────────────────────────────────────────────────────────
// Schuljahr aus der Seite („Schuljahr 2026/ 2027“): Ein Datum ohne Jahr
// gehört ab August zum ersten, davor zum zweiten Jahr.
function schuljahr(zeilen: string[], heute = new Date()): [number, number] {
  for (const z of zeilen) {
    const m = z.match(/Schuljahr\s*(\d{4})\s*\/\s*(\d{2,4})/i);
    if (m) {
      const a = Number(m[1]);
      return [a, a + 1];
    }
  }
  const j = heute.getFullYear();
  return heute.getMonth() + 1 >= 8 ? [j, j + 1] : [j - 1, j];
}

function jahrFuer(monat: number, jahrText: string | undefined, sj: [number, number]): number {
  if (jahrText) {
    const n = Number(jahrText);
    return n < 100 ? 2000 + n : n;
  }
  return monat >= 8 ? sj[0] : sj[1];
}

const iso = (j: number, m: number, t: number) =>
  `${j}-${String(m).padStart(2, '0')}-${String(t).padStart(2, '0')}`;

function gueltig(j: number, m: number, t: number): boolean {
  const d = new Date(Date.UTC(j, m - 1, t));
  return d.getUTCFullYear() === j && d.getUTCMonth() === m - 1 && d.getUTCDate() === t;
}

const WOCHENTAG = '(?:(?:Mo|Di|Mi|Do|Fr|Sa|So)\\.?|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),?\\s*';
// 06.10.2026 · 6.10. · 6.–8.10.2026 · 06.10. - 08.10.
const NUMERISCH = new RegExp(
  `(?:${WOCHENTAG})?(\\d{1,2})\\.\\s*(?:(\\d{1,2})\\.\\s*)?(?:[-–—]|bis)?\\s*(?:\\d{1,2}\\.\\s*)?(\\d{1,2})\\.(\\d{2,4})?(?!\\d)`,
  'i',
);
// 9. November 2026 · 9.–11. November
const AUSGESCHRIEBEN = new RegExp(
  `(?:${WOCHENTAG})?(\\d{1,2})\\.\\s*(?:[-–—]|bis)?\\s*(?:\\d{1,2}\\.\\s*)?(${Object.keys(MONATE).sort((a, b) => b.length - a.length).join('|')})\\.?(?:\\s+(\\d{4}))?`,
  'i',
);
// Zeitraum mit vollem Datum auf beiden Seiten: 23.12.2026 – 06.01.2027
const ZEITRAUM = new RegExp(
  `(?:${WOCHENTAG})?(\\d{1,2})\\.(\\d{1,2})\\.(\\d{2,4})?\\s*(?:[-–—]|bis)\\s*(?:${WOCHENTAG})?\\d{1,2}\\.\\d{1,2}\\.(?:\\d{2,4})?`,
  'i',
);
// 18:30 Uhr · 8:00 - 12:00 Uhr (dann zählt der Beginn) · 18 Uhr
const UHRZEIT = /(\d{1,2})[:.](\d{2})(?:\s*(?:[-–—]|bis)\s*\d{1,2}[:.]\d{2})?\s*Uhr|(\d{1,2})\s*Uhr/i;

/** Ein Termin aus einer Zeile, oder null, wenn kein Datum darin steht. */
export function terminAusZeile(zeile: string, sj: [number, number]): Omit<SchulTermin, 'schluessel'> | null {
  let datum: string | null = null;
  let treffer = '';

  const r = zeile.match(ZEITRAUM);
  if (r) {
    const t = Number(r[1]);
    const m = Number(r[2]);
    const j = jahrFuer(m, r[3], sj);
    if (m >= 1 && m <= 12 && gueltig(j, m, t)) { datum = iso(j, m, t); treffer = r[0]; }
  }
  const a = datum ? null : zeile.match(AUSGESCHRIEBEN);
  if (a) {
    const t = Number(a[1]);
    const m = MONATE[a[2]!.toLowerCase()]!;
    const j = jahrFuer(m, a[3], sj);
    if (gueltig(j, m, t)) { datum = iso(j, m, t); treffer = a[0]; }
  }
  if (!datum) {
    const n = zeile.match(NUMERISCH);
    if (n) {
      // Bei „6.–8.10.“ steht der Monat erst hinter dem zweiten Tag:
      // Gruppe 2 fehlt, Gruppe 3 ist dann der Monat des Bereichs.
      const t = Number(n[1]);
      const m = Number(n[2] ?? n[3]);
      const j = jahrFuer(m, n[4], sj);
      if (m >= 1 && m <= 12 && gueltig(j, m, t)) { datum = iso(j, m, t); treffer = n[0]; }
    }
  }
  if (!datum) return null;

  const u = zeile.match(UHRZEIT);
  const uhrzeit = u
    ? `${String(u[1] ?? u[3]).padStart(2, '0')}:${u[2] ?? '00'}`
    : null;

  // Titel: die Zeile ohne Datum und Uhrzeit, Trenner an den Rändern weg.
  // Den Datumsbereich („6.–8.10.“) im Titel lassen, wenn es mehrere Tage sind.
  const mehrtaegig = /[-–—]|bis/.test(treffer);
  let titel = zeile.replace(mehrtaegig ? '' : treffer, '');
  if (u) titel = titel.replace(u[0], '');
  titel = titel.replace(/\s*\|\s*/g, ' · ').replace(/^[\s·:,–—-]+|[\s·:,–—-]+$/g, '').replace(/\s{2,}/g, ' ');
  if (mehrtaegig) titel = titel.replace(/^[\s·:,]+/, '');
  if (!titel || titel.length < 3) return null;
  return { datum, uhrzeit, titel: titel.slice(0, 200) };
}

export function termineAusZeilen(zeilen: string[]): SchulTermin[] {
  const sj = schuljahr(zeilen);
  const gesehen = new Set<string>();
  const liste: SchulTermin[] = [];
  for (const z of zeilen) {
    const t = terminAusZeile(z, sj);
    if (!t) continue;
    const schluessel = crypto.createHash('sha256')
      .update(`${t.datum}|${t.titel.toLowerCase()}`).digest('hex').slice(0, 24);
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    liste.push({ ...t, schluessel });
  }
  return liste;
}

// ── Abruf und Stand ─────────────────────────────────────────────────────────
function sql() {
  const url = getEnv('DATABASE_URL');
  if (!url) throw new Error('DATABASE_URL fehlt');
  return neon(url);
}

let schemaGeprueft = false;
async function schema(): Promise<void> {
  if (schemaGeprueft) return;
  await sql()`
    CREATE TABLE IF NOT EXISTS schul_termine_stand (
      id             INTEGER PRIMARY KEY,
      geprueft_am    TIMESTAMPTZ NOT NULL,
      geaendert_am   TIMESTAMPTZ,
      inhalt_hash    TEXT,
      inhalt_text    TEXT,
      fehler         TEXT
    )`;
  schemaGeprueft = true;
}

export interface SchulStand {
  geprueft_am: string;
  geaendert_am: string | null;
  inhalt_text: string | null;
  fehler: string | null;
}

export async function schulStand(): Promise<SchulStand | null> {
  await schema();
  const [r] = (await sql()`
    SELECT geprueft_am, geaendert_am, inhalt_text, fehler FROM schul_termine_stand WHERE id = 1`) as SchulStand[];
  return r ?? null;
}

export type PruefErgebnis =
  | { status: 'unveraendert' }
  | { status: 'aktualisiert'; neu: number; erkannt: number }
  | { status: 'fehler'; text: string };

/** Liest die Schulseite und gleicht die Termine ab. */
export async function schulTerminePruefen(): Promise<PruefErgebnis> {
  await schema();
  const db = sql();
  try {
    const antwort = await fetch(SCHUL_TERMINE_URL, {
      headers: { 'user-agent': 'Foerderverein-PKS-Terminabgleich/1.0 (+https://www.pks-foerderverein.de)' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!antwort.ok) throw new Error(`Schulseite antwortet mit ${antwort.status}`);
    const zeilen = zeilenAusHtml(await antwort.text());
    const text = zeilen.join('\n').slice(0, 20_000);
    const hash = crypto.createHash('sha256').update(text).digest('hex');

    const [alt] = (await db`SELECT inhalt_hash FROM schul_termine_stand WHERE id = 1`) as any[];
    const veraendert = alt?.inhalt_hash !== hash;
    await db`
      INSERT INTO schul_termine_stand (id, geprueft_am, geaendert_am, inhalt_hash, inhalt_text, fehler)
      VALUES (1, now(), now(), ${hash}, ${text}, NULL)
      ON CONFLICT (id) DO UPDATE SET
        geprueft_am = now(),
        geaendert_am = CASE WHEN ${veraendert} THEN now() ELSE schul_termine_stand.geaendert_am END,
        inhalt_hash = EXCLUDED.inhalt_hash,
        inhalt_text = EXCLUDED.inhalt_text,
        fehler = NULL`;
    if (!veraendert) return { status: 'unveraendert' };

    const liste = termineAusZeilen(zeilen);
    const neu = await schulTermineAbgleichen(liste);
    return { status: 'aktualisiert', neu, erkannt: liste.length };
  } catch (e) {
    const text = (e as Error).message.slice(0, 300);
    console.error('Schultermine:', text);
    await db`
      INSERT INTO schul_termine_stand (id, geprueft_am, fehler) VALUES (1, now(), ${text})
      ON CONFLICT (id) DO UPDATE SET geprueft_am = now(), fehler = EXCLUDED.fehler`;
    return { status: 'fehler', text };
  }
}
