/**
 * LEVEL 1 VERIFY — external API health check.
 *
 * Measures real wall-clock time for every external dependency the
 * Intelligence Manager pipeline relies on. When an end-to-end run hangs,
 * this tells us in under a minute whether the culprit is Serper,
 * DataForSEO, OpenRouter/Claude, web scraping, or something else.
 *
 * Usage: npx tsx scripts/verify-external-apis.ts
 *
 * Exit 0 = all checks passed. Exit 1 = one or more failed (timing over
 * the pass threshold or exception thrown).
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (match) {
        const [, key, rawValue] = match;
        const value = rawValue.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
        if (!process.env[key]) { process.env[key] = value; }
      }
    }
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    throw new Error('Missing FIREBASE_ADMIN_* env vars in .env.local');
  }
}

initAdmin();

import { getSerperSEOService } from '../src/lib/integrations/seo/serper-seo-service';
import { getDataForSEOService } from '../src/lib/integrations/seo/dataforseo-service';
import { OpenRouterProvider } from '../src/lib/ai/openrouter-provider';
import { scrapeWebsite } from '../src/lib/enrichment/web-scraper';

const PLATFORM_ID = 'rapid-compliance-root';

interface CheckResult {
  name: string;
  passed: boolean;
  durationMs: number;
  thresholdMs: number;
  detail: string;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T | null; error: Error | null; durationMs: number }> {
  const start = Date.now();
  try {
    const value = await fn();
    return { value, error: null, durationMs: Date.now() - start };
  } catch (err) {
    return {
      value: null,
      error: err instanceof Error ? err : new Error(String(err)),
      durationMs: Date.now() - start,
    };
  }
}

async function checkFirestore(): Promise<CheckResult> {
  const threshold = 2000;
  const { value, error, durationMs } = await timed(async () => {
    const db = admin.firestore();
    const snap = await db.collection('organizations').doc(PLATFORM_ID).get();
    return snap.exists;
  });
  const passed = error === null && value === true && durationMs < threshold;
  const detail = error !== null
    ? `ERROR: ${error.message}`
    : value === true
      ? `org doc exists`
      : `org doc not found`;
  return { name: 'Firestore Admin read', passed, durationMs, thresholdMs: threshold, detail };
}

async function checkSerper(): Promise<CheckResult> {
  const threshold = 5000;
  const { value, error, durationMs } = await timed(async () => {
    const serper = getSerperSEOService();
    const result = await serper.searchSERP('promotional wear companies', { num: 10 });
    return result;
  });
  const urlCount = value?.data?.organic?.length ?? 0;
  const passed = error === null && (value?.success ?? false) && urlCount > 0 && durationMs < threshold;
  const detail = error !== null
    ? `ERROR: ${error.message}`
    : value?.success !== true
      ? `non-success result`
      : `${urlCount} organic results`;
  return { name: 'Serper SERP search', passed, durationMs, thresholdMs: threshold, detail };
}

async function checkDataForSEO(): Promise<CheckResult> {
  const threshold = 10_000;
  const { value, error, durationMs } = await timed(async () => {
    const dfor = getDataForSEOService();
    return dfor.getDomainMetrics('vantageapparel.com');
  });
  const rank = value?.data?.domainRank;
  const passed = error === null && (value?.success ?? false) && durationMs < threshold;
  const detail = error !== null
    ? `ERROR: ${error.message}`
    : value?.success !== true
      ? `non-success result`
      : `domainRank=${rank ?? 'null'}`;
  return { name: 'DataForSEO getDomainMetrics', passed, durationMs, thresholdMs: threshold, detail };
}

async function checkOpenRouterSmall(): Promise<CheckResult> {
  const threshold = 10_000;
  const { value, error, durationMs } = await timed(async () => {
    const provider = new OpenRouterProvider(PLATFORM_ID);
    return provider.chat({
      model: 'claude-sonnet-4.6',
      messages: [
        { role: 'system', content: 'You are a terse assistant. Reply in under 20 words.' },
        { role: 'user', content: 'Say hello.' },
      ],
      temperature: 0.3,
      maxTokens: 100,
    });
  });
  const respChars = value?.content?.length ?? 0;
  const passed = error === null && respChars > 0 && durationMs < threshold;
  const detail = error !== null
    ? `ERROR: ${error.message}`
    : `respChars=${respChars}, finish=${value?.finishReason ?? 'unknown'}`;
  return { name: 'OpenRouter Claude small prompt', passed, durationMs, thresholdMs: threshold, detail };
}

async function checkOpenRouterLarge(): Promise<CheckResult> {
  const threshold = 90_000;
  // Build a prompt roughly the size the Competitor Researcher uses when analyzing 10 scraped sites.
  // The real prompt is system(~3k) + user(~20k from scraped content). Approximate it here.
  const largeSystemPrompt =
    'You are a world-class competitor researcher. Given scraped competitor data, produce a structured JSON ' +
    'analysis with positioning, strengths, weaknesses, market insights, and strategic recommendations. ' +
    'Output must be valid JSON matching this shape: { competitors: [...], marketInsights: {...}, rationale: string }. ' +
    'Every field must be specific, sourced from the scraped content, and avoid generic claims.\n\n' +
    'PADDING:\n' + 'x'.repeat(2500);
  const largeUserPrompt =
    'Analyze these 10 scraped competitors in the promotional wear industry:\n\n' +
    Array.from({ length: 10 }, (_, i) =>
      `Competitor ${i + 1}: company-${i + 1}.com\nTitle: Example Promotional Wear Company ${i + 1}\n` +
      `Description: We sell custom promotional wear for businesses worldwide.\n` +
      `Content sample: ${'Lorem ipsum '.repeat(200)}`
    ).join('\n\n---\n\n') +
    '\n\nReturn valid JSON only. Aim for ~8000 output tokens.';

  const { value, error, durationMs } = await timed(async () => {
    const provider = new OpenRouterProvider(PLATFORM_ID);
    return provider.chat({
      model: 'claude-sonnet-4.6',
      messages: [
        { role: 'system', content: largeSystemPrompt },
        { role: 'user', content: largeUserPrompt },
      ],
      temperature: 0.3,
      maxTokens: 8192,
    });
  });
  const respChars = value?.content?.length ?? 0;
  const passed = error === null && respChars > 0 && durationMs < threshold;
  const promptChars = largeSystemPrompt.length + largeUserPrompt.length;
  const detail = error !== null
    ? `ERROR: ${error.message}`
    : `promptChars=${promptChars}, respChars=${respChars}, finish=${value?.finishReason ?? 'unknown'}`;
  return { name: `OpenRouter Claude large prompt (Competitor-sized)`, passed, durationMs, thresholdMs: threshold, detail };
}

async function checkWebScraper(): Promise<CheckResult> {
  const threshold = 10_000;
  const { value, error, durationMs } = await timed(async () => {
    // example.com is a known-public, always-up, scraper-friendly site.
    return scrapeWebsite('https://example.com/');
  });
  const textLen = value?.cleanedText?.length ?? 0;
  const passed = error === null && textLen > 0 && durationMs < threshold;
  const detail = error !== null
    ? `ERROR: ${error.message}`
    : `cleanedText=${textLen} chars`;
  return { name: 'Web scraper (example.com)', passed, durationMs, thresholdMs: threshold, detail };
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatRow(r: CheckResult): string {
  const icon = r.passed ? '✓' : '✗';
  const name = r.name.padEnd(42);
  const duration = formatMs(r.durationMs).padStart(8);
  const thresh = formatMs(r.thresholdMs).padStart(7);
  return `  ${icon}  ${name}  ${duration} / ${thresh}  ${r.detail}`;
}

async function main(): Promise<void> {
  console.log('');
  console.log('═'.repeat(80));
  console.log('  LEVEL 1 — External API Health Check');
  console.log('  Org: ' + PLATFORM_ID);
  console.log('═'.repeat(80));
  console.log('');

  const checks: CheckResult[] = [];

  // Run each check sequentially so slow ones don't starve the others
  for (const fn of [
    checkFirestore,
    checkSerper,
    checkDataForSEO,
    checkWebScraper,
    checkOpenRouterSmall,
    checkOpenRouterLarge,
  ]) {
    const name = fn.name.replace(/^check/, '');
    process.stdout.write(`  running: ${name} ... `);
    const result = await fn();
    checks.push(result);
    console.log(result.passed ? 'ok' : 'FAIL');
  }

  console.log('');
  console.log('  RESULTS');
  console.log('  ' + '─'.repeat(76));
  for (const r of checks) {
    console.log(formatRow(r));
  }
  console.log('  ' + '─'.repeat(76));

  const passedCount = checks.filter((c) => c.passed).length;
  const failed = checks.filter((c) => !c.passed);
  console.log('');
  console.log(`  ${passedCount}/${checks.length} passed`);
  if (failed.length > 0) {
    console.log('');
    console.log('  FAILING:');
    for (const r of failed) {
      console.log(`    - ${r.name}: took ${formatMs(r.durationMs)} (threshold ${formatMs(r.thresholdMs)}) — ${r.detail}`);
    }
  }
  console.log('');

  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error('Fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
