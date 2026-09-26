// Bringt die eingebetteten Dateien mit den Angaben aus src/data/mv2026.ts
// zusammen. Nur serverseitig importieren — die Datei zieht die Unterlagen
// als base64 in das Bündel.
import { DATEIEN } from 'virtual:mv-unterlagen';
import { UNTERLAGEN, type Unterlage } from '../data/mv2026.ts';

export interface Eintrag extends Unterlage {
  vorhanden: boolean;
  groesse: number;
}

const TYPEN: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  odt: 'application/vnd.oasis.opendocument.text',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

export function inhaltstyp(datei: string): string {
  const endung = datei.split('.').pop()?.toLowerCase() ?? '';
  return TYPEN[endung] ?? 'application/octet-stream';
}

/** Aus „02-kassenbericht-2025.pdf" wird „Kassenbericht 2025". Greift nur bei
 *  Dateien, die in src/data/mv2026.ts nicht eigens benannt sind. */
function titelAusDateiname(datei: string): string {
  const ohneEndung = datei.replace(/\.[^.]+$/, '');
  const ohneNummer = ohneEndung.replace(/^\d+[-_\s]*/, '');
  const worte = ohneNummer.replace(/[-_]+/g, ' ').trim();
  return worte.charAt(0).toUpperCase() + worte.slice(1);
}

/** Erst die benannten Unterlagen in ihrer Reihenfolge, danach alles Übrige,
 *  was im Ordner liegt. */
export function eintraege(): Eintrag[] {
  const benannt = UNTERLAGEN.map((u) => ({
    ...u,
    vorhanden: Boolean(DATEIEN[u.datei]),
    groesse: DATEIEN[u.datei]?.groesse ?? 0,
  }));
  const bekannt = new Set(UNTERLAGEN.map((u) => u.datei));
  const weitere = Object.keys(DATEIEN)
    .filter((n) => !bekannt.has(n))
    .map((n) => ({
      datei: n,
      titel: titelAusDateiname(n),
      vorhanden: true,
      groesse: DATEIEN[n].groesse,
    }));
  return [...benannt, ...weitere];
}

export function datei(name: string): Buffer | null {
  const treffer = DATEIEN[name];
  return treffer ? Buffer.from(treffer.base64, 'base64') : null;
}

export function lesbareGroesse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
