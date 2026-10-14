// Abstimmungsvollmacht als PDF. Zwei Fassungen aus einem Bauplan:
//
//   buildVollmachtPdf(null)  — leeres Formular zum Ausdrucken und Unterschreiben
//   buildVollmachtPdf(daten) — ausgefüllt, mit der im Browser gezeichneten
//                              Unterschrift
//
// Aufbau bewusst nah an src/lib/erfassung-pdf.ts gehalten.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { STEUER } from '../data/verein-steuer.ts';
import { VERSAMMLUNG } from '../data/mv2026.ts';
import { BEVOLLMAECHTIGTE } from '../data/vollmacht.ts';
import { erklaerung, hinweise, VOLLMACHT_UNTERTITEL } from './vollmacht-text.ts';
import { LOGO_PNG_BASE64 } from './logo-base64.ts';

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 50;
const ink = rgb(0.05, 0.09, 0.16);
const grau = rgb(0.42, 0.45, 0.5);
const rot = rgb(0.69, 0.22, 0.19); // pk-red #b13830

export interface VollmachtDaten {
  vorname: string;
  nachname: string;
  strasse: string;
  plz: string;
  ort: string;
  email: string;
  /** Data-URL des Unterschriften-Canvas (image/png;base64,…) */
  signaturDataUrl: string | null;
  erteiltAm: Date;
}

