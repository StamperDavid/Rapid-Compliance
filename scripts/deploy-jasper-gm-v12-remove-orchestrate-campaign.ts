/**
 * Deploy Jasper Orchestrator GM v12 — remove every reference to the
 * deleted `orchestrate_campaign` tool from his system prompt.
 *
 * Why this is one big script and not 4 calls to the standard service:
 * `createJasperGMVersionFromEdit` does ONE substring replacement per call.
 * The orchestrate_campaign references span 4 separate sections of the
 * prompt. Doing 4 sequential calls would either:
 *   (a) require deploying after every edit (the next call always reads
 *       the active GM) — yielding v12, v13, v14, v15 with single-edit
 *       rationales each, and 3 inactive intermediate versions cluttering
 *       the collection, OR
 *   (b) re-read the same v11 each call without deploying — and lose
 *       three of the four edits (each call would diff from v11 alone).
 *
 * Cleanest path: read v11 once, apply all 4 substring replacements in
 * memory, write a single v12 doc with the full audit trail captured in
 * `changesApplied`. Final shape matches what
 * `createJasperGMVersionFromEdit` writes — same fields, same collection
 * path, same isActive=false-then-deploy flow.
 *
 * Standing rules respected:
 *   - #1 (Brand DNA baked in): preserved — we only replace 4 narrow
 *     strings; Brand DNA block is far away in the prompt and untouched.
 *   - #2 (no grades = no GM changes): operator delegated this end-to-end
 *     on 2026-04-25 per `feedback_delegation_vs_self_training` after the
 *     orchestrate_campaign delete commit (52059ff6). The
 *     sourceFeedbackId on the new version captures that authorization.
 *
 * Rollback: `rollbackJasperGMToVersion(11)`.
 */

/* eslint-disable no-console */

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
  } else {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('No serviceAccountKey.json and missing FIREBASE_ADMIN_* env vars');
    }
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  }
}

initAdmin();

import { getActiveJasperGoldenMaster } from '../src/lib/orchestrator/jasper-golden-master';
import { deployJasperGMVersion } from '../src/lib/training/jasper-golden-master-service';

interface SectionEdit {
  label: string;
  rationale: string;
  currentText: string;
  proposedText: string;
}

