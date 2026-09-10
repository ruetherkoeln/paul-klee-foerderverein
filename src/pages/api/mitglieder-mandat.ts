// GET /api/mitglieder-mandat?t=<signierter Token>
// Liefert das SEPA-Mandat als PDF. Der Token ist an die Datensatz-ID gebunden
// und 30 Tage gültig — ohne ihn ist das Dokument nicht erreichbar.
import type { APIRoute } from 'astro';
import { getEnv } from '../../lib/zuwendung.ts';
import { verifyId, entschluesseln } from '../../lib/erfassung-crypto.ts';
import { ladeEintrag, schemaSicherstellen } from '../../lib/erfassung-db.ts';
import { buildMandatPdf } from '../../lib/erfassung-pdf.ts';
import { GLAEUBIGER_ID } from '../../data/erfassung.ts';

export const prerender = false;

const text = (s: string, status: number) =>
  new Response(s, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

export const GET: APIRoute = async ({ request }) => {
  const token = new URL(request.url).searchParams.get('t') ?? '';
  const id = verifyId(token);
  if (id === null) return text('Der Link ist ungültig oder abgelaufen.', 403);

  let eintrag: Record<string, any> | null = null;
  try {
    await schemaSicherstellen();
    eintrag = await ladeEintrag(id);
  } catch {
    return text('Das Dokument ist zurzeit nicht abrufbar.', 500);
  }
  if (!eintrag || eintrag.zahlweise !== 'sepa') {
    return text('Zu diesem Eintrag gibt es kein SEPA-Mandat.', 404);
  }

  let iban = '';
  let kontoinhaber = '';
  try {
    iban = eintrag.iban_verschluesselt ? entschluesseln(eintrag.iban_verschluesselt) : '';
    kontoinhaber = eintrag.kontoinhaber_verschluesselt
      ? entschluesseln(eintrag.kontoinhaber_verschluesselt)
      : '';
  } catch {
    return text('Das Dokument konnte nicht erzeugt werden.', 500);
  }

  const pdf = await buildMandatPdf({
    vorname: eintrag.vorname,
    nachname: eintrag.nachname,
    strasse: eintrag.strasse,
    plz: eintrag.plz,
    ort: eintrag.ort,
    kontoinhaber,
    iban,
    mandatsreferenz: eintrag.mandatsreferenz ?? '—',
    glaeubigerId: getEnv('VEREIN_GLAEUBIGER_ID') ?? GLAEUBIGER_ID,
    signaturDataUrl: eintrag.mandat_signatur ?? null,
    erteiltAm: eintrag.mandat_erteilt_am ? new Date(eintrag.mandat_erteilt_am) : new Date(),
    beitragEur: eintrag.beitrag_eur,
  });

  const datei = `SEPA-Mandat-${eintrag.mandatsreferenz ?? id}.pdf`;
  return new Response(Buffer.from(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${datei}"`,
      'cache-control': 'private, no-store',
    },
  });
};
