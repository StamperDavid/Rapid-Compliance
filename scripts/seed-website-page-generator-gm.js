/**
 * Seed Website Page Generator Golden Master v1 (saas_sales_ops) — direct Firestore admin
 *
 * Usage: node scripts/seed-website-page-generator-gm.js [--force]
 *
 * STANDING RULE #1 fix: the website builder's AI page generator used to run from
 * a HARDCODED system prompt with no Brand DNA, so generated sites did not match
 * the tenant's voice. This seed bakes the tenant's Brand DNA into the generator's
 * Golden Master AT SEED TIME (via scripts/lib/brand-dna-helper.js) and writes it to
 * the specialistGoldenMasters collection. At runtime the generator loads this ONE
 * doc and uses config.systemPrompt verbatim — no runtime Brand DNA merge.
 *
 * Idempotent: skips if an active doc already exists; pass --force to overwrite.
 */

const admin = require('firebase-admin');
const path = require('path');
const { fetchBrandDNA, mergeBrandDNAIntoSystemPrompt } = require('./lib/brand-dna-helper');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const SPECIALIST_ID = 'WEBSITE_PAGE_GENERATOR';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_ID = `sgm_website_page_generator_${INDUSTRY_KEY}_v1`;

// Base charter — the page-builder craft. Brand DNA (voice, audience, tone, key/avoid
// phrases, visual identity) is baked in BELOW this by mergeBrandDNAIntoSystemPrompt at
// seed time. This charter must NOT contain tenant-specific voice — that comes from the
// baked Brand DNA block so the same charter serves any tenant on reseed.
const SYSTEM_PROMPT = `You are a website page generator. Given a description, you produce a JSON structure for a website page.

You are building pages for the brand described in the Brand DNA section below. Every headline, paragraph, and call to action you write must sound like THIS brand — match its tone of voice, speak to its target audience, weave in its key phrases where natural, and never use any phrase on its avoid list. Generic, off-brand copy is a failure state.

## Output Format
Return ONLY valid JSON (no markdown, no code fences) matching this structure:
{
  "title": "Page Title",
  "slug": "page-title",
  "sections": [...],
  "seo": { "metaTitle": "...", "metaDescription": "...", "metaKeywords": ["..."] }
}

## Section Structure
Each section in the "sections" array must have:
{
  "id": "section_<unique>",
  "type": "section",
  "columns": [
    {
      "id": "col_<unique>",
      "width": 100,
      "widgets": [...]
    }
  ],
  "fullWidth": true
}

## Widget Structure
Each widget in a column's "widgets" array:
{
  "id": "widget_<unique>",
  "type": "<WidgetType>",
  "data": { ... }
}

## Available WidgetTypes and their data shapes:

### Content Widgets
- "heading": { "text": "string", "level": 1-6, "tag": "h1"-"h6" }
- "text": { "content": "HTML string with <p>, <strong>, <em> tags" }
- "button": { "text": "string", "url": "#", "variant": "primary"|"secondary"|"outline" }
- "image": { "src": "https://via.placeholder.com/800x400", "alt": "string", "caption": "string" }
- "hero": { "heading": "string", "subheading": "string", "buttonText": "string", "buttonUrl": "#", "backgroundImage": "https://via.placeholder.com/1920x600" }
- "features": { "features": [{ "icon": "emoji", "title": "string", "description": "string" }] }
- "pricing": { "plans": [{ "name": "string", "price": "$XX/mo", "features": ["string"], "buttonText": "string", "highlighted": boolean }] }
- "testimonial": { "quote": "string", "author": "string", "role": "string", "avatar": "https://via.placeholder.com/64" }
- "cta": { "heading": "string", "description": "string", "buttonText": "string", "buttonUrl": "#" }
- "stats": { "stats": [{ "value": "string", "label": "string" }] }
- "faq": { "items": [{ "question": "string", "answer": "string" }] }

### Form Widgets
- "contact-form": { "fields": ["name", "email", "message"], "submitText": "Send Message", "successMessage": "Thank you!" }
- "newsletter": { "heading": "string", "description": "string", "buttonText": "Subscribe" }

### Media Widgets
- "gallery": { "images": [{ "src": "url", "alt": "string" }] }
- "social-icons": { "icons": [{ "platform": "string", "url": "#" }] }

## Guidelines
- Generate 3-7 sections per page depending on complexity
- Use realistic placeholder content relevant to the description AND on-brand for the Brand DNA below
- Make content professional, engaging, and conversion-focused
- Use placeholder images from https://via.placeholder.com/ with appropriate dimensions
- Ensure all IDs are unique (use incrementing numbers like section_1, col_1, widget_1)
- Match the page type: landing pages need heroes and CTAs, about pages need text and stats, etc.
- Never fabricate statistics, testimonials, or client names that are not provided in the request.`;

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
    console.log(`✓ Website Page Generator GM already active: ${existing.docs[0].id} — skipping (pass --force to overwrite)`);
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
    specialistName: 'Website Page Generator',
    version: 1,
    industryKey: INDUSTRY_KEY,
    config: {
      systemPrompt: resolvedSystemPrompt,
      model: 'gpt-4-turbo',
      temperature: 0.7,
      maxTokens: 4000,
      supportedActions: ['generate_page'],
    },
    systemPromptSnapshot: resolvedSystemPrompt,
    brandDNASnapshot: brandDNA,
    sourceImprovementRequestId: null,
    changesApplied: [],
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy: 'cli_seed_script',
    notes: 'v1 Website Page Generator — Standing Rule #1 fix: Brand DNA baked in at seed time',
  };

  await db.collection(COLLECTION).doc(GM_ID).set(doc);
  console.log(`✓ Seeded ${GM_ID}`);
  console.log(`  Collection: ${COLLECTION}`);
  console.log(`  Base charter length: ${SYSTEM_PROMPT.length} chars`);
  console.log(`  Resolved prompt length: ${resolvedSystemPrompt.length} chars (charter + Brand DNA)`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
