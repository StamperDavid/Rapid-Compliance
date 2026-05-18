/**
 * Standing Rule #1 Guard
 *
 * Forbids runtime calls to `getBrandDNA()` in agent/runtime code. Brand DNA
 * must be read from `gm.brandDNASnapshot` after loading the agent's own
 * Golden Master — never fetched from the live org doc at request time.
 *
 * Forbidden directories: code that runs at request time or feeds an LLM.
 * Allowed directories: seed-time scripts, the brand-dna-service itself,
 * training routes that create new GM versions, and the settings UI that
 * displays Brand DNA to the operator.
 *
 * Cross-platform (Windows, Mac, Linux). Exit 1 on violation.
 */

const fs = require('fs');
const path = require('path');

const FORBIDDEN_DIRS = [
  'src/lib/agents',
  'src/lib/orchestrator',
  'src/lib/social',
  'src/app/api/cron',
  'src/app/api/content',
];

// Files / dirs that may legitimately reference getBrandDNA at runtime
const ALLOWED_PATTERNS = [
  'src/lib/brand/brand-dna-service.ts',
  'src/app/api/training/',
  'src/app/(dashboard)/settings/ai-agents/business-setup',
  'src/components/business-setup/',
];

const FORBIDDEN_PATTERN = /\bgetBrandDNA\s*\(/;

// Matches lines that are entirely comments — JSDoc, single-line, block-continuation
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*)/;

function isAllowed(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return ALLOWED_PATTERNS.some((p) => normalized.includes(p));
}

function walk(dir, hits) {
  if (!fs.existsSync(dir)) { return; }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') { continue; }
      walk(full, hits);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      if (isAllowed(full)) { continue; }
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (COMMENT_LINE.test(line)) { return; }
        if (FORBIDDEN_PATTERN.test(line)) {
          hits.push({ file: full, line: idx + 1, snippet: line.trim() });
        }
      });
    }
  }
}

const hits = [];
for (const dir of FORBIDDEN_DIRS) {
  walk(dir, hits);
}

if (hits.length === 0) {
  console.log('Standing Rule #1: PASS — no runtime getBrandDNA() calls in forbidden directories.');
  process.exit(0);
}

console.error(`Standing Rule #1 VIOLATION: ${hits.length} runtime getBrandDNA() call(s) found in forbidden directories.\n`);
console.error('Brand DNA must be read from gm.brandDNASnapshot (loaded once per request from the agent\'s own GM), not from the live org doc.\n');
for (const hit of hits) {
  console.error(`  ${hit.file}:${hit.line}`);
  console.error(`    ${hit.snippet}`);
}
console.error('\nFix: replace getBrandDNA() with a read from the appropriate GM\'s brandDNASnapshot via getActiveManagerGMByIndustry or getActiveSpecialistGMByIndustry.');
process.exit(1);
