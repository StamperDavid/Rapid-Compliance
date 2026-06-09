/**
 * Brand DNA re-bake core — pure, testable block-swap.
 *
 * STANDING RULE #1 (CLAUDE.md): every Golden Master has the tenant's Brand DNA
 * baked into its `config.systemPrompt` AT SEED TIME — the GM doc IS the complete
 * agent identity. When Brand DNA is edited in Settings, the baked block in every
 * GM must be refreshed.
 *
 * This module is the SURGICAL core of that refresh: it swaps ONLY the trailing
 * Brand DNA block, leaving everything before the block — the industry base body
 * AND any human training edits the Prompt Engineer has made (Standing Rule #2) —
 * byte-for-byte intact.
 *
 * The functions here are pure: no Firestore, no LLM, no I/O. They are a faithful
 * TS port of `scripts/lib/brand-dna-helper.js` so the re-baked block is identical
 * to what a fresh seed would produce. If the JS helper's block format ever
 * changes, change `buildBrandDNABlock` here in lock-step.
 *
 * @module brand/rebake-brand-dna
 */

import type { BrandDNA } from '@/lib/brand/brand-dna-service';

/**
 * The exact marker line that opens the Brand DNA block. Because the helper
 * always appends the block as the TRAILING segment of the systemPrompt, this
 * marker locates where the base body / training edits end and the baked Brand
 * DNA begins. Must match `buildBrandDNABlock` (here and in the JS helper)
 * byte-for-byte.
 */
const MARKER = '## Brand DNA (baked into the Golden Master at seed time';

/**
 * Build the "## Brand DNA" block as a multi-line string.
 *
 * Faithful TS port of `buildBrandDNABlock` in `scripts/lib/brand-dna-helper.js`
 * — same marker, same field lines, same '(none configured)'/'(not set)'
 * fallbacks, same leading blank line + `\n` join. The output (when appended to
 * a base prompt with a single `\n` separator) reproduces exactly what a fresh
 * seed bakes in.
 */
export function buildBrandDNABlock(brandDNA: BrandDNA): string {
  const keyPhrases = Array.isArray(brandDNA.keyPhrases) && brandDNA.keyPhrases.length > 0
    ? brandDNA.keyPhrases.join(', ')
    : '(none configured)';
  const avoidPhrases = Array.isArray(brandDNA.avoidPhrases) && brandDNA.avoidPhrases.length > 0
    ? brandDNA.avoidPhrases.join(', ')
    : '(none configured)';
  const competitors = Array.isArray(brandDNA.competitors) && brandDNA.competitors.length > 0
    ? brandDNA.competitors.join(', ')
    : '(none configured)';

  const lines: string[] = [
    '',
    '## Brand DNA (baked into the Golden Master at seed time — this is the tenant-specific identity that defines who you are and who you work for)',
    '',
    `Company: ${brandDNA.companyDescription}`,
    `Unique value: ${brandDNA.uniqueValue || '(not set)'}`,
    `Target audience: ${brandDNA.targetAudience}`,
    `Tone of voice: ${brandDNA.toneOfVoice}`,
    `Communication style: ${brandDNA.communicationStyle || '(not set)'}`,
    `Industry: ${brandDNA.industry}`,
    `Key phrases to weave in naturally when appropriate: ${keyPhrases}`,
    `Phrases you are forbidden from using: ${avoidPhrases}`,
    `Competitors (never name them unless specifically asked): ${competitors}`,
  ];

  // Reference examples subsection — only when the operator has provided reference
  // materials (assembled into a text block on the org brandDNA at save time). Kept
  // INSIDE the Brand DNA block so the surgical swap refreshes it as one unit. MUST
  // match `buildBrandDNABlock` in scripts/lib/brand-dna-helper.js byte-for-byte.
  if (typeof brandDNA.referenceExamples === 'string' && brandDNA.referenceExamples.trim().length > 0) {
    lines.push(
      '',
      '## Brand Reference Examples (real on-brand examples the operator shared — study them to match our actual style and intent)',
      '',
      brandDNA.referenceExamples,
    );
  }

  return lines.join('\n');
}

/**
 * Swap the trailing Brand DNA block of a system prompt in place.
 *
 * Locates the Brand DNA MARKER in `currentPrompt` and replaces everything from
 * the marker to end-of-string with the marker-onward portion of `newBlock`.
 * Everything BEFORE the marker — the industry base body and any human training
 * edits — is preserved VERBATIM.
 *
 * - If the marker is absent from `currentPrompt`, returns the prompt unchanged
 *   with `replaced: false`. The caller MUST treat `false` as a hard skip and
 *   NEVER append a second block (a GM with no baked block is a seed-time
 *   anomaly to surface, not silently double-bake).
 * - Throws if `newBlock` itself does not contain the marker — that is a
 *   programmer error (newBlock must come from `buildBrandDNABlock`).
 *
 * @param currentPrompt the active GM's full systemPrompt
 * @param newBlock the freshly built block from `buildBrandDNABlock(newDNA)`
 */
export function swapBrandDNABlock(
  currentPrompt: string,
  newBlock: string,
): { newPrompt: string; replaced: boolean } {
  const newBlockMarkerIdx = newBlock.indexOf(MARKER);
  if (newBlockMarkerIdx === -1) {
    throw new Error(
      'swapBrandDNABlock: newBlock does not contain the Brand DNA marker. ' +
      'newBlock must be produced by buildBrandDNABlock — refusing to swap.',
    );
  }

  const idx = currentPrompt.indexOf(MARKER);
  if (idx === -1) {
    return { newPrompt: currentPrompt, replaced: false };
  }

  const newPrompt = currentPrompt.slice(0, idx) + newBlock.slice(newBlockMarkerIdx);
  return { newPrompt, replaced: true };
}
