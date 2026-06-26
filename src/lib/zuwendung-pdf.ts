// Erzeugt die Zuwendungsbescheinigung (Geldzuwendung) als PDF nach amtlichem
// Muster (§ 50 EStDV). Variable Teile kommen aus STEUER (verein-steuer.ts)
// und dem Spenden-Datensatz.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { STEUER } from '../data/verein-steuer.ts';
import { type Spende, formatEuro, euroInWorten } from './zuwendung.ts';

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 56;
const ink = rgb(0.05, 0.09, 0.16);

function deDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}
function heute(): string {
  const n = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(n.getDate())}.${p(n.getMonth() + 1)}.${n.getFullYear()}`;
}

export async function buildZuwendungsPdf(spende: Spende): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([A4.w, A4.h]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = A4.h - MARGIN;
  const x = MARGIN;
  const right = A4.w - MARGIN;
  const width = right - x;

  const line = (
    text: string,
    opts: { font?: PDFFont; size?: number; gap?: number; color?: any } = {},
  ) => {
    const f = opts.font ?? font;
    const size = opts.size ?? 10;
    page.drawText(text, { x, y, size, font: f, color: opts.color ?? ink });
    y -= (opts.gap ?? size + 4);
  };

  const wrapped = (text: string, opts: { font?: PDFFont; size?: number; lh?: number } = {}) => {
    const f = opts.font ?? font;
    const size = opts.size ?? 10;
    const lh = opts.lh ?? size + 3;
    for (const para of text.split('\n')) {
      const words = para.split(' ');
      let cur = '';
      for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (f.widthOfTextAtSize(test, size) > width && cur) {
          page.drawText(cur, { x, y, size, font: f, color: ink });
          y -= lh;
          cur = w;
        } else {
          cur = test;
        }
      }
      if (cur) {
        page.drawText(cur, { x, y, size, font: f, color: ink });
        y -= lh;
      }
    }
  };

  const rule = (gap = 10) => {
    y -= gap / 2;
    page.drawLine({ start: { x, y }, end: { x: right, y }, thickness: 0.6, color: rgb(0.8, 0.83, 0.87) });
    y -= gap / 2;
  };

  // ── Aussteller (Briefkopf) ────────────────────────────────────────────────
  line(STEUER.verein.name, { font: bold, size: 11, gap: 15 });
  line(`${STEUER.verein.strasse}, ${STEUER.verein.plz} ${STEUER.verein.ort}`, { size: 9, gap: 22 });

  // ── Titel ─────────────────────────────────────────────────────────────────
  wrapped('Bestätigung über Geldzuwendungen', { font: bold, size: 12, lh: 16 });
  y -= 2;
  wrapped(
    'im Sinne des § 10b des Einkommensteuergesetzes an eine der in § 5 Abs. 1 Nr. 9 des Körperschaftsteuergesetzes bezeichneten Körperschaften, Personenvereinigungen oder Vermögensmassen',
    { size: 9, lh: 12 },
  );
  y -= 10;
  rule(12);

  // ── Zuwendender ─────────────────────────────────────────────────────────────
  line('Name und Anschrift des Zuwendenden:', { font: bold, size: 9, gap: 14 });
  line(`${spende.vorname} ${spende.name}`, { gap: 13 });
  line(`${spende.strasse} ${spende.hausnummer}`, { gap: 13 });
  line(`${spende.plz} ${spende.ort}`, { gap: 18 });

  // ── Betrag ──────────────────────────────────────────────────────────────────
  line('Art der Zuwendung: Geldzuwendung', { font: bold, size: 9, gap: 16 });

  line('Betrag der Zuwendung – in Ziffern:', { font: bold, size: 9, gap: 13 });
  line(formatEuro(spende.betragCent), { gap: 16 });

  line('– in Buchstaben:', { font: bold, size: 9, gap: 13 });
  wrapped(euroInWorten(spende.betragCent), { lh: 13 });
  y -= 3;

  line('Tag der Zuwendung:', { font: bold, size: 9, gap: 13 });
  line(deDate(spende.datum), { gap: 18 });

  // ── Verzicht auf Aufwendungsersatz ──────────────────────────────────────────
  wrapped(
    `Es handelt sich um den Verzicht auf Erstattung von Aufwendungen:  ${spende.verzicht ? 'Ja' : 'Nein'}`,
    { font: bold, size: 9, lh: 13 },
  );
  y -= 8;
  rule(12);

  // ── Befreiungstext (je nach Bescheid-Art) ───────────────────────────────────
  const fa = STEUER.finanzamt;
  const stnr = STEUER.steuernummer;
  if (STEUER.bescheid.art === 'freistellung') {
    wrapped(
      `Wir sind wegen Förderung ${STEUER.zwecke} durch Freistellungsbescheid des ${fa}, ` +
        `StNr. ${stnr}, vom ${STEUER.bescheid.datum} für den letzten Veranlagungszeitraum ` +
        `${STEUER.bescheid.veranlagungszeitraum} nach § 5 Abs. 1 Nr. 9 des Körperschaftsteuergesetzes ` +
        `von der Körperschaftsteuer und nach § 3 Nr. 6 des Gewerbesteuergesetzes von der Gewerbesteuer befreit.`,
      { lh: 13 },
    );
  } else {
    wrapped(
      `Die Einhaltung der satzungsmäßigen Voraussetzungen nach den §§ 51, 59, 60 und 61 AO wurde vom ` +
        `${fa}, StNr. ${stnr}, mit Bescheid vom ${STEUER.bescheid.datum} nach § 60a AO gesondert festgestellt. ` +
        `Wir verfolgen nach unserer Satzung ausschließlich und unmittelbar gemeinnützige Zwecke (Förderung ${STEUER.zwecke}).`,
      { lh: 13 },
    );
  }
  y -= 8;

  wrapped(
    `Es wird bestätigt, dass die Zuwendung nur zur Förderung ${STEUER.zwecke} verwendet wird.`,
    { lh: 13 },
  );
  y -= 6;

  if (STEUER.mitgliedsbeitraege_nicht_abziehbar) {
    wrapped(
      'Es wird bestätigt, dass es sich nicht um Mitgliedsbeiträge, sonstige Mitgliedsumlagen oder ' +
        'Aufnahmegebühren handelt.',
      { lh: 13 },
    );
    y -= 6;
  }
  y -= 6;

  // ── Ort, Datum, Unterschrift ────────────────────────────────────────────────
  line(`${STEUER.verein.ort}, den ${heute()}`, { gap: 40 });

  // optionale Unterschrifts-Grafik wird in der API eingebettet (siehe unten);
  // hier nur die Linie + Name/Funktion
  page.drawLine({ start: { x, y: y + 4 }, end: { x: x + 220, y: y + 4 }, thickness: 0.6, color: rgb(0.5, 0.55, 0.6) });
  y -= 12;
  line(`${STEUER.unterschrift.name} · ${STEUER.unterschrift.funktion}`, { size: 9, gap: 24 });

  // ── Pflicht-Hinweis ─────────────────────────────────────────────────────────
  rule(10);
  const hinweisDatumSatz =
    STEUER.bescheid.art === 'freistellung'
      ? 'wenn das Datum des Freistellungsbescheides länger als 5 Jahre seit Ausstellung der Bestätigung zurückliegt'
      : 'wenn das Datum der Feststellung der Einhaltung der satzungsmäßigen Voraussetzungen nach § 60a Abs. 1 AO länger als 3 Jahre seit Ausstellung der Bestätigung zurückliegt';
  wrapped(
    'Hinweis: Wer vorsätzlich oder grob fahrlässig eine unrichtige Zuwendungsbestätigung erstellt oder ' +
      'veranlasst, dass Zuwendungen nicht zu den in der Zuwendungsbestätigung angegebenen steuerbegünstigten ' +
      'Zwecken verwendet werden, haftet für die entgangene Steuer (§ 10b Abs. 4 EStG).\n' +
      `Diese Bestätigung wird nicht als Nachweis für den Sonderausgabenabzug anerkannt, ${hinweisDatumSatz}.`,
    { size: 7.5, lh: 10 },
  );

  return await doc.save();
}
