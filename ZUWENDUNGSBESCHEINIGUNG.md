# Zuwendungsbescheinigung – Setup & Go-Live

Automatische Spendenquittungen: Spender füllt das Formular aus → der Vorstand
prüft den Kontoeingang und gibt per Klick frei → das PDF (amtliches Muster)
geht an den Spender, Kopie an den Verein.

## Ablauf (ohne Datenbank)

1. `/spenden/bescheinigung` – Formular für den Spender.
2. `POST /api/zuwendung/anfordern` – signiert die Eingaben (HMAC) und mailt dem
   **Vorstand** einen Freigabe-Link. Es wird hier noch nichts ausgestellt.
3. `GET /api/zuwendung/freigeben?token=…` – Vorschau für den Vorstand.
   Erst der **POST** (Button „Jetzt senden") erzeugt das PDF und versendet es.

Die Spendendaten liegen ausschließlich im signierten Link (30 Tage gültig) –
keine Datenspeicherung nötig.

## Sicherheits-Schalter

In `src/data/verein-steuer.ts`:

```ts
AUSSTELLUNG_AKTIV: false
```

Bleibt **false**, bis die Gemeinnützigkeit wiederhergestellt ist und der gültige
Freistellungsbescheid vorliegt. Bei `false` zeigt das Formular einen Hinweis und
die API stellt nichts aus. Zum Scharfschalten auf `true` setzen und deployen.

## Vor Go-Live ausfüllen (verein-steuer.ts)

- `finanzamt`, `steuernummer` – ✅ bereits eingetragen
- `bescheid.art` – `'freistellung'` oder `'feststellung'` (§ 60a)
- `bescheid.datum`, `bescheid.veranlagungszeitraum` – ⚠️ Platzhalter, aus dem
  **gültigen** Freistellungsbescheid übernehmen
- `zwecke` – Genitiv-Phrase nach „Förderung", z. B. „der Erziehung, …"
- `unterschrift.name`, `unterschrift.funktion` – ⚠️ Platzhalter

> Den finalen Wortlaut bitte von der Steuerberatung gegenprüfen lassen.

## Environment-Variablen (Vercel → Project → Settings → Environment Variables)

| Variable | Zweck |
|---|---|
| `RESEND_API_KEY` | Resend API-Key (Mailversand) |
| `MAIL_FROM` | Absender, z. B. `Förderverein Paul-Klee-Schule <spenden@pks-foerderverein.de>` |
| `VORSTAND_EMAIL` | Empfänger der Freigabe-Anfrage |
| `VEREIN_KOPIE_EMAIL` | Kopie-Empfänger der fertigen Bescheinigung (Buchhaltung) |
| `ZUWENDUNG_SIGNING_SECRET` | langer Zufallswert zum Signieren der Tokens |
| `PUBLIC_SITE_URL` | optional, Basis-URL für die Links (sonst aus Request) |

**Resend:** Domain `pks-foerderverein.de` verifizieren (DNS-Records) und einen
API-Key anlegen. Solange nicht verifiziert, kommen Mails nicht zuverlässig an.

`ZUWENDUNG_SIGNING_SECRET` erzeugen, z. B.:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Lokal testen

```sh
ZUWENDUNG_SIGNING_SECRET=test npm run build
```
