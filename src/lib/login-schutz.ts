// Bremse gegen das Durchprobieren von Passwörtern.
//
// Zählt Fehlversuche je Herkunft in einem gleitenden Fenster. Gespeichert
// wird nur ein Hash der IP-Adresse, nie die Adresse selbst — dieselbe Linie
// wie bei der Mitgliedererfassung.
//
// Eigene Tabelle statt der bestehenden erfassung_ratelimit: Ein Fehlversuch
// beim Anmelden soll niemanden davon abhalten, das Mitgliedsformular
// abzuschicken, und umgekehrt.
//
// Bewusst offen im Fehlerfall: Ist die Datenbank nicht erreichbar, wird nicht
// gesperrt. Eine Störung bei Neon würde sonst den gesamten geschützten
// Bereich lahmlegen — der Schaden wäre grösser als der Gewinn. Die Bremse
// nach jedem Fehlversuch wirkt auch dann noch.
import { neon } from '@neondatabase/serverless';
import { getEnv } from './zuwendung.ts';
import { ipHash, clientIp } from './erfassung-crypto.ts';
import { SICHERHEIT } from '../data/sicherheit.ts';

let schemaGeprueft = false;

async function db() {
  const url = getEnv('DATABASE_URL');
  if (!url) return null;
  const sql = neon(url);
  if (!schemaGeprueft) {
    await sql`
      CREATE TABLE IF NOT EXISTS login_versuche (
        schluessel    TEXT PRIMARY KEY,
        fenster_start TIMESTAMPTZ NOT NULL,
        anzahl        INTEGER     NOT NULL
      )`;
    schemaGeprueft = true;
  }
  return sql;
}

/** Kennung für die Zählung: Bereich plus Hash der IP, keine Klartext-Adresse. */
export function herkunft(bereich: string, request: Request): string {
  return `${bereich}:${ipHash(clientIp(request))}`;
}

/** true, wenn für diese Herkunft gerade keine weiteren Versuche erlaubt sind. */
export async function gesperrt(schluessel: string): Promise<boolean> {
  try {
    const sql = await db();
    if (!sql) return false;
    const rows = (await sql`
      SELECT anzahl FROM login_versuche
      WHERE schluessel = ${schluessel}
        AND fenster_start > now() - make_interval(mins => ${SICHERHEIT.LOGIN_FENSTER_MIN})
    `) as { anzahl: number }[];
    return (rows[0]?.anzahl ?? 0) >= SICHERHEIT.LOGIN_MAX;
  } catch (e) {
    console.error('Login-Schutz: Prüfung nicht möglich —', (e as Error).message);
    return false;
  }
}

/** Zählt einen Fehlversuch. Das Fenster beginnt beim ersten Versuch neu. */
export async function fehlversuchZaehlen(schluessel: string): Promise<void> {
  try {
    const sql = await db();
    if (!sql) return;
    await sql`
      INSERT INTO login_versuche (schluessel, fenster_start, anzahl)
      VALUES (${schluessel}, now(), 1)
      ON CONFLICT (schluessel) DO UPDATE SET
        anzahl = CASE
          WHEN login_versuche.fenster_start
               < now() - make_interval(mins => ${SICHERHEIT.LOGIN_FENSTER_MIN})
          THEN 1 ELSE login_versuche.anzahl + 1 END,
        fenster_start = CASE
          WHEN login_versuche.fenster_start
               < now() - make_interval(mins => ${SICHERHEIT.LOGIN_FENSTER_MIN})
          THEN now() ELSE login_versuche.fenster_start END`;
  } catch (e) {
    console.error('Login-Schutz: Zählen nicht möglich —', (e as Error).message);
  }
}

/** Nach erfolgreicher Anmeldung zurücksetzen, damit die Sperre nicht nachhängt. */
export async function versucheLoeschen(schluessel: string): Promise<void> {
  try {
    const sql = await db();
    if (!sql) return;
    await sql`DELETE FROM login_versuche WHERE schluessel = ${schluessel}`;
  } catch (e) {
    console.error('Login-Schutz: Zurücksetzen nicht möglich —', (e as Error).message);
  }
}

/** Kurze Pause nach einem Fehlversuch. */
export function bremsen(): Promise<void> {
  return new Promise((fertig) => setTimeout(fertig, SICHERHEIT.LOGIN_BREMSE_MS));
}
