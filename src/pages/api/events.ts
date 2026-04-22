// Events-API: Dashboard-Daten lesen (Key-geschützt)
// Optimiert: filtert Blobs nach Filename-Timestamp VOR dem Fetch — spart N+1 latenz
import type { APIRoute } from 'astro';
import { list } from '@vercel/blob';

export const prerender = false;
// Vercel Function Timeout (Pro-Plan bis 300s)
export const config = { maxDuration: 60 };

export const GET: APIRoute = async ({ url }) => {
  try {
  const key = url.searchParams.get('key');
  if (!key || key !== import.meta.env.DASHBOARD_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const days = parseInt(url.searchParams.get('days') || '7');
  const cutoffMs = Date.now() - days * 86400000;
  const cutoffStr = new Date(cutoffMs).toISOString();
  const summary = url.searchParams.get('summary') === 'true';

  // Schritt 1: Blob-Metadaten paginiert sammeln (schnell, nur Metadata)
  const relevant: { url: string; pathname: string }[] = [];
  let cursor: string | undefined;
  do {
    const result = await list({ prefix: 'events/', cursor, limit: 1000 });
    for (const b of result.blobs) {
      // Filename-Format: events/<ms>-<rand>.json
      const match = b.pathname.match(/events\/(\d+)-/);
      if (match) {
        const ms = parseInt(match[1]);
        if (ms >= cutoffMs) relevant.push({ url: b.url, pathname: b.pathname });
      } else {
        // Unbekanntes Format — trotzdem mitnehmen (altes Schema)
        relevant.push({ url: b.url, pathname: b.pathname });
      }
    }
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);

  // Schritt 2: Nur relevante Blobs fetchen (parallel, mit Concurrency-Limit)
  const CONCURRENCY = 100;
  const results: any[] = [];
  for (let i = 0; i < relevant.length; i += CONCURRENCY) {
    const batch = relevant.slice(i, i + CONCURRENCY);
    const fetched = await Promise.all(batch.map(async (b) => {
      try {
        const r = await fetch(b.url);
        const e = await r.json();
        if (e.timestamp && e.timestamp < cutoffStr) return null;
        return e;
      } catch {
        return null;
      }
    }));
    for (const e of fetched) if (e) results.push(e);
  }

  const cacheHeaders = {
    'content-type': 'application/json',
    'cache-control': 'public, s-maxage=300, stale-while-revalidate=600',
  };

  if (summary) {
    // Saubere KPI-Aggregation:
    // - sessions = unique Session-IDs
    // - views    = raw page_view-Events (nicht quiz_start dazu, kein Doppelzaehlen)
    // - leads    = unique Sessions mit Lead-Event (deduped)
    // - cr       = leads / sessions (sessions-basiert, ehrlicher als raw views)
    // byLpSteps = unique Sessions pro EVENT-Name (event-Feld bevorzugt; step-Feld nur Fallback bei
    //             event=step_view, weil dann das step-Feld die echte Funnel-Position traegt)
    const counts = { views: 0, leadsBySession: new Set<string>(), sessions: new Set<string>() };
    const byDay = new Map<string, { views: number; leadsBySession: Set<string> }>();
    const byLp = new Map<string, { views: number; leadsBySession: Set<string>; sessions: Set<string> }>();
    const byLpSteps = new Map<string, Map<string, Set<string>>>();

    const VIEW_EVENTS = new Set(['page_view', 'view', 'pageview']);
    const LEAD_EVENTS = new Set(['lead', 'submit', 'conversion', 'lead_submit', 'lead_submitted']);

    for (const e of results) {
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
        // Funnel-Step IMMER per Event-Namen — step-Feld ist je nach LP numerisch (0/1/2)
        // und damit unbrauchbar. Nur wenn ev=step_view: dann ist step die Funnel-Position.
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
        lp,
        views: v.views,
        leads: v.leadsBySession.size,
        sessions: v.sessions.size,
      })),
      byLpSteps: Array.from(byLpSteps.entries()).map(([lp, stepMap]) => ({
        lp,
        steps: Object.fromEntries(Array.from(stepMap.entries()).map(([s, set]) => [s, set.size])),
      })),
    };
    return new Response(JSON.stringify(result), { headers: cacheHeaders });
  }

  return new Response(JSON.stringify(results), { headers: cacheHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e), stack: e?.stack }), {
      status: 500, headers: { 'content-type': 'application/json' },
    });
  }
};
