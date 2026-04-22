// Event-Tracking via Vercel Blob — ein Blob pro Event, Schema-Normalisierung für Dashboard
import type { APIRoute } from 'astro';
import { put } from '@vercel/blob';

export const prerender = false;

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
      schema_version: 'v1',
    };
    const filename = `events/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
    await put(filename, JSON.stringify(event), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message }), { status: 500 });
  }
};
