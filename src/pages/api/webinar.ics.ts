import type { APIRoute } from 'astro';
import { buildIcs } from '../../lib/webinar';

// Kalender-Eintrag für Apple und Outlook. Verlinkt von /webinar/platz/ und aus allen Erinnerungs-Mails.
export const GET: APIRoute = () =>
  new Response(buildIcs(), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="reset-abend.ics"',
      'Cache-Control': 'public, max-age=300',
    },
  });
