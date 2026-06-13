/**
 * VERIFY (Stage 1): the new fal video provider works end-to-end through the
 * engine-agnostic interface.
 *
 *   router → getVideoEngineProvider('fal') → generateVideo (reference-to-video)
 *   → poll getStatus() until completed → print video URL → "FAL PROVIDER OK"
 *
 * Proves the VideoEngineProvider contract, credential resolution, the metering
 * stub, submit, the in-memory handle store, Zod validation, and status polling
 * all line up against the live fal queue.
 *
 * Run: npx tsx scripts/verify-fal-provider.ts
 */
import { getVideoEngineProvider } from '../src/lib/video/providers';
import type { TenantContext } from '../src/lib/video/providers';
import { PLATFORM_ID } from '../src/lib/constants/platform';

const TEST_IMAGE_URL =
  'https://firebasestorage.googleapis.com/v0/b/rapid-compliance-65f87.firebasestorage.app/o/organizations%2Frapid-compliance-root%2Fmedia%2Fimages%2Fad5e2703-5bab-4872-aa1d-c0b11d21f7f8.png?alt=media&token=7f14e23f-f737-460a-a01a-62fe20f1f4bb';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const ctx: TenantContext = { tenantId: PLATFORM_ID };
  const provider = getVideoEngineProvider('fal');
  console.log(`Provider id: ${provider.id}`);

  console.log('Submitting a short 4s 480p Seedance reference-to-video clip...');
  const submitted = await provider.generateVideo(
    {
      prompt:
        '@Image1 is the subject. A short, gentle 4-second cinematic shot of the subject, ' +
        'subtle camera push-in, soft natural lighting. Preserve the subject exactly.',
      imageUrls: [TEST_IMAGE_URL],
      resolution: '480p',
      aspectRatio: '16:9',
      durationSeconds: 4,
      generateAudio: false,
    },
    ctx,
  );
  console.log(`Submitted: generationId=${submitted.generationId} status=${submitted.status}`);

  let videoUrl: string | null = null;
  for (let i = 0; i < 150; i += 1) {
    await sleep(5000);
    const status = await provider.getStatus(submitted.generationId, ctx);
    console.log(`[${i}] status=${status.status}${status.error ? ` error=${status.error}` : ''}`);
    if (status.status === 'completed') {
      videoUrl = status.videoUrl;
      break;
    }
    if (status.status === 'failed') {
      throw new Error(`generation failed: ${status.error ?? 'unknown'}`);
    }
  }

  if (!videoUrl) {
    throw new Error('timed out polling for completion');
  }

  console.log(`\nVideo URL: ${videoUrl}`);
  console.log('FAL PROVIDER OK');
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error('ERROR:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
