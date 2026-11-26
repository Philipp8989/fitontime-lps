"""Baut src/data/kundinnen-erfolge.json aus Fabians Kundinnen-Liste (xlsx).

Aufruf: python3 -I scripts/kundinnen-erfolge.py ~/Downloads/Kunden_FoT.xlsx
Erwartete Spalten: Alter, Grösse, Gewicht, Erzieltes Gewicht, Beruf (optional: Wochen).
Ins Repo kommt nur die reduzierte Fassung: Zahlen plus grobe Berufsgruppe, kein Freitext,
damit sich keine Kundin über einen seltenen Beruf wiedererkennen lässt.
"""
import json, re, sys, zipfile, xml.etree.ElementTree as ET
from pathlib import Path

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'

# Reihenfolge zählt: erster Treffer gewinnt ("Kauffrau und Hausfrau" landet bei Büro)
BERUFE = [
    ('pension', r'pension|rentner|retner|ruhestand|\bahv\b'),
    ('pflege', r'pfleg|fage|fachfrau gesundheit|fachangestellte gesundheit|\bmpa\b|mtra|arzt|praxis|spital|podolog|physio|masseu|dental|zahn|apothek|hebamme|therap|medizin|labor|drogist|krankenschw|pfelefach|ärzt|rettungs|operationstechn|psycholog'),
    ('schule', r'lehr|kinderg|pädag|schul|unterricht|betreu|kita|erzieh|sozial|spielgruppe|\bfabe|kinder aufsicht|krippe'),
    ('gastro', r'koch|köchin|gastro|gastgeb|küche|hotel|restaur|service|patron'),
    ('verkauf', r'verk|detailhandel|retail|kasse|coop|migros|aussendienst|filial|kassier'),
    ('buero', r'büro|kauf|sachbearb|verwalt|buchhalt|sekret|admin|treuhand|assist|finanz|versicherung|bank|informatik|manager|personal|hr\b|marketing|projekt|empfang|disponent|logistik|\bkv\b|kfm|reise|immobilien|steuer|compliance|quality|kommunikat|\bceo\b|\bcoo\b|geschäftsleit|schadeninsp'),
    ('koerper', r'reinig|körperlich|bäuer|landwirt|post|chauffeu|hauswirtschaft|wäsch|produktion|lager|maler|zustell|tier|gärtner|coiff|floris|milch|textil|fabrik|montage|haushalt|hauswart|metzger|mechanik|fahrer|verträger|materialwart'),
    ('selbst', r'selbst|inhaber|eigene'),
    ('familie', r'hausfr|hausfau|mutter|familie|mama|mami'),
]

def zeilen(pfad):
    with zipfile.ZipFile(pfad) as z:
        ss = [''.join(t.text or '' for t in si.iter(NS + 't'))
              for si in ET.fromstring(z.read('xl/sharedStrings.xml'))]
        blatt = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    for r in blatt.iter(NS + 'row'):
        z = {}
        for c in r:
            spalte = re.match(r'[A-Z]+', c.get('r')).group()
            v = c.find(NS + 'v')
            wert = '' if v is None else v.text
            if c.get('t') == 's':
                wert = ss[int(wert)]
            z[spalte] = wert
        yield z

def beruf_gruppe(text):
    t = (text or '').lower()
    for key, muster in BERUFE:
        if re.search(muster, t):
            return key
    return None

def main(pfad):
    it = zeilen(pfad)
    kopf = next(it)
    idx = {name.strip(): sp for sp, name in kopf.items()}
    def feld(z, name):
        return z.get(idx.get(name, '?'), '')
    daten, verworfen, ohne_beruf = [], 0, []
    for z in it:
        try:
            alter = int(float(feld(z, 'Alter')))
            gr = float(feld(z, 'Grösse'))
            start = float(feld(z, 'Gewicht'))
            ende = float(feld(z, 'Erzieltes Gewicht'))
        except ValueError:
            verworfen += 1
            continue
        if gr < 3:  # in Metern eingetragen
            gr *= 100
        # Plausibilität an der Vertrauensgrenze: Tippfehler fliegen raus statt auf die Seite
        if not (16 <= alter <= 90 and 140 <= gr <= 200 and 40 <= start <= 200 and 0 <= start - ende <= 40):
            verworfen += 1
            continue
        b = beruf_gruppe(feld(z, 'Beruf'))
        if b is None:
            ohne_beruf.append(feld(z, 'Beruf'))
        zeile = [alter, round(gr), round(start, 1), round(ende, 1), b]
        wochen = feld(z, 'Wochen')
        if wochen:
            zeile.append(round(float(wochen)))
        daten.append(zeile)
    ziel = Path(__file__).resolve().parent.parent / 'src/data/kundinnen-erfolge.json'
    ziel.write_text(json.dumps(daten, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'{len(daten)} Kundinnen geschrieben nach {ziel}, {verworfen} verworfen')
    print(f'ohne Berufsgruppe ({len(ohne_beruf)}):', sorted(set(ohne_beruf)))

if __name__ == '__main__':
    main(sys.argv[1])
