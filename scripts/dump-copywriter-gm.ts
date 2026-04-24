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

import { getActiveSpecialistGMByIndustry } from '../src/lib/training/specialist-golden-master-service';

async function main(): Promise<void> {
  const gm = await getActiveSpecialistGMByIndustry('COPYWRITER', 'saas_sales_ops');
  if (!gm) { console.log('NO ACTIVE COPYWRITER GM'); process.exit(1); }
  const sp: string = typeof gm.config.systemPrompt === 'string'
    ? gm.config.systemPrompt
    : gm.systemPromptSnapshot ?? '';
  console.log(`GM id=${gm.id} version=${gm.version} len=${sp.length}`);
  if (!fs.existsSync('.build-tmp')) { fs.mkdirSync('.build-tmp'); }
  fs.writeFileSync('.build-tmp/copywriter-active-prompt.txt', sp);
  console.log('wrote .build-tmp/copywriter-active-prompt.txt');
  process.exit(0);
}

void main();
