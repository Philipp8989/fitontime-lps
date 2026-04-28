import type { APIRoute } from 'astro';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';

// Recruiting-API: Bewerbungen aus den Recruiting-Funneln (admin/kundenbetreuung/scbewerbung).
// Schreibt in EIN gemeinsames Recruiting-Sheet + Email-Notification an HR.
// WICHTIG: KEIN Push an Dashboard-CRM, KEINE Notification an Admin (Philipp).
// Recruiting-Bewerbungen sind komplett getrennt vom regulaeren Lead-Funnel.

// Empfaenger-Mail fuer Recruiting-Notifications, NUR diese Email, kein CC.
const HR_EMAIL = 'job@fitontime.ch';

// Ein Sheet für alle 3 Funnel.
// Schema: Datum | Funnel | Vorname | Nachname | Email | Telefon | Q1 | Q2 | Q3 | Datenschutz
// trim() weil Vercel-Env-Werte gerne Trailing-Newlines bekommen (zb durch echo-pipes)
const RECRUITING_SHEET_ID = (
  import.meta.env.RECRUITING_SHEET_ID || '15eBPYYMYTo2Uq99VGCiT7eY6CqRpiK1p1LWrJ7T1sxs'
).trim();
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

    // Email-Notification an HR (job@fitontime.ch). KEIN CC an Admin/Philipp.
    // Fire-and-forget: Sheet-Write ist Ground-Truth, Mail ist Best-Effort.
    const gmailUser = (import.meta.env.GMAIL_USER || '').trim();
    const gmailPass = (import.meta.env.GMAIL_APP_PASSWORD || '').trim();
    if (gmailUser && gmailPass) {
      const funnelLabel = FUNNEL_LABELS[slug];
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${RECRUITING_SHEET_ID}/edit`;
      const quizHtml = [
        ['Q1: Wichtigstes', q1],
        ['Q2: Was bringst du mit', q2],
        ['Q3: 2-Jahres-Ziel', q3],
      ]
        .filter(([, v]) => v)
        .map(([k, v]) => `<li><strong>${k}:</strong> ${v}</li>`)
        .join('');

      const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;max-width:560px;margin:0 auto">
          <h2 style="font-size:18px;font-weight:600;margin:0 0 4px">Neue Bewerbung: ${funnelLabel}</h2>
          <p style="font-size:13px;color:#86868b;margin:0 0 16px">Eingegangen am ${datum}</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#86868b">Name</td><td style="padding:6px 0">${vorname} ${nachname}</td></tr>
            <tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#86868b">E-Mail</td><td style="padding:6px 0"><a href="mailto:${data.email}" style="color:#0071e3">${data.email}</a></td></tr>
            <tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#86868b">Telefon</td><td style="padding:6px 0"><a href="tel:${data.phone}" style="color:#0071e3">${data.phone}</a></td></tr>
            <tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#86868b">Stelle</td><td style="padding:6px 0"><strong>${funnelLabel}</strong></td></tr>
          </table>
          ${quizHtml ? `<h3 style="font-size:14px;font-weight:600;margin:18px 0 8px;color:#86868b">Quiz-Antworten</h3><ul style="margin:0;padding-left:18px;font-size:14px">${quizHtml}</ul>` : ''}
          <p style="font-size:12px;color:#86868b;margin:20px 0 0">Alle Bewerbungen im <a href="${sheetUrl}" style="color:#0071e3">Recruiting-Sheet</a></p>
        </div>
      `;

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass },
      });
      transporter
        .sendMail({
          from: `"Fit on Time Bewerbungen" <${gmailUser}>`,
          to: HR_EMAIL,
          replyTo: data.email,
          subject: `Neue Bewerbung — ${funnelLabel} — ${vorname} ${nachname}`.trim(),
          html,
        })
        .catch((e: any) => {
          console.error('Recruiting-Notification fehlgeschlagen:', e?.message || e);
        });
    } else {
      console.error('Recruiting-Notification skipped: GMAIL_USER/PASS fehlen');
    }

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
