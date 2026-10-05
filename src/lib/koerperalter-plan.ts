// Körperalter-Test: aus den Quiz-Antworten den persönlichen Plan rechnen.
// Eine Quelle für Karte (api/koerperalter-karte), Sheet und Bot (api/sheets).
// Punkte und Formel MÜSSEN zur LP passen (pages/koerperalter/index.astro, nxt() und finish()).
// Treiber-Auswahl wie auf der Ergebnisseite und im Bot (fot-bot briefing.KOERPERALTER_TREIBER).

export const AGE: Record<string, [number, string]> = {
  u35: [32, 'Unter 35'], '35-39': [37, '35 bis 39'], '40-44': [42, '40 bis 44'],
  '45-49': [47, '45 bis 49'], '50-54': [52, '50 bis 54'], '55+': [58, '55+'],
};

const POINTS: Record<string, Record<string, number>> = {
  q2: { dauer: 15, loch: 11, morgens: 8, stabil: 0 },
  q3: { nie: 15, selten: 11, '1x': 6, '2x': 0 },
  q4: { mehr: 15, etwas: 10, gleich: 3, weniger: 0 },
  q5: { wach: 12, ein: 10, unausgeruht: 8, gut: 0 },
  q6: { hoch: 12, mittel: 8, selten: 4, bewusst: 0 },
};
const MAX = 15 + 15 + 15 + 12 + 12;
const SPAN = 12; // bis zu 12 Jahre über dem echten Alter

interface Treiber { k: string; bad: string[]; w: number; titel: string; schritte: [string, string]; }

// Zwei Schritte pro Treiber: der erste kommt immer, der zweite nur beim grössten Treiber.
const TREIBER: Treiber[] = [
  { k: 'q3', bad: ['nie', 'selten'], w: 15, titel: 'Muskeln aufbauen', schritte: [
    'Zweimal pro Woche 20 Minuten Kraft zu Hause: Kniebeugen, Ausfallschritte, Liegestütz an der Wand.',
    'Zu jeder Hauptmahlzeit eine Handfläche Eiweiss: Eier, Quark, Fisch oder Linsen.'] },
  { k: 'q4', bad: ['mehr', 'etwas'], w: 14, titel: 'Bauch und Essrhythmus', schritte: [
    'Drei Mahlzeiten statt Dauer-Snacken, dazwischen vier bis fünf Stunden Pause.',
    'Nach dem Abendessen 15 Minuten spazieren.'] },
  { k: 'q2', bad: ['dauer', 'loch', 'morgens'], w: 13, titel: 'Energie stabilisieren', schritte: [
    'Frühstück mit Eiweiss statt Brot mit Konfi. So hält die Energie bis zum Mittag.',
    'Im Nachmittagsloch erst ein grosses Glas Wasser und zehn Minuten an die frische Luft.'] },
  { k: 'q5', bad: ['wach', 'ein', 'unausgeruht'], w: 12, titel: 'Besser schlafen', schritte: [
    'Jeden Abend zur gleichen Zeit ins Bett, das Handy bleibt draussen.',
    'Nach 14 Uhr kein Kaffee mehr.'] },
  { k: 'q6', bad: ['hoch', 'mittel'], w: 11, titel: 'Süsses neu takten', schritte: [
    'Süsses nur direkt nach einer Mahlzeit, nie allein zwischendurch.',
    'Zum Kaffee eine Handvoll Nüsse statt Guetzli.'] },
];

export interface Plan {
  name: string;
  alter: number;
  koerperalter: number;
  zielAlter: number;
  jahreZurueck: number;
  hebel: { titel: string; jahre: number }[];
  schritte: string[];
}

const over = (pts: number) => Math.round(Math.max(0, Math.min(1, pts / MAX)) * SPAN);

export function plan(a: Record<string, unknown>, name = ''): Plan {
  const key = (q: string) => String(a[q] ?? '');
  const pts = (q: string) => POINTS[q]?.[key(q)] ?? 0;
  const total = ['q2', 'q3', 'q4', 'q5', 'q6'].reduce((s, q) => s + pts(q), 0);
  const alter = (AGE[key('q1')] || [45])[0];
  const jetzt = over(total);

  let top = TREIBER.filter((t) => t.bad.includes(key(t.k))).sort((x, y) => y.w - x.w).slice(0, 2);
  if (!top.length) top = [TREIBER[0]];

  // Jahre pro Hebel: so viel sinkt das Körperalter laut Test, wenn diese Antwort auf 0 Punkte geht.
  // Der letzte Hebel bekommt den Rest, damit die Summe trotz Rundung genau die Gesamtzahl ergibt.
  const ohne = over(total - top.reduce((s, t) => s + pts(t.k), 0));
  const hebel = top.map((t) => ({ titel: t.titel, jahre: jetzt - over(total - pts(t.k)) }));
  const rest = jetzt - ohne - hebel.slice(0, -1).reduce((s, x) => s + x.jahre, 0);
  hebel[hebel.length - 1].jahre = Math.max(0, rest);
  const schritte = top.length > 1
    ? [top[0].schritte[0], top[1].schritte[0], top[0].schritte[1]]
    : [top[0].schritte[0], top[0].schritte[1], TREIBER[1].schritte[1]];

  return {
    name: name.trim().split(/\s+/)[0] || '',
    alter,
    koerperalter: alter + jetzt,
    zielAlter: alter + ohne,
    jahreZurueck: jetzt - ohne,
    hebel,
    schritte,
  };
}

// Karten-URL nur mit Antwort-Schlüsseln, die Zahlen rechnet der Server selbst
export function karteUrl(origin: string, a: Record<string, unknown>, name: string): string {
  const p = new URLSearchParams({ n: (name.trim().split(/\s+/)[0] || '').slice(0, 30) });
  for (const q of ['q1', 'q2', 'q3', 'q4', 'q5', 'q6']) p.set(q, String(a[q] ?? ''));
  return `${origin}/api/koerperalter-karte.png?${p}`;
}
