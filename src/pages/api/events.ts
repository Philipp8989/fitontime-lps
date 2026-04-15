// Events-API: Dashboard-Daten lesen (Key-geschützt)
import type { APIRoute } from 'astro';
import { list } from '@vercel/blob';

export const GET: APIRoute = async ({ url }) => {
  const key = url.searchParams.get('key');
  if (key !== import.meta.env.DASHBOARD_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const days = parseInt(url.searchParams.get('days') || '7');
  const events: any[] = [];

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const prefix = `events/${date.toISOString().split('T')[0]}/`;

    try {
      const { blobs } = await list({ prefix });
      // Alle Event-Blobs des Tages parallel laden
      const results = await Promise.all(
        blobs.map(async (b) => {
          try {
            const res = await fetch(b.url);
            return JSON.parse(await res.text());
          } catch {
            return null;
          }
        })
      );
      results.forEach((e) => e && events.push(e));
    } catch {}
  }

  return new Response(JSON.stringify(events), {
    headers: { 'Content-Type': 'application/json' },
  });
};
