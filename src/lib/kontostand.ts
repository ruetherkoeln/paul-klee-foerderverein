// Kontostand des Vereinskontos per FinTS (HBCI) abrufen. Nur serverseitig
// importieren.
//
// Ablauf:
//   1. Beim ersten Mal wird synchronisiert: Die Bank liefert ihre Parameter
//      (BPD), wir wählen ein Freigabeverfahren ohne TAN-Eingabe (pushTAN in
//      der S-pushTAN-App), und die Bank liefert die Konten (UPD).
//   2. Danach wird nur noch der Saldo abgefragt (HKSAL).
//   3. Nach PSD2 verlangt die Bank für Kontoinformationen etwa alle 90 Tage
//      eine Freigabe. Dann kommt eine Push-Nachricht aufs Handy des
//      Konto-Zugangs; wir warten im selben Aufruf, bis sie bestätigt ist.
//
// Warum im selben Aufruf: Die Freigabe gehört zu einem laufenden FinTS-Dialog
// mit der Bank. Eine Serverfunktion auf Vercel lebt nur für eine Anfrage — ein
// zweiter Aufruf könnte den Dialog nicht fortsetzen.
//
// Die Bankparameter (inkl. der System-ID, an der die 90-Tage-Freigabe hängt)
// werden verschlüsselt in der Datenbank gehalten. PIN und Anmeldename stehen
// nur in den Umgebungsvariablen.
import { neon } from '@neondatabase/serverless';
import { FinTSClient, FinTSConfig } from 'lib-fints';
import type { BankingInformation, ClientResponse, AccountBalanceResponse, BankAccount } from 'lib-fints';
import { getEnv } from './zuwendung.ts';
import { verschluesseln, entschluesseln } from './erfassung-crypto.ts';
import { BANK } from '../data/bank.ts';

function sql() {
  const url = getEnv('DATABASE_URL');
  if (!url) throw new Error('DATABASE_URL fehlt');
  return neon(url);
}

