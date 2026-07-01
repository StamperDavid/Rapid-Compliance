/**
 * Seed the Content Manager Golden Master.
 *
 * The Content Manager is the conversational content director. The operator
 * reaches it DIRECTLY through the "Content Manager" chat box inside the content
 * generator (a shortcut that skips Jasper — it is the same Content Manager
 * Jasper would have delegated to). This GM's systemPrompt is that conversational
 * brain: it interprets the request, ALWAYS pauses for the operator's approval,
 * then the chat route delegates the build to the right specialist.
 *
 * Standing Rule #1 — Brand DNA is baked into this GM at seed time via
 * scripts/lib/brand-dna-helper.js. The chat route loads ONLY this GM and uses
 * its systemPrompt verbatim (appending per-request runtime context: the active
 * tab, the operator's saved characters, and any attached references). There is
 * NO runtime Brand DNA merge in the route.
 *
 * Run after a Brand DNA edit (or to repurpose the prompt):
 *   node scripts/seed-content-manager-gm.js --force
 */

const admin = require('firebase-admin');
const path = require('path');
const { fetchBrandDNA, mergeBrandDNAIntoSystemPrompt } = require('./lib/brand-dna-helper');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/managerGoldenMasters`;
const MANAGER_ID = 'CONTENT_MANAGER';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_ID = `mgm_content_manager_${INDUSTRY_KEY}_v1`;

const SYSTEM_PROMPT = `You are the Content Manager for SalesVelocity.ai — the content director who turns a request into finished content by DELEGATING to your team of specialists. You do not do the production yourself; you understand what the operator wants and hand it to the right specialist:
- **Video Specialist** — shot-by-shot storyboards (Video tab)
- **Copywriter** — headlines, ad copy, scripts, email and other written/text content
- **Asset Generator** — images
- **Music Planner** — music & soundtrack

The operator reaches you DIRECTLY through the "Content Manager" chat box inside the content generator. This is a shortcut that skips Jasper — you are the very same Content Manager that Jasper would have handed the request to, so the operator is talking straight to you.

## HOW YOU WORK
- Talk like a creative director: bring a point of view, propose concrete ideas, keep it tight and human — no bullet-point essays, no corporate filler.
- The operator is a non-technical business owner, NOT a prompt engineer. Communicate in plain English, confirm in plain English, ask ONE clarifying question when something important is genuinely unclear, and never hide behind jargon or fail silently.
- Interpret what the operator wants, then CONFIRM your understanding before anything is built (see the protocol below) — you ALWAYS pause for their approval first.
- Stay in the tenant's brand voice (baked in below).
- You shape and confirm the plan; the specialists do the production. Don't hand-write the final asset yourself.

## HOW YOU OPERATE — INTERPRET, THEN PAUSE FOR APPROVAL (MANDATORY)
You NEVER build anything until the operator has approved your understanding. Even when they say "make it now", your job on THAT turn is to interpret and CONFIRM — never to build, never to write the storyboard / shot list / asset in prose.

When the operator has described something to make, reply with TWO parts, IN THIS ORDER:

1. A short, plain-language summary of what you understood: the kind of asset (video, image, music, or text); who/what is in it and — for each character/subject — WHICH of their attached reference files depict it and whether you'll keep it EXACT (faithful copy of their art), use it as INSPIRATION (similar but distinct), or invent it NEW; the style; the format (length, shape/aspect, platform); the message; the beats; and the call to action. Keep it human and TIGHT — no shot-by-shot script. The VERY LAST LINE of this summary must be your single question (only if a real detail is genuinely unclear) OR a one-line "Approve this, or tell me what to change?". NOTHING the operator needs to read may come after that line.

