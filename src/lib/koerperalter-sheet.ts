// Sheet "FitonTime Körperalter Leads" (Owner Philipp, mit leads-writer@ geteilt).
// Eine Quelle für beide Wege: Formular (a, api/sheets) und WhatsApp-Lead (b, api/koerperalter-lead).
// Header: Datum | Vorname | Nachname | E-Mail | Telefon | Setter-Prio | Alter | Körperalter |
// Jahre drüber | Abnehmziel | Energie | Muskeltraining | Bauch | Schlaf | Zucker/Snacks | Variante
import { google } from 'googleapis';

export const KA_SHEET = {
  id: '1NfGgtGLwVRqThQ3GtUGrBtnHuFbHLENkx3mnr0pYYC0',
  range: 'Leads!A:P',
  buildRow: (datum: string, d: any) => {
    const a = d.answers || {};
    const parts = (d.name || '').trim().split(/\s+/);
    const vorname = parts[0] || '';
    const nachname = parts.slice(1).join(' ') || '';
    return [datum, vorname, nachname, d.email || '', d.phone || '', a.setter_prio || '',
      a.q1_label || '', a.koerperalter ?? '', a.jahre_drueber ?? '', a.q7_label || '',
      a.q2_label || '', a.q3_label || '', a.q4_label || '', a.q5_label || '', a.q6_label || '',
      a.lp_variant || 'a'];
  },
};

// Atomarer Append wie in api/sheets (A:A-Anker + INSERT_ROWS)
export async function appendKaRow(d: any): Promise<void> {
  const datum = new Date().toLocaleString('de-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Zurich',
  });
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: import.meta.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (import.meta.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  await google.sheets({ version: 'v4', auth }).spreadsheets.values.append({
    spreadsheetId: KA_SHEET.id,
    range: 'Leads!A:A',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [KA_SHEET.buildRow(datum, d)] },
  });
}
