/**
 * VERIFY: fal additions (additive build, June 12 2026)
 *
 * Proves three new, additive capabilities end-to-end against the LIVE fal API:
 *
 *   (a) Seedance text-to-video — FalSeedanceProvider.generateTextToVideo
 *       (4s / 480p) → prints the final video URL.
 *   (b) STATELESS getStatus — resolves a generation from ONLY the composite
 *       generationId (`${model}::${request_id}`). We deliberately re-create the
 *       provider AND clear the in-memory cache before polling, so success proves
 *       the URLs are reconstructed from the id alone (survives restarts).
 *   (c) Flux Kontext image edit — generateFromReferenceWithFal on a real image
 *       → prints the result URL.
 *
 * Run:  npx tsx scripts/verify-fal-additions.ts
 *
 * Prints "FAL ADDITIONS OK" only if all three succeed.
 */

import { FalSeedanceProvider } from '../src/lib/video/providers/fal-seedance-provider';
import type { TenantContext } from '../src/lib/video/providers/types';
import { generateFromReferenceWithFal } from '../src/lib/ai/providers/fal-provider';
import { PLATFORM_ID } from '../src/lib/constants/platform';

const CTX: TenantContext = { tenantId: PLATFORM_ID };

const KONTEXT_IMAGE_URL =
  'https://firebasestorage.googleapis.com/v0/b/rapid-compliance-65f87.firebasestorage.app/o/' +
  'organizations%2Frapid-compliance-root%2Fmedia%2Fimages%2F' +
  'ad5e2703-5bab-4872-aa1d-c0b11d21f7f8.png?alt=media&token=7f14e23f-f737-460a-a01a-62fe20f1f4bb';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Poll a generationId to completion (or failure / timeout) using a FRESH provider. */
async function pollToCompletion(
  generationId: string,
  maxMs: number,
): Promise<string> {
  const deadline = Date.now() + maxMs;
  // FRESH provider instance for every poll → no reliance on submit-time state.
  while (Date.now() < deadline) {
    const provider = new FalSeedanceProvider();
    const status = await provider.getStatus(generationId, CTX);
    process.stdout.write(`  status=${status.status}\n`);
    if (status.status === 'completed') {
      if (!status.videoUrl) {
        throw new Error('completed but no videoUrl');
      }
      return status.videoUrl;
    }
    if (status.status === 'failed') {
      throw new Error(`generation failed: ${status.error ?? 'unknown'}`);
    }
    await sleep(5000);
  }
  throw new Error('timed out waiting for completion');
}

async function main(): Promise<void> {
  // ── (a) Seedance text-to-video 4s / 480p ───────────────────────────────────
  console.log('\n[1/3] Seedance text-to-video (4s / 480p)…');
  const submitProvider = new FalSeedanceProvider();
  const submitted = await submitProvider.generateTextToVideo(
    {
      prompt:
        'A friendly small-business owner stands in a bright modern shop and says ' +
        'to camera: "Welcome to our store — we are so glad you are here." ' +
        'Warm natural lighting, realistic, looking directly at the camera.',
      resolution: '480p',
      aspectRatio: '16:9',
      durationSeconds: 4,
      // generate_audio defaults to TRUE on the text-to-video path.
    },
    CTX,
  );
  console.log(`  submitted generationId=${submitted.generationId} status=${submitted.status}`);

  // The generationId MUST be the composite "model::request_id" form.
  if (!submitted.generationId.includes('::')) {
    throw new Error(`generationId is not a composite id: ${submitted.generationId}`);
  }

  // DEBUG: compare fal's submit-time URLs vs our reconstructed URLs.
  {
    const dbg = (await import('../src/lib/video/providers/fal-seedance-provider')) as unknown as {
      __getHandleStoreForTests?: () => Map<string, { statusUrl: string; responseUrl: string }>;
    };
    const cached = dbg.__getHandleStoreForTests?.().get(submitted.generationId);
    console.log('  fal submit statusUrl  :', cached?.statusUrl);
    console.log('  fal submit responseUrl:', cached?.responseUrl);
  }

  // ── (b) Prove STATELESS getStatus ──────────────────────────────────────────
  // Reach into the module to clear the optional in-memory cache so success can
  // ONLY come from reconstructing URLs out of the composite generationId.
  console.log('\n[2/3] Proving stateless getStatus (cache cleared, fresh provider)…');
  const mod = (await import('../src/lib/video/providers/fal-seedance-provider')) as unknown as {
    __getHandleStoreForTests?: () => Map<string, unknown>;
  };
  if (mod.__getHandleStoreForTests) {
    mod.__getHandleStoreForTests().clear();
    console.log('  in-memory cache cleared via test hook');
  } else {
    console.log('  (no test hook exposed — relying on a fresh provider instance only)');
  }

  const videoUrl = await pollToCompletion(submitted.generationId, 8 * 60 * 1000);
  console.log(`  TEXT-TO-VIDEO URL: ${videoUrl}`);

  // ── (c) Flux Kontext image edit ────────────────────────────────────────────
  console.log('\n[3/3] Flux Kontext image edit…');
  const edited = await generateFromReferenceWithFal(
    'Change the background to a clean solid sky-blue studio backdrop. ' +
      'Keep the subject exactly the same.',
    KONTEXT_IMAGE_URL,
  );
  console.log(`  KONTEXT RESULT URL: ${edited.url}`);
  if (!edited.url) {
    throw new Error('Kontext returned no url');
  }

  console.log('\nFAL ADDITIONS OK');
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('\nVERIFY FAILED:', message);
  process.exit(1);
});
