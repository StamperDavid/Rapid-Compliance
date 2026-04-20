/**
 * External API cost tracker — estimates per-mission API spend.
 *
 * Reads `D:/rapid-dev/dev-server.log` and attributes every OpenRouter
 * LLM call, Serper SERP search, DataForSEO domain metrics lookup, and
 * web scrape to the mission that triggered it. Produces a cost table
 * per missionId with rough dollar estimates.
 *
 * Usage:
 *   npx tsx scripts/track-api-costs.ts --report           # one-shot report of whole log
 *   npx tsx scripts/track-api-costs.ts --tail             # live, alerts on threshold
 *   npx tsx scripts/track-api-costs.ts --mission <id>     # just one mission
 *
 * Cost model (approximations — not exact billing):
 *   - Claude Sonnet 4.6 via OpenRouter: $3/M input tokens, $15/M output tokens
 *     Token estimation: chars / 3.5
 *   - Serper SERP search: $0.30 / 1000 queries (dev tier typical)
 *   - DataForSEO domain metrics: $0.01 per lookup (approx)
 *   - Web scraping via built-in: $0 (free)
 *
 * Alert thresholds:
 *   - Per-mission cost > $2.00 → ALERT
 *   - Per-mission Serper calls > 20 → ALERT (usually means a retry storm)
 *   - Per-mission LLM calls > 5 → ALERT (usually means the review loop is on
 *     or a specialist is retrying)
 */

/* eslint-disable no-console */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const LOG_PATH = 'D:/rapid-dev/dev-server.log';

// Cost constants (dollars)
const CLAUDE_INPUT_PER_MTOK = 3.0;
const CLAUDE_OUTPUT_PER_MTOK = 15.0;
const SERPER_PER_QUERY = 0.30 / 1000;
const DATAFORSEO_PER_LOOKUP = 0.01;

// Token estimation
const CHARS_PER_TOKEN = 3.5;

// Alert thresholds
const COST_ALERT_USD = 2.00;
const SERPER_ALERT_COUNT = 20;
const LLM_ALERT_COUNT = 5;

interface MissionCost {
  missionId: string;
  llmCalls: Array<{ promptChars: number; respChars: number; durationMs: number; model: string }>;
  serperCalls: number;
  dataforseoCalls: number;
  scrapeCalls: number;
  firstSeen: string;
  lastSeen: string;
}

interface CostTotals {
  llmUsd: number;
  serperUsd: number;
  dataforseoUsd: number;
  totalUsd: number;
}

const missions = new Map<string, MissionCost>();
let currentMissionId: string | null = null; // follows the most recent tool trace with a missionId

function ensureMission(id: string, ts: string): MissionCost {
  let m = missions.get(id);
  if (!m) {
    m = {
      missionId: id,
      llmCalls: [],
      serperCalls: 0,
      dataforseoCalls: 0,
      scrapeCalls: 0,
      firstSeen: ts,
      lastSeen: ts,
    };
    missions.set(id, m);
  }
  m.lastSeen = ts;
  return m;
}

function computeTotals(m: MissionCost): CostTotals {
  let llmUsd = 0;
  for (const call of m.llmCalls) {
    const inputTokens = call.promptChars / CHARS_PER_TOKEN;
    const outputTokens = call.respChars / CHARS_PER_TOKEN;
    llmUsd += (inputTokens / 1_000_000) * CLAUDE_INPUT_PER_MTOK;
    llmUsd += (outputTokens / 1_000_000) * CLAUDE_OUTPUT_PER_MTOK;
  }
  const serperUsd = m.serperCalls * SERPER_PER_QUERY;
  const dataforseoUsd = m.dataforseoCalls * DATAFORSEO_PER_LOOKUP;
  return {
    llmUsd,
    serperUsd,
    dataforseoUsd,
    totalUsd: llmUsd + serperUsd + dataforseoUsd,
  };
}

// Patterns to match in the server log

/** `"missionId":"mission_req_..."` — any log line tagged with a mission */
const MISSION_ID_RE = /"missionId":"(mission_req_[a-z0-9_]+)"/;

/** `[llm] OpenRouter.chat start: model=X, promptChars=Y, maxTokens=Z` */
const LLM_START_RE = /\[llm\] OpenRouter\.chat start: model=(\S+), promptChars=(\d+)/;

/** `[llm] OpenRouter.chat done in Xms (finishReason=..., respChars=Y)` */
const LLM_DONE_RE = /\[llm\] OpenRouter\.chat done in (\d+)ms \(finishReason=\S+, respChars=(\d+)\)/;

