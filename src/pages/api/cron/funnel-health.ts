// Funnel-Health-Cron: pro LP wird 24h-Trichter ausgewertet.
// Schlägt Alarm, wenn quiz_complete da ist, aber lead_submit fehlt.
//
// Verhindert künftig den Schilddrüsen-Bug (511 quiz_completes, 0 lead_submits über 3 Tage
// ohne dass jemand es gemerkt hat).
//
// Auth: Vercel-Cron sendet automatisch Header x-vercel-cron. Für manuelle Trigger geht
// auch ?key=<DASHBOARD_KEY> als Query-Parameter.
//
// Ausgabe: JSON-Status. Wenn Alerts: Mail an ADMIN_EMAIL.

import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';
import { list } from '@vercel/blob';

export const prerender = false;
// Pro-Plan bis 300s, defensive 90s reicht für 24h-Scan
export const config = { maxDuration: 90 };

const ADMIN_EMAIL = 'ppoetzinger@googlemail.com';

// Alarm-Schwellen
const WINDOW_HOURS = 24;
const MIN_QUIZ_COMPLETES = 30;        // unterhalb statistisch nicht aussagekräftig
const CRITICAL_CR = 0.05;             // 5 Prozent quiz_complete → lead_submit
const WARN_CR = 0.20;                 // 20 Prozent quiz_complete → lead_submit

type LpFunnel = {
  lp: string;
  page_views: number;
  quiz_starts: number;
  quiz_completes: number;
  lead_submits: number;
  cr: number;
  severity: 'CRITICAL' | 'WARN' | 'OK';
};

export const GET: APIRoute = async ({ request, url }) => {
  // Auth
  const isVercelCron = !!request.headers.get('x-vercel-cron');
  const queryKey = url.searchParams.get('key');
  const dashKey = import.meta.env.DASHBOARD_KEY;
  if (!isVercelCron && (!dashKey || queryKey !== dashKey)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const cutoffMs = Date.now() - WINDOW_HOURS * 3600 * 1000;

  // 1. Blob-Metadaten paginieren und auf Window filtern
  const relevant: { url: string }[] = [];
  let cursor: string | undefined;
  do {
    const r = await list({ prefix: 'events/', limit: 1000, cursor });
    for (const b of r.blobs) {
      const m = b.pathname.match(/events\/(\d+)-/);
      if (m && parseInt(m[1]) >= cutoffMs) relevant.push({ url: b.url });
    }
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);

  // 2. Events parallel laden
  const CONC = 200;
  const byLp = new Map<string, { pv: Set<string>; qs: Set<string>; qc: Set<string>; ls: Set<string> }>();
  for (let i = 0; i < relevant.length; i += CONC) {
    const batch = relevant.slice(i, i + CONC);
    const fetched = await Promise.all(batch.map(async (b) => {
      try {
        const r = await fetch(b.url);
        return await r.json();
      } catch {
        return null;
      }
    }));
    for (const e of fetched) {
      if (!e || !e.lp) continue;
      const lp = String(e.lp);
      const sess = String(e.session || '');
      if (!sess || sess === 'server-side') continue;
      if (!byLp.has(lp)) byLp.set(lp, { pv: new Set(), qs: new Set(), qc: new Set(), ls: new Set() });
      const bucket = byLp.get(lp)!;
      const ev = String(e.event || '').toLowerCase();
      if (ev === 'page_view' || ev === 'pageview' || ev === 'view') bucket.pv.add(sess);
      if (ev === 'quiz_start') bucket.qs.add(sess);
      if (ev === 'quiz_complete') bucket.qc.add(sess);
      if (ev === 'lead_submit' || ev === 'lead' || ev === 'submit' || ev === 'lead_submitted') bucket.ls.add(sess);
    }
  }

  // 3. Per LP klassifizieren
  const funnels: LpFunnel[] = [];
  for (const [lp, b] of byLp.entries()) {
    const page_views = b.pv.size;
    const quiz_starts = b.qs.size;
    const quiz_completes = b.qc.size;
    const lead_submits = b.ls.size;
    const cr = quiz_completes > 0 ? lead_submits / quiz_completes : 0;
    let severity: LpFunnel['severity'] = 'OK';
    if (quiz_completes >= MIN_QUIZ_COMPLETES) {
      if (cr < CRITICAL_CR) severity = 'CRITICAL';
      else if (cr < WARN_CR) severity = 'WARN';
    }
    funnels.push({ lp, page_views, quiz_starts, quiz_completes, lead_submits, cr, severity });
  }

  funnels.sort((a, b) => b.quiz_completes - a.quiz_completes);

  const criticals = funnels.filter((f) => f.severity === 'CRITICAL');
  const warns = funnels.filter((f) => f.severity === 'WARN');

  // 4. Mail nur bei CRITICAL — WARN landet im JSON-Response zum Logging
  if (criticals.length > 0) {
    const gmailUser = import.meta.env.GMAIL_USER || ADMIN_EMAIL;
    const gmailPass = import.meta.env.GMAIL_APP_PASSWORD;
    const subject = `LP Funnel-Alarm FitonTime · ${criticals.length} LP(s) ohne Leads`;
    const body = [
      `Funnel-Drop in den letzten ${WINDOW_HOURS} Stunden:`,
      ``,
      `KRITISCH (CR < ${(CRITICAL_CR * 100).toFixed(0)} Prozent bei mindestens ${MIN_QUIZ_COMPLETES} quiz_completes):`,
      ...criticals.map((f) =>
        `  ${f.lp}: ${f.lead_submits} lead_submits aus ${f.quiz_completes} quiz_completes (CR ${(f.cr * 100).toFixed(1)} Prozent, ${f.page_views} page_views)`,
      ),
      ``,
    ];
    if (warns.length > 0) {
      body.push(`Warnungen (CR < ${(WARN_CR * 100).toFixed(0)} Prozent):`);
      for (const f of warns) {
        body.push(
          `  ${f.lp}: ${f.lead_submits} lead_submits aus ${f.quiz_completes} quiz_completes (CR ${(f.cr * 100).toFixed(1)} Prozent, ${f.page_views} page_views)`,
        );
      }
      body.push('');
    }
    body.push(
      `Sofort prüfen:`,
      `  1. Live-Test der LP im Browser (Form-Submit nachstellen)`,
      `  2. Vercel-Logs: vercel logs fitontime-lps`,
      `  3. Postgres-Leads-Tabelle direkt anschauen`,
      `  4. Google-Sheet Service-Account-Berechtigung prüfen`,
      ``,
      `-- LP Funnel-Health-Cron`,
    );

    if (!gmailPass) {
      console.error('funnel-health alert ohne Gmail-Creds:', subject);
    } else {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: gmailUser, pass: gmailPass },
        });
        await transporter.sendMail({
          from: `"LP Funnel-Health" <${gmailUser}>`,
          to: ADMIN_EMAIL,
          subject,
          text: body.join('\n'),
        });
      } catch (err: any) {
        console.error('funnel-health gmail send failed:', err?.message || err);
      }
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      window_hours: WINDOW_HOURS,
      lps_checked: funnels.length,
      criticals: criticals.length,
      warns: warns.length,
      funnels,
    }),
    { headers: { 'content-type': 'application/json' } },
  );
};
