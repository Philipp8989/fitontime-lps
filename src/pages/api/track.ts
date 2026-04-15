// Tracking-API: ein Blob pro Event (keine Race-Conditions, kein CDN-Cache-Problem)
import type { APIRoute } from 'astro';
import { put } from '@vercel/blob';

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

    // Eindeutiger Pfad pro Event unter events/YYYY-MM-DD/
    const today = new Date().toISOString().split('T')[0];
    const filename = `events/${today}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
    await put(filename, JSON.stringify(event), { access: 'public', addRandomSuffix: false });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
