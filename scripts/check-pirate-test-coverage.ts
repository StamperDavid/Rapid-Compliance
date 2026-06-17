/**
 * Pirate-Test Coverage Guard
 *
 * Makes it IMPOSSIBLE to add an LLM-backed agent without a corresponding
 * entry in the pirate GM-swap harness (scripts/pirate-test-specialists.ts).
 *
 * WHY: The pirate test is the only runtime proof that a specialist actually
 * reads its Golden Master from Firestore at request time (Standing Rule #1).
 * Any new LLM agent that ships without a pirate test is an unverified agent —
 * it could be ignoring its GM (and therefore its baked-in Brand DNA) and we
 * would never know. This build-time check fails the build if any LLM-backed
 * specialist/planner is missing pirate coverage.
 *
 * WHAT COUNTS as "an LLM-backed agent that must be pirate-tested":
 *   a `specialist.ts` or `planner.ts` file under src/lib/agents/** that imports
 *   `OpenRouterProvider` from '@/lib/ai/openrouter-provider'. Managers
 *   (manager.ts) and deterministic specialists that never call an LLM are not
 *   required (they have no GM-driven prose to swap).
 *
 * EXCLUSIONS (LLM-backed, but legitimately NOT in the execute()-based pirate
 * harness — each documented inline in EXCLUSIONS below):
 *   - ASSET_GENERATOR       — generates images, not prose; nothing to grep for
 *                             pirate markers in an image payload.
 *   - SHOT_PLAN_PLANNER     — planner.ts exports plain functions; it has no
 *                             execute()/factory the generic harness can call.
 *   - SCHEDULING_SPECIALIST — its LLM step only fires behind real CRM/meeting
 *                             I/O, so the standalone harness can't reach it.
 *
 * Usage:
 *   npx tsx scripts/check-pirate-test-coverage.ts          # enforce (exit 1 on gap)
 *   npx tsx scripts/check-pirate-test-coverage.ts --list   # classify only, never fail
 *
 * Exit code: 0 when every required LLM agent is covered, 1 when one or more
 * are missing (or when an ID cannot be extracted from an LLM file).
 */

/* eslint-disable no-console */

import * as fs from 'fs';
import * as path from 'path';

const AGENTS_ROOT = path.resolve(process.cwd(), 'src', 'lib', 'agents');
const PIRATE_TEST_FILE = path.resolve(process.cwd(), 'scripts', 'pirate-test-specialists.ts');

// Marks a file as LLM-backed. Matches the import regardless of quote style.
const OPENROUTER_IMPORT = /from\s+['"]@\/lib\/ai\/openrouter-provider['"]/;

// ID-extraction patterns, tried in order — first match wins per file.
// 1. const SPECIALIST_ID = 'FOO'
// 2. const AGENT_ID = 'FOO'
// 3. const specialistId = 'FOO'  (top-level, NOT the `specialistId:` property)
// 4. identity config fallback: `id: 'FOO'` (e.g. Growth Strategist's config object)
const ID_PATTERNS: ReadonlyArray<RegExp> = [
  /\bSPECIALIST_ID\s*=\s*'([A-Z0-9_]+)'/,
  /\bAGENT_ID\s*=\s*'([A-Z0-9_]+)'/,
  /\bspecialistId\s*=\s*'([A-Z0-9_]+)'/,
  /\bid:\s*'([A-Z0-9_]+)'/,
];

// LLM-backed IDs that are intentionally absent from the pirate harness.
// Keep the rationale next to each — this is the documented escape hatch.
const EXCLUSIONS: Readonly<Record<string, string>> = {
  // ASSET_GENERATOR, SHOT_PLAN_PLANNER, and SCHEDULING_SPECIALIST are now COVERED
  // via the `llmOnlyRun` override in scripts/pirate-test-specialists.ts (Jun 16
  // 2026): each exercises its GM-driven LLM step directly and greps the authored
  // prose for pirate markers. They are therefore no longer excluded.
};

interface LlmAgent {
  id: string;
  file: string; // absolute path
}

/** Recursively collect every specialist.ts / planner.ts under src/lib/agents. */
function collectAgentFiles(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') { continue; }
      collectAgentFiles(full, out);
    } else if (entry.isFile() && (entry.name === 'specialist.ts' || entry.name === 'planner.ts')) {
      out.push(full);
    }
  }
}

/** Return the agent ID for an LLM file, or null if none of the patterns match. */
function extractId(content: string): string | null {
  for (const pattern of ID_PATTERNS) {
    const match = pattern.exec(content);
    if (match) { return match[1]; }
  }
  return null;
}

