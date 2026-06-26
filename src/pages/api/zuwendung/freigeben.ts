// /api/zuwendung/freigeben
//   GET  ?token=…  → Vorschau für den Vorstand + Button "Jetzt senden"
//   POST (token im Body) → PDF erzeugen, an Spender (+ Kopie Verein) senden
// Zwei-Schritt, damit Link-Vorschau/Scanner in Mail-Clients nicht auslösen.
import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { STEUER } from '../../../data/verein-steuer.ts';
import { getEnv, verifySpende, formatEuro } from '../../../lib/zuwendung.ts';
import { buildZuwendungsPdf } from '../../../lib/zuwendung-pdf.ts';

export const prerender = false;

const html = (body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="de"><head><meta charset="utf-8">
     <meta name="viewport" content="width=device-width,initial-scale=1">
     <title>Zuwendungsbescheinigung</title>
     <style>
       body{font-family:-apple-system,Arial,sans-serif;color:#0d1726;background:#f7f5f0;margin:0;padding:48px 20px}
       .card{max-width:560px;margin:0 auto;background:#fff;border:1px solid #e3e7ec;border-radius:10px;padding:32px}
       h1{font-size:20px;margin:0 0 12px}
       table{border-collapse:collapse;margin:16px 0;width:100%}
       td{padding:6px 0;border-bottom:1px solid #eef1f4;font-size:14px}
       td.k{color:#5a6b7b;width:42%}
       .btn{display:inline-block;background:#caa53d;color:#0d1726;padding:13px 24px;border:0;border-radius:6px;font-weight:bold;font-size:15px;cursor:pointer;text-decoration:none}
       .muted{color:#8a97a4;font-size:13px;line-height:1.6}
       .ok{color:#1a7f4b;font-weight:bold}
       .err{color:#b3261e;font-weight:bold}
     </style></head><body><div class="card">${body}</div></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );

export const GET: APIRoute = async ({ url }) => {
  if (!STEUER.AUSSTELLUNG_AKTIV)
    return html('<h1>Nicht aktiv</h1><p class="muted">Die Ausstellung von Zuwendungsbescheinigungen ist derzeit deaktiviert.</p>', 503);

  const token = url.searchParams.get('token') || '';
  const s = verifySpende(token);
  if (!s) return html('<h1 class="err">Link ungültig oder abgelaufen</h1><p class="muted">Bitte den Spender erneut das Formular ausfüllen lassen.</p>', 400);

  return html(`
    <h1>Bescheinigung freigeben?</h1>
    <p class="muted">Bitte vor dem Senden prüfen, dass dieser Betrag tatsächlich auf dem Vereinskonto eingegangen ist.</p>
    <table>
      <tr><td class="k">Spender</td><td><strong>${s.vorname} ${s.name}</strong></td></tr>
      <tr><td class="k">Anschrift</td><td>${s.strasse} ${s.hausnummer}, ${s.plz} ${s.ort}</td></tr>
      <tr><td class="k">E-Mail</td><td>${s.email}</td></tr>
      <tr><td class="k">Betrag</td><td><strong>${formatEuro(s.betragCent)}</strong></td></tr>
      <tr><td class="k">Tag der Zuwendung</td><td>${s.datum}</td></tr>
      <tr><td class="k">Verzicht auf Aufwendungsersatz</td><td>${s.verzicht ? 'Ja' : 'Nein'}</td></tr>
    </table>
    <form method="post">
      <input type="hidden" name="token" value="${token}">
      <button class="btn" type="submit">Jetzt erzeugen &amp; an Spender senden</button>
    </form>
    <p class="muted" style="margin-top:18px">Erst mit diesem Klick wird die Bescheinigung erstellt und versendet.</p>
  `);
};

export const POST: APIRoute = async ({ request }) => {
  if (!STEUER.AUSSTELLUNG_AKTIV) return html('<h1>Nicht aktiv</h1>', 503);

  const fd = await request.formData();
  const token = String(fd.get('token') || '');
  const s = verifySpende(token);
  if (!s) return html('<h1 class="err">Link ungültig oder abgelaufen</h1>', 400);

  const apiKey = getEnv('RESEND_API_KEY');
  const from = getEnv('MAIL_FROM') || 'Förderverein Paul-Klee-Schule <spenden@pks-foerderverein.de>';
  const kopie = getEnv('VEREIN_KOPIE_EMAIL');
  if (!apiKey) return html('<h1 class="err">Konfigurationsfehler</h1><p class="muted">RESEND_API_KEY fehlt.</p>', 500);

  let pdf: Uint8Array;
  try {
    pdf = await buildZuwendungsPdf(s);
  } catch (e) {
    console.error('PDF-Erzeugung fehlgeschlagen:', e);
    return html('<h1 class="err">PDF-Erzeugung fehlgeschlagen</h1>', 500);
  }

  const dateiname = `Zuwendungsbescheinigung_${s.name}_${s.datum}.pdf`.replace(/\s+/g, '_');
  const spenderHtml = `
    <div style="font-family:Arial,sans-serif;color:#0d1726;line-height:1.6">
      <p>Guten Tag ${s.vorname} ${s.name},</p>
      <p>vielen Dank für Ihre Unterstützung des Fördervereins der Paul-Klee-Schule.
      Im Anhang finden Sie Ihre Zuwendungsbescheinigung über <strong>${formatEuro(s.betragCent)}</strong>
      zur Vorlage beim Finanzamt.</p>
      <p>Herzliche Grüße<br>${STEUER.verein.name}</p>
    </div>`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: s.email,
      ...(kopie ? { bcc: kopie } : {}),
      subject: 'Ihre Zuwendungsbescheinigung – Förderverein Paul-Klee-Schule',
      html: spenderHtml,
      attachments: [{ filename: dateiname, content: Buffer.from(pdf) }],
    });
    if (error) throw error;
  } catch (e) {
    console.error('Versand an Spender fehlgeschlagen:', e);
    return html('<h1 class="err">Versand fehlgeschlagen</h1><p class="muted">Bitte erneut versuchen.</p>', 502);
  }

  return html(`
    <h1 class="ok">✓ Bescheinigung versendet</h1>
    <p class="muted">Die Zuwendungsbescheinigung über <strong>${formatEuro(s.betragCent)}</strong>
    wurde an ${s.email} gesendet${kopie ? ' (Kopie an den Verein)' : ''}.</p>
  `);
};
