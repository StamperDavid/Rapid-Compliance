/**
 * Verify the SendGrid key persisted under apiKeys/{PLATFORM_ID} is being
 * picked up by the apiKeyService. Prints only a key preview, never the
 * full key.
 *
 * Usage:
 *   npx tsx scripts/verify-sendgrid-key.ts
 */

import '@/lib/firebase/admin';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';

function previewKey(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) { return '<not a string>'; }
  if (value.length < 12) { return `<short: ${value.length} chars>`; }
  return `${value.slice(0, 6)}...${value.slice(-4)}  (len=${value.length})`;
}

async function main(): Promise<void> {
  apiKeyService.clearCache();
  const raw = await apiKeyService.getServiceKey(PLATFORM_ID, 'sendgrid');
  if (!raw) {
    console.log('SendGrid key NOT FOUND at email.sendgrid.');
    process.exit(1);
  }
  if (typeof raw === 'string') {
    console.log('SendGrid entry is a bare string (unexpected — expected object).');
    console.log(`  preview: ${previewKey(raw)}`);
    process.exit(0);
  }
  const entry = raw as Record<string, unknown>;
  console.log('SendGrid entry present at email.sendgrid:');
  console.log(`  apiKey:    ${previewKey(entry.apiKey)}`);
  if (typeof entry.fromEmail === 'string') {
    console.log(`  fromEmail: ${entry.fromEmail}`);
  }
  if (typeof entry.fromName === 'string') {
    console.log(`  fromName:  ${entry.fromName}`);
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Failed:', err instanceof Error ? err.message : String(err));
  process.exit(10);
});
