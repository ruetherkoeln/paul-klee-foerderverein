// Zugang zum geschützten Bereich der außerordentlichen Mitgliederversammlung.
// Die Mechanik steht in zugang.ts; hier nur die Einstellungen dieses Bereichs.
import { zugang } from './zugang.ts';

const MV = zugang({
  cookie: '__Host-mv2026',
  passwortVar: 'MV_PASSWORT',
  geheimnisVar: 'MV_SIGNING_SECRET',
  zweck: 'mv2026-zugang',
  // sameSite bleibt "lax" und wird nicht auf "strict" gezogen: Die Mitglieder
  // kommen über den Link aus der Einladungsmail. Bei "strict" käme das Cookie
  // bei diesem ersten Klick nicht mit und alle stünden erneut vor dem Formular.
  // Für einen Lesezugriff auf Unterlagen ist "lax" der richtige Schnitt.
  sameSite: 'lax',
  gueltigMs: 1000 * 60 * 60 * 12,
});

export const { COOKIE, COOKIE_OPTIONEN, passwortStimmt, merkmalErzeugen, merkmalGueltig } = MV;