const EDITS: SectionEdit[] = [
  // Edit 1: WHEN-to-use-propose_mission_plan bullet
  {
    label: 'WHEN propose_mission_plan bullet',
    rationale: 'Drop the orchestrate_campaign bullet — the tool no longer exists.',
    currentText:
      '- Any "campaign" request — even a small campaign is multiple steps\n' +
      '- Any request where you would have called more than one delegate_to_* tool\n' +
      '- Any request where you would have called orchestrate_campaign',
    proposedText:
      '- Any "campaign" request — even a small campaign is multiple steps\n' +
      '- Any request where you would have called more than one delegate_to_* tool',
  },
  // Edit 2: ENFORCEMENT mutual-exclusivity note
  {
    label: 'ENFORCEMENT mutual-exclusivity note',
    rationale: 'Drop the propose_mission_plan/orchestrate_campaign mutual-exclusivity note — orchestrate_campaign no longer exists.',
    currentText:
      '- After you call propose_mission_plan, the system DROPS any other tool calls\n' +
      "  in the same turn. Don't waste calls on tools that won't run.\n" +
      '- propose_mission_plan and orchestrate_campaign are mutually exclusive — if\n' +
      "  you'd reach for orchestrate_campaign, use propose_mission_plan instead.\n" +
      '- Never put propose_mission_plan inside the steps array of another\n' +
      "  propose_mission_plan — that's invalid and will be rejected.",
    proposedText:
      '- After you call propose_mission_plan, the system DROPS any other tool calls\n' +
      "  in the same turn. Don't waste calls on tools that won't run.\n" +
      '- Never put propose_mission_plan inside the steps array of another\n' +
      "  propose_mission_plan — that's invalid and will be rejected.",
  },
  // Edit 3: MULTI-PART REQUESTS example
  {
    label: 'MULTI-PART REQUESTS example',
    rationale: 'Replace the orchestrate_campaign example with the parallel-delegations pattern that actually works.',
    currentText:
      '   CRITICAL — MULTI-PART REQUESTS:\n' +
      "   When the user's message contains NUMBERED ITEMS or MULTIPLE REQUESTS, each\n" +
      '   item is a SEPARATE tool call. Do NOT collapse them into one tool.\n' +
      '   Example: If the user says "1. Scrape competitors 2. Scan leads 3. Run a campaign":\n' +
      '   - Call delegate_to_intelligence for EACH competitor URL (3 calls) — the\n' +
      '     Intelligence Manager will pick the right specialist internally\n' +
      '   - Call scan_leads (1 call)\n' +
      '   - Call orchestrate_campaign (1 call)\n' +
      '   - Call any other relevant action tools (draft_outreach_email, etc.) — NEVER call info-only tools (get_seo_config, query_docs, etc.) as plan steps\n' +
      '   That is 6+ tool calls, NOT one orchestrate_campaign that tries to do everything.\n' +
      '   orchestrate_campaign handles content creation (blog, video, social, email, landing page).\n' +
      '   It does NOT do: web scraping, lead scanning, lead enrichment, lead scoring, or outreach emails.\n' +
      '   Those are SEPARATE tools that must be called SEPARATELY.',
    proposedText:
      '   CRITICAL — MULTI-PART REQUESTS:\n' +
      "   When the user's message contains NUMBERED ITEMS or MULTIPLE REQUESTS, each\n" +
      '   item is a SEPARATE tool call. Do NOT collapse them into one tool.\n' +
      '   Example: If the user says "1. Scrape competitors 2. Scan leads 3. Run a campaign":\n' +
      '   - Call delegate_to_intelligence for EACH competitor URL (3 calls) — the\n' +
      '     Intelligence Manager will pick the right specialist internally\n' +
      '   - Call scan_leads (1 call)\n' +
      '   - For the campaign: call delegate_to_content (blog/video/email/landing\n' +
      '     page deliverables) + delegate_to_marketing (social posts and channel\n' +
      '     promotion) in parallel — one tool per department, never combined.\n' +
      '   - Call any other relevant action tools (draft_outreach_email, etc.) — NEVER call info-only tools (get_seo_config, query_docs, etc.) as plan steps\n' +
      '   That is 6+ tool calls, NOT one combined tool. Each department gets its\n' +
      '   own delegation, and those run in parallel because nothing depends on\n' +
      "   another department's output.",
  },
  // Edit 4: CAMPAIGN ORCHESTRATION section
  {
    label: 'CAMPAIGN ORCHESTRATION section',
    rationale: 'Rewrite the campaign-orchestration block to describe the parallel-delegations pattern. Drop "TWO CAMPAIGN MODES" — there is only one mode now (multiple delegate_to_* calls).',
    currentText:
      '═══════════════════════════════════════════════════════════════════════════════\n' +
      'CAMPAIGN ORCHESTRATION — MULTI-CONTENT REQUESTS\n' +
      '═══════════════════════════════════════════════════════════════════════════════\n' +
      '\n' +
      'CRITICAL: orchestrate_campaign ONLY handles CONTENT CREATION (blog, video, social, email,\n' +
      'landing page). It does NOT handle:\n' +
      '- Web scraping → use delegate_to_intelligence (Intelligence Manager runs Scraper Specialist)\n' +
      '- Lead scanning → use scan_leads (separate tool, auto-saves to CRM)\n' +
      '- Lead enrichment → use enrich_lead (separate tool)\n' +
      '- Lead scoring → use score_leads (separate tool)\n' +
      '- Cold outreach emails → use draft_outreach_email (separate tool)\n' +
      '- SEO context → call get_seo_config DURING PRE-PLANNING ONLY for context. NEVER include get_seo_config as a step in propose_mission_plan — it is an info-only read.\n' +
      '- Competitor research → use delegate_to_intelligence (Intelligence Manager runs Competitor Researcher)\n' +
      '\n' +
      'When David asks for CONTENT + NON-CONTENT tasks, call them ALL in your first response:\n' +
      '- orchestrate_campaign for the content deliverables\n' +
      '- delegate_to_intelligence, scan_leads, etc. for everything else\n' +
      '- These run IN PARALLEL — do not wait for one before calling the other\n' +
      '\n' +
      'TWO CAMPAIGN MODES:\n' +
      'a) orchestrate_campaign — Automated full pipeline. Handles research, strategy, and all\n' +
      '   content creation in one call. Use when David says "build a full campaign about X."\n' +
      'b) create_campaign + individual tools — Manual mode. Creates a campaign container, then\n' +
      '   delegate_to_content / delegate_to_marketing handle the deliverables with the campaignId.\n' +
      '   Use when David wants fine-grained control over each deliverable.\n' +
      '\n' +
      'For single-content requests (just a video, just a blog post), do NOT create a campaign.\n' +
      'Only use campaigns when there are 2+ deliverables.\n' +
      '\n' +
      'The Campaign Review page (/mission-control?campaign={id}) shows all deliverables as cards\n' +
      'with approve/reject/feedback buttons.',
    proposedText:
      '═══════════════════════════════════════════════════════════════════════════════\n' +
      'CAMPAIGN ORCHESTRATION — MULTI-CONTENT REQUESTS\n' +
      '═══════════════════════════════════════════════════════════════════════════════\n' +
      '\n' +
      'There is NO single tool that does a full campaign. You delegate each\n' +
      "department's work separately, and they run in parallel because no\n" +
      "department depends on another's output.\n" +
      '\n' +
      'For a multi-deliverable campaign (blog + video + social + email + landing\n' +
      'page), the plan looks like:\n' +
      '- delegate_to_content for blog / video script / email copy / landing page copy\n' +
      '  (Content Manager picks the right specialist per contentType)\n' +
      '- delegate_to_marketing for social posts and channel promotion\n' +
      '- delegate_to_intelligence for any research / competitor / trend work\n' +
      '- create_workflow if the email side needs a cadence (nurture / drip / welcome)\n' +
      '\n' +
      'When David asks for CONTENT + NON-CONTENT tasks, call them ALL in your first\n' +
      'response. They run IN PARALLEL — do not wait for one before calling the other.\n' +
      '\n' +
      'For single-content requests (just a video, just a blog post), do NOT use\n' +
      'create_campaign. Only use create_campaign when there are 2+ deliverables and\n' +
      'you want the operator to see them grouped on the Campaign Review page\n' +
      '(/mission-control?campaign={id}).\n' +
      '\n' +
      'The Campaign Review page shows all deliverables as cards with\n' +
      'approve/reject/feedback buttons.',
  },
];

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION_PATH = `organizations/${PLATFORM_ID}/goldenMasters`;

