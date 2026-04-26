import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m) { const v = m[2].replace(/^["']|["']$/g, ''); if (!process.env[m[1]]) process.env[m[1]] = v; }
  }
}

function initAdmin() {
  if (admin.apps.length > 0) return;
  loadEnvLocal();
  const sakPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(sakPath)) {
    const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
}
initAdmin();

(async () => {
  const PLATFORM_ID = 'rapid-compliance-root';
  const db = admin.firestore();
  // Query both common collection paths used by the training pipeline
  for (const collName of ['trainingFeedback', 'training_feedback']) {
    const collPath = `organizations/${PLATFORM_ID}/${collName}`;
    try {
      const snap = await db.collection(collPath).orderBy('createdAt', 'desc').limit(10).get();
      if (snap.empty) {
        console.log(`(${collPath} empty)`);
        continue;
      }
      console.log(`\n=== ${collPath} (${snap.size} most recent) ===`);
      for (const doc of snap.docs) {
        const d = doc.data() as Record<string, unknown>;
        console.log('---');
        console.log('  id:', doc.id);
        console.log('  ALL KEYS:', Object.keys(d).join(', '));
        for (const [k, v] of Object.entries(d)) {
          const valStr = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v);
          console.log(`  ${k}: ${valStr.slice(0, 600)}`);
        }
      }
    } catch (err) {
      console.log(`(error querying ${collPath}: ${(err as Error).message})`);
    }
  }
  process.exit(0);
})();
