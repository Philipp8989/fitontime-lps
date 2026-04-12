// API-Route: Lead-Daten an Google Sheets senden
import type { APIRoute } from 'astro';
import { google } from 'googleapis';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    // Pflichtfelder prüfen
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
    const sheetId = import.meta.env.GOOGLE_SHEET_ID || '1pKSK2fB3tjL9sxHMbM95a3NGdHZyeW0g29sIYnzh4js';

    // Datum formatieren (DD.MM.YYYY HH:MM)
    const now = new Date();
    const datum = now.toLocaleString('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Zurich',
    });

    // Zeile zusammenbauen — Reihenfolge wie im Sheet
    // A: Datum | B: Name | C: E-Mail | D: Telefon
    // E-M: Quiz-Antworten (Wie schwer? bis Ziel 3M)
    const row = [
      datum,
      data.name,
      data.email,
      data.phone || '',
      data.answers?.q1 || '',
      data.answers?.q2 || '',
      data.answers?.q3 || '',
      data.answers?.q4 || '',
      data.answers?.q5 || '',
      data.answers?.q6 || '',
      data.answers?.q7 || '',
      data.answers?.q8 || '',
      data.answers?.q9 || '',
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
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
