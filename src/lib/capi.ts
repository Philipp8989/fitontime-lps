// Meta Conversions API (CAPI) Helper.
// Sendet Server-Side Events parallel zum Browser-Pixel an Meta.
// Dedupliziert über event_id (gleiche ID, die der Browser-Pixel feuert).
//
// Env:
//   PUBLIC_META_PIXEL_ID  - Pixel-ID (auch server-side gelesen)
//   META_CAPI_TOKEN       - Conversions-API-Zugriffsschluessel (Pflicht für CAPI)
//   META_TEST_EVENT_CODE  - optional, fuer Events Manager Test Events
//
// Falls META_CAPI_TOKEN fehlt: Funktion no-op (loggt Warnung 1x).
import { createHash } from 'node:crypto';

export interface CapiUserData {
  em?: string;       // email plain
  ph?: string;       // phone plain
  fn?: string;       // first name plain
  ln?: string;       // last name plain
  fbp?: string;      // _fbp cookie
  fbc?: string;      // _fbc cookie / fbclid expanded
  client_ip?: string;
  client_user_agent?: string;
}

export interface CapiEvent {
  event_name: string;
  event_id?: string;
  event_source_url?: string;
  custom_data?: Record<string, unknown>;
  user_data: CapiUserData;
  action_source?: 'website' | 'app' | 'email' | 'phone_call' | 'chat' | 'physical_store' | 'system_generated' | 'other';
  event_time?: number; // unix seconds
}

let warnedNoToken = false;

function sha256Lower(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function normalizePhone(raw: string): string {
  // E.164 ohne + und ohne Whitespace, fuehrende 0/00 ersetzt
  let v = raw.replace(/\D+/g, '');
  if (v.startsWith('00')) v = v.slice(2);
  if (v.startsWith('0')) v = '49' + v.slice(1); // dt. Default
  return v;
}

function hashUser(u: CapiUserData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  if (u.em) out.em = sha256Lower(u.em);
  if (u.ph) out.ph = sha256Lower(normalizePhone(u.ph));
  if (u.fn) out.fn = sha256Lower(u.fn);
  if (u.ln) out.ln = sha256Lower(u.ln);
  if (u.fbp) out.fbp = u.fbp;          // nicht hashen
  if (u.fbc) out.fbc = u.fbc;          // nicht hashen
  if (u.client_ip) out.client_ip_address = u.client_ip;
  if (u.client_user_agent) out.client_user_agent = u.client_user_agent;
  return out;
}

function readEnv(name: string): string | undefined {
  return (process.env[name] ?? (import.meta.env as Record<string, string | undefined>)[name]) || undefined;
}

export async function sendCapiEvent(event: CapiEvent): Promise<{ ok: boolean; status?: number; error?: string }> {
  const pixelId = readEnv('PUBLIC_META_PIXEL_ID');
  const token = readEnv('META_CAPI_TOKEN');
  const testCode = readEnv('META_TEST_EVENT_CODE');

  if (!pixelId || !token) {
    if (!warnedNoToken) {
      console.warn('[CAPI] PUBLIC_META_PIXEL_ID oder META_CAPI_TOKEN fehlt - CAPI no-op');
      warnedNoToken = true;
    }
    return { ok: false, error: 'capi-not-configured' };
  }

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: event.event_name,
        event_time: event.event_time ?? Math.floor(Date.now() / 1000),
        event_id: event.event_id,
        event_source_url: event.event_source_url,
        action_source: event.action_source ?? 'website',
        user_data: hashUser(event.user_data),
        custom_data: event.custom_data ?? {},
      },
    ],
  };
  if (testCode) payload.test_event_code = testCode;

  try {
    const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.text().catch(() => '');
    if (!res.ok) {
      console.error('[CAPI] HTTP', res.status, body.slice(0, 400));
      return { ok: false, status: res.status, error: body.slice(0, 400) };
    }
    return { ok: true, status: res.status };
  } catch (e: any) {
    console.error('[CAPI] Fehler:', e?.message || e);
    return { ok: false, error: e?.message || String(e) };
  }
}

// Helper: IP + UA aus Request lesen
export function clientMeta(request: Request): { client_ip: string; client_user_agent: string } {
  const h = request.headers;
  const fwd = h.get('x-forwarded-for') || '';
  const client_ip = fwd.split(',')[0].trim() || h.get('x-real-ip') || '';
  const client_user_agent = h.get('user-agent') || '';
  return { client_ip, client_user_agent };
}
