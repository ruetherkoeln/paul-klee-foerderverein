# Paul-Klee-Schule Düsseldorf — Webpräsenz

Gemeinsame Webpräsenz der Städt. Kath. Grundschule Gerresheimerstraße (Paul-Klee-Schule) und ihres Fördervereins.

## Stack
- Astro 5 (statisches Hosting)
- Tailwind CSS 3
- Vercel (Hosting + Auto-Deploy)
- Inter + Playfair Display (Webfonts)

## Lokal entwickeln

```bash
npm install
npm run dev      # Dev-Server auf http://localhost:4321
npm run build    # Produktions-Build nach dist/
npm run preview  # Preview des Builds
```

## Struktur

```
src/
  components/   - Header, Footer, ggf. weitere UI-Komponenten
  layouts/      - Base.astro (Globales Layout)
  pages/        - Seiten (1:1 Routing)
  data/         - Site-Konstanten, Navigation
  styles/       - Globale CSS / Tailwind-Schichten
public/         - Statische Assets (favicon etc.)
```

## Architektur
- Schule und Förderverein in **einer** Domain — keine Doppelpflege.
- Förderverein-Bereich unter `/foerderverein/` mit eigenem dunklem Theme (variant="verein").
- Schul-Bereich im hellen Theme (variant="school") als Default.
- Header bietet permanenten, prominenten Förderverein- und Spenden-Link.

## Branches
- `main` — Produktiv-Code (Astro-Skelett mit erstem Stand)
- `legacy-mirror` — Snapshot der alten WordPress-Seite (Migrations-/Vergleichsbasis, **nicht** publizieren)

## TODOs
- Formspree-/Form-Backend-ID in Kontakt- und Mitgliedsformular einsetzen
- PayPal-Donate-Link auf finalen Endpoint umstellen (Hosted Button ID)
- IBAN nach Vereinsregister-Eintrag in Spendenbereich ergänzen
- Bilder/Fotos der Schule (legal frei) integrieren
- Newsletter-Modul (z. B. Mailjet, Brevo) einbinden

## Hinweise
- Sensible credentials gehören in Vercel-Environment-Variables, **nicht** ins Repo.
- Inhalte aus `legacy-mirror` unterliegen Urheberrecht Dritter — nur als Migrationsbasis verwenden.

## Vorstand
Andreas Ruether (1. Vorsitzender)
