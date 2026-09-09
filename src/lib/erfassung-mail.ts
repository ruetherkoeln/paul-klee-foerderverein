// Bestätigungsmails der Mitgliederbestands-Erfassung.
// Bankdaten erscheinen hier ausschließlich maskiert (letzte vier Stellen).
import { Resend } from 'resend';
import { getEnv } from './zuwendung.ts';
import { ERFASSUNG } from '../data/erfassung.ts';
import { ibanMaskiert } from './iban.ts';

export interface MailDaten {
  vorname: string;
  nachname: string;
  strasse: string;
  plz: string;
  ort: string;
  email: string;
  telefon: string | null;
  kindName: string | null;
  klasse: string | null;
  beitragEur: number;
  zahlweise: 'sepa' | 'ueberweisung';
  mandatsreferenz: string | null;
  /** Klartext-IBAN — wird hier ausschließlich maskiert verwendet. */
  iban: string | null;
  einwilligungAnsprache: boolean;
  pdfUrl: string | null;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function zusammenfassung(d: MailDaten): string {
  const v = ERFASSUNG.verein;
  const zeilen: [string, string][] = [
    ['Name', `${d.vorname} ${d.nachname}`],
    ['Anschrift', `${d.strasse}, ${d.plz} ${d.ort}`],
    ['E-Mail', d.email],
  ];
  if (d.telefon) zeilen.push(['Telefon', d.telefon]);
  if (d.kindName) zeilen.push(['Kind', d.kindName + (d.klasse ? `, Klasse ${d.klasse}` : '')]);
  zeilen.push(['Jahresbeitrag', `${d.beitragEur},00 Euro`]);
  zeilen.push([
    'Zahlungsweise',
    d.zahlweise === 'sepa' ? 'SEPA-Lastschrift' : 'Überweisung durch mich selbst',
  ]);
  if (d.zahlweise === 'sepa') {
    zeilen.push(['Mandatsreferenz', d.mandatsreferenz ?? '—']);
    zeilen.push(['Konto', d.iban ? ibanMaskiert(d.iban) : '—']);
  } else {
    zeilen.push([
      'Bankverbindung des Vereins',
      `${ERFASSUNG.bank.institut}, ${ERFASSUNG.bank.iban}`,
    ]);
  }
  zeilen.push([
    'Einwilligung Ansprache',
    d.einwilligungAnsprache ? 'erteilt' : 'nicht erteilt',
  ]);

  const rows = zeilen
    .map(
      ([k, w]) =>
        `<tr><td style="padding:6px 14px 6px 0;color:#5b6070;vertical-align:top">${esc(k)}</td>` +
        `<td style="padding:6px 0"><strong>${esc(w)}</strong></td></tr>`,
    )
    .join('');
  return `<table style="border-collapse:collapse;font-size:14px">${rows}</table>
    <p style="font-size:12px;color:#5b6070;margin-top:22px">
      ${esc(v.name)} · ${esc(v.strasse)} · ${esc(v.plz)} ${esc(v.ort)} · ${esc(v.email)}
    </p>`;
}

function huelle(titel: string, innen: string): string {
  return `<div style="font-family:Helvetica,Arial,sans-serif;color:#0e1424;max-width:560px">
    <h2 style="font-size:19px;margin:0 0 16px">${esc(titel)}</h2>${innen}</div>`;
}

export async function sendeBestaetigung(d: MailDaten): Promise<{ ok: boolean; fehler?: string }> {
  const apiKey = getEnv('RESEND_API_KEY');
  const from = getEnv('MAIL_FROM');
  const kopie = getEnv('VEREIN_KOPIE_EMAIL');
  if (!apiKey || !from) {
    return { ok: false, fehler: 'RESEND_API_KEY oder MAIL_FROM fehlt' };
  }
  const resend = new Resend(apiKey);
  const v = ERFASSUNG.verein;

  const pdfBlock =
    d.zahlweise === 'sepa' && d.pdfUrl
      ? `<p style="font-size:14px">Ihr SEPA-Mandat als PDF:
           <a href="${d.pdfUrl}">${esc(d.pdfUrl)}</a><br>
           <span style="color:#5b6070;font-size:12px">Der Link ist 30 Tage gültig.</span></p>`
      : '';

  const anPerson = huelle(
    'Vielen Dank — Ihre Angaben sind bei uns eingegangen',
    `<p style="font-size:14px">Guten Tag ${esc(d.vorname)} ${esc(d.nachname)},</p>
     <p style="font-size:14px">wir haben Ihre Mitgliedsdaten erfasst. Hier Ihre Angaben zur Kontrolle:</p>
     ${zusammenfassung(d)}
     ${pdfBlock}
     <p style="font-size:13px;color:#5b6070">Sie können Ihre Einwilligung jederzeit formlos
       widerrufen — eine Nachricht an ${esc(v.email)} genügt.</p>`,
  );

  try {
    await resend.emails.send({
      from,
      to: d.email,
      subject: 'Ihre Mitgliedsdaten beim Förderverein Paul-Klee-Schule',
      html: anPerson,
    });
  } catch (e) {
    return { ok: false, fehler: 'Bestätigung an die Person konnte nicht versendet werden' };
  }

  if (kopie) {
    try {
      await resend.emails.send({
        from,
        to: kopie,
        subject: `Neue Eintragung: ${d.vorname} ${d.nachname} (${d.beitragEur} €, ${d.zahlweise})`,
        html: huelle('Neue Eintragung in der Mitgliedererfassung', zusammenfassung(d)),
      });
    } catch {
      // Die Kopie ist nachrangig — der Datensatz liegt bereits in der Datenbank
    }
  }
  return { ok: true };
}
