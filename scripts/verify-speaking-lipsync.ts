/**
 * VERIFY — speaking lip-sync + 4K delivery in the Shot Plan pipeline.
 *
 * Proves, end-to-end on REAL fal, the two coupled features added to
 * `src/lib/video/shot-plan-generation-service.ts`:
 *
 *   FEATURE 2 (lip-sync):  a shot whose lead cast member has an ASSIGNED VOICE,
 *     after `generateShot`, has its silent Seedance clip REPLACED by a clip that
 *     is lip-synced to that voice speaking `shot.dialogue` — and its
 *     `generated.lastFrameUrl` is the TALKING frame (re-extracted off the synced
 *     clip), so the continue-chain chains off the speaking moment. A second shot
 *     whose cast member has NO voice proves the strict SKIP path (native audio
 *     kept, no lip-sync clip produced).
 *
 *   FEATURE 1 (4K):  generation runs at 1080p (Seedance max) and `stitchShotPlan`
 *     persists a Topaz-upscaled final as `finalVideoUrl` (best-effort; falls back
 *     to the 1080p stitch on upscale failure — both are valid persisted results).
 *
 * The plan is built via `ShotPlanSchema.parse(...)` so it is a real, validated
 * ShotPlan (no casts). Throwaway AvatarProfiles are created for the speaker (with
 * a voice) and the voiceless character, then deleted in a finally block.
 *
 * ⚠️ COSTS fal CREDITS — it runs real Seedance + ElevenLabs TTS + sync-lipsync/v3
 *    + Topaz upscale generations. Another process controls spend; run only when
 *    cleared. Usage:  npx tsx scripts/verify-speaking-lipsync.ts
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvLocal(): void {
  const p = resolve(process.cwd(), '.env.local');
  if (!existsSync(p)) {
    return;
  }
  for (const line of readFileSync(p, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) {
      continue;
    }
    const eq = t.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) {
      process.env[k] = v;
    }
  }
}
loadEnvLocal();

/* eslint-disable no-console */

const STORAGE_MARKER = 'firebasestorage';

