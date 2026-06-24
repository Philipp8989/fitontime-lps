// monday.com-Anbindung Bewerbermanagement.
// Legt pro Bewerbung eine Karte im Board "Bewerbermanagement" (Gruppe "Neue Bewerbungen (Web)") an.
// Bewusst non-blocking gedacht: Aufrufer darf Fehler ignorieren, Google-Sheet bleibt Ground-Truth fuer HR.

const MONDAY_API = 'https://api.monday.com/v2';
const API_VERSION = '2024-01';

// Funnel-Slug -> Vakanz-Label im Board (Status-Spalte "Vakanz", status_1__1).
// Labels muessen exakt den im Board angelegten Optionen entsprechen (inkl. Tippfehler "Betreuuer").
const VAKANZ_BY_SLUG: Record<string, string> = {
  'recruiting-kundenbetreuung': 'Betreuuer (Coach)',
  'recruiting-admin': 'Admin',
  'recruiting-scbewerbung': 'Berater (Vertrieb)',
};

// Spalten-IDs im Board (einmalig per API ausgelesen, stabil).
const COL = {
  vorname: 'text__1',
  nachname: 'text_1__1',
  email: 'text2__1',
  telefon: 'text5__1',
  vakanz: 'status_1__1',
  status: 'status__1',
  stand: 'datum',
} as const;

type BewerberInput = {
  vorname: string;
  nachname: string;
  fullName: string;
  email: string;
  phone: string;
  slug: string;
  funnelLabel: string;
  q1?: string;
  q2?: string;
  q3?: string;
};

async function gql(token: string, query: string, variables: Record<string, unknown>) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(MONDAY_API, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
        'API-Version': API_VERSION,
      },
      body: JSON.stringify({ query, variables }),
      signal: ctrl.signal,
    });
    const json: any = await res.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    return json.data;
  } finally {
    clearTimeout(t);
  }
}

// Schweizer Datum (YYYY-MM-DD) fuer die "Stand"-Spalte.
function heuteCH(): string {
  // de-CH liefert TT.MM.JJJJ -> in ISO drehen
  const s = new Date().toLocaleDateString('de-CH', { timeZone: 'Europe/Zurich' });
  const [d, m, y] = s.split('.');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// Legt die Bewerber-Karte an + haengt die Quiz-Antworten als Update (Kommentar) an.
// Wirft bei Fehlern; Aufrufer entscheidet ueber Logging/Ignorieren.
export async function pushBewerberToMonday(input: BewerberInput): Promise<{ id: string }> {
  const token = (import.meta.env.MONDAY_TOKEN || '').trim();
  const board = (import.meta.env.MONDAY_BEWERBER_BOARD || '').trim();
  const group = (import.meta.env.MONDAY_BEWERBER_GROUP || '').trim();
  if (!token || !board || !group) throw new Error('MONDAY_TOKEN/BOARD/GROUP fehlen');

  const colValues: Record<string, unknown> = {
    [COL.vorname]: input.vorname,
    [COL.nachname]: input.nachname,
    [COL.email]: input.email,
    [COL.telefon]: input.phone,
    [COL.status]: { label: 'prüfen' },
    [COL.stand]: { date: heuteCH() },
  };
  const vakanz = VAKANZ_BY_SLUG[input.slug];
  if (vakanz) colValues[COL.vakanz] = { label: vakanz };

  const createQuery = `
    mutation ($board: ID!, $group: String!, $name: String!, $cols: JSON!) {
      create_item (board_id: $board, group_id: $group, item_name: $name, column_values: $cols, create_labels_if_missing: true) { id }
    }`;
  const created = await gql(token, createQuery, {
    board,
    group,
    name: input.fullName,
    cols: JSON.stringify(colValues),
  });
  const itemId = created?.create_item?.id;
  if (!itemId) throw new Error('create_item lieferte keine id');

  // Quiz-Antworten als Update anhaengen (nur wenn vorhanden).
  const lines = [
    `Quelle: ${input.funnelLabel} (${input.slug})`,
    input.q1 ? `Frage 1: ${input.q1}` : '',
    input.q2 ? `Frage 2: ${input.q2}` : '',
    input.q3 ? `Frage 3: ${input.q3}` : '',
  ].filter(Boolean);
  if (lines.length) {
    const updQuery = `
      mutation ($item: ID!, $body: String!) {
        create_update (item_id: $item, body: $body) { id }
      }`;
    await gql(token, updQuery, { item: itemId, body: lines.join('\n') }).catch(() => {});
  }

  return { id: itemId };
}
