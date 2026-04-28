// HR-tauglicher Recruiting-Sheet-Setup.
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
const HEADER = [
  'Datum',
  'Status',
  'Stelle',
  'Vorname',
  'Nachname',
  'Email',
  'Telefon',
  'Q1: Wichtigstes',
  'Q2: Was bringst du mit',
  'Q3: 2-Jahres-Ziel',
  'Notiz (intern)',
  'DSGVO',
];
const STATUS_OPTIONS = ['Neu eingegangen', 'In Prüfung', 'Gespräch vereinbart', 'Abgesagt', 'Eingestellt'];
const COL_WIDTHS = [110, 160, 200, 120, 130, 220, 140, 200, 320, 240, 320, 80];

const auth = new google.auth.GoogleAuth({
  credentials: { client_email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: env.GOOGLE_PRIVATE_KEY },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
const sheetTitle = meta.data.sheets[0].properties.title;
const sheetGid = meta.data.sheets[0].properties.sheetId;
console.log(`Sheet: ${sheetTitle} (gid ${sheetGid})`);

const all = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${sheetTitle}!A:L` });
const rows = all.data.values || [];
console.log(`Aktuelle Zeilen: ${rows.length}`);
rows.forEach((r, i) => console.log(`  ${i+1}: ${r.slice(0, 4).join(' | ')}`));

// 1. Sheet leeren
await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: `${sheetTitle}!A:L` });
console.log('\n→ Sheet komplett geleert');

// 2. Header schreiben
await sheets.spreadsheets.values.update({
  spreadsheetId: SHEET_ID,
  range: `${sheetTitle}!A1:L1`,
  valueInputOption: 'RAW',
  requestBody: { values: [HEADER] },
});
console.log('→ Header-Row geschrieben');

// 3. Formatierung + Validation + Conditional Formatting + Filter
const statusColor = (r, g, b) => ({ red: r, green: g, blue: b });
const statusColors = {
  'Neu eingegangen': statusColor(0.85, 0.93, 1.0),       // hellblau
  'In Prüfung': statusColor(1.0, 0.95, 0.7),              // gelb
  'Gespräch vereinbart': statusColor(1.0, 0.86, 0.7),     // orange
  'Abgesagt': statusColor(0.92, 0.92, 0.92),              // grau
  'Eingestellt': statusColor(0.78, 0.95, 0.81),           // grün
};

const requests = [
  // Header bold + farbig + zentriert
  {
    repeatCell: {
      range: { sheetId: sheetGid, startRowIndex: 0, endRowIndex: 1 },
      cell: {
        userEnteredFormat: {
          textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
          backgroundColor: { red: 0.16, green: 0.36, blue: 0.66 },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
          padding: { top: 6, bottom: 6, left: 8, right: 8 },
        },
      },
      fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment,padding)',
    },
  },
  // Header gefroren + Filter aktivieren
  {
    updateSheetProperties: {
      properties: { sheetId: sheetGid, gridProperties: { frozenRowCount: 1 } },
      fields: 'gridProperties.frozenRowCount',
    },
  },
  {
    setBasicFilter: {
      filter: { range: { sheetId: sheetGid, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: 12 } },
    },
  },
  // Status-Spalte (Index 1 = Spalte B): Dropdown-Validation
  {
    setDataValidation: {
      range: { sheetId: sheetGid, startRowIndex: 1, startColumnIndex: 1, endColumnIndex: 2 },
      rule: {
        condition: {
          type: 'ONE_OF_LIST',
          values: STATUS_OPTIONS.map(v => ({ userEnteredValue: v })),
        },
        showCustomUi: true,
        strict: false,
      },
    },
  },
  // Zeilenhoehe + Wrap fuer Q-Spalten und Notiz
  {
    repeatCell: {
      range: { sheetId: sheetGid, startRowIndex: 1, startColumnIndex: 7, endColumnIndex: 11 },
      cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'TOP' } },
      fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)',
    },
  },
];

// Spaltenbreiten setzen
COL_WIDTHS.forEach((w, i) => {
  requests.push({
    updateDimensionProperties: {
      range: { sheetId: sheetGid, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
      properties: { pixelSize: w },
      fields: 'pixelSize',
    },
  });
});

// Conditional Formatting fuer Status-Werte (auf Spalte B)
STATUS_OPTIONS.forEach((status, idx) => {
  requests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId: sheetGid, startRowIndex: 1, startColumnIndex: 1, endColumnIndex: 2 }],
        booleanRule: {
          condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: status }] },
          format: { backgroundColor: statusColors[status] || { red: 1, green: 1, blue: 1 } },
        },
      },
      index: idx,
    },
  });
});

await sheets.spreadsheets.batchUpdate({
  spreadsheetId: SHEET_ID,
  requestBody: { requests },
});
console.log('→ Header formatiert (fett, blau, gefroren), Filter aktiv');
console.log('→ Status-Dropdown gesetzt');
console.log(`→ Conditional-Formatting: ${STATUS_OPTIONS.length} Status-Farben`);
console.log('→ Spaltenbreiten + Wrap konfiguriert');
console.log('\nFertig.');
