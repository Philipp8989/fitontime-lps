// Events-API: Dashboard-Daten lesen (Key-geschuetzt)
// Liest events-daily/YYYY-MM-DD.ndjson — 1 Blob pro Tag, maximal (days) Fetches
import type { APIRoute } from 'astro';
import { list } from '@vercel/blob';

export const prerender = false;
export const config = { maxDuration: 30 };

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export const GET: APIRoute = async ({ url }) => {
  try {
  const key = url.searchParams.get('key');
  if (!key || key !== import.meta.env.DASHBOARD_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const days = parseInt(url.searchParams.get('days') || '7');
  const summary = url.searchParams.get('summary') === 'true';

  // Welche Tage brauchen wir?
  const wantDays = new Set<string>();
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    wantDays.add(ymd(d));
  }

  // Alle daily-Blobs listen, nur relevante fetchen
  const relevant: string[] = [];
  let cursor: string | undefined;
  do {
    const r = await list({ prefix: 'events-daily/', cursor, limit: 1000 });
    for (const b of r.blobs) {
      const m = b.pathname.match(/events-daily\/(\d{4}-\d{2}-\d{2})\.ndjson/);
      if (m && wantDays.has(m[1])) relevant.push(b.url);
    }
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);

  // Parallel fetchen
  const events: any[] = [];
  await Promise.all(relevant.map(async (u) => {
    try {
      const r = await fetch(u, { cache: 'no-store' });
      if (!r.ok) return;
      const text = await r.text();
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        try { events.push(JSON.parse(line)); } catch {}
      }
    } catch {}
  }));

  const cacheHeaders = {
    'content-type': 'application/json',
    'cache-control': 'public, s-maxage=300, stale-while-revalidate=600',
  };

  if (summary) {
    // Saubere KPI-Aggregation: sessions = unique IDs; views = nur page_view-Events;
    // leads = unique Sessions mit Lead-Event (deduped); cr = leads/sessions.
    // byLpSteps zaehlt pro EVENT-Name (event-Feld bevorzugt; step nur Fallback bei step_view,
    // weil bei einigen FitonTime-LPs das step-Feld die numerische Quiz-Position traegt).
    const counts = { views: 0, leadsBySession: new Set<string>(), sessions: new Set<string>() };
    const byDay = new Map<string, { views: number; leadsBySession: Set<string> }>();
    const byLp = new Map<string, { views: number; leadsBySession: Set<string>; sessions: Set<string> }>();
    const byLpSteps = new Map<string, Map<string, Set<string>>>();

    const VIEW_EVENTS = new Set(['page_view', 'view', 'pageview']);
    const LEAD_EVENTS = new Set(['lead', 'submit', 'conversion', 'lead_submit', 'lead_submitted']);

    for (const e of events) {
      const ev = String(e.event ?? '').toLowerCase();
      const step = String(e.step ?? '').toLowerCase();
      const day = String(e.timestamp ?? '').slice(0, 10);
      const lp = String(e.lp ?? 'unknown');

      if (!byDay.has(day)) byDay.set(day, { views: 0, leadsBySession: new Set() });
      if (!byLp.has(lp)) byLp.set(lp, { views: 0, leadsBySession: new Set(), sessions: new Set() });
      if (!byLpSteps.has(lp)) byLpSteps.set(lp, new Map());

      if (e.session) {
        counts.sessions.add(e.session);
        byLp.get(lp)!.sessions.add(e.session);
        const stepKey = ev && ev !== 'step_view' ? ev : (step || '');
        if (stepKey) {
          const stepMap = byLpSteps.get(lp)!;
          if (!stepMap.has(stepKey)) stepMap.set(stepKey, new Set());
          stepMap.get(stepKey)!.add(e.session);
        }
      }

      if (VIEW_EVENTS.has(ev)) {
        counts.views++;
        byDay.get(day)!.views++;
        byLp.get(lp)!.views++;
      }
      if (LEAD_EVENTS.has(ev) && e.session) {
        counts.leadsBySession.add(e.session);
        byDay.get(day)!.leadsBySession.add(e.session);
        byLp.get(lp)!.leadsBySession.add(e.session);
      }
    }

    const totalLeads = counts.leadsBySession.size;
    const totalSessions = counts.sessions.size;

    const result = {
      views: counts.views,
      leads: totalLeads,
      sessions: totalSessions,
      cr: totalSessions > 0 ? (totalLeads / totalSessions) * 100 : 0,
      byDay: Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b))
        .map(([day, v]) => [day, { views: v.views, leads: v.leadsBySession.size }]),
      byLp: Array.from(byLp.entries()).map(([lp, v]) => ({
        lp, views: v.views, leads: v.leadsBySession.size, sessions: v.sessions.size,
      })),
      byLpSteps: Array.from(byLpSteps.entries()).map(([lp, stepMap]) => ({
        lp,
        steps: Object.fromEntries(Array.from(stepMap.entries()).map(([s, set]) => [s, set.size])),
      })),
    };
    return new Response(JSON.stringify(result), { headers: cacheHeaders });
  }

  return new Response(JSON.stringify(events), { headers: cacheHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e), stack: e?.stack }), {
      status: 500, headers: { 'content-type': 'application/json' },
    });
  }
};
