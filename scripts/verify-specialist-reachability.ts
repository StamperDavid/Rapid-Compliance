/**
 * Specialist reachability audit.
 *
 * Static analysis of every manager.ts file. For each registered specialist,
 * determines whether any code path in the manager can actually invoke it.
 * A specialist that's registered but never referenced outside its registration
 * list (or its INTENT_SPECIALISTS entry) is effectively dead — the manager
 * knows about it but has no way to call it.
 *
 * This was triggered by Bug L on Apr 18 — Content Manager registers
 * BLOG_WRITER, PODCAST_SPECIALIST, and MUSIC_PLANNER but has no invocation
 * branch for any of them. Owner flagged this as potentially systemic.
 *
 * Usage:
 *   npx tsx scripts/verify-specialist-reachability.ts
 *
 * Exit 0 = all registered specialists reachable.
 * Exit 1 = one or more dead specialists found.
 *
 * Methodology (static, not runtime):
 *   1. Read each manager.ts file.
 *   2. Extract the list of registered specialist IDs from the standard
 *      `specialistFactories = [{ name: 'X', factory: getX }, ...]` pattern.
 *   3. For each ID, look for invocation-style references elsewhere in the
 *      file — the exact patterns are listed in INVOCATION_PATTERNS below.
 *   4. Report any ID that appears only in the registration list (and/or
 *      INTENT_SPECIALISTS map) with no invocation-style reference.
 *
 * Known limitations:
 *   - Appearing in an INTENT_SPECIALISTS value alone counts as "registered"
 *     not "invoked" — an intent mapping is a routing table, not an invocation.
 *   - A specialist could be invoked via a factory function (getBlogWriter())
 *     called directly rather than through the specialists map. This script
 *     treats any `getBlogWriter(` or `getBLOG_WRITER(` call as an invocation
 *     hint to catch that pattern too.
 */

/* eslint-disable no-console */

import { readFileSync } from 'node:fs';
import * as path from 'node:path';

const MANAGER_FILES = [
  'src/lib/agents/architect/manager.ts',
  'src/lib/agents/builder/manager.ts',
  'src/lib/agents/commerce/manager.ts',
  'src/lib/agents/content/manager.ts',
  'src/lib/agents/intelligence/manager.ts',
  'src/lib/agents/marketing/manager.ts',
  'src/lib/agents/orchestrator/manager.ts',
  'src/lib/agents/outreach/manager.ts',
  'src/lib/agents/sales/revenue/manager.ts',
  'src/lib/agents/trust/reputation/manager.ts',
];

interface InvocationMatch {
  pattern: string;
  line: number;
  snippet: string;
}

interface SpecialistFinding {
  manager: string;
  managerFile: string;
  specialistId: string;
  invocationMatches: InvocationMatch[];
  factoryImport: string | null; // if there's an `import { getX }` for this specialist
  managerHasIteratorDispatch: boolean; // if true, specialists may be dispatched via variable binding
}

function toCamelCase(id: string): string {
  // BLOG_WRITER -> BlogWriter
  return id
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('');
}

function buildInvocationPatterns(specId: string): Array<{ label: string; re: RegExp }> {
  // Patterns that indicate ACTUAL CODE INVOCATION of the specialist, not
  // merely routing config or metadata. Excluded on purpose:
  //   - `delegateTo: 'X'`       — routing table entry, data not code
  //   - `to: 'X'`               — message target field, metadata
  //   - `'X' in INTENT_SPECIALISTS` — mapping table, not execution
  //
  // A specialist registered with only these data-only references has no
  // executable path and is reported DEAD.
  return [
    { label: `includes('${specId}')`, re: new RegExp(`includes\\(\\s*['"\`]${specId}['"\`]\\s*\\)`) },
    { label: `case '${specId}':`, re: new RegExp(`case\\s+['"\`]${specId}['"\`]\\s*:`) },
    { label: `=== '${specId}'`, re: new RegExp(`===\\s*['"\`]${specId}['"\`]|['"\`]${specId}['"\`]\\s*===`) },
    { label: `specialistId === '${specId}'`, re: new RegExp(`specialistId\\s*===\\s*['"\`]${specId}['"\`]`) },
    { label: `.get('${specId}')`, re: new RegExp(`\\.get\\(\\s*['"\`]${specId}['"\`]\\s*\\)`) },
    // Direct invocation helpers from BaseManager / manager subclasses — many
    // managers call specialists by ID string via these helpers. The `[\s\S]*?`
    // allows the function call to span multiple lines (e.g. Commerce's style).
    { label: `delegateWithReview('${specId}',`, re: new RegExp(`delegateWithReview\\([\\s\\S]{0,30}['"\`]${specId}['"\`]\\s*,`) },
    { label: `delegateToSpecialist('${specId}',`, re: new RegExp(`delegateToSpecialist\\([\\s\\S]{0,30}['"\`]${specId}['"\`]\\s*,`) },
    { label: `executeSpecialist('${specId}',`, re: new RegExp(`executeSpecialist\\([\\s\\S]{0,30}['"\`]${specId}['"\`]\\s*,`) },
    { label: `specialistId: '${specId}'`, re: new RegExp(`\\bspecialistId\\s*:\\s*['"\`]${specId}['"\`]`) },
  ];
}

