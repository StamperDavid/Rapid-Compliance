/**
 * One-shot fix: update the agentConfig/default doc to use a live OpenRouter
 * model. The previous seed wrote a deprecated 3.x sonnet ID, which
 * OpenRouter no longer routes — every Alex call returned 404.
 *
 * Run: npx tsx scripts/fix-agent-config-model.ts
 */

import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const NEW_MODEL = 'openrouter/anthropic/claude-sonnet-4.6';
const PLATFORM_ID = 'rapid-compliance-root';

function initAdmin() {
  if (getApps().length > 0) return;
  // serviceAccountKey.json is the dev project (rapid-compliance-65f87) key
  // matching .env.local NEXT_PUBLIC_FIREBASE_PROJECT_ID.
  const keyPath = resolve(process.cwd(), 'serviceAccountKey.json');
  if (existsSync(keyPath)) {
    const credentials = JSON.parse(readFileSync(keyPath, 'utf8')) as Record<string, unknown>;
    initializeApp({ credential: cert(credentials as Parameters<typeof cert>[0]) });
    console.log('[fix-agent-config] using serviceAccountKey.json (rapid-compliance-65f87)');
    return;
  }
  initializeApp({ credential: applicationDefault() });
  console.log('[fix-agent-config] using application default credentials');
}

async function main() {
  initAdmin();
  const db = getFirestore();
  const ref = db
    .collection('organizations')
    .doc(PLATFORM_ID)
    .collection('agentConfig')
    .doc('default');

  const snap = await ref.get();
  const before = snap.exists ? (snap.data() ?? {}) : {};
  console.log('[fix-agent-config] before:', JSON.stringify(before, null, 2));

  await ref.set(
    {
      selectedModel: NEW_MODEL,
      modelConfig: {
        temperature: 0.7,
        maxTokens: 2048,
        topP: 0.9,
      },
      updatedAt: new Date(),
    },
    { merge: true }
  );

  const verify = await ref.get();
  console.log('[fix-agent-config] after:', JSON.stringify(verify.data(), null, 2));
  console.log('[fix-agent-config] DONE');
}

main().catch((err: unknown) => {
  console.error('[fix-agent-config] FAILED:', err);
  process.exit(1);
});
