// Körperalter b ohne Formular, Schritt 2: die Person hat per WhatsApp mit ihrem Code
// geschrieben und die Karte bekommen. Der Bot ruft hier an (fot-bot app/intake/karte.py).
// Jetzt erst ist es ein Lead: Sheet, CRM, Dashboard-Event und Meta-Lead (CAPI).
// Server-Event ist hier das einzige Signal, der Browser sieht den WhatsApp-Versand nicht.
import type { APIRoute } from 'astro';
import { put } from '@vercel/blob';
import { waitUntil } from '@vercel/functions';
import { sendCapiEvent } from '../../lib/capi';
import { appendKaRow } from '../../lib/koerperalter-sheet';

export const prerender = false;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const secret = import.meta.env.BOT_INTAKE_SECRET || '';
  if (!secret || request.headers.get('x-intake-secret') !== secret) return json(401, { error: 'auth' });

  const d = await request.json().catch(() => null);
  if (!d?.phone || !d?.code) return json(400, { error: 'phone/code' });
  const answers = d.answers || {};
  const meta = d.meta || {};
  const attr = d.attr || {};
  const name = String(d.name || '');

  // Sheet ist Source of Truth, darum synchron. Bei Fehler wiederholt der Bot.
  await appendKaRow({ name, phone: d.phone, answers });

  const dashUrl = import.meta.env.DASHBOARD_LEADS_URL;
  const dashKey = import.meta.env.DASHBOARD_LEADS_KEY;
  if (dashUrl && dashKey) {
    waitUntil(fetch(dashUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': dashKey },
      body: JSON.stringify({
        name, email: '', phone: d.phone, lp_slug: 'koerperalter', lp_name: 'Körperalter-Test',
        quiz_answers: answers, gclid: attr.gclid, utms: attr.utms,
      }),
    }).then(async (r) => { if (!r.ok) console.error('[ka-lead] Dashboard', r.status, await r.text().catch(() => '')); })
      .catch((e) => console.error('[ka-lead] Dashboard', e?.message || e)));
  }

  // Funnel-Dashboard: lead_submit mit der echten Browser-Session vom Quiz
  const t = attr.track || {};
  if (t.sessionId) {
    waitUntil(put(`events/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`, JSON.stringify({
      event: 'lead_submit', sessionId: t.sessionId, session: t.sessionId, funnel: 'fot',
      funnelName: 'Körperalter-Test', page: 'koerperalter', lp: 'koerperalter', step: 'lead_submit',
      variant: 'b', detail: 'whatsapp', channel: t.channel || '', src: 'server-wa',
      timestamp: new Date().toISOString(), schema_version: 'v1',
    }), { access: 'public', contentType: 'application/json', addRandomSuffix: false })
      .catch((e) => console.error('[ka-lead] track', e?.message || e)));
  }

  // Meta-Lead nur mit Marketing-Consent (wie api/sheets). Pixel wie der Browser auf der Clean-Domain.
  if (meta.consent === true) {
    waitUntil(sendCapiEvent({
      event_name: 'Lead',
      event_id: meta.event_id || `ka_${d.code}`,
      event_source_url: meta.source_origin || '',
      pixel_id_override: '1316450223953563',
      custom_data: { content_name: 'FoT Lead' },
      user_data: {
        ph: d.phone, fn: name, fbp: meta.fbp || '', fbc: meta.fbc || '',
        client_ip: meta.client_ip || '', client_user_agent: meta.client_user_agent || '',
      },
    }).catch((e: any) => console.error('[ka-lead] CAPI', e?.message || e)));
  }

  return json(200, { ok: true });
};
