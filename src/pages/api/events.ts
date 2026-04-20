// Events-API: Dashboard-Daten lesen (Key-geschützt)
// Optimiert: filtert Blobs nach Filename-Timestamp VOR dem Fetch — spart N+1 latenz
import type { APIRoute } from 'astro';
import { list } from '@vercel/blob';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
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
  const CONCURRENCY = 30;
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
    const counts = { views: 0, leads: 0, sessions: new Set<string>() };
    const byDay = new Map<string, { views: number; leads: number }>();
    const byLp = new Map<string, { views: number; leads: number; sessions: Set<string> }>();

    for (const e of results) {
      const ev = (e.event || '').toLowerCase();
      const day = (e.timestamp || '').slice(0, 10);
      const lp = e.lp || 'unknown';

      if (!byDay.has(day)) byDay.set(day, { views: 0, leads: 0 });
      if (!byLp.has(lp)) byLp.set(lp, { views: 0, leads: 0, sessions: new Set() });

      if (e.session) {
        counts.sessions.add(e.session);
        byLp.get(lp)!.sessions.add(e.session);
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
    };
    return new Response(JSON.stringify(result), { headers: cacheHeaders });
  }

  return new Response(JSON.stringify(results), { headers: cacheHeaders });
};
