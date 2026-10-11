// POST /vorstand/termine/aktion — Termin anlegen oder löschen.
import type { APIRoute } from 'astro';
import { VORSTAND, START, zurAnmeldung } from '../../../lib/vorstand.ts';
import { fremdeAnfrage } from '../../../lib/zugang.ts';
import { originErlaubt } from '../../../lib/sicherheit.ts';
import { terminSpeichern, terminLoeschen } from '../../../lib/vorstand-db.ts';

export const prerender = false;

const zurueck = (hinweis: string) =>
  new Response(null, { status: 303, headers: { Location: `${START}termine/?hinweis=${hinweis}` } });

export const GET: APIRoute = () => zurueck('');

const text = (f: FormData, k: string, max: number) => {
  const v = String(f.get(k) ?? '').trim().slice(0, max);
  return v || null;
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!originErlaubt(request)) return fremdeAnfrage();
  if (!VORSTAND.angemeldet(cookies)) return zurAnmeldung();

  try {
    const f = await request.formData();

    if (f.get('aktion') === 'loeschen') {
      const id = Number(f.get('id'));
      if (!Number.isInteger(id) || id <= 0) return zurueck('technik');
      // Wie bei den Dokumenten: ohne Häkchen wird nichts gelöscht.
      if (f.get('sicher') !== 'ja') return zurueck('nicht-bestaetigt');
      await terminLoeschen(id);
      return zurueck('geloescht');
    }

    const datum = String(f.get('datum') ?? '');
    const titel = text(f, 'titel', 160);
    // Das Datumsfeld des Browsers liefert JJJJ-MM-TT; alles andere ablehnen.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || Number.isNaN(Date.parse(datum)) || !titel) {
      return zurueck('angaben');
    }
    const uhrzeit = text(f, 'uhrzeit', 5);
    if (uhrzeit && !/^\d{2}:\d{2}$/.test(uhrzeit)) return zurueck('angaben');

    await terminSpeichern({
      datum, uhrzeit, titel, ort: text(f, 'ort', 160), notiz: text(f, 'notiz', 2000),
    });
    return zurueck('angelegt');
  } catch (e) {
    console.error('Vorstand: Termin-Aktion fehlgeschlagen —', (e as Error).message);
    return zurueck('technik');
  }
};
