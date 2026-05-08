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
  const fs2 = admin.firestore();

  console.log('=== missionGrades for BYOK ===');
  const grades = await fs2.collection(`organizations/${PLATFORM_ID}/missionGrades`).where('missionId', '==', missionId).get();
  for (const d of grades.docs) {
    console.log('---', d.id, '---');
    console.log(JSON.stringify(d.data(), null, 2));
  }

  console.log('\n=== trainingFeedback tfb_x_expert_1778182378512 ===');
  const tfb = await fs2.collection(`organizations/${PLATFORM_ID}/trainingFeedback`).doc('tfb_x_expert_1778182378512').get();
  if (tfb.exists) {
    console.log(JSON.stringify(tfb.data(), null, 2));
  }
  process.exit(0);
})();
