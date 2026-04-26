import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
const envPath = path.resolve('D:/Future Rapid Compliance/.env.local');
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (m) { const v = m[2].replace(/^["']|["']$/g, ''); if (!process.env[m[1]]) process.env[m[1]] = v; }
}
const sa = JSON.parse(fs.readFileSync('D:/Future Rapid Compliance/serviceAccountKey.json', 'utf-8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
(async () => {
  const PLATFORM_ID = 'rapid-compliance-root';
  const db = admin.firestore();
  const reqId = 'tfb_bluesky_expert_1777238866173';
  for (const c of ['specialistImprovementRequests','improvementRequests','promptRevisions','promptEdits']) {
    const snap = await db.collection(`organizations/${PLATFORM_ID}/${c}`).orderBy('createdAt','desc').limit(5).get().catch(() => null);
    if (!snap || snap.empty) { console.log(`(${c} empty/n/a)`); continue; }
    console.log(`\n=== ${c} ===`);
    for (const doc of snap.docs) {
      const d = doc.data();
      console.log('---', doc.id);
      console.log('  keys:', Object.keys(d).join(', '));
      for (const [k,v] of Object.entries(d)) {
        const s = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v);
        console.log(`  ${k}: ${s.slice(0, 800)}`);
      }
    }
  }
  process.exit(0);
})();
