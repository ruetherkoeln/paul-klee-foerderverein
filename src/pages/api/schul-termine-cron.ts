// GET /api/schul-termine-cron — wöchentlicher Abgleich mit der Terminseite der
// Schule (Vercel Cron, siehe vercel.json). Geschützt mit CRON_SECRET.
import type { APIRoute } from 'astro';
import { getEnv } from '../../lib/zuwendung.ts';
import { gleichSicher } from '../../lib/sicherheit.ts';
import { schulTerminePruefen } from '../../lib/schul-termine.ts';

export const prerender = false;

const antwort = (text: string, status = 200) =>
  new Response(text, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  const geheim = getEnv('CRON_SECRET');
  const kopf = request.headers.get('authorization') ?? '';
  if (!geheim || !gleichSicher(kopf, `Bearer ${geheim}`)) return antwort('Nicht erlaubt', 401);
  const e = await schulTerminePruefen();
  return antwort(JSON.stringify(e), e.status === 'fehler' ? 500 : 200);
};
