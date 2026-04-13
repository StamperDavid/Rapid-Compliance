/**
 * Seed SMS Purpose Types — 8 default types for the SMS Specialist
 *
 * Usage: node scripts/seed-sms-purpose-types.js [--force]
 *
 * Creates the initial taxonomy of SMS purposes that the SMS Specialist
 * (Task #44) uses to classify and compose SMS messages. Intentionally
 * different from email types — SMS has transactional patterns (shipping,
 * appointment reminders) that don't map to email, and skips long-form
 * patterns (case_study, nurture) that don't fit SMS length limits.
 *
 * Document id = slug. Running without --force leaves existing documents
 * untouched; with --force it upserts the 8 defaults while preserving
 * usageCount and lastUsedAt from any existing docs.
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/smsPurposeTypes`;

const DEFAULT_TYPES = [
  {
    slug: 'flash_offer',
    name: 'Flash Offer',
    description: 'Time-sensitive promotional message with a specific discount, deal, or limited-window incentive. The goal is immediate purchase or redemption within hours.',
  },
  {
    slug: 'appointment_reminder',
    name: 'Appointment Reminder',
    description: 'Confirmation message for an upcoming booking, meeting, or scheduled service. The goal is to reduce no-shows and give the recipient a quick confirm/reschedule option.',
  },
  {
    slug: 'shipping_update',
    name: 'Shipping Update',
    description: 'Transactional message updating the recipient on order status, dispatch, delivery, or delay. The goal is information delivery and tracking link handoff.',
  },
  {
    slug: 'winback',
    name: 'Win-Back',
    description: 'A deliberate reactivation attempt aimed at a customer who has gone quiet — usually paired with a specific incentive and a clean opt-out. The goal is revival or clean removal.',
  },
  {
    slug: 'event_alert',
    name: 'Event Alert',
    description: 'Notification that a webinar, live stream, sale window, or in-person event is starting soon. The goal is real-time attendance or action.',
  },
  {
    slug: 'payment_reminder',
    name: 'Payment Reminder',
    description: 'Polite reminder that an invoice or subscription payment is due or past due. The goal is to drive payment without damaging the customer relationship.',
  },
  {
    slug: 'warm_followup',
    name: 'Warm Follow-Up',
    description: 'A follow-up to someone who recently engaged — opened, purchased, replied, or booked. The goal is to continue a conversation already in motion.',
  },
  {
    slug: 'cold_outreach',
    name: 'Cold Outreach',
    description: 'First-touch SMS to a prospect who has opted into SMS but has no prior conversation with the brand. The goal is to earn a reply or click without tripping compliance rules. Only valid for audiences with clean SMS opt-in proof.',
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
