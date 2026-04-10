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
    const filename = `events/${date.toISOString().split('T')[0]}.jsonl`;

    try {
      const blobs = await list({ prefix: filename });
      if (blobs.blobs.length > 0) {
        const res = await fetch(blobs.blobs[0].url);
        const text = await res.text();
        text.split('\n').filter(Boolean).forEach(line => {
          try { events.push(JSON.parse(line)); } catch {}
        });
      }
    } catch {}
  }

  return new Response(JSON.stringify(events), {
    headers: { 'Content-Type': 'application/json' },
  });
};
