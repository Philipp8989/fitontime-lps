# Audit Summary — stoffwechsel-test LP

**Date:** 2026-04-21
**Files scanned:** 1 (stoffwechsel-test/index.astro)
**Findings:** 15 total (0 BLOCK, 5 HIGH, 8 MEDIUM, 2 LOW)
**Overall Score:** 72/100

## Top 10 Findings (by Impact)

1. **UX-001** (HIGH) — Kein Sticky-CTA beim Scrollen → Hero-CTA einzige Einstiegsstelle
2. **UX-002** (HIGH) — Hero-Headline ist Frage statt Promise → schwächere CTR
3. **A11Y-001** (HIGH) — Input-Felder ohne sichtbare Labels → WCAG 1.3.1/3.3.2
4. **CWV-001** (HIGH) — Hero-LCP ohne fetchpriority, falsche Preloads
5. **UI-001** (HIGH) — Headline-Underline zu dezent für Wow-Effekt
6. **A11Y-002** (MEDIUM) — Progress-Bar ohne role="progressbar"
7. **UI-002** (MEDIUM) — Icon-Grössen in Opt-Buttons inkonsistent
8. **A11Y-003** (MEDIUM) — Fehlendes :focus-visible auf interaktiven Elementen
9. **UI-003** (MEDIUM) — Body-Card-SVG-Silhouetten platzhalter-artig
10. **UX-003** (MEDIUM) — Scarcity erst NACH Booking-Box

## Quick Wins (trivial/small effort, HIGH/MEDIUM impact)

- **CWV-001** — fetchpriority auf Logo, unnötige Preloads raus (trivial)
- **A11Y-003** — :focus-visible global setzen (trivial)
- **A11Y-002** — ARIA-Rolle auf Progressbar (trivial)
- **UI-002** — Icon-Size fix (trivial)
- **UX-003** — Scarcity vor Booking verschieben (trivial)
- **UX-002** — Hero-Headline als Promise formulieren (trivial)
- **UX-004** — Trust-Hint unter Email-Feld (trivial)
- **A11Y-004** — autocomplete präziser (trivial)

## Score-Breakdown

| Dimension | Score | Findings |
|---|---|---|
| UX (Conversion) | 72/100 | 5 |
| UI (Visual) | 74/100 | 4 |
| A11y (WCAG 2.2) | 66/100 | 4 |
| CWV (Performance) | 78/100 | 2 |

## Interpretation

Die LP ist strukturell stark (klare Progression, klare CTAs, Tracking solide). Schwachstellen liegen in drei Bereichen: **Persistenz** (nur eine CTA-Stelle auf Landing), **Headline-Hook** (Frage statt Promise) und **A11y-Hygiene** (Labels, Focus-Ring, ARIA). Die A11y-Dimension ist am kritischsten (66/100), gerade unter BFSG ab 2025.

**Positiv:** Kein BLOCK-Finding. Keine strukturellen Umbauten nötig. Alle HIGH-Findings sind small/trivial effort.

## Next Step

`ux-ui-machine fix` wendet die 13 HIGH+MEDIUM Findings automatisch an. Danach Re-Audit für Verifikation.
