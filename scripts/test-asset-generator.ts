/**
 * Asset Generator — Proof of Life Harness
 *
 * Runs the rebuilt Asset Generator end-to-end against live Firestore +
 * live OpenRouter + live DALL-E and prints every layer so you can verify
 * delegation is real.
 *
 * Usage:
 *   npx tsx scripts/test-asset-generator.ts
 *   npx tsx scripts/test-asset-generator.ts --case=canonical
 *   npx tsx scripts/test-asset-generator.ts --case=minimalist_finance
 *   npx tsx scripts/test-asset-generator.ts --case=playful_consumer
 *
 * Exit codes:
 *   0 — specialist returned COMPLETED, Zod validation passed
 *   1 — any step failed (GM missing, Brand DNA missing, LLM error, JSON/Zod failure)
 */

import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { getAssetGenerator, __internal } from '../src/lib/agents/builder/assets/specialist';
import { getActiveSpecialistGMByIndustry } from '../src/lib/training/specialist-golden-master-service';
import { getBrandDNA } from '../src/lib/brand/brand-dna-service';
import type {
  GenerateAssetPackageRequest,
  AssetPackageResult,
} from '../src/lib/agents/builder/assets/specialist';
import type { AgentMessage } from '../src/lib/agents/types';

// --------------------------------------------------------------------------
// Parse CLI flags
// --------------------------------------------------------------------------

type CaseName = 'canonical' | 'minimalist_finance' | 'playful_consumer';

interface CliFlags {
  caseName: CaseName;
}

function parseFlags(): CliFlags {
  const argv = process.argv.slice(2);
  let caseName: CaseName = 'canonical';
  for (const arg of argv) {
    if (arg.startsWith('--case=')) {
      const value = arg.slice('--case='.length);
      if (value === 'canonical' || value === 'minimalist_finance' || value === 'playful_consumer') {
        caseName = value;
      } else {
        console.error(`Unknown --case value: ${value}. Supported: canonical | minimalist_finance | playful_consumer`);
        process.exit(1);
      }
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: npx tsx scripts/test-asset-generator.ts [--case=canonical|minimalist_finance|playful_consumer]');
      process.exit(0);
    }
  }
  return { caseName };
}

// --------------------------------------------------------------------------
// Canned test inputs
// --------------------------------------------------------------------------

const CANNED_INPUTS: Record<CaseName, GenerateAssetPackageRequest> = {
  canonical: {
    action: 'generate_asset_package',
    brandName: 'SalesVelocity.ai',
    brandStyle: 'modern',
    industry: 'saas_sales_ops',
    brandColors: { primary: '#1E40AF', secondary: '#10B981', accent: '#F59E0B' },
    pages: [
      { id: 'home', name: 'Home' },
      { id: 'features', name: 'Features' },
      { id: 'pricing', name: 'Pricing' },
    ],
    tagline: 'Outbound sales, automated.',
    companyDescription: 'AI-powered sales operations platform for B2B teams.',
  },
  minimalist_finance: {
    action: 'generate_asset_package',
    brandName: 'Meridian Capital',
    brandStyle: 'minimalist',
    industry: 'finance',
    brandColors: { primary: '#0F172A', secondary: '#94A3B8' },
    pages: [
      { id: 'home', name: 'Home' },
      { id: 'wealth', name: 'Wealth Management' },
    ],
    tagline: 'Quiet confidence.',
    companyDescription: 'Private wealth advisory for high-net-worth individuals.',
  },
  playful_consumer: {
    action: 'generate_asset_package',
    brandName: 'Bloomberry',
    brandStyle: 'playful',
    industry: 'consumer_retail',
    brandColors: { primary: '#EC4899', secondary: '#FB923C', accent: '#FACC15' },
    pages: [],
    tagline: 'Snacks that smile back.',
    companyDescription: 'DTC better-for-you snack brand.',
  },
};

// --------------------------------------------------------------------------
// Pretty-printing helpers
// --------------------------------------------------------------------------

