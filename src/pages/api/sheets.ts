// API-Route: Lead-Daten an Google Sheets senden (via Service Account)
import type { APIRoute } from 'astro';
import { google } from 'googleapis';

const SHEET_ID = '1pKSK2fB3tjL9sxHMbM95a3NGdHZyeW0g29sIYnzh4js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    if (!data.name || !data.email) {
      return new Response(JSON.stringify({ error: 'Name und E-Mail sind Pflicht' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Google Auth via Service Account
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: import.meta.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: (import.meta.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Datum (Schweizer Zeit)
    const datum = new Date().toLocaleString('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Zurich',
    });

    const a = data.answers || {};
    const row = [
      datum,
      data.name,
      data.email,
      data.phone || '',
      a.q1 || '',
      a.q2 || '',
      a.q3 || '',
      a.q4 || '',
      a.q5 || '',
      a.q6 || '',
      a.q7 || '',
      a.q8 || '',
      a.q9 || '',
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Tabellenblatt1!A:M',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });

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
