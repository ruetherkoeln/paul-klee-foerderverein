// GET /mv2026/vollmacht/formular.pdf
//
// Das leere Vollmachtsformular zum Ausdrucken. Wird bei jedem Abruf aus
// src/lib/vollmacht-text.ts erzeugt — Formular und Online-Fassung können
// deshalb nicht auseinander laufen.
//
// Hinter demselben Passwort wie der übrige Bereich: Die Unterlagen zur
// Versammlung sind den Mitgliedern vorbehalten.
import type { APIRoute } from 'astro';
import { COOKIE, merkmalGueltig } from '../../../lib/mv2026.ts';
import { buildVollmachtPdf } from '../../../lib/vollmacht-pdf.ts';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, redirect }) => {
  if (!merkmalGueltig(cookies.get(COOKIE)?.value)) return redirect('/mv2026/', 303);

  try {
    const pdf = await buildVollmachtPdf(null);
    return new Response(Buffer.from(pdf), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="Vollmacht-Mitgliederversammlung-09-11-2026.pdf"',
        // Kein Zwischenspeicher: Die Datei liegt hinter einem Passwort.
        'cache-control': 'private, no-store',
        'x-robots-tag': 'noindex, nofollow',
      },
    });
  } catch (e) {
    console.error('Vollmacht-Formular:', (e as Error).message);
    return new Response('Das Formular konnte nicht erzeugt werden.', {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
};
