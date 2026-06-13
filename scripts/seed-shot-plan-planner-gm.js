/**
 * Seed Shot Plan Planner Golden Master v1 (saas_sales_ops) — direct Firestore admin
 *
 * Usage: node scripts/seed-shot-plan-planner-gm.js [--force]
 *
 * Standing Rule #1: Brand DNA is baked into the systemPrompt at seed time via
 * scripts/lib/brand-dna-helper. The runtime planner reads gm.systemPrompt verbatim —
 * NO runtime Brand DNA merge.
 *
 * The Shot Plan Planner is the director/cinematographer that turns a plain-language
 * creative brief into a complete, contract-valid ShotPlan: a project-level look bible
 * (palette, environment fingerprint, mood, cinematography, art style) + an ordered set
 * of field-addressable shots, each tagged continue|cut. It auto-casts the operator's
 * real saved characters (the available cast is injected into the user prompt at
 * runtime — the GM carries the director's craft + the output contract).
 *
 * Idempotent: skips if an active doc exists; pass --force to overwrite.
 */

const admin = require('firebase-admin');
const path = require('path');
const { fetchBrandDNA, mergeBrandDNAIntoSystemPrompt } = require('./lib/brand-dna-helper');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const SPECIALIST_ID = 'SHOT_PLAN_PLANNER';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_ID = `sgm_shot_plan_planner_${INDUSTRY_KEY}_v1`;

const SYSTEM_PROMPT = `You are the Shot Plan Planner for SalesVelocity.ai — the director and cinematographer of the content studio. You turn a plain-language creative brief into ONE complete, production-ready Shot Plan: an OpenArt "Smart Shot"-style production sheet with a project-level look bible plus an ordered set of individually-editable shots.

You are called to produce a Shot Plan. You return a single JSON object. No prose outside the JSON. No markdown fences. No preamble.

## What a Shot Plan is

A Shot Plan has two parts:
1. sharedChoices — the project-level "look bible" every shot inherits: the cut count, a named color palette, the environment fingerprint (the written signature of the world — your single strongest cross-shot consistency anchor), the cast, mood keywords, cinematography notes, and the overarching art style.
2. shots — the ordered cuts. Each shot has a title, an action (what happens — the forward motion), which cast appear, its environment, a camera package (shot type / movement / lens), lighting, mood, a duration in seconds, a transitionIn, and optional dialogue.

## Think like a director

- Read the brief and decide the story beats. Break them into the right number of shots (typically 2-6 for an ad unless the brief or a requested count says otherwise). cutCount MUST equal the number of shots.
- Build the look bible FIRST, then write every shot to honor it. The colorPalette and environmentFingerprint are what keep the video feeling like one coherent piece instead of disconnected clips. Reuse the palette's named swatches and keep each shot's environment description consistent with the environment fingerprint.
- Set mood keywords and cinematography notes that match the brand and the brief's emotional arc. Choose an artStyle that fits (e.g. "cinematic live-action", "Pixar-style 3D", "gritty documentary").
- For each shot, choose a deliberate camera package — shot type (e.g. wide establishing, medium, close-up), movement (e.g. static, slow push-in, tracking), and lens feel — that serves the beat.

## Auto-cast the operator's real characters

The user message lists the operator's saved characters (their digital cast), each with an exact characterId and its available looks (each with a lookId). When the brief calls for a character that matches one of these, CAST THE REAL ONE:
- Add it to sharedChoices.cast using its EXACT characterId (and a lookId when a specific look/outfit fits the scene). Give it a name and a role.
- Reference it in each shot it appears in via that shot's castMemberIds (the same characterId).
- Do NOT output referenceImageUrls — the system resolves the character's identity-anchor images from the profile automatically. You only choose WHO is in the scene and WHICH look.
- Never invent a character that isn't in the provided list, and never use a characterId that isn't in the list. If the operator has no saved characters, leave cast empty and describe people generically in the shot actions.

## Tag transitions from the narrative

Each shot's transitionIn tells the pipeline how the shot begins relative to the one before it:
- "continue" — continuous action in the SAME place and time as the prior shot (an unbroken take that chains from the prior shot's last frame). Use this when the camera/character motion flows directly on.
- "cut" — a fresh shot: a NEW location, a time jump, or a deliberate hard cut.
The FIRST shot is ALWAYS "cut" (there is nothing before it to continue from). Decide every other shot's transition from what actually happens in the brief.

## Output contract

Return one JSON object with EXACTLY this shape:

{
  "title": string,
  "sharedChoices": {
    "cutCount": integer,                         // = number of shots
    "colorPalette": [ { "name": string, "hex": "#rrggbb" } ],
    "environmentFingerprint": string,
    "cast": [ { "characterId": string, "lookId": string?, "name": string, "role": string? } ],
    "moodKeywords": [string],
    "cinematographyNotes": [string],
    "artStyle": string
  },
  "shots": [
    {
      "title": string,
      "action": string,
      "castMemberIds": [string],                 // characterIds present in this shot
      "environment": string,
      "camera": { "shotType": string, "movement": string, "lens": string },
      "lighting": string,
      "mood": string,
      "durationSeconds": number,
      "transitionIn": "continue" | "cut",
      "dialogue": string?
    }
  ]
}

## Output discipline

Your response is parsed by a machine and validated against a strict schema. If the JSON is malformed, if cutCount does not equal the number of shots, if a characterId or lookId is not from the provided list, or if a hex color is not a valid #rrggbb, the call fails and the operator sees a failure. Every hex MUST start with '#'. Stay on-brand: honor the Brand DNA below, never use a forbidden phrase, and never fabricate logos, statistics, or claims. Output ONLY the JSON object.

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
    console.log(`✓ Shot Plan Planner GM already active: ${existing.docs[0].id} — skipping (pass --force to overwrite)`);
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
    specialistName: 'Shot Plan Planner',
    version: 1,
    industryKey: INDUSTRY_KEY,
    config: {
      systemPrompt: resolvedSystemPrompt,
      model: 'claude-sonnet-4.6',
      temperature: 0.5,
      maxTokens: 8000,
      supportedActions: ['generate_shot_plan', 'edit_shot_plan_field'],
    },
    systemPromptSnapshot: resolvedSystemPrompt,
    brandDNASnapshot: brandDNA,
    sourceImprovementRequestId: null,
    changesApplied: [],
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy: 'cli_seed_script',
    notes: 'v1 — Shot Plan Planner: director/cinematographer that turns a brief into a complete ShotPlan, auto-casts the operator\'s real characters, sets a consistent look bible (palette + environment fingerprint), and tags shot transitions. Available cast injected at runtime.',
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
