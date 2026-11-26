// Direkter HubSpot-Eintrag für Funnels, deren Sheet nicht per Kevins Zapier angebunden ist.
// Macht dasselbe wie der Zap "Sheet -> HubSpot Create or Update Contact":
// neu = Kontakt mit Lifecycle "lead", bestehend = Quelle und Datumsfelder überschreiben.
// Deal und Setter-Rotation macht danach der HubSpot-Workflow "<Quelle> -> Deal erstellen".

const API = 'https://api.hubapi.com/crm/v3/objects/contacts';

// Der Zap schreibt die Uhrzeit in der Zeitzone des Zapier-Kontos (US Central), Format "10/20/26 10:35AM".
function zapierStamp(d: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago', year: '2-digit', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true,
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.month}/${p.day}/${p.year} ${p.hour}:${p.minute}${p.dayPeriod}`;
}

async function hs(token: string, path: string, method: string, body: unknown) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HubSpot ${method} ${path} ${res.status}: ${data?.message || ''}`);
  return data;
}

export async function upsertHubspotContact(
  token: string,
  lead: { vorname: string; nachname: string; email: string; phone: string; quelle: string },
) {
  const now = new Date();
  const props: Record<string, string> = {
    firstname: lead.vorname,
    lastname: lead.nachname,
    phone: lead.phone,
    lead_quelle: lead.quelle,
    letze_eintragung_in_einen_funnel: zapierStamp(now),
    letzter_formularwiedereintrag: now.toISOString().slice(0, 10),
  };
  const found = await hs(token, '/search', 'POST', {
    filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: lead.email.trim().toLowerCase() }] }],
    limit: 1,
  });
  const id = found?.results?.[0]?.id;
  if (id) return hs(token, `/${id}`, 'PATCH', { properties: props });
  // Lifecycle nur bei neuen Kontakten, rückwärts (opportunity -> lead) lehnt HubSpot ab
  return hs(token, '', 'POST', { properties: { ...props, email: lead.email.trim(), lifecyclestage: 'lead' } });
}

// Notiz am Kontakt (z. B. Quiz-Antworten), damit der Setter mit dem Resultat eröffnen kann.
// Text wird escaped, Zeilen als <br> getrennt. 202 = Notiz zu Kontakt (HUBSPOT_DEFINED).
function esc(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
export async function addHubspotNote(token: string, contactId: string, titel: string, zeilen: string[]) {
  if (!zeilen.length) return;
  const body = `<b>${esc(titel)}</b><br>` + zeilen.map(esc).join('<br>');
  const res = await fetch('https://api.hubapi.com/crm/v3/objects/notes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { hs_timestamp: new Date().toISOString(), hs_note_body: body },
      associations: [{ to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] }],
    }),
  });
  if (!res.ok) throw new Error(`HubSpot Notiz ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
}
