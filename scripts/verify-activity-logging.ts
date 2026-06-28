/**
 * Real-path proof for the Log Activity UI (CRM gap-ledger item #2).
 * Logs an activity exactly as the modal does (note, with a backdated occurredAt as an ISO
 * string), reads it back via getActivities for that entity (what the timeline does), checks
 * the occurredAt round-trips to the right date, then deletes the test activity.
 *
 *   npx tsx scripts/verify-activity-logging.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

function asDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'string' || typeof v === 'number') { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const s = typeof o._seconds === 'number' ? o._seconds : typeof o.seconds === 'number' ? o.seconds : null;
    if (s !== null) return new Date(s * 1000);
    if (typeof (o as { toDate?: () => Date }).toDate === 'function') return (o as { toDate: () => Date }).toDate();
  }
  return null;
}

async function main(): Promise<void> {
  const { createActivity, getActivities, deleteActivity } = await import('@/lib/crm/activity-service');

  const entityId = `verify-contact-${Date.now()}`;
  const backdated = new Date(Date.now() - 86_400_000); // yesterday — proves the "When" field is honored
  const occurredAt = backdated.toISOString();

  console.log('1) Logging a note (as the modal does) for', entityId, '@', occurredAt);
  const created = await createActivity({
    type: 'note_added',
    subject: 'VERIFY log-activity',
    body: 'Proving the Log Activity path persists + reads back.',
    relatedTo: [{ entityType: 'contact', entityId, entityName: 'Verify Contact' }],
    occurredAt: occurredAt as unknown as Date,
  });
  console.log('   created id:', created.id);

  console.log('2) Reading the timeline back (getActivities entityType=contact)…');
  const result = await getActivities({ entityType: 'contact', entityId }, { pageSize: 10 });
  const found = result.data.find((a) => a.id === created.id);
  const storedWhen = found ? asDate(found.occurredAt) : null;
  const dateMatches = storedWhen ? Math.abs(storedWhen.getTime() - backdated.getTime()) < 60_000 : false;
  console.log('   found in timeline:', Boolean(found), '| entity activity count:', result.data.length);
  console.log('   stored occurredAt →', storedWhen?.toISOString() ?? '(none)', '| matches backdate:', dateMatches);

  console.log('3) Cleaning up the test activity…');
  await deleteActivity(created.id);
  const after = await getActivities({ entityType: 'contact', entityId }, { pageSize: 10 });
  console.log('   count after delete:', after.data.length, '(expect 0)');

  const pass = Boolean(found) && dateMatches && after.data.length === 0;
  console.log(pass ? '\nPASS ✅ — logged activity persisted, read back with correct date, cleaned up.' : '\nFAIL ❌');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error('FAIL ❌', e); process.exit(1); });
