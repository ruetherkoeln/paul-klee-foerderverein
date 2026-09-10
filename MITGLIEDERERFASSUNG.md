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

## 1b. Rechtsrahmen (Stand 10.09.2026)

> **Entscheidung des Vorstands vom 10.09.2026:** Der Verein bleibt vorerst auf dem
> Hobby-Plan und nimmt die Verarbeitung in den USA in Kauf. Die beiden Punkte unten
> sind damit bekannt und bewusst hingenommen, nicht übersehen.

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

### Was daraus folgt

Der **Pro-Plan (20 $/Monat) würde beides zugleich lösen** — AVV gilt dann automatisch,
`fra1` wird wählbar, und nach der Erfassung ließe sich wieder auf Hobby zurückstellen.
Das bleibt der Weg, falls die Entscheidung später revidiert wird.

Solange es bei Hobby bleibt, ergibt sich daraus vor allem eine **Pflicht zur
Transparenz**: Nach Art. 13 Abs. 1 lit. f DSGVO muss die Datenschutzerklärung die
Übermittlung in ein Drittland benennen. Der entsprechende Absatz ist zu ergänzen,
bevor die Erfassung freigeschaltet wird.

### Offen

- [x] Datenschutzerklärung um den Hinweis auf die Verarbeitung in den USA ergänzen —
      Ziffer 5 benennt jetzt ausdrücklich die Ausführung in Washington, D. C.
- [ ] **Widerspruch in Ziffer 2 der Datenschutzerklärung auflösen.** Dort steht
      „Mit dem Hoster besteht ein Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO)".
      Auf dem Hobby-Plan trifft das nach Vercels eigenem DPA nicht zu (siehe oben).
      Entweder Pro-Plan buchen — dann stimmt der Satz — oder den Satz streichen.
      Der Satz stand schon vor dieser Seite dort und betrifft auch die
      Zuwendungsbescheinigung; deshalb hier bewusst nicht im Vorbeigehen geändert.
- [ ] Eigener AVV mit **Neon** geklärt — die Datenbank ist ein zweiter
      Auftragsverarbeiter
- [ ] Von der Kanzlei (LEX & Tax) gegenlesen lassen. Der Punkt betrifft nicht nur diese
      Seite: Auch die Zuwendungsbescheinigung verarbeitet Namen und Anschriften über
      dieselbe Infrastruktur.

## 2. Umgebungsvariablen

Alle unter Vercel → Settings → Environment Variables. Beim Anlegen **beide**
Umgebungen ankreuzen: **Production** *und* **Preview**.

> **Warum Preview mitzählt.** Solange die Arbeit in einem Pull Request liegt, ist die
> erreichbare Adresse ein Preview-Deployment — die Produktionsdomain kennt die Seite
> noch gar nicht (404). Variablen, die nur für Production gelten, kommen dort nicht an:
> Der Schalter `ERFASSUNG_AKTIV` bleibt leer, und die Seite zeigt „Die Erfassung ist
> derzeit nicht geöffnet". Genau das war am 10.09.2026 der Fall — die Diagnosezeile
> meldete auf dem Preview nur `DATABASE_URL, RESEND_API_KEY`, weil diese beiden von
> Integrationen für alle Umgebungen gesetzt werden, die übrigen dagegen von Hand nur
> für Production.
>
> Zum Testen vor dem Merge müssen die Variablen also auch für Preview gelten. Wer die
> Testdaten nicht in der Produktionsdatenbank haben will, legt für Preview eine eigene
> `DATABASE_URL` an; sonst genügt es, bei jeder Variablen beide Haken zu setzen.


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
| `PUBLIC_SITE_URL` | **nicht setzen.** Nur ein Rückfallwert; die Basis-URL kommt aus den `x-forwarded-host`-Headern. Gesetzt würde er Vorschau-Deployments auf die Produktionsdomain umleiten. Das Präfix `PUBLIC_` ist zudem eine Astro-Konvention für browserseitig sichtbare Werte, worauf Vercel zu Recht hinweist. | — |

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
- [x] Datenschutzerklärung um die Mitgliedererfassung ergänzt — Ziffer 4 d) listet
      die erhobenen Felder, die Rechtsgrundlagen und das Widerrufsrecht, Ziffer 7 die
      Speicherdauer der Bankdaten
- [ ] Verarbeitungsverzeichnis nach Art. 30 DSGVO um die neue Datenbank ergänzt
- [x] Datenschutzerklärung um den Drittlandhinweis ergänzt (Abschnitt 1b)
- [x] Neon-Region als EU bestätigt — die Diagnosezeile auf `/mitglied-werden` meldet
      am 10.09.2026 `eu-central-1` (Frankfurt). Die Datenbank liegt in der EU, die
      Funktionen laufen weiterhin in `iad1`.
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
