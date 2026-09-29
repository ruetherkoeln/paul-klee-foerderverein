# Zugangsbereiche und ihre Absicherung

Diese Site hat drei Bereiche, die nicht für die Allgemeinheit bestimmt sind.
Was sie schützt und woran zu denken ist, wenn daran gearbeitet wird.

## Die drei Bereiche

| Bereich | Adresse | Wer | Zugang über |
|---|---|---|---|
| Unterlagen der Mitgliederversammlung | `/mv2026/` | Mitglieder | Formular + Cookie (`MV_PASSWORT`) |
| Mitgliederliste als CSV | `/api/export` | Vorstand | Basic Auth (`EXPORT_USER` / `EXPORT_PASSWORT`) |
| SEPA-Mandate im Klartext | `/api/export-bank` | Vorstand / Bank | Basic Auth (`EXPORT_BANK_USER` / `EXPORT_BANK_PASSWORT`) |

Getrennte Zugangsdaten für die beiden Exporte sind Absicht: Die Bankdaten
sind die empfindlichste Sammlung, die dieser Verein hat. Wer die
Mitgliederliste braucht, braucht nicht auch die IBANs.

## Warum die Unterlagen nicht unter `public/` liegen

Alles unter `public/` liefert Vercel ohne jede Prüfung aus. Ein Passwort
davor wäre wirkungslos, sobald jemand die Adresse kennt. Die Unterlagen
liegen deshalb unter `src/dokumente/mv2026/` und werden beim Bauen über das
virtuelle Modul `virtual:mv-unterlagen` (siehe `astro.config.mjs`) in die
Serverfunktion eingebettet. Herausgegeben werden sie nur über
`/mv2026/datei/[name]`, die das Cookie prüft und ausschliesslich in der Liste
der eingebetteten Dateien nachschlägt — Pfade werden nirgends zusammengesetzt,
`..` läuft also ins Leere.

**Eine neue Unterlage gehört in `src/dokumente/mv2026/`, niemals nach
`public/`.**

## Was gegen Angriffe eingebaut ist

**Durchprobieren von Passwörtern.** `src/lib/login-schutz.ts` zählt
Fehlversuche je Herkunft in einem gleitenden Fenster (`src/data/sicherheit.ts`:
acht Versuche in fünfzehn Minuten). Danach ist für diese Herkunft Schluss.
Gespeichert wird nur ein Hash der IP-Adresse, nie die Adresse selbst.
Zusätzlich bremst jeder Fehlversuch um 600 ms.

Bei den Basic-Auth-Routen wird nur gezählt, wenn überhaupt Zugangsdaten
mitkamen — die erste Anfrage eines Browsers kommt immer ohne, und die ist
kein Fehlversuch, sondern der Auftakt des Dialogs.

Ist die Datenbank nicht erreichbar, wird **nicht** gesperrt. Eine Störung bei
Neon würde sonst den geschützten Bereich lahmlegen; der Schaden wäre grösser
als der Gewinn.

**Cross-Site Request Forgery.** Astros eigener `checkOrigin` ist aus, weil er
auf Vercel gegen den internen Host (`localhost`) prüft und damit auch echte
Formulare abweisen würde. Stattdessen prüft `originErlaubt()` in
`src/lib/sicherheit.ts` den `Origin`- bzw. `Referer`-Header gegen
`x-forwarded-host` und `PUBLIC_SITE_URL`. Der POST auf `/mv2026/` nutzt das.

**Vergleich von Geheimnissen.** `gleichSicher()` vergleicht über SHA-256-Hashes
mit `timingSafeEqual`. Damit hat der Vergleich immer dieselbe Laufzeit *und*
dieselbe Länge — aus dem Zeitverhalten lässt sich weder das Geheimnis noch
seine Länge ablesen.