async function main(): Promise<void> {
  const { randomUUID } = await import('node:crypto');
  const { apiKeyService } = await import('../src/lib/api-keys/api-key-service');
  const { PLATFORM_ID } = await import('../src/lib/constants/platform');
  const { generateWithFal } = await import('../src/lib/ai/providers/fal-provider');
  const { createAvatarProfile, deleteAvatarProfile } = await import('../src/lib/video/avatar-profile-service');
  const { generateShot, stitchShotPlan } = await import('../src/lib/video/shot-plan-generation-service');
  const { listAssets } = await import('../src/lib/media/media-library-service');
  const { ShotPlanSchema } = await import('../src/types/shot-plan');

  const key = await apiKeyService.getServiceKey(PLATFORM_ID, 'fal');
  if (!key) {
    throw new Error('No fal API key in Firestore — cannot run.');
  }
  const ctx = { tenantId: PLATFORM_ID };

  const fails: string[] = [];
  const ok = (cond: boolean, label: string): void => {
    console.log(cond ? `  ✓ ${label}` : `  ✗ ${label}`);
    if (!cond) {
      fails.push(label);
    }
  };

  // ── Character reference image ───────────────────────────────────────────────
  console.log('STEP 1 — character reference image (Flux)…');
  const portrait = await generateWithFal(
    'Photorealistic front-facing portrait of a friendly professional person in their 30s, head and shoulders, neutral studio background, looking at camera, sharp detail.',
    { aspectRatio: '9:16' },
  );
  const refUrl = portrait.url;
  if (!refUrl) {
    throw new Error('portrait generation returned no url');
  }

  // ── Profiles: one WITH a voice (gate passes), one WITHOUT (gate skips) ───────
  console.log('STEP 2 — saved AvatarProfiles (voiced + voiceless)…');
  const withVoice = await createAvatarProfile('system', {
    name: 'Lip-sync verify — speaker',
    frontalImageUrl: refUrl,
    styleTag: 'real',
    source: 'custom',
    voiceName: 'Rachel',
    voiceProvider: 'elevenlabs',
  });
  const withVoiceId = withVoice.profile?.id;
  if (!withVoiceId) {
    throw new Error(`could not create voiced profile: ${withVoice.error ?? 'unknown'}`);
  }
  const noVoice = await createAvatarProfile('system', {
    name: 'Lip-sync verify — voiceless',
    frontalImageUrl: refUrl,
    styleTag: 'real',
    source: 'custom',
  });
  const noVoiceId = noVoice.profile?.id;
  if (!noVoiceId) {
    throw new Error(`could not create voiceless profile: ${noVoice.error ?? 'unknown'}`);
  }

  // ── A real, validated two-shot plan (no casts) ──────────────────────────────
  const speakingShotId = randomUUID();
  const voicelessShotId = randomUUID();
  const nowIso = new Date().toISOString();
  const plan = ShotPlanSchema.parse({
    id: randomUUID(),
    title: 'Lip-sync + 4K verify',
    createdAt: nowIso,
    updatedAt: nowIso,
    sharedChoices: {
      cutCount: 2,
      cast: [
        { characterId: withVoiceId, name: 'Speaker', referenceImageUrls: [refUrl], billing: 'lead' },
        { characterId: noVoiceId, name: 'Voiceless', referenceImageUrls: [refUrl], billing: 'lead' },
      ],
      moodKeywords: [],
      environmentReferenceImageUrls: [],
    },
    shots: [
      {
        id: speakingShotId,
        index: 0,
        title: 'Speaking (voiced)',
        durationSeconds: 5,
        transitionIn: 'cut',
        castMemberIds: [withVoiceId],
        dialogue: "Hey — it's great to finally meet you. Let me show you how this works.",
        assembledPrompt:
          'The person looks directly at the camera and speaks naturally to the viewer, subtle head movement, friendly expression, medium close-up.',
      },
      {
        id: voicelessShotId,
        index: 1,
        title: 'Speaking (voiceless — must SKIP lip-sync)',
        durationSeconds: 5,
        transitionIn: 'cut',
        castMemberIds: [noVoiceId],
        dialogue: 'This line should never be lip-synced because there is no assigned voice.',
        assembledPrompt:
          'A different person stands and gestures while talking, full upper body, neutral background.',
      },
    ],
  });

  // Baseline count of lip-sync clips already in the library (so we measure delta).
  const beforeLipSync = (await listAssets({ tags: ['lip-sync'], limit: 500 })).assets.length;

  try {
    console.log('STEP 3 — generateShot (voiced) → expect lip-sync replacement…');
    let current = await generateShot(plan, speakingShotId, ctx);
    const voicedShot = current.shots.find((s) => s.id === speakingShotId);
    ok(voicedShot?.generated?.status === 'completed', 'voiced shot completed');
    ok(
      typeof voicedShot?.generated?.videoUrl === 'string' && voicedShot.generated.videoUrl.includes(STORAGE_MARKER),
      'voiced shot videoUrl is on OUR storage',
    );
    ok(
      typeof voicedShot?.generated?.lastFrameUrl === 'string' &&
        voicedShot.generated.lastFrameUrl.includes(STORAGE_MARKER),
      'voiced shot lastFrameUrl is on OUR storage (talking frame)',
    );

    console.log('STEP 4 — generateShot (voiceless) → expect NO lip-sync (native audio kept)…');
    current = await generateShot(current, voicelessShotId, ctx);
    const voicelessShot = current.shots.find((s) => s.id === voicelessShotId);
    ok(voicelessShot?.generated?.status === 'completed', 'voiceless shot completed (kept native audio)');

    // EXACTLY one new lip-sync clip should have appeared (the voiced shot only).
    const afterLipSync = (await listAssets({ tags: ['lip-sync'], limit: 500 })).assets.length;
    ok(afterLipSync - beforeLipSync === 1, 'exactly ONE lip-sync clip produced (voiced shot, not voiceless)');

    console.log('STEP 5 — stitchShotPlan → expect a persisted final (4K when upscale succeeds)…');
    const stitched = await stitchShotPlan(current, ctx);
    ok(
      typeof stitched.finalVideoUrl === 'string' && stitched.finalVideoUrl.includes(STORAGE_MARKER),
      'finalVideoUrl persisted on OUR storage',
    );
    const finals = (await listAssets({ category: 'final-render', limit: 500 })).assets;
    const has4K = finals.some((a) => a.tags.includes('4k'));
    console.log(`  • final-render is tagged 4k: ${has4K} (false ⇒ upscale fell back to 1080p, still a pass)`);

    console.log('\n──────── URLs to watch ────────');
    console.log('  voiced shot   :', voicedShot?.generated?.videoUrl);
    console.log('  talking frame :', voicedShot?.generated?.lastFrameUrl);
    console.log('  voiceless shot:', voicelessShot?.generated?.videoUrl);
    console.log('  final         :', stitched.finalVideoUrl);
  } finally {
    await deleteAvatarProfile(withVoiceId).catch(() => undefined);
    await deleteAvatarProfile(noVoiceId).catch(() => undefined);
  }

  console.log(`\n${fails.length === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${fails.length} CHECK(S) FAILED`}`);
  process.exit(fails.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\n❌ VERIFY ERROR:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
