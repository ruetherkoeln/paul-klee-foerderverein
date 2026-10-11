// GET /vorstand/datei/<id> — gibt ein Vorstandsdokument heraus, nur nach Anmeldung.
import type { APIRoute } from 'astro';
import { VORSTAND, zurAnmeldung } from '../../../lib/vorstand.ts';
import { dokumentLaden } from '../../../lib/vorstand-db.ts';
import { GESCHUETZT_KOPFZEILEN } from '../../../lib/sicherheit.ts';

export const prerender = false;

export const GET: APIRoute = async ({ params, cookies }) => {
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

  // PDF und Bilder darf der Browser direkt anzeigen, alles andere wird
  // heruntergeladen. Der Dateiname ist beim Hochladen schon von
  // Anführungszeichen und Zeilenumbrüchen befreit; der Name in UTF-8 steht
  // zusätzlich in filename*, damit Umlaute erhalten bleiben.
  const anzeigen = dok.typ === 'application/pdf' || dok.typ.startsWith('image/');
  const ascii = dok.dateiname.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');
  return new Response(dok.inhalt, {
    headers: {
      'content-type': dok.typ,
      'content-length': String(dok.inhalt.length),
      'content-disposition': `${anzeigen ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(dok.dateiname)}`,
      'x-content-type-options': 'nosniff',
      ...GESCHUETZT_KOPFZEILEN,
    },
  });
};
