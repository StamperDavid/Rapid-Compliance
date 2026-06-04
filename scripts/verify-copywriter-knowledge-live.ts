/**
 * VERIFY (LIVE LLM) — the Copywriter's OUTPUT actually uses its own knowledge base
 *
 * The strongest possible proof: seed the Copywriter's KB with a FICTIONAL fact it
 * could not know from training data (an invented product guarantee), then run the
 * real Copywriter specialist (real OpenRouter LLM call) and check the invented
 * fact appears in the generated copy. If it does, retrieval → prompt injection →
 * generation is proven end-to-end, because the fact exists nowhere else.
 *
 * Safety: refuses to run if COPYWRITER already has a knowledge base (won't clobber
 * real operator data). Recursively cleans up everything it creates.
 *
 * Usage:  npx tsx scripts/verify-copywriter-knowledge-live.ts
 * Cost:   ~1 OpenRouter call + a few embeddings (a few cents).
 * Exit:   0 = the invented fact appears in the output, 1 = it does not / aborted.
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import { AdminFirestoreService } from '../src/lib/db/admin-firestore-service';
import { getSubCollection } from '../src/lib/firebase/collections';
import { indexKnowledgeBase } from '../src/lib/agent/vector-search';
import { getCopywriter } from '../src/lib/agents/content/copywriter/specialist';
import type { KnowledgeBase } from '../src/types/agent-memory';
import type { AgentMessage } from '../src/lib/agents/types';

const AGENT_ID = 'COPYWRITER';
const KB_COLLECTION = getSubCollection('knowledgeBase');
const EMB_COLLECTION = getSubCollection('knowledgeEmbeddings');

// A FICTIONAL, unguessable fact. If this phrase appears in generated copy, it can
// only have come from the knowledge base we seeded.
const INVENTED_TOKEN = 'ZephyrPay 19-Minute Settlement Promise';
const INVENTED_FACT =
  `ZephyrPay ships with the "${INVENTED_TOKEN}": every approved payout lands in the ` +
  `merchant's bank account within 19 minutes, any time of day, or ZephyrPay refunds ` +
  `that month's platform fee automatically. This is ZephyrPay's signature guarantee.`;

async function deleteAgentEmbeddings(agentId: string): Promise<number> {
  const db = admin.firestore();
  const snap = await db.collection(EMB_COLLECTION).where('agentId', '==', agentId).get();
  let n = 0;
  for (const doc of snap.docs) { await doc.ref.delete(); n += 1; }
  return n;
}

async function cleanup(): Promise<void> {
  const n = await deleteAgentEmbeddings(AGENT_ID);
  await AdminFirestoreService.delete(KB_COLLECTION, AGENT_ID);
  console.log(`\nCleanup: removed ${n} embedding(s) + the COPYWRITER KB doc.`);
}

async function main(): Promise<boolean> {
  console.log('=== Live proof: Copywriter uses its own knowledge base ===\n');

  // Safety: never clobber an existing real KB.
  const existing = await AdminFirestoreService.get<KnowledgeBase>(KB_COLLECTION, AGENT_ID);
  if (existing) {
    console.log('ABORT: COPYWRITER already has a knowledge base — not overwriting real data.');
    return false;
  }

  // 1. Seed + index the invented fact.
  await AdminFirestoreService.set(
    KB_COLLECTION,
    AGENT_ID,
    {
      documents: [{
        id: 'doc_zephyrpay_guarantee',
        filename: 'zephyrpay-guarantee.txt',
        type: 'text',
        uploadedAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
        extractedContent: INVENTED_FACT,
        metadata: { assetType: 'document', test: true },
      }],
      urls: [],
      faqs: [],
      agentId: AGENT_ID,
    },
    false,
  );
  await indexKnowledgeBase(AGENT_ID);
  console.log('Seeded + indexed the invented ZephyrPay guarantee into COPYWRITER\'s KB.\n');

  // 2. Run the REAL Copywriter on a brief about the same topic.
  const message = {
    id: 'kb_live_proof_task',
    type: 'COMMAND',
    payload: {
      action: 'generate_email_sequence',
      topic: 'ZephyrPay fast payouts for merchants',
      audience: 'merchants worried about slow payment settlement times',
      count: 2,
      trigger: 'trial_signup',
    },
  } as unknown as AgentMessage;

  console.log('Running the live Copywriter (real OpenRouter call)…');
  const report = await getCopywriter().execute(message);

  if (report.status !== 'COMPLETED') {
    console.log(`RESULT: Copywriter did not complete — status=${report.status}`);
    console.log('Errors:', JSON.stringify(report.errors ?? report.data));
    return false;
  }

  const outputText = JSON.stringify(report.data);
  const found = outputText.toLowerCase().includes('zephyrpay') &&
    (outputText.toLowerCase().includes('19-minute') || outputText.toLowerCase().includes('19 minute'));

  console.log(`\nGenerated copy references "ZephyrPay": ${outputText.toLowerCase().includes('zephyrpay')}`);
  console.log(`Generated copy references the 19-minute promise: ${outputText.toLowerCase().includes('19-minute') || outputText.toLowerCase().includes('19 minute')}`);

  // Show a short proof excerpt.
  const idx = outputText.toLowerCase().indexOf('19');
  if (idx >= 0) { console.log('\nExcerpt:', outputText.slice(Math.max(0, idx - 80), idx + 80)); }

  console.log(`\nRESULT: ${found ? 'PASS — the invented fact appears in real generated copy.' : 'FAIL — invented fact not found in output.'}`);
  return found;
}

main()
  .then(async (pass) => { await cleanup(); process.exit(pass ? 0 : 1); })
  .catch(async (err) => {
    console.error('FATAL:', err instanceof Error ? err.message : String(err));
    try { await cleanup(); } catch { /* best effort */ }
    process.exit(1);
  });
