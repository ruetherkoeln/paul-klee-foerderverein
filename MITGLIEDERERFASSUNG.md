# Digitale Erfassung des Mitgliederbestands

Befristete Seite unter `/mitglied-werden`, über die angeschriebene Mitglieder ihre
Daten selbst eintragen. Läuft bis **30.11.2026** (`ERFASSUNG.ENDE` in
`src/data/erfassung.ts`); danach zeigt die Route automatisch eine Hinweisseite.

Die Seite trägt `noindex, nofollow` und ist nur über den pinken Button im Header
erreichbar.

## 1. Datenbank einrichten (einmalig)

1. Vercel-Dashboard → Projekt `paul-klee-foerderverein` → **Storage** → **Create Database**
2. **Neon (Postgres)** aus dem Marketplace wählen, Region **Frankfurt (eu-central-1)** —
   personenbezogene Daten bleiben damit in der EU
3. Plan **Free** genügt: 0,5 GB. Der erwartete Bestand liegt bei rund 90 Datensätzen.
4. Nach dem Anlegen setzt Vercel `DATABASE_URL` automatisch als Umgebungsvariable.

Die Tabellen legt der Code beim ersten Absenden selbst an
(`schemaSicherstellen()` in `src/lib/erfassung-db.ts`) — kein Migrationsschritt nötig.

| Tabelle | Zweck |
|---|---|
| `mitglieder_erfassung` | die Eintragungen |
| `erfassung_zaehler` | fortlaufende Mandatsreferenz je Jahr |
| `erfassung_ratelimit` | Absendeversuche je IP-Hash |

## 1b. Ausführungsregion auf Frankfurt stellen (wichtig)

Die Serverless-Funktionen des Projekts laufen derzeit in **iad1 (Washington, D. C.)** —
das ist Vercels Voreinstellung. Damit würden Name, Anschrift und IBAN der Mitglieder
in den USA verarbeitet.

Vercel-Dashboard → Projekt → **Settings → Functions → Function Region** →
**Frankfurt (fra1)** wählen, danach einmal neu deployen. Die Region lässt sich nicht
im Repository setzen; der Astro-Vercel-Adapter kennt dafür keine Option.

Anschließend im Deployment prüfen: `"regions": ["fra1"]`.

## 2. Umgebungsvariablen

Alle unter Vercel → Settings → Environment Variables, Bereich **Production**.

| Variable | Wert | Status |
|---|---|---|
| `DATABASE_URL` | setzt die Neon-Integration selbst | automatisch |
| `ERFASSUNG_AKTIV` | `true` | **von dir zu setzen** |
| `ERFASSUNG_CRYPTO_KEY` | 32 Byte, base64 — verschlüsselt IBAN und Kontoinhaber | **von dir zu setzen** |
| `ERFASSUNG_SIGNING_SECRET` | beliebige lange Zufallszeichenkette — signiert PDF-Links und salzt den IP-Hash | **von dir zu setzen** |
| `VEREIN_GLAEUBIGER_ID` | Gläubiger-Identifikationsnummer der Bundesbank | **fehlt noch** |
| `VEREIN_KOPIE_EMAIL` | Empfänger der Eintragungs-Kopien, z. B. `info@pks-foerderverein.de` | **von dir zu setzen** |
| `RESEND_API_KEY` | API-Schlüssel von Resend | **von dir zu setzen** |
| `MAIL_FROM` | Absenderadresse, Domain bei Resend verifiziert | **von dir zu setzen** |
| `EXPORT_USER` / `EXPORT_PASSWORT` | Zugang zur Mitgliederliste | **von dir zu setzen** |
| `EXPORT_BANK_USER` / `EXPORT_BANK_PASSWORT` | getrennter Zugang zu den Bankdaten | **von dir zu setzen** |
| `PUBLIC_SITE_URL` | `https://www.pks-foerderverein.de` | empfohlen |

Schlüssel erzeugen:

```bash
# ERFASSUNG_CRYPTO_KEY (genau 32 Byte)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# ERFASSUNG_SIGNING_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**`ERFASSUNG_CRYPTO_KEY` sicher aufbewahren.** Geht er verloren, sind die
gespeicherten Bankdaten unwiederbringlich unlesbar — Neuerfassung wäre die einzige
Möglichkeit.

## 3. Vor dem Scharfschalten prüfen

- [ ] Gläubiger-Identifikationsnummer bei der Bundesbank beantragt und eingetragen
- [ ] Inkassovereinbarung mit der Stadtsparkasse Düsseldorf geschlossen —
      ohne sie sind die Mandate zwar wirksam, aber nicht einziehbar
- [ ] Datenschutzerklärung um die Mitgliedererfassung ergänzt
- [ ] Verarbeitungsverzeichnis nach Art. 30 DSGVO um die neue Datenbank ergänzt
- [ ] Ausführungsregion auf Frankfurt umgestellt (Abschnitt 1b) und Neon-Region in der EU
- [ ] Testeintragung durchgeführt, Bestätigungsmail und PDF geprüft

## 4. Exporte

Beide Routen fragen Benutzername und Passwort im Browser ab (Basic Auth).

| Route | Inhalt |
|---|---|
| `/api/export` | Mitgliederliste **ohne** Bankdaten, CSV für Excel |
| `/api/export-bank` | Mandatsreferenz, Kontoinhaber und IBAN im Klartext, nur SEPA-Datensätze |

CSV ist UTF-8 mit BOM und Semikolon als Trennzeichen — Excel öffnet es ohne
Zeichensalat und ohne Import-Assistent.

Die Spalten von `/api/export` folgen der Vorgabe, ergänzt um **`Empfaenger`**
(= „Vorname Nachname"). Die bestehende `Serienbriefliste_Foerderverein_Paul-Klee-Schule.xlsx`
kennt keine getrennten Vor- und Nachnamen, sondern nur ein Feld `Empfaenger` —
ohne diese Spalte gäbe es keinen Schlüssel zum Zusammenführen.

## 5. Nach dem Erfassungszeitraum

1. `ERFASSUNG_AKTIV` auf `false` setzen (oder das Enddatum abwarten)
2. Den pinken Block in `src/components/Header.astro` entfernen — er ist als
   befristete Aktion kommentiert
3. Bankdaten exportieren, bei der Bank einreichen und anschließend überlegen,
   ob die verschlüsselten Spalten in der Datenbank noch gebraucht werden
