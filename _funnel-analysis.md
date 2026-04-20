# FitonTime Blockadenlöser — Funnel-Analyse

Original-URL: https://www.fit-on-time.ch/blockadenloeser/
Funnelcockpit-ID: CE7L7Q3C77U68RGNMSQG
Quelle der Analyse: 11 HTML-Dumps unter ~/Downloads/fot-blockadenloeser-*.html

## Funnel-Map (11 Steps)

### 1. Startseite (`/blockadenloeser/`)
- Hero + CTA "Jetzt starten!"

### 2. `page_ortk25` — Single-Choice
- Frage: "Bist du beruflich sehr ausgelastet?"
- Antworten: Ja · Nein

### 3. `page_1q4wyh` — Single/Multi-Choice
- Frage: "Was hier von ist dir am wichtigsten?"
- Antworten: Besseres Aussehen · Mehr Gesundheit · Mehr Wohlbefinden (+ ggf. weitere)

### 4-6. Slider-Inputs
| Page | Slug | Wert | Range | Default | localStorage Key |
|---|---|---|---|---|---|
| 4 | page_b1zql | Größe | 145–195 cm | 165 | fot_height |
| 5 | page_rdl62 | Gewicht | 45–150 kg | 75 | fot_weight |
| 6 | page_sv386 | Alter | 18–65 J | 32 | fot_age |

### 7. `page_8p4499` — Multi-Choice
- Frage: "Was triggert dich? Was konsumierst du bei Heisshunger?"
- Antworten: Salziges Essen · Hauptsache fettig · Süsses · ist mir egal

### 8. `page_a67pr` — Multi-Choice
- Frage: "Was beschreibt dich am besten?" (Körperfett-Verteilung)
- Antworten: 3 Beschreibungen (sportlich/normal/un-sportlich)

### 9. `page_ir35dm` — Loading-Page
- Text: "Antworten werden überprüft..."
- Auto-Advance via Timeout (~2-3 s)

### 10. `page_venyk` — Opt-in Form
- Felder:
  - `fname` (text, ph: "Dein Vor- und Nachname")
  - `email` (email, ph: "Deine E-Mail")
  - `phone` (tel)
  - Checkbox: "Ich akzeptiere die Datenschutzbestimmungen"
- Submit: "Jetzt Ergebnis erfahren! ✨"
- Privacy: Link zu https://fitontime.ch/impressum-datenschutz

### 11. `/blockadenloeser/ergebnis/` — Ergebnisseite
- Headline: "👉 Dein Körper wartet nicht, warum solltest du?"
- Sektionen: Hinweis-Block, Hero, Video-Element (🎉), Garantie, CTAs
- **Keine sichtbaren Merge-Tags / Personalisierung** im HTML (kein {{name}}, {{score}})
- Footer: Impressum, Datenschutzerklärung

## Technik

- **Frontend:** Funnelcockpit (Svelte SPA, fun-* Tailwind-Präfix)
- **Quiz-State:** clientseitig, vermutlich localStorage (fot_height/weight/age)
- **Routing:** echte Page-Navigation (kein SPA-Router) — jede Page hat eigene URL
- **Personalisierung:** vermutlich serverseitig nach Submit, im HTML nicht erkennbar
- **Bilder:** keine direkten URLs in HTML (background-image via CSS)

## Astro-Nachbau (Vorschlag)

```
src/pages/abnehmpotential/
├── index.astro            # Startseite + CTA
├── 1-auslastung.astro     # Single-Choice
├── 2-prioritaet.astro     # Single-Choice
├── 3-groesse.astro        # Slider
├── 4-gewicht.astro        # Slider
├── 5-alter.astro          # Slider
├── 6-trigger.astro        # Multi-Choice
├── 7-koerperfett.astro    # Multi-Choice
├── 8-loading.astro        # Auto-Advance
├── optin.astro            # Form + Lead-Submit
└── ergebnis.astro         # Results
```

State: `sessionStorage.abnehmpotential = { auslastung, prioritaet, groesse, gewicht, alter, trigger, koerperfett }`
Auf Optin-Submit: Quiz-State + Lead-Daten an `/api/leads` POST.
Notification an: ppoetzinger@googlemail.com + FitonTime-Empfänger (TBD).
