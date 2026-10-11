// Abruf des Kontostands per FinTS (Vorstandsbereich). Nur Stellschrauben —
// Zugangsdaten stehen ausschliesslich in Vercel, nie hier: das Repository ist
// öffentlich.
//
// Umgebungsvariablen:
//   FINTS_PRODUKT_ID  Produktregistrierung der Deutschen Kreditwirtschaft
//   FINTS_URL         FinTS-Adresse der Sparkasse (steht in der Institutsliste,
//                     die mit der Produktregistrierung kommt)
//   FINTS_BENUTZER    Anmeldename / Legitimations-ID des Online-Bankings
//   FINTS_PIN         PIN des Online-Bankings
//   FINTS_IBAN        das Vereinskonto, dessen Stand gezeigt wird
//   CRON_SECRET       schützt den täglichen Abruf (Vercel Cron schickt ihn mit)
export const BANK = {
  name: 'Stadtsparkasse Düsseldorf',
  // Bankleitzahl der Stadtsparkasse Düsseldorf
  blz: '30050110',
  produktVersion: '1.0',

  // So lange wartet „Jetzt abrufen“ höchstens auf die Freigabe in der
  // S-pushTAN-App. Muss unter der maximalen Laufzeit der Serverfunktion
  // bleiben (astro.config.mjs: maxDuration 60 s).
  FREIGABE_WARTEN_MS: 50_000,
} as const;