/** Pull every `specialistId: '...'` value from the pirate TESTS array. */
function extractPirateTestedIds(pirateSource: string): Set<string> {
  const ids = new Set<string>();
  const re = /specialistId:\s*'([A-Z0-9_]+)'/g;
  let match: RegExpExecArray | null = re.exec(pirateSource);
  while (match !== null) {
    ids.add(match[1]);
    match = re.exec(pirateSource);
  }
  return ids;
}

function main(): void {
  const listOnly = process.argv.includes('--list');

  if (!fs.existsSync(AGENTS_ROOT)) {
    console.error(`Pirate-test guard: agents root not found at ${AGENTS_ROOT}`);
    process.exit(1);
  }
  if (!fs.existsSync(PIRATE_TEST_FILE)) {
    console.error(`Pirate-test guard: pirate test file not found at ${PIRATE_TEST_FILE}`);
    process.exit(1);
  }

  const agentFiles: string[] = [];
  collectAgentFiles(AGENTS_ROOT, agentFiles);

  const llmAgents: LlmAgent[] = [];
  const unextractable: string[] = [];

  for (const file of agentFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (!OPENROUTER_IMPORT.test(content)) { continue; } // not LLM-backed
    const id = extractId(content);
    if (id === null) {
      unextractable.push(file);
    } else {
      llmAgents.push({ id, file });
    }
  }

  // Hard fail if any LLM file has no extractable ID — we cannot reason about
  // coverage for an agent we can't name.
  if (unextractable.length > 0) {
    console.error('Pirate-test guard: FAILED to extract an agent ID from these LLM-backed files:\n');
    for (const f of unextractable) {
      console.error(`  ${path.relative(process.cwd(), f)}`);
    }
    console.error('\nAdd a `const SPECIALIST_ID = \'...\'` (or AGENT_ID / specialistId) to each, then re-run.');
    process.exit(1);
  }

  const pirateSource = fs.readFileSync(PIRATE_TEST_FILE, 'utf8');
  const tested = extractPirateTestedIds(pirateSource);

  // Classify.
  const excludedIds = new Set(Object.keys(EXCLUSIONS));
  const required = llmAgents.filter((a) => !excludedIds.has(a.id));
  const excluded = llmAgents.filter((a) => excludedIds.has(a.id));
  const missing = required.filter((a) => !tested.has(a.id));
  const covered = required.filter((a) => tested.has(a.id));

  if (listOnly) {
    console.log('Pirate-test coverage classification\n');
    console.log(`LLM-backed agents found: ${llmAgents.length}`);
    console.log(`\nCOVERED (${covered.length}):`);
    for (const a of covered.sort((x, y) => x.id.localeCompare(y.id))) {
      console.log(`  ✓ ${a.id}`);
    }
    console.log(`\nEXCLUDED (${excluded.length}):`);
    for (const a of excluded.sort((x, y) => x.id.localeCompare(y.id))) {
      console.log(`  - ${a.id} — ${EXCLUSIONS[a.id]}`);
    }
    console.log(`\nMISSING (${missing.length}):`);
    for (const a of missing.sort((x, y) => x.id.localeCompare(y.id))) {
      console.log(`  ✗ ${a.id} (${path.relative(process.cwd(), a.file)})`);
    }
    process.exit(0);
  }

  if (missing.length > 0) {
    console.error(`Pirate-test guard: ${missing.length} LLM-backed agent(s) have NO pirate test.\n`);
    console.error('Every LLM-backed specialist/planner must have a TestCase in');
    console.error('scripts/pirate-test-specialists.ts (proves it reads its GM at runtime).\n');
    for (const a of missing.sort((x, y) => x.id.localeCompare(y.id))) {
      console.error(`  ✗ ${a.id}`);
      console.error(`      ${path.relative(process.cwd(), a.file)}`);
    }
    console.error('\nFix: add a pirate TestCase for each ID above, or — if it is genuinely');
    console.error('not execute()-testable — add it to EXCLUSIONS in this script with a reason.');
    process.exit(1);
  }

  console.log('Pirate-test coverage: PASS');
  console.log(`  ${covered.length} LLM-backed agents covered, ${excluded.length} excluded by design.`);
  if (excluded.length > 0) {
    console.log(`  Excluded: ${excluded.map((a) => a.id).sort().join(', ')}`);
  }
  process.exit(0);
}

main();
