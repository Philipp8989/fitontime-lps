// Körperalter-Karte als PNG (Konzept "Uhr zurückdrehen", gewählt 05.10.2026).
// Geht als Bild-Kopf der WhatsApp-Vorlage koerperalter_karte raus und steht verschwommen
// als Vorschau im Formular von Variante b. Zahlen kommen aus lib/koerperalter-plan.ts.
// Aufruf: /api/koerperalter-karte.png?n=Anna&q1=45-49&q2=loch&q3=nie&q4=mehr&q5=wach&q6=hoch
import type { APIRoute } from 'astro';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { plan } from '../../lib/koerperalter-plan';
import { fraunces, frauncesItalic, albert, albertSemi } from '../../lib/karte-fonts';

export const prerender = false;

const C = { cream: '#f7f2e9', bright: '#fffdf9', ink: '#211c17', soft: '#4f463d', gold: '#b08a52', line: '#d8cdbf' };
const W = 1080;
const H = 1350;

const font = (b64: string) => Buffer.from(b64, 'base64');
const FONTS = [
  { name: 'Fraunces', data: font(fraunces), weight: 400 as const, style: 'normal' as const },
  { name: 'Fraunces', data: font(frauncesItalic), weight: 400 as const, style: 'italic' as const },
  { name: 'Albert', data: font(albert), weight: 400 as const, style: 'normal' as const },
  { name: 'Albert', data: font(albertSemi), weight: 600 as const, style: 'normal' as const },
];

// Kleiner Helfer statt JSX: satori nimmt React-artige Objekte
type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: (Node | string)[]): Node =>
  ({ type, props: { style: { display: 'flex', ...style }, children } });

const eyebrow = (t: string) =>
  h('div', { fontFamily: 'Albert', fontWeight: 600, fontSize: 24, letterSpacing: 4, color: C.gold, textTransform: 'uppercase' }, t);

// Uhr-Signet aus der Wortmarke, als Bild eingebettet
const UHR = 'data:image/svg+xml;base64,' + Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 54"><rect x="20.6" y="1" width="6.8" height="4.6" rx="1.7" fill="${C.gold}"/><rect x="22.8" y="5.2" width="2.4" height="3.6" fill="${C.gold}"/><circle cx="24" cy="31.5" r="16.3" fill="none" stroke="${C.gold}" stroke-width="2.5"/><line x1="24" y1="31.5" x2="17.8" y2="23.2" stroke="${C.ink}" stroke-width="2.5" stroke-linecap="round"/><circle cx="24" cy="31.5" r="2.3" fill="${C.ink}"/></svg>`,
).toString('base64');

function karte(p: ReturnType<typeof plan>): Node {
  const gewinn = p.jahreZurueck > 0;
  return h('div', { width: W, height: H, flexDirection: 'column', background: C.cream, padding: '72px 84px', fontFamily: 'Albert', color: C.ink },
    // Kopfzeile
    h('div', { justifyContent: 'space-between', alignItems: 'center' },
      h('div', { alignItems: 'center', fontFamily: 'Fraunces', fontSize: 34, letterSpacing: 3 },
        'FIT', { type: 'img', props: { src: UHR, width: 34, height: 38, style: { marginLeft: 10 } } },
        h('div', { fontStyle: 'italic', fontSize: 22, color: C.gold, marginRight: 10, marginTop: 14 }, 'n'), 'TIME'),
      eyebrow('Körperalter-Test')),
    // Zahlen
    h('div', { marginTop: 60, fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 44, color: C.soft },
      p.name ? `${p.name}, dein Körperalter` : 'Dein Körperalter'),
    h('div', { marginTop: 18, alignItems: 'flex-end', justifyContent: 'space-between' },
      h('div', { flexDirection: 'column' },
        h('div', { fontFamily: 'Fraunces', fontSize: 250, lineHeight: 0.9 }, String(p.koerperalter)),
        h('div', { fontSize: 28, color: C.soft, marginTop: 14 }, 'heute')),
      h('div', { flexDirection: 'column', alignItems: 'center', flexGrow: 1, margin: '0 36px 74px' },
        h('div', { fontSize: 28, fontWeight: 600, color: C.gold, marginBottom: 16 },
          gewinn ? `${p.jahreZurueck} Jahre zurück` : 'halten'),
        h('div', { width: '100%', height: 3, background: C.gold }),
      ),
      h('div', { flexDirection: 'column', alignItems: 'flex-end' },
        h('div', { fontFamily: 'Fraunces', fontSize: 250, lineHeight: 0.9, color: C.gold }, String(p.zielAlter)),
        h('div', { fontSize: 28, color: C.soft, marginTop: 14 }, 'möglich'))),
    // Hebel
    h('div', { marginTop: 54, flexDirection: 'column' },
      eyebrow(p.hebel.length > 1 ? 'Deine zwei Hebel' : 'Dein Hebel'),
      h('div', { flexDirection: 'column', marginTop: 18, borderTop: `1px solid ${C.line}` },
        ...p.hebel.map((x) => h('div', { justifyContent: 'space-between', alignItems: 'baseline', padding: '20px 0', borderBottom: `1px solid ${C.line}` },
          h('div', { fontFamily: 'Fraunces', fontSize: 44 }, x.titel),
          h('div', { fontSize: 30, fontWeight: 600, color: C.gold }, x.jahre > 0 ? `${x.jahre} ${x.jahre === 1 ? 'Jahr' : 'Jahre'}` : ''))))),
    // Schritte
    h('div', { marginTop: 46, flexDirection: 'column' },
      eyebrow('Deine ersten 14 Tage'),
      ...p.schritte.map((s, i) => h('div', { marginTop: 22, alignItems: 'flex-start' },
        h('div', { fontFamily: 'Fraunces', fontSize: 40, color: C.gold, width: 52, lineHeight: 1.1 }, String(i + 1)),
        h('div', { fontSize: 30, lineHeight: 1.36, color: C.ink, flex: 1 }, s)))),
    // Fuss
    h('div', { marginTop: 'auto', paddingTop: 28, fontSize: 21, color: C.soft },
      'Eine Einschätzung aus deinen Antworten, kein medizinischer Wert.'),
  );
}

export const GET: APIRoute = async ({ url }) => {
  const q = Object.fromEntries(url.searchParams);
  const svg = await satori(karte(plan(q, q.n || '')) as never, { width: W, height: H, fonts: FONTS });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  return new Response(png, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
