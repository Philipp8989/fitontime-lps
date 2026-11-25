// Meldet ab-tests.json ans lp-machine-dashboard. Läuft nach jedem Production-Build (package.json "build").
// Bricht den Build nie ab: ein fehlgeschlagener Sync zeigt im Dashboard nur den alten Stand, deshalb laute Warnung.
import { readFileSync } from 'node:fs';

const URL_SYNC = 'https://lp-machine-dashboard.vercel.app/api/analytics/ab-sync';

// Nur Production: Preview-Builds von Feature-Branches dürfen keinen Test als laufend melden
if (process.env.VERCEL_ENV !== 'production' && !process.argv.includes('--force')) {
  console.log('[ab-sync] übersprungen (kein Production-Build)');
  process.exit(0);
}
const key = process.env.DASHBOARD_LEADS_KEY;
if (!key) {
  console.warn('[ab-sync] WARNUNG: DASHBOARD_LEADS_KEY fehlt, Tests nicht gemeldet');
  process.exit(0);
}
let tests;
try {
  tests = JSON.parse(readFileSync(new URL('../ab-tests.json', import.meta.url), 'utf8')).tests || [];
} catch (e) {
  console.warn('[ab-sync] WARNUNG: ab-tests.json nicht lesbar:', e.message);
  process.exit(0);
}
if (tests.length === 0) process.exit(0);
try {
  const res = await fetch(URL_SYNC, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key },
    body: JSON.stringify({ tests }),
  });
  const text = await res.text();
  if (!res.ok) console.warn(`[ab-sync] WARNUNG: Dashboard antwortet ${res.status}: ${text}`);
  else console.log('[ab-sync] gemeldet:', text);
} catch (e) {
  console.warn('[ab-sync] WARNUNG: Dashboard nicht erreichbar:', e.message);
}
