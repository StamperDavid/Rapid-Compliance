/**
 * Verify Brand DNA is baked into all 34 active Golden Masters in Firestore.
 *
 * After the "strip runtime / bake at seed time" refactor, Brand DNA lives
 * INSIDE each GM's `config.systemPrompt` field. This script queries
 * specialistGoldenMasters directly and confirms every active doc contains
 * the "## Brand DNA" marker + SalesVelocity's actual tenant values from the
 * org doc.
 *
 * Usage: npx tsx scripts/verify-brand-dna-injection.ts
 *
 * Exit code: 0 if every active GM has Brand DNA baked in, 1 otherwise.
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

interface BrandDNADoc {
  companyDescription: string;
  industry: string;
  toneOfVoice: string;
  targetAudience: string;
  uniqueValue?: string;
  communicationStyle?: string;
  keyPhrases?: string[];
  avoidPhrases?: string[];
  competitors?: string[];
}

interface ActiveGM {
  specialistId: string;
  industryKey: string;
  docId: string;
  systemPrompt: string;
}

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
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    const sakPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(sakPath)) {
      const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    } else {
      throw new Error('Missing FIREBASE_ADMIN_* env vars and no serviceAccountKey.json');
    }
  }
}

async function main(): Promise<void> {
  initAdmin();
  const db = admin.firestore();
  const PLATFORM_ID = 'rapid-compliance-root';

  // Load Brand DNA for reference values
  const orgDoc = await db.collection('organizations').doc(PLATFORM_ID).get();
  if (!orgDoc.exists) { throw new Error('Org doc not found'); }
  const brandDNA = orgDoc.data()?.brandDNA as BrandDNADoc | undefined;
  if (!brandDNA) { throw new Error('Brand DNA not configured on org doc'); }

  console.log('\nBrand DNA reference (from org doc):');
  console.log(`  industry: ${brandDNA.industry}`);
  console.log(`  toneOfVoice: ${brandDNA.toneOfVoice}`);
  console.log(`  companyDescription: ${brandDNA.companyDescription.slice(0, 80)}...`);
  console.log();

  // Query all active Golden Masters
  const gmsSnap = await db
    .collection(`organizations/${PLATFORM_ID}/specialistGoldenMasters`)
    .where('isActive', '==', true)
    .get();

  const activeGMs: ActiveGM[] = [];
  gmsSnap.forEach((doc) => {
    const data = doc.data();
    const systemPrompt = (data.config?.systemPrompt as string | undefined) ?? (data.systemPromptSnapshot as string | undefined) ?? '';
    activeGMs.push({
      specialistId: (data.specialistId as string | undefined) ?? 'unknown',
      industryKey: (data.industryKey as string | undefined) ?? 'unknown',
      docId: doc.id,
      systemPrompt,
    });
  });

  activeGMs.sort((a, b) => a.specialistId.localeCompare(b.specialistId));

  console.log(`Verifying Brand DNA baked into ${activeGMs.length} active Golden Masters...\n`);

  const results: Array<{ id: string; ok: boolean; reason: string }> = [];
  for (const gm of activeGMs) {
    const prompt = gm.systemPrompt;
    const issues: string[] = [];

    if (prompt.length === 0) {
      issues.push('empty systemPrompt');
    }
    if (!prompt.includes('## Brand DNA')) {
      issues.push('no "## Brand DNA" marker');
    }
    if (!prompt.includes(brandDNA.industry)) {
      issues.push(`industry "${brandDNA.industry}" not in prompt`);
    }
    if (!prompt.includes(brandDNA.toneOfVoice)) {
      issues.push(`toneOfVoice "${brandDNA.toneOfVoice}" not in prompt`);
    }
    if (!prompt.includes(brandDNA.companyDescription.slice(0, 40))) {
      issues.push('companyDescription not in prompt');
    }
    if (brandDNA.avoidPhrases && brandDNA.avoidPhrases.length > 0) {
      const firstAvoid = brandDNA.avoidPhrases[0];
      if (!prompt.includes(firstAvoid)) {
        issues.push(`avoidPhrase "${firstAvoid}" not in prompt`);
      }
    }
    if (brandDNA.competitors && brandDNA.competitors.length > 0) {
      const firstComp = brandDNA.competitors[0];
      if (!prompt.includes(firstComp)) {
        issues.push(`competitor "${firstComp}" not in prompt`);
      }
    }

    if (issues.length === 0) {
      results.push({ id: gm.specialistId, ok: true, reason: `GM baked (${prompt.length} chars)` });
    } else {
      results.push({ id: gm.specialistId, ok: false, reason: issues.join('; ') });
    }
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  for (const r of results) {
    const marker = r.ok ? '✓' : '✗';
    console.log(`  ${marker} ${r.id.padEnd(30)} ${r.reason}`);
  }

  console.log(`\n${passed} passed, ${failed} failed, ${results.length} total\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
