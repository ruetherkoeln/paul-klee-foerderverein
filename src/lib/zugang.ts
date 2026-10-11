// Passwortgeschützte Bereiche mit Anmeldeformular und signiertem Cookie.
// Nur serverseitig importieren — nutzt node:crypto.
//
// Warum eigener Code und nicht Basic Auth: Ein Browser-Dialog ohne Erklärung
// schreckt ab, und abmelden kann man sich daraus praktisch nicht. Also ein
// Formular auf einer erklärten Seite und ein signiertes Merkmal im Cookie.
//
// Das Merkmal ist bewusst kein Sitzungs-Schlüssel in einer Datenbank: Es gibt
// nichts Benutzerbezogenes zu speichern. Signiert werden allein der
// Ablaufpunkt und ein Abdruck des geltenden Passworts.
//
// Jeder Bereich bekommt ein eigenes Cookie, ein eigenes Passwort und einen
// eigenen Signierschlüssel. Wer die Unterlagen der Mitgliederversammlung
// öffnen darf, kommt damit nicht in den Vorstandsbereich.
import crypto from 'node:crypto';
import type { AstroCookies } from 'astro';
import { getEnv } from './zuwendung.ts';
import { gleichSicher, originErlaubt, GESCHUETZT_KOPFZEILEN } from './sicherheit.ts';
import {
  bremsen, fehlversuchZaehlen, gesperrt, herkunft, versucheLoeschen,
} from './login-schutz.ts';
import { SICHERHEIT } from '../data/sicherheit.ts';

export interface ZugangsEinstellung {
  /** Name des Cookies. Mit __Host- nimmt der Browser es nur über HTTPS, für
   *  den ganzen Pfad und ohne Domain an — keine Nachbar-Subdomain kann eines
   *  dieses Namens unterschieben. */
  cookie: string;
  /** Umgebungsvariable mit dem Passwort. */
  passwortVar: string;
  /** Umgebungsvariable für einen eigenen Signierschlüssel (optional gesetzt). */
  geheimnisVar: string;
  /** Verwendungszweck, mit dem der Schlüssel sonst aus
   *  ERFASSUNG_SIGNING_SECRET abgeleitet wird. */
  zweck: string;
  sameSite: 'lax' | 'strict';
  gueltigMs: number;
}

