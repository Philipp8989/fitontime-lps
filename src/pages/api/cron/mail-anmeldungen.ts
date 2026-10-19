// Mail-Anmeldungen-Sync: Kevins Liste "Mail Anmeldungen Workshop Oneclick" (Ein-Klick aus seinen Mails)
// landet sonst nicht in der Reset-Abend-Gesamtliste. Läuft per Vercel-Cron alle 5 Minuten.
//
// Quelle: Owner Kevin, Link-Freigabe "Bearbeiten", Spalten Vorname | Nachname | Mail | Tel-Nr.
// Ziel: Reset-Abend-Anmeldungen, Tab Leads (gleiche Spalten wie SHEETS['webinar'] in api/sheets.ts).
// Doppelte E-Mails und Testzeilen bleiben draussen. Kein CRM, kein Meta-Lead (wie Ein-Klick in api/sheets.ts).
//
// Auth: Vercel-Cron (Bearer CRON_SECRET) oder ?key=<DASHBOARD_KEY> für manuelle Läufe.

import type { APIRoute } from 'astro';
import { google } from 'googleapis';
import { normalizePhone } from '../../../lib/phone';

export const prerender = false;

const QUELLE_ID = '1AmWUkvlW8BLI_Vf1G1ldaRJWk1ssgpDMe8pPghUka3M';
const ZIEL_ID = '1UGeHsRfG99zxe2YEEuKuZpqE_33ctjdGTNnKouL5M04';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const istTest = (...felder: string[]) => /test/i.test(felder.join(' '));

export const GET: APIRoute = async ({ request, url }) => {
  // Vercel-Cron schickt Authorization: Bearer <CRON_SECRET> (kein x-vercel-cron-Header)
  const cronSecret = import.meta.env.CRON_SECRET;
  const isVercelCron = !!cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`;
  const dashKey = import.meta.env.DASHBOARD_KEY;
  if (!isVercelCron && (!dashKey || url.searchParams.get('key') !== dashKey)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: import.meta.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (import.meta.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const [quelle, ziel] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: QUELLE_ID, range: 'A2:D' }),
    sheets.spreadsheets.values.get({ spreadsheetId: ZIEL_ID, range: 'Leads!D2:D' }),
  ]);

  const vorhanden = new Set((ziel.data.values || []).map((r) => String(r[0] || '').trim().toLowerCase()));
  const datum = new Date().toLocaleString('de-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Zurich',
  });

  const neu: string[][] = [];
  for (const [vorname = '', nachname = '', mail = '', tel = ''] of quelle.data.values || []) {
    const email = String(mail).trim().toLowerCase();
    if (!email.includes('@') || vorhanden.has(email) || istTest(vorname, nachname, email)) continue;
    neu.push([datum, String(vorname).trim(), String(nachname).trim(), email, normalizePhone(tel), 'mail', 'Ein-Klick', '']);
    vorhanden.add(email);
  }

  if (neu.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: ZIEL_ID,
      range: 'Leads!A:A',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: neu },
    });
  }

  return json({ ok: true, quelle: (quelle.data.values || []).length, neu: neu.length });
};
