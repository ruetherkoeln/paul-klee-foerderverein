// GET /mitglieder/datei/<id>[?download=1] — gibt ein für Mitglieder
// freigegebenes Dokument heraus, nur nach Anmeldung. Reine Vorstandsdokumente
// liefert diese Route nie aus, auch nicht bei passender Nummer.
import type { APIRoute } from 'astro';
import { MITGLIEDER, START, dateiAntwort } from '../../../lib/mitglieder-bereich.ts';
import { dokumentLaden } from '../../../lib/vorstand-db.ts';

export const prerender = false;

export const GET: APIRoute = async ({ params, cookies, url }) => {
  if (!MITGLIEDER.angemeldet(cookies)) {
    return new Response(null, { status: 303, headers: { Location: START } });
  }

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return new Response('Nicht gefunden', { status: 404 });

  let dok;
  try {
    dok = await dokumentLaden(id, true);
  } catch (e) {
    console.error('Mitglieder: Dokument nicht lesbar —', (e as Error).message);
    return new Response('Zurzeit nicht möglich', { status: 500 });
  }
  if (!dok) return new Response('Nicht gefunden', { status: 404 });

  return dateiAntwort(dok, url.searchParams.has('download'));
};