export function zugang(e: ZugangsEinstellung) {
  function geheimnis(): string {
    // Ein eigenes Geheimnis hat Vorrang. Fehlt es, wird eines aus dem bereits
    // vorhandenen Signierschlüssel abgeleitet — mit eigenem Verwendungszweck,
    // damit die Schlüssel nichts voneinander wissen. So muss für einen
    // Bereich nur das Passwort gesetzt werden und nicht auch noch ein Schlüssel.
    const eigen = getEnv(e.geheimnisVar);
    if (eigen) return eigen;
    const wurzel = getEnv('ERFASSUNG_SIGNING_SECRET');
    if (!wurzel) throw new Error(`${e.geheimnisVar} oder ERFASSUNG_SIGNING_SECRET fehlt`);
    return crypto.createHmac('sha256', wurzel).update(e.zweck).digest('base64');
  }

  /**
   * Kurzer Abdruck des geltenden Passworts. Er geht in die Signatur ein, damit
   * ein Passwortwechsel alle ausgegebenen Merkmale sofort entwertet — sonst
   * käme jemand, der das alte Passwort kannte, bis zum Ablauf weiter hinein.
   */
  function passwortMarke(): string {
    const soll = getEnv(e.passwortVar) ?? '';
    return crypto.createHash('sha256').update(soll, 'utf8').digest('base64').slice(0, 12);
  }

  function signatur(ablauf: string): string {
    return crypto.createHmac('sha256', geheimnis())
      .update(`${ablauf}|${passwortMarke()}`)
      .digest('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function passwortStimmt(eingabe: string): boolean {
    const soll = getEnv(e.passwortVar);
    if (!soll) return false;
    return gleichSicher((eingabe || '').trim(), soll);
  }

  function merkmalErzeugen(): string {
    const ablauf = String(Date.now() + e.gueltigMs);
    return `${ablauf}.${signatur(ablauf)}`;
  }

  function merkmalGueltig(wert: string | undefined): boolean {
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

  const COOKIE_OPTIONEN = {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: e.sameSite,
    maxAge: Math.floor(e.gueltigMs / 1000),
  } as const;

  const angemeldet = (cookies: AstroCookies) => merkmalGueltig(cookies.get(e.cookie)?.value);

  return {
    COOKIE: e.cookie,
    COOKIE_OPTIONEN,
    passwortStimmt,
    merkmalErzeugen,
    merkmalGueltig,
    angemeldet,
  };
}

export type Zugang = ReturnType<typeof zugang>;

/** Antwort auf einen POST, der nicht von der eigenen Site kommt. */
export function fremdeAnfrage(): Response {
  return new Response('Ungültige Anfrage', {
    status: 403,
    headers: { 'content-type': 'text/plain; charset=utf-8', ...GESCHUETZT_KOPFZEILEN },
  });
}

export interface Anmeldung {
  /** Fertige Antwort (Umleitung oder 403) — die Seite gibt sie unverändert zurück. */
  antwort?: Response;
  fehler: string;
  abgemeldet: boolean;
}

/**
 * Nimmt das Anmelde- bzw. Abmeldeformular eines Bereichs entgegen.
 * Ablauf wie bei /mv2026/: Herkunft prüfen, Sperre prüfen, Passwort prüfen,
 * nach Erfolg umleiten (damit ein Neuladen nichts erneut abschickt).
 */
export async function anmeldungVerarbeiten(
  request: Request,
  cookies: AstroCookies,
  z: Zugang,
  bereich: string,
  ziel: string,
  kontakt: string,
): Promise<Anmeldung> {
  const ergebnis: Anmeldung = { fehler: '', abgemeldet: false };
  if (request.method !== 'POST') return ergebnis;

  // Astros eigener checkOrigin ist aus, weil er auf Vercel gegen den internen
  // Host prüft — also prüfen wir hier selbst.
  if (!originErlaubt(request)) return { ...ergebnis, antwort: fremdeAnfrage() };

  const formular = await request.formData();

  if (formular.get('abmelden')) {
    cookies.delete(z.COOKIE, { path: '/' });
    return { ...ergebnis, abgemeldet: true };
  }

  const spur = herkunft(bereich, request);
  const eingabe = String(formular.get('passwort') ?? '');

  if (await gesperrt(spur)) {
    // Bewusst dieselbe Auskunft für jede Herkunft: Wer sperrt, verrät sonst,
    // dass an dieser Stelle überhaupt etwas zu holen ist.
    return {
      ...ergebnis,
      fehler: `Zu viele Fehlversuche. Bitte warten Sie ${SICHERHEIT.LOGIN_FENSTER_MIN} `
        + `Minuten und versuchen Sie es dann erneut, oder schreiben Sie an ${kontakt}.`,
    };
  }

  if (z.passwortStimmt(eingabe)) {
    // Fehlt der Signierschlüssel, wirft das Erzeugen. Ohne diesen Fang stünde
    // hier eine nackte Fehlerseite — ausgerechnet für jemanden, der das
    // richtige Passwort eingegeben hat.
    try {
      cookies.set(z.COOKIE, z.merkmalErzeugen(), z.COOKIE_OPTIONEN);
      await versucheLoeschen(spur);
      return {
        ...ergebnis,
        antwort: new Response(null, { status: 303, headers: { Location: ziel } }),
      };
    } catch (err) {
      console.error(`${bereich}: Zugang nicht eingerichtet —`, (err as Error).message);
      return {
        ...ergebnis,
        fehler: `Der Zugang ist gerade nicht eingerichtet. Bitte melden Sie sich kurz unter ${kontakt}.`,
      };
    }
  }

  await fehlversuchZaehlen(spur);
  // Kurz bremsen: macht das Durchprobieren spürbar langsamer, ohne dass
  // jemand mit dem richtigen Passwort etwas merkt.
  await bremsen();
  return {
    ...ergebnis,
    fehler: eingabe.trim()
      ? 'Das Passwort stimmt nicht. Bitte prüfen Sie Groß- und Kleinschreibung.'
      : 'Bitte geben Sie das Passwort ein.',
  };
}

/** Setzt die Schutz-Kopfzeilen auf eine Astro-Antwort. */
export function geschuetzt(headers: Headers): void {
  for (const [k, v] of Object.entries(GESCHUETZT_KOPFZEILEN)) headers.set(k, v);
}
