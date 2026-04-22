import type { APIRoute } from 'astro';
import { google } from 'googleapis';

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
  // FB-Stoffwechsel-Quiz Leads (neuer Funnel 2026-04)
  // Schema: Datum | Vorname | Nachname | Email | Telefon | Ziel | Beruflich | (leer Reserveraum fuer Sales)
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
      // Ziel-Spalte enthält Typ + Ziel fuer Sales auf einen Blick
      const ziel = typ ? `${zielText} · Typ: ${typ}` : zielText;

      const ausgelastet = a.q1_val === 'ja' ? 'Ja' : a.q1_val === 'nein' ? 'Nein' : '';

      return [datum, vorname, nachname, d.email, d.phone || '', ziel, ausgelastet, '', '', '', ''];
    },
  },
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    if (!data.name || !data.email || !data.phone) {
      return new Response(JSON.stringify({ error: 'Name, E-Mail und Telefon sind Pflicht' }), {
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

      // Append mit Table-Detection verschiebt Werte wenn das Sheet seltsame Layouts hat.
      // Deshalb: Anzahl Zeilen ueber ALLE Spalten ermitteln und explizit via update() schreiben.
      const sheetName = (config.range.split('!')[0] || 'Sheet1').replace(/['"]/g, '');
      const lastColLetter = (config.range.split(':')[1] || 'Z').replace(/[^A-Z]/g, '') || 'Z';
      const fullRange = `${sheetName}!A:${lastColLetter}`;
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: config.id,
        range: fullRange,
      });
      const usedRows = (existing.data.values || []).length;
      const nextRow = usedRows + 1;
      const writeRange = `${sheetName}!A${nextRow}:${lastColLetter}${nextRow}`;

      await sheets.spreadsheets.values.update({
        spreadsheetId: config.id,
        range: writeRange,
        valueInputOption: 'RAW',
        requestBody: { values: [row] },
      });
    }

    // Lead an zentrale Dashboard-API senden (Postgres-CRM = Ground-Truth fuer Reporting).
    // AWAITED: wenn der Insert fehlschlaegt, 500 zurueck. Dadurch feuert Meta-Pixel auf dem
    // Client nicht und Postgres bleibt konsistent mit Pixel-Count. Akzeptiertes Risiko bei
    // Retry: moegliche Sheets-Duplikate (manuelle Dedup durch Kunde).
    const dashUrl = import.meta.env.DASHBOARD_LEADS_URL;
    const dashKey = import.meta.env.DASHBOARD_LEADS_KEY;
    if (dashUrl && dashKey) {
      const dashRes = await fetch(dashUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': dashKey },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone || '',
          lp_slug: lpSlug,
          lp_name: data.lp_name || lpSlug,
          quiz_answers: data.answers || {},
        }),
      }).catch((e: any) => {
        console.error('Dashboard Lead Fehler:', e?.message || e);
        return null as unknown as Response;
      });
      if (!dashRes || !dashRes.ok) {
        const detail = dashRes ? await dashRes.text().catch(() => '') : 'network';
        console.error('Dashboard Lead Insert non-OK:', dashRes?.status, detail);
        return new Response(JSON.stringify({ error: 'Lead-CRM-Insert fehlgeschlagen' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Synthetisches lead_submit-Event fuer Attribution/CR-Sanity. Fire-and-forget.
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
