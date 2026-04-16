import type { APIRoute } from 'astro';
import { google } from 'googleapis';
import { Resend } from 'resend';

const SHEET_ID = '1pKSK2fB3tjL9sxHMbM95a3NGdHZyeW0g29sIYnzh4js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    if (!data.name || !data.email || !data.phone) {
      return new Response(JSON.stringify({ error: 'Name, E-Mail und Telefon sind Pflicht' }), {
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
      valueInputOption: 'RAW',
      requestBody: { values: [row] },
    });

    const resend = new Resend(import.meta.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'Fit on Time Leads <onboarding@resend.dev>',
      to: 'analyse@fitontime.ch',
      subject: `Neuer Lead: ${data.name}`,
      html: `
        <h2>Neuer Lead eingegangen</h2>
        <table style="border-collapse:collapse">
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Name</td><td>${data.name}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold">E-Mail</td><td>${data.email}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Telefon</td><td>${data.phone}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Datum</td><td>${datum}</td></tr>
        </table>
      `,
    }).catch((e: any) => console.error('Resend Fehler:', e));

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