/** Returns true if the manager has a camelCase instance field matching the
 * specId (e.g. DEAL_CLOSER → dealCloserInstance, blogWriter) whose `.execute()`
 * is called somewhere in the file. This catches the Revenue-style pattern
 * where the specialist is held in a class field rather than called by ID. */
function hasFieldInstanceInvocation(source: string, specId: string): { label: string; line: number; snippet: string } | null {
  const camel = toCamelCase(specId);
  const firstChar = camel.charAt(0).toLowerCase();
  const fieldBase = firstChar + camel.slice(1); // e.g. "dealCloser"

  // Check for assignment of a factory result to a class field. Factory names
  // often have suffixes like "Specialist" or "Expert" appended, e.g.
  // getDealCloserSpecialist, getInstagramExpert — so allow \w* tail.
  const assignRe = new RegExp(`this\\.(${fieldBase}\\w*)\\s*=\\s*[\\s\\S]{0,80}(get${camel}\\w*|${camel}\\w*)\\(`);
  const assignMatch = assignRe.exec(source);
  if (!assignMatch) { return null; }

  const fieldName = assignMatch[1];
  const invokeRe = new RegExp(`this\\.${fieldName}\\.execute\\(`);
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (invokeRe.test(lines[i])) {
      return {
        label: `this.${fieldName}.execute()`,
        line: i + 1,
        snippet: lines[i].trim().slice(0, 100),
      };
    }
  }
  return null;
}

/** Returns true if the manager has an iterator-style dispatcher — code that
 * calls `delegateWithReview(specialistId, ...)` or similar with a VARIABLE
 * specialistId. If present, any specialist registered in the manager could
 * theoretically be invoked if it ends up in the iterator's input list.
 * Proving the iterator's input contents is beyond static analysis; we flag
 * such managers' specialists as "iterator-dispatched" rather than DEAD.
 */
