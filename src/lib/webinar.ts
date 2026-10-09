// Reset-Abend (Webinar Oktober 2026): eine Quelle für Seiten, Kalender-Datei und Mails.
// Termin ändern = nur hier. 27.10. liegt nach der Zeitumstellung (25.10.), also MEZ = UTC+1.

export const WEBINAR = {
  slug: 'webinar',
  titel: 'Der Reset-Abend',
  untertitel: 'Die 4 Bremsen, die deinen Körper ab 40 festhalten. Und wie du sie löst.',
  startUtc: '2026-10-27T18:00:00Z',
  endeUtc: '2026-10-27T19:30:00Z',
  datumText: 'Dienstag, 27. Oktober',
  zeitText: '19:00 bis 20:30 Uhr',
  ort: 'Live online, Link kommt per Mail und WhatsApp',
};

// Aus welchem Funnel kommt sie? Der Link von der Dankeseite trägt ?q=<funnel-slug>.
// Die Anmeldeseite stellt dann ihr Thema nach oben (Einstieg + markierte Bremse).
// Neuer Funnel = eine Zeile hier, Seite und Sheet übernehmen den Rest.
export type Bremse = 'stoffwechsel' | 'insulin' | 'cortisol' | 'nerven';
export const QUELLEN: Record<string, { name: string; bremse: Bremse; einstieg: string }> = {
  'insulin-check': { name: 'Insulin-Check', bremse: 'insulin', einstieg: 'Du hast den Insulin-Check gemacht. Insulin bremst selten allein. Am Reset-Abend siehst du, was bei dir noch mitzieht, und was du ab dem nächsten Morgen anders machst.' },
  bauchfett: { name: 'Bauchfett-Check', bremse: 'insulin', einstieg: 'Du hast den Bauchfett-Check gemacht. Am Reset-Abend siehst du, warum der Bauch oft als Letztes geht, und welche Bremse ihn bei dir festhält.' },
  koerperalter: { name: 'Körperalter-Test', bremse: 'stoffwechsel', einstieg: 'Du kennst jetzt dein Körperalter. Am Reset-Abend siehst du, welche Bremsen es hochziehen, und wie du Jahre zurückholst.' },
  longevity: { name: 'Longevity-Check', bremse: 'stoffwechsel', einstieg: 'Du kennst jetzt dein Körperalter. Am Reset-Abend siehst du, welche Bremsen es hochziehen, und wie du Jahre zurückholst.' },
  'nach-der-spritze': { name: 'Spritzen-Check', bremse: 'stoffwechsel', einstieg: 'Mit oder ohne Spritze: Am Reset-Abend geht es darum, was dein Körper braucht, damit die Kilos auch danach wegbleiben.' },
  'figur-check': { name: 'Fettabbau-Check', bremse: 'stoffwechsel', einstieg: 'Du hast den Fettabbau-Check gemacht. Am Reset-Abend siehst du, warum dein Körper festhält, und welche Bremse du zuerst löst.' },
  'koerper-report': { name: 'Stoffwechsel-Check', bremse: 'stoffwechsel', einstieg: 'Du weisst jetzt, was deinen Stoffwechsel bremst. Am Reset-Abend siehst du, warum er selten allein bremst, und was du ab dem nächsten Morgen anders machst.' },
  'koerpertyp-test': { name: 'Körpertyp-Test', bremse: 'stoffwechsel', einstieg: 'Du kennst jetzt deinen Körpertyp. Am Reset-Abend siehst du, welche Bremse bei deinem Typ am häufigsten zu ist.' },
  'stoffwechsel-report': { name: 'Stoffwechsel-Report', bremse: 'stoffwechsel', einstieg: 'Du hast deinen Stoffwechsel-Report. Am Reset-Abend siehst du, warum der Stoffwechsel selten allein bremst.' },
  'ab-40': { name: 'Video', bremse: 'stoffwechsel', einstieg: 'Du hast gesehen, warum dein Körper ab 40 auf Speichern schaltet. Am Reset-Abend gehen wir live tiefer, mit echten Fällen.' },
  cortisol: { name: 'Cortisol-Check', bremse: 'cortisol', einstieg: 'Stress hält deinen Körper fest. Am Reset-Abend siehst du, wie Cortisol dabei mitspielt, und was es abends runterholt.' },
  'so-funktioniert-fot': { name: 'Video', bremse: 'stoffwechsel', einstieg: 'Du hast gesehen, wie Fit on Time arbeitet. Am Reset-Abend zeigen wir live, welche der vier Bremsen deinen Körper ab 40 festhält, und wie du sie löst.' },
  nervensystem: { name: 'Nervensystem-Check', bremse: 'nerven', einstieg: 'Du hast den Nervensystem-Check gemacht. Am Reset-Abend siehst du, warum ein Körper im Schutzmodus nicht abnimmt, und wie er wieder rauskommt.' },
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
