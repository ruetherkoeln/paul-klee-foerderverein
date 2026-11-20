// GET /vorstand/datei/<id> — gibt ein Vorstandsdokument heraus, nur nach Anmeldung.
import type { APIRoute } from 'astro';
import { VORSTAND, zurAnmeldung } from '../../../lib/vorstand.ts';
import { dokumentLaden } from '../../../lib/vorstand-db.ts';
import { dateiAntwort } from '../../../lib/mitglieder-bereich.ts';

export const prerender = false;

export const GET: APIRoute = async ({ params, cookies, url }) => {
  if (!VORSTAND.angemeldet(cookies)) return zurAnmeldung();

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return new Response('Nicht gefunden', { status: 404 });

  let dok;
  try {
    dok = await dokumentLaden(id);
  } catch (e) {
    console.error('Vorstand: Dokument nicht lesbar —', (e as Error).message);
    return new Response('Zurzeit nicht möglich', { status: 500 });
  }
  if (!dok) return new Response('Nicht gefunden', { status: 404 });

  return dateiAntwort(dok, url.searchParams.has('download'));
};
