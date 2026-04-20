// Event-Tracking via Vercel Blob — Daily-NDJSON-Rollups (events-daily/YYYY-MM-DD.ndjson)
// Hinweis: read-append-write ist nicht atomar — unter hoher Concurrency gehen
// in seltenen Faellen Events verloren. Fuer unser Traffic-Volumen akzeptabel.
import type { APIRoute } from 'astro';
import { put, list } from '@vercel/blob';

export const prerender = false;
export const config = { maxDuration: 30 };

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const event = {
      ...body,
      lp: body.lp || body.page || body.funnel || '',
      step: body.step || body.event || body.type || '',
      session: body.session || body.sessionId || request.headers.get('x-forwarded-for') || 'anon',
      timestamp: new Date().toISOString(),
      ua: request.headers.get('user-agent') || '',
      ref: request.headers.get('referer') || '',
    };

    const day = event.timestamp.slice(0, 10);
    const path = `events-daily/${day}.ndjson`;
    const line = JSON.stringify(event) + '\n';

    // Vorhandene Datei lesen (wenn da) und anhaengen
    let existing = '';
    try {
      const r = await list({ prefix: path, limit: 1 });
      if (r.blobs.length && r.blobs[0].pathname === path) {
        const res = await fetch(r.blobs[0].url, { cache: 'no-store' });
        if (res.ok) existing = await res.text();
      }
    } catch {}

    await put(path, existing + line, {
      access: 'public',
      contentType: 'application/x-ndjson',
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message }), { status: 500 });
  }
};
