---
site_path: /Users/philipppotzinger/Desktop/Kunden/FitonTime/fitontime-lps
fix_date: 2026-04-21
audit_ref: AUDIT.md (audit_date: 2026-04-21)
applied: 11
skipped_block: 0
skipped_stale: 0
deferred_low: 0
deferred_medium: 2
total_commits: 1
---

# Fix Report — stoffwechsel-test

**Date:** 2026-04-21
**Audit referenced:** 2026-04-21
**Summary:** 11 applied | 0 skipped | 2 deferred (MEDIUM, scope)

## Applied Fixes

- **UX-001** (HIGH) — Sticky Mobile CTA + zweite CTA nach Transformations
- **UX-002** (HIGH) — Hero-Headline jetzt als Promise ("Warum bei dir bisher keine Diät…")
- **A11Y-001** (HIGH) — aria-label auf allen Input-Feldern + Email-Trust-Hint
- **CWV-001** (HIGH) — Logo mit fetchpriority="high" preloaded, unnötige t1/t5 Preloads entfernt
- **UI-001** (HIGH) — Headline-Underline mit Gradient + Skew-Effekt, Dicke verdoppelt
- **A11Y-002** (MEDIUM) — Progress-Bar mit role="progressbar" + aria-valuenow live
- **A11Y-003** (MEDIUM) — :focus-visible global für Keyboard-User + Reduced-Motion-Respect
- **UX-003** (MEDIUM) — Scarcity-Box nach oben vor Booking-CTA verschoben
- **UX-004** (MEDIUM) — "Kein Newsletter. Nur dein Ergebnis." unter Email-Feld
- **UI-004** (MEDIUM) — Body-Cards mit stärkerem Hover-Lift, Gradient-Glow, SVG-Scale
- **A11Y-004** (LOW) — autocomplete="tel-national" präzisiert

## Deferred Findings (Manual Review)

- **UI-003** (MEDIUM) — SVG-Silhouetten ersetzen durch Frauen-Fotos/Illustrationen. Benötigt Asset-Produktion, Scope sprengt Quick-Fix.
- **UX-005** (LOW) — Teilnehmer-Stat pro Typ im Result-Hero. Benötigt Daten-Research (welche Prozente stimmen für endo/meso/ecto).

## Next Step

1. `astro build` — verify nothing broke
2. Visuelle Inspection auf `npm run dev` (läuft auf :4321)
3. Re-run `ux-ui-machine audit` nach weiteren Iterationen

## Score-Verbesserung (geschätzt)

| Dimension | Vorher | Nachher |
|---|---|---|
| UX | 72 | 88 |
| UI | 74 | 84 |
| A11y | 66 | 86 |
| CWV | 78 | 86 |
| **Overall** | **72** | **86** |
