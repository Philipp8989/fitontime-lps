// Anmeldung beim Reset-Abend zusätzlich an WebinarJam melden.
// Unser Formular bleibt die Quelle (Sheet, Dashboard, Meta). WebinarJam verschickt
// Bestätigung, Erinnerungen und den persönlichen Link zum Live-Raum (Kevins Mails).
// API: POST /webinarjam/register mit Key aus WebinarJam (Advanced integration, API custom integration).
// Felder laut Test 09.10.: phone_country_code + phone (nicht phone_number). Telefon ist in WebinarJam Pflicht.
// Env: WEBINARJAM_API_KEY (Pflicht), WEBINARJAM_WEBINAR_ID (Standard 11), WEBINARJAM_SCHEDULE (Standard 50 = Di 27.10. 19:00).

const REGISTER_URL = 'https://api.webinarjam.com/webinarjam/register';

// +41791234567 → ['+41', '791234567']. Unbekannte Vorwahl: Nummer ohne Ländercode weglassen.
function splitPhone(phone: string): [string, string] {
  const m = (phone || '').match(/^\+(41|49|43|423|33|39)(\d{6,})$/);
  return m ? ['+' + m[1], m[2]] : ['', ''];
}

export interface JamLead { name: string; email: string; phone?: string; ip?: string }

// Gibt den persönlichen Link zum Live-Raum zurück, leer bei Fehler.
export async function registerWebinarJam(lead: JamLead): Promise<string> {
  const key = import.meta.env.WEBINARJAM_API_KEY;
  if (!key) return ''; // nicht eingerichtet: still überspringen
  const [vorname, ...rest] = String(lead.name || '').trim().split(/\s+/);
  const [cc, nr] = splitPhone(lead.phone || '');
  const body = new URLSearchParams({
    api_key: key,
    webinar_id: import.meta.env.WEBINARJAM_WEBINAR_ID || '11',
    schedule: import.meta.env.WEBINARJAM_SCHEDULE || '50',
    first_name: vorname || 'Teilnehmerin',
    last_name: rest.join(' '),
    email: lead.email,
  });
  if (lead.ip) body.set('ip_address', lead.ip);
  if (cc && nr) { body.set('phone_country_code', cc); body.set('phone', nr); }

  // 3 Versuche wie beim Dashboard: sofort, +1.5s, +5s
  for (const wait of [0, 1500, 5000]) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try {
      const res = await fetch(REGISTER_URL, { method: 'POST', body });
      const json: any = await res.json().catch(() => ({}));
      if (res.ok && json.status === 'success') return json.user?.live_room_url || '';
      console.error('[webinarjam] Anmeldung abgelehnt', res.status, JSON.stringify(json).slice(0, 300));
      if (res.status >= 400 && res.status < 500) return ''; // falsche Daten: kein Retry
    } catch (e: any) {
      console.error('[webinarjam] Fehler', e?.message || e);
    }
  }
  console.error('[webinarjam] FINAL FAIL, nur im Sheet:', lead.email);
  return '';
}
