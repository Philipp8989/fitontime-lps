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

      await sheets.spreadsheets.values.append({
        spreadsheetId: config.id,
        range: config.range,
        valueInputOption: 'RAW',
        requestBody: { values: [config.buildRow(datum, data)] },
      });
    }

    // Lead an zentrale Dashboard-API senden (Notification + CRM laeuft dort)
    const dashUrl = import.meta.env.DASHBOARD_LEADS_URL;
    const dashKey = import.meta.env.DASHBOARD_LEADS_KEY;
    if (dashUrl && dashKey) {
      fetch(dashUrl, {
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
      }).catch((e: any) => console.error('Dashboard Lead Fehler:', e));
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
