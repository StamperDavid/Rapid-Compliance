/**
 * Fix `as TypeName` casts that broke after the FirestoreService → AdminFirestoreService
 * sweep. Admin SDK's get/getAll return type is `FirestoreDocument` (stricter than
 * client SDK's `DocumentData`), so direct `as TypeName` no longer overlaps.
 *
 * The safe escape hatch is `as unknown as TypeName` — preserves the caller's
 * intent while satisfying TS's overlap check.
 *
 * This script targets the SPECIFIC error patterns the tsc run surfaced.
 * Run with `npx tsx scripts/fix-admin-sdk-casts.ts`.
 */
import fs from 'fs';
import path from 'path';

interface Fix {
  file: string;
  from: string;
  to: string;
}

const FIXES: Fix[] = [
  // commerce/catalog/specialist
  {
    file: 'src/lib/agents/commerce/catalog/specialist.ts',
    from: 'this.extractMappings(ecommerceConfig);',
    to: 'this.extractMappings(ecommerceConfig as unknown as { productMappings?: unknown });',
  },
  // analytics/ecommerce-analytics: cast getAll results to typed arrays via unknown
  // (the file has reduces/maps over typed arrays — fix with `as unknown as Type[]`)
  // analytics/workflow-analytics
  {
    file: 'src/lib/analytics/workflow-analytics.ts',
    from: ') as WorkflowExecution[]',
    to: ') as unknown as WorkflowExecution[]',
  },
  // ecommerce/mapping-adapter
  {
    file: 'src/lib/ecommerce/mapping-adapter.ts',
    from: ' as EcommerceConfig',
    to: ' as unknown as EcommerceConfig',
  },
  {
    file: 'src/lib/ecommerce/mapping-adapter.ts',
    from: ' as Schema',
    to: ' as unknown as Schema',
  },
  // ecommerce/payment-service
  {
    file: 'src/lib/ecommerce/payment-service.ts',
    from: ' as OrderRecord',
    to: ' as unknown as OrderRecord',
  },
  // email/email-service
  {
    file: 'src/lib/email/email-service.ts',
    from: ' as TrackingData',
    to: ' as unknown as TrackingData',
  },
  // integrations/field-mapper
  {
    file: 'src/lib/integrations/field-mapper.ts',
    from: ' as IntegrationFieldMapping',
    to: ' as unknown as IntegrationFieldMapping',
  },
  // notifications/notification-service
  {
    file: 'src/lib/notifications/notification-service.ts',
    from: ' as NotificationTemplate',
    to: ' as unknown as NotificationTemplate',
  },
  {
    file: 'src/lib/notifications/notification-service.ts',
    from: ' as NotificationPreferences',
    to: ' as unknown as NotificationPreferences',
  },
  // outbound/nurture-service
  {
    file: 'src/lib/outbound/nurture-service.ts',
    from: ' as EnrollmentStatus[]',
    to: ' as unknown as EnrollmentStatus[]',
  },
  // schema/* — Schema, Workflow, SchemaChangeEvent casts
  {
    file: 'src/lib/schema/schema-change-debouncer.ts',
    from: ' as Schema',
    to: ' as unknown as Schema',
  },
  {
    file: 'src/lib/schema/schema-change-handler.ts',
    from: ' as SchemaChangeEvent[]',
    to: ' as unknown as SchemaChangeEvent[]',
  },
  {
    file: 'src/lib/schema/schema-change-tracker.ts',
    from: ' as SchemaChangeEvent[]',
    to: ' as unknown as SchemaChangeEvent[]',
  },
  {
    file: 'src/lib/schema/workflow-validator.ts',
    from: ' as Schema',
    to: ' as unknown as Schema',
  },
  {
    file: 'src/lib/schema/workflow-validator.ts',
    from: ' as Workflow',
    to: ' as unknown as Workflow',
  },
  // sms/sms-service
  {
    file: 'src/lib/sms/sms-service.ts',
    from: ' as SMSTemplate',
    to: ' as unknown as SMSTemplate',
  },
  // voice/call-context-service
  {
    file: 'src/lib/voice/call-context-service.ts',
    from: ' as StoredCallContext',
    to: ' as unknown as StoredCallContext',
  },
  // commerce/catalog/specialist Product casts
  {
    file: 'src/lib/agents/commerce/catalog/specialist.ts',
    from: ' as Product[]',
    to: ' as unknown as Product[]',
  },
  {
    file: 'src/lib/agents/commerce/catalog/specialist.ts',
    from: ' as Product',
    to: ' as unknown as Product',
  },
];

const ROOT = path.join(__dirname, '..');

function applyFix(fix: Fix): number {
  const filePath = path.join(ROOT, fix.file);
  if (!fs.existsSync(filePath)) {
    console.warn(`SKIP (missing): ${fix.file}`);
    return 0;
  }
  const original = fs.readFileSync(filePath, 'utf-8');
  // Don't double-fix: skip if the replacement is already present and the source is not
  const fromInOriginal = original.split(fix.from).length - 1;
  const toInOriginal = original.split(fix.to).length - 1;
  if (fromInOriginal === 0) {
    return 0;
  }
  // The `from` substring is also a SUBSTRING of `to` (e.g., " as Schema" is in " as unknown as Schema").
  // So a naïve count is wrong. Use a more careful replace.
  // Walk the string and only replace `from` when it's NOT already preceded by "unknown".
  const re = new RegExp(`(?<!unknown)${fix.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
  const updated = original.replace(re, fix.to);
  if (updated === original) {
    return 0;
  }
  const count = (original.match(re) ?? []).length;
  fs.writeFileSync(filePath, updated, 'utf-8');
  console.log(`✓ ${fix.file}: ${count}× "${fix.from}" → "${fix.to}"`);
  return count;
}

let total = 0;
for (const fix of FIXES) {
  total += applyFix(fix);
}
console.log(`\nDone. ${total} replacements.`);
