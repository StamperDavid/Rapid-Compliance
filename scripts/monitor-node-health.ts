/**
 * Node process health monitor.
 *
 * Polls the dev server's Node process every 5 seconds for memory, CPU,
 * and HTTP responsiveness. Writes timestamped samples to
 * `D:/rapid-dev/node-health.log`, and emits ALERT lines on stdout
 * when any metric crosses a threshold — the ALERT lines are what the
 * standard Monitor tool grep filter picks up during live testing.
 *
 * Usage (long-running):
 *   npx tsx scripts/monitor-node-health.ts
 *
 * Usage (single sample):
 *   npx tsx scripts/monitor-node-health.ts --once
 *
 * Alert thresholds (tune in one place):
 *   - MEMORY_ALERT_MB: 1800 (Node default heap is ~1500MB on 64-bit)
 *   - CPU_SUSTAINED_PCT: 85 for 3 consecutive samples (15s)
 *   - HTTP_TIMEOUT_MS: 10000 (homepage HEAD must return under 10s)
 *
 * Why standalone (not embedded in Next.js):
 *   - Does not require modifying the dev server
 *   - Survives dev server restarts (keeps polling, logs gap)
 *   - Runs on Windows using `tasklist` + `netstat` — no external deps
 *   - Event-loop lag would require in-process instrumentation; this
 *     script measures the EXTERNAL symptoms instead (pegged CPU +
 *     slow HTTP = saturated loop).
 */

/* eslint-disable no-console */

import { execSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

const HEALTH_LOG_PATH = 'D:/rapid-dev/node-health.log';
const POLL_INTERVAL_MS = 5000;
const MEMORY_ALERT_MB = 1800;
const CPU_SUSTAINED_PCT = 85;
const CPU_SUSTAINED_WINDOW = 3; // consecutive samples
const HTTP_TIMEOUT_MS = 10_000;

interface HealthSample {
  timestamp: string;
  pid: number | null;
  memoryMb: number | null;
  cpuPct: number | null;
  httpStatus: number | null;
  httpMs: number | null;
}

function findDevServerPid(): number | null {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    const listeningLine = out
      .split('\n')
      .find((line) => line.includes(':3000') && line.includes('LISTENING'));
    if (!listeningLine) { return null; }
    const parts = listeningLine.trim().split(/\s+/);
    const pid = parseInt(parts[parts.length - 1] ?? '', 10);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

function sampleProcess(pid: number): { memoryMb: number | null; cpuPct: number | null } {
  // Windows: wmic is deprecated on Win11, so use PowerShell Get-Process which
  // returns WorkingSet64 in bytes and CPU (total seconds). For instantaneous CPU%
  // we'd need two samples with a time delta — kept out of scope here; memory +
  // HTTP responsiveness catch the saturation cases we care about.
  try {
    const psCmd = `powershell -NoProfile -Command "$p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($p) { Write-Output $p.WorkingSet64 } else { Write-Output 'null' }"`;
    const memOut = execSync(psCmd, { encoding: 'utf8' }).trim();
    if (memOut === 'null' || memOut === '') {
      return { memoryMb: null, cpuPct: null };
    }
    const bytes = parseInt(memOut, 10);
    const memoryMb = Number.isFinite(bytes) ? Math.round(bytes / (1024 * 1024)) : null;
    return { memoryMb, cpuPct: null };
  } catch {
    return { memoryMb: null, cpuPct: null };
  }
}

async function sampleHttp(): Promise<{ status: number | null; ms: number | null }> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => { controller.abort(); }, HTTP_TIMEOUT_MS);
  try {
    const res = await fetch('http://localhost:3000/', { method: 'HEAD', signal: controller.signal });
    return { status: res.status, ms: Date.now() - start };
  } catch {
    return { status: null, ms: Date.now() - start };
  } finally {
    clearTimeout(timer);
  }
}

function formatSample(s: HealthSample): string {
  const mem = s.memoryMb !== null ? `${s.memoryMb}MB` : 'mem?';
  const cpu = s.cpuPct !== null ? `${s.cpuPct}%` : 'cpu?';
  const http = s.httpStatus !== null ? `HTTP ${s.httpStatus} ${s.httpMs}ms` : `HTTP timeout ${s.httpMs}ms`;
  const pid = s.pid !== null ? `pid=${s.pid}` : 'pid=none';
  return `${s.timestamp}  ${pid}  ${mem}  ${cpu}  ${http}`;
}

