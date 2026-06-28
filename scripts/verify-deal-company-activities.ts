/**
 * Real-path proof that the activity timeline + Log Activity now work for DEAL and COMPANY
 * records (CRM gap-ledger: extend logging beyond contacts). Mirrors verify-activity-logging.ts
 * but for the two new entity types: logs a note as the modal does, reads it back exactly as
 * RecordActivityTimeline does (getActivities filtered by entityType+entityId), then cleans up.
 *
 *   npx tsx scripts/verify-deal-company-activities.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function roundTrip(entityType: 'deal' | 'company'): Promise<boolean> {
  const { createActivity, getActivities, deleteActivity } = await import('@/lib/crm/activity-service');
  const entityId = `verify-${entityType}-${Date.now()}`;

  console.log(`\n[${entityType}] 1) Logging a note for`, entityId);
  const created = await createActivity({
    type: 'note_added',
    subject: `VERIFY ${entityType} log-activity`,
    body: `Proving the Log Activity path persists + reads back for a ${entityType}.`,
    relatedTo: [{ entityType, entityId, entityName: `Verify ${entityType}` }],
  });
  console.log('   created id:', created.id);

  console.log(`[${entityType}] 2) Reading the timeline back (getActivities entityType=${entityType})…`);
  const result = await getActivities({ entityType, entityId }, { pageSize: 10 });
  const found = result.data.find((a) => a.id === created.id);
  console.log('   found in timeline:', Boolean(found), '| entity activity count:', result.data.length);

  console.log(`[${entityType}] 3) Cleaning up…`);
  await deleteActivity(created.id);
  const after = await getActivities({ entityType, entityId }, { pageSize: 10 });
  console.log('   count after delete:', after.data.length, '(expect 0)');

  return Boolean(found) && after.data.length === 0;
}

async function main(): Promise<void> {
  const dealOk = await roundTrip('deal');
  const companyOk = await roundTrip('company');
  const pass = dealOk && companyOk;
  console.log(pass
    ? '\nPASS ✅ — deal + company activities persist, read back through the timeline filter, and clean up.'
    : `\nFAIL ❌ — deal:${dealOk} company:${companyOk}`);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error('FAIL ❌', e); process.exit(1); });
