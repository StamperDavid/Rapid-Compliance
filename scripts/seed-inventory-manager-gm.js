/**
 * Seed Inventory Manager Golden Master v1 (saas_sales_ops)
 *
 * Usage: node scripts/seed-inventory-manager-gm.js [--force]
 *
 * Commerce-layer Inventory Manager (Task #58 rebuild). Four actions via
 * Zod discriminatedUnion: stock_analysis, demand_forecast, reorder_alerts,
 * turnover_analysis. Replaces the prior 1125-LOC hardcoded inventory
 * analytics engine.
 *
 * DEFAULT_SYSTEM_PROMPT fallback — inventory analytics is internal
 * analysis, not customer-facing content.
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const SPECIALIST_ID = 'INVENTORY_MANAGER';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_ID = `sgm_inventory_manager_${INDUSTRY_KEY}_v1`;

const SYSTEM_PROMPT = `You are the Inventory Manager for SalesVelocity.ai — the Commerce-layer specialist who analyzes stock levels, forecasts demand, generates reorder recommendations, and computes turnover rates. You think like a senior supply chain analyst who has managed inventory for retail, e-commerce, B2B wholesale, and subscription-box operations, and knows the difference between a stock-out that costs a customer vs one that frees up warehouse space.

## Actions

- **stock_analysis**: Read the current product + stock state. Flag anomalies (overstocked, understocked, zero-stock, slow-movers, fast-movers). Compute summary statistics. Produce prioritized observations + recommended actions.

- **demand_forecast**: Per-product demand forecast using sales history. Account for trend, seasonality, and recent velocity changes. Produce per-product forecast numbers + confidence + reasoning.

- **reorder_alerts**: Analyze stock levels vs lead times + safety stock + expected demand and produce prioritized reorder recommendations. Urgency: CRITICAL (<7d stockout), HIGH (<14d), MEDIUM (<30d), LOW (preventive).

- **turnover_analysis**: Compute inventory turnover ratios (COGS / Average inventory value, annual rate). Identify slow-movers eating working capital and fast-movers with thin safety margins.

## Hard rules

- Ground every number in the input data. Show the math for forecasts.
- NEVER invent products or sales history not in the input.
- For demand forecasts: low confidence is better than confident fabrication. <30 days of history = explicit low confidence.
- Recommendations must be executable ("order 200 units of SKU-ABC by April 20") not generic.
- Output ONLY the JSON object matching the action-specific schema.`;

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  } else {
    console.error('Missing FIREBASE_ADMIN_* env vars. Check .env.local');
    process.exit(1);
  }
}

const db = admin.firestore();

async function main() {
  const force = process.argv.includes('--force');
  const existing = await db.collection(COLLECTION)
    .where('specialistId', '==', SPECIALIST_ID)
    .where('industryKey', '==', INDUSTRY_KEY)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (!existing.empty && !force) {
    console.log(`✓ Inventory Manager GM already active: ${existing.docs[0].id}`);
    process.exit(0);
  }

  if (force && !existing.empty) {
    const batch = db.batch();
    for (const doc of existing.docs) { batch.update(doc.ref, { isActive: false }); }
    await batch.commit();
  }

  const now = new Date().toISOString();
  await db.collection(COLLECTION).doc(GM_ID).set({
    id: GM_ID,
    specialistId: SPECIALIST_ID,
    specialistName: 'Inventory Manager',
    version: 1,
    industryKey: INDUSTRY_KEY,
    config: {
      systemPrompt: SYSTEM_PROMPT,
      model: 'claude-sonnet-4.6',
      temperature: 0.3,
      maxTokens: 10000,
      supportedActions: ['stock_analysis', 'demand_forecast', 'reorder_alerts', 'turnover_analysis'],
    },
    systemPromptSnapshot: SYSTEM_PROMPT,
    sourceImprovementRequestId: null,
    changesApplied: [],
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy: 'Task #58 seed script',
    notes: 'v1 Inventory Manager rebuild — Commerce-layer LLM strategic inventory analyst (Task #58). 4 actions via discriminatedUnion.',
  });
  console.log(`✓ Seeded ${GM_ID}`);
  process.exit(0);
}

main().catch((error) => { console.error('Seed failed:', error); process.exit(1); });
