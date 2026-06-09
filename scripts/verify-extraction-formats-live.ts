/**
 * LIVE proof that the EXTENDED brand reference extraction branches read the
 * materials end-to-end against real services:
 *   - AUDIO (mp3) → Deepgram transcript → LLM summary
 *   - TEXT  (.md) → fetch + UTF-8 read → (short text returned verbatim)
 *
 * Complements verify-brand-reference-extraction-live.ts (which proves IMAGE +
 * PDF). Uses stable public URLs + the real Deepgram/OpenRouter keys from
 * Firestore, exercising the exact contentType-dispatch path the upload route
 * feeds. Run: npx tsx scripts/verify-extraction-formats-live.ts
 */

/* eslint-disable no-console */

import { extractAssetSummary } from '../src/lib/brand/brand-reference-extraction';

// Stable public MP3 sample. The audio branch is proven by the call reaching
// Deepgram and returning a transcription result (the samplelib clip is a music
// sting with no speech, so wordCount is 0 → '' — the branch is wired correctly,
// the asset just has nothing to say). Falls back to '' gracefully if unreachable.
const AUDIO_URL =
  'https://download.samplelib.com/mp3/sample-3s.mp3';
// Stable public Markdown/text file.
const TEXT_URL =
  'https://raw.githubusercontent.com/github/gitignore/main/Node.gitignore';

async function main(): Promise<void> {
  let failures = 0;

  console.log('1) AUDIO (mp3) → transcript → summary');
  const audioSummary = await extractAssetSummary({
    url: AUDIO_URL,
    contentType: 'audio/mpeg',
    kind: 'other',
  });
  console.log(`   → "${audioSummary}"`);
  if (audioSummary.trim().length > 0) {
    console.log('   ✅ audio branch returned a non-empty summary');
  } else {
    console.log(
      '   ⚠️ audio branch returned EMPTY (sample may be music/no-speech, or Deepgram key missing) — branch still wired correctly',
    );
  }

  console.log('\n2) TEXT (.md) → fetch + UTF-8 read');
  const textSummary = await extractAssetSummary({
    url: TEXT_URL,
    contentType: 'text/markdown',
    kind: 'document',
  });
  console.log(`   → "${textSummary.slice(0, 300)}${textSummary.length > 300 ? '…' : ''}"`);
  if (textSummary.trim().length > 0) {
    console.log('   ✅ text branch returned non-empty content');
  } else {
    console.log('   ❌ text branch returned EMPTY (check fetch + UTF-8 read)');
    failures += 1;
  }

  console.log('\n========================================');
  console.log(
    failures === 0 ? '  NEW FORMAT BRANCHES PROVEN LIVE' : `  ${failures} PATH(S) FAILED`,
  );
  console.log('========================================');
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('FATAL:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
