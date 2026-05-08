import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { PLATFORM_ID } from '@/lib/constants/platform';

async function main() {
  if (!adminDb) {
    console.log('NO_ADMIN_DB');
    return;
  }
  const path = getSubCollection('apiKeys');
  const snap = await adminDb.collection(path).doc(PLATFORM_ID).get();
  if (!snap.exists) {
    console.log('NO_API_KEYS_DOC');
    return;
  }
  const data = snap.data() as Record<string, unknown>;
  const email = data.email as Record<string, unknown> | undefined;
  const sendgrid = email?.sendgrid as Record<string, unknown> | undefined;
  if (!sendgrid) {
    console.log('NO_email.sendgrid_BLOCK; email block keys:', email ? Object.keys(email) : '(no email block)');
    return;
  }
  console.log('email.sendgrid:');
  console.log('  fromEmail:', sendgrid.fromEmail ?? '(unset)');
  console.log('  fromName:', sendgrid.fromName ?? '(unset)');
  console.log('  hasApiKey:', typeof sendgrid.apiKey === 'string' && sendgrid.apiKey.length > 0);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
