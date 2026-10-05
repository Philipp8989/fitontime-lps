// Körperalter b ohne Formular, Schritt 1: Quiz fertig, Code an den Bot melden.
// Kein Lead, keine Personendaten. Der Bot hebt Antworten, Plan, Karten-Link, Meta-Cookies,
// Attribution und Dashboard-Session auf, bis die Person per WhatsApp mit dem Code schreibt.
// Dann ruft er api/koerperalter-lead (Schritt 2). meta und attr hängt der fetch-Wrapper
// im CookieBanner an, wie bei api/sheets.
import type { APIRoute } from 'astro';
import { clientMeta } from '../../lib/capi';
import { buildAttribution } from '../../lib/attribution';
import { plan, karteUrl } from '../../lib/koerperalter-plan';

export const prerender = false;

const CODE = /^[A-HJ-NP-Z2-9]{4}$/;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const botUrl = import.meta.env.BOT_INTAKE_URL || '';
  const botSecret = import.meta.env.BOT_INTAKE_SECRET || '';
  if (!botUrl || !botSecret) return json(503, { error: 'bot nicht konfiguriert' });

  const data = await request.json().catch(() => null);
  const code = String(data?.code || '').toUpperCase();
  if (!CODE.test(code) || typeof data?.answers !== 'object') return json(400, { error: 'code' });

  const a = data.answers || {};
  const p = plan(a);
  let sourceOrigin = '';
  try { sourceOrigin = new URL(request.headers.get('referer') || '').origin; } catch { sourceOrigin = ''; }

  const res = await fetch(botUrl.replace(/\/quiz-lead\/?$/, '/ka-start'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Intake-Secret': botSecret },
    body: JSON.stringify({
      code,
      answers: {
        ...a,
        setter_prio: 'WhatsApp-Bot, nicht anrufen',
        lp_variant: 'b',
        plan: { ziel_alter: p.zielAlter, jahre_zurueck: p.jahreZurueck, hebel: p.hebel, schritte: p.schritte },
        // Ohne Namen, den setzt der Bot aus dem WhatsApp-Profil ein
        karte_url: karteUrl(new URL(request.url).origin, a, ''),
      },
      meta: { ...(data.meta || {}), ...clientMeta(request), source_origin: sourceOrigin },
      attr: { ...buildAttribution(data, request), track: data.track || {} },
    }),
  }).catch(() => null);

  if (!res) return json(502, { error: 'bot nicht erreichbar' });
  if (res.status === 409) return json(409, { error: 'code vergeben' });
  if (!res.ok) return json(502, { error: 'bot ' + res.status });
  return json(200, { ok: true });
};
