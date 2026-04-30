import type { APIRoute } from 'astro';

// Liefert eine .ics-Kalenderdatei fuer das Entzuendungen-Webinar.
// Genutzt von /danke-entzuendungen/ als Apple/Outlook-Fallback zum Google-Calendar-Link.
export const GET: APIRoute = async () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fit on Time//Entzuendungen Webinar//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:entzuendungen-webinar-2026-05-12@fitontime.ch',
    'DTSTAMP:20260430T180000Z',
    'DTSTART:20260512T160000Z',
    'DTEND:20260512T173000Z',
    'SUMMARY:Fit on Time: Entzuendungs-Webinar (Live)',
    'DESCRIPTION:Live-Webinar von Fit on Time. Zugang ueber https://workshop.fitontime.ch (Link wurde dir per WhatsApp und E-Mail zugesendet).',
    'LOCATION:Online (workshop.fitontime.ch)',
    'URL:https://workshop.fitontime.ch',
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Fit on Time Webinar startet in 30 Minuten',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="fit-on-time-webinar.ics"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
