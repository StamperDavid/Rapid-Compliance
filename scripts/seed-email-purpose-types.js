/**
 * Seed Email Purpose Types — 9 default types for the Email Specialist
 *
 * Usage: node scripts/seed-email-purpose-types.js [--force]
 *
 * Creates the initial taxonomy of email purposes that the Email Specialist
 * (Task #43) uses to classify and compose emails. These defaults cover the
 * most common outreach patterns. New types are created from the UI
 * (Task #43b) as new campaigns demand them, and the specialist picks them
 * up automatically via the email-purpose-types-service cache.
 *
 * Document id = slug. Running this script on an existing collection
 * without --force leaves existing documents untouched; with --force it
 * upserts the 9 defaults (preserves usageCount and lastUsedAt so UI
 * activity is not lost).
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/emailPurposeTypes`;

const DEFAULT_TYPES = [
  {
    slug: 'cold_intro',
    name: 'Cold Intro',
    description: 'First-touch outreach to a prospect who has never heard from the brand. The goal is to earn a reply or a click to a lightweight next step, not to close.',
  },
  {
    slug: 'warm_followup',
    name: 'Warm Follow-Up',
    description: 'A follow-up to someone who has already engaged once (opened, clicked, replied, booked). The goal is to continue a conversation that already started.',
  },
  {
    slug: 'nurture',
    name: 'Nurture',
    description: 'Value-first content sent over time to a subscriber who is not yet ready to buy. The goal is to build trust and stay top-of-mind, not drive immediate conversion.',
  },
  {
    slug: 'reengagement',
    name: 'Re-Engagement',
    description: 'A deliberate win-back attempt after a subscriber has gone quiet for weeks or months. The goal is to revive the relationship or cleanly unsubscribe disengaged contacts.',
  },
  {
    slug: 'onboarding',
    name: 'Onboarding',
    description: 'A welcome-to-the-product message sent right after signup, first purchase, or account creation. The goal is to drive first-value activation and set expectations.',
  },
  {
    slug: 'announcement',
    name: 'Announcement',
    description: 'A one-off broadcast about a new feature, launch, event, or company milestone. The goal is informational reach, not direct conversion.',
  },
  {
    slug: 'offer',
    name: 'Offer',
    description: 'A direct promotional message with a specific discount, deal, or limited-time incentive. The goal is immediate purchase or conversion.',
  },
  {
    slug: 'social_proof',
    name: 'Social Proof',
    description: 'A message that leads with a customer success story, case study, or recognizable logo to overcome skepticism. The goal is trust-building and objection handling.',
  },
  {
    slug: 'case_study',
    name: 'Case Study',
    description: 'A long-form story focused on one customer outcome with concrete numbers and narrative detail. The goal is deep conviction for high-stakes buying decisions.',
  },
];

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    console.error('Missing FIREBASE_ADMIN_* env vars. Check .env.local');
    process.exit(1);
  }
}

const db = admin.firestore();

async function main() {
  const force = process.argv.includes('--force');
  const nowIso = new Date().toISOString();

  let created = 0;
  let skipped = 0;
  let upserted = 0;

  for (const t of DEFAULT_TYPES) {
    const ref = db.collection(COLLECTION).doc(t.slug);
    const existing = await ref.get();

    if (existing.exists && !force) {
      console.log(`  = ${t.slug} (exists — skipped)`);
      skipped += 1;
      continue;
    }

    if (existing.exists && force) {
      const prior = existing.data() || {};
      await ref.set({
        name: t.name,
        slug: t.slug,
        description: t.description,
        active: prior.active !== false,
        usageCount: prior.usageCount ?? 0,
        lastUsedAt: prior.lastUsedAt ?? null,
        createdAt: prior.createdAt ?? nowIso,
        createdBy: prior.createdBy ?? 'system',
      });
      console.log(`  ~ ${t.slug} (upserted — usageCount + lastUsedAt preserved)`);
      upserted += 1;
      continue;
    }

    await ref.set({
      name: t.name,
      slug: t.slug,
      description: t.description,
      active: true,
      usageCount: 0,
      lastUsedAt: null,
      createdAt: nowIso,
      createdBy: 'system',
    });
    console.log(`  + ${t.slug} (${t.name})`);
    created += 1;
  }

  console.log(`\nDone. Created: ${created}, upserted: ${upserted}, skipped: ${skipped}.`);
  console.log(`Collection: ${COLLECTION}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
