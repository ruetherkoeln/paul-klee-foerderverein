// POST /vorstand/export/sepa — SEPA-Mandate mit IBAN im Klartext.
//
// Verlangt ausser der Anmeldung zum Vorstandsbereich das getrennte
// Bank-Passwort (EXPORT_BANK_PASSWORT). Die Kontodaten sind das Heikelste,
// was der Verein speichert; wer nur die Mitgliederliste braucht, soll an sie
// nicht herankommen. Deshalb ein POST mit Passwortfeld und kein Link.
import type { APIRoute } from 'astro';
import { VORSTAND, START, zurAnmeldung } from '../../../lib/vorstand.ts';
import { fremdeAnfrage } from '../../../lib/zugang.ts';
import { originErlaubt, gleichSicher } from '../../../lib/sicherheit.ts';
import { getEnv } from '../../../lib/zuwendung.ts';
import { sepaCsv, csvAntwort } from '../../../lib/export-listen.ts';
import {
  bremsen, fehlversuchZaehlen, gesperrt, herkunft, versucheLoeschen,
} from '../../../lib/login-schutz.ts';

export const prerender = false;

const zurueck = (hinweis: string) =>
  new Response(null, { status: 303, headers: { Location: `${START}?hinweis=${hinweis}#exporte` } });

export const GET: APIRoute = () => zurueck('');

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!originErlaubt(request)) return fremdeAnfrage();
  if (!VORSTAND.angemeldet(cookies)) return zurAnmeldung();

  const soll = getEnv('EXPORT_BANK_PASSWORT');
  if (!soll) return zurueck('bank-fehlt');

  const spur = herkunft('vorstand-bank', request);
  if (await gesperrt(spur)) return zurueck('gesperrt');

  const eingabe = String((await request.formData()).get('bankpasswort') ?? '').trim();
  if (!gleichSicher(eingabe, soll)) {
    await fehlversuchZaehlen(spur);
    await bremsen();
    return zurueck('bank-falsch');
  }
  await versucheLoeschen(spur);

  try {
    return csvAntwort(await sepaCsv(), 'sepa-mandate');
  } catch (e) {
    console.error('Vorstand: Export SEPA fehlgeschlagen —', (e as Error).message);
    return zurueck('technik');
  }
};
