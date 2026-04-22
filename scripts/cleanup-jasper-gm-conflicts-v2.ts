/**
 * Round 2 cleanup of Jasper's GM. Round 1 (cleanup-jasper-gm-conflicts.ts)
 * neutralized the read-only-tools-as-plan-steps contradictions in the early/
 * middle sections. The verify-jasper-plan-fidelity.ts test against v5 still
 * showed:
 *
 *   - query_docs in plans 4/5 runs (chat-context "use query_docs" instructions
 *     at lines 585, 723, 740 are bleeding into plan-step decisions)
 *   - save_blog_draft in plans 5/5 runs (Jasper's GM EXPLICITLY tells him to
 *     use save_blog_draft for blogs and NOT delegate_to_content — directly
 *     contradicts the CLAUDE.md standing rule that Jasper delegates to
 *     managers only, never to specialists)
 *
 * This script:
 *   1. Reframes the chat-context tool instructions with explicit "(chat
 *      replies only — NEVER as a plan step)" annotations
 *   2. Reverses the save_blog_draft routing rules: blogs go through
 *      delegate_to_content (which routes to BLOG_WRITER via Content Manager)
 *
 * Idempotent: every replacement verified verbatim. Aborts on mismatch.
 *
 * Usage: npx tsx scripts/cleanup-jasper-gm-conflicts-v2.ts [--dry-run]
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

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/goldenMasters`;

interface Replacement {
  description: string;
  before: string;
  after: string;
}

const REPLACEMENTS: Replacement[] = [
  // === CHAT-CONTEXT TOOL INSTRUCTIONS — annotate as chat-only ===
  {
    description: 'Annotate "Platform capabilities → Use query_docs" as chat-only',
    before: '- Platform capabilities → Use query_docs tool first',
    after: '- Platform capabilities → Use query_docs (CHAT REPLIES ONLY — never include as a step in propose_mission_plan)',
  },
  {
    description: 'Annotate "Organization counts → Use get_platform_stats" as chat-only',
    before: '- Organization counts, statistics → Use get_platform_stats tool first',
    after: '- Organization counts, statistics → Use get_platform_stats (CHAT REPLIES ONLY — never include as a step in propose_mission_plan)',
  },
  {
    description: 'Annotate "Feature configuration → Use get_system_state" as chat-only',
    before: '- Feature configuration → Use get_system_state tool first',
    after: '- Feature configuration → Use get_system_state (CHAT REPLIES ONLY — never include as a step in propose_mission_plan)',
  },
  {
    description: 'Annotate "Agent status → Use inspect_agent_logs" as chat-only',
    before: '- Agent status or logs → Use inspect_agent_logs tool first',
    after: '- Agent status or logs → Use inspect_agent_logs (CHAT REPLIES ONLY — never include as a step in propose_mission_plan)',
  },
  {
    description: 'Annotate KEY VOICE RULE 1 (get_platform_stats) as chat-only',
    before: '1. NEVER guess numbers - always use get_platform_stats',
    after: '1. NEVER guess numbers - always use get_platform_stats (in chat replies only — never as a plan step)',
  },
  {
    description: 'Annotate KEY VOICE RULE 2 (query_docs) as chat-only',
    before: '2. NEVER assume capabilities - always use query_docs',
    after: '2. NEVER assume capabilities - always use query_docs (in chat replies only — never as a plan step)',
  },
  {
    description: 'Annotate KEY VOICE RULE 3 (get_system_state) as chat-only',
    before: '3. NEVER speculate on status - always use get_system_state',
    after: '3. NEVER speculate on status - always use get_system_state (in chat replies only — never as a plan step)',
  },
  // === save_blog_draft — REVERSE the routing rules ===
  {
    description: 'REVERSE blog-routing rule: blogs go through delegate_to_content (line 618)',
    before: '- Blog posts → save_blog_draft DIRECTLY (never delegate_to_content for blogs)',
    after: '- Blog posts → delegate_to_content (which routes to the BLOG_WRITER specialist through the Content Manager review gate). NEVER call save_blog_draft directly — that bypasses the manager review and the training loop.',
  },
  {
    description: 'REVERSE delegate_to_content description: it DOES handle blogs (line 673)',
    before: '- Content creation (video, email, social) — NOT for blog posts (use save_blog_draft)',
    after: '- Content creation (blog posts, video, email, social) — ALWAYS delegate via this tool, never call specialist tools (save_blog_draft, generate_video, etc.) directly',
  },
  {
    description: 'Remove save_blog_draft from campaign workflow example (line 504)',
    before: 'eates a campaign container, then\n   you call produce_video, save_blog_draft, social_post etc. with the campaignId.',
    after: 'eates a campaign container, then\n   delegate_to_content / delegate_to_marketing handle the deliverables with the campaignId.',
  },
];

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const db = admin.firestore();

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`  Jasper GM Cleanup v2 ${dryRun ? '[DRY RUN]' : ''}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const snap = await db.collection(COLLECTION)
    .where('agentType', '==', 'orchestrator')
    .where('isActive', '==', true)
    .limit(1)
    .get();
  if (snap.empty) { throw new Error('No active orchestrator GM found'); }
  const currentDoc = snap.docs[0];
  const currentData = currentDoc.data();
  const currentPrompt: string = currentData.systemPrompt;
  const currentVersion: string = currentData.version ?? 'v?';
  console.log(`Loaded active GM: ${currentDoc.id} (${currentVersion}, ${currentPrompt.length} chars)\n`);

  let newPrompt = currentPrompt;
  let appliedCount = 0;
  for (const r of REPLACEMENTS) {
    if (!newPrompt.includes(r.before)) {
      console.error(`✗ ABORT: replacement not applicable — "before" text not found verbatim:`);
      console.error(`  ${r.description}`);
      console.error(`  Looking for: ${JSON.stringify(r.before.slice(0, 120))}`);
      process.exit(1);
    }
    newPrompt = newPrompt.replace(r.before, r.after);
    appliedCount++;
    console.log(`✓ ${r.description}`);
  }
  console.log(`\nApplied ${appliedCount}/${REPLACEMENTS.length}`);
  console.log(`New prompt length: ${newPrompt.length} chars (was ${currentPrompt.length}, delta ${newPrompt.length - currentPrompt.length})\n`);

  if (dryRun) {
    console.log('[dry-run] No writes. Re-run without --dry-run to deploy.');
    process.exit(0);
  }

  const currentVersionNumber = parseInt(currentVersion.replace(/^v/, ''), 10);
  if (Number.isNaN(currentVersionNumber)) { throw new Error(`Cannot parse version "${currentVersion}"`); }
  const newVersionNumber = currentVersionNumber + 1;
  const newVersion = `v${newVersionNumber}`;
  const newDocId = `gm_orchestrator_v${newVersionNumber}`;
  const now = new Date().toISOString();

  const newDoc = {
    ...currentData,
    id: newDocId,
    version: newVersion,
    versionNumber: newVersionNumber,
    systemPrompt: newPrompt,
    systemPromptSnapshot: newPrompt,
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy: 'cleanup_jasper_gm_conflicts_v2_script',
    notes: `Round 2 conflict cleanup. Annotated chat-context tool instructions with explicit "(CHAT REPLIES ONLY — never as a plan step)". Reversed save_blog_draft routing — blogs now go through delegate_to_content per CLAUDE.md standing rule. Created from ${currentDoc.id}. ${appliedCount} replacements applied.`,
    previousVersion: currentVersionNumber,
  };

  const batch = db.batch();
  batch.update(currentDoc.ref, {
    isActive: false,
    deactivatedAt: now,
    deactivatedReason: `superseded by ${newDocId} (round 2 cleanup)`,
  });
  batch.set(db.collection(COLLECTION).doc(newDocId), newDoc);
  await batch.commit();

  console.log(`✓ Deployed ${newDocId} (${newVersion}). Old ${currentDoc.id} deactivated.`);
  console.log(`  Active prompt length: ${newPrompt.length} chars`);
  process.exit(0);
}

main().catch((err) => { console.error('Cleanup failed:', err); process.exit(1); });