const hr = '═══════════════════════════════════════════════════════════════';
const dash = '───────────────────────────────────────────────────────────────';

function header(title: string): void {
  console.log(`\n${hr}`);
  console.log(title);
  console.log(hr);
}

function section(step: string): void {
  console.log(`\n${dash}`);
  console.log(step);
  console.log(dash);
}

function indent(text: string, spaces = 2): string {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map((line) => `${pad}${line}`).join('\n');
}

function truncateUrl(url: string, maxLen = 80): string {
  if (!url) {
    return '(empty)';
  }
  return url.length <= maxLen ? url : `${url.slice(0, maxLen)}…`;
}

function fail(step: string, err: unknown): never {
  console.error(`\n✗ FAILED at step: ${step}`);
  console.error(`  Reason: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) {
    console.error(indent(err.stack, 2));
  }
  process.exit(1);
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

async function main(): Promise<void> {
  const flags = parseFlags();
  const runStart = Date.now();

  header(`ASSET GENERATOR PROOF OF LIFE — ${new Date().toISOString()}`);
  console.log(`Case:        ${flags.caseName}`);
  console.log(`Industry:    ${__internal.DEFAULT_INDUSTRY_KEY}`);
  console.log(`Specialist:  ${__internal.SPECIALIST_ID}`);

  // -- Step 1: Load GM from Firestore --------------------------------------
  section('[1/7] LOADING GOLDEN MASTER FROM FIRESTORE');
  let gmRecord: Awaited<ReturnType<typeof getActiveSpecialistGMByIndustry>> = null;
  try {
    gmRecord = await getActiveSpecialistGMByIndustry(
      __internal.SPECIALIST_ID,
      __internal.DEFAULT_INDUSTRY_KEY,
    );
  } catch (err) {
    fail('Load GM', err);
  }
  if (!gmRecord) {
    fail('Load GM', new Error(
      `No active GM found for specialistId=${__internal.SPECIALIST_ID} industryKey=${__internal.DEFAULT_INDUSTRY_KEY}. ` +
      'Run "node scripts/seed-asset-generator-gm.js" first.',
    ));
  }
  console.log(`  ✓ Doc ID:       ${gmRecord.id}`);
  console.log(`  ✓ Version:      v${gmRecord.version}`);
  console.log(`  ✓ Deployed at:  ${gmRecord.deployedAt ?? '(not deployed)'}`);
  console.log(`  ✓ Created by:   ${gmRecord.createdBy}`);
  console.log(`  ✓ Created at:   ${gmRecord.createdAt}`);
  const gmConfig = gmRecord.config as Record<string, unknown>;
  const gmPrompt = typeof gmConfig.systemPrompt === 'string' ? gmConfig.systemPrompt : '';
  console.log(`  ✓ Model:        ${String(gmConfig.model ?? '(not set)')}`);
  console.log(`  ✓ Temperature:  ${String(gmConfig.temperature ?? '(not set)')}`);
  console.log(`  ✓ Max tokens:   ${String(gmConfig.maxTokens ?? '(not set)')}`);
  console.log(`  ✓ Prompt chars: ${gmPrompt.length}`);
  console.log(`  ✓ Notes:        ${gmRecord.notes ?? '(none)'}`);

  // -- Step 2: Load Brand DNA ----------------------------------------------
  section('[2/7] LOADING BRAND DNA');
  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    fail('Load Brand DNA', new Error(
      'Brand DNA not configured. Visit /settings/ai-agents/business-setup.',
    ));
  }
  console.log(`  ✓ Company:       ${brandDNA.companyDescription}`);
  console.log(`  ✓ Unique value:  ${brandDNA.uniqueValue}`);
  console.log(`  ✓ Tone:          ${brandDNA.toneOfVoice}`);
  console.log(`  ✓ Industry:      ${brandDNA.industry}`);
  console.log(`  ✓ Key phrases:   ${brandDNA.keyPhrases?.join(', ') || '(none)'}`);
  console.log(`  ✓ Avoid phrases: ${brandDNA.avoidPhrases?.join(', ') || '(none)'}`);
  console.log(`  ✓ Competitors:   ${brandDNA.competitors?.join(', ') || '(none)'}`);

  // -- Step 3: Build resolved system prompt --------------------------------
  section('[3/7] RESOLVED SYSTEM PROMPT (base GM + Brand DNA injection)');
  const resolvedPrompt = __internal.buildResolvedSystemPrompt(gmPrompt, brandDNA);
  console.log(indent(resolvedPrompt, 2));
  console.log(`\n  Resolved prompt length: ${resolvedPrompt.length} chars`);

  // -- Step 4: Build user prompt -------------------------------------------
  section('[4/7] USER PROMPT BUILT FROM INPUT');
  const input = CANNED_INPUTS[flags.caseName];
  const userPrompt = __internal.buildGenerateAssetPackageUserPrompt(input);
  console.log('  Input payload:');
  console.log(indent(JSON.stringify(input, null, 2), 4));
  console.log('\n  User prompt sent to LLM:');
  console.log(indent(userPrompt, 4));

  // -- Step 5: Call the specialist (real LLM + DALL-E invocation) ----------
  section('[5/7] CALLING ASSET GENERATOR (real OpenRouter + DALL-E invocation)');
  const specialist = getAssetGenerator();
  await specialist.initialize();

  const message: AgentMessage = {
    id: `harness_${flags.caseName}_${Date.now()}`,
    timestamp: new Date(),
    from: 'HARNESS',
    to: 'ASSET_GENERATOR',
    type: 'COMMAND',
    priority: 'NORMAL',
    payload: input,
    requiresResponse: true,
    traceId: `trace_harness_${Date.now()}`,
  };

  const llmStart = Date.now();
  const report = await specialist.execute(message);
  const llmDuration = Date.now() - llmStart;
  console.log(`  ✓ Specialist returned in ${llmDuration} ms`);
  console.log(`  ✓ AgentReport.status: ${report.status}`);
  console.log(`  ✓ AgentReport.agentId: ${report.agentId}`);
  console.log(`  ✓ AgentReport.taskId: ${report.taskId}`);

  if (report.status !== 'COMPLETED') {
    fail('Specialist execute', new Error(
      `Report status=${report.status}, errors=${JSON.stringify(report.errors ?? [])}`,
    ));
  }

  // -- Step 6: Zod validation -----------------------------------------------
  section('[6/7] ZOD SCHEMA VALIDATION (against the plan schema from the LLM)');
  // The specialist attaches generated URLs on top of the plan — so we
  // validate the underlying plan shape by stripping urls from the returned
  // data and feeding it back through the plan schema. This proves the LLM
  // itself produced a schema-legal plan.
  const data = report.data as AssetPackageResult | null;
  if (data === null) {
    fail('Zod validation', new Error('report.data was null'));
  }
  const planCandidate = {
    logo: {
      strategy: data.logo.strategy,
      variations: data.logo.variations.map((v) => ({
        name: v.name,
        layout: v.layout,
        prompt: v.prompt,
        dimensions: v.dimensions,
        altText: v.altText,
        rationale: v.rationale,
      })),
    },
    favicons: {
      strategy: data.favicons.strategy,
      prompt: data.favicons.prompt,
      dimensions: data.favicons.dimensions,
      altText: data.favicons.altText,
    },
    heroes: {
      strategy: data.heroes.strategy,
      variations: data.heroes.variations.map((v) => ({
        name: v.name,
        pageId: v.pageId,
        prompt: v.prompt,
        dimensions: v.dimensions,
        altText: v.altText,
        rationale: v.rationale,
      })),
    },
    socialGraphics: {
      strategy: data.socialGraphics.strategy,
      variations: data.socialGraphics.variations.map((v) => ({
        name: v.name,
        platform: v.platform,
        type: v.type,
        prompt: v.prompt,
        dimensions: v.dimensions,
        altText: v.altText,
        rationale: v.rationale,
      })),
    },
    banners: {
      strategy: data.banners.strategy,
      variations: data.banners.variations.map((v) => ({
        name: v.name,
        prompt: v.prompt,
        dimensions: v.dimensions,
        altText: v.altText,
        rationale: v.rationale,
      })),
    },
  };
  const validation = __internal.AssetPackagePlanSchema.safeParse(planCandidate);
  if (!validation.success) {
    fail('Zod validation', new Error(
      validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    ));
  }
  console.log('  ✓ Output matches AssetPackagePlanSchema');
  console.log(`  ✓ logo.variations=${data.logo.variations.length}`);
  console.log(`  ✓ heroes.variations=${data.heroes.variations.length}`);
  console.log(`  ✓ socialGraphics.variations=${data.socialGraphics.variations.length}`);
  console.log(`  ✓ banners.variations=${data.banners.variations.length}`);
  console.log(`  ✓ favicons.prompt length=${data.favicons.prompt.length}`);
  console.log(`  ✓ confidence=${data.confidence}`);

  // -- Step 7: Dump parsed result ------------------------------------------
  section('[7/7] PARSED AGENT REPORT DATA (counts + samples)');
  console.log(`  logo.strategy: ${data.logo.strategy}`);
  console.log(`  logo.variations: ${data.logo.variations.length}`);
  for (const v of data.logo.variations) {
    console.log(`    - ${v.name} (${v.layout}) url=${truncateUrl(v.url)}`);
  }
  console.log(`\n  favicons.strategy: ${data.favicons.strategy}`);
  console.log(`  favicons.prompt: ${data.favicons.prompt}`);
  console.log(`  favicons.icopUrl=${truncateUrl(data.favicons.icopUrl)}`);

  console.log(`\n  heroes.strategy: ${data.heroes.strategy}`);
  console.log(`  heroes.variations: ${data.heroes.variations.length}`);
  for (const v of data.heroes.variations) {
    console.log(`    - ${v.name} (pageId=${v.pageId}) url=${truncateUrl(v.url)}`);
  }

  console.log(`\n  socialGraphics.strategy: ${data.socialGraphics.strategy}`);
  console.log(`  socialGraphics.variations: ${data.socialGraphics.variations.length}`);
  for (const v of data.socialGraphics.variations) {
    console.log(`    - ${v.platform}/${v.type} ${v.name} url=${truncateUrl(v.url)}`);
  }

  console.log(`\n  banners.strategy: ${data.banners.strategy}`);
  console.log(`  banners.variations: ${data.banners.variations.length}`);
  for (const v of data.banners.variations) {
    console.log(`    - ${v.name} url=${truncateUrl(v.url)}`);
  }

  const logoPromptSamples = data.logo.variations.slice(0, 2);
  if (logoPromptSamples.length > 0) {
    console.log('\n  First 2 DALL-E logo prompts:');
    for (const v of logoPromptSamples) {
      console.log(`    [${v.name}] ${v.prompt}`);
    }
  }
  const heroPromptSamples = data.heroes.variations.slice(0, 2);
  if (heroPromptSamples.length > 0) {
    console.log('\n  First 2 DALL-E hero prompts:');
    for (const v of heroPromptSamples) {
      console.log(`    [${v.name} / ${v.pageId}] ${v.prompt}`);
    }
  }

  const logoUrlSamples = data.logo.variations.slice(0, 2);
  if (logoUrlSamples.length > 0) {
    console.log('\n  First 2 generated logo URLs:');
    for (const v of logoUrlSamples) {
      console.log(`    [${v.name}] ${truncateUrl(v.url)}`);
    }
  }

  // -- Summary --------------------------------------------------------------
  const totalMs = Date.now() - runStart;
  header('RESULT');
  console.log(`  Status:     COMPLETED`);
  console.log(`  Validation: PASS`);
  console.log(`  LLM + image call: ${llmDuration} ms`);
  console.log(`  Total run:  ${totalMs} ms`);
  console.log(hr);
}

main().catch((err) => {
  console.error('\n✗ Harness crashed:');
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
