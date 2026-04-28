import type { APIRoute } from 'astro';
import { google } from 'googleapis';

// Recruiting-API: Bewerbungen aus den Recruiting-Funneln (admin/kundenbetreuung/scbewerbung).
// 1. Schreibt in HR-Sheet (15eBPYY...sxs) mit Status="Neu eingegangen"
// 2. Pusht an Dashboard-CRM (/api/leads) mit is_recruiting-Flag
//    → Dashboard handhabt Notification (nur job@fitontime.ch, kein Admin-CC)
// → Notification kommt NICHT mehr direkt aus diesem Repo (zentral im Dashboard)

// Sheet (HR-Layout): Datum | Status | Stelle | Vorname | Nachname | Email | Telefon | Q1 | Q2 | Q3 | Notiz | DSGVO
const RECRUITING_SHEET_ID = (
  import.meta.env.RECRUITING_SHEET_ID || '15eBPYYMYTo2Uq99VGCiT7eY6CqRpiK1p1LWrJ7T1sxs'
).trim();

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
    const funnelLabel = FUNNEL_LABELS[slug];

    // Sheet-Layout (HR-tauglich): Datum | Status | Stelle | Vorname | Nachname | Email | Telefon | Q1 | Q2 | Q3 | Notiz | DSGVO
    // Status startet immer auf "Neu eingegangen", HR aendert via Dropdown.
    // Notiz bleibt initial leer, HR fuellt manuell.
    const row = [datum, 'Neu eingegangen', funnelLabel, vorname, nachname, data.email, data.phone, q1, q2, q3, '', datenschutz];

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: import.meta.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: (import.meta.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Tabellenblatt-Name dynamisch ueber Spreadsheet-Metadata holen (erstes Sheet).
    const meta = await sheets.spreadsheets.get({ spreadsheetId: RECRUITING_SHEET_ID });
    const firstSheetName = meta.data.sheets?.[0]?.properties?.title || 'Tabellenblatt1';
    const fullRange = `${firstSheetName}!A:L`;
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: RECRUITING_SHEET_ID,
      range: fullRange,
    });
    const usedRows = (existing.data.values || []).length;
    const nextRow = usedRows + 1;
    const writeRange = `${firstSheetName}!A${nextRow}:L${nextRow}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId: RECRUITING_SHEET_ID,
      range: writeRange,
      valueInputOption: 'RAW',
      requestBody: { values: [row] },
    });

    // Push an Dashboard-CRM (Postgres-Lead + Notification).
    // is_recruiting-Flag: Dashboard nutzt customer.recruitingNotificationEmail (job@fitontime.ch),
    // SKIPed Admin-CC und reguläre customer.notificationEmail.
    const dashUrl = (import.meta.env.DASHBOARD_LEADS_URL || '').trim();
    const dashKey = (import.meta.env.DASHBOARD_LEADS_KEY || '').trim();
    if (dashUrl && dashKey) {
      const dashRes = await fetch(dashUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': dashKey },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone || '',
          lp_slug: slug,
          lp_name: funnelLabel,
          is_recruiting: true,
          quiz_answers: { q1, q2, q3 },
        }),
      }).catch((e: any) => {
        console.error('Dashboard Recruiting-Lead Fehler:', e?.message || e);
        return null as unknown as Response;
      });
      if (!dashRes || !dashRes.ok) {
        const detail = dashRes ? await dashRes.text().catch(() => '') : 'network';
        console.error('Dashboard Recruiting-Lead non-OK:', dashRes?.status, detail);
        // Nicht blockieren: Sheet ist Ground-Truth fuer HR. Dashboard-Insert kann manuell nachgeholt werden.
      }
    } else {
      console.error('Recruiting Dashboard-Push skipped: DASHBOARD_LEADS_URL/KEY fehlen');
    }

    // Synthetisches recruiting_submit-Event für Dashboard-Aggregation. Fire-and-forget.
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
