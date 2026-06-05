/**
 * BACKFILL — populate the live "leads" schema's pick-list options + field help-text.
 *
 * The schema-save route used to strip `options`/`description`, so the live leads
 * schema doc lacks dropdown choices (empty Source) and help text. This one-shot
 * script reads the live leads schema, fills in options + descriptions for the
 * known fields, and writes it back. Idempotent — safe to re-run. Operators can
 * further edit these in the Schema Editor afterward.
 *
 * Usage:  npx tsx scripts/backfill-leads-schema-options.ts
 */

/* eslint-disable no-console */

import { AdminFirestoreService } from '../src/lib/db/admin-firestore-service';
import { getSubCollection } from '../src/lib/firebase/collections';

const SCHEMAS = getSubCollection('schemas');

interface SchemaField {
  id?: string;
  key?: string;
  label?: string;
  type?: string;
  options?: string[];
  description?: string;
  [k: string]: unknown;
}
interface SchemaDoc {
  id: string;
  name?: string;
  fields?: SchemaField[];
  [k: string]: unknown;
}

// Keyed by normalized field key. Variants handled below.
const OPTIONS: Record<string, string[]> = {
  source: ['Website', 'Referral', 'Cold Call', 'Social Media', 'Email Campaign', 'Trade Show', 'Other'],
  status: ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted'],
  rating: ['Hot', 'Warm', 'Cold'],
};
const DESCRIPTIONS: Record<string, string> = {
  source: 'Where this lead came from.',
  status: 'Where the lead sits in your qualification process.',
  score: 'Automatic 0–100 lead score based on fit and engagement (higher = hotter).',
  assignedto: 'The team member who owns this lead.',
  value: 'Estimated deal value if this lead converts.',
  rating: 'Quick temperature read on the lead.',
};

function norm(k: string): string {
  return k.toLowerCase().replace(/[^a-z]/g, '');
}

async function main(): Promise<void> {
  const all = await AdminFirestoreService.getAll<SchemaDoc>(SCHEMAS, []);
  console.log(`Found ${all.length} schema docs: ${all.map(s => s.id).join(', ')}`);

  const leads = all.find(s => norm(s.id).includes('leads') || norm(s.name ?? '').includes('leads'));
  if (!leads) {
    console.error('✗ No live "leads" schema doc found. The entity page is using the fallback; nothing to backfill.');
    process.exit(1);
  }

  const fields = leads.fields ?? [];
  let changed = 0;
  const updated = fields.map((f) => {
    const key = norm(f.key ?? f.label ?? '');
    const next: SchemaField = { ...f };
    if (OPTIONS[key] && (!Array.isArray(f.options) || f.options.length === 0)) {
      next.options = OPTIONS[key];
      changed++;
      console.log(`  + options on "${f.key ?? f.label}": ${OPTIONS[key].join(', ')}`);
    }
    if (DESCRIPTIONS[key] && !f.description) {
      next.description = DESCRIPTIONS[key];
      changed++;
      console.log(`  + description on "${f.key ?? f.label}": ${DESCRIPTIONS[key]}`);
    }
    if (key === 'assignedto' && f.type !== 'user') {
      next.type = 'user';
      changed++;
      console.log(`  ~ type of "${f.key ?? f.label}" -> user (live team-member dropdown)`);
    }
    return next;
  });

  if (changed === 0) {
    console.log('Nothing to change — leads schema already has options/descriptions. (idempotent no-op)');
    process.exit(0);
  }

  await AdminFirestoreService.update(SCHEMAS, leads.id, { fields: updated });
  console.log(`✓ Updated leads schema (${leads.id}) — ${changed} field-attribute(s) backfilled.`);
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('Backfill failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
