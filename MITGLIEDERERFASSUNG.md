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

## 1b. Rechtsrahmen: Pro-Plan nötig (Stand 10.09.2026)

Zwei Punkte hängen an derselben Sache und sind **vor dem Scharfschalten zu klären**.

### Auftragsverarbeitungsvertrag

Vercels Data Processing Addendum muss nicht unterschrieben werden — es wird
automatisch mit dem Vertragsschluss verbindlich. Es gilt aber ausdrücklich nur für
**Enterprise- und Pro-Pläne**:

> „This Addendum applies to Vercel's Processing of Personal Data as a Processor
> under the Agreement for Customers who are on Enterprise and Pro plans."
> — <https://vercel.com/legal/dpa>

Das Projekt läuft derzeit auf **Hobby**. Damit besteht kein AVV, obwohl Art. 28 DSGVO
für die Beauftragung eines Auftragsverarbeiters einen Vertrag verlangt.

Vercel nutzt die EU-Standardvertragsklauseln von 2021 (Beschluss 2021/914). Die Liste
der Unterauftragsverarbeiter steht unter <https://security.vercel.com>; über
privacy@vercel.com kann man Änderungsmeldungen abonnieren (fünf Tage Widerspruchsfrist).

### Ausführungsregion

Die Serverless-Funktionen laufen in **iad1 (Washington, D. C.)** — Vercels
Voreinstellung. Damit würden Name, Anschrift und IBAN in den USA verarbeitet.

Die Auswahl im Dashboard unter Settings → Functions → Function Region lässt sich auf
Hobby zwar anklicken, greift aber nicht: Am 10.09.2026 wurde `fra1` gesetzt, drei
darauffolgende Deployments meldeten unverändert `"regions": ["iad1"]`. Die freie
Regionswahl ist dem Pro-Plan vorbehalten. Im Repository ist sie nicht setzbar — der
Astro-Vercel-Adapter kennt dafür keine Option.

### Konsequenz

**Der Pro-Plan (20 $/Monat) löst beides zugleich:** AVV gilt automatisch, `fra1` wird
wählbar. Nach der Erfassung lässt sich wieder auf Hobby zurückstellen.

Alternativen, falls das nicht gewollt ist:

- Nur Überweisung anbieten und auf SEPA verzichten — dann werden keine Bankdaten erhoben
- Formular außerhalb von Vercel betreiben

### Offen

- [ ] Pro-Plan gebucht, danach Function Region auf `fra1` gesetzt und ein Deployment
      geprüft (`"regions": ["fra1"]`)
- [ ] Eigener AVV mit **Neon** geklärt — die Datenbank ist ein zweiter
      Auftragsverarbeiter
- [ ] Von der Kanzlei (LEX & Tax) gegenlesen lassen. Der Punkt betrifft nicht nur diese
      Seite: Auch die Zuwendungsbescheinigung verarbeitet Namen und Anschriften über
      dieselbe Infrastruktur.

## 2. Umgebungsvariablen

Alle unter Vercel → Settings → Environment Variables, Bereich **Production**.

| Variable | Wert | Status |
|---|---|---|
| `DATABASE_URL` | setzt die Neon-Integration selbst | automatisch |
| `ERFASSUNG_AKTIV` | `true` | **von dir zu setzen** |
| `ERFASSUNG_CRYPTO_KEY` | 32 Byte, base64 — verschlüsselt IBAN und Kontoinhaber | **von dir zu setzen** |
| `ERFASSUNG_SIGNING_SECRET` | beliebige lange Zufallszeichenkette — signiert PDF-Links und salzt den IP-Hash | **von dir zu setzen** |
| `VEREIN_GLAEUBIGER_ID` | überschreibt die im Code hinterlegte Gläubiger-ID `DE63ZZZ00002943367` | nur bei Änderung nötig |
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

- [ ] Inkassovereinbarung mit der Stadtsparkasse Düsseldorf geschlossen —
      ohne sie sind die Mandate zwar wirksam, aber nicht einziehbar
- [ ] Datenschutzerklärung um die Mitgliedererfassung ergänzt
- [ ] Verarbeitungsverzeichnis nach Art. 30 DSGVO um die neue Datenbank ergänzt
- [ ] Pro-Plan, AVV und Ausführungsregion geklärt (Abschnitt 1b), Neon-Region in der EU
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
