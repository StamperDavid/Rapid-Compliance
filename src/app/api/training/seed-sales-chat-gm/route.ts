/**
 * Seed Sales Chat (Alex) Golden Master v1
 *
 * POST /api/training/seed-sales-chat-gm
 *
 * One-time idempotent endpoint (owner-only) that creates the initial v1 Golden
 * Master for Alex, the customer-facing sales chat agent. The resulting GM
 * captures the hardcoded specialist system prompt and the platform product
 * knowledge as a stable Training Lab baseline.
 *
 * Idempotency: if an active sales_chat GM already exists the request is
 * rejected with 409 — call with ?force=true to overwrite.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { SYSTEM_PROMPT } from '@/lib/agents/sales-chat/specialist';
import { OUR_PRODUCT_KNOWLEDGE } from '@/lib/our-agent/product-knowledge';
import type { GoldenMaster, AgentPersona, BehaviorConfig, KnowledgeBase, OnboardingData, FAQ } from '@/types/agent-memory';

export const dynamic = 'force-dynamic';

const GM_ID = 'gm_sales_chat_v1';

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/training/seed-sales-chat-gm');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireRole(request, ['owner']);
    if (authResult instanceof NextResponse) { return authResult; }
    const { user } = authResult;

    if (!adminDb) {
      return errors.internal('Database not available');
    }

    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    const collectionPath = getSubCollection('goldenMasters');

    // Idempotency check — skip if an active sales_chat GM already exists
    if (!force) {
      const existing = await adminDb
        .collection(collectionPath)
        .where('agentType', '==', 'sales_chat')
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (!existing.empty) {
        return NextResponse.json(
          {
            success: false,
            error: 'An active sales chat Golden Master already exists. Pass ?force=true to overwrite.',
            existingId: existing.docs[0].id,
          },
          { status: 409 }
        );
      }
    }

    const now = new Date().toISOString();

    // Combine specialist system prompt with product knowledge as a second layer
    const systemPrompt = [
      '# Layer 1: Sales Chat Specialist Directive',
      SYSTEM_PROMPT,
      '',
      '# Layer 2: Platform Product Knowledge',
      OUR_PRODUCT_KNOWLEDGE,
    ].join('\n');

    const agentPersona: AgentPersona = {
      name: 'Alex',
      tone: 'approachable, knowledgeable, and solution-focused',
      greeting: "Hey! I'm Alex from SalesVelocity. What can I help you with?",
      closingMessage: 'Ready to get started? I can walk you through the free trial right now.',
      objectives: [
        'Qualify leads using the BANT framework (Budget, Authority, Need, Timeline)',
        'Answer product and pricing questions accurately using platform knowledge',
        'Guide interested prospects to start the 14-day free trial',
        'Schedule demos for enterprise or complex prospects',
        'Handle objections with empathy and ROI-focused responses',
      ],
      can_negotiate: false,
      escalationRules: [
        'Prospect requests custom pricing or contract terms → offer to connect with the sales team',
        'Technical question exceeds knowledge base → offer support escalation',
        'Prospect expresses frustration or distress → escalate to human immediately',
        'Feature request for something the platform lacks → acknowledge honestly and log',
      ],
    };

    const behaviorConfig: BehaviorConfig = {
      closingAggressiveness: 3,
      questionFrequency: 3,
      responseLength: 'concise',
      proactiveLevel: 6,
      idleTimeoutMinutes: 30,
    };

    // Seed FAQs from the common questions in product knowledge
    const faqs: FAQ[] = [
      {
        id: 'faq_pricing',
        question: 'How much does it cost?',
        answer: 'Pricing is CRM slot-based: Tier 1 $400/mo (0-100 records), Tier 2 $650/mo (101-250), Tier 3 $1,000/mo (251-500), Tier 4 $1,250/mo (501-1,000). All features included on every tier — you only pay for how many records you store. BYOK (Bring Your Own Keys) means you pay raw market rates for AI compute with no markup.',
        category: 'pricing',
        keywords: ['price', 'cost', 'plan', 'tier', 'subscription', 'monthly'],
      },
      {
        id: 'faq_setup',
        question: 'How long does setup take?',
        answer: 'Most customers are fully live in under an hour: 5 minutes for the onboarding wizard, 30 minutes to train your agent, then deploy immediately.',
        category: 'onboarding',
        keywords: ['setup', 'time', 'onboarding', 'start', 'deploy', 'how long'],
      },
      {
        id: 'faq_trial',
        question: 'Is there a free trial?',
        answer: '14 days free with full access to all features. Credit card required. Cancel any time before the trial ends.',
        category: 'trial',
        keywords: ['trial', 'free', 'try', 'demo', 'test'],
      },
      {
        id: 'faq_crm',
        question: 'Do I need a separate CRM?',
        answer: 'No. SalesVelocity.ai includes a fully built-in CRM with 20+ field types, Kanban/Calendar/Table views, and relationship support. It replaces external CRMs — you do not need Salesforce or HubSpot.',
        category: 'features',
        keywords: ['crm', 'salesforce', 'hubspot', 'contacts', 'pipeline'],
      },
      {
        id: 'faq_difference',
        question: 'How is this different from a chatbot?',
        answer: 'Traditional chatbots follow scripts and forget everything. Our AI agent is trained on your specific business, remembers every customer interaction via Customer Memory, and improves with your feedback. It\'s a trained sales partner, not a scripted bot.',
        category: 'differentiation',
        keywords: ['chatbot', 'different', 'vs', 'compare', 'bot'],
      },
    ];

    const knowledgeBase: KnowledgeBase = {
      documents: [],
      urls: [],
      faqs,
      brandVoice: {
        tone: 'Professional yet approachable — like a knowledgeable colleague, not a salesperson',
        keyMessages: [
          'SalesVelocity.ai replaces your entire sales tech stack in one platform',
          'All features included on every tier — pricing is purely CRM slot-based',
          'BYOK means zero AI markup — you pay raw market rates',
          '14-day free trial, cancel any time',
        ],
        commonPhrases: [
          'What specific challenge are you trying to solve?',
          'Let\'s look at which tier fits your current record count',
          'You can start the free trial right now — full access, no limits',
        ],
      },
    };

    // Minimal businessContext satisfying the OnboardingData required fields
    const businessContext: OnboardingData = {
      businessName: 'SalesVelocity.ai',
      industry: 'SaaS / AI Platform',
      problemSolved: 'Eliminates fragmented sales tools by providing an AI-powered sales agent, CRM, workflow automation, and e-commerce in one platform',
      uniqueValue: 'Trainable AI sales agent with Customer Memory — gets smarter with every conversation, works 24/7, and never forgets a customer',
      targetCustomer: 'SMB and mid-market businesses (10-500 employees) — e-commerce, SaaS, service businesses, and B2B companies needing AI-powered lead qualification and sales automation',
      topProducts: 'SalesVelocity.ai — AI Sales Agent, built-in CRM, workflow automation, e-commerce engine, lead scraper, email sequences, white-label options',
      priceRange: '$400–$1,250/month (Tier 1-4 based on CRM record count), Enterprise custom pricing',
    };

    const goldenMaster: GoldenMaster = {
      id: GM_ID,
      version: 'v1',
      baseModelId: 'system_seed',
      agentType: 'sales_chat',
      businessContext,
      agentPersona,
      behaviorConfig,
      knowledgeBase,
      systemPrompt,
      trainedScenarios: [],
      trainingCompletedAt: now,
      trainingScore: 100,
      isActive: true,
      deployedAt: now,
      createdBy: user.uid,
      createdAt: now,
      notes: 'Seeded from hardcoded specialist prompt and product knowledge — behaviorally identical to the pre-Training-Lab baseline.',
    };

    await adminDb
      .collection(collectionPath)
      .doc(GM_ID)
      .set(goldenMaster);

    logger.info('[seed-sales-chat-gm] v1 Golden Master created', {
      gmId: GM_ID,
      createdBy: user.uid,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Sales chat (Alex) v1 Golden Master seeded successfully.',
        goldenMasterId: GM_ID,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    logger.error(
      '[seed-sales-chat-gm] Failed to seed Golden Master',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/training/seed-sales-chat-gm' }
    );
    return errors.internal(
      error instanceof Error ? error.message : 'Failed to seed sales chat Golden Master'
    );
  }
}
