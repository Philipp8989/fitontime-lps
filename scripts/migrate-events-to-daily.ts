// Einmalige Migration: alle events/*.json Blobs zu events-daily/YYYY-MM-DD.ndjson umschreiben
// Ausfuehrung: BLOB_READ_WRITE_TOKEN=... npx tsx scripts/migrate-events-to-daily.ts
import { list, put, del } from '@vercel/blob';

async function main() {
  console.log('Sammle alle events/*.json Blobs...');
  const urls: { url: string; pathname: string }[] = [];
  let cursor: string | undefined;
  do {
    const r = await list({ prefix: 'events/', cursor, limit: 1000 });
    for (const b of r.blobs) {
      if (b.pathname.endsWith('.json') && !b.pathname.startsWith('events-daily/')) {
        urls.push({ url: b.url, pathname: b.pathname });
      }
    }
    cursor = r.hasMore ? r.cursor : undefined;
    console.log(`  gefunden: ${urls.length}`);
  } while (cursor);

  console.log(`\nFetch ${urls.length} events (100 parallel)...`);
  const byDay: Record<string, any[]> = {};
  const CONC = 100;
  for (let i = 0; i < urls.length; i += CONC) {
    const batch = urls.slice(i, i + CONC);
    const fetched = await Promise.all(batch.map(async (b) => {
      try {
        const r = await fetch(b.url);
        return await r.json();
      } catch { return null; }
    }));
    for (const e of fetched) {
      if (!e || !e.timestamp) continue;
      const day = e.timestamp.slice(0, 10);
      (byDay[day] ||= []).push(e);
    }
    console.log(`  ${Math.min(i + CONC, urls.length)}/${urls.length}`);
  }

  console.log(`\nSchreibe ${Object.keys(byDay).length} daily blobs...`);
  for (const [day, events] of Object.entries(byDay)) {
    const ndjson = events.map(e => JSON.stringify(e)).join('\n') + '\n';
    await put(`events-daily/${day}.ndjson`, ndjson, {
      access: 'public',
      contentType: 'application/x-ndjson',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    console.log(`  ${day}: ${events.length} events`);
  }

  console.log(`\nLoesche ${urls.length} alte events/*.json Blobs...`);
  for (let i = 0; i < urls.length; i += CONC) {
    const batch = urls.slice(i, i + CONC);
    await Promise.all(batch.map(b => del(b.url).catch(() => {})));
    console.log(`  ${Math.min(i + CONC, urls.length)}/${urls.length}`);
  }

  console.log('\nMigration fertig.');
}

main().catch((e) => { console.error(e); process.exit(1); });
