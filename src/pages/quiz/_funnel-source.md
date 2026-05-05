# /quiz Funnel — 1:1 Copy von go.fit-on-time.ch

**Quelle:** https://go.fit-on-time.ch/ (FunnelCockpit)
**Stand:** 2026-05-05
**Page-Title (Browser-Tab):** 📌 60-Sekunden-Quiz
**Meta-Title (im fitontime-lps):** Welcher Stoffwechsel-Typ bist du? In 60 Sekunden | Fit on Time

## Layout (eine Single-Page, kein Redirect)

Original ist EINE Seite mit zwei Section-Rows. Nach Q9 (data-target="result") gibt es KEINE separate Result-URL, der User sieht einfach den Rest der Seite (Filip-Block + Footer). Beide URLs (Start + "Ergebnis"), die Philipp gegeben hat, sind identisch.

### Row 1
1. Logo (1500x294, transparent PNG, mittig)
2. Spacing
3. Survey-Block (siehe unten)
4. "Mit dieser Methode kannst du herausfinden:" (H2-style, color #333, 30px)
5. 💥 Wie du abnehmen kannst ohne Veränderungen
6. ⏰ Wie du abnehmen kannst ohne viel Zeit aufzuwenden
7. 🍽️ Wie du langfristig abnehmen kannst ohne Verzicht
8. 💁‍♀️ Wie du dich wohlfühlen kannst im eigenen Körper
9. 🎉 Wie du Abnehmen kannst ohne Jojo-Effekt

### Row 2
1. Filip-Foto (rund, 250px max-width, JPEG 1125x1122)
2. Testimonials-Quote: "Mit diesem 60-Sekunden-Quiz kannst du sehen, ob dein Stoffwechsel 'eingeschlafen' ist oder nicht."
3. Signatur-Block (font-size 15px, color #333):
   - Filip Mursic
   - Gründer der ZSU-Strategie
   - 60-Sekunden-Quiz »
4. Spacing
5. Logo (gleich wie oben)
6. Footer: Impressum | Datenschutz (links zu fitontime.ch/impressum-datenschutz, target=_blank)

## Survey-Konfiguration

Padding um Survey original: padding-left 300px, padding-right 300px (Desktop), 20px bottom.
Über dem Survey: striped Progress-Bar (10/20/30/.../90%) + "Über 1571 Ergebnisse berechnet..." Label.

## 9 Fragen (data-id, Headline, Antworten)

| # | data-id | Headline | Antworten |
|---|---|---|---|
| 1 | to9S8h8z | "60 Sekunden Stoffwechsel-Quiz: Finde mit diesen 9 Fragen in nur 60 Sekunden heraus, ob du langfristig abnehmen kannst, ohne Verzicht oder JoJo-Effekt. Klicke dich durch die Fragen, um dein Ergebnis direkt anzeigen zu lassen. 1. Hast du oft Appetit?" | Ja / Nein |
| 2 | N6tr48EQ | "Frage 2 von 9 — Fühlst du dich schlapp am Morgen?" | Ja / Nein |
| 3 | kakHw9zu | "Frage 3 von 9 — Bist du frustriert wenn du an 'abnehmen' denkst?" | Ja / Nein |
| 4 | wagMEm5w | "Frage 4 von 9 — Wie viel würdest du gerne abnehmen?" | Mehr als 10 Kilogramm / Weniger als 10 Kilogramm |
| 5 | 2dJxpFWa | "Frage 5 von 9 — Hast du bereits versucht abzunehmen?" | Ja, öfter / Nein, noch nicht |
| 6 | nxmDebKQ | "Frage 6 von 9 — Hast du gesundheitliche Einschränkungen?" | Ja / Nein |
| 7 | y2v9i3pX | "Frage 7 von 9 — Wähle bitte aus, was dir am Wichtigsten ist!" | Mehr Gesundheit / Besser aussehen / Mehr Zufriedenheit / Kein JoJo-Effekt |
| 8 | 4j2Ex2eG | "Frage 8 von 9 — Wie früh stehst du morgens auf?" | Vor 7:00 Uhr / Nach 07:00 Uhr |
| 9 | Fkg5m5BQ | "Frage 9 von 9 — Ist dir schon klar, was du ändern musst um gesund abzunehmen, OHNE Jojo-Effekt?" | Ja / Nein (target=result) |

## Assets (downloaded → `public/quiz/`)

- `logo.png` — top + bottom Logo, original 1500x294 → `public/quiz/logo.png`
- `filip-mursic.jpg` — Founder Photo, original 1125x1122 → `public/quiz/filip-mursic.jpg`

## Stil

- Font: Lato (Google Webfont, weight 400)
- Body bg: #ffffff
- Body color: #000000
- Survey-answer-inner bg: #333, color: #fff, border-radius 6px
- Progress-bar: gestreift (lineargradient(45deg, rgba(255,255,255,0.18) 25%, transparent 25%, ...))

## Verhalten

- Auto-Advance nach Klick auf Antwort (no "Nächster Schritt" Button needed, der ist eh hidden via display:none in survey-answer-button class)
- Hash-Routing: location.hash = `survey-question-<dataId>` pro Step
- Q9 "result" target: keine Redirect-Action, der User scrollt zur Filip-Section unten (oder bleibt einfach auf der Seite, da Filip-Section bereits below-the-fold sichtbar)
