/**
 * Seed the platform catalog document to Firestore.
 *
 * Writes to: organizations/rapid-compliance-root/platformCatalog/current
 *
 * Source of truth: src/lib/knowledge-base/universal-knowledge.ts
 * (edit data there, then re-run this script)
 *
 * Run: npx tsx scripts/seed-platform-catalog.ts
 *
 * Auth: Uses serviceAccountKey.json (rapid-compliance-65f87 dev project).
 * Falls back to application default credentials if the file is not present.
 *
 * Cleanup: After a successful write to platformCatalog/current, this script
 * inspects the legacy knowledgeBase/current doc. If it has the NEW shape
 * (features array present), it deletes it. If it has the legacy shape
 * (documents array present), it is left untouched — that is pre-existing
 * RAG/vector-search data we must not clobber.
 */

import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { PRICING, KNOWLEDGE_BASE_FEATURES, KNOWLEDGE_BASE_INDUSTRIES } from '../src/lib/knowledge-base/universal-knowledge';
import type { KnowledgeBase } from '../src/types/knowledge-base';

const PLATFORM_ID = 'rapid-compliance-root';

function initAdmin(): void {
  if (getApps().length > 0) return;
  const keyPath = resolve(process.cwd(), 'serviceAccountKey.json');
  if (existsSync(keyPath)) {
    const credentials = JSON.parse(readFileSync(keyPath, 'utf8')) as Record<string, unknown>;
    initializeApp({ credential: cert(credentials as Parameters<typeof cert>[0]) });
    console.log('[seed-platform-catalog] using serviceAccountKey.json (rapid-compliance-65f87)');
    return;
  }
  initializeApp({ credential: applicationDefault() });
  console.log('[seed-platform-catalog] using application default credentials');
}

async function main(): Promise<void> {
  initAdmin();
  const db = getFirestore();

  const ref = db
    .collection('organizations')
    .doc(PLATFORM_ID)
    .collection('platformCatalog')
    .doc('current');

  // ── Before ─────────────────────────────────────────────────────────────────
  const snap = await ref.get();
  const before = snap.exists
    ? (snap.data() as { lastUpdated?: string; features?: unknown[]; industries?: unknown[] })
    : null;

  if (before) {
    console.log('[seed-platform-catalog] BEFORE:');
    console.log(`  lastUpdated : ${before.lastUpdated ?? '(none)'}`);
    console.log(`  features    : ${Array.isArray(before.features) ? before.features.length : 0} items`);
    console.log(`  industries  : ${Array.isArray(before.industries) ? before.industries.length : 0} items`);
  } else {
    console.log('[seed-platform-catalog] BEFORE: document does not exist — creating fresh');
  }

  // ── Build payload ──────────────────────────────────────────────────────────
  const payload: KnowledgeBase = {
    pricing: {
      model: PRICING.model,
      monthlyPrice: PRICING.monthlyPrice,
      currency: PRICING.currency,
      billingCycle: PRICING.billingCycle,
      byok: {
        enabled: PRICING.byok.enabled,
        explanation: PRICING.byok.explanation,
      },
      trial: {
        days: PRICING.trial.days,
        fullAccess: PRICING.trial.fullAccess,
        creditCardRequired: PRICING.trial.creditCardRequired,
        cancelAnytime: PRICING.trial.cancelAnytime,
      },
      fairUseLimits: {
        crmRecords: PRICING.fairUseLimits.crmRecords,
        socialPostsPerMonth: PRICING.fairUseLimits.socialPostsPerMonth,
        emailsPerDay: PRICING.fairUseLimits.emailsPerDay,
        aiAgents: PRICING.fairUseLimits.aiAgents,
      },
    },
    features: KNOWLEDGE_BASE_FEATURES,
    industries: KNOWLEDGE_BASE_INDUSTRIES,
    lastUpdated: new Date().toISOString(),
  };

  // ── Write to new path ──────────────────────────────────────────────────────
  await ref.set(payload);

  // ── After ──────────────────────────────────────────────────────────────────
  const verify = await ref.get();
  const after = verify.data() as KnowledgeBase | undefined;

  console.log('[seed-platform-catalog] AFTER (organizations/rapid-compliance-root/platformCatalog/current):');
  console.log(`  lastUpdated  : ${after?.lastUpdated ?? '(missing)'}`);
  console.log(`  features     : ${after?.features?.length ?? 0} items`);
  console.log(`  industries   : ${after?.industries?.length ?? 0} items`);
  console.log(`  monthlyPrice : $${after?.pricing?.monthlyPrice ?? '?'}`);
  console.log(`  byok.enabled : ${String(after?.pricing?.byok?.enabled ?? false)}`);
  console.log(`  trial.days   : ${after?.pricing?.trial?.days ?? '?'}`);

  console.log('\n[seed-platform-catalog] Feature breakdown by category:');
  const byCategory: Record<string, number> = {};
  for (const f of KNOWLEDGE_BASE_FEATURES) {
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
  }
  for (const [cat, count] of Object.entries(byCategory).sort()) {
    console.log(`  ${cat.padEnd(12)}: ${count}`);
  }

  console.log('\n[seed-platform-catalog] Industries seeded:');
  for (const ind of KNOWLEDGE_BASE_INDUSTRIES.sort((a, b) => a.label.localeCompare(b.label))) {
    console.log(`  ${ind.label}`);
  }

  // ── Legacy knowledgeBase/current cleanup ──────────────────────────────────
  // If the legacy doc has the NEW shape (features array), it was seeded by
  // Stream C and can be deleted now that we've moved to platformCatalog.
  // If it has the OLD shape (documents array), it belongs to vector-search
  // and we must leave it alone.
  console.log('\n[seed-platform-catalog] Checking legacy knowledgeBase/current for cleanup...');
  const legacyRef = db
    .collection('organizations')
    .doc(PLATFORM_ID)
    .collection('knowledgeBase')
    .doc('current');

  const legacySnap = await legacyRef.get();
  if (!legacySnap.exists) {
    console.log('[seed-platform-catalog] Legacy knowledgeBase/current does not exist — nothing to clean up.');
  } else {
    const legacyData = legacySnap.data() as Record<string, unknown>;
    if (Array.isArray(legacyData['features'])) {
      // New shape written by Stream C — safe to delete
      await legacyRef.delete();
      console.log('[seed-platform-catalog] DELETED legacy knowledgeBase/current (had new-shape features array — Stream C artifact).');
    } else if (Array.isArray(legacyData['documents'])) {
      // Old shape — RAG/vector-search data, leave it alone
      console.log('[seed-platform-catalog] Legacy knowledgeBase/current has OLD shape (documents array) — left untouched.');
    } else {
      // Unknown shape — leave it and warn
      console.log('[seed-platform-catalog] WARNING: Legacy knowledgeBase/current has unknown shape — leaving untouched for manual review.');
      console.log('  Keys present:', Object.keys(legacyData).join(', '));
    }
  }

  console.log('\n[seed-platform-catalog] DONE');
}

main().catch((err: unknown) => {
  console.error('[seed-platform-catalog] FAILED:', err);
  process.exit(1);
});
