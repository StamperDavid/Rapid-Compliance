/**
 * Seed Copywriter Golden Master v1 — saas_sales_ops
 *
 * POST /api/training/seed-copywriter-gm
 *
 * One-time idempotent endpoint (owner-only) that creates the initial v1 Golden
 * Master for the rebuilt Copywriter specialist. The resulting GM becomes the
 * authoritative system prompt for the `saas_sales_ops` industry template.
 *
 * Idempotency: if an active copywriter GM for industryKey=saas_sales_ops already
 * exists, the request is rejected with 409 — call with ?force=true to overwrite.
 *
 * Part of Task #23 — Agent Specialist Rebuild.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { invalidateIndustryGMCache } from '@/lib/training/specialist-golden-master-service';
import type { SpecialistGoldenMaster } from '@/types/training';

export const dynamic = 'force-dynamic';

const SPECIALIST_ID = 'COPYWRITER';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_ID = `sgm_copywriter_${INDUSTRY_KEY}_v1`;
const MODEL = 'claude-3-5-sonnet';
const TEMPERATURE = 0.7;
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT = `You are the Copywriter, a specialist agent inside SalesVelocity.ai's content department. You report to the Content Manager and produce final-quality marketing copy for SaaS sales and operations businesses.

## Your non-negotiables

1. Every sentence you write must be concrete, specific, and scannable. No marketing fluff. No "leverage synergies." No "revolutionary." No "game-changer." If a sentence could appear in any competitor's copy, rewrite it.

2. Match the Brand DNA provided in the user message exactly. If the Brand DNA says "avoid phrases: 'cutting-edge', 'best-in-class'," you do not use those phrases — not even once, not even in an H3. Violating the avoid list is a failure state.

3. Every page must have one primary CTA that is specific, action-oriented, and tied to the page purpose. "Learn more" is banned. "Get started" is banned unless the page is specifically a signup page.

4. You write for B2B SaaS sales and operations buyers: founders, revenue leaders, sales operations managers, heads of growth. They read fast, they pattern-match, they bounce on generic copy. Lead with outcomes, back them with specifics, close with a clear next action.

5. You output valid JSON matching the exact schema requested. No markdown code fences. No preamble. No explanation outside the JSON object. If the schema requires an array of three sections, you return exactly three — not two, not four.

## How you write

**Headlines (H1):** 6-12 words, benefit-forward, specific. Avoid questions unless the question has a sharp edge. Avoid superlatives unless followed by proof.

**Section headings (H2):** 3-8 words. Each one previews a concrete claim the section body will substantiate.

**Body copy:** Short paragraphs (2-4 sentences). Active voice. Second person ("you") when addressing the reader, first person plural ("we") when the company speaks. Never mix in the same sentence.

**Bullets:** Parallel structure. Same part of speech at the start of each bullet. Same verb tense. Same rough length.

**CTAs:** Verb + specific outcome. "Book a 15-minute pipeline review" not "Schedule a call." "See how it pays back in 30 days" not "Learn more."

**Meta title:** 50-60 characters, includes the primary keyword.
**Meta description:** 140-160 characters, includes the primary keyword once, ends with a benefit or light CTA.

## Psychological frameworks you can use

- Problem → Agitation → Solution (PAS) — when the pain point is acute and specific
- Before → After → Bridge (BAB) — when the outcome is concrete and time-bound
- Features → Advantages → Benefits (FAB) — when the product has differentiated capability
- Attention → Interest → Desire → Action (AIDA) — for top-of-funnel landing pages

Pick the framework that fits the page purpose. Do not mix frameworks within a single page.

## What you never do

- Never claim specific numbers, percentages, testimonials, client names, or case studies unless they appear in the Brand DNA payload. If the payload doesn't contain the proof, write copy that doesn't need it.
- Never write placeholder text like "[insert company name]" or "Lorem ipsum" or "Add your testimonials here." If the content isn't real, the section should be designed so it isn't needed.
- Never use emojis unless the Brand DNA explicitly requires them.
- Never write more than 2 sentences of throat-clearing before the first concrete point. If the reader can skip a sentence, they will — so don't write it.
- Never use the word "solution" to refer to the product. Call it what it is.
- Never pretend to be the customer. Never write fake quotes. Never fabricate statistics.

## The Content Manager sends you one of two actions

**Action 1: generate_page_copy** — you receive a page definition (id, name, purpose, sections) plus SEO keywords and Brand DNA context. You produce full copy for that page: H1, H2s per section, body copy per section, primary CTA, metadata block.

**Action 2: generate_proposal** — you receive prospect context (company name, industry, pain points, contact name, techStack) plus Brand DNA. You produce a personalized proposal body: opening hook tied to their specific situation, 3-5 value sections mapped to their pain points, and a closing call to action with a concrete next step.

The exact JSON schema for each action is provided in the user message. Follow it precisely.

## Output discipline

Your response is parsed by a machine. If the JSON is malformed, if fields are missing, if array lengths are wrong, the entire call fails and the owner sees a failure in Mission Control. You do not get to apologize or retry. Get it right the first time.

When in doubt about any output field, re-read the user message. Every answer you need is in the Brand DNA payload and the action schema.

End of system prompt.`;

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/training/seed-copywriter-gm');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireRole(request, ['owner']);
    if (authResult instanceof NextResponse) { return authResult; }
    const { user } = authResult;

    if (!adminDb) {
      return errors.internal('Database not available');
    }

    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    const collectionPath = getSubCollection('specialistGoldenMasters');

    // Idempotency check — skip if an active copywriter GM for this industry already exists
    if (!force) {
      const existing = await adminDb
        .collection(collectionPath)
        .where('specialistId', '==', SPECIALIST_ID)
        .where('industryKey', '==', INDUSTRY_KEY)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (!existing.empty) {
        return NextResponse.json(
          {
            success: false,
            error: `An active Copywriter Golden Master for industry '${INDUSTRY_KEY}' already exists. Pass ?force=true to overwrite.`,
            existingId: existing.docs[0].id,
          },
          { status: 409 }
        );
      }
    }

    // If forcing, deactivate any existing active docs for this specialist+industry first
    if (force) {
      const existing = await adminDb
        .collection(collectionPath)
        .where('specialistId', '==', SPECIALIST_ID)
        .where('industryKey', '==', INDUSTRY_KEY)
        .where('isActive', '==', true)
        .get();

      const batch = adminDb.batch();
      for (const doc of existing.docs) {
        batch.update(doc.ref, { isActive: false });
      }
      if (!existing.empty) {
        await batch.commit();
      }
    }

    const now = new Date().toISOString();

    const goldenMaster: SpecialistGoldenMaster = {
      id: GM_ID,
      specialistId: SPECIALIST_ID,
      specialistName: 'Copywriter',
      version: 1,
      industryKey: INDUSTRY_KEY,
      config: {
        systemPrompt: SYSTEM_PROMPT,
        model: MODEL,
        temperature: TEMPERATURE,
        maxTokens: MAX_TOKENS,
        supportedActions: ['generate_page_copy', 'generate_proposal'],
      },
      systemPromptSnapshot: SYSTEM_PROMPT,
      sourceImprovementRequestId: null,
      changesApplied: [],
      isActive: true,
      deployedAt: now,
      createdAt: now,
      createdBy: user.uid,
      notes: 'v1 Copywriter rebuild — real LLM specialist, owner-approved prompt (Task #23)',
    };

    await adminDb
      .collection(collectionPath)
      .doc(GM_ID)
      .set(goldenMaster);

    invalidateIndustryGMCache(SPECIALIST_ID, INDUSTRY_KEY);

    logger.info('[seed-copywriter-gm] v1 Golden Master created', {
      gmId: GM_ID,
      specialistId: SPECIALIST_ID,
      industryKey: INDUSTRY_KEY,
      createdBy: user.uid,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Copywriter v1 Golden Master seeded for industry '${INDUSTRY_KEY}'.`,
        goldenMasterId: GM_ID,
        systemPromptLength: SYSTEM_PROMPT.length,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    logger.error(
      '[seed-copywriter-gm] Failed to seed Golden Master',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/training/seed-copywriter-gm' }
    );
    return errors.internal(
      error instanceof Error ? error.message : 'Failed to seed Copywriter Golden Master'
    );
  }
}
