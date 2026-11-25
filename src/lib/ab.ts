// A/B-Zuteilung auf dem Server (gleiche URL, kein Redirect, kein Flackern).
// Steuerstand (läuft, Aufteilung, Notbremse) kommt vom lp-machine-dashboard, 60 s gecacht.
// Antwortet das Dashboard nicht, gilt ab-tests.json: ein Ausfall dort hält keinen Funnel an.
// Vorschau: ?ab=<variante> zeigt eine Variante erzwungen, zählt nicht und markiert keinen Lead.
import type { AstroGlobal } from 'astro';
import defs from '../../ab-tests.json';

const KUNDE = 'fitontime';
const STATE_URL = `https://lp-machine-dashboard.vercel.app/api/analytics/ab-state?slug=${KUNDE}`;
const CACHE_MS = 60_000;
const TIMEOUT_MS = 400;

type StateTest = { id: string; lp_slug: string; status: string; split: Record<string, number>; varianten: string[]; gewinner?: string | null };
export type AbZuteilung = { test: string; variant: string; forced: boolean };

let cache: { at: number; tests: StateTest[] } | null = null;

// Rückfall aus dem Repo: laufende Tests mit gleicher Aufteilung
function ausRepo(): StateTest[] {
  return ((defs as any).tests || [])
    .filter((t: any) => t.status === 'laeuft' || t.status === 'geplant')
    .map((t: any) => {
      const ids: string[] = t.varianten.map((v: any) => v.id);
      const split = t.split || Object.fromEntries(ids.map((id) => [id, 100 / ids.length]));
      return { id: t.id, lp_slug: t.lp_slug, status: t.status, split, varianten: ids };
    });
}

async function stand(): Promise<StateTest[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.tests;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    const res = await fetch(STATE_URL, { signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(String(res.status));
    const json = (await res.json()) as { tests: StateTest[] };
    // Fehlende Aufteilung (Altbestand) heißt gleich verteilt
    const tests = (json.tests || []).map((t) => ({
      ...t,
      split: t.split || Object.fromEntries(t.varianten.map((v) => [v, 100 / t.varianten.length])),
    }));
    cache = { at: Date.now(), tests };
  } catch {
    // Alten Stand weiter nutzen, sonst Repo. Kurz cachen, damit nicht jeder Aufruf wartet.
    cache = { at: Date.now() - CACHE_MS + 10_000, tests: cache?.tests || ausRepo() };
  }
  return cache.tests;
}

function ziehe(split: Record<string, number>): string {
  const eintraege = Object.entries(split).filter(([, w]) => w > 0);
  const summe = eintraege.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * summe;
  for (const [v, w] of eintraege) {
    if ((r -= w) < 0) return v;
  }
  return eintraege[0]?.[0] || Object.keys(split)[0];
}

/** Variante für diese LP. null = kein Test, Seite zeigt den Normalzustand. */
export async function abZuteilen(Astro: AstroGlobal, lpSlug: string): Promise<AbZuteilung | null> {
  const tests = await stand();
  const erzwungen = Astro.url.searchParams.get('ab');
  // Vorschau darf auch geplante Tests zeigen. Beendeter Test mit Gewinner: Gewinner für alle, ohne Zählung.
  const t = tests.find((x) => x.lp_slug === lpSlug && x.status === 'laeuft')
    || (erzwungen ? tests.find((x) => x.lp_slug === lpSlug && x.status === 'geplant') : undefined)
    || tests.find((x) => x.lp_slug === lpSlug && x.status === 'beendet' && !!x.gewinner);
  if (!t) return null;
  // Seiten mit Test nie im CDN cachen, sonst sehen alle dieselbe Variante
  Astro.response.headers.set('cache-control', 'private, no-store');
  if (erzwungen && t.varianten.includes(erzwungen)) return { test: t.id, variant: erzwungen, forced: true };
  if (t.status === 'beendet' && t.gewinner) return { test: t.id, variant: t.gewinner, forced: true };
  if (t.status !== 'laeuft') return null;

  const cookieName = `ab_${t.id}`;
  const bisher = Astro.cookies.get(cookieName)?.value || '';
  // Bisherige Variante behalten, außer sie ist abgeschaltet (Notbremse, Ende)
  const variant = t.varianten.includes(bisher) && (t.split[bisher] || 0) > 0 ? bisher : ziehe(t.split);
  if (variant !== bisher) {
    Astro.cookies.set(cookieName, variant, { path: '/', maxAge: 60 * 60 * 24 * 42, sameSite: 'lax', secure: true });
  }
  return { test: t.id, variant, forced: false };
}
