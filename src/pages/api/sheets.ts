import type { APIRoute } from 'astro';
import { google } from 'googleapis';
import { waitUntil } from '@vercel/functions';
import { sendCapiEvent, clientMeta } from '../../lib/capi';
import { normalizePhone } from '../../lib/phone';

// Pro LP: Sheet-ID + Spalten-Schema. Fehlt der Eintrag, wird kein Sheet-Write gemacht.
type SheetConfig = {
  id: string;
  range: string;
  buildRow: (datum: string, data: any) => (string | number)[];
};

const SHEETS: Record<string, SheetConfig> = {
  'schilddruesen-report': {
    id: '1pKSK2fB3tjL9sxHMbM95a3NGdHZyeW0g29sIYnzh4js',
    range: 'Tabellenblatt1!A:M',
    buildRow: (datum, d) => {
      const a = d.answers || {};
      return [datum, d.name, d.email, d.phone || '', a.q1||'', a.q2||'', a.q3||'', a.q4||'', a.q5||'', a.q6||'', a.q7||'', a.q8||'', a.q9||''];
    },
  },
  // Ab-40 VSL-Funnel: Datum | Name | E-Mail (Opt-in vor dem VSL, Qualifier-Antworten laufen als Events ins Dashboard)
  'ab-40': {
    id: '1VGtODlUlyWDftRYYf96JL_GhHTJxnPLwDBAqp_Dgbkc',
    range: 'Tabellenblatt1!A:C',
    buildRow: (datum, d) => [datum, d.name, d.email],
  },
  // Abnehmpotential-Sheet: Datum | Name | Telefon | Email
  'abnehmpotential': {
    id: '1Eyzi7Hh8e20UQx44b5fikCA6sN-wngJvO0I4k4flQUM',
    range: 'Tabellenblatt1!A:D',
    buildRow: (datum, d) => [datum, d.name, d.phone || '', d.email],
  },
  // Stoffwechsel-Report: Datum | Name | Email | Telefon | Geschlecht | q1..q7
  'stoffwechsel-report': {
    id: '1EsXQzYwL-fxCA3yiczCX_Qv1lMyFt3LmFFQ1sY-klj8',
    range: 'Tabellenblatt1!A:L',
    buildRow: (datum, d) => {
      const a = d.answers || {};
      return [datum, d.name, d.email, d.phone || '', a.gender || '', a.q1 || '', a.q2 || '', a.q3 || '', a.q4 || '', a.q5 || '', a.q6 || '', a.q7 || ''];
    },
  },
  // Ayurveda-Quiz (Doshatyp): Datum | Name | Telefon | Email | Typ (VATA/PITTA/KAPHA)
  'ayurveda-quiz': {
    id: '1XAmD5-LQcMub0C1UhgqD30WJYyimjlX59mODsOMumxM',
    range: 'Tabellenblatt1!A:E',
    buildRow: (datum, d) => {
      const a = d.answers || {};
      const typ = (a.dosha_type || '').toString().toUpperCase();
      return [datum, d.name, d.phone || '', d.email, typ];
    },
  },
  // MSM-Test Funnel (neu 2026-04)
  // Schema: Datum | Vorname | Email | Telefon | Score | Stufe | StufeName | KritDim | KritPct | GLP1 | Alter | Ziel (Freitext) | Alltag | Versuche
  'msm': {
    id: '1yIFBbgn8kKcYpbDHQsz7SQZVf2vU7SBkeWWtHGdAYWY',
    range: 'Leads!A:N',
    buildRow: (datum, d) => {
      const a = d.answers || {};
      const vorname = (d.name || '').trim().split(/\s+/)[0] || '';
      const score = a.msm_score ?? '';
      const stufe = a.msm_stufe ?? '';
      const stufeName = a.msm_stufe_name || '';
      const critDim = a.msm_crit_dim_label || '';
      const critPct = a.msm_crit_pct ?? '';
      const glp1 = a.msm_glp1 ? 'Ja' : 'Nein';
      const alter = a.q1 || '';
      const ziel = (a.q12 || '').replace(/\n+/g, ' ').slice(0, 500);
      const alltag = Array.isArray(a.q11_val) ? a.q11_val.join(', ') : (a.q11 || '');
      const versuche = Array.isArray(a.q9_val) ? a.q9_val.join(', ') : (a.q9 || '');
      return [datum, vorname, d.email, d.phone || '', score, stufe, stufeName, critDim, critPct, glp1, alter, ziel, alltag, versuche];
    },
  },
  // Webinar-Opt-in "Entzuendungen" (2026-04-30)
  // Schema: Datum | Name | Email | Tel-Nr (vom Sheet vorgegeben)
  'entzuendungen': {
    id: '1KnvsnN4uHoFf8QJmaP1ZKc6CR_ghLqxKtxSbvdG9TI8',
    range: 'Tabellenblatt1!A:D',
    buildRow: (datum, d) => [datum, d.name, d.email, d.phone || ''],
  },
  // FB-Stoffwechsel-Quiz Leads (neuer Funnel 2026-04)
  // Schema: Datum | Vorname | Nachname | Email | Telefon | Ziel | Beruflich | (leer Reserveraum für Sales)
  'stoffwechsel-test': {
    id: '1UGaXbNqfPGXk4EN4BXgvWkwmNekioCYAICY2SzIZrOA',
    range: 'Leads!A:K',
    buildRow: (datum, d) => {
      const a = d.answers || {};
      const fullName = (d.name || '').trim();
      const parts = fullName.split(/\s+/);
      const vorname = parts[0] || '';
      const nachname = parts.slice(1).join(' ') || '';

      const typMap: Record<string, string> = { staemmig: 'Stämmig', soft: 'Soft', zierlich: 'Zierlich' };
      const typ = typMap[a.profile_type] || a.profile_type || '';

      const zielMap: Record<string, string> = {
        aussehen: 'Besser aussehen',
        gesundheit: 'Mehr Gesundheit',
        wohlbefinden: 'Mehr Wohlbefinden',
        abnehmen: 'Nachhaltig abnehmen',
      };
      const zielText = zielMap[a.q2_val] || a.q2_val || '';
      // Ziel-Spalte enthält Typ + Ziel für Sales auf einen Blick
      const ziel = typ ? `${zielText} · Typ: ${typ}` : zielText;

      const ausgelastet = a.q1_val === 'ja' ? 'Ja' : a.q1_val === 'nein' ? 'Nein' : '';

      return [datum, vorname, nachname, d.email, d.phone || '', ziel, ausgelastet, '', '', '', ''];
    },
  },

  // === v2 Clean-Domain-Funnel (go.abnehmen-ohne-stress.ch) -> jeweils selbes Sheet wie Original ===
  'figur-check': {
    id: '1pKSK2fB3tjL9sxHMbM95a3NGdHZyeW0g29sIYnzh4js',
    range: 'Tabellenblatt1!A:M',
    buildRow: (datum, d) => {
      const a = d.answers || {};
      return [datum, d.name, d.email, d.phone || '', a.q1||'', a.q2||'', a.q3||'', a.q4||'', a.q5||'', a.q6||'', a.q7||'', a.q8||'', a.q9||''];
    },
  },
  'koerper-report': {
    id: '1EsXQzYwL-fxCA3yiczCX_Qv1lMyFt3LmFFQ1sY-klj8',
    range: 'Tabellenblatt1!A:L',
    buildRow: (datum, d) => {
      const a = d.answers || {};
      return [datum, d.name, d.email, d.phone || '', a.gender || '', a.q1 || '', a.q2 || '', a.q3 || '', a.q4 || '', a.q5 || '', a.q6 || '', a.q7 || ''];
    },
  },
  'koerpertyp-test': {
    id: '1UGaXbNqfPGXk4EN4BXgvWkwmNekioCYAICY2SzIZrOA',
    range: 'Leads!A:K',
    buildRow: (datum, d) => {
      const a = d.answers || {};
      const fullName = (d.name || '').trim();
      const parts = fullName.split(/\s+/);
      const vorname = parts[0] || '';
      const nachname = parts.slice(1).join(' ') || '';
      const typMap: Record<string, string> = { staemmig: 'Stämmig', soft: 'Soft', zierlich: 'Zierlich' };
      const typ = typMap[a.profile_type] || a.profile_type || '';
      const zielMap: Record<string, string> = { aussehen: 'Besser aussehen', gesundheit: 'Mehr Gesundheit', wohlbefinden: 'Mehr Wohlbefinden', abnehmen: 'Nachhaltig abnehmen' };
      const zielText = zielMap[a.q2_val] || a.q2_val || '';
      const ziel = typ ? `${zielText} · Typ: ${typ}` : zielText;
      const ausgelastet = a.q1_val === 'ja' ? 'Ja' : a.q1_val === 'nein' ? 'Nein' : '';
      return [datum, vorname, nachname, d.email, d.phone || '', ziel, ausgelastet, '', '', '', ''];
    },
  },
  'energie-check': {
    id: '1yIFBbgn8kKcYpbDHQsz7SQZVf2vU7SBkeWWtHGdAYWY',
    range: 'Leads!A:N',
    buildRow: (datum, d) => {
      const a = d.answers || {};
      const vorname = (d.name || '').trim().split(/\s+/)[0] || '';
      const score = a.energie_score ?? '';
      const stufe = a.energie_stufe ?? '';
      const stufeName = a.energie_stufe_name || '';
      const critDim = a.energie_crit_dim_label || '';
      const critPct = a.energie_crit_pct ?? '';
      const glp1 = a.energie_glp1 ? 'Ja' : 'Nein';
      const alter = a.q1 || '';
      const ziel = (a.q12 || '').replace(/\n+/g, ' ').slice(0, 500);
      const alltag = Array.isArray(a.q11_val) ? a.q11_val.join(', ') : (a.q11 || '');
      const versuche = Array.isArray(a.q9_val) ? a.q9_val.join(', ') : (a.q9 || '');
      return [datum, vorname, d.email, d.phone || '', score, stufe, stufeName, critDim, critPct, glp1, alter, ziel, alltag, versuche];
    },
  },

  // Longevity-Check (Bioalter-Quiz). Eigenes Sheet "FitonTime Longevity Leads"
  // (mit Service-Account leads-writer@ geteilt). Header: Datum | Vorname | E-Mail |
  // Telefon | Bioalter | Reales Alter | Verlorene Jahre | Rueckgewinn Jahre | Stufe |
  // Kritischer Hebel | Alter (Angabe) | Ziel | Lebensphase | Risikofaktoren
  'longevity': {
    id: '1d998DSbOB2u7s2l6jijdZXNZ9Z8x5LMK3DvHkwJVQcY',
    // Spalte O = A/B-Variante (a = Original, b = Reframe erfolgreiche Frauen, seit 06.07.)
    range: 'Leads!A:O',
    buildRow: (datum, d) => {
      const a = d.answers || {};
      const vorname = (d.name || '').trim().split(/\s+/)[0] || '';
      const bioAge = a.longevity_bio_age ?? '';
      const realAge = a.longevity_real_age ?? '';
      const lostYears = a.longevity_lost_years ?? '';
      const regainYears = a.longevity_regain_years ?? '';
      const stufeName = a.longevity_stufe_name || '';
      const critDim = a.longevity_crit_dim_label || '';
      const alter = a.q1 || '';
      const ziel = (a.q12 || '').replace(/\n+/g, ' ').slice(0, 500);
      const lebensphase = Array.isArray(a.q11_val) ? a.q11_val.join(', ') : (a.q11 || '');
      const risiko = Array.isArray(a.q9_val) ? a.q9_val.join(', ') : (a.q9 || '');
      const variant = a.lp_variant || 'a';
      return [datum, vorname, d.email, d.phone || '', bioAge, realAge, lostYears, regainYears, stufeName, critDim, alter, ziel, lebensphase, risiko, variant];
    },
  },
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    // Telefonnummer serverseitig saeubern (Defense-in-depth, siehe lib/phone.ts).
    if (data.phone) data.phone = normalizePhone(data.phone);

    // Telefon ist NICHT generell Pflicht: E-Mail-only-Funnels (z.B. figur-check /
    // Schilddruesen-Report v2) sammeln bewusst nur Name + E-Mail. Frueher erzwang
    // die Validierung phone und 400te jede Absendung dieser Funnels -> Totalausfall.
    if (!data.name || !data.email) {
      return new Response(JSON.stringify({ error: 'Name und E-Mail sind Pflicht' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const lpSlug = (data.lp_slug || 'schilddruesen-report').toString();
    const config = SHEETS[lpSlug];

    // Datum (Schweizer Zeit)
    const datum = new Date().toLocaleString('de-CH', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Zurich',
    });

    if (config) {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: import.meta.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: (import.meta.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const sheets = google.sheets({ version: 'v4', auth });
      const row = config.buildRow(datum, data);

      // Atomarer Append statt read-count-then-update: Letzteres hatte eine Race
      // Condition (zwei gleichzeitige Leads berechnen dieselbe nextRow und
      // ueberschreiben sich), wodurch Leads aus dem Sheet verschwanden und nie
      // in HubSpot LOT landeten. append() mit festem A:A-Anker + INSERT_ROWS ist
      // serverseitig atomar und verschiebt keine Werte durch Table-Detection.
      const sheetName = (config.range.split('!')[0] || 'Sheet1').replace(/['"]/g, '');

      await sheets.spreadsheets.values.append({
        spreadsheetId: config.id,
        range: `${sheetName}!A:A`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] },
      });
    }

    // Lead an zentrale Dashboard-API senden (Postgres-CRM für Reporting + Mail-Notification).
    // Sheet ist Source-of-Truth (oben bereits synchron geschrieben). Dashboard-Insert
    // laeuft via waitUntil mit Retry: Funktion bleibt bis Insert+Mail durch sind, aber
    // der Client kriegt sofort 200, sobald das Sheet steht. Verhindert User-Resubmits
    // bei transienten DB-/Quota-Fehlern (siehe Neon-402-Incident).
    const dashUrl = import.meta.env.DASHBOARD_LEADS_URL;
    const dashKey = import.meta.env.DASHBOARD_LEADS_KEY;
    if (dashUrl && dashKey) {
      const payload = JSON.stringify({
        name: data.name,
        email: data.email,
        phone: data.phone || '',
        lp_slug: lpSlug,
        lp_name: data.lp_name || lpSlug,
        quiz_answers: data.answers || {},
      });
      waitUntil((async () => {
        const delays = [0, 1500, 5000]; // 3 Versuche: sofort, +1.5s, +5s
        for (let i = 0; i < delays.length; i++) {
          if (delays[i] > 0) await new Promise((r) => setTimeout(r, delays[i]));
          try {
            const res = await fetch(dashUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': dashKey },
              body: payload,
            });
            if (res.ok) return;
            const detail = await res.text().catch(() => '');
            console.error(`Dashboard Lead Insert try ${i + 1} non-OK:`, res.status, detail);
          } catch (e: any) {
            console.error(`Dashboard Lead Insert try ${i + 1} error:`, e?.message || e);
          }
        }
        console.error('Dashboard Lead Insert FINAL FAIL, Lead nur im Sheet:', { lpSlug, email: data.email });
      })());
    }

    // WhatsApp-Bot-Intake: nur bei explizitem WhatsApp-Opt-in. Server-seitig,
    // damit das Shared-Secret nie im Client landet. Fire-and-forget via waitUntil.
    const botUrl = import.meta.env.BOT_INTAKE_URL;
    const botSecret = import.meta.env.BOT_INTAKE_SECRET;
    if (botUrl && botSecret && data.wa_optin === true && data.phone) {
      const firstName = (data.first_name || String(data.name || '').trim().split(/\s+/)[0] || '').toString();
      const botPayload = JSON.stringify({
        phone: data.phone,
        first_name: firstName,
        score: data.score ?? '',
        answers: data.answers || {},
        lp_slug: lpSlug,
        optin_ts: new Date().toISOString(),
      });
      waitUntil((async () => {
        const delays = [0, 1500, 5000];
        for (let i = 0; i < delays.length; i++) {
          if (delays[i] > 0) await new Promise((r) => setTimeout(r, delays[i]));
          try {
            const res = await fetch(botUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Intake-Secret': botSecret },
              body: botPayload,
            });
            if (res.ok) return;
            const detail = await res.text().catch(() => '');
            console.error(`Bot-Intake try ${i + 1} non-OK:`, res.status, detail);
          } catch (e: any) {
            console.error(`Bot-Intake try ${i + 1} error:`, e?.message || e);
          }
        }
        console.error('Bot-Intake FINAL FAIL:', { lpSlug, phone: data.phone });
      })());
    }

    // Synthetisches lead_submit-Event für Attribution/CR-Sanity. Fire-and-forget.
    fetch(new URL('/api/track', request.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'lead_submit',
        lp: lpSlug,
        session: data.session_id || data.session || 'server-side',
        schema_version: 'v1',
      }),
    }).catch(() => {});

    // Meta Conversions API, Lead, dedupliziert via event_id (gleiche ID feuert der Browser-Pixel).
    // NUR bei Marketing-Consent (data.meta.consent), sonst DSGVO-Verstoss. fbp/fbc aus Body (Client) + Cookie-Fallback.
    const meta = data.meta || {};
    if (meta.consent === true) {
      const cookieHdr = request.headers.get('cookie') || '';
      const fbpCookie = (cookieHdr.match(/(?:^|; )_fbp=([^;]*)/) || [])[1] || '';
      const fbcCookie = (cookieHdr.match(/(?:^|; )_fbc=([^;]*)/) || [])[1] || '';
      const fullName = String(data.name || '').trim();
      const fn = fullName.split(/\s+/)[0] || '';
      const ln = fullName.split(/\s+/).slice(1).join(' ');
      const { client_ip, client_user_agent } = clientMeta(request);
      // Gesundheitssignale aus event_source_url entfernen: nur Origin senden,
      // nie den Funnel-Pfad (z.B. /schilddruesen-report) oder Query-Parameter.
      let sourceOrigin = '';
      try { sourceOrigin = new URL(request.headers.get('referer') || '').origin; } catch { sourceOrigin = ''; }
      sendCapiEvent({
        event_name: 'Lead',
        event_id: meta.event_id || `lead_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        event_source_url: sourceOrigin,
        // Longevity hat einen eigenen, isolierten Pixel (nicht den geteilten Health-Pixel).
        // Browser-Pixel auf /longevity/* feuert auf dieselbe ID -> Dedup via event_id bleibt intakt.
        pixel_id_override: lpSlug === 'longevity' ? '1214902253584066' : undefined,
        // Nur Longevity: geschaetzter Lead-Wert (reine Zahl, KEINE Gesundheitsdaten) behebt Meta-Diagnose "gueltige Preisinfo".
        // value/currency muessen mit dem Browser-Pixel (longevity/index.astro) uebereinstimmen. Platzhalter 50 CHF.
        custom_data: lpSlug === 'longevity'
          ? { content_name: 'FoT Lead', value: 50, currency: 'CHF' }
          : { content_name: 'FoT Lead' },
        user_data: {
          em: data.email || '',
          ph: data.phone || '',
          fn,
          ln,
          fbp: meta.fbp || fbpCookie,
          fbc: meta.fbc || fbcCookie,
          client_ip,
          client_user_agent,
        },
      }).catch((e: any) => console.error('[CAPI Lead] Fehler:', e?.message || e));
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Sheets API Fehler:', err?.message || err);
    return new Response(JSON.stringify({ error: 'Interner Fehler' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
