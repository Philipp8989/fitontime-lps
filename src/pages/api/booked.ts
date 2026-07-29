import type { APIRoute } from 'astro';

/**
 * Buchungsmeldung von der Ergebnisseite an den WhatsApp-Bot.
 *
 * Hintergrund: Der Bot schreibt Quiz-Leads 30 Minuten nach dem Opt-in an. Wer
 * in diesen 30 Minuten auf der Ergebnisseite selbst einen Termin bucht, soll
 * KEINE WhatsApp-Nachricht mehr bekommen. Das YCBM-Widget meldet die Buchung
 * im Browser, diese Route reicht sie serverseitig an den Bot weiter, damit das
 * gemeinsame Secret nie im Client landet.
 *
 * Der Bot-Endpoint ist idempotent: mehrfache Meldungen sind unschaedlich.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const email = String(data?.email || '').trim();
    const phone = String(data?.phone || '').trim();

    if (!email && !phone) {
      return new Response(JSON.stringify({ ok: true, status: 'no_contact' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const botUrl = import.meta.env.BOT_INTAKE_URL;
    const botSecret = import.meta.env.BOT_INTAKE_SECRET;
    if (!botUrl || !botSecret) {
      return new Response(JSON.stringify({ ok: true, status: 'not_configured' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // BOT_INTAKE_URL zeigt auf /intake/quiz-lead, der Buchungs-Endpoint liegt daneben.
    const bookedUrl = botUrl.replace(/\/intake\/quiz-lead\/?$/, '/intake/booked');

    const res = await fetch(bookedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Intake-Secret': botSecret },
      body: JSON.stringify({ email, phone }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('Bot-Booked non-OK:', res.status, detail);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Booked API Fehler:', err?.message || err);
    // Nie hart fehlschlagen: eine verpasste Meldung kostet nur eine ueberfluessige
    // WhatsApp-Nachricht, ein 500 im Browser wuerde die Ergebnisseite stoeren.
    return new Response(JSON.stringify({ ok: true, status: 'error' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