/** Serper calls — match actual Serper invocation log lines (specialist makes them) */
const SERPER_RE = /\[phase\] serper done: (\d+) candidate URLs in (\d+)ms|Serper returned/;

/** DataForSEO calls — bracketed dfor log + any direct DataForSEO call */
const DATAFORSEO_RE = /\[dfor\] DataForSEO|DataForSEO\.getDomainMetrics/;

/** Web scraper calls */
const SCRAPE_RE = /\[Web Scraper\] (Error scraping|Scraping: )/;

/** Timestamp extractor */
const TS_RE = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/;

// Buffer for LLM start→done pairing. Multiple LLMs may be in flight; we keep
// them in an ordered list and match start→done FIFO per mission.
const pendingLlmStarts = new Map<string, Array<{ model: string; promptChars: number; start: string }>>();

function processLine(line: string): string[] {
  const alerts: string[] = [];

  // Extract timestamp
  const tsMatch = TS_RE.exec(line);
  const ts = tsMatch ? tsMatch[1] : new Date().toISOString();

  // Extract missionId if present on THIS line; else fall back to currentMissionId
  const idMatch = MISSION_ID_RE.exec(line);
  if (idMatch) { currentMissionId = idMatch[1]; }

  // We only attribute work to a mission when we have a missionId context.
  const mid = currentMissionId;
  if (mid === null) { return alerts; }

  const m = ensureMission(mid, ts);

  // LLM call tracking — start/done pairing
  const llmStart = LLM_START_RE.exec(line);
  if (llmStart) {
    const pending = pendingLlmStarts.get(mid) ?? [];
    pending.push({
      model: llmStart[1],
      promptChars: parseInt(llmStart[2], 10),
      start: ts,
    });
    pendingLlmStarts.set(mid, pending);
    return alerts;
  }

  const llmDone = LLM_DONE_RE.exec(line);
  if (llmDone) {
    const pending = pendingLlmStarts.get(mid) ?? [];
    const start = pending.shift();
    if (start) {
      m.llmCalls.push({
        promptChars: start.promptChars,
        respChars: parseInt(llmDone[2], 10),
        durationMs: parseInt(llmDone[1], 10),
        model: start.model,
      });
      if (m.llmCalls.length > LLM_ALERT_COUNT) {
        alerts.push(`[cost-alert] ${ts} MISSION ${mid}: ${m.llmCalls.length} LLM calls — possible review-loop or retry-storm`);
      }
    }
    pendingLlmStarts.set(mid, pending);
    return alerts;
  }

  if (SERPER_RE.test(line)) {
    m.serperCalls += 1;
    if (m.serperCalls > SERPER_ALERT_COUNT) {
      alerts.push(`[cost-alert] ${ts} MISSION ${mid}: ${m.serperCalls} Serper calls — likely retry storm`);
    }
  }

  if (DATAFORSEO_RE.test(line)) {
    m.dataforseoCalls += 1;
  }

  if (SCRAPE_RE.test(line)) {
    m.scrapeCalls += 1;
  }

  // Running cost check
  const totals = computeTotals(m);
  if (totals.totalUsd > COST_ALERT_USD) {
    // Only emit once per threshold crossing
    const key = `${mid}:cost>${COST_ALERT_USD}`;
    if (!alertedOnce.has(key)) {
      alertedOnce.add(key);
      alerts.push(`[cost-alert] ${ts} MISSION ${mid}: est. $${totals.totalUsd.toFixed(3)} spent — threshold $${COST_ALERT_USD}`);
    }
  }

  return alerts;
}

const alertedOnce = new Set<string>();

