/**
 * migrate-gm-system-prompt.ts
 *
 * Populates the active Jasper orchestrator Golden Master with the full
 * compiled system prompt from the two canonical source modules:
 *   - JASPER_THOUGHT_PARTNER_PROMPT  (src/lib/orchestrator/jasper-thought-partner.ts)
 *   - ADMIN_ORCHESTRATOR_PROMPT      (src/lib/orchestrator/feature-manifest.ts)
 *
 * This must be run whenever either source file changes so Firestore stays in
 * sync with the live prompt the chat route would build at request time.
 *
 * Usage:
 *   npx tsx scripts/migrate-gm-system-prompt.ts
 *
 * Prerequisites:
 *   - .env.local must contain FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL,
 *     and FIREBASE_ADMIN_PRIVATE_KEY (matching src/lib/firebase/admin.ts pattern).
 *   - An active orchestrator Golden Master must already exist in Firestore
 *     (run `node scripts/seed-golden-masters.js` first if needed).
 */

// eslint uses the src/ tsconfig paths — tsx resolves @/ from tsconfig.json at project root.
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

// CJS require is needed for firebase-admin and dotenv (CommonJS packages).
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local before anything else so admin SDK credentials are available.
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// Import prompt constants from the canonical TS source modules.
// tsx resolves @/ via the baseUrl + paths in tsconfig.json.
import { JASPER_THOUGHT_PARTNER_PROMPT } from '../src/lib/orchestrator/jasper-thought-partner';
import { ADMIN_ORCHESTRATOR_PROMPT } from '../src/lib/orchestrator/feature-manifest';

const admin = require('firebase-admin') as typeof import('firebase-admin');

// ============================================================================
// Constants
// ============================================================================

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/goldenMasters`;

// ============================================================================
// Firebase Admin initialisation (same pattern as seed-golden-masters.js)
// ============================================================================

if (!admin.apps.length) {
  const projectId =
    process.env['FIREBASE_ADMIN_PROJECT_ID'] ??
    process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'];
  const clientEmail = process.env['FIREBASE_ADMIN_CLIENT_EMAIL'];
  const privateKey = process.env['FIREBASE_ADMIN_PRIVATE_KEY']?.replace(
    /\\n/g,
    '\n',
  );

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      'ERROR: Missing FIREBASE_ADMIN_* environment variables. Check .env.local.',
    );
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

const db = admin.firestore();

// ============================================================================
// Main migration logic
// ============================================================================

async function main(): Promise<void> {
  console.log('migrate-gm-system-prompt: starting...\n');

  // Compile the full prompt exactly as the chat route expects it.
  // The chat route uses basePrompt (from GM) then layered by buildEnhancedSystemPrompt.
  // The two source modules are the static foundation — runtime context is added separately.
  const fullPrompt =
    JASPER_THOUGHT_PARTNER_PROMPT + '\n\n' + ADMIN_ORCHESTRATOR_PROMPT;

  console.log(
    `Compiled prompt length: ${fullPrompt.length.toLocaleString()} characters`,
  );

  // Find the active orchestrator GM.
  const snapshot = await db
    .collection(COLLECTION)
    .where('agentType', '==', 'orchestrator')
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.error(
      'ERROR: No active orchestrator Golden Master found in Firestore.\n' +
        '       Run `node scripts/seed-golden-masters.js` first.',
    );
    process.exit(1);
  }

  const docRef = snapshot.docs[0].ref;
  const docId = snapshot.docs[0].id;

  console.log(`Found active orchestrator GM: ${docId}`);

  // Update systemPrompt and leave all other fields untouched.
  await docRef.update({
    systemPrompt: fullPrompt,
    notes:
      'Full compiled prompt from JASPER_THOUGHT_PARTNER_PROMPT + ADMIN_ORCHESTRATOR_PROMPT. ' +
      `Migrated ${new Date().toISOString()}. ` +
      'Re-run migrate-gm-system-prompt.ts whenever either source file changes.',
  });

  console.log(`\nDone. Golden Master "${docId}" updated with full prompt.`);
  console.log(
    'The chat route will now use this compiled prompt as the GM base.',
  );
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error('FATAL:', message);
    process.exit(1);
  });
