// Bewerber-Bestaetigungsmail fuer die Recruiting-Funnel.
// Fabians persoenliche Standardnachricht pro Vakanz, personalisiert mit [Vorname].
// Bewusst Plain-Text (kein Design): wirkt wie eine persoenliche Nachricht und
// laedt zur Antwort ein ("erzaehl mir etwas ueber dich in Textform").
//
// Absender: job@fitontime.ch (From + Reply-to). ACHTUNG: Gmail-SMTP schreibt die
// From-Adresse auf GMAIL_USER um, wenn job@ dort kein verifizierter "Senden als"-
// Alias ist. Fuer sauberen Versand eigene job@-SMTP-Creds via RECRUITING_MAIL_*.
import nodemailer from 'nodemailer';

const ABSENDER = 'job@fitontime.ch';
const ABSENDER_NAME = 'Fit on Time';

// Vorlagen pro Funnel-Slug. {vorname} wird ersetzt.
// Coach + Vertrieb = Fabians Originaltext. Admin = analog gedraftet.
const VORLAGEN: Record<string, { betreff: string; text: string }> = {
  'recruiting-kundenbetreuung': {
    betreff: 'Deine Bewerbung bei Fit on Time',
    text: `Hallo {vorname}

Fabian von Fit on Time hier.

Wir möchten uns herzlich bei dir für das Interesse an unserem Unternehmen und der Stelle als Kundenbetreuer-/in im Coaching bedanken! Wir sind ein ganzheitliches Online-Coaching, welches bereits mehr als 4'000 vielbeschäftigten Frauen zu ihrer ganz persönlichen Transformation verholfen hat.

Würdest du mir hier etwas über dich in Textform erzählen, damit ich dich etwas besser zur Stelle einordnen kann? Was sind deine beruflichen Erfahrungen im Bereich Coaching, Kundenbetreuung & Key Account, dein Background, Erfahrungen, Wünsche / Ziele.

Ich freue mich und wünsche dir noch einen schönen Abend.

Liebe Grüsse
Fabian`,
  },
  'recruiting-scbewerbung': {
    betreff: 'Deine Bewerbung bei Fit on Time',
    text: `Hallo {vorname}

Fabian von Fit on Time hier.

Wir möchten uns herzlich bei dir für das Interesse an unserem Unternehmen und der Stelle im Vertrieb bedanken! Wir sind ein ganzheitliches Online-Coaching, welches bereits mehr als 4'000 vielbeschäftigten Frauen zu ihrer ganz persönlichen Transformation verholfen hat.

Würdest du mir hier etwas über dich in Textform erzählen, damit ich dich etwas besser zur Stelle einordnen kann? Was sind deine beruflichen Erfahrungen im Bereich Sales, Beratung, Terminierung oder Closing, dein Background, Erfahrungen, Wünsche / Ziele.

Ich freue mich und wünsche dir noch einen schönen Abend.

Liebe Grüsse
Fabian`,
  },
  // ENTWURF (Fabian hat keine Admin-Vorlage geliefert) — vor Live von Fabian freigeben lassen.
  'recruiting-admin': {
    betreff: 'Deine Bewerbung bei Fit on Time',
    text: `Hallo {vorname}

Fabian von Fit on Time hier.

Wir möchten uns herzlich bei dir für das Interesse an unserem Unternehmen und der Stelle als Sachbearbeiter-/in Administration bedanken! Wir sind ein ganzheitliches Online-Coaching, welches bereits mehr als 4'000 vielbeschäftigten Frauen zu ihrer ganz persönlichen Transformation verholfen hat.

Würdest du mir hier etwas über dich in Textform erzählen, damit ich dich etwas besser zur Stelle einordnen kann? Was sind deine beruflichen Erfahrungen im Bereich Administration, Organisation & Büromanagement, dein Background, Erfahrungen, Wünsche / Ziele.

Ich freue mich und wünsche dir noch einen schönen Abend.

Liebe Grüsse
Fabian`,
  },
};

// Plain-Text -> minimales HTML (Absaetze erhalten), damit die Mail in HTML-Clients
// nicht als ein Block ohne Umbrueche ankommt.
function textZuHtml(text: string): string {
  return text
    .split('\n\n')
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

type MailInput = { vorname: string; email: string; slug: string };

// Verschickt die Bestaetigung. Non-blocking gedacht: wirft bei Fehlern,
// Aufrufer faengt ab (Sheet bleibt Ground-Truth).
export async function sendApplicantConfirmation(input: MailInput): Promise<{ sent: boolean }> {
  const vorlage = VORLAGEN[input.slug];
  if (!vorlage) return { sent: false }; // unbekannter Funnel -> keine Mail

  // Eigene Recruiting-SMTP bevorzugen (job@-Konto bei kasserver), sonst Fallback auf GMAIL_*.
  // Wenn RECRUITING_MAIL_HOST gesetzt ist -> echtes SMTP (job@fitontime.ch, sauberer Absender).
  // Sonst service:gmail (schreibt Absender auf GMAIL_USER um -> nur Notloesung).
  const host = (import.meta.env.RECRUITING_MAIL_HOST || '').trim();
  const user = (import.meta.env.RECRUITING_MAIL_USER || import.meta.env.GMAIL_USER || '').trim();
  const pass = (
    import.meta.env.RECRUITING_MAIL_PASSWORD ||
    import.meta.env.GMAIL_APP_PASSWORD ||
    ''
  ).trim();
  if (!user || !pass) throw new Error('RECRUITING_MAIL_/GMAIL_ Creds fehlen');

  const transporter = host
    ? nodemailer.createTransport({
        host,
        port: Number(import.meta.env.RECRUITING_MAIL_PORT || 587),
        secure: Number(import.meta.env.RECRUITING_MAIL_PORT || 587) === 465,
        auth: { user, pass },
      })
    : nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });

  const vorname = (input.vorname || '').trim() || 'da';
  const text = vorlage.text.replace(/\{vorname\}/g, vorname);

  await transporter.sendMail({
    from: `"${ABSENDER_NAME}" <${ABSENDER}>`,
    replyTo: ABSENDER,
    to: input.email,
    subject: vorlage.betreff,
    text,
    html: textZuHtml(text),
  });

  return { sent: true };
}
