// OpenAI Ads Conversions API (ChatGPT Ads) — rein serverseitig.
// Gegenstueck zu lib/capi.ts (Meta), gleiche Rolle: Lead-Conversion an die
// Ad-Plattform melden, ohne Browser-Pixel.
//
// Datenquelle im OpenAI Ads Manager: "fot pixel"
// Conversion-Ereignis:               "Koerpertyp-Test Lead" (Basisereignis lead_created)
//
// Env (nur Production setzen, damit Previews keine echten Conversions feuern):
//   OPENAI_ADS_PIXEL_ID       - Pixel-ID der Datenquelle
//   OPENAI_ADS_CAPI_KEY       - Conversion-Schluessel (Bearer-Token)
//   OPENAI_ADS_VALIDATE_ONLY  - optional "1": Events nur validieren, nicht speichern
//
// Fehlt Pixel-ID oder Key: no-op (warnt einmalig), Lead laeuft unveraendert weiter.
import { createHash } from 'node:crypto';

const ENDPOINT = 'https://bzr.openai.com/v1/events';

export interface OpenAiAdsUser {
  email?: string;      // Klartext, wird hier normalisiert + gehasht
  phone?: string;      // Klartext
  firstName?: string;  // Klartext
  lastName?: string;   // Klartext
  oppref?: string;     // Klick-Kennung aus der Landing-Page-URL (ungehasht)
  obref?: string;      // __obref-Cookie des Pixels (ungehasht), hier i. d. R. leer
  ip?: string;
  userAgent?: string;
  country?: string;    // z. B. "CH"
}

export interface OpenAiAdsEvent {
  id: string;                 // stabile Event-ID (Retry + Dedup)
  type: string;               // z. B. 'lead_created'
  sourceUrl: string;          // Pflicht bei action_source 'web'
  user?: OpenAiAdsUser;
  timestampMs?: number;
}

let warnedNoConfig = false;

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

// E-Mail: trimmen + kleinschreiben.
function normEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

// Telefon: Laendervorwahl behalten, alles ausser Ziffern raus. Eine fuehrende
// nationale 0 wird auf 41 gemappt — FoT wirbt in der Schweiz, nicht in DE.
// Ergebnis 8-15 Ziffern, sonst wird das Feld weggelassen.
function normPhone(raw: string): string {
  let v = raw.replace(/\D+/g, '');
  if (v.startsWith('00')) v = v.slice(2);
  else if (v.startsWith('0')) v = '41' + v.slice(1);
  return v;
}

// Namen: kleinschreiben, Whitespace + ASCII-Interpunktion entfernen,
// Umlaute/Akzente bleiben erhalten (so schreibt es die Doku vor).
function normName(raw: string): string {
  return raw.toLowerCase().replace(/[\s!-/:-@[-`{-~]+/g, '');
}

function buildUser(u: OpenAiAdsUser): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  const email = (u.email || '').trim();
  const phone = normPhone(u.phone || '');
  const fn = (u.firstName || '').trim();
  const ln = (u.lastName || '').trim();

  if (email) out.emails_sha256 = [sha256(normEmail(email))];
  if (phone.length >= 8 && phone.length <= 15) out.phone_numbers_sha256 = [sha256(phone)];
  if (fn) out.first_names_sha256 = [sha256(normName(fn))];
  if (ln) out.last_names_sha256 = [sha256(normName(ln))];
  if (u.obref) out.obref = u.obref;
  if (u.ip) out.ip_address = u.ip;
  if (u.userAgent) out.user_agent = u.userAgent;
  if (u.country) out.countries = [u.country];

  return Object.keys(out).length ? out : undefined;
}

export async function sendOpenAiAdsEvent(
  event: OpenAiAdsEvent,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const pixelId = import.meta.env.OPENAI_ADS_PIXEL_ID;
  const key = import.meta.env.OPENAI_ADS_CAPI_KEY;

  if (!pixelId || !key) {
    if (!warnedNoConfig) {
      console.warn('[OAI-ADS] OPENAI_ADS_PIXEL_ID oder OPENAI_ADS_CAPI_KEY fehlt - no-op');
      warnedNoConfig = true;
    }
    return { ok: false, error: 'openai-ads-not-configured' };
  }

  const user = event.user ? buildUser(event.user) : undefined;
  const payload = {
    validate_only: import.meta.env.OPENAI_ADS_VALIDATE_ONLY === '1',
    integration_source: 'fitontime_lps',
    events: [
      {
        id: event.id,
        type: event.type,
        timestamp_ms: event.timestampMs ?? Date.now(),
        source_url: event.sourceUrl,
        action_source: 'web',
        ...(event.user?.oppref ? { oppref: event.user.oppref } : {}),
        ...(user ? { user } : {}),
        data: { type: 'customer_action' },
      },
    ],
  };

  // Zwei Versuche: transiente 5xx/Timeouts sind der haeufigste Fehlerfall,
  // die Event-ID bleibt gleich, doppelte Zustellung wird serverseitig dedupliziert.
  let lastErr = '';
  let lastStatus = 0;
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (attempt > 1) await new Promise((r) => setTimeout(r, 800));
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`${ENDPOINT}?pid=${encodeURIComponent(pixelId)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      lastStatus = res.status;
      const body = await res.text().catch(() => '');
      if (res.ok) {
        console.log('[OAI-ADS] OK', res.status, event.type, event.id);
        return { ok: true, status: res.status };
      }
      lastErr = `HTTP ${res.status}: ${body.slice(0, 300)}`;
      console.error('[OAI-ADS] non-2xx', 'attempt', attempt, lastErr);
      // 4xx sind Payload-Fehler, ein Retry aendert daran nichts.
      if (res.status >= 400 && res.status < 500) break;
    } catch (e: any) {
      lastErr = e?.name === 'AbortError' ? 'timeout(8s)' : (e?.message || String(e));
      console.error('[OAI-ADS] Fehler', 'attempt', attempt, lastErr);
    }
  }
  return { ok: false, status: lastStatus, error: lastErr };
}