let schemaGeprueft = false;
async function schema(): Promise<void> {
  if (schemaGeprueft) return;
  const db = sql();
  // Genau eine Zeile (id = 1): der Zustand der Verbindung.
  await db`
    CREATE TABLE IF NOT EXISTS bank_verbindung (
      id                    INTEGER PRIMARY KEY,
      banking_info          TEXT,
      tan_methode           INTEGER,
      freigabe_noetig_seit  TIMESTAMPTZ,
      letzter_fehler        TEXT,
      aktualisiert_am       TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  // Jeder erfolgreiche Abruf eine Zeile — so bleibt ein Verlauf erhalten.
  await db`
    CREATE TABLE IF NOT EXISTS kontostaende (
      id              SERIAL PRIMARY KEY,
      abgerufen_am    TIMESTAMPTZ NOT NULL DEFAULT now(),
      saldo           NUMERIC(14,2) NOT NULL,
      verfuegbar      NUMERIC(14,2),
      waehrung        TEXT NOT NULL,
      buchungsdatum   DATE
    )`;
  schemaGeprueft = true;
}

// ── Zustand ─────────────────────────────────────────────────────────────────
export interface Stand {
  saldo: number;
  verfuegbar: number | null;
  waehrung: string;
  buchungsdatum: string | null;
  abgerufen_am: string;
}

export interface Uebersicht {
  eingerichtet: boolean;   // Zugangsdaten in Vercel gesetzt
  stand: Stand | null;     // letzter erfolgreicher Abruf
  freigabeNoetigSeit: string | null;
  letzterFehler: string | null;
}

function zugang() {
  const produktId = getEnv('FINTS_PRODUKT_ID');
  const url = getEnv('FINTS_URL');
  const benutzer = getEnv('FINTS_BENUTZER');
  const pin = getEnv('FINTS_PIN');
  const iban = (getEnv('FINTS_IBAN') ?? '').replace(/\s+/g, '').toUpperCase();
  if (!produktId || !url || !benutzer || !pin || !iban) return null;
  return { produktId, url, benutzer, pin, iban };
}

export async function uebersicht(): Promise<Uebersicht> {
  const eingerichtet = Boolean(zugang());
  await schema();
  const db = sql();
  const [stand] = (await db`
    SELECT saldo::float AS saldo, verfuegbar::float AS verfuegbar, waehrung,
           to_char(buchungsdatum, 'YYYY-MM-DD') AS buchungsdatum, abgerufen_am
      FROM kontostaende ORDER BY abgerufen_am DESC LIMIT 1`) as Stand[];
  const [v] = (await db`
    SELECT freigabe_noetig_seit, letzter_fehler FROM bank_verbindung WHERE id = 1`) as any[];
  return {
    eingerichtet,
    stand: stand ?? null,
    freigabeNoetigSeit: v?.freigabe_noetig_seit ?? null,
    letzterFehler: v?.letzter_fehler ?? null,
  };
}

async function zustandLaden(): Promise<{ info: BankingInformation | null; tanMethode: number | null }> {
  const [r] = (await sql()`SELECT banking_info, tan_methode FROM bank_verbindung WHERE id = 1`) as any[];
  if (!r?.banking_info) return { info: null, tanMethode: null };
  try {
    return { info: JSON.parse(entschluesseln(r.banking_info)), tanMethode: r.tan_methode ?? null };
  } catch {
    // Unlesbar (z. B. Schlüssel gewechselt) — dann eben neu synchronisieren.
    return { info: null, tanMethode: null };
  }
}

async function zustandSpeichern(info: BankingInformation, tanMethode: number | null): Promise<void> {
  const verschluesselt = verschluesseln(JSON.stringify(info));
  await sql()`
    INSERT INTO bank_verbindung (id, banking_info, tan_methode, aktualisiert_am)
    VALUES (1, ${verschluesselt}, ${tanMethode}, now())
    ON CONFLICT (id) DO UPDATE SET
      banking_info = EXCLUDED.banking_info,
      tan_methode = EXCLUDED.tan_methode,
      aktualisiert_am = now()`;
}

async function vermerken(freigabeNoetig: boolean, fehler: string | null): Promise<void> {
  await sql()`
    INSERT INTO bank_verbindung (id, freigabe_noetig_seit, letzter_fehler)
    VALUES (1, ${freigabeNoetig ? new Date().toISOString() : null}, ${fehler})
    ON CONFLICT (id) DO UPDATE SET
      freigabe_noetig_seit = CASE WHEN ${freigabeNoetig}
        THEN coalesce(bank_verbindung.freigabe_noetig_seit, now()) ELSE NULL END,
      letzter_fehler = EXCLUDED.letzter_fehler,
      aktualisiert_am = now()`;
}

// ── Freigabe abwarten ───────────────────────────────────────────────────────
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wartet auf die Bestätigung in der App. Die Bank gibt vor, wie lange vor der
 * ersten Nachfrage und zwischen den Nachfragen zu warten ist; wir halten uns
 * daran, aber nie länger als `bisMs` insgesamt.
 */
async function freigabeAbwarten<T extends ClientResponse>(
  client: FinTSClient,
  erste: T,
  weiter: (ref: string) => Promise<T>,
  bisMs: number,
): Promise<T> {
  let antwort = erste;
  const ende = Date.now() + bisMs;
  const d = client.config.selectedTanMethod?.decoupled;
  let warten = Math.max(2, d?.waitingSecondsBeforeFirstStatusRequest ?? 5) * 1000;
  const zwischen = Math.max(2, d?.waitingSecondsBetweenStatusRequests ?? 3) * 1000;
  while (antwort.requiresTan && antwort.tanReference && Date.now() + warten < ende) {
    await pause(warten);
    antwort = await weiter(antwort.tanReference);
    warten = zwischen;
  }
  return antwort;
}

/** Bankmeldungen lesbar zusammenfassen (Codes ab 9000 sind Fehler). */
function meldung(r: ClientResponse): string {
  const fehler = r.bankAnswers.filter((a) => a.code >= 9000);
  const alle = fehler.length ? fehler : r.bankAnswers;
  return alle.map((a) => `${a.code} ${a.text}`).join(' · ').slice(0, 500) || 'unbekannter Fehler';
}

/** Ein Verfahren ohne TAN-Eingabe wählen — bevorzugt pushTAN. */
function verfahrenWaehlen(config: FinTSConfig): number | null {
  const alle = config.availableTanMethods ?? [];
  const entkoppelt = alle.filter((m) => m.isDecoupled);
  const push = entkoppelt.find((m) => /push/i.test(m.name)) ?? entkoppelt[0];
  return push?.id ?? null;
}

// ── Abruf ───────────────────────────────────────────────────────────────────
export type Ergebnis =
  | { status: 'ok'; stand: Stand }
  | { status: 'nicht-eingerichtet' }
  | { status: 'freigabe-noetig' }      // Push wurde ausgelöst, aber nicht (rechtzeitig) bestätigt
  | { status: 'konto-fehlt' }
  | { status: 'fehler'; text: string };

/**
 * Holt den aktuellen Kontostand.
 * @param warteAufFreigabeMs  0 = nicht warten (täglicher Abruf), sonst so lange
 *                            auf die Bestätigung in der App warten.
 */
export async function abrufen(warteAufFreigabeMs: number): Promise<Ergebnis> {
  const z = zugang();
  if (!z) return { status: 'nicht-eingerichtet' };
  await schema();

  try {
    let { info, tanMethode } = await zustandLaden();
    let config: FinTSConfig;

    if (info?.upd?.bankAccounts?.length && tanMethode) {
      // Manche Banken schicken ihre Adresse nicht in den Parametern mit.
      if (info.bpd && !info.bpd.url) info.bpd.url = z.url;
      config = FinTSConfig.fromBankingInformation(
        z.produktId, BANK.produktVersion, info, z.benutzer, z.pin, tanMethode,
      );
    } else {
      // Erstes Mal: zweimal synchronisieren (siehe oben).
      config = FinTSConfig.forFirstTimeUse(z.produktId, BANK.produktVersion, z.url, BANK.blz, z.benutzer, z.pin);
      const c0 = new FinTSClient(config);
      const s1 = await c0.synchronize();
      if (!s1.success) return await scheitern(meldung(s1));
      tanMethode = verfahrenWaehlen(config);
      if (!tanMethode) return await scheitern('Die Bank bietet kein Freigabeverfahren per App (pushTAN) an.');
      c0.selectTanMethod(tanMethode);
      let s2 = await c0.synchronize();
      if (s2.requiresTan) {
        if (!warteAufFreigabeMs) return await freigabeFehlt();
        s2 = await freigabeAbwarten(c0, s2, (ref) => c0.synchronizeWithTan(ref), warteAufFreigabeMs);
        if (s2.requiresTan) return await freigabeFehlt();
      }
      if (!s2.success) return await scheitern(meldung(s2));
      await zustandSpeichern(config.bankingInformation, tanMethode);
    }

    const client = new FinTSClient(config);
    const konto = config.bankingInformation.upd?.bankAccounts
      .find((k: BankAccount) => (k.iban ?? '').toUpperCase() === z.iban);
    if (!konto) return { status: 'konto-fehlt' };

    let r: AccountBalanceResponse = await client.getAccountBalance(konto);
    if (r.requiresTan) {
      if (!warteAufFreigabeMs) return await freigabeFehlt();
      r = await freigabeAbwarten(client, r, (ref) => client.getAccountBalanceWithTan(ref), warteAufFreigabeMs);
      if (r.requiresTan) return await freigabeFehlt();
    }
    if (r.bankingInformationUpdated) await zustandSpeichern(config.bankingInformation, tanMethode);
    if (!r.success || !r.balance) return await scheitern(meldung(r));

    const b = r.balance;
    const verfuegbar = b.availableAmount ?? null;
    const buchungsdatum = b.date ? new Date(b.date).toISOString().slice(0, 10) : null;
    const [stand] = (await sql()`
      INSERT INTO kontostaende (saldo, verfuegbar, waehrung, buchungsdatum)
      VALUES (${b.balance}, ${verfuegbar}, ${b.currency || 'EUR'}, ${buchungsdatum})
      RETURNING saldo::float AS saldo, verfuegbar::float AS verfuegbar, waehrung,
                to_char(buchungsdatum, 'YYYY-MM-DD') AS buchungsdatum, abgerufen_am`) as Stand[];
    await vermerken(false, null);
    return { status: 'ok', stand: stand! };
  } catch (e) {
    return await scheitern((e as Error).message);
  }
}

async function freigabeFehlt(): Promise<Ergebnis> {
  await vermerken(true, null);
  return { status: 'freigabe-noetig' };
}

async function scheitern(text: string): Promise<Ergebnis> {
  console.error('Kontostand: Abruf fehlgeschlagen —', text);
  try { await vermerken(false, text); } catch { /* Datenbank selbst gestört */ }
  return { status: 'fehler', text };
}

/** true, wenn der tägliche Abruf aussetzen soll: Eine Freigabe steht aus,
 *  und jeder weitere Versuch würde nur erneut eine Push-Nachricht auslösen. */
export async function freigabeAusstehend(): Promise<boolean> {
  await schema();
  const [v] = (await sql()`SELECT freigabe_noetig_seit FROM bank_verbindung WHERE id = 1`) as any[];
  return Boolean(v?.freigabe_noetig_seit);
}
