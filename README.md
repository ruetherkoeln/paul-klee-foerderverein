# Foerderverein Paul-Klee-Schule

Webpraesenz des Foerdervereins der Grundschule Paul-Klee, Duesseldorf.

## Status
Initiale Aufbauphase. Ziel: moderne, KI-faehige Webpraesenz mit niedrigschwelligem Zugang zu Mitgliedschaft und Spenden.

## Architektur (geplant)
- Hosting: Vercel
- Repository: GitHub
- Stack: TBD (Kandidaten: Next.js, Astro)
- Content: Headless / Markdown-basiert
- CI/CD: Auto-Deploy auf Push (main -> production, feature-branches -> preview)

## Branches
- `main` - Produktiv-Code (initial leer, Aufbau in Vorbereitung)
- `legacy-mirror` - Snapshot der Schul-Website (https://www.grundschule-paul-klee.de/) vom 2026-04-27, dient als Inhaltsbasis und Vergleichsreferenz

## Roadmap
1. Stack-Entscheidung und Skelett-Setup
2. Vercel-Deployment mit Preview-Umgebung
3. Migration der relevanten Inhalte (mit Rechte-Klaerung)
4. Module: Mitgliedschaft, Spenden (digital, niedrigschwellig, DSGVO-konform)
5. Module: Newsletter-Anmeldung, Aktionen, Projekt-Showcase
6. Domain-Konfiguration

## Hinweise
- Sensible credentials (API-Keys, SMTP, Zahlungsanbieter) gehoeren ausschliesslich in Vercel-Environment-Variables, nicht in dieses Repo.
- Inhalte aus dem `legacy-mirror`-Branch unterliegen dem Urheberrecht Dritter und duerfen nicht ohne Rechte-Klaerung uebernommen werden.

## Vorstand
Andreas Ruether (1. Vorsitzender)

## Lizenz
MIT (Code) - Inhalte separat geregelt.
