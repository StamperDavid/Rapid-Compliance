/**
 * Verifies BUDGET_STRATEGIST is production-ready end-to-end at the load
 * level — does not actually run an LLM call (read-only proof of wiring).
 *
 *   1. The Golden Master is in Firestore with Brand DNA baked in.
 *   2. The GM's systemPrompt is non-empty and over the 100-char floor.
 *   3. The MARKETING_MANAGER manager registers the BudgetStrategist factory
 *      (i.e. delegate_to_marketing → BUDGET_STRATEGIST is a wired path).
 *   4. The delegation rule for budget keywords resolves to BUDGET_STRATEGIST.
 *
 * Read-only — does NOT call OpenRouter, does NOT submit grades, does NOT
 * mutate state.
 *
 * Run: `npx tsx scripts/verify-budget-strategist-load.ts`
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';

const envPath = 'D:/Future Rapid Compliance/.env.local';
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (m) {
    const v = m[2].replace(/^["']|["']$/g, '');
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
const sa = JSON.parse(
  fs.readFileSync('D:/Future Rapid Compliance/serviceAccountKey.json', 'utf-8'),
);
admin.initializeApp({ credential: admin.credential.cert(sa) });

const SPECIALIST_ID = 'BUDGET_STRATEGIST';
const INDUSTRY = 'saas_sales_ops';

(async () => {
  console.log('\n=== BUDGET_STRATEGIST end-to-end load verification ===\n');

  let pass = 0;
  let fail = 0;
  const failures: string[] = [];

  // Check 1: GM in Firestore with Brand DNA baked in
  const { getActiveSpecialistGMByIndustry } = await import(
    '../src/lib/training/specialist-golden-master-service'
  );
  const gm = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, INDUSTRY);
  if (!gm) {
    fail++;
    failures.push('Active GM not found — run scripts/seed-budget-strategist-gm.js');
  } else {
    pass++;
    console.log(`✓ GM loaded: ${gm.id} (v${gm.version}, isActive=${gm.isActive})`);
    const promptLen = (gm.config.systemPrompt as string | undefined)?.length ?? 0;
    if (promptLen < 100) {
      fail++;
      failures.push(`GM systemPrompt is too short (${promptLen} chars)`);
    } else {
      pass++;
      console.log(`✓ systemPrompt length: ${promptLen} chars`);
    }
    if (!gm.brandDNASnapshot || Object.keys(gm.brandDNASnapshot).length === 0) {
      fail++;
      failures.push('GM has no brandDNASnapshot — Standing Rule #1 not satisfied');
    } else {
      pass++;
      const fields = Object.keys(gm.brandDNASnapshot).join(', ');
      console.log(`✓ Brand DNA baked in: ${fields}`);
    }
  }

  // Check 2: MARKETING_MANAGER registers BudgetStrategist
  const { MarketingManager } = await import('../src/lib/agents/marketing/manager');
  const mgr = new MarketingManager();
  await mgr.initialize();
  const specialistStatuses = mgr.getSpecialistStatuses();
  const budget = specialistStatuses.find((s) => s.id === SPECIALIST_ID);
  if (!budget) {
    fail++;
    failures.push(`MARKETING_MANAGER does not register BUDGET_STRATEGIST. Registered: ${specialistStatuses.map((s) => s.id).join(', ')}`);
  } else {
    pass++;
    console.log(`✓ MARKETING_MANAGER registers BUDGET_STRATEGIST (status=${budget.status})`);
  }

  // Check 3: budget keyword delegation rule resolves to BUDGET_STRATEGIST
  // (We test by reading the manager config; resolution itself is internal but
  //  the rule must exist and target BUDGET_STRATEGIST.)
  const mgrSrc = fs.readFileSync('D:/Future Rapid Compliance/src/lib/agents/marketing/manager.ts', 'utf-8');
  const ruleRegex = /delegateTo:\s*'BUDGET_STRATEGIST'/;
  if (!ruleRegex.test(mgrSrc)) {
    fail++;
    failures.push('No delegation rule with delegateTo=BUDGET_STRATEGIST in marketing/manager.ts');
  } else {
    pass++;
    console.log(`✓ Delegation rule wired (delegateTo: 'BUDGET_STRATEGIST' present)`);
  }

  // Check 4: agent-registry.ts has the entry
  const registrySrc = fs.readFileSync('D:/Future Rapid Compliance/src/lib/agents/agent-registry.ts', 'utf-8');
  if (!/id:\s*'BUDGET_STRATEGIST'/.test(registrySrc)) {
    fail++;
    failures.push('agent-registry.ts missing BUDGET_STRATEGIST entry');
  } else {
    pass++;
    console.log(`✓ agent-registry.ts has BUDGET_STRATEGIST entry`);
  }

  // Check 5: admin SpecialistRegistry.tsx has the entry
  const adminSrc = fs.readFileSync('D:/Future Rapid Compliance/src/components/admin/SpecialistRegistry.tsx', 'utf-8');
  if (!/id:\s*'BUDGET_STRATEGIST'/.test(adminSrc)) {
    fail++;
    failures.push('SpecialistRegistry.tsx missing BUDGET_STRATEGIST entry');
  } else {
    pass++;
    console.log(`✓ Admin SpecialistRegistry.tsx has BUDGET_STRATEGIST entry`);
  }

  console.log(`\n=== Summary: ${pass} passed, ${fail} failed ===\n`);
  if (failures.length > 0) {
    console.log('Failures:');
    for (const f of failures) {
      console.log(`  - ${f}`);
    }
  }
  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error('Verification crashed:', err);
  process.exit(2);
});
