import type { APIRoute } from 'astro';
import { google } from 'googleapis';

// Recruiting-API: Bewerbungen aus den Recruiting-Funneln (admin/kundenbetreuung/scbewerbung).
// Schreibt in EIN gemeinsames Recruiting-Sheet.
// WICHTIG: KEIN Push an Dashboard-CRM (DASHBOARD_LEADS_URL). Recruiting-Leads sind getrennt
// vom regulären Lead-Funnel.

// Ein Sheet für alle 3 Funnel.
// Schema: Datum | Funnel | Vorname | Nachname | Email | Telefon | Q1 | Q2 | Q3 | Datenschutz
const RECRUITING_SHEET_ID =
  import.meta.env.RECRUITING_SHEET_ID || '15eBPYYMYTo2Uq99VGCiT7eY6CqRpiK1p1LWrJ7T1sxs';
const RECRUITING_RANGE = 'Tabellenblatt1!A:J';

const FUNNEL_LABELS: Record<string, string> = {
  'recruiting-admin': 'Sachbearbeiter Administration',
  'recruiting-kundenbetreuung': 'Coach Ernährung/Bewegung/Mindset',
  'recruiting-scbewerbung': 'Setter / Closer',
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

    const slug = (data.lp_slug || '').toString();
    if (!FUNNEL_LABELS[slug]) {
      return new Response(JSON.stringify({ error: 'Unbekannter Funnel' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Datum (Schweizer Zeit)
    const datum = new Date().toLocaleString('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Zurich',
    });

    // Vorname / Nachname aus Vollname
    const fullName = (data.name || '').trim();
    const parts = fullName.split(/\s+/);
    const vorname = parts[0] || '';
    const nachname = parts.slice(1).join(' ') || '';

    const a = data.answers || {};
    const q1 = (a.q1 || '').toString();
    const q2 = Array.isArray(a.q2) ? a.q2.join(' | ') : (a.q2 || '').toString();
    const q3 = Array.isArray(a.q3) ? a.q3.join(' | ') : (a.q3 || '').toString();
    const datenschutz = data.datenschutz ? 'Ja' : '';

    const row = [
      datum,
      FUNNEL_LABELS[slug],
      vorname,
      nachname,
      data.email,
      data.phone,
      q1,
      q2,
      q3,
      datenschutz,
    ];

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: import.meta.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: (import.meta.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Tabellenblatt-Name dynamisch ueber Spreadsheet-Metadata holen (erstes Sheet).
    // Verhindert 404 wenn der Tab nicht "Tabellenblatt1" heisst.
    const meta = await sheets.spreadsheets.get({ spreadsheetId: RECRUITING_SHEET_ID });
    const firstSheetName = meta.data.sheets?.[0]?.properties?.title || 'Tabellenblatt1';
    const lastColLetter = (RECRUITING_RANGE.split(':')[1] || 'J').replace(/[^A-Z]/g, '') || 'J';
    const fullRange = `${firstSheetName}!A:${lastColLetter}`;
    const sheetName = firstSheetName;
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: RECRUITING_SHEET_ID,
      range: fullRange,
    });
    const usedRows = (existing.data.values || []).length;
    const nextRow = usedRows + 1;
    const writeRange = `${sheetName}!A${nextRow}:${lastColLetter}${nextRow}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId: RECRUITING_SHEET_ID,
      range: writeRange,
      valueInputOption: 'RAW',
      requestBody: { values: [row] },
    });

    // Synthetisches recruiting_submit-Event für Dashboard-Aggregation. Fire-and-forget.
    // KEIN Push an DASHBOARD_LEADS_URL: Recruiting-Bewerbungen sind getrennt vom CRM-Lead-Flow.
    fetch(new URL('/api/track', request.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'recruiting_submit',
        lp: slug,
        session: data.session_id || data.session || 'server-side',
        schema_version: 'v1',
      }),
    }).catch(() => {});

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Recruiting API Fehler:', err?.message || err);
    const debug = new URL(request.url).searchParams.get('debug') === '1';
    const body = debug
      ? { error: 'Interner Fehler', detail: err?.message || String(err), code: err?.code }
      : { error: 'Interner Fehler' };
    return new Response(JSON.stringify(body), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
