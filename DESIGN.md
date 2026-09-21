# DESIGN.md · fitontime-lps

> Gilt für neue LPs ab 21.09.2026. Ältere Funnels (Quiz, VSL) folgen noch ihrer eigenen Optik.

## Positionierung
Fit on Time ist die ältere Schwester, die es selbst geschafft hat: Coaching für Frauen 35 bis 50 in der Schweiz, ohne Diät, ohne Spritze. Warm, ruhig, selbstbewusst.

## Referenzen (angeschaut 13.09. für bauchfett, 21.09. für partner)
1. fitontime.ch (neue Site): Cream-Grund, Fraunces mit optischer Grösse, Gold als einziger Akzent, Hairlines statt Karten.
2. basecamp.com (design-pool): Text links im Container, Zahlen und Belege in einer Zeile mit Linien.
3. 37signals.com (design-pool): Ein Angebot, ein Blatt, keine drei Preiskarten. Headline über die volle Breite.

## Richtung
editorial, warm. Heller Grund (Cream), eine dunkle Section (Ink) höchstens einmal pro Seite.

## Typo
Display: Fraunces (variabel, opsz 110, SOFT 40), Gewicht 320, H1 bis 3.8rem, Body 1.0625rem (Kontrast über 1:3.5).
Text: Albert Sans 400/500/600. Mono für Kicker und Belege: ui-monospace.
Zeilenlänge 55 bis 70 Zeichen, linksbündig. Zentriert nur Formular-Kopf und Fusszeile.

## Palette (Tokens in src/styles/bauchfett.css)
cream #f7f2e9, cream-bright #fffdf9, sand #e9decf, ink #211c17, ink-soft #4f463d, gold #b08a52, rust #b05a3c nur für Fehler.
Akzent Gold an höchstens 3 Stellen pro Viewport (Kicker, Linie, Hover).

## Raster
Container 64rem (wide) und 46rem (Text). Asymmetrie 5/7 für Kopf-plus-Blatt-Sections. Dichte wechselt: luftiger Hero, dann Fakten-Zeile mit Hairlines, dann Text.
Höchstens ein Card-Grid pro Seite, sonst Listen mit Trennlinien und Zweispalter.

## Bildsprache
Nur Frauen 35 bis 55, keine Männer, keine Kinder. Wo kein echtes Foto da ist: Typo-only (partner).

## Motion
Hover unter 200ms, keine Scroll-Effekte, keine Zähler.

## Verbote für FoT
Dunkler Default, Gradient-Text, Glassmorphism, Emoji als Icons, Checkmark-Listen, "garantiert", Krankenkassen-Claims, Konkurrenten namentlich, ß.

## Muster aus dem design-pool (partner, 21.09.)
hero/vollbreite-typo, beweis/fakten-zeile, ablauf/zeitleiste-tag (Schritte statt Uhrzeiten), preis/preisblatt (als Partner-Blatt), faq/zwei-spalten-linien.
