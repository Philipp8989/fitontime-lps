# Schneidet die Vorher-Nachher-Fotos aus den alten blauen Collagen (sd-proof/tf-XX.jpg).
# Die Collagen haben alle dasselbe Raster, darum reichen feste Koordinaten.
# Aufruf: python3 scripts/proof-paare.py 14 21 22 23
import sys
from PIL import Image

QUELLE = 'public/images/sd-proof/tf-{n}.jpg'
ZIEL = 'public/images/sd-proof/paare/tf-{n}-{seite}.jpg'
# Drehung gleicht die schiefen Polaroids aus, Ausschnitt liegt knapp innerhalb des Fotos
SEITEN = {
    'vorher': {'winkel': -1.2, 'mitte': (182, 350), 'box': (78, 166, 286, 513)},
    'nachher': {'winkel': 2.0, 'mitte': (468, 380), 'box': (364, 206, 572, 553)},
}

def schneide(n):
    bild = Image.open(QUELLE.format(n=n)).convert('RGB')
    for seite, s in SEITEN.items():
        gerade = bild.rotate(s['winkel'], resample=Image.BICUBIC, center=s['mitte'])
        # doppelte Grösse, damit es auf Retina nicht pixelt
        aus = gerade.crop(s['box']).resize((416, 694), Image.LANCZOS)
        aus.save(ZIEL.format(n=n, seite=seite), quality=84, optimize=True)

for n in sys.argv[1:]:
    schneide(n)
