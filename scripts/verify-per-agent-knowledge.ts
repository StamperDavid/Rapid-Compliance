/**
 * VERIFY — Per-agent knowledge base isolation (real Firestore)
 *
 * Proves the core promise of per-agent knowledge bases: each agent retrieves
 * ONLY from its own knowledge, with no bleed across agents and no bleed into the
 * global (Jasper/chat) RAG path.
 *
 * The test (uses two throwaway synthetic agent IDs so it never touches a real
 * agent's KB):
 *   1. Seed agent A's KB with a document containing a unique token.
 *   2. Seed agent B's KB with a different document/token.
 *   3. Index both (real embedding + write path, incl. stale-cleanup).
 *   4. Assert A's own search finds A's token.
 *   5. Assert B's search does NOT find A's token (cross-agent isolation).
 *   6. Assert the GLOBAL search does NOT find A's token (no bleed into chat RAG).
 *   7. Assert getAgentKnowledgeContext mirrors the same isolation.
 *   8. RECURSIVELY delete every test doc + every test embedding (no residue).
 *
 * Usage:  npx tsx scripts/verify-per-agent-knowledge.ts
 * Exit:   0 = all assertions pass and cleanup verified empty, 1 = any failure.
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
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  } else {
    throw new Error('Missing FIREBASE_ADMIN_* env vars in .env.local');
  }
}

initAdmin();

import { searchKnowledgeBase, indexKnowledgeBase } from '../src/lib/agent/vector-search';
import { getAgentKnowledgeContext } from '../src/lib/agent/rag-service';
import { AdminFirestoreService } from '../src/lib/db/admin-firestore-service';
import { getSubCollection } from '../src/lib/firebase/collections';
import type { KnowledgeBase } from '../src/types/agent-memory';

const AGENT_A = '__kbtest_agent_a';
const AGENT_B = '__kbtest_agent_b';

// Distinctive tokens that will NOT appear in any real KB.
const TOKEN_A = 'Zentabulous';
const TOKEN_B = 'Blogwidgetron';

const DOC_A = `${TOKEN_A} Onboarding Guarantee: every ${TOKEN_A} customer reaches full activation within seven days or that month is completely free. This is the signature ${TOKEN_A} promise.`;
const DOC_B = `${TOKEN_B} Editorial Standard: never publish a ${TOKEN_B} article shorter than twelve hundred words, and always include three supporting data points.`;

// Query overlaps A's wording so retrieval fires under either real or fallback embeddings.
const QUERY_A = `${TOKEN_A} onboarding guarantee activation seven days promise`;

const KB_COLLECTION = getSubCollection('knowledgeBase');
const EMB_COLLECTION = getSubCollection('knowledgeEmbeddings');

let failures = 0;
function check(label: string, pass: boolean): void {
  console.log(`${pass ? '✅ PASS' : '❌ FAIL'} — ${label}`);
  if (!pass) { failures += 1; }
}

function seedDoc(token: string, content: string): KnowledgeBase {
  return {
    documents: [{
      id: `doc_${token}_seed`,
      filename: `${token}-seed.txt`,
      type: 'text',
      uploadedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      extractedContent: content,
      metadata: { test: true },
    }],
    urls: [],
    faqs: [],
  };
}

async function deleteAgentEmbeddings(agentId: string): Promise<number> {
  const db = admin.firestore();
  const snap = await db.collection(EMB_COLLECTION).where('agentId', '==', agentId).get();
  let n = 0;
  for (const doc of snap.docs) {
    await doc.ref.delete();
    n += 1;
  }
  return n;
}

async function cleanup(): Promise<void> {
  console.log('\n— Cleanup (recursive) —');
  const a = await deleteAgentEmbeddings(AGENT_A);
  const b = await deleteAgentEmbeddings(AGENT_B);
  await AdminFirestoreService.delete(KB_COLLECTION, AGENT_A);
  await AdminFirestoreService.delete(KB_COLLECTION, AGENT_B);
  console.log(`Deleted ${a} embeddings for ${AGENT_A}, ${b} for ${AGENT_B}, and both KB docs.`);

  // Verify no residue.
  const db = admin.firestore();
  const leftA = await db.collection(EMB_COLLECTION).where('agentId', '==', AGENT_A).get();
  const leftB = await db.collection(EMB_COLLECTION).where('agentId', '==', AGENT_B).get();
  const kbA = await AdminFirestoreService.get<KnowledgeBase>(KB_COLLECTION, AGENT_A);
  const kbB = await AdminFirestoreService.get<KnowledgeBase>(KB_COLLECTION, AGENT_B);
  check('cleanup left zero embeddings + zero KB docs', leftA.empty && leftB.empty && kbA === null && kbB === null);
}

async function main(): Promise<void> {
  console.log('=== Per-agent knowledge isolation proof ===\n');

  // 1-3. Seed + index both agents.
  await AdminFirestoreService.set(KB_COLLECTION, AGENT_A, { ...seedDoc(TOKEN_A, DOC_A), agentId: AGENT_A }, false);
  await AdminFirestoreService.set(KB_COLLECTION, AGENT_B, { ...seedDoc(TOKEN_B, DOC_B), agentId: AGENT_B }, false);
  await indexKnowledgeBase(AGENT_A);
  await indexKnowledgeBase(AGENT_B);
  console.log('Seeded + indexed two agent KBs.\n');

  const hasTokenA = (results: { text: string }[]): boolean => results.some((r) => r.text.includes(TOKEN_A));

  // 4. A finds its own token.
  const ownSearch = await searchKnowledgeBase(QUERY_A, 5, AGENT_A);
  check(`Agent A retrieves its own "${TOKEN_A}" doc (${ownSearch.length} hits)`, hasTokenA(ownSearch));

  // 5. B does NOT find A's token.
  const crossSearch = await searchKnowledgeBase(QUERY_A, 5, AGENT_B);
  check(`Agent B does NOT see Agent A's "${TOKEN_A}" doc (cross-agent isolation)`, !hasTokenA(crossSearch));

  // 6. Global does NOT find A's token.
  const globalSearch = await searchKnowledgeBase(QUERY_A, 5);
  check(`Global chat RAG does NOT see Agent A's "${TOKEN_A}" doc (no bleed into Jasper)`, !hasTokenA(globalSearch));

  // 7. Prompt-injection helper mirrors isolation.
  const ctxA = await getAgentKnowledgeContext(AGENT_A, QUERY_A);
  const ctxB = await getAgentKnowledgeContext(AGENT_B, QUERY_A);
  check('getAgentKnowledgeContext(A) returns A\'s knowledge block', ctxA.includes(TOKEN_A));
  check('getAgentKnowledgeContext(B) excludes A\'s knowledge', !ctxB.includes(TOKEN_A));
}

main()
  .then(cleanup)
  .then(() => {
    console.log(`\n=== ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} ===`);
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch(async (err) => {
    console.error('FATAL:', err);
    try { await cleanup(); } catch { /* best effort */ }
    process.exit(1);
  });
