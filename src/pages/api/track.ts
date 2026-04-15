// Tracking-API: Events in Vercel Blob speichern
import type { APIRoute } from 'astro';
import { put, list } from '@vercel/blob';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    // Schema-Mapping: Dashboard erwartet lp/step/session
    const event = {
      ...body,
      lp: body.lp || body.page,
      step: body.step || body.event,
      session: body.session || request.headers.get('x-forwarded-for') || 'anon',
      timestamp: new Date().toISOString(),
      ua: request.headers.get('user-agent') || '',
    };

    // Events als JSONL in tägliche Datei
    const today = new Date().toISOString().split('T')[0];
    const filename = `events/${today}.jsonl`;

    // Bestehende Datei laden oder neu
    let existing = '';
    try {
      const blobs = await list({ prefix: filename });
      if (blobs.blobs.length > 0) {
        const res = await fetch(blobs.blobs[0].url);
        existing = await res.text();
      }
    } catch {}

    const content = existing + JSON.stringify(event) + '\n';
    await put(filename, content, { access: 'public', addRandomSuffix: false });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
