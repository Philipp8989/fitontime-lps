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
    const counts = { views: 0, leads: 0, sessions: new Set<string>() };
    const byDay = new Map<string, { views: number; leads: number }>();
    const byLp = new Map<string, { views: number; leads: number; sessions: Set<string> }>();
    const byLpSteps = new Map<string, Map<string, Set<string>>>();

    for (const e of events) {
      const ev = String(e.event ?? '').toLowerCase();
      const step = String(e.step ?? '').toLowerCase();
      const day = String(e.timestamp ?? '').slice(0, 10);
      const lp = String(e.lp ?? 'unknown');

      if (!byDay.has(day)) byDay.set(day, { views: 0, leads: 0 });
      if (!byLp.has(lp)) byLp.set(lp, { views: 0, leads: 0, sessions: new Set() });
      if (!byLpSteps.has(lp)) byLpSteps.set(lp, new Map());

      if (e.session) {
        counts.sessions.add(e.session);
        byLp.get(lp)!.sessions.add(e.session);
        const stepKey = step || ev;
        if (stepKey) {
          const stepMap = byLpSteps.get(lp)!;
          if (!stepMap.has(stepKey)) stepMap.set(stepKey, new Set());
          stepMap.get(stepKey)!.add(e.session);
        }
      }

      const isView = ev === 'page_view' || ev === 'view' || ev === 'quiz_start';
      const isLead = ev === 'lead' || ev === 'submit' || ev === 'conversion'
        || ev === 'lead_submit' || ev === 'lead_submitted';

      if (isView) {
        counts.views++;
        byDay.get(day)!.views++;
        byLp.get(lp)!.views++;
      }
      if (isLead) {
        counts.leads++;
        byDay.get(day)!.leads++;
        byLp.get(lp)!.leads++;
      }
    }

    const result = {
      views: counts.views,
      leads: counts.leads,
      sessions: counts.sessions.size,
      cr: counts.views > 0 ? (counts.leads / counts.views) * 100 : 0,
      byDay: Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => [day, v]),
      byLp: Array.from(byLp.entries()).map(([lp, v]) => ({
        lp, views: v.views, leads: v.leads, sessions: v.sessions.size,
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
