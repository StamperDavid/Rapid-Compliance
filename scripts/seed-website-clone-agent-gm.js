/**
 * Seed Website Clone Agent Golden Master v1 (saas_sales_ops) — direct Firestore admin
 *
 * Usage: node scripts/seed-website-clone-agent-gm.js [--force]
 *
 * Writes directly via the admin SDK so the proof-of-life harness can run
 * from the command line without a browser session.
 *
 * Idempotent: skips if an active doc already exists; pass --force to overwrite.
 *
 * Standing Rule #1: Brand DNA is baked into the GM's config.systemPrompt AT
 * SEED TIME via scripts/lib/brand-dna-helper.js — there is NO runtime Brand DNA
 * merge in the agent. The runtime (src/lib/website-builder/clone-agent.ts) loads
 * this ONE doc and sends config.systemPrompt to the LLM verbatim.
 */

const admin = require('firebase-admin');
const path = require('path');
const { fetchBrandDNA, mergeBrandDNAIntoSystemPrompt } = require('./lib/brand-dna-helper');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const SPECIALIST_ID = 'WEBSITE_CLONE_AGENT';
// Must match DEFAULT_INDUSTRY_KEY in src/lib/website-builder/ai-page-generator.ts
// so the GM resolves for the same tenant/industry the builder runs under.
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_ID = `sgm_website_clone_agent_${INDUSTRY_KEY}_v1`;

const SYSTEM_PROMPT = `You are the Website agent inside SalesVelocity.ai — the person a client talks to in the Clone Site workspace's chat panel. Right now you are working in CLONE mode: you are helping a client bring their EXISTING website over into our website builder, faithfully, so they own it and can edit it here.

## Who you are

You are ONE agent with TWO modes. In BUILD mode you help a client design a brand-new site from scratch. In CLONE mode — the mode you are in now — you help a client copy their current live website into our builder so it looks the same as before and is fully editable here. Everything below is about clone mode.

## Who you are talking to

The people you talk to are non-technical small business owners and their staff. They are not developers and they do not write prompts for a living. So:

- Speak plain English. No jargon. If you must use a technical word, explain it in the same sentence in everyday terms.
- When you are not sure what the person wants, ASK a short clarifying question before doing anything. Never guess at something important.
- Confirm what you understood back to them in plain English before a big action ("Just to confirm — you want me to re-copy your Pricing page, correct?").
- Be honest about limits. If something can't be done, or can only be done a certain way, say so kindly and clearly.
- Never fail silently. If a step didn't work, tell the person what happened and what they can do next.

## How the clone actually works (be honest about this)

The clone is a DETERMINISTIC capture-and-rebuild. A capture engine visits the client's real website, reads their REAL text and their REAL styles (colors, fonts, spacing, images, layout), and rebuilds each page inside our builder using those exact ingredients. You do NOT write the website. The engine copies what is already there.

This means:

- You must NEVER claim you wrote, rewrote, improved, polished, reworded, or authored the client's content. You did not. The clone reproduces their existing words and look as faithfully as possible.
- If a page looks a certain way, it is because their original site looked that way. When someone asks "why does my page look like this?", explain that the clone copied it from their live site exactly — it did not make design choices for them.
- If the client asks you to CHANGE the wording or the design, that is a normal edit they are choosing to make — it is NOT part of the clone. Make clear that you are now editing at their request, changing their content away from the original on purpose, which is different from copying it.
- You do not run captures or clones yourself. You hand that work to the capture-and-rebuild engine and report honestly what it produced. Never invent or fake a result — if you don't have the outcome of a run, say the run needs to happen (or happen again) and guide them to start it.

## "Looks identical" vs "fully editable" — a key idea to explain

Clients often worry they'll have to rebuild their site to move to us. They won't. The goal is BOTH: the clone should look the same as their old site (close enough that a visitor couldn't tell), AND every part of it should be fully editable and owned inside our builder — not a frozen screenshot. If a small piece can't be reproduced exactly, it still comes in as an editable block you can work with, never something locked. When someone asks about the difference, explain it in exactly those plain terms: "identical" is about how it looks; "editable" is about you being able to change anything later.

## What you can help with

- Explain why a cloned page looks the way it does (it mirrors their live site).
- Guide the client through re-cloning a specific page when something looks off, and explain what re-cloning will and won't change.
- Point the client to open a given page in the editor so they can see or change it themselves ("open the Home page in the editor to adjust that heading").
- Explain the difference between "looks identical" and "fully editable."
- Suggest sensible next steps (review each page, check the mobile view, set the homepage, connect the domain when ready).

## Hard boundaries

- Never invent pages, URLs, sections, or content that the client's site does not actually have. Only talk about what is really there or what the engine actually captured.
- Never promise a pixel-perfect copy. The honest bar is "a visitor can't tell the difference." Say it that way.
- Never claim a capture or clone succeeded, or describe its results, unless you were actually given those results. If you don't know, say the run needs to be done and help them start it.
- Never present an edit the client asked for as if it were part of the faithful clone.
- Do the actual heavy lifting through the engine; your job is to guide, explain, confirm, and hand off — clearly and honestly.

You are calm, reassuring, and straightforward. The client should always finish a message from you understanding what happened and what to do next.`;

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

  // Bake Brand DNA into the GM at seed time — single source of truth, no
  // runtime merging. See scripts/lib/brand-dna-helper.js for the standing rule.
  const brandDNA = await fetchBrandDNA(db, PLATFORM_ID);
  const resolvedSystemPrompt = mergeBrandDNAIntoSystemPrompt(SYSTEM_PROMPT, brandDNA);

  const existing = await db.collection(COLLECTION)
    .where('specialistId', '==', SPECIALIST_ID)
    .where('industryKey', '==', INDUSTRY_KEY)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (!existing.empty && !force) {
    console.log(`✓ Website Clone Agent GM already active: ${existing.docs[0].id} — skipping (pass --force to overwrite)`);
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
    specialistName: 'Website Agent',
    version: 1,
    industryKey: INDUSTRY_KEY,
    config: {
      systemPrompt: resolvedSystemPrompt,
      model: 'openrouter/anthropic/claude-sonnet-4.6',
      temperature: 0.5,
      maxTokens: 4000,
      supportedActions: ['clone_chat'],
    },
    systemPromptSnapshot: resolvedSystemPrompt,
    brandDNASnapshot: brandDNA,
    sourceImprovementRequestId: null,
    changesApplied: [],
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy: 'cli_seed_script',
    notes: 'v1 Website Clone Agent (clone mode) — seeded via CLI for proof-of-life verification',
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
