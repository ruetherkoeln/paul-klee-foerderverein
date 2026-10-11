// GET /vorstand/export/mitglieder — Mitgliederliste als CSV, ohne Bankdaten.
// Dieselbe Datei wie /api/export, nur hinter der Anmeldung des Vorstands.
import type { APIRoute } from 'astro';
import { VORSTAND, zurAnmeldung } from '../../../lib/vorstand.ts';
import { mitgliederCsv, csvAntwort } from '../../../lib/export-listen.ts';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!VORSTAND.angemeldet(cookies)) return zurAnmeldung();
  try {
    return csvAntwort(await mitgliederCsv(), 'mitglieder');
  } catch (e) {
    console.error('Vorstand: Export Mitglieder fehlgeschlagen —', (e as Error).message);
    return new Response('Export zurzeit nicht möglich', { status: 500 });
  }
};
