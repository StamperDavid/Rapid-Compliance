/**
 * Zombie-work detector for Bug H.
 *
 * Bug H: cancelling or halting a mission only writes Firestore —
 * it does NOT abort any in-flight fetch / LLM call / scrape. So the
 * UI shows the mission as cancelled/failed within seconds, but the
 * Node process keeps burning API calls for another 3-5 minutes until
 * the underlying work naturally completes.
 *
 * This script tails the server log, marks every mission that reaches
 * a terminal state (halting mission, Mission cancelled, newStatus=FAILED,
 * newStatus=COMPLETED), then alerts whenever a subsequent log line
 * references that same mission's id (or a child workload keyed to its
 * specialists) after a configurable grace period.
 *
 * Usage:
 *   npx tsx scripts/detect-zombie-work.ts --tail        # live watcher
 *   npx tsx scripts/detect-zombie-work.ts --report      # one-shot report from log
 *
 * Tuning:
 *   - GRACE_MS: 10000  (10s of legitimate cleanup after terminal state)
 *   - MAX_TRACK_MS: 900000 (15 min — stop tracking a mission after this)
 *
 * Output:
 *   - Writes ALERT lines to stdout that the standard Monitor tool catches
 *   - Writes full sample log to D:/rapid-dev/zombie-alerts.log
 */

/* eslint-disable no-console */

import { readFileSync, existsSync, statSync, appendFileSync, writeFileSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const LOG_PATH = 'D:/rapid-dev/dev-server.log';
const ALERT_LOG_PATH = 'D:/rapid-dev/zombie-alerts.log';
const GRACE_MS = 10_000;
const MAX_TRACK_MS = 15 * 60 * 1000;

interface ZombieTracker {
  missionId: string;
  terminalStateAt: number; // epoch ms
  terminalReason: string;
  zombieHits: Array<{ ts: number; line: string }>;
  reported: boolean; // reported at least once
}

const trackers = new Map<string, ZombieTracker>();

const TS_RE = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/;
const MISSION_ID_RE = /"missionId":"(mission_req_[a-z0-9_]+)"|\bmission_req_[a-z0-9_]+\b/;

/** Terminal state markers — once a mission hits one of these, any further work
 *  on that mission is zombie work (excluding cleanup within GRACE_MS). */
const TERMINAL_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /halting mission/, label: 'halted' },
  { re: /Mission cancelled/, label: 'cancelled' },
  { re: /newStatus=FAILED/, label: 'failed' },
  { re: /newStatus=COMPLETED/, label: 'completed' },
  { re: /Mission finalized/, label: 'finalized' },
];

/** Work markers — if we see any of these AFTER terminal + grace, it's a zombie. */
const WORK_PATTERNS: RegExp[] = [
  /\[llm\] OpenRouter\.chat start/,
  /\[Web Scraper\]/,
  /\[phase\] serper done/,
  /\[phase\] calling LLM/,
  /\[delegate\] specialist=.* starting/,
  /DataForSEO\.getDomainMetrics/,
];

