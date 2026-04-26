/**
 * Poll the inboundSocialEvents Firestore collection every 5s and emit
 * one stdout line per new event. Used as a Monitor source so the live
 * test of an inbound X DM produces a notification the moment it lands,
 * regardless of whether it arrived at the local dev server or the
 * deployed Vercel instance (Firestore is shared).
 *
 * Baseline: every event currently in the collection at startup is
 * marked seen, so we only emit events that arrive AFTER startup.
 */
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) { return; }
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m) {
      const v = m[2].replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
      if (!process.env[m[1]]) { process.env[m[1]] = v; }
    }
  }
}

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  loadEnvLocal();
  const sakPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(sakPath)) {
    const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
}

initAdmin();

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/inboundSocialEvents`;
const POLL_INTERVAL_MS = 5_000;

const seen = new Set<string>();

interface InboundEvent {
  id: string;
  provider?: string;
  kind?: string;
  receivedAt?: string;
  processed?: boolean;
  mission_initiated?: boolean;
  missionId?: string;
  payload?: {
    direct_message_events?: Array<{
      message_create?: {
        sender_id?: string;
        message_data?: { text?: string };
      };
    }>;
  };
}

function summarize(ev: InboundEvent): string {
  const dm = ev.payload?.direct_message_events?.[0]?.message_create;
  const sender = dm?.sender_id ?? '(no sender)';
  const text = dm?.message_data?.text ?? '(no text)';
  const text80 = text.length > 80 ? `${text.slice(0, 80)}...` : text;
  return `[inbound-event] ${ev.receivedAt} kind=${ev.kind ?? '?'} sender=${sender} processed=${ev.processed === true} mission=${ev.missionId ?? '-'} text="${text80}"`;
}

async function poll(): Promise<void> {
  try {
    const snap = await admin
      .firestore()
      .collection(COLLECTION)
      .orderBy('receivedAt', 'desc')
      .limit(20)
      .get();
    for (const doc of snap.docs) {
      const ev = doc.data() as InboundEvent;
      if (seen.has(ev.id)) { continue; }
      seen.add(ev.id);
      // Skip the baseline (everything that already existed at startup).
      // We tag baseline events on the first pass below.
      if ((process.env.WATCH_INBOUND_BASELINE_DONE) !== '1') { continue; }
      console.log(summarize(ev));
    }
  } catch (err) {
    console.log(`[inbound-event] poll error: ${(err as Error).message}`);
  }
}

async function main(): Promise<void> {
  // Baseline: mark everything currently in the collection as seen, then
  // flip the flag so subsequent passes emit new events.
  const baseline = await admin
    .firestore()
    .collection(COLLECTION)
    .orderBy('receivedAt', 'desc')
    .limit(50)
    .get();
  for (const doc of baseline.docs) {
    const ev = doc.data() as InboundEvent;
    seen.add(ev.id);
  }
  console.log(`[inbound-event] baseline: ${seen.size} events already in collection — only emitting NEW events from now on. Polling every ${POLL_INTERVAL_MS / 1000}s.`);
  process.env.WATCH_INBOUND_BASELINE_DONE = '1';

  // Run forever
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await poll();
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main().catch((err) => { console.error('watch-inbound-social-events failed:', err); process.exit(1); });
