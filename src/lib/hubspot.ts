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