function formatReport(): string {
  const sorted = Array.from(missions.values()).sort((a, b) => a.firstSeen.localeCompare(b.firstSeen));
  const lines: string[] = [];
  lines.push('');
  lines.push('='.repeat(110));
  lines.push('  PER-MISSION API COST REPORT');
  lines.push('='.repeat(110));
  lines.push('');
  lines.push(
    '  mission                                              ' +
    'LLMs  Serper  DForSEO  Scrapes    $ LLM     $ Serper   $ DForSEO    $ TOTAL',
  );
  lines.push('  ' + '-'.repeat(106));

  let grand: CostTotals = { llmUsd: 0, serperUsd: 0, dataforseoUsd: 0, totalUsd: 0 };

  for (const m of sorted) {
    const t = computeTotals(m);
    grand = {
      llmUsd: grand.llmUsd + t.llmUsd,
      serperUsd: grand.serperUsd + t.serperUsd,
      dataforseoUsd: grand.dataforseoUsd + t.dataforseoUsd,
      totalUsd: grand.totalUsd + t.totalUsd,
    };
    lines.push(
      '  ' + m.missionId.padEnd(52) +
      String(m.llmCalls.length).padStart(4) + '  ' +
      String(m.serperCalls).padStart(6) + '  ' +
      String(m.dataforseoCalls).padStart(7) + '  ' +
      String(m.scrapeCalls).padStart(7) + '    ' +
      ('$' + t.llmUsd.toFixed(4)).padStart(8) + '    ' +
      ('$' + t.serperUsd.toFixed(4)).padStart(8) + '    ' +
      ('$' + t.dataforseoUsd.toFixed(4)).padStart(8) + '    ' +
      ('$' + t.totalUsd.toFixed(4)).padStart(8),
    );
  }
  lines.push('  ' + '-'.repeat(106));
  lines.push(
    '  ' + 'TOTAL'.padEnd(52) +
    '    '.padStart(4) + '  ' +
    '      '.padStart(6) + '  ' +
    '       '.padStart(7) + '  ' +
    '       '.padStart(7) + '    ' +
    ('$' + grand.llmUsd.toFixed(4)).padStart(8) + '    ' +
    ('$' + grand.serperUsd.toFixed(4)).padStart(8) + '    ' +
    ('$' + grand.dataforseoUsd.toFixed(4)).padStart(8) + '    ' +
    ('$' + grand.totalUsd.toFixed(4)).padStart(8),
  );
  lines.push('');
  lines.push(`  ${missions.size} missions tracked`);
  lines.push('');
  lines.push('  Note: costs are estimates. Token counts from char/3.5 approx.');
  lines.push(`  Claude Sonnet 4.6: $${CLAUDE_INPUT_PER_MTOK}/M input tokens, $${CLAUDE_OUTPUT_PER_MTOK}/M output tokens.`);
  lines.push(`  Serper: $${(SERPER_PER_QUERY * 1000).toFixed(2)}/1K queries. DataForSEO: $${DATAFORSEO_PER_LOOKUP}/lookup.`);
  lines.push('');
  return lines.join('\n');
}

async function runReport(missionFilter?: string): Promise<void> {
  if (!existsSync(LOG_PATH)) {
    console.error(`Log file not found: ${LOG_PATH}`);
    process.exit(1);
  }
  const content = readFileSync(LOG_PATH, 'utf8');
  for (const line of content.split('\n')) {
    processLine(line);
  }
  if (missionFilter) {
    const filtered = new Map<string, MissionCost>();
    const m = missions.get(missionFilter);
    if (m) { filtered.set(missionFilter, m); }
    missions.clear();
    for (const [k, v] of filtered) { missions.set(k, v); }
  }
  console.log(formatReport());
}

async function runTail(): Promise<void> {
  if (!existsSync(LOG_PATH)) {
    console.error(`Log file not found: ${LOG_PATH}`);
    process.exit(1);
  }

  // Prime the mission map by reading the existing log contents silently
  const initialContent = readFileSync(LOG_PATH, 'utf8');
  for (const line of initialContent.split('\n')) { processLine(line); }
  let position = statSync(LOG_PATH).size;

  console.log(`[cost-tracker] watching ${LOG_PATH} from byte ${position}`);
  console.log(`[cost-tracker] alerts on: $>${COST_ALERT_USD}/mission, Serper>${SERPER_ALERT_COUNT}, LLM>${LLM_ALERT_COUNT}`);

  const pollMs = 1500;
  while (true) {
    await new Promise<void>((r) => { setTimeout(r, pollMs); });
    const size = statSync(LOG_PATH).size;
    if (size <= position) {
      if (size < position) { position = 0; } // log was rotated/truncated
      continue;
    }
    await new Promise<void>((resolve) => {
      const stream = createReadStream(LOG_PATH, { start: position, end: size - 1, encoding: 'utf8' });
      const rl = createInterface({ input: stream });
      rl.on('line', (line) => {
        const alerts = processLine(line);
        for (const a of alerts) { console.log(a); }
      });
      rl.on('close', () => { position = size; resolve(); });
    });
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const tail = args.includes('--tail');
  const report = args.includes('--report') || args.length === 0;
  const missionIdx = args.indexOf('--mission');
  const missionFilter = missionIdx >= 0 ? args[missionIdx + 1] : undefined;

  if (tail) {
    await runTail();
  } else if (report) {
    await runReport(missionFilter);
  }
}

main().catch((err: unknown) => {
  console.error('Fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
