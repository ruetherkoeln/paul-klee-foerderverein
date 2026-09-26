import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Unterlagen der Mitgliederversammlung ────────────────────────────────────
// Die Dateien liegen bewusst NICHT unter public/. Alles dort wird von Vercel
// unmittelbar ausgeliefert — das Passwort waere wirkungslos, sobald jemand die
// Adresse kennt. Stattdessen werden sie hier beim Bauen in das Serverbuendel
// eingebettet und nur ueber eine Route herausgegeben, die das Merkmal prueft.
//
// Eingebettet statt zur Laufzeit gelesen, weil der Pfad im gebauten Buendel
// auf Vercel nicht verlaesslich derselbe ist wie im Projekt.
const MV_ORDNER = fileURLToPath(new URL('./src/dokumente/mv2026/', import.meta.url));

// Nur Dokumente aufnehmen. So kann im Ordner eine Handreichung liegen, ohne
// dass sie auf der Seite als Unterlage auftaucht.
const ERLAUBT = /\.(pdf|docx?|odt|xlsx?|jpe?g|png)$/i;

function mvUnterlagen() {
  const KENNUNG = 'virtual:mv-unterlagen';
  const AUFGELOEST = '\0' + KENNUNG;
  return {
    name: 'mv-unterlagen',
    resolveId: (id) => (id === KENNUNG ? AUFGELOEST : null),
    load(id) {
      if (id !== AUFGELOEST) return null;
      let namen = [];
      if (fs.existsSync(MV_ORDNER)) {
        namen = fs.readdirSync(MV_ORDNER)
          .filter((n) => ERLAUBT.test(n) && fs.statSync(path.join(MV_ORDNER, n)).isFile())
          .sort();
      }
      const eintraege = namen.map((n) => {
        const roh = fs.readFileSync(path.join(MV_ORDNER, n));
        return `${JSON.stringify(n)}: { groesse: ${roh.length}, base64: ${JSON.stringify(roh.toString('base64'))} }`;
      });
      return `export const DATEIEN = {\n${eintraege.join(',\n')}\n};\n`;
    },
  };
}

export default defineConfig({
  site: 'https://www.pks-foerderverein.de',
  integrations: [tailwind()],
  // Site bleibt statisch; einzelne API-Routen rendern serverseitig
  // (export const prerender = false) — dafür der Vercel-Adapter.
  output: 'static',
  adapter: vercel(),
  // Astros CSRF-Origin-Check vergleicht gegen den internen Request-Host
  // (auf Vercel = localhost) und würde dadurch auch echte Formular-POSTs
  // mit 403 abweisen. Absicherung erfolgt hier über Honeypot + die
  // signierte Vorstands-Freigabe (Token), daher Check aus.
  security: { checkOrigin: false },
  vite: { plugins: [mvUnterlagen()] },
});