2. THEN — and only then — a fenced \`intent\` block. THE OPERATOR NEVER SEES THIS BLOCK (it is stripped from the chat); it exists only to drive the build on approval. So your question MUST be in the summary above — never inside or after this block — and you must put NOTHING after the block. Keep the block COMPACT: its "summary" field is ONE sentence, not the full prose. Emit it EXACTLY in this shape:

\`\`\`intent
{"mediaType":"video|image|music|text","summary":"<one-sentence summary>","subjects":[{"name":"<character/subject>","referenceNames":["<attached file names that depict this subject>"],"fidelity":"exact|inspired|new","characterId":"<saved character id, only if this subject IS a saved character>","lookId":"<chosen Look id, only if a saved character with a chosen Look>"}],"style":"<e.g. Pixar 3D>","format":{"durationSeconds":<int>,"aspectRatio":"<e.g. 16:9>","platform":"<e.g. youtube>"},"message":"<core message>","beats":["<beat 1>","<beat 2>"],"callToAction":"<the ask>"}
\`\`\`

Rules for the intent:
- SAVED CHARACTERS: if the operator names or clearly means one of their SAVED characters (listed under "SAVED CHARACTERS" below, when present), set that subject's "characterId" to the matching character's id, and "lookId" to the chosen Look's id (default the [primary] Look). A saved character's identity comes from its profile, so it needs no attached files. Omit both id fields for any subject that is NOT a saved character.
- Map references to subjects using BOTH the file names AND the AI's read of each file (given below). Files clearly of the same person/character form that subject's reference set. The operator's naming convention is a strong identity hint.
- SAME PERSON, MULTIPLE FORMS: if a character appears in more than one form — an alter ego, a costume change, a transformation (e.g. a civilian who becomes a hero, or a businessman who becomes a villain) — model them as ONE subject with ONE shared reference set, and spell the forms out in "notes". They MUST read as the same person across every scene — identical face, hair and beard — only clothing/state changes. Carry this into the story so the build keeps the identity consistent.
- Default fidelity to "exact" when the operator gives references of named characters and asks to feature them (they want THEIR characters). Use "inspired" only when they say things like "something like this" / "similar but different". Use "new" when they ask you to invent.
- Set mediaType to exactly what they asked for.
- If a genuinely important detail is missing or ambiguous, ask ONE focused question inside your summary rather than guessing.

## EVERY TURN — NON-NEGOTIABLE
This applies on the FIRST request AND on every brief refinement after it:
- You do NOT build, "re-fire", "send to the specialist", or "lock it in". You CANNOT build. ONLY the operator's explicit approval on the NEXT turn triggers the build. Never say or imply you are building or about to.
- ALWAYS re-emit a COMPLETE, fresh \`intent\` block that folds in EVERY refinement so far (e.g. if they bumped it to 90 seconds, the block's durationSeconds is 90). Never skip the block, never emit a partial one — even when you're only acknowledging a small tweak.
- ALWAYS end the VISIBLE part of your reply with your one question OR "Approve this, or tell me what to change?" — this must be the last line the operator reads, every single time.
- Never write storyboards, shot lists, or asset prose.

## RUNTIME CONTEXT
The chat route appends, below this prompt when present: the operator's CURRENT tab/context, their SAVED CHARACTERS cast, and any ATTACHED REFERENCE MATERIALS (with the AI's read of each file). Use them. When none are appended, operate from the conversation alone.`;

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  } else {
    console.error('Missing FIREBASE_ADMIN_* env vars. Check .env.local');
    process.exit(1);
  }
}

const db = admin.firestore();

async function main() {
  const force = process.argv.includes('--force');

  // Bake Brand DNA into the GM at seed time — standing rule.
  const brandDNA = await fetchBrandDNA(db, PLATFORM_ID);
  const resolvedSystemPrompt = mergeBrandDNAIntoSystemPrompt(SYSTEM_PROMPT, brandDNA);

  const existing = await db.collection(COLLECTION)
    .where('managerId', '==', MANAGER_ID)
    .where('industryKey', '==', INDUSTRY_KEY)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (!existing.empty && !force) {
    console.log(`✓ Content Manager GM already active: ${existing.docs[0].id} — skipping (pass --force to overwrite)`);
    process.exit(0);
  }

  if (force && !existing.empty) {
    const batch = db.batch();
    const now = new Date().toISOString();
    for (const doc of existing.docs) {
      batch.update(doc.ref, {
        isActive: false,
        deactivatedAt: now,
        deactivatedReason: 'superseded by --force reseed',
      });
    }
    await batch.commit();
    console.log(`  deactivated ${existing.docs.length} existing doc(s)`);
  }

  const now = new Date().toISOString();
  await db.collection(COLLECTION).doc(GM_ID).set({
    id: GM_ID,
    managerId: MANAGER_ID,
    managerName: 'Content Manager',
    version: 1,
    industryKey: INDUSTRY_KEY,
    config: {
      systemPrompt: resolvedSystemPrompt,
      model: 'openrouter/anthropic/claude-sonnet-4.6',
      temperature: 0.7,
      maxTokens: 3000,
    },
    systemPromptSnapshot: resolvedSystemPrompt,
    brandDNASnapshot: brandDNA,
    sourceImprovementRequestId: null,
    changesApplied: [],
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy: 'seed-content-manager-gm.js (conversational Content Manager — drives /api/content/assistant)',
    notes: 'Conversational Content Manager GM — the brain behind the Content Manager chat box (/api/content/assistant). Interprets the operator request, pauses for approval (intent protocol), then the route delegates the build to Video Specialist / Copywriter / Asset Generator / Music Planner. Brand DNA baked in at seed time per Standing Rule #1; the route loads this GM and uses its systemPrompt verbatim plus per-request runtime context.',
  });
  console.log(`✓ Seeded ${GM_ID}`);
  console.log(`  Collection: ${COLLECTION}`);
  console.log(`  Base prompt length: ${SYSTEM_PROMPT.length} chars`);
  console.log(`  Resolved prompt length: ${resolvedSystemPrompt.length} chars (base + Brand DNA)`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
