// SEPA-Lastschriftmandat als PDF, inklusive gezeichneter Unterschrift.
// Aufbau bewusst nah an src/lib/zuwendung-pdf.ts gehalten.
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { ERFASSUNG } from '../data/erfassung.ts';
import { LOGO_PNG_BASE64 } from './logo-base64.ts';
import { mandatstext } from './mandat-text.ts';
import { formatiereIban } from './iban.ts';

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 56;
const ink = rgb(0.05, 0.09, 0.16);
const grau = rgb(0.42, 0.45, 0.5);

export interface MandatDaten {
  vorname: string;
  nachname: string;
  strasse: string;
  plz: string;
  ort: string;
  kontoinhaber: string;
  iban: string;
  mandatsreferenz: string;
  glaeubigerId: string;
  /** Data-URL des Unterschriften-Canvas (image/png;base64,…) */
  signaturDataUrl: string | null;
  erteiltAm: Date;
  beitragEur: number;
}

function deDatum(d: Date): string {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export async function buildMandatPdf(m: MandatDaten): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([A4.w, A4.h]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const x = MARGIN;
  const breite = A4.w - 2 * MARGIN;
  let y = A4.h - MARGIN;

  const zeile = (
    text: string,
    o: { font?: PDFFont; size?: number; gap?: number; color?: any } = {},
  ) => {
    const size = o.size ?? 10;
    page.drawText(text, { x, y, size, font: o.font ?? font, color: o.color ?? ink });
    y -= o.gap ?? size + 5;
  };

  // Zeilenumbruch nach Wortgrenzen
  const absatz = (text: string, o: { size?: number; gap?: number } = {}) => {
    const size = o.size ?? 10;
    const woerter = text.split(/\s+/);
    let aktuell = '';
    for (const w of woerter) {
      const test = aktuell ? `${aktuell} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > breite) {
        page.drawText(aktuell, { x, y, size, font, color: ink });
        y -= size + 3;
        aktuell = w;
      } else {
        aktuell = test;
      }
    }
    if (aktuell) {
      page.drawText(aktuell, { x, y, size, font, color: ink });
      y -= size + 3;
    }
    y -= o.gap ?? 6;
  };

  // ── Kopf: Logo + Verein ───────────────────────────────────────────────────
  try {
    const logo = await doc.embedPng(Buffer.from(LOGO_PNG_BASE64, 'base64'));
    const h = 38;
    const w = (logo.width / logo.height) * h;
    page.drawImage(logo, { x, y: y - h + 8, width: w, height: h });
  } catch {
    // Logo ist Beiwerk — ohne es bleibt das Dokument gültig
  }
  const v = ERFASSUNG.verein;
  const rechts = A4.w - MARGIN;
  const klein = (t: string, dy: number) => {
    const w = font.widthOfTextAtSize(t, 8);
    page.drawText(t, { x: rechts - w, y: y - dy, size: 8, font, color: grau });
  };
  klein(v.name, 0);
  klein(`${v.strasse}, ${v.plz} ${v.ort}`, 11);
  klein(v.email, 22);
  y -= 62;

  zeile('SEPA-Lastschriftmandat', { font: bold, size: 16, gap: 24 });

  // ── Mandatsdaten ──────────────────────────────────────────────────────────
  zeile(`Mandatsreferenz: ${m.mandatsreferenz}`, { font: bold, gap: 15 });
  zeile(`Gläubiger-Identifikationsnummer: ${m.glaeubigerId}`, { gap: 20 });

  zeile('Zahlungspflichtige Person', { font: bold, size: 11, gap: 15 });
  zeile(`${m.vorname} ${m.nachname}`);
  zeile(m.strasse);
  zeile(`${m.plz} ${m.ort}`, { gap: 18 });

  zeile('Bankverbindung', { font: bold, size: 11, gap: 15 });
  zeile(`Kontoinhaber: ${m.kontoinhaber}`);
  zeile(`IBAN: ${formatiereIban(m.iban)}`, { gap: 18 });

  zeile('Jahresbeitrag', { font: bold, size: 11, gap: 15 });
  zeile(`${m.beitragEur},00 Euro pro Jahr`, { gap: 20 });

  // ── Mandatstext ───────────────────────────────────────────────────────────
  zeile('Mandat', { font: bold, size: 11, gap: 15 });
  for (const t of mandatstext({ glaeubigerId: m.glaeubigerId, referenz: m.mandatsreferenz })) {
    absatz(t, { size: 9.5, gap: 5 });
  }

  y -= 10;

  // ── Unterschrift ──────────────────────────────────────────────────────────
  zeile(`${m.ort}, den ${deDatum(m.erteiltAm)}`, { size: 10, gap: 14 });

  if (m.signaturDataUrl) {
    const base64 = m.signaturDataUrl.split(',')[1] ?? '';
    try {
      const sig = await doc.embedPng(Buffer.from(base64, 'base64'));
      const h = 52;
      const w = Math.min((sig.width / sig.height) * h, 240);
      page.drawImage(sig, { x, y: y - h + 6, width: w, height: h });
      y -= h;
    } catch {
      y -= 40;
    }
  } else {
    y -= 40;
  }

  page.drawLine({
    start: { x, y: y + 2 },
    end: { x: x + 240, y: y + 2 },
    thickness: 0.75,
    color: grau,
  });
  y -= 12;
  zeile('Unterschrift des Kontoinhabers', { size: 8, color: grau, gap: 30 });

  // ── Fußzeile ──────────────────────────────────────────────────────────────
  const fuss =
    'Elektronisch erteiltes Mandat. Unterschrift im Browser gezeichnet, mit Datum gespeichert.';
  page.drawText(fuss, { x, y: MARGIN, size: 7.5, font, color: grau });

  return doc.save();
}
