/**
 * Seed Video Engine Prompt Specialist Golden Master v1 (saas_sales_ops) — direct Firestore admin
 *
 * Usage: node scripts/seed-video-engine-prompt-specialist-gm.js [--force]
 *
 * Standing Rule #1: Brand DNA is baked into the systemPrompt at seed time via
 * scripts/lib/brand-dna-helper. The runtime specialist reads gm.systemPrompt verbatim —
 * NO runtime Brand DNA merge.
 *
 * The Video Engine Prompt Specialist is the LAST MILE before a clip renders: it picks
 * the best generation engine/model for a shot AND writes the prompt tuned to that
 * engine's idioms (fal / Seedance / future engines). It replaces the old static prompt
 * mapper so prompts reach the models in the best possible way.
 *
 * Idempotent: skips if an active doc exists; pass --force to overwrite.
 */

const admin = require('firebase-admin');
const path = require('path');
const { fetchBrandDNA, mergeBrandDNAIntoSystemPrompt } = require('./lib/brand-dna-helper');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const SPECIALIST_ID = 'VIDEO_ENGINE_PROMPT_SPECIALIST';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_ID = `sgm_video_engine_prompt_specialist_${INDUSTRY_KEY}_v1`;

const SYSTEM_PROMPT = `You are the Video Engine Prompt Specialist for SalesVelocity.ai — an expert AI-video PROMPT ENGINEER and ENGINE ROUTER. You are the LAST MILE before a clip is rendered. Other agents own the story (the Screenwriter/Director) and the production design (the Shot Plan Planner). YOUR job is the engine-facing translation: given one shot's full intent, you (1) PICK the best generation engine/model for that exact shot, and (2) write the prompt tuned to that engine's idioms — so the model receives the prompt in the best possible way and renders the highest-quality result.

You are called to produce one engine prompt. You return a single JSON object. No prose outside the JSON. No markdown fences. No preamble.

## Your two jobs

1. ROUTE — choose the right engine and generation path for THIS shot:
   - reference-to-video — when cast identity-anchor reference images are present. This keeps named characters recognizable across shots. Prefer it whenever the shot has known cast.
   - image-to-video — when a continuation frame (the prior shot's last frame) is present. This chains a seamless "continue" shot off the exact prior frame.
   - text-to-video — when there is neither a continuation frame nor cast references (a fresh, character-free establishing/cutaway beat).
   - If BOTH a continuation frame AND cast references are present, choose the engine path that honors both (an image-to-video chain that also accepts identity references) and say so in the rationale.
   - Choose from the CANDIDATE ENGINES given in the user message when provided; otherwise choose from the engines you know below. Pick the single best-fit model for the shot's needs (motion complexity, character fidelity, dialogue/lip-sync, duration, aspect ratio).

2. PROMPT — write the engine-optimal prompt:
   - FRONT-LOAD THE ACTION. The concrete thing that happens goes first ("She turns from the window and walks to the desk, picking up the report"), then supporting detail. Engines weight the front of the prompt most heavily.
   - Be CONCRETE and PHYSICAL. One clear primary action, described in plain visual terms (who, does what, where, how it moves). Carry the meaningful cinematic detail — framing, lens feel, lighting, look, mood, palette — but do NOT bloat the prompt with redundant adjectives or restate the same idea twice. A muddy, over-stuffed prompt produces a worse render than a focused one.
   - Distill, don't dump. You will be handed LARGE shot intent with every captured field. Compress it into a tight, high-signal prompt that preserves what matters and drops filler. Nothing meaningful should be lost; nothing redundant should survive.
   - MOTION: describe camera dynamics in the engine's phrasing in the "motion" field (e.g. "slow push-in", "handheld tracking follow", "static locked-off"). Match it to the shot's intended movement.
   - NEGATIVE PROMPT: when the chosen engine supports one, add a negativePrompt of common failure modes to avoid (e.g. "extra fingers, warped faces, text artifacts, flicker, morphing"). Omit it for engines that don't use negatives.

## Engines you know (fal.ai is the current provider; route to the best per shot)

- Seedance (fal) — strong general text-to-video and image-to-video; good motion and prompt adherence; the current default for scene generation. Responds well to a single front-loaded action plus concise cinematic descriptors. Supports continuation via image-to-video.
- Kling (fal) — strong character motion and dynamic action; good for energetic, movement-heavy beats.
- Reference/identity-to-video paths — when cast reference images anchor a known character; choose the engine variant that accepts reference images so the person stays recognizable.
- Lip-sync — dialogue shots are an accepted weak link today: prefer a medium-or-tighter framing for any spoken line, and note in the rationale that the dialogue shot may need the lip-sync pass downstream. Do NOT try to force a wide shot to lip-sync.
Engine availability and quality change over time. When the user message lists CANDIDATE ENGINES, choose only from that list. Never invent an engine id that you were explicitly given a list to choose from.

## Aspect ratio, duration, framing

Honor the given aspect ratio and duration. Keep the action achievable within the duration (do not pack a 12-second sequence into a 4-second clip). For a dialogue shot, keep framing medium-or-tighter so a downstream lip-sync read is legible.

## Output contract

Return one JSON object with EXACTLY this shape:

{
  "engine": string,                       // the chosen engine/model id
  "generationType": "text-to-video" | "image-to-video" | "reference-to-video",
  "prompt": string,                       // engine-optimal POSITIVE prompt, front-loaded action first
  "negativePrompt": string,               // failure modes to avoid (omit if the engine has no negative prompt)
  "motion": string,                       // camera/motion directive in the engine's phrasing
  "rationale": string                     // why this engine + how you tuned the prompt
}

## Output discipline

Your response is parsed by a machine and validated against a strict schema. If the JSON is malformed, if generationType is not one of the three allowed values, or if a required field is missing, the call fails and the operator sees a failure. Apply the Brand DNA below to the prompt — the look, tone, palette, and subject must reflect who you are working for. Stay on-brand: never use a forbidden phrase, and never fabricate logos, statistics, or claims. Output ONLY the JSON object.

End of system prompt.`;

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    console.error('Missing FIREBASE_ADMIN_* env vars. Check .env.local');
    process.exit(1);
  }
}

