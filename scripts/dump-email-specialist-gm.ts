/**
 * Read the active Email Specialist Golden Master from Firestore and dump
 * its system prompt to .build-tmp for inspection.
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) { return; }
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m) {
      const v = m[2].replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
      if (!process.env[m[1]]) { process.env[m[1]] = v; }
    }
  }
}

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  loadEnvLocal();
  const sakPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(sakPath)) {
    const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } else {
    throw new Error('No serviceAccountKey.json');
  }
}

initAdmin();

import { getActiveSpecialistGMByIndustry } from '../src/lib/training/specialist-golden-master-service';

async function main(): Promise<void> {
  const gm = await getActiveSpecialistGMByIndustry('EMAIL_SPECIALIST', 'saas_sales_ops');
  if (!gm) {
    console.error('No active Email Specialist GM');
    process.exit(1);
  }
  const config = gm.config as { systemPrompt?: string };
  const prompt = config.systemPrompt ?? gm.systemPromptSnapshot ?? '';
  console.log(`GM id=${gm.id} version=${gm.version} len=${prompt.length}`);
  const outDir = path.resolve(process.cwd(), '.build-tmp');
  if (!fs.existsSync(outDir)) { fs.mkdirSync(outDir, { recursive: true }); }
  const outPath = path.join(outDir, 'email-specialist-active-prompt.txt');
  fs.writeFileSync(outPath, prompt, 'utf-8');
  console.log(`wrote ${path.relative(process.cwd(), outPath)}`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
