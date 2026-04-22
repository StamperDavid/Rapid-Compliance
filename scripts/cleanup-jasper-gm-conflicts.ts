/**
 * One-time cleanup: Jasper GM v4 contains a "no read-only tools as plan steps"
 * rule at the top, but later sections of the same prompt contradict it with
 * positive examples and tool-catalog entries that encourage calling those
 * tools. Surgical edits to date only added the rule — they didn't scrub the
 * competing mentions. Result: Jasper got mixed signals and ignored the rule.
 *
 * This script creates v5 by surgically removing/neutralizing the competing
 * mentions of the forbidden info-only tools (get_seo_config, get_system_state,
 * get_platform_stats, query_docs, inspect_agent_logs).
 *
 * Idempotent: every replacement is verified — if the text isn't there
 * verbatim, the script aborts before writing.
 *
 * Usage: npx tsx scripts/cleanup-jasper-gm-conflicts.ts [--dry-run]
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

// All replacements designed to remove or neutralize positive mentions of
// info-only tools. Each must match verbatim or the script aborts.
const REPLACEMENTS: Replacement[] = [
  {
    description: 'Drop get_seo_config from campaign-orchestration "other relevant tools" list (line 335)',
    before: '   - Call any other relevant tools (get_seo_config, draft_outreach_email, etc.)',
    after: '   - Call any other relevant action tools (draft_outreach_email, etc.) — NEVER call info-only tools (get_seo_config, query_docs, etc.) as plan steps',
  },
  {
    description: 'Reframe "SEO config → use get_seo_config" as info-only (line 492)',
    before: '- SEO config → use get_seo_config (separate tool)',
    after: '- SEO context → call get_seo_config DURING PRE-PLANNING ONLY for context. NEVER include get_seo_config as a step in propose_mission_plan — it is an info-only read.',
  },
  {
    description: 'Remove get_seo_config from the "GOOD" example pairing (line 559)',
    before: 'GOOD: [call research_trending_topics + get_seo_config] → After results: "Found 15 trending topics. Top 3 are aligned with your current SEO keywords. Here\'s the breakdown: ..."',
    after: 'GOOD: [call research_trending_topics] → After results: "Found 15 trending topics. Top 3 align with the brand\'s SEO focus. Here\'s the breakdown: ..." (Note: get_seo_config can be called silently for context BEFORE this response, but never as part of a plan step.)',
  },
  {
    description: 'Mark get_system_state tool-catalog entry as INFO-ONLY (line 662-663)',
    before: '3. get_system_state - Comprehensive state check (MANDATORY for strategic queries)\n   → Use when: David asks "where do we start?" or wants recommendations',
    after: '3. get_system_state - Comprehensive state check (MANDATORY for strategic queries). INFO-ONLY: call during pre-planning, NEVER include as a step in propose_mission_plan.\n   → Use when: David asks "where do we start?" or wants recommendations',
  },
  {
    description: 'Mark get_seo_config tool-catalog entry as INFO-ONLY (line 665-666)',
    before: '4. get_seo_config - Read SEO keywords, description, and site config\n   → Use when: David asks about SEO, demographics, or content strategy',
    after: '4. get_seo_config - Read SEO keywords, description, and site config. INFO-ONLY: call during pre-planning, NEVER include as a step in propose_mission_plan.\n   → Use when: David asks about SEO, demographics, or content strategy',
  },
  {
    description: 'Mark inspect_agent_logs tool-catalog entry as INFO-ONLY (line 668-669)',
    before: '5. inspect_agent_logs - Check system health and recent activity\n   → Use when: David asks about errors, status, or "what happened?"',
    after: '5. inspect_agent_logs - Check system health and recent activity. INFO-ONLY: call during pre-planning, NEVER include as a step in propose_mission_plan.\n   → Use when: David asks about errors, status, or "what happened?"',
  },
];

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const db = admin.firestore();

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`  Jasper GM Conflict Cleanup ${dryRun ? '[DRY RUN]' : ''}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Load current active orchestrator GM
  const snap = await db.collection(COLLECTION)
    .where('agentType', '==', 'orchestrator')
    .where('isActive', '==', true)
    .limit(1)
    .get();
  if (snap.empty) {
    throw new Error('No active orchestrator GM found');
  }
  const currentDoc = snap.docs[0];
  const currentData = currentDoc.data();
  const currentPrompt: string = currentData.systemPrompt;
  const currentVersion: string = currentData.version ?? 'v?';
  console.log(`Loaded active GM: ${currentDoc.id} (${currentVersion}, ${currentPrompt.length} chars)\n`);

  // Apply replacements
  let newPrompt = currentPrompt;
  let appliedCount = 0;
  for (const r of REPLACEMENTS) {
    if (!newPrompt.includes(r.before)) {
      console.error(`✗ ABORT: replacement not applicable — "before" text not found verbatim:`);
      console.error(`  ${r.description}`);
      console.error(`  Looking for: ${JSON.stringify(r.before.slice(0, 120))}...`);
      process.exit(1);
    }
    newPrompt = newPrompt.replace(r.before, r.after);
    appliedCount++;
    console.log(`✓ ${r.description}`);
  }
  console.log(`\nApplied ${appliedCount}/${REPLACEMENTS.length} replacements`);
  console.log(`New prompt length: ${newPrompt.length} chars (was ${currentPrompt.length})`);
  console.log(`Net change: ${newPrompt.length - currentPrompt.length} chars\n`);

  if (dryRun) {
    console.log('[dry-run] No Firestore writes. Run without --dry-run to deploy.');
    process.exit(0);
  }

  // Compute next version number
  const currentVersionNumber = parseInt(currentVersion.replace(/^v/, ''), 10);
  if (Number.isNaN(currentVersionNumber)) {
    throw new Error(`Cannot parse current version "${currentVersion}" as number`);
  }
  const newVersionNumber = currentVersionNumber + 1;
  const newVersion = `v${newVersionNumber}`;
  const newDocId = `gm_orchestrator_v${newVersionNumber}`;
  const now = new Date().toISOString();

  // Build new doc by spreading current and overriding key fields
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
    createdBy: 'cleanup_jasper_gm_conflicts_script',
    notes: `One-time conflict cleanup: removed competing positive mentions of info-only tools (get_seo_config, get_system_state, inspect_agent_logs) that were drowning out the "no read-only tools as plan steps" rule. ${appliedCount} surgical replacements applied. Created from ${currentDoc.id}.`,
    previousVersion: currentVersionNumber,
  };

  // Atomic batch: deactivate old, create new
  const batch = db.batch();
  batch.update(currentDoc.ref, {
    isActive: false,
    deactivatedAt: now,
    deactivatedReason: `superseded by ${newDocId} (one-time conflict cleanup)`,
  });
  batch.set(db.collection(COLLECTION).doc(newDocId), newDoc);
  await batch.commit();

  console.log(`✓ Deployed ${newDocId} (${newVersion}) — old ${currentDoc.id} deactivated`);
  console.log(`  Active prompt length: ${newPrompt.length} chars`);
  console.log(`\nNext: refresh dev server (cache will pick up new GM on next request — 60s TTL).`);
  console.log(`Then re-run prompt 2 and check that get_seo_config and query_docs are NOT in the plan.`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
