// Einmaliges Setup-Script für das MSM-Leads Sheet.
// Legt benötigte Tabs an, setzt Header, formatiert.
// Run: node scripts/setup-msm-sheet.mjs

import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.vercel');
const envText = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/);
  if (m) env[m[1]] = m[2];
}

const SHEET_ID = '1yIFBbgn8kKcYpbDHQsz7SQZVf2vU7SBkeWWtHGdAYWY';

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: (env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

const HEADERS = [
  'Datum',
  'Vorname',
  'Email',
  'Telefon',
  'Score',
  'Stufe',
  'Stufe-Name',
  'Kritische Dimension',
  'Krit-%',
  'GLP1',
  'Alter',
  'Ziel (Freitext)',
  'Alltag',
  'Versuche',
  'Buchungsstatus',
  'Termin',
  'Setter-Note',
];

async function main() {
  // 1. Sheet-Metadata lesen
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existingTabs = (meta.data.sheets || []).map((s) => s.properties.title);
  console.log('Existing Tabs:', existingTabs);

  // 2. "Leads"-Tab anlegen, falls nicht vorhanden
  if (!existingTabs.includes('Leads')) {
    console.log('Creating Tab: Leads');
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: 'Leads', gridProperties: { rowCount: 1000, columnCount: 20 } },
            },
          },
        ],
      },
    });
  }

  // 3. Header in A1:Q1 setzen
  console.log('Setting headers A1:Q1');
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'Leads!A1:Q1',
    valueInputOption: 'RAW',
    requestBody: { values: [HEADERS] },
  });

  // 4. Header formatieren: Bold + Hintergrund + Freeze erste Zeile
  const freshMeta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const leadsSheet = freshMeta.data.sheets.find((s) => s.properties.title === 'Leads');
  const sheetId = leadsSheet.properties.sheetId;

  console.log('Formatting header row + freezing');
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 17 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                backgroundColor: { red: 0.11, green: 0.45, blue: 0.82 },
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
              },
            },
            fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment)',
          },
        },
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
        {
          // Spaltenbreiten setzen (grob, damit alles lesbar ist)
          updateDimensionProperties: {
            range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
            properties: { pixelSize: 140 },
            fields: 'pixelSize',
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 5 },
            properties: { pixelSize: 120 },
            fields: 'pixelSize',
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: 'COLUMNS', startIndex: 11, endIndex: 12 },
            properties: { pixelSize: 280 },
            fields: 'pixelSize',
          },
        },
      ],
    },
  });

  // 5. Dashboard-Tab (optional, KPI-Zusammenfassung)
  if (!existingTabs.includes('Dashboard')) {
    console.log('Creating Tab: Dashboard');
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: 'Dashboard', index: 0, gridProperties: { rowCount: 40, columnCount: 5 } },
            },
          },
        ],
      },
    });

    const dashValues = [
      ['MSM-Funnel Dashboard', '', ''],
      ['', '', ''],
      ['Kennzahl', 'Wert', 'Formel-Kommentar'],
      ['Leads gesamt', '=COUNTA(Leads!B2:B)', 'Alle Einträge mit Vorname'],
      ['Stufe 1 (Frühwarnung)', '=COUNTIF(Leads!F:F;1)', ''],
      ['Stufe 2 (Aktiv)', '=COUNTIF(Leads!F:F;2)', ''],
      ['Stufe 3 (Cascade)', '=COUNTIF(Leads!F:F;3)', ''],
      ['Stufe 4 (Vollbild)', '=COUNTIF(Leads!F:F;4)', ''],
      ['GLP-1 Leads', '=COUNTIF(Leads!J:J;"Ja")', 'Ozempic/Wegovy/Mounjaro-Anwenderinnen'],
      ['Ø Score', '=IFERROR(AVERAGE(Leads!E:E);0)', ''],
      ['Gebuchte Termine', '=COUNTIF(Leads!O:O;"gebucht")', 'Manuell oder via Zapier'],
      ['Buchungsrate', '=IFERROR(COUNTIF(Leads!O:O;"gebucht")/COUNTA(Leads!B2:B);0)', 'Als Prozent formatieren'],
      ['', '', ''],
      ['Top Dimensionen:', '', ''],
      ['Schlaf & Regeneration', '=COUNTIF(Leads!H:H;"Schlaf & Regeneration")', ''],
      ['Muskel & Kraft', '=COUNTIF(Leads!H:H;"Muskel & Kraft")', ''],
      ['Gelenk & Struktur', '=COUNTIF(Leads!H:H;"Gelenk & Struktur")', ''],
      ['Fettverteilung', '=COUNTIF(Leads!H:H;"Fettverteilung")', ''],
      ['Energie & Stoffwechsel', '=COUNTIF(Leads!H:H;"Energie & Stoffwechsel")', ''],
      ['Stress & Nervensystem', '=COUNTIF(Leads!H:H;"Stress & Nervensystem")', ''],
      ['Frustration & Historie', '=COUNTIF(Leads!H:H;"Frustration & Historie")', ''],
    ];
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Dashboard!A1:C' + dashValues.length,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: dashValues },
    });

    const freshMeta2 = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const dashSheet = freshMeta2.data.sheets.find((s) => s.properties.title === 'Dashboard');
    const dashId = dashSheet.properties.sheetId;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            mergeCells: {
              range: { sheetId: dashId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 3 },
              mergeType: 'MERGE_ALL',
            },
          },
          {
            repeatCell: {
              range: { sheetId: dashId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 3 },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true, fontSize: 16, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  backgroundColor: { red: 0.11, green: 0.45, blue: 0.82 },
                  horizontalAlignment: 'CENTER',
                },
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)',
            },
          },
          {
            repeatCell: {
              range: { sheetId: dashId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 3 },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true },
                  backgroundColor: { red: 0.92, green: 0.95, blue: 0.99 },
                },
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor)',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: dashId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
              properties: { pixelSize: 220 },
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: dashId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
              properties: { pixelSize: 100 },
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: dashId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 },
              properties: { pixelSize: 260 },
              fields: 'pixelSize',
            },
          },
        ],
      },
    });
  }

  // 6. Default-Tabs "Tabellenblatt1" / "Sheet1" entfernen (wenn vorhanden und leer)
  const freshMeta3 = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const junk = freshMeta3.data.sheets.find(
    (s) => ['Tabellenblatt1', 'Sheet1', 'Blatt1'].includes(s.properties.title)
  );
  if (junk) {
    console.log('Removing default tab:', junk.properties.title);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ deleteSheet: { sheetId: junk.properties.sheetId } }] },
    });
  }

  console.log('\n✓ Sheet-Setup komplett.');
  console.log('Link: https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit');
}

main().catch((e) => {
  console.error('Error:', e.message || e);
  process.exit(1);
});
