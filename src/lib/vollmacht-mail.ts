// Versand der online erteilten Abstimmungsvollmacht.
//
// Die Vollmacht geht als PDF an den Vorstand — das ist die rechtlich
// erhebliche Zustellung und muss gelingen, sonst gilt die Erklärung als nicht
// abgegeben. Die Kopie an das Mitglied ist nachrangig.
import { Resend } from 'resend';
import { getEnv } from './zuwendung.ts';
import { esc, huelle } from './erfassung-mail.ts';
import { STEUER } from '../data/verein-steuer.ts';
import { VERSAMMLUNG } from '../data/mv2026.ts';
import { BEVOLLMAECHTIGTE } from '../data/vollmacht.ts';

export interface VollmachtMailDaten {
  vorname: string;
  nachname: string;
  strasse: string;
  plz: string;
  ort: string;
  email: string;
  pdf: Uint8Array;
  dateiname: string;
}

function uebersicht(d: VollmachtMailDaten): string {
  const zeilen: [string, string][] = [
    ['Vollmachtgeber', `${d.vorname} ${d.nachname}`],
    ['Anschrift', `${d.strasse}, ${d.plz} ${d.ort}`],
    ['E-Mail', d.email],
    ['Bevollmächtigte', `${BEVOLLMAECHTIGTE.anrede} ${BEVOLLMAECHTIGTE.name}`],
    ['Weisung', 'keine — Abstimmung nach freiem Ermessen'],
    ['Versammlung', `${VERSAMMLUNG.datum}, ${VERSAMMLUNG.uhrzeit}`],
  ];
  const rows = zeilen
    .map(([k, w]) =>
      `<tr><td style="padding:6px 14px 6px 0;color:#5b6070;vertical-align:top">${esc(k)}</td>`
      + `<td style="padding:6px 0"><strong>${esc(w)}</strong></td></tr>`)
    .join('');
  return `<table style="border-collapse:collapse;font-size:14px">${rows}</table>`;
}

export async function sendeVollmacht(
  d: VollmachtMailDaten,
): Promise<{ ok: boolean; fehler?: string }> {
  const apiKey = getEnv('RESEND_API_KEY');
  const from = getEnv('MAIL_FROM');
  const vorstand = getEnv('VEREIN_KOPIE_EMAIL') ?? STEUER.kontakt.email;
  if (!apiKey || !from) return { ok: false, fehler: 'RESEND_API_KEY oder MAIL_FROM fehlt' };

  const resend = new Resend(apiKey);
  const anhang = [{
    filename: d.dateiname,
    content: Buffer.from(d.pdf).toString('base64'),
  }];

  // ── 1. An den Vorstand. Dieser Versand entscheidet über Erfolg. ──────────
  try {
    const { error } = await resend.emails.send({
      from,
      to: vorstand,
      replyTo: d.email,
      subject: `Vollmacht zur Mitgliederversammlung: ${d.vorname} ${d.nachname}`,
      html: huelle(
        'Online erteilte Vollmacht',
        `<p style="font-size:14px">Ein Mitglied hat ${esc(BEVOLLMAECHTIGTE.anrede)} `
        + `${esc(BEVOLLMAECHTIGTE.name)} eine Vollmacht ohne Weisung erteilt. `
        + 'Die unterschriebene Fassung liegt als PDF bei.</p>'
        + uebersicht(d),
      ),
      attachments: anhang,
    });
    if (error) {
      return { ok: false, fehler: `Resend lehnte die Zustellung ab: ${error.name} — ${error.message}` };
    }
  } catch {
    return { ok: false, fehler: 'Vollmacht konnte nicht an den Vorstand zugestellt werden' };
  }

  // ── 2. Kopie an das Mitglied. Scheitert sie, bleibt die Vollmacht gültig. ─
  try {
    const { error } = await resend.emails.send({
      from,
      to: d.email,
      subject: 'Ihre Vollmacht zur Mitgliederversammlung am 9. November 2026',
      html: huelle(
        'Ihre Vollmacht ist eingegangen',
        `<p style="font-size:14px">Guten Tag ${esc(d.vorname)} ${esc(d.nachname)},</p>`
        + `<p style="font-size:14px">vielen Dank. Sie haben ${esc(BEVOLLMAECHTIGTE.anrede)} `
        + `${esc(BEVOLLMAECHTIGTE.name)} bevollmächtigt, Sie in der außerordentlichen `
        + 'Mitgliederversammlung zu vertreten, ohne Weisung zum Abstimmungsverhalten. '
        + 'Ihre Vollmacht liegt dieser Nachricht als PDF bei — bitte bewahren Sie sie auf.</p>'
        + uebersicht(d)
        + '<p style="font-size:13px;color:#5b6070">Sie können die Vollmacht jederzeit '
        + `widerrufen — eine Nachricht an ${esc(STEUER.kontakt.email)} genügt. Nehmen Sie `
        + 'selbst an der Versammlung teil, erlischt sie ohnehin.</p>',
      ),
      attachments: anhang,
    });
    if (error) return { ok: true, fehler: `Kopie an das Mitglied abgelehnt: ${error.name}` };
  } catch {
    return { ok: true, fehler: 'Kopie an das Mitglied konnte nicht versendet werden' };
  }

  return { ok: true };
}