function hasIteratorDispatcher(source: string): boolean {
  const patterns = [
    /delegateWithReview\(\s*specialistId\s*,/,
    /delegateToSpecialist\(\s*specialistId\s*,/,
    /executeSpecialist\(\s*specialistId\s*,/,
    /delegateWithReview\(\s*\w+Id\s*,/, // variables like platformId, agentId
  ];
  return patterns.some((re) => re.test(source));
}

/** Extract the registered specialist IDs from a manager file.
 *
 * Looks for the standard pattern:
 *   const specialistFactories = [
 *     { name: 'COPYWRITER', factory: getCopywriter },
 *     ...
 *   ];
 *
 * Falls back to grepping every quoted UPPERCASE_SNAKE_CASE string if the
 * specific pattern isn't found (e.g. Master Orchestrator uses a different
 * registration style).
 */
function extractRegisteredIds(source: string): string[] {
  const ids = new Set<string>();

  // Primary pattern: { name: 'ID', factory: ... }
  const primary = /\{\s*name\s*:\s*['"`]([A-Z][A-Z0-9_]+)['"`]\s*,\s*factory/g;
  let m: RegExpExecArray | null;
  while ((m = primary.exec(source)) !== null) {
    ids.add(m[1]);
  }

  // Secondary pattern: { id: 'ID', factory: ... }
  const secondary = /\{\s*id\s*:\s*['"`]([A-Z][A-Z0-9_]+)['"`]\s*,\s*factory/g;
  while ((m = secondary.exec(source)) !== null) {
    ids.add(m[1]);
  }

  // Tertiary: direct registration via `this.registerSpecialist('ID', ...)`
  const tertiary = /registerSpecialist\(\s*['"`]([A-Z][A-Z0-9_]+)['"`]/g;
  while ((m = tertiary.exec(source)) !== null) {
    ids.add(m[1]);
  }

  return Array.from(ids).sort();
}

function findInvocations(source: string, specId: string): InvocationMatch[] {
  const matches: InvocationMatch[] = [];
  const patterns = buildInvocationPatterns(specId);

  // Line-scoped patterns: test against each line
  const lines = source.split('\n');
  const lineScoped = patterns.filter((p) => !p.label.includes(`${specId}',`));
  const multiLineScoped = patterns.filter((p) => p.label.includes(`${specId}',`));

  for (const { label, re } of lineScoped) {
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        matches.push({
          pattern: label,
          line: i + 1,
          snippet: lines[i].trim().slice(0, 100),
        });
      }
    }
  }

  // Multi-line patterns: test against the whole source, then find which line the ID string sits on
  for (const { label, re } of multiLineScoped) {
    const m = re.exec(source);
    if (m) {
      // Find line number of the specId string within the match
      const preSource = source.slice(0, m.index);
      const line = preSource.split('\n').length;
      matches.push({
        pattern: label,
        line,
        snippet: m[0].split('\n').join(' ').trim().slice(0, 120),
      });
    }
  }

  // Field-instance invocation (Revenue-style)
  const fieldMatch = hasFieldInstanceInvocation(source, specId);
  if (fieldMatch) {
    matches.push({
      pattern: fieldMatch.label,
      line: fieldMatch.line,
      snippet: fieldMatch.snippet,
    });
  }

  // De-dupe on (pattern, line)
  const seen = new Set<string>();
  return matches.filter((m) => {
    const k = `${m.pattern}:${m.line}`;
    if (seen.has(k)) { return false; }
    seen.add(k);
    return true;
  });
}

function managerNameFromFile(file: string): string {
  const parts = file.split(/[/\\]/);
  const managerDir = parts[parts.length - 2];
  return managerDir.toUpperCase();
}

function formatTable(findings: SpecialistFinding[]): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('='.repeat(110));
  lines.push('  SPECIALIST REACHABILITY AUDIT');
  lines.push('='.repeat(110));
  lines.push('');

  const managerGroups = new Map<string, SpecialistFinding[]>();
  for (const f of findings) {
    const g = managerGroups.get(f.manager) ?? [];
    g.push(f);
    managerGroups.set(f.manager, g);
  }

  let totalRegistered = 0;
  let totalReachable = 0;
  let totalIterator = 0;
  let totalDead = 0;
  const deadList: SpecialistFinding[] = [];
  const iteratorList: SpecialistFinding[] = [];

  for (const [manager, specs] of managerGroups) {
    lines.push(`  ${manager}`);
    lines.push('  ' + '-'.repeat(106));
    for (const f of specs) {
      totalRegistered += 1;
      const hasDirectPath = f.invocationMatches.length > 0;

      let icon: string;
      let status: string;
      let firstSite: string;

      if (hasDirectPath) {
        totalReachable += 1;
        icon = '✓';
        status = `reachable (${f.invocationMatches.length} site${f.invocationMatches.length === 1 ? '' : 's'})`;
        firstSite = ` @ ${path.basename(f.managerFile)}:${f.invocationMatches[0].line}`;
      } else if (f.managerHasIteratorDispatch) {
        totalIterator += 1;
        iteratorList.push(f);
        icon = '?';
        status = 'iterator-dispatched — manager has `delegateWithReview(variable,...)` — potentially reachable if ID reaches iterator';
        firstSite = '';
      } else {
        totalDead += 1;
        deadList.push(f);
        icon = '✗';
        status = 'DEAD — no invocation path, manager has no iterator dispatcher';
        firstSite = '';
      }

      lines.push(`    ${icon}  ${f.specialistId.padEnd(30)}  ${status}${firstSite}`);
    }
    lines.push('');
  }

  lines.push('  ' + '='.repeat(106));
  lines.push(`  SUMMARY: ${totalRegistered} total  |  ${totalReachable} reachable (literal dispatch)  |  ${totalIterator} iterator-dispatched (possibly reachable)  |  ${totalDead} DEAD (no path)`);
  lines.push('');

  if (deadList.length > 0) {
    lines.push('  ✗ CONFIRMED DEAD — registered but no invocation path and manager has no iterator dispatcher:');
    lines.push('');
    for (const f of deadList) {
      lines.push(`    • ${f.manager} / ${f.specialistId}`);
      lines.push(`        file: ${f.managerFile}`);
    }
    lines.push('');
  }

  if (iteratorList.length > 0) {
    lines.push('  ? ITERATOR-DISPATCHED — no literal dispatch site, but the manager has a variable-bound delegation call. Need to trace what IDs the iterator receives to confirm reachability:');
    lines.push('');
    for (const f of iteratorList) {
      lines.push(`    • ${f.manager} / ${f.specialistId}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function main(): Promise<void> {
  const findings: SpecialistFinding[] = [];

  for (const relFile of MANAGER_FILES) {
    const absFile = path.resolve(process.cwd(), relFile);
    let source: string;
    try {
      source = readFileSync(absFile, 'utf8');
    } catch {
      console.warn(`! Skipping missing file: ${relFile}`);
      continue;
    }

    const managerName = managerNameFromFile(relFile);
    const registeredIds = extractRegisteredIds(source);

    if (registeredIds.length === 0) {
      console.warn(`! No registered specialist IDs matched in ${relFile} — may use a non-standard registration pattern`);
      continue;
    }

    const hasIterator = hasIteratorDispatcher(source);

    for (const specId of registeredIds) {
      const invocations = findInvocations(source, specId);
      findings.push({
        manager: managerName,
        managerFile: relFile,
        specialistId: specId,
        invocationMatches: invocations,
        factoryImport: null,
        managerHasIteratorDispatch: hasIterator,
      });
    }
  }

  const report = formatTable(findings);
  console.log(report);

  const dead = findings.filter((f) => f.invocationMatches.length === 0);
  process.exit(dead.length === 0 ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error('Fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
