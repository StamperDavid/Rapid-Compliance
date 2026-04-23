/**
 * Diagnose failing-prompt classifications by running each through the
 * Intent Expander 10 times and tabulating the queryType distribution plus
 * the expander's reasoning. Used to understand WHY specific prompts flake
 * before drafting a targeted correction.
 *
 * Usage: npx tsx scripts/diagnose-failing-prompts.ts
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (match) {
        const [, key, rawValue] = match;
        const value = rawValue.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
        if (!process.env[key]) { process.env[key] = value; }
      }
    }
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  } else {
    throw new Error('Missing FIREBASE_ADMIN_* env vars');
  }
}

initAdmin();

import { expandIntent } from '../src/lib/orchestrator/intent-expander';

const FAILING_PROMPTS = [
  { id: 'reputation-001', prompt: 'Draft a response to this 1-star Google review: \'Terrible onboarding, nothing worked.\'' },
  { id: 'reputation-002', prompt: 'Check our ratings across all review platforms.' },
  { id: 'voice-002', prompt: 'Set Jasper up in prospector mode to handle inbound calls about our starter plan.' },
  { id: 'forms-001', prompt: 'Create a contact form for the homepage with name, email, company, and message fields.' },
  { id: 'multi-001', prompt: 'Create a blog post AND 5 social media posts about the benefits of AI-powered lead scoring for B2B sales teams.' },
];

const ITERATIONS = 10;

async function main(): Promise<void> {
  for (const fixture of FAILING_PROMPTS) {
    console.log(`\n═══════════════════════════════════════════════════════════════════`);
    console.log(`  ${fixture.id}`);
    console.log(`  "${fixture.prompt}"`);
    console.log(`═══════════════════════════════════════════════════════════════════`);

    const classifications: string[] = [];
    const reasonings: string[] = [];

    for (let i = 1; i <= ITERATIONS; i++) {
      const result = await expandIntent(fixture.prompt);
      const qt = result?.queryType ?? 'null';
      classifications.push(qt);
      reasonings.push(result?.reasoning ?? '(no reasoning)');
      console.log(`  iter ${i}: ${qt.padEnd(14)}  ${(result?.reasoning ?? '').slice(0, 140)}`);
    }

    // Tally
    const counts = new Map<string, number>();
    for (const c of classifications) { counts.set(c, (counts.get(c) ?? 0) + 1); }
    console.log(`\n  Distribution:`);
    for (const [qt, n] of counts) {
      const bar = '█'.repeat(n);
      console.log(`    ${qt.padEnd(14)} ${n}/${ITERATIONS}  ${bar}`);
    }
  }
}

main().catch((err) => {
  console.error('Diagnostic failed:', err);
  process.exit(1);
});
