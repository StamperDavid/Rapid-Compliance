/**
 * Shared helper for seeding Golden Masters with Brand DNA baked in.
 *
 * STANDING RULE (April 14, 2026 — codified in CLAUDE.md):
 *
 *   Every Golden Master MUST have the tenant's Brand DNA merged into its
 *   `config.systemPrompt` field AT SEED TIME, not at runtime.
 *
 *   - No specialist does `getBrandDNA()` at runtime anymore.
 *   - The GM doc in Firestore IS the complete agent identity (industry +
 *     Brand DNA unified into one `systemPrompt` string).
 *   - When Brand DNA is edited in Settings, ALL 34 GMs must be re-seeded
 *     so the new values get baked in.
 *   - This applies to every agent that calls an LLM: content generators,
 *     analysts, research agents, scrapers — NO exceptions. Every agent
 *     performs better when it knows who it is working for.
 *
 * This file is the SINGLE SOURCE OF TRUTH for how Brand DNA gets embedded
 * into a GM. If the format needs to change, change it here — all 34 seed
 * scripts pick up the new format on the next reseed.
 *
 * Usage from a seed script:
 *
 *   const admin = require('firebase-admin');
 *   const { fetchBrandDNA, mergeBrandDNAIntoSystemPrompt } = require('./lib/brand-dna-helper');
 *
 *   // ... admin.initializeApp(...) ...
 *   const db = admin.firestore();
 *
 *   async function main() {
 *     const brandDNA = await fetchBrandDNA(db, PLATFORM_ID);
 *     const resolvedSystemPrompt = mergeBrandDNAIntoSystemPrompt(INDUSTRY_SYSTEM_PROMPT, brandDNA);
 *     // Write resolvedSystemPrompt to config.systemPrompt in the GM doc
 *   }
 */

/**
 * Fetch Brand DNA from the org document in Firestore.
 * Throws if the org doc doesn't exist or Brand DNA is missing or empty.
 *
 * The thrown error is deliberately loud — a missing Brand DNA at seed time
 * means a tenant hasn't finished onboarding, and seeding without it would
 * produce an agent that does not know who it is working for.
 *
 * @param {import('firebase-admin').firestore.Firestore} db
 * @param {string} platformId
 * @returns {Promise<object>} the brandDNA object from the org doc
 */
async function fetchBrandDNA(db, platformId) {
  const doc = await db.collection('organizations').doc(platformId).get();
  if (!doc.exists) {
    throw new Error(
      `Brand DNA bake-in failed: org document organizations/${platformId} does not exist. ` +
      `Create the org doc before running any seed script.`,
    );
  }

  const data = doc.data();
  if (!data || !data.brandDNA) {
    throw new Error(
      `Brand DNA bake-in failed: no brandDNA field on organizations/${platformId}. ` +
      `Visit /settings/ai-agents/business-setup and fill in Brand DNA BEFORE running seed scripts. ` +
      `Brand DNA is a required ingredient for every Golden Master — an agent without Brand DNA ` +
      `does not know who it is working for and would produce generic output.`,
    );
  }

  const brandDNA = data.brandDNA;

  // Minimum required fields — if these are blank, baking a GM is pointless.
  const missing = [];
  if (!brandDNA.companyDescription) { missing.push('companyDescription'); }
  if (!brandDNA.industry) { missing.push('industry'); }
  if (!brandDNA.toneOfVoice) { missing.push('toneOfVoice'); }
  if (!brandDNA.targetAudience) { missing.push('targetAudience'); }
  if (missing.length > 0) {
    throw new Error(
      `Brand DNA bake-in failed: required fields are empty on ` +
      `organizations/${platformId}.brandDNA — missing: ${missing.join(', ')}. ` +
      `Fill these in via /settings/ai-agents/business-setup before seeding.`,
    );
  }

  return brandDNA;
}

/**
 * Build the "## Brand DNA" block as a multi-line string.
 *
 * This is the canonical format every GM gets. If you need to change the
 * block layout, change it HERE — every seed script that uses this helper
 * will emit the new format on the next reseed.
 *
 * @param {object} brandDNA
 * @returns {string}
 */
function buildBrandDNABlock(brandDNA) {
  const keyPhrases = Array.isArray(brandDNA.keyPhrases) && brandDNA.keyPhrases.length > 0
    ? brandDNA.keyPhrases.join(', ')
    : '(none configured)';
  const avoidPhrases = Array.isArray(brandDNA.avoidPhrases) && brandDNA.avoidPhrases.length > 0
    ? brandDNA.avoidPhrases.join(', ')
    : '(none configured)';
  const competitors = Array.isArray(brandDNA.competitors) && brandDNA.competitors.length > 0
    ? brandDNA.competitors.join(', ')
    : '(none configured)';

  return [
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
  ].join('\n');
}

/**
 * Merge the industry-tailored base system prompt with the tenant's Brand DNA.
 *
 * The returned string is what goes into the GM doc's `config.systemPrompt`
 * field (and `systemPromptSnapshot`). At runtime the specialist reads this
 * unified string directly — no merging, no second Firestore call.
 *
 * @param {string} baseSystemPrompt the industry-tailored prompt (pre-merge)
 * @param {object} brandDNA
 * @returns {string} the unified prompt with Brand DNA embedded
 */
function mergeBrandDNAIntoSystemPrompt(baseSystemPrompt, brandDNA) {
  const block = buildBrandDNABlock(brandDNA);
  return `${baseSystemPrompt}\n${block}`;
}

module.exports = {
  fetchBrandDNA,
  buildBrandDNABlock,
  mergeBrandDNAIntoSystemPrompt,
};
