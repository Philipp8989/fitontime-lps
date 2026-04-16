// Events-API: Dashboard-Daten lesen (Key-geschützt)
import type { APIRoute } from 'astro';
import { list } from '@vercel/blob';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const key = url.searchParams.get('key');
  if (!key || key !== import.meta.env.DASHBOARD_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const days = parseInt(url.searchParams.get('days') || '7');
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString();

  const summary = url.searchParams.get('summary') === 'true';

  // Aggregator fuer Summary-Modus
  const counts = { views: 0, leads: 0, sessions: new Set<string>() };
  const byDay = new Map<string, { views: number; leads: number }>();
  const byLp = new Map<string, { views: number; leads: number; sessions: Set<string> }>();

  const events: any[] = [];
  let cursor: string | undefined;
  do {
    const result = await list({ prefix: 'events/', cursor, limit: 1000 });
    const fetches = result.blobs.map(async (b) => {
      try {
        const r = await fetch(b.url);
        const e = await r.json();

        // Date-Filter
        if (e.timestamp && e.timestamp < cutoffStr) return;

        if (summary) {
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
        } else {
          events.push(e);
        }
      } catch {}
    });
    await Promise.all(fetches);
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);

  const cacheHeaders = {
    'content-type': 'application/json',
    'cache-control': 'public, s-maxage=300, stale-while-revalidate=600',
  };

  if (summary) {
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

  return new Response(JSON.stringify(events), { headers: cacheHeaders });
};
