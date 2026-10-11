// POST /vorstand/kontostand — Kontostand jetzt abrufen („Jetzt abrufen“).
//
// Wartet bis zu BANK.FREIGABE_WARTEN_MS auf die Bestätigung in der
// S-pushTAN-App, falls die Bank gerade eine Freigabe verlangt (etwa alle 90
// Tage). Ein POST und kein Link, weil der Aufruf bei der Bank etwas auslöst.
import type { APIRoute } from 'astro';
import { VORSTAND, START, zurAnmeldung } from '../../lib/vorstand.ts';
import { fremdeAnfrage } from '../../lib/zugang.ts';
import { originErlaubt } from '../../lib/sicherheit.ts';
import { abrufen } from '../../lib/kontostand.ts';
import { BANK } from '../../data/bank.ts';

export const prerender = false;

const zurueck = (konto: string) =>
  new Response(null, { status: 303, headers: { Location: `${START}?konto=${konto}#kontostand` } });

export const GET: APIRoute = () => zurueck('');

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!originErlaubt(request)) return fremdeAnfrage();
  if (!VORSTAND.angemeldet(cookies)) return zurAnmeldung();
  const e = await abrufen(BANK.FREIGABE_WARTEN_MS);
  return zurueck(e.status);
};
