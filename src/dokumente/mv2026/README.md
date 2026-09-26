# Unterlagen der außerordentlichen Mitgliederversammlung 2026

Dateien, die in **diesem Ordner** liegen, erscheinen nach dem nächsten Deploy
im passwortgeschützten Bereich unter `/mv2026/`.

**Wichtig: nicht nach `public/` legen.** Alles dort wird von Vercel ohne jede
Prüfung ausgeliefert — das Passwort wäre dann wirkungslos, sobald jemand die
Adresse kennt. Diese Dateien hier werden beim Bauen in die Serverfunktion
eingebettet und nur an angemeldete Besucher herausgegeben.

## Eine Unterlage hinzufügen

1. Datei hier ablegen. Erlaubt: `pdf`, `doc`, `docx`, `odt`, `xls`, `xlsx`,
   `jpg`, `png`. Alles andere — auch diese Anleitung — wird ignoriert.
2. Committen und pushen. Der Deploy stellt sie bereit.

Der Titel wird aus dem Dateinamen gebildet: aus `02-kassenbericht-2025.pdf`
wird „Kassenbericht 2025". Eine führende Nummer steuert nur die Reihenfolge
und wird nicht angezeigt.

## Titel und Erläuterung selbst bestimmen

Wer einen eigenen Titel oder einen erklärenden Satz möchte, trägt die Datei in
`src/data/mv2026.ts` ein. Dort stehen bereits zwei Einträge — sie erscheinen
auf der Seite unter „Folgt in Kürze", solange die Datei noch fehlt:

- `einladung-tagesordnung.pdf`
- `vollmacht.pdf`

Dort stehen auch Termin, Uhrzeit und Ort der Versammlung. Sind sie ausgefüllt,
erscheinen sie im Kopf der Seite.
