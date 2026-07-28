// Lead-Attribution: Klick-IDs (gclid/fbclid/...) + UTMs fuer den CRM-Insert im Dashboard.
//
// Zwei Quellen, in dieser Reihenfolge:
//   1. data.attr — vom fetch-Wrapper im CookieBanner angehaengt. Kommt aus localStorage
//      und ueberlebt deshalb Folgeseiten (Opt-in auf Seite 2 hat die Parameter nicht mehr
//      in der URL). 30 Tage Gueltigkeit = Google-Lookback.
//   2. Referer-Header — Fallback, falls der Client-Wrapper nicht lief (JS-Fehler,
//      alter Cache, Direkt-POST). Der Referer ist die volle Landingpage-URL inklusive
//      Query-String, taugt also nur wenn das Formular auf der Einstiegsseite liegt.
//
// Ohne diese Daten steht im CRM zwar der Lead, aber nicht seine Herkunft — und
// Google-Ads-Offline-Conversions lassen sich ohne gclid gar nicht hochladen.

const CLICK_IDS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid', 'msclkid'] as const;
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id'] as const;
// Nur vom Client, nicht aus der URL: Kanal-Urteil + Einstiegskontext.
const CONTEXT_KEYS = ['channel', 'landing_ref', 'landing_path', 'page'] as const;

const MAX_LEN = 400;

export type LeadAttribution = {
  gclid: string | null;
  utms: Record<string, string> | null;
};

function clean(v: unknown): string {
  return typeof v === 'string' ? v.trim().slice(0, MAX_LEN) : '';
}

export function buildAttribution(data: any, request: Request): LeadAttribution {
  const out: Record<string, string> = {};

  const attr = data && typeof data.attr === 'object' && data.attr ? data.attr : {};
  for (const k of [...CLICK_IDS, ...UTM_KEYS, ...CONTEXT_KEYS]) {
    const v = clean(attr[k]);
    if (v) out[k] = v;
  }

  // Fallback: Parameter aus der Referer-URL nachziehen, was der Client nicht geliefert hat.
  try {
    const qs = new URL(request.headers.get('referer') || '').searchParams;
    for (const k of [...CLICK_IDS, ...UTM_KEYS]) {
      if (out[k]) continue;
      const v = clean(qs.get(k));
      if (v) out[k] = v;
    }
  } catch {
    // Kein oder unbrauchbarer Referer — kein Fehlerfall.
  }

  // gbraid/wbraid sind die gclid-Ersatzparameter bei iOS-App-Traffic ohne Nutzer-ID.
  const gclid = out.gclid || out.gbraid || out.wbraid || null;
  return { gclid, utms: Object.keys(out).length ? out : null };
}
