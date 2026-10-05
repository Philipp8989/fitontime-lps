// Reset-Abend (Webinar Oktober 2026): eine Quelle für Seiten, Kalender-Datei und Mails.
// Termin ändern = nur hier. 27.10. liegt nach der Zeitumstellung (25.10.), also MEZ = UTC+1.

export const WEBINAR = {
  slug: 'webinar',
  titel: 'Der Reset-Abend',
  untertitel: 'Die 3 Bremsen, die deinen Körper ab 40 festhalten. Und wie du sie löst.',
  startUtc: '2026-10-27T18:00:00Z',
  endeUtc: '2026-10-27T19:30:00Z',
  datumText: 'Dienstag, 27. Oktober',
  zeitText: '19:00 bis 20:30 Uhr',
  ort: 'Live online, Link kommt per Mail und WhatsApp',
};

// Zugangslink zum Live-Raum. Solange er fehlt, sagen Kalender und Seite "kommt per Mail".
export function joinUrl(): string {
  return (import.meta.env.PUBLIC_WEBINAR_JOIN_URL || '').trim();
}

// 20261027T180000Z
function icsStamp(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function beschreibung(): string {
  const link = joinUrl();
  return [
    WEBINAR.untertitel,
    link ? `Hier kommst du rein: ${link}` : 'Den Link zum Live-Raum bekommst du per Mail und WhatsApp.',
    'Kostenlos. Mit Fabian Osterwalder und Filip Mursic von Fit on Time.',
  ].join('\n\n');
}

// Kalender-Datei für Apple und Outlook
export function buildIcs(): string {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fit on Time//Reset-Abend//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:reset-abend-2026-10-27@fitontime.ch',
    `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(WEBINAR.startUtc)}`,
    `DTEND:${icsStamp(WEBINAR.endeUtc)}`,
    `SUMMARY:${esc(WEBINAR.titel + ' mit Fit on Time')}`,
    `DESCRIPTION:${esc(beschreibung())}`,
    `LOCATION:${esc(joinUrl() || WEBINAR.ort)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Der Reset-Abend startet in einer Stunde',
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-PT10M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Der Reset-Abend startet in 10 Minuten',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

// Ein Klick in den Google Kalender
export function googleCalUrl(): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: WEBINAR.titel + ' mit Fit on Time',
    dates: `${icsStamp(WEBINAR.startUtc)}/${icsStamp(WEBINAR.endeUtc)}`,
    details: beschreibung(),
    location: joinUrl() || WEBINAR.ort,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
