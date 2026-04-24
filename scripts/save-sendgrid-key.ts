/**
 * Persist a SendGrid API key into the platform's apiKeys Firestore doc.
 *
 * Reads the key from the environment variable `SENDGRID_API_KEY` so the
 * secret never appears in a command line, shell history, or script file.
 *
 * Usage (PowerShell):
 *   $env:SENDGRID_API_KEY="SG...."; npx tsx scripts/save-sendgrid-key.ts
 *
 * Usage (bash):
 *   SENDGRID_API_KEY="SG...." npx tsx scripts/save-sendgrid-key.ts
 *
 * Optional:
 *   $env:SENDGRID_FROM_EMAIL="noreply@yourdomain"
 *   $env:SENDGRID_FROM_NAME="SalesVelocity.ai"
 *
 * The script does a field-level merge on the `email.sendgrid` sub-doc so
 * other email-provider configs (Resend, SMTP, etc.) are not clobbered.
 */

import '@/lib/firebase/admin';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { PLATFORM_ID } from '@/lib/constants/platform';

async function main(): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    console.error('ERROR: SENDGRID_API_KEY env var is required but missing.');
    console.error('       Set it before running this script (see header comment).');
    process.exit(1);
  }
  if (!apiKey.startsWith('SG.')) {
    console.error('ERROR: SENDGRID_API_KEY does not start with "SG." — does not look like a SendGrid key.');
    process.exit(2);
  }
  if (!adminDb) {
    console.error('ERROR: adminDb not initialized');
    process.exit(3);
  }

  const fromEmail = process.env.SENDGRID_FROM_EMAIL?.trim();
  const fromName = process.env.SENDGRID_FROM_NAME?.trim();

  const apiKeysPath = getSubCollection('apiKeys');
  const docRef = adminDb.collection(apiKeysPath).doc(PLATFORM_ID);
  const existingSnap = await docRef.get();
  const existing = existingSnap.exists
    ? (existingSnap.data() as Record<string, unknown> | undefined) ?? {}
    : {};
  const existingEmail =
    existing.email && typeof existing.email === 'object'
      ? (existing.email as Record<string, unknown>)
      : {};

  const sendgridEntry: Record<string, unknown> = {
    apiKey,
    ...(fromEmail ? { fromEmail } : {}),
    ...(fromName ? { fromName } : {}),
  };

  const nowIso = new Date().toISOString();
  const updatedEmail = {
    ...existingEmail,
    sendgrid: sendgridEntry,
  };

  const writePayload = {
    email: updatedEmail,
    updatedAt: nowIso,
    updatedBy: 'save-sendgrid-key-script',
    ...(existingSnap.exists ? {} : { createdAt: nowIso }),
  };

  await docRef.set(writePayload, { merge: true });

  const keyPreview = `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;
  console.log('SendGrid key persisted');
  console.log(`  Firestore path:   ${apiKeysPath}/${PLATFORM_ID}`);
  console.log(`  Field:            email.sendgrid.apiKey`);
  console.log(`  Key preview:      ${keyPreview}`);
  if (fromEmail) { console.log(`  fromEmail:        ${fromEmail}`); }
  if (fromName) { console.log(`  fromName:         ${fromName}`); }
  console.log('');
  console.log('Verify via the app at /settings/api-keys, or by running:');
  console.log('  npx tsx scripts/verify-sendgrid-key.ts');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Failed:', err instanceof Error ? err.message : String(err));
  process.exit(10);
});
