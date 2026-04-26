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
  const id = 'tfb_bluesky_expert_1777238866173';
  // Look in collections that might hold the improvement proposal
  for (const c of ['specialistImprovementRequests','improvementRequests','promptEdits','promptProposals','trainingFeedback','specialistPromptEdits']) {
    const snap = await db.collection(`organizations/${PLATFORM_ID}/${c}`).doc(id).get().catch(() => null);
    if (snap?.exists) {
      console.log(`FOUND in ${c}:`);
      const d = snap.data() as Record<string, unknown>;
      for (const [k,v] of Object.entries(d)) {
        const s = typeof v === 'object' && v !== null ? JSON.stringify(v, null, 2) : String(v);
        console.log(`  ${k}: ${s.slice(0, 1500)}`);
      }
    }
  }
  // Also search trainingFeedback for any embedded edit
  const tfb = await db.collection(`organizations/${PLATFORM_ID}/trainingFeedback`).doc(id).get();
  if (tfb.exists) {
    console.log(`\nFULL trainingFeedback doc:`);
    const d = tfb.data() as Record<string, unknown>;
    for (const [k,v] of Object.entries(d)) {
      const s = typeof v === 'object' && v !== null ? JSON.stringify(v, null, 2) : String(v);
      console.log(`  ${k}: ${s.slice(0, 2500)}`);
    }
  }
  process.exit(0);
})();
