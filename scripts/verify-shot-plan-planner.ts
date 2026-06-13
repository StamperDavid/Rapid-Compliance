/**
 * VERIFY — Shot Plan Planner end-to-end
 *
 * Proves the Shot Plan Planner agent works against real Firestore + the real LLM:
 *
 *   1. Confirm the planner's Golden Master is active and has Brand DNA BAKED IN
 *      (Standing Rule #1) — assert the GM systemPrompt carries the "## Brand DNA"
 *      marker + the org's actual tenant values.
 *   2. Run generateShotPlan on a sample brief.
 *   3. Print the resulting ShotPlan.
 *   4. Assert ShotPlanSchema.safeParse(plan) succeeds.
 *   5. Print "SHOT PLAN PLANNER OK".
 *
 * Usage: npx tsx scripts/verify-shot-plan-planner.ts
 *
 * Exit code: 0 on success, 1 on any failure.
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

import { getActiveSpecialistGMByIndustry } from '../src/lib/training/specialist-golden-master-service';
import { generateShotPlan } from '../src/lib/agents/content/shot-plan/planner';
import { ShotPlanSchema } from '../src/types/shot-plan';

interface BrandDNADoc {
  companyDescription: string;
  industry: string;
  toneOfVoice: string;
  targetAudience: string;
  avoidPhrases?: string[];
}

const PLATFORM_ID = 'rapid-compliance-root';
const SPECIALIST_ID = 'SHOT_PLAN_PLANNER';
const INDUSTRY_KEY = 'saas_sales_ops';
const SAMPLE_USER_ID = 'verify-shot-plan-planner';
const SAMPLE_BRIEF =
  'a 3-shot cinematic ad where Velocity rides across a bridge into the city to save a small business owner';

async function main(): Promise<void> {
  let failures = 0;
  const fail = (msg: string): void => {
    console.error(`  ✗ ${msg}`);
    failures++;
  };
  const pass = (msg: string): void => console.log(`  ✓ ${msg}`);

  // --- Step 1: GM active + Brand DNA baked in (Standing Rule #1) ---
  console.log('\n[1] Golden Master + Brand DNA bake-in');
  const db = admin.firestore();
  const orgDoc = await db.collection('organizations').doc(PLATFORM_ID).get();
  const brandDNA = orgDoc.data()?.brandDNA as BrandDNADoc | undefined;
  if (!brandDNA) {
    throw new Error('Brand DNA not configured on org doc — cannot verify bake-in.');
  }

  const gm = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, INDUSTRY_KEY);
  if (!gm) {
    throw new Error(
      `No active GM for ${SPECIALIST_ID}:${INDUSTRY_KEY}. Run node scripts/seed-shot-plan-planner-gm.js first.`,
    );
  }
  const sysPrompt = (gm.config?.systemPrompt as string | undefined) ?? gm.systemPromptSnapshot ?? '';
  pass(`GM active: ${gm.id} (systemPrompt ${sysPrompt.length} chars)`);

  if (!sysPrompt.includes('## Brand DNA')) { fail('GM systemPrompt missing "## Brand DNA" marker'); }
  else { pass('"## Brand DNA" marker present'); }
  if (!sysPrompt.includes(brandDNA.industry)) { fail(`industry "${brandDNA.industry}" not baked in`); }
  else { pass(`industry "${brandDNA.industry}" baked in`); }
  if (!sysPrompt.includes(brandDNA.toneOfVoice)) { fail(`toneOfVoice "${brandDNA.toneOfVoice}" not baked in`); }
  else { pass(`toneOfVoice baked in`); }
  if (!sysPrompt.includes(brandDNA.companyDescription.slice(0, 40))) { fail('companyDescription not baked in'); }
  else { pass('companyDescription baked in'); }

  if (failures > 0) {
    throw new Error('Standing Rule #1 bake-in check failed — aborting before LLM call.');
  }

  // --- Step 2-3: generate + print ---
  console.log('\n[2] Generating a ShotPlan from the sample brief...');
  console.log(`  brief: "${SAMPLE_BRIEF}"`);
  const plan = await generateShotPlan({ brief: SAMPLE_BRIEF, userId: SAMPLE_USER_ID, shotCount: 3 });

  console.log('\n[3] Resulting ShotPlan:');
  console.log(JSON.stringify(plan, null, 2));

  // --- Step 4: schema validation ---
  console.log('\n[4] Validating against ShotPlanSchema...');
  const parsed = ShotPlanSchema.safeParse(plan);
  if (!parsed.success) {
    parsed.error.issues.forEach((i) => fail(`schema: ${i.path.join('.')}: ${i.message}`));
    throw new Error('ShotPlanSchema.safeParse FAILED.');
  }
  pass(`ShotPlanSchema.safeParse succeeded (${plan.shots.length} shots, cutCount=${plan.sharedChoices.cutCount})`);

  // Sanity: cutCount matches, first shot is a cut, transitions are valid.
  if (plan.sharedChoices.cutCount !== plan.shots.length) {
    fail(`cutCount (${plan.sharedChoices.cutCount}) != shots.length (${plan.shots.length})`);
  } else {
    pass('cutCount equals shot count');
  }
  if (plan.shots[0]?.transitionIn !== 'cut') {
    fail(`first shot transitionIn should be "cut", got "${plan.shots[0]?.transitionIn}"`);
  } else {
    pass('first shot transitionIn === "cut"');
  }

  if (failures > 0) {
    throw new Error(`${failures} assertion(s) failed.`);
  }

  console.log('\nSHOT PLAN PLANNER OK\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('\nVerification failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
