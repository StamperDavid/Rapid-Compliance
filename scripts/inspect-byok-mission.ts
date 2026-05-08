import * as admin from 'firebase-admin';
import * as fs from 'fs';

const envPath = 'D:/Future Rapid Compliance/.env.local';
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (m) {
    const v = m[2].replace(/^["']|["']$/g, '');
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
const sa = JSON.parse(fs.readFileSync('D:/Future Rapid Compliance/serviceAccountKey.json', 'utf-8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });

(async () => {
  const PLATFORM_ID = 'rapid-compliance-root';
  const missionId = 'mission_req_1778182007561_qymsh9';
  const doc = await admin.firestore().collection(`organizations/${PLATFORM_ID}/missions`).doc(missionId).get();
  if (!doc.exists) {
    console.log('NOT FOUND');
    process.exit(1);
  }
  const m: Record<string, unknown> = doc.data() as Record<string, unknown>;
  console.log('=== MISSION:', m.title, '===');
  console.log('status:', m.status);
  console.log('userPrompt/requestText:', m.userPrompt ?? m.prompt ?? m.requestText ?? '(none)');
  const steps = (m.steps ?? []) as Array<Record<string, unknown>>;
  console.log('steps:', steps.length);
  for (const s of steps) {
    console.log('\n--- STEP', s.id ?? s.stepId, '---');
    console.log('  status:', s.status);
    console.log('  toolName:', s.toolName);
    console.log('  delegatedTo:', s.delegatedTo);
    console.log('  specialistsUsed:', JSON.stringify(s.specialistsUsed));
    if (s.toolArgs) console.log('  toolArgs:', JSON.stringify(s.toolArgs).slice(0, 600));
    if (s.toolResult) {
      const r = typeof s.toolResult === 'string' ? s.toolResult : JSON.stringify(s.toolResult);
      console.log('  toolResult (first 1500 chars):', r.slice(0, 1500));
    }
  }
  const fb = await admin.firestore()
    .collection(`organizations/${PLATFORM_ID}/trainingFeedback`)
    .where('missionId', '==', missionId)
    .get();
  console.log('\n=== GRADES (', fb.size, ') ===');
  for (const f of fb.docs) {
    const d = f.data();
    console.log('---');
    console.log('  id:', f.id);
    console.log('  rating:', d.rating);
    console.log('  comment:', d.comment);
    console.log('  specialistId:', d.specialistId);
    console.log('  status:', d.status);
  }
  process.exit(0);
})();
