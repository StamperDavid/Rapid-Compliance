/**
 * Deterministic proof that the Brand DNA block-swap refreshes ONLY the baked
 * block and preserves everything else — most importantly any human training
 * edits in the base body (Standing Rule #2).
 *
 * No Firestore, no LLM. Builds a synthetic prompt = a fake base body (with a
 * simulated human training edit carrying a unique sentinel) + an old Brand DNA
 * block, swaps in a new block, and asserts the training edit survived, the new
 * brand voice is present, the old brand voice is gone, the block was not
 * double-baked, and replaced === true. Also proves the no-marker hard-skip.
 *
 * Usage: npx tsx scripts/verify-brand-rebake-swap.ts
 */

/* eslint-disable no-console */

import type { BrandDNA } from '@/lib/brand/brand-dna-service';
import { buildBrandDNABlock, swapBrandDNABlock } from '@/lib/brand/rebake-brand-dna';

const MARKER = '## Brand DNA (baked into the Golden Master at seed time';
const SENTINEL = 'TRAINING_EDIT_SENTINEL_xyz';

let failures = 0;

function assert(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  ✅ PASS  ${label}`);
  } else {
    console.log(`  ❌ FAIL  ${label}`);
    failures += 1;
  }
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) { break; }
    count += 1;
    from = idx + needle.length;
  }
  return count;
}

const oldDNA: BrandDNA = {
  companyDescription: 'OldCo, a legacy fax-machine reseller',
  uniqueValue: 'Fastest fax delivery in the tri-state area',
  targetAudience: 'Office managers who love paper',
  toneOfVoice: 'STODGY_OLD_TONE_VALUE',
  communicationStyle: 'Formal and verbose',
  keyPhrases: ['dial tone', 'paper jam'],
  avoidPhrases: ['cloud'],
  industry: 'Office equipment',
  competitors: ['FaxRivalCo'],
};

const newDNA: BrandDNA = {
  companyDescription: 'SalesVelocity.ai, a modern revenue platform',
  uniqueValue: 'AI swarm that runs your whole funnel',
  targetAudience: 'B2B SaaS founders and revenue leaders',
  toneOfVoice: 'CRISP_MODERN_TONE_VALUE',
  communicationStyle: 'Direct, confident, plain English',
  keyPhrases: ['revenue velocity', 'agent swarm'],
  avoidPhrases: ['synergy'],
  industry: 'B2B SaaS revenue ops',
  competitors: ['SomeBrokerTool'],
};

// Synthetic base body that INCLUDES a simulated human training edit (a
// "## How you write" section carrying the unique sentinel). This is exactly
// the kind of content the Prompt Engineer surgically edits and that the swap
// must never touch.
const baseBody = [
  '# CopywriterSpecialist — Golden Master',
  '',
  'You write conversion copy for the tenant.',
  '',
  '## How you write',
  `When in doubt, lead with the customer's pain. ${SENTINEL} Always end on a single clear CTA.`,
  '',
  '## Your tools',
  'You may call save_blog_draft and propose_social_post.',
].join('\n');

const prompt = baseBody + '\n\n' + buildBrandDNABlock(oldDNA);

console.log('\n=== Brand DNA re-bake swap — deterministic proof ===\n');

console.log('Test 1: swap old block → new block on a prompt with a training edit');
const { newPrompt, replaced } = swapBrandDNABlock(prompt, buildBrandDNABlock(newDNA));

assert('(a) training edit sentinel SURVIVED the swap (Standing Rule #2)', newPrompt.includes(SENTINEL));
assert('(a2) full "## How you write" section preserved verbatim', newPrompt.includes(
  `When in doubt, lead with the customer's pain. ${SENTINEL} Always end on a single clear CTA.`,
));
assert("(b) new DNA tone present", newPrompt.includes('CRISP_MODERN_TONE_VALUE'));
assert('(b2) new DNA company present', newPrompt.includes('SalesVelocity.ai, a modern revenue platform'));
assert('(b3) new DNA key phrases present', newPrompt.includes('revenue velocity, agent swarm'));
assert('(c) old DNA tone REMOVED', !newPrompt.includes('STODGY_OLD_TONE_VALUE'));
assert('(c2) old DNA company REMOVED', !newPrompt.includes('OldCo, a legacy fax-machine reseller'));
assert('(d) exactly ONE Brand DNA marker (no double-bake)', countOccurrences(newPrompt, MARKER) === 1);
assert('(e) replaced === true', replaced === true);

// The body before the marker must be byte-identical to the original baseBody.
const idx = newPrompt.indexOf(MARKER);
const bodyBefore = newPrompt.slice(0, idx);
const originalBodyBefore = prompt.slice(0, prompt.indexOf(MARKER));
assert('(f) everything before the marker is byte-identical to the original', bodyBefore === originalBodyBefore);

console.log('\nTest 2: no-marker prompt → hard skip (replaced === false, unchanged)');
const noMarkerPrompt = 'Just a base prompt with no Brand DNA block at all.';
const noMarkerResult = swapBrandDNABlock(noMarkerPrompt, buildBrandDNABlock(newDNA));
assert('replaced === false', noMarkerResult.replaced === false);
assert('prompt returned unchanged', noMarkerResult.newPrompt === noMarkerPrompt);
assert('no block appended (no marker present)', !noMarkerResult.newPrompt.includes(MARKER));

console.log('\nTest 3: newBlock without marker → throws (programmer error guard)');
let threw = false;
try {
  swapBrandDNABlock(prompt, 'a block with no marker');
} catch {
  threw = true;
}
assert('swapBrandDNABlock threw on a markerless newBlock', threw);

console.log('\n===================================================');
if (failures === 0) {
  console.log('ALL ASSERTIONS PASSED ✅');
  process.exit(0);
} else {
  console.log(`${failures} ASSERTION(S) FAILED ❌`);
  process.exit(1);
}
