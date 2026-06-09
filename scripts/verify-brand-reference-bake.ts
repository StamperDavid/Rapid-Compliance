/**
 * Verify: brand reference materials bake into the Brand DNA block, and the JS
 * (scripts/lib/brand-dna-helper.js) and TS (src/lib/brand/rebake-brand-dna.ts)
 * `buildBrandDNABlock` implementations remain BYTE-IDENTICAL.
 *
 * The surgical re-bake (`swapBrandDNABlock`) replaces the trailing Brand DNA block
 * with a freshly-built one. If the JS seed helper and the TS runtime re-bake ever
 * drift, a seeded GM and a re-baked GM would carry different blocks. This proves:
 *   1. assembleBrandReferenceText turns reference assets into the expected lines.
 *   2. buildBrandDNABlock (TS) includes the "## Brand Reference Examples" subsection
 *      when referenceExamples is present, and OMITS it when absent.
 *   3. The JS helper produces a byte-identical block (with and without references).
 *
 * Pure functions only — no Firestore, no network. Run: npx tsx scripts/verify-brand-reference-bake.ts
 */

/* eslint-disable no-console */

import { buildBrandDNABlock } from '../src/lib/brand/rebake-brand-dna';
import { assembleBrandReferenceText } from '../src/lib/brand/brand-identity-bridges';
import type { BrandDNA } from '../src/lib/brand/brand-dna-service';
import type { BrandExampleAsset } from '../src/types/brand-identity';

/* eslint-disable-next-line @typescript-eslint/no-require-imports */
const jsHelper = require('./lib/brand-dna-helper.js') as {
  buildBrandDNABlock: (dna: Record<string, unknown>) => string;
};

let failures = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    console.log(`  ✅ ${name}`);
  } else {
    console.log(`  ❌ ${name}`);
    failures += 1;
  }
}

const baseDNA: BrandDNA = {
  companyDescription: 'SalesVelocity.ai — an AI sales platform',
  uniqueValue: 'One operator runs a whole revenue team',
  targetAudience: 'SMB founders',
  toneOfVoice: 'confident, plain-spoken',
  communicationStyle: 'direct and helpful',
  keyPhrases: ['Accelerate your growth'],
  avoidPhrases: ['synergy'],
  industry: 'SaaS',
  competitors: ['HubSpot'],
};

const assets: BrandExampleAsset[] = [
  {
    id: '1', url: 'https://x/a.png', fileName: 'launch-ad.png', contentType: 'image/png',
    kind: 'image', description: '2025 product launch ad', purpose: 'example of prior marketing', uploadedAt: 't',
  },
  {
    id: '2', url: 'https://x/g.pdf', fileName: 'guidelines.pdf', contentType: 'application/pdf',
    kind: 'document', description: 'Brand guidelines', purpose: 'the rules to follow', uploadedAt: 't',
  },
];

console.log('1) assembleBrandReferenceText');
const refText = assembleBrandReferenceText(assets);
check('includes the first asset description', refText.includes('2025 product launch ad'));
check('includes the purpose', refText.includes('why it matters: example of prior marketing'));
check('tags the kind', refText.includes('(image)') && refText.includes('(document)'));
check('empty array → empty string', assembleBrandReferenceText([]) === '');

console.log('\n2) buildBrandDNABlock (TS) WITH references');
const withRefs: BrandDNA = { ...baseDNA, referenceExamples: refText };
const tsWith = buildBrandDNABlock(withRefs);
check('contains the Brand Reference Examples header', tsWith.includes('## Brand Reference Examples'));
check('contains the assembled reference lines', tsWith.includes('2025 product launch ad'));

console.log('\n3) buildBrandDNABlock (TS) WITHOUT references');
const tsWithout = buildBrandDNABlock(baseDNA);
check('omits the header when no references', !tsWithout.includes('## Brand Reference Examples'));

console.log('\n4) JS/TS byte-parity (critical for the surgical swap)');
const jsWith = jsHelper.buildBrandDNABlock({ ...withRefs });
const jsWithout = jsHelper.buildBrandDNABlock({ ...baseDNA });
check('WITH references: JS === TS', jsWith === tsWith);
check('WITHOUT references: JS === TS', jsWithout === tsWithout);

console.log('\n========================================');
console.log(failures === 0 ? '  ALL CHECKS PASSED' : `  ${failures} CHECK(S) FAILED`);
console.log('========================================');
process.exit(failures === 0 ? 0 : 1);
