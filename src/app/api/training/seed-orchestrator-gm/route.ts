/**
 * Seed Orchestrator Golden Master v1
 *
 * POST /api/training/seed-orchestrator-gm
 *
 * One-time idempotent endpoint (owner-only) that creates the initial v1 Golden
 * Master for the Jasper orchestrator agent. The resulting GM is behaviorally
 * identical to the current hardcoded system prompts so Training Lab has a
 * stable baseline to branch from.
 *
 * Idempotency: if an active orchestrator GM already exists the request is
 * rejected with 409 — call with ?force=true to overwrite.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { JASPER_THOUGHT_PARTNER_PROMPT } from '@/lib/orchestrator/jasper-thought-partner';
import { ADMIN_ORCHESTRATOR_PROMPT } from '@/lib/orchestrator/feature-manifest';
import type { GoldenMaster, AgentPersona, BehaviorConfig, KnowledgeBase, OnboardingData } from '@/types/agent-memory';

export const dynamic = 'force-dynamic';

const GM_ID = 'gm_orchestrator_v1';

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/training/seed-orchestrator-gm');
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

    // Idempotency check — skip if an active orchestrator GM already exists
    if (!force) {
      const existing = await adminDb
        .collection(collectionPath)
        .where('agentType', '==', 'orchestrator')
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (!existing.empty) {
        return NextResponse.json(
          {
            success: false,
            error: 'An active orchestrator Golden Master already exists. Pass ?force=true to overwrite.',
            existingId: existing.docs[0].id,
          },
          { status: 409 }
        );
      }
    }

    const now = new Date().toISOString();

    // Combine both prompt layers into a single systemPrompt snapshot
    const systemPrompt = [
      '# Layer 1: Thought Partner Sovereignty',
      JASPER_THOUGHT_PARTNER_PROMPT,
      '',
      '# Layer 2: Admin Orchestrator Directive',
      ADMIN_ORCHESTRATOR_PROMPT,
    ].join('\n');

    const agentPersona: AgentPersona = {
      name: 'Jasper',
      tone: 'direct, strategic, and confident',
      greeting: 'Hey! What are we working on?',
      closingMessage: 'On it.',
      objectives: [
        'Delegate all work to agent teams immediately — never execute tasks directly',
        'Report tool results with clickable review links after every delegation',
        'Surface the highest-ROI action based on verified platform data',
        'Never hallucinate — call tools first, speak from results',
        'Guide the owner through the full platform as a trusted business partner',
      ],
      can_negotiate: false,
      escalationRules: [
        'Escalate to human when a tool returns a fatal error not actionable by the owner',
        'Never auto-retry a paid API call without user acknowledgment',
      ],
    };

    const behaviorConfig: BehaviorConfig = {
      closingAggressiveness: 0,
      questionFrequency: 2,
      responseLength: 'balanced',
      proactiveLevel: 9,
      idleTimeoutMinutes: 60,
    };

    const knowledgeBase: KnowledgeBase = {
      documents: [],
      urls: [],
      faqs: [],
    };

    // Minimal businessContext satisfying the OnboardingData required fields
    const businessContext: OnboardingData = {
      businessName: 'SalesVelocity.ai',
      industry: 'SaaS / AI Platform',
      problemSolved: 'Replaces fragmented sales, marketing, and operations tools with a single AI-orchestrated platform',
      uniqueValue: 'A 50+ agent AI swarm commanded by Jasper — one partner, every department',
      targetCustomer: 'SMB and mid-market businesses seeking AI-driven sales and marketing automation',
      topProducts: 'SalesVelocity.ai platform — CRM, AI agents, video, social, email, website builder, e-commerce',
    };

    const goldenMaster: GoldenMaster = {
      id: GM_ID,
      version: 'v1',
      baseModelId: 'system_seed',
      agentType: 'orchestrator',
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
      notes: 'Seeded from hardcoded system prompts — behaviorally identical to the pre-Training-Lab baseline.',
    };

    await adminDb
      .collection(collectionPath)
      .doc(GM_ID)
      .set(goldenMaster);

    logger.info('[seed-orchestrator-gm] v1 Golden Master created', {
      gmId: GM_ID,
      createdBy: user.uid,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Orchestrator v1 Golden Master seeded successfully.',
        goldenMasterId: GM_ID,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    logger.error(
      '[seed-orchestrator-gm] Failed to seed Golden Master',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/training/seed-orchestrator-gm' }
    );
    return errors.internal(
      error instanceof Error ? error.message : 'Failed to seed orchestrator Golden Master'
    );
  }
}
