// Stellschrauben der Zugangssicherung — an einer Stelle, damit sich Grenzwerte
// ändern lassen, ohne die Logik anzufassen.
export const SICHERHEIT = {
  // Fehlversuche je IP im gleitenden Fenster, bevor gesperrt wird. Acht ist
  // grosszügig genug für jemanden, der das Passwort aus der Einladung
  // abtippt, und eng genug, dass Durchprobieren aussichtslos wird.
  LOGIN_MAX: 8,
  LOGIN_FENSTER_MIN: 15,

  // Kurze Pause nach jedem Fehlversuch. Bremst automatisierte Versuche schon
  // vor der Sperre, ohne dass jemand mit dem richtigen Passwort etwas merkt.
  LOGIN_BREMSE_MS: 600,
} as const;
