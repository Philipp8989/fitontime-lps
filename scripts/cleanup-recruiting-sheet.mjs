// Einmalig: Header-Row schreiben + alle TEST-CLAUDE Zeilen loeschen.
// Run: node scripts/cleanup-recruiting-sheet.mjs

import { google } from 'googleapis';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.tmp', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const [k, ...v] = l.split('=');
      return [k.trim(), v.join('=').replace(/^"|"$/g, '').replace(/\\n/g, '\n').trim()];
    }),
);

const SHEET_ID = env.RECRUITING_SHEET_ID;
const HEADER = ['Datum', 'Funnel', 'Vorname', 'Nachname', 'Email', 'Telefon', 'Q1: Wichtigstes', 'Q2: Was bringst du mit', 'Q3: 2-Jahres-Ziel', 'Datenschutz'];

const auth = new google.auth.GoogleAuth({
  credentials: { client_email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: env.GOOGLE_PRIVATE_KEY },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
const sheetTitle = meta.data.sheets[0].properties.title;
const sheetGid = meta.data.sheets[0].properties.sheetId;
console.log(`Sheet: ${sheetTitle} (gid ${sheetGid})`);

const all = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${sheetTitle}!A:J` });
const rows = all.data.values || [];
console.log(`Aktuelle Zeilen: ${rows.length}`);
rows.forEach((r, i) => console.log(`  ${i+1}: ${r.slice(0, 4).join(' | ')}`));

// 1. Test-Zeilen + alte Daten loeschen (alles clearen)
await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: `${sheetTitle}!A:J` });
console.log('\n→ Sheet komplett geleert');

// 2. Header schreiben
await sheets.spreadsheets.values.update({
  spreadsheetId: SHEET_ID,
  range: `${sheetTitle}!A1:J1`,
  valueInputOption: 'RAW',
  requestBody: { values: [HEADER] },
});
console.log('→ Header-Row geschrieben');

// 3. Header fett + grau einfaerben
await sheets.spreadsheets.batchUpdate({
  spreadsheetId: SHEET_ID,
  requestBody: {
    requests: [
      {
        repeatCell: {
          range: { sheetId: sheetGid, startRowIndex: 0, endRowIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.93, green: 0.93, blue: 0.95 } } },
          fields: 'userEnteredFormat(textFormat,backgroundColor)',
        },
      },
      {
        updateSheetProperties: {
          properties: { sheetId: sheetGid, gridProperties: { frozenRowCount: 1 } },
          fields: 'gridProperties.frozenRowCount',
        },
      },
    ],
  },
});
console.log('→ Header formatiert (fett, gefroren)');
console.log('\nFertig.');