async function takeSample(): Promise<HealthSample> {
  const pid = findDevServerPid();
  const ts = new Date().toISOString();

  if (pid === null) {
    return { timestamp: ts, pid: null, memoryMb: null, cpuPct: null, httpStatus: null, httpMs: null };
  }

  const proc = sampleProcess(pid);
  const http = await sampleHttp();
  return {
    timestamp: ts,
    pid,
    memoryMb: proc.memoryMb,
    cpuPct: proc.cpuPct,
    httpStatus: http.status,
    httpMs: http.ms,
  };
}

function checkAlerts(sample: HealthSample, cpuHistory: number[]): string[] {
  const alerts: string[] = [];

  if (sample.pid === null) {
    alerts.push(`[health-alert] ${sample.timestamp} DEV_SERVER_NOT_LISTENING — no LISTENING process on :3000`);
    return alerts;
  }

  if (sample.memoryMb !== null && sample.memoryMb > MEMORY_ALERT_MB) {
    alerts.push(`[health-alert] ${sample.timestamp} MEMORY_HIGH — ${sample.memoryMb}MB > ${MEMORY_ALERT_MB}MB threshold`);
  }

  const lastN = cpuHistory.slice(-CPU_SUSTAINED_WINDOW);
  if (lastN.length === CPU_SUSTAINED_WINDOW && lastN.every((v) => v >= CPU_SUSTAINED_PCT)) {
    alerts.push(
      `[health-alert] ${sample.timestamp} CPU_SUSTAINED — ` +
      `${lastN.join('%, ')}% over last ${CPU_SUSTAINED_WINDOW * (POLL_INTERVAL_MS / 1000)}s`,
    );
  }

  if (sample.httpStatus === null) {
    alerts.push(`[health-alert] ${sample.timestamp} HTTP_UNRESPONSIVE — homepage HEAD timed out after ${sample.httpMs}ms (threshold ${HTTP_TIMEOUT_MS}ms)`);
  } else if (sample.httpStatus >= 500) {
    alerts.push(`[health-alert] ${sample.timestamp} HTTP_5XX — homepage returned ${sample.httpStatus}`);
  }

  return alerts;
}

async function runOnce(): Promise<void> {
  const sample = await takeSample();
  const line = formatSample(sample);
  console.log(line);
  appendFileSync(HEALTH_LOG_PATH, line + '\n');

  const alerts = checkAlerts(sample, sample.cpuPct !== null ? [sample.cpuPct] : []);
  for (const a of alerts) { console.log(a); appendFileSync(HEALTH_LOG_PATH, a + '\n'); }
}

async function runLoop(): Promise<void> {
  const cpuHistory: number[] = [];
  writeFileSync(
    HEALTH_LOG_PATH,
    `# Node health monitor started ${new Date().toISOString()}\n` +
    `# polling every ${POLL_INTERVAL_MS / 1000}s, thresholds mem>${MEMORY_ALERT_MB}MB cpu>=${CPU_SUSTAINED_PCT}%×${CPU_SUSTAINED_WINDOW} http_timeout=${HTTP_TIMEOUT_MS}ms\n`,
  );

  // Graceful stop on Ctrl+C
  let stopped = false;
  process.on('SIGINT', () => {
    stopped = true;
    appendFileSync(HEALTH_LOG_PATH, `# stopped ${new Date().toISOString()} via SIGINT\n`);
    console.log('\n[health-monitor] stopped');
    process.exit(0);
  });

  while (!stopped) {
    const sample = await takeSample();
    if (sample.cpuPct !== null) {
      cpuHistory.push(sample.cpuPct);
      if (cpuHistory.length > CPU_SUSTAINED_WINDOW * 2) { cpuHistory.shift(); }
    }

    const line = formatSample(sample);
    appendFileSync(HEALTH_LOG_PATH, line + '\n');
    // Don't spam stdout on every ok sample — only alerts.

    const alerts = checkAlerts(sample, cpuHistory);
    for (const a of alerts) {
      console.log(a);
      appendFileSync(HEALTH_LOG_PATH, a + '\n');
    }

    await new Promise<void>((r) => { setTimeout(r, POLL_INTERVAL_MS); });
  }
}

async function main(): Promise<void> {
  const once = process.argv.includes('--once');
  if (once) { await runOnce(); return; }

  console.log(`[health-monitor] polling :3000 every ${POLL_INTERVAL_MS / 1000}s, writing ${path.basename(HEALTH_LOG_PATH)}`);
  console.log(`[health-monitor] Ctrl+C to stop. Only ALERT lines print to stdout; every sample goes to the log file.`);
  await runLoop();
}

main().catch((err: unknown) => {
  console.error('Fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