function parseTs(line: string): number | null {
  const m = TS_RE.exec(line);
  if (!m) { return null; }
  const d = new Date(m[1]);
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

function extractMissionId(line: string): string | null {
  const m = MISSION_ID_RE.exec(line);
  if (!m) { return null; }
  return m[1] ?? m[0];
}

function processLine(line: string): string[] {
  const alerts: string[] = [];
  const ts = parseTs(line) ?? Date.now();
  const mid = extractMissionId(line);
  if (mid === null) { return alerts; }

  // Did this line mark the mission as terminal?
  for (const tp of TERMINAL_PATTERNS) {
    if (tp.re.test(line)) {
      const existing = trackers.get(mid);
      if (!existing || existing.terminalStateAt === 0) {
        trackers.set(mid, {
          missionId: mid,
          terminalStateAt: ts,
          terminalReason: tp.label,
          zombieHits: existing?.zombieHits ?? [],
          reported: existing?.reported ?? false,
        });
      }
      return alerts;
    }
  }

  // Is this a work marker for a mission that's already terminal?
  const tracker = trackers.get(mid);
  if (!tracker || tracker.terminalStateAt === 0) { return alerts; }

  // Skip if still within grace period
  if (ts - tracker.terminalStateAt < GRACE_MS) { return alerts; }

  // Skip if we've stopped tracking
  if (ts - tracker.terminalStateAt > MAX_TRACK_MS) { return alerts; }

  // Does it match any work pattern?
  const isWork = WORK_PATTERNS.some((re) => re.test(line));
  if (!isWork) { return alerts; }

  tracker.zombieHits.push({ ts, line: line.slice(0, 200) });

  const delayS = Math.round((ts - tracker.terminalStateAt) / 1000);
  const alert =
    `[zombie-alert] ${new Date(ts).toISOString()} MISSION ${mid} (${tracker.terminalReason}) — ` +
    `zombie work detected ${delayS}s after terminal state. ` +
    `Sample: ${line.trim().slice(0, 120)}`;
  alerts.push(alert);
  tracker.reported = true;

  return alerts;
}

function formatReport(): string {
  const zombied = Array.from(trackers.values()).filter((t) => t.zombieHits.length > 0);
  const lines: string[] = [];
  lines.push('');
  lines.push('='.repeat(100));
  lines.push('  ZOMBIE-WORK REPORT');
  lines.push('='.repeat(100));
  lines.push('');

  if (zombied.length === 0) {
    lines.push('  ✓ No zombie work detected in current log.');
    lines.push(`  ${trackers.size} missions tracked through terminal state.`);
    lines.push('');
    return lines.join('\n');
  }

  lines.push(`  Found ${zombied.length} mission(s) with zombie work after terminal state.`);
  lines.push('');
  for (const t of zombied) {
    const lastHit = t.zombieHits[t.zombieHits.length - 1];
    const firstHit = t.zombieHits[0];
    const windowS = Math.round((lastHit.ts - t.terminalStateAt) / 1000);
    const firstDelayS = Math.round((firstHit.ts - t.terminalStateAt) / 1000);
    lines.push(`  • ${t.missionId}`);
    lines.push(`      terminal state: ${t.terminalReason} at ${new Date(t.terminalStateAt).toISOString()}`);
    lines.push(`      ${t.zombieHits.length} zombie event(s), first ${firstDelayS}s after terminal, last ${windowS}s after`);
    lines.push(`      sample: ${firstHit.line.slice(0, 130)}`);
    lines.push('');
  }
  return lines.join('\n');
}

async function runReport(): Promise<void> {
  if (!existsSync(LOG_PATH)) {
    console.error(`Log file not found: ${LOG_PATH}`);
    process.exit(1);
  }
  const content = readFileSync(LOG_PATH, 'utf8');
  for (const line of content.split('\n')) {
    processLine(line);
  }
  console.log(formatReport());
}

async function runTail(): Promise<void> {
  if (!existsSync(LOG_PATH)) {
    console.error(`Log file not found: ${LOG_PATH}`);
    process.exit(1);
  }

  // Initialize alert log
  writeFileSync(
    ALERT_LOG_PATH,
    `# Zombie-work detector started ${new Date().toISOString()}\n` +
    `# grace=${GRACE_MS / 1000}s, max-track=${MAX_TRACK_MS / 60000}min\n`,
  );

  // Prime trackers from existing log
  const initialContent = readFileSync(LOG_PATH, 'utf8');
  for (const line of initialContent.split('\n')) { processLine(line); }
  let position = statSync(LOG_PATH).size;

  console.log(`[zombie-detector] watching ${LOG_PATH} from byte ${position}`);
  console.log(`[zombie-detector] grace period ${GRACE_MS / 1000}s, tracking each mission for up to ${MAX_TRACK_MS / 60000}min after terminal state`);
  console.log(`[zombie-detector] alert lines print to stdout; full log at ${ALERT_LOG_PATH}`);

  const pollMs = 1500;
  while (true) {
    await new Promise<void>((r) => { setTimeout(r, pollMs); });
    const size = statSync(LOG_PATH).size;
    if (size <= position) {
      if (size < position) { position = 0; }
      continue;
    }
    await new Promise<void>((resolve) => {
      const stream = createReadStream(LOG_PATH, { start: position, end: size - 1, encoding: 'utf8' });
      const rl = createInterface({ input: stream });
      rl.on('line', (line) => {
        const alerts = processLine(line);
        for (const a of alerts) {
          console.log(a);
          appendFileSync(ALERT_LOG_PATH, a + '\n');
        }
      });
      rl.on('close', () => { position = size; resolve(); });
    });
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--tail')) {
    await runTail();
  } else {
    await runReport();
  }
}

main().catch((err: unknown) => {
  console.error('Fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