**Das Cookie.** Name `__Host-mv2026`: Der Browser nimmt ein so benanntes
Cookie nur über HTTPS, nur für den ganzen Pfad und nur ohne Domain an — keine
Nachbar-Subdomain kann eines unterschieben. Es ist `HttpOnly` und `Secure`,
trägt ein signiertes Ablaufdatum (zwölf Stunden) und einen Abdruck des
geltenden Passworts: **Wird `MV_PASSWORT` geändert, sind alle ausgegebenen
Zugänge sofort ungültig.**

`SameSite` steht bewusst auf `lax` und nicht auf `strict`: Die Mitglieder
kommen über den Link aus der Einladungsmail, und bei `strict` käme das Cookie
bei diesem ersten Klick nicht mit.

**Zwischenspeichern.** Alles hinter dem Passwort trägt
`cache-control: private, no-store`, `x-robots-tag: noindex` und
`referrer-policy: no-referrer` (`GESCHUETZT_KOPFZEILEN`). Ohne das no-store
läge eine Unterlage im Cache eines geteilten Rechners oder eines Proxys — an
der Anmeldung vorbei.

## Kopfzeilen für die ganze Site

In `vercel.json`, gültig für jede Antwort:

- **Content-Security-Policy** — Skripte und Stile nur von der eigenen Herkunft,
  Schriften von Google Fonts, Formulare nur an die eigene Site und an
  Web3Forms. `frame-ancestors 'none'` verhindert das Einbetten in fremde
  Seiten, `object-src 'none'` Plugins.
  `style-src` braucht derzeit `'unsafe-inline'`, weil an einigen Stellen
  `style="…"`-Attribute stehen. Wer die in Klassen überführt, kann es streichen.
- **Strict-Transport-Security** — ein Jahr, ohne `includeSubDomains`. Die
  Domain liegt bei IONOS und trägt dort auch die Vereins-E-Mail; Subdomains
  sollen nicht ungefragt mit erfasst werden. `preload` erst, wenn das bewusst
  entschieden ist — es ist schwer rückgängig zu machen.
- **X-Content-Type-Options**, **X-Frame-Options**, **Referrer-Policy**,
  **Cross-Origin-Opener-Policy**, **Permissions-Policy**.

Wird eine neue externe Quelle eingebunden (Karte, Video, Zählpixel, Schriftart),
muss sie in die CSP aufgenommen werden — sonst lädt sie schlicht nicht, ohne
sichtbaren Fehler auf der Seite.

## Umgebungsvariablen

Alle in Vercel, für alle Umgebungen. Keines dieser Geheimnisse gehört in das
Repository — es ist öffentlich.

| Variable | Wofür |
|---|---|
| `MV_PASSWORT` | Zugang zu `/mv2026/` |
| `MV_SIGNING_SECRET` | optional; fehlt es, wird aus `ERFASSUNG_SIGNING_SECRET` abgeleitet |
| `EXPORT_USER`, `EXPORT_PASSWORT` | Mitgliederliste |
| `EXPORT_BANK_USER`, `EXPORT_BANK_PASSWORT` | SEPA-Mandate |
| `ERFASSUNG_SIGNING_SECRET` | signierte Links, IP-Hash, abgeleitete Schlüssel |
| `ERFASSUNG_CRYPTO_KEY` | Verschlüsselung der Bankdaten (32 Byte base64) |
| `DATABASE_URL` | Neon; trägt auch die Zählung der Fehlversuche |

Passwörter erzeugen, nicht ausdenken:

```
node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))"
```

## Offen

- **Das Passwort der Mitgliederversammlung** sollte lang und zufällig sein,
  nicht `MV2026`. Es steht in der Einladung; wer es errät, braucht keinen
  Angriff.
- **`style-src 'unsafe-inline'`** liesse sich streichen, sobald die
  `style="…"`-Attribute in Klassen überführt sind.
- **Die übrigen POST-Formulare** (Mitgliedsantrag, Zuwendungsbescheinigung)
  prüfen den Origin noch nicht. Sie sind durch Honeypot, Ratenbegrenzung und
  signierte Token abgesichert, aber `originErlaubt()` wäre dort eine Zeile.