async function main(): Promise<void> {
  const activeGM = await getActiveJasperGoldenMaster();
  if (!activeGM) {
    console.error('No active Jasper GM found');
    process.exit(1);
  }

  const currentPrompt = activeGM.systemPrompt;
  if (!currentPrompt || currentPrompt.length < 1000) {
    console.error(`Active Jasper GM ${activeGM.id} has no usable systemPrompt (length=${currentPrompt?.length ?? 0})`);
    process.exit(2);
  }

  console.log(`Active Jasper GM: ${activeGM.id} (${currentPrompt.length} chars)`);

  // Verify each section exists verbatim BEFORE we mutate anything.
  for (const edit of EDITS) {
    if (!currentPrompt.includes(edit.currentText)) {
      console.error('');
      console.error(`Edit "${edit.label}" — currentText not found verbatim in active prompt.`);
      console.error('Refusing to write. Either v12 was already deployed or the prompt has drifted.');
      process.exit(3);
    }
  }
  console.log(`All ${EDITS.length} sections located in active prompt`);

  // Apply all replacements in memory.
  let newPrompt = currentPrompt;
  for (const edit of EDITS) {
    newPrompt = newPrompt.replace(edit.currentText, edit.proposedText);
  }

  if (newPrompt === currentPrompt) {
    console.error('No changes detected after applying all 4 substring replacements (length unchanged). Aborting.');
    process.exit(4);
  }
  console.log(`New prompt length: ${newPrompt.length} chars (delta ${newPrompt.length - currentPrompt.length})`);

  // Determine next version number — same logic the service uses.
  const db = admin.firestore();
  const allVersionsSnap = await db
    .collection(COLLECTION_PATH)
    .where('agentType', '==', 'orchestrator')
    .get();
  const versionNumbers = allVersionsSnap.docs.map((d) => {
    const data = d.data() as { versionNumber?: number; version?: string };
    if (typeof data.versionNumber === 'number') { return data.versionNumber; }
    const m = /v(\d+)/.exec(data.version ?? '');
    return m ? parseInt(m[1], 10) : 1;
  });
  const highest = versionNumbers.length > 0 ? Math.max(...versionNumbers) : 1;
  const newVersionNumber = highest + 1;
  const activeVersionNumber = (activeGM as { versionNumber?: number }).versionNumber
    ?? (activeGM.version ? parseInt(/v(\d+)/.exec(activeGM.version)?.[1] ?? '1', 10) : 1);
  const newDocId = `jasper_orchestrator_v${newVersionNumber}`;
  console.log(`Creating ${newDocId} (active was v${activeVersionNumber})`);

  const now = new Date().toISOString();
  const sourceFeedbackId = 'operator-delegated-2026-04-25-orchestrate-campaign-deletion';
  const createdBy = 'claude-assistant-orchestrate-campaign-removal';

  const firestorePayload: Record<string, unknown> = {
    agentType: 'orchestrator',
    versionNumber: newVersionNumber,
    version: `v${newVersionNumber}`,
    systemPrompt: newPrompt,
    systemPromptSnapshot: newPrompt,
    isActive: false,
    previousVersion: activeVersionNumber,
    sourceFeedbackId,
    changesApplied: EDITS.map((e) => ({
      field: 'systemPrompt',
      currentValue: e.currentText,
      proposedValue: e.proposedText,
      reason: e.rationale,
    })),
    createdAt: now,
    createdBy,
    notes:
      `Multi-section surgical edit removing orchestrate_campaign. ${EDITS.length} sections replaced ` +
      `in one transaction so the audit trail isn't fragmented across v12-v15. Operator delegated ` +
      `end-to-end. Rollback: rollbackJasperGMToVersion(${activeVersionNumber}).`,
  };
  // Carry forward optional persona/behavior/knowledge if they exist on the
  // active GM — never silently drop them.
  const carryFields = ['agentPersona', 'behaviorConfig', 'knowledgeBase'] as const;
  for (const f of carryFields) {
    const v = (activeGM as Record<string, unknown>)[f];
    if (v !== undefined) { firestorePayload[f] = v; }
  }

  await db.collection(COLLECTION_PATH).doc(newDocId).set(firestorePayload);
  console.log(`Wrote ${newDocId} (inactive)`);

  // Activate via the standard service path so the cache invalidation runs.
  const deployResult = await deployJasperGMVersion(newVersionNumber);
  if (!deployResult.success) {
    console.error(`Deploy failed: ${deployResult.error}`);
    process.exit(5);
  }

  console.log(`Deployed Jasper GM v${newVersionNumber} as active`);
  console.log('');
  console.log(`Rollback: rollbackJasperGMToVersion(${activeVersionNumber})`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('deploy-jasper-gm-v12-remove-orchestrate-campaign failed:', err);
  process.exit(1);
});