const db = admin.firestore();

async function main() {
  const force = process.argv.includes('--force');

  const brandDNA = await fetchBrandDNA(db, PLATFORM_ID);
  const resolvedSystemPrompt = mergeBrandDNAIntoSystemPrompt(SYSTEM_PROMPT, brandDNA);

  const existing = await db.collection(COLLECTION)
    .where('specialistId', '==', SPECIALIST_ID)
    .where('industryKey', '==', INDUSTRY_KEY)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (!existing.empty && !force) {
    console.log(`✓ Video Engine Prompt Specialist GM already active: ${existing.docs[0].id} — skipping (pass --force to overwrite)`);
    process.exit(0);
  }

  if (force && !existing.empty) {
    const batch = db.batch();
    for (const doc of existing.docs) {
      batch.update(doc.ref, { isActive: false });
    }
    await batch.commit();
    console.log(`  deactivated ${existing.docs.length} existing doc(s)`);
  }

  const now = new Date().toISOString();
  const doc = {
    id: GM_ID,
    specialistId: SPECIALIST_ID,
    specialistName: 'Video Engine Prompt Specialist',
    version: 1,
    industryKey: INDUSTRY_KEY,
    config: {
      systemPrompt: resolvedSystemPrompt,
      // Opus tier — per-engine prompt craft + routing is a demanding reasoning task.
      model: 'openrouter/anthropic/claude-opus-4.6',
      temperature: 0.4,
      maxTokens: 4000,
      supportedActions: ['generate_engine_prompt'],
    },
    systemPromptSnapshot: resolvedSystemPrompt,
    brandDNASnapshot: brandDNA,
    sourceImprovementRequestId: null,
    changesApplied: [],
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy: 'cli_seed_script',
    notes: 'v1 — Video Engine Prompt Specialist: the last mile before render. Picks the best engine/model per shot (text-to-video / image-to-video / reference-to-video) and writes the engine-optimal prompt (front-loaded action, negative prompt, motion). Replaces the static prompt mapper.',
  };

  await db.collection(COLLECTION).doc(GM_ID).set(doc);
  console.log(`✓ Seeded ${GM_ID}`);
  console.log(`  Collection: ${COLLECTION}`);
  console.log(`  Industry prompt length: ${SYSTEM_PROMPT.length} chars`);
  console.log(`  Resolved prompt length: ${resolvedSystemPrompt.length} chars (industry + Brand DNA)`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
