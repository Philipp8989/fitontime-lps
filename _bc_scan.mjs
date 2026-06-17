import { list } from '@vercel/blob';
import { writeFileSync } from 'node:fs';
const t0 = Date.now();
const CONC = 150;
const byPage = {};      // page -> booking_confirmed count
let bcTotal = 0;
const samples = [];     // erste 10 booking_confirmed events
function tally(e) {
  if ((e.step || e.event) !== 'booking_confirmed') return;
  bcTotal++;
  const p = e.page || e.lp || '?';
  byPage[p] = (byPage[p] || 0) + 1;
  if (samples.length < 10) samples.push({ page: e.page, lp: e.lp, variant: e.variant, detail: e.detail, ts: e.timestamp });
}
async function pool(blobs) {
  let i = 0;
  async function w() { while (i < blobs.length) { const idx = i++; try { const e = await (await fetch(blobs[idx].url)).json(); tally(e); } catch {} } }
  await Promise.all(Array.from({ length: CONC }, w));
}
let cursor, pages = 0, grand = 0;
do {
  const r = await list({ prefix: 'events/', cursor, limit: 1000 });
  grand += r.blobs.length;
  await pool(r.blobs);
  cursor = r.cursor; pages++;
} while (cursor);
const out = { grand, bcTotal, byPage, samples, secs: Math.round((Date.now() - t0) / 1000) };
writeFileSync('/tmp/bc_scan_result.json', JSON.stringify(out, null, 2));
console.log('DONE', JSON.stringify(out));
