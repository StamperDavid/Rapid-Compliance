import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';

async function main() {
  if (!adminDb) {
    console.log('NO_ADMIN_DB');
    return;
  }
  const path = getSubCollection('integrations');
  const snap = await adminDb.collection(path).get();
  console.log('Found', snap.size, 'integration docs');
  for (const doc of snap.docs) {
    const data = doc.data();
    console.log('---');
    console.log('id:', doc.id);
    console.log('  service:', data.service ?? data.providerId ?? '(unknown)');
    console.log('  status:', data.status ?? '(unknown)');
    console.log('  accountEmail:', data.accountEmail ?? '(unset)');
    console.log('  has access_token:', typeof data.access_token === 'string' || typeof data.accessToken === 'string');
    console.log('  has refresh_token:', typeof data.refresh_token === 'string' || typeof data.refreshToken === 'string');
    console.log('  connectedAt:', data.connectedAt ?? '(unset)');
    console.log('  updatedAt:', data.updatedAt ?? '(unset)');
    if (data.userId) console.log('  userId:', data.userId);
    if (data.user_email) console.log('  user_email:', data.user_email);
    if (data.email) console.log('  email:', data.email);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
