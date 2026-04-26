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
  const missionId = 'mission_inbound_dm_bluesky_bluesky_3mkg7fpqbks24_1777232195828';
  const doc = await admin.firestore().collection(`organizations/${PLATFORM_ID}/missions`).doc(missionId).get();
  if (!doc.exists) { console.log('NOT FOUND'); process.exit(1); }
  const m = doc.data() as any;
  console.log('status:', m.status);
  console.log('sourceEvent:', JSON.stringify(m.sourceEvent));
  for (const s of m.steps) {
    console.log('---STEP---');
    console.log('  status:', s.status);
    console.log('  toolName:', s.toolName);
    console.log('  toolResult length:', s.toolResult?.length ?? 0);
    if (s.toolResult) {
      try {
        const parsed = JSON.parse(s.toolResult);
        console.log('  parsed keys:', Object.keys(parsed));
        console.log('  parsed.mode:', parsed.mode);
        console.log('  parsed.composedReply:', JSON.stringify(parsed.composedReply).slice(0, 300));
      } catch (e) { console.log('  parse error:', (e as Error).message); }
    }
  }
  process.exit(0);
})();
