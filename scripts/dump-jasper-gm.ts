/* eslint-disable no-console */
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (m) {
        const v = m[2].replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
        if (!process.env[m[1]]) { process.env[m[1]] = v; }
      }
    }
  }
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    } as admin.ServiceAccount),
  });
}

initAdmin();

import { getActiveJasperGoldenMaster, invalidateJasperGMCache } from '../src/lib/orchestrator/jasper-golden-master';

async function main(): Promise<void> {
  invalidateJasperGMCache();
  const gm = await getActiveJasperGoldenMaster();
  if (!gm) { console.log('NO ACTIVE JASPER GM'); process.exit(1); }
  console.log(`GM id=${gm.id} version=${gm.version} len=${gm.systemPrompt.length}`);
  if (!fs.existsSync('.build-tmp')) { fs.mkdirSync('.build-tmp'); }
  fs.writeFileSync('.build-tmp/jasper-active-prompt.txt', gm.systemPrompt);
  console.log('wrote .build-tmp/jasper-active-prompt.txt');
  process.exit(0);
}

void main();
