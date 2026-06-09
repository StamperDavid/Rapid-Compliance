/**
 * LIVE proof that brand reference extraction actually reads the materials:
 *   - IMAGE  → real vision read via OpenRouter (model picks the image apart)
 *   - PDF    → fetch + parse + LLM summary of the actual text
 *
 * Uses real public URLs + the real OpenRouter/Deepgram keys from Firestore, so it
 * exercises the exact path the analyze route uses (uploaded assets are public
 * Storage URLs, equally fetchable). Run: npx tsx scripts/verify-brand-reference-extraction-live.ts
 */

/* eslint-disable no-console */

import { extractAssetSummary } from '../src/lib/brand/brand-reference-extraction';

const IMAGE_URL = 'https://picsum.photos/seed/salesvelocity-brand/900/600';
const PDF_URL = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

async function main(): Promise<void> {
  let failures = 0;

  console.log('1) IMAGE → vision read');
  const imgSummary = await extractAssetSummary({
    url: IMAGE_URL,
    contentType: 'image/jpeg',
    kind: 'image',
  });
  console.log(`   → "${imgSummary}"`);
  if (imgSummary.trim().length > 0) {
    console.log('   ✅ vision returned a non-empty description');
  } else {
    console.log('   ❌ vision returned EMPTY (check OpenRouter key/model + image reachability)');
    failures += 1;
  }

  console.log('\n2) PDF → fetch + parse + summary');
  const pdfSummary = await extractAssetSummary({
    url: PDF_URL,
    contentType: 'application/pdf',
    kind: 'document',
  });
  console.log(`   → "${pdfSummary}"`);
  if (pdfSummary.trim().length > 0) {
    console.log('   ✅ document extraction returned a non-empty summary');
  } else {
    console.log('   ❌ document extraction returned EMPTY (check PDF parse + summarizer)');
    failures += 1;
  }

  console.log('\n========================================');
  console.log(failures === 0 ? '  EXTRACTION PROVEN LIVE' : `  ${failures} PATH(S) FAILED`);
  console.log('========================================');
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('FATAL:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
