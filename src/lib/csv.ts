// CSV für Excel: Semikolon als Trennzeichen, UTF-8 mit BOM, CRLF.
// Ohne BOM zeigt Excel unter Windows Umlaute als Zeichensalat.
export function csvFeld(wert: unknown): string {
  const s = wert === null || wert === undefined ? '' : String(wert);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvDokument(kopf: string[], zeilen: unknown[][]): string {
  const alle = [kopf, ...zeilen].map((z) => z.map(csvFeld).join(';')).join('\r\n');
  return `﻿${alle}\r\n`;
}

/** ISO-Zeitstempel → 10.09.2026 */
export function deDatum(wert: unknown): string {
  if (!wert) return '';
  const d = new Date(wert as string);
  if (Number.isNaN(d.getTime())) return '';
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}
