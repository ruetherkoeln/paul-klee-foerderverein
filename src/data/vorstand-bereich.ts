// Einstellungen des Vorstandsbereichs (/vorstand/).

// Zeitraum für „Neue Anträge und Austritte" auf der Übersicht.
export const BEWEGUNGEN_TAGE = 90;

// Obergrenze je Dokument. Vercel nimmt je Anfrage höchstens 4,5 MB an;
// 4 MB lassen Luft für den Rest des Formulars.
export const MAX_BYTES = 4 * 1024 * 1024;

// Erlaubte Dateien beim Hochladen — Endung → Inhaltstyp. Bewusst kein HTML,
// SVG oder Ähnliches, das der Browser als Seite ausführen könnte.
export const DOKUMENT_TYPEN: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  odt: 'application/vnd.oasis.opendocument.text',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  csv: 'text/csv; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};
