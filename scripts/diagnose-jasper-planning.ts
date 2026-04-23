/**
 * Deep diagnostic for Jasper's planning flakiness on specific prompts.
 *
 * For each failing prompt, runs the full "matrix-style" call (expander +
 * Jasper with forced propose_mission_plan) 15 times and dumps:
 *   - Intent Expander queryType
 *   - Whether propose_mission_plan was called
 *   - The RAW plan args JSON
 *   - How many steps it had
 *   - Every step's toolName (or missing if malformed)
 *   - Any text content Jasper wrote alongside
 *
 * Used to pinpoint exactly where Jasper's plan generation is failing on
 * otherwise-action-class prompts.
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

import { OpenRouterProvider } from '../src/lib/ai/openrouter-provider';
import { getActiveJasperGoldenMaster, invalidateJasperGMCache } from '../src/lib/orchestrator/jasper-golden-master';
import { JASPER_TOOLS } from '../src/lib/orchestrator/jasper-tools';
import { PLATFORM_ID } from '../src/lib/constants/platform';
import { expandIntent } from '../src/lib/orchestrator/intent-expander';

const FAILING_PROMPTS = [
  { id: 'reputation-001', prompt: 'Draft a response to this 1-star Google review: \'Terrible onboarding, nothing worked.\'' },
  { id: 'voice-002',      prompt: 'Set Jasper up in prospector mode to handle inbound calls about our starter plan.' },
  { id: 'forms-001',      prompt: 'Create a contact form for the homepage with name, email, company, and message fields.' },
  { id: 'multi-001',      prompt: 'Create a blog post AND 5 social media posts about the benefits of AI-powered lead scoring for B2B sales teams.' },
];

const ITERATIONS = 15;

async function main(): Promise<void> {
  invalidateJasperGMCache();
  const gm = await getActiveJasperGoldenMaster();
  if (!gm) { throw new Error('No active Jasper GM'); }
  console.log(`Jasper GM: ${gm.id} v${gm.version} (${gm.systemPrompt.length} chars)\n`);

  for (const fixture of FAILING_PROMPTS) {
    console.log(`\n═══════════════════════════════════════════════════════════════════`);
    console.log(`  ${fixture.id}`);
    console.log(`  "${fixture.prompt}"`);
    console.log(`═══════════════════════════════════════════════════════════════════`);

    let emptyPlanCount = 0;
    let goodPlanCount = 0;

    for (let i = 1; i <= ITERATIONS; i++) {
      const expanded = await expandIntent(fixture.prompt);
      const qt = expanded?.queryType ?? 'null';

      const provider = new OpenRouterProvider(PLATFORM_ID);
      const response = await provider.chatWithTools({
        model: 'claude-sonnet-4' as Parameters<typeof provider.chatWithTools>[0]['model'],
        messages: [
          { role: 'system', content: gm.systemPrompt },
          { role: 'user', content: fixture.prompt },
        ],
        tools: JASPER_TOOLS,
        toolChoice: { type: 'function' as const, function: { name: 'propose_mission_plan' } },
        temperature: 0.7,
        maxTokens: 4000,
      });

      const planCall = response.toolCalls?.find((tc) => tc.function.name === 'propose_mission_plan');
      const textLen = (response.content ?? '').length;

      if (!planCall) {
        console.log(`  iter ${String(i).padStart(2)}  qt=${qt.padEnd(10)} ✗ NO plan call. text=${textLen}ch`);
        emptyPlanCount++;
        continue;
      }

      let parsed: unknown;
      let parseError = '';
      try {
        parsed = JSON.parse(planCall.function.arguments);
      } catch (err) {
        parseError = err instanceof Error ? err.message : String(err);
      }

      if (parseError) {
        console.log(`  iter ${String(i).padStart(2)}  qt=${qt.padEnd(10)} ✗ parse error: ${parseError}`);
        console.log(`      raw (first 300ch): ${planCall.function.arguments.slice(0, 300)}`);
        emptyPlanCount++;
        continue;
      }

      const steps = (parsed as { steps?: unknown[] }).steps;
      if (!Array.isArray(steps) || steps.length === 0) {
        console.log(`  iter ${String(i).padStart(2)}  qt=${qt.padEnd(10)} ✗ EMPTY plan. steps=${JSON.stringify(steps)}`);
        console.log(`      raw (first 500ch): ${planCall.function.arguments.slice(0, 500)}`);
        emptyPlanCount++;
        continue;
      }

      const toolNames: string[] = [];
      for (const s of steps) {
        const obj = s as Record<string, unknown>;
        toolNames.push(typeof obj.toolName === 'string' ? obj.toolName : `(bad-shape:${JSON.stringify(Object.keys(obj))})`);
      }
      console.log(`  iter ${String(i).padStart(2)}  qt=${qt.padEnd(10)} ✓ ${steps.length} step${steps.length === 1 ? '' : 's'}: [${toolNames.join(', ')}]`);
      goodPlanCount++;
    }

    console.log(`\n  Summary: ${goodPlanCount}/${ITERATIONS} good plans, ${emptyPlanCount}/${ITERATIONS} empty/malformed`);
  }
}

main().catch((err) => {
  console.error('Diagnostic failed:', err);
  process.exit(1);
});