function deDatum(d: Date): string {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export async function buildVollmachtPdf(m: VollmachtDaten | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  let page: PDFPage = doc.addPage([A4.w, A4.h]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const x = MARGIN;
  const breite = A4.w - 2 * MARGIN;
  let y = A4.h - MARGIN;

  // Reicht der Platz nicht mehr, beginnt eine neue Seite. Ohne diese Prüfung
  // liefe die Unterschriftszeile bei langen Anschriften unten aus dem Blatt.
  const platz = (brauche: number) => {
    if (y - brauche > MARGIN + 28) return;
    page = doc.addPage([A4.w, A4.h]);
    y = A4.h - MARGIN;
  };

  const zeile = (
    text: string,
    o: { font?: PDFFont; size?: number; gap?: number; color?: any } = {},
  ) => {
    const size = o.size ?? 10;
    platz(size + 6);
    page.drawText(text, { x, y, size, font: o.font ?? font, color: o.color ?? ink });
    y -= o.gap ?? size + 5;
  };

  const absatz = (
    text: string,
    o: { size?: number; gap?: number; font?: PDFFont; color?: any } = {},
  ) => {
    const size = o.size ?? 10;
    const f = o.font ?? font;
    const woerter = text.split(/\s+/);
    let aktuell = '';
    const ausgeben = (t: string) => {
      platz(size + 4);
      page.drawText(t, { x, y, size, font: f, color: o.color ?? ink });
      y -= size + 4;
    };
    for (const w of woerter) {
      const test = aktuell ? `${aktuell} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) > breite) {
        ausgeben(aktuell);
        aktuell = w;
      } else {
        aktuell = test;
      }
    }
    if (aktuell) ausgeben(aktuell);
    y -= o.gap ?? 7;
  };

  // Linie zum Ausfüllen mit Beschriftung darunter.
  const linie = (beschriftung: string, wert: string | null, w = breite) => {
    platz(34);
    if (wert) {
      page.drawText(wert, { x, y: y + 4, size: 11, font: bold, color: ink });
    }
    page.drawLine({
      start: { x, y }, end: { x: x + w, y },
      thickness: 0.75, color: grau,
    });
    y -= 10;
    page.drawText(beschriftung, { x, y, size: 7.5, font, color: grau });
    y -= 13;
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
  const v = STEUER.verein;
  const rechts = A4.w - MARGIN;
  const klein = (t: string, dy: number) => {
    const w = font.widthOfTextAtSize(t, 8);
    page.drawText(t, { x: rechts - w, y: y - dy, size: 8, font, color: grau });
  };
  klein(v.name, 0);
  klein(`${v.strasse}, ${v.plz} ${v.ort}`, 11);
  klein(STEUER.kontakt.email, 22);
  y -= 62;

  // ── Titel ────────────────────────────────────────────────────────────────
  zeile('Vollmacht', { font: bold, size: 19, gap: 24 });
  absatz(VOLLMACHT_UNTERTITEL, { size: 10, color: grau, gap: 10 });

  page.drawLine({
    start: { x, y: y + 6 }, end: { x: x + breite, y: y + 6 },
    thickness: 2, color: rot,
  });
  y -= 16;

  // ── Angaben zur Versammlung ──────────────────────────────────────────────
  zeile('Versammlung', { font: bold, size: 11, gap: 12 });
  zeile(`Termin: ${VERSAMMLUNG.datum}, ${VERSAMMLUNG.uhrzeit}`, { gap: 14 });
  absatz(`Ort: ${VERSAMMLUNG.ort}`, { gap: 8 });

  // ── Vollmachtgeber ───────────────────────────────────────────────────────
  y -= 8;
  zeile('Vollmachtgeberin / Vollmachtgeber', { font: bold, size: 11, gap: 18 });
  linie('Vorname und Nachname', m ? `${m.vorname} ${m.nachname}` : null);
  linie('Straße und Hausnummer', m ? m.strasse : null);
  linie('Postleitzahl und Ort', m ? `${m.plz} ${m.ort}` : null);

  // ── Bevollmächtigte ──────────────────────────────────────────────────────
  y -= 6;
  zeile('Bevollmächtigte', { font: bold, size: 11, gap: 13 });
  zeile(`${BEVOLLMAECHTIGTE.anrede} ${BEVOLLMAECHTIGTE.name}`, { font: bold, size: 12, gap: 15 });

  // ── Erklärung ────────────────────────────────────────────────────────────
  y -= 6;
  zeile('Erklärung', { font: bold, size: 11, gap: 12 });
  const saetze = erklaerung();
  saetze.forEach((t, i) => {
    // Der Satz zur fehlenden Weisung ist der Kern dieser Vollmacht und wird
    // hervorgehoben, damit er beim Überfliegen nicht untergeht.
    const kern = i === 3;
    absatz(t, { size: 9, gap: 3, font: kern ? bold : font, color: kern ? rot : ink });
  });

  // ── Unterschrift ─────────────────────────────────────────────────────────
  platz(92);
  zeile(
    m ? `${m.ort}, den ${deDatum(m.erteiltAm)}` : 'Ort, Datum',
    { size: 10, gap: 5, color: m ? ink : grau },
  );
  if (!m) {
    page.drawLine({
      start: { x, y: y + 2 }, end: { x: x + 200, y: y + 2 },
      thickness: 0.75, color: grau,
    });
  }
  y -= 14;

  if (m?.signaturDataUrl) {
    const base64 = m.signaturDataUrl.split(',')[1] ?? '';
    try {
      const sig = await doc.embedPng(Buffer.from(base64, 'base64'));
      const h = 44;
      const w = Math.min((sig.width / sig.height) * h, 240);
      page.drawImage(sig, { x, y: y - h + 6, width: w, height: h });
      y -= h;
    } catch {
      y -= 30;
    }
  } else {
    y -= 32;
  }

  page.drawLine({
    start: { x, y: y + 2 }, end: { x: x + 240, y: y + 2 },
    thickness: 0.75, color: grau,
  });
  y -= 12;
  zeile('Unterschrift der Vollmachtgeberin / des Vollmachtgebers', {
    size: 8, color: grau, gap: 14,
  });

  // ── Hinweise ─────────────────────────────────────────────────────────────
  platz(62);
  zeile('Hinweise', { font: bold, size: 9.5, gap: 8 });
  for (const h of hinweise()) absatz(`— ${h}`, { size: 8, gap: 1, color: grau });

  // ── Fußzeile auf jeder Seite ─────────────────────────────────────────────
  const fuss = m
    ? 'Online erteilte Vollmacht. Unterschrift im Browser gezeichnet, mit Datum gespeichert.'
    : 'Bitte ausdrucken, ausfüllen und unterschreiben.';
  for (const p of doc.getPages()) {
    p.drawText(fuss, { x: MARGIN, y: MARGIN - 18, size: 7.5, font, color: grau });
  }

  return doc.save();
}
