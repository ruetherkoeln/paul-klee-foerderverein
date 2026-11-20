// POST /vorstand/dokumente/aktion — Dokument hochladen, löschen oder für
// den Mitgliederbereich freigeben.
//
// Die Dateien landen in der Datenbank (siehe lib/vorstand-db.ts), nicht im
// öffentlichen Repository. Erlaubt sind nur übliche Büroformate; was hier
// hochgeladen wird, geht später mit genau diesem Typ wieder hinaus.
import type { APIRoute } from 'astro';
import { VORSTAND, START, zurAnmeldung } from '../../../lib/vorstand.ts';
import { fremdeAnfrage } from '../../../lib/zugang.ts';
import { originErlaubt } from '../../../lib/sicherheit.ts';
import { dokumentSpeichern, dokumentLoeschen, dokumentFreigabe } from '../../../lib/vorstand-db.ts';
import { DOKUMENT_TYPEN, MAX_BYTES, MITGLIEDER_RUBRIKEN } from '../../../data/vorstand-bereich.ts';

export const prerender = false;

const zurueck = (hinweis: string) =>
  new Response(null, { status: 303, headers: { Location: `${START}dokumente/?hinweis=${hinweis}` } });

export const GET: APIRoute = () => zurueck('');

/** Feld „freigabe“: „vorstand“ oder „mitglieder:<rubrik>“. Alles andere —
 *  auch eine unbekannte Rubrik — bleibt beim Vorstand: Im Zweifel wird nichts
 *  für Mitglieder sichtbar. */
function freigabeLesen(f: FormData): { sichtbar: 'vorstand' | 'mitglieder'; rubrik: string | null } {
  const [art, rubrik = ''] = String(f.get('freigabe') ?? '').split(':');
  if (art === 'mitglieder' && Object.hasOwn(MITGLIEDER_RUBRIKEN, rubrik)) {
    return { sichtbar: 'mitglieder', rubrik };
  }
  return { sichtbar: 'vorstand', rubrik: null };
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!originErlaubt(request)) return fremdeAnfrage();
  if (!VORSTAND.angemeldet(cookies)) return zurAnmeldung();

  // Vercel nimmt höchstens 4,5 MB je Anfrage an. Was darüber liegt, kommt gar
  // nicht erst hier an — die Prüfung vorab liefert dann wenigstens eine
  // verständliche Meldung, wenn der Browser die Länge mitteilt.
  const laenge = Number(request.headers.get('content-length') ?? 0);
  if (laenge > MAX_BYTES + 64 * 1024) return zurueck('zu-gross');

  let formular: FormData;
  try {
    formular = await request.formData();
  } catch {
    return zurueck('technik');
  }

  try {
    if (formular.get('aktion') === 'loeschen') {
      const id = Number(formular.get('id'));
      if (!Number.isInteger(id) || id <= 0) return zurueck('technik');
      // Ohne Häkchen wird nichts gelöscht — ein Klick daneben soll kein
      // Dokument kosten, und die Seite kommt ohne JavaScript-Rückfrage aus.
      if (formular.get('sicher') !== 'ja') return zurueck('nicht-bestaetigt');
      await dokumentLoeschen(id);
      return zurueck('geloescht');
    }

    if (formular.get('aktion') === 'freigabe') {
      const id = Number(formular.get('id'));
      if (!Number.isInteger(id) || id <= 0) return zurueck('technik');
      const f = freigabeLesen(formular);
      await dokumentFreigabe(id, f.sichtbar, f.rubrik);
      return zurueck(f.sichtbar === 'mitglieder' ? 'freigegeben' : 'zurueckgezogen');
    }

    const datei = formular.get('datei');
    if (!(datei instanceof File) || datei.size === 0) return zurueck('keine-datei');
    if (datei.size > MAX_BYTES) return zurueck('zu-gross');

    const name = datei.name.replace(/[\\/\r\n"]/g, '').slice(0, 160) || 'dokument';
    const endung = name.split('.').pop()?.toLowerCase() ?? '';
    const typ = DOKUMENT_TYPEN[endung];
    if (!typ) return zurueck('typ');

    const titelEingabe = String(formular.get('titel') ?? '').trim().slice(0, 160);
    const titel = titelEingabe || name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');

    const f = freigabeLesen(formular);
    await dokumentSpeichern(titel, name, typ, Buffer.from(await datei.arrayBuffer()), f.sichtbar, f.rubrik);
    return zurueck('hochgeladen');
  } catch (e) {
    console.error('Vorstand: Dokument-Aktion fehlgeschlagen —', (e as Error).message);
    return zurueck('technik');
  }
};
