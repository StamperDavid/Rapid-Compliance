/**
 * Real-path proof that the Merchandiser is now an EXECUTOR: it creates a real
 * DRAFT discount quote on a CRM deal, logs the event as an activity, fails
 * closed without operator approval, and rejects an out-of-range discount —
 * AND proves the CODE (not the LLM) computes the money.
 *
 * Drives the MerchandiserSpecialist DIRECTLY (the manager `RevenueDirector`
 * can't be imported under tsx — its module graph pulls a `server-only`-marked
 * coordinator). The hands + the approval gate both live in the specialist, so
 * this proves the safety-critical behavior end-to-end. The thin manager/Jasper
 * hop (which only threads `viaApprovedMissionStep === true` down to this
 * payload, set true ONLY by the mission step-runner for an operator-approved
 * step) is verified by code review.
 *
 * Verifies quotes by POINT-READ (getQuote by the returned id), never a
 * dealId list query — the quotes-by-dealId composite index is not deployed
 * (a separate follow-up); a point read needs no index.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/verify-merchandiser-executor.ts
 *
 * NOTE: hits OpenRouter (the Merchandiser authors the quote copy via its Golden
 * Master) + real Firestore. Seed the GM first: node scripts/seed-merchandiser-gm.js
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import type { AgentMessage, AgentReport } from '@/lib/agents/types';

interface ExecutedShape {
  rationale?: string;
  mutated?: boolean;
  approvalRequired?: boolean;
  executed?: {
    dealId: string;
    quoteId: string;
    total: number;
    activityId: string | null;
    quoteCreated: boolean;
  };
}

let failures = 0;
function assert(label: string, cond: boolean): void {
  if (cond) {
    console.log(`  PASS ✅ ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ❌ ${label}`);
  }
}

async function runCreateQuote(
  specialist: { execute: (m: AgentMessage) => Promise<AgentReport> },
  fields: Record<string, unknown>,
): Promise<AgentReport> {
  const message: AgentMessage = {
    id: `verify_quote_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(),
    from: 'REVENUE_DIRECTOR',
    to: 'MERCHANDISER',
    type: 'COMMAND',
    priority: 'HIGH',
    payload: { action: 'create_discount_quote', ...fields },
    requiresResponse: true,
    traceId: `trace_${Date.now()}`,
  };
  return specialist.execute(message);
}

const DEAL_VALUE = 10000;

async function main(): Promise<void> {
  const { createDeal, deleteDeal } = await import('@/lib/crm/deal-service');
  const { getQuote, deleteQuote } = await import('@/lib/crm/quote-service');
  const { getActivities, deleteActivity } = await import('@/lib/crm/activity-service');
  const { MerchandiserSpecialist } = await import('@/lib/agents/sales/merchandiser/specialist');

  const specialist = new MerchandiserSpecialist();
  await specialist.initialize();

  console.log('1) Creating a deal at stage "proposal" (value 10000)…');
  const deal = await createDeal({
    name: `VERIFY create_discount_quote ${Date.now()}`,
    company: 'Verify Quote Co',
    companyName: 'Verify Quote Co',
    value: DEAL_VALUE,
    stage: 'proposal',
    probability: 40,
  });
  console.log('   deal id:', deal.id, '| value:', deal.value);

  const createdQuoteIds: string[] = [];

  try {
    // ── Run 0: APPROVAL GATE — an UNAPPROVED run must NOT write a quote ───────
    console.log('\n2a) UNAPPROVED run (no operator approval → must NOT create a quote)…');
    const unapprovedReport = await runCreateQuote(specialist, {
      dealId: deal.id,
      discountPercent: 20,
      // viaApprovedMissionStep deliberately omitted → fail closed
    });
    const unapprovedData = unapprovedReport.data as ExecutedShape;
    assert('unapproved run did NOT mutate (mutated !== true)', unapprovedData?.mutated !== true);
    assert('unapproved run flagged approvalRequired', unapprovedData?.approvalRequired === true);
    assert('unapproved run returned NO quote id (nothing created)', unapprovedData?.executed?.quoteId === undefined);

    // ── Run 1: create_discount_quote (APPROVED, discountPercent 20) ──────────
    console.log('\n2) APPROVED run (discountPercent 20 → draft quote, code computes total)…');
    const createReport = await runCreateQuote(specialist, {
      dealId: deal.id,
      discountPercent: 20,
      viaApprovedMissionStep: true,
    });
    const createData = createReport.data as ExecutedShape;

    assert('create report status COMPLETED', createReport.status === 'COMPLETED');
    assert('create report authored by MERCHANDISER', createReport.agentId === 'MERCHANDISER');
    assert('create data.executed.quoteCreated === true', createData?.executed?.quoteCreated === true);

    const quoteId = createData?.executed?.quoteId;
    if (quoteId) { createdQuoteIds.push(quoteId); }
    const quote = quoteId ? await getQuote(quoteId) : null;
    assert('a quote for the deal exists (point-read by id)', Boolean(quote));
    assert('quote status is "draft"', quote?.status === 'draft');
    assert('quote dealId matches', quote?.dealId === deal.id);

    const lineItem = quote?.lineItems[0];
    assert('quote has one line item', quote?.lineItems.length === 1);
    assert('line item discount === 20', lineItem?.discount === 20);

    // The KEY proof: CODE did the math. 10000 * (1 - 20/100) = 8000.
    const expectedTotal = DEAL_VALUE * (1 - 20 / 100);
    assert(`quote.total === ${expectedTotal} (code computed it from the deal value + discount)`, quote?.total === expectedTotal);
    assert('report.executed.total matches the quote total', createData?.executed?.total === expectedTotal);

    const activities = await getActivities({ entityType: 'deal', entityId: deal.id }, { pageSize: 20 });
    const noteActivity = activities.data.find(
      (a) => a.createdBy === 'MERCHANDISER' && a.type === 'note_added',
    );
    assert('a note_added activity authored by MERCHANDISER references the deal', Boolean(noteActivity));

    // ── Run 2: schema rejection — discountPercent 60 (> max 50) → FAILED ─────
    console.log('\n3) OUT-OF-RANGE run (discountPercent 60 → schema FAILED, no write)…');
    const badReport = await runCreateQuote(specialist, {
      dealId: deal.id,
      discountPercent: 60,
      viaApprovedMissionStep: true,
    });
    assert('out-of-range report status FAILED', badReport.status === 'FAILED');
    assert('out-of-range run created NO quote', (badReport.data as ExecutedShape)?.executed?.quoteId === undefined);
  } finally {
    // ── Cleanup: delete activities first (deal delete refuses if linked), then
    //    the quote(s) we created (by tracked id — no list query), then the deal ──
    console.log('\n4) Cleaning up…');
    const leftoverActivities = await getActivities({ entityType: 'deal', entityId: deal.id }, { pageSize: 50 });
    for (const a of leftoverActivities.data) {
      await deleteActivity(a.id);
    }
    for (const qId of createdQuoteIds) {
      try {
        await deleteQuote(qId);
      } catch (e) {
        console.warn('   quote cleanup warning:', e instanceof Error ? e.message : String(e));
      }
    }
    try {
      await deleteDeal(deal.id);
      console.log('   deal + quote + activities deleted');
    } catch (e) {
      console.warn('   cleanup warning:', e instanceof Error ? e.message : String(e));
    }
  }

  if (failures === 0) {
    console.log('\nPASS ✅ — Merchandiser executor: fails closed without approval, creates a draft discount quote, CODE computes the total (8000), logs the event, rejects an out-of-range discount.');
    process.exit(0);
  } else {
    console.error(`\nFAIL ❌ — ${failures} assertion(s) failed.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error('FAIL ❌', e); process.exit(1); });
