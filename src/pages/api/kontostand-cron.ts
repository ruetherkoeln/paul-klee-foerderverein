// GET /api/kontostand-cron — täglicher Abruf des Kontostands (Vercel Cron,
// siehe vercel.json). Vercel schickt CRON_SECRET als Bearer-Token mit; ohne
// passendes Token passiert nichts.
//
// Steht eine Freigabe aus, setzt der Abruf aus: Jeder Versuch würde sonst
// täglich eine Push-Nachricht auslösen, die niemand erwartet. Erst ein
// erfolgreiches „Jetzt abrufen“ im Vorstandsbereich hebt das wieder auf.
import type { APIRoute } from 'astro';
import { getEnv } from '../../lib/zuwendung.ts';
import { gleichSicher } from '../../lib/sicherheit.ts';
import { abrufen, freigabeAusstehend } from '../../lib/kontostand.ts';

export const prerender = false;

const antwort = (text: string, status = 200) =>
  new Response(text, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  const geheim = getEnv('CRON_SECRET');
  const kopf = request.headers.get('authorization') ?? '';
  if (!geheim || !gleichSicher(kopf, `Bearer ${geheim}`)) return antwort('Nicht erlaubt', 401);

  try {
    if (await freigabeAusstehend()) return antwort('übersprungen: Freigabe steht aus');
    const e = await abrufen(0);
    return antwort(e.status);
  } catch (err) {
    console.error('Kontostand-Cron:', (err as Error).message);
    return antwort('fehler', 500);
  }
};
