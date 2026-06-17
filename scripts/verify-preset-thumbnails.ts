/**
 * One-off verification: do the ~390 cinematic preset thumbnail URLs still resolve?
 *
 * Reads the generated PRESET_THUMBNAILS map and probes every URL (HEAD, falling
 * back to a ranged GET if HEAD is not allowed) with bounded concurrency + a
 * per-request timeout. Prints a summary plus a sample of broken entries.
 *
 * Run: npx tsx scripts/verify-preset-thumbnails.ts
 *
 * Read-only. Does not modify any project files or regenerate thumbnails.
 */

import { PRESET_THUMBNAILS } from '../src/lib/ai/cinematic-preset-thumbnails.generated';

const CONCURRENCY = 10;
const TIMEOUT_MS = 15_000;
const SAMPLE_LIMIT = 20;

interface ProbeResult {
  id: string;
  url: string;
  ok: boolean;
  status: number | null;
  detail: string;
}

async function probe(id: string, url: string): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Try HEAD first (cheapest).
    let res = await fetch(url, { method: 'HEAD', signal: controller.signal });

    // Some storage backends reject HEAD on signed URLs; fall back to a ranged GET.
    if (res.status === 405 || res.status === 403 || res.status === 501) {
      res = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        signal: controller.signal,
      });
    }

    const ok = res.status >= 200 && res.status < 300;
    return { id, url, ok, status: res.status, detail: res.statusText || '' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { id, url, ok: false, status: null, detail: message };
  } finally {
    clearTimeout(timer);
  }
}

async function runPool(entries: Array<[string, string]>): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < entries.length) {
      const index = cursor++;
      const [id, url] = entries[index];
      const result = await probe(id, url);
      results.push(result);
      const tag = result.ok ? 'OK ' : 'BAD';
      process.stdout.write(
        `[${results.length}/${entries.length}] ${tag} ${id} (${result.status ?? 'ERR'})\n`,
      );
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, entries.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function isAbsolute(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

async function main(): Promise<void> {
  const entries = Object.entries(PRESET_THUMBNAILS);
  const total = entries.length;

  const relative = entries.filter(([, url]) => !isAbsolute(url));
  const absolute = entries.filter(([, url]) => isAbsolute(url));

  console.log(`\nTotal preset thumbnails: ${total}`);
  console.log(`Absolute (http/https) URLs: ${absolute.length}`);
  console.log(`Relative / non-http URLs:   ${relative.length}`);

  if (relative.length > 0) {
    console.log('\nNon-absolute URLs detected (would need on-disk /public check):');
    for (const [id, url] of relative.slice(0, SAMPLE_LIMIT)) {
      console.log(`  - ${id}: ${url}`);
    }
  }

  if (absolute.length === 0) {
    console.log('\nNo absolute URLs to probe over HTTP. Exiting.');
    return;
  }

  console.log(`\nProbing ${absolute.length} URLs (concurrency ${CONCURRENCY}, timeout ${TIMEOUT_MS}ms)...\n`);
  const results = await runPool(absolute);

  const okResults = results.filter((r) => r.ok);
  const brokenResults = results.filter((r) => !r.ok);

  console.log('\n──────────── SUMMARY ────────────');
  console.log(`Total probed: ${results.length}`);
  console.log(`OK (2xx):     ${okResults.length}`);
  console.log(`Broken:       ${brokenResults.length}`);

  if (brokenResults.length > 0) {
    console.log(`\nSample broken (up to ${SAMPLE_LIMIT}):`);
    for (const r of brokenResults.slice(0, SAMPLE_LIMIT)) {
      console.log(`  - ${r.id} | status=${r.status ?? 'ERR'} | ${r.detail}`);
      console.log(`    ${r.url}`);
    }
  }

  const verdict =
    brokenResults.length === 0
      ? 'thumbnails healthy'
      : `${brokenResults.length} broken, regeneration needed`;
  console.log(`\nVERDICT: ${verdict}`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error('verify-preset-thumbnails failed:', message);
  process.exitCode = 1;
});
