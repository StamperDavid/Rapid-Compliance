/**
 * Inbound DM Orchestration — direct path
 *
 * SCOPED EXCEPTION to the "everything goes through Jasper" rule. For
 * inbound social-media DMs ONLY, we skip Jasper's planning LLM and the
 * Marketing Manager's coordination layer because the intent is
 * machine-detected and fixed ("compose a reply to this incoming
 * message") — Jasper has nothing to interpret. The dispatcher calls the
 * platform specialist directly, captures the composed draft, and writes
 * a Mission record in COMPLETED state so Mission Control still owns
 * the approval surface.
 *
 * Does NOT apply to:
 *   - User-typed prompts in the Jasper chat (still full orchestration)
 *   - Scheduled campaigns / workflow runs / agent jobs
 *   - Any other inbound event type besides DMs (inbound SMS still
 *     goes through synthetic-trigger + full Jasper orchestration when
 *     that pipeline ships)
 *
 * Flow:
 *   1. Caller hands us a normalized inbound DM payload
 *   2. We call the platform specialist's compose_dm_reply action
 *   3. We synthesize a Mission record directly in Firestore with status
 *      COMPLETED, the composed reply attached to a single step, and
 *      sourceEvent populated for the operator + send-dm-reply endpoint
 *   4. We return the missionId and composed reply for the caller's logs
 *
 * The existing send-dm-reply endpoint and SendDmReplyButton in Mission
 * Control consume this Mission shape unchanged — they read sourceEvent
 * and walk steps for any toolResult containing composedReply.
 */

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type { Mission, MissionStep } from '@/lib/orchestrator/mission-persistence';
import { getBrandDNA } from '@/lib/brand/brand-dna-service';

export type InboundDmPlatform =
  | 'x'
  | 'bluesky'
  | 'linkedin'
  | 'facebook'
  | 'instagram'
  | 'pinterest';

const SPECIALIST_BY_PLATFORM: Record<InboundDmPlatform, string> = {
  x: 'TWITTER_X_EXPERT',
  bluesky: 'BLUESKY_EXPERT',
  linkedin: 'LINKEDIN_EXPERT',
  facebook: 'FACEBOOK_ADS_EXPERT',
  instagram: 'INSTAGRAM_EXPERT',
  pinterest: 'PINTEREST_EXPERT',
};

const SOURCE_EVENT_KIND_BY_PLATFORM: Record<InboundDmPlatform, NonNullable<import('@/lib/orchestrator/mission-persistence').Mission['sourceEvent']>['kind']> = {
  x: 'inbound_x_dm',
  bluesky: 'inbound_bluesky_dm',
  linkedin: 'inbound_linkedin_dm',
  facebook: 'inbound_facebook_dm',
  instagram: 'inbound_instagram_dm',
  pinterest: 'inbound_pinterest_dm',
};

const PLATFORM_LABELS: Record<InboundDmPlatform, string> = {
  x: 'X',
  bluesky: 'Bluesky',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  pinterest: 'Pinterest',
};

export interface InboundDmInput {
  platform: InboundDmPlatform;
  /** Stable id used for the Mission and inboundSocialEvents linkage */
  inboundEventId: string;
  /** The DM body */
  inboundText: string;
  /** Sender's platform-specific id (X numeric / Bluesky DID) — used by send-dm-reply */
  senderId: string;
  /** Sender's display @handle (optional) */
  senderHandle?: string;
}

export interface InboundDmOrchestrationResult {
  missionId: string;
  composedReply: string;
  reasoning: string;
  confidence: 'low' | 'medium' | 'high';
  suggestEscalation: boolean;
}

interface ComposeDmReplyData {
  replyText: string;
  reasoning: string;
  confidence: 'low' | 'medium' | 'high';
  suggestEscalation: boolean;
}

/**
 * Compose a reply via the platform specialist (no Jasper, no manager).
 * Returns the structured reply data — the caller is responsible for
 * persisting it into a mission via `createInboundDmMission`.
 */
async function composeReplyDirect(input: InboundDmInput): Promise<ComposeDmReplyData> {
  const brand = await getBrandDNA();
  const brandContext = brand ? {
    industry: brand.industry,
    toneOfVoice: brand.toneOfVoice,
    keyPhrases: brand.keyPhrases,
    avoidPhrases: brand.avoidPhrases,
  } : undefined;

  const message = {
    id: `inbound_dm_compose_${input.platform}_${input.inboundEventId}`,
    timestamp: new Date(),
    from: 'INBOUND_DM_DISPATCHER' as const,
    to: input.platform === 'bluesky' ? 'BLUESKY_EXPERT' : 'TWITTER_X_EXPERT',
    type: 'COMMAND' as const,
    priority: 'NORMAL' as const,
    payload: {
      action: 'compose_dm_reply' as const,
      platform: input.platform,
      inboundEventId: input.inboundEventId,
      inboundText: input.inboundText,
      senderId: input.senderId,
      ...(input.senderHandle ? { senderHandle: input.senderHandle } : {}),
      ...(brandContext ? { brandContext } : {}),
    },
    requiresResponse: true,
    traceId: `inbound_dm_${input.platform}_${input.inboundEventId}`,
  };

  // Resolve the platform-specific specialist via dynamic import. Each
  // specialist exposes a `get<Platform>Expert()` singleton getter that
  // implements BaseSpecialist; once initialized, calling
  // `expert.execute(message)` with payload.action='compose_dm_reply'
  // dispatches to the shared compose-dm-reply mixin.
  let expert: { initialize: () => Promise<void>; execute: (m: typeof message) => Promise<{ status: string; data?: unknown; errors?: string[] }> };
  switch (input.platform) {
    case 'x': {
      const m = await import('@/lib/agents/marketing/twitter/specialist');
      expert = m.getTwitterExpert();
      break;
    }
    case 'bluesky': {
      const m = await import('@/lib/agents/marketing/bluesky/specialist');
      expert = m.getBlueskyExpert();
      break;
    }
    case 'linkedin': {
      const m = await import('@/lib/agents/marketing/linkedin/specialist');
      expert = m.getLinkedInExpert();
      break;
    }
    case 'facebook': {
      const m = await import('@/lib/agents/marketing/facebook/specialist');
      expert = m.getFacebookAdsExpert();
      break;
    }
    case 'instagram': {
      const m = await import('@/lib/agents/marketing/instagram/specialist');
      expert = m.getInstagramExpert();
      break;
    }
    case 'pinterest': {
      const m = await import('@/lib/agents/marketing/pinterest/specialist');
      expert = m.getPinterestExpert();
      break;
    }
    default: {
      const _exhaustive: never = input.platform;
      throw new Error(`Unsupported inbound DM platform: ${String(_exhaustive)}`);
    }
  }

  await expert.initialize();
  const report = await expert.execute(message);
  if (report.status !== 'COMPLETED' || !report.data) {
    const errMsg = report.errors?.join('; ') ?? `${input.platform} specialist returned ${report.status}`;
    throw new Error(errMsg);
  }
  return report.data as ComposeDmReplyData;
}

/**
 * Run the full inbound-DM orchestration: compose the reply, persist a
 * COMPLETED Mission record so Mission Control surfaces the draft for
 * operator review, and link the inboundSocialEvents doc to the mission.
 *
 * Throws on any failure. The caller (the dispatcher cron) catches and
 * reports per-event outcome; one failure does not abort the rest of
 * the polling batch.
 */
export async function orchestrateInboundDmReply(input: InboundDmInput): Promise<InboundDmOrchestrationResult> {
  if (!adminDb) {
    throw new Error('adminDb not initialized');
  }

  const startedAt = new Date().toISOString();
  const composeStart = Date.now();
  const composed = await composeReplyDirect(input);
  const composeDurationMs = Date.now() - composeStart;
  const completedAt = new Date().toISOString();

  const specialistId = SPECIALIST_BY_PLATFORM[input.platform];
  const missionId = `mission_inbound_dm_${input.platform}_${input.inboundEventId}_${Date.now()}`;
  const conversationId = `conv_inbound_dm_${input.platform}_${input.inboundEventId}`;

  const stepResultPayload = {
    mode: 'INBOUND_DM_REPLY',
    platform: input.platform,
    inboundEventId: input.inboundEventId,
    inboundText: input.inboundText,
    senderId: input.senderId,
    ...(input.senderHandle ? { senderHandle: input.senderHandle } : {}),
    composedReply: composed,
    specialistsUsed: [specialistId],
  };

  const step: MissionStep = {
    stepId: `plan_step_${missionId}_1`,
    toolName: 'compose_dm_reply',
    delegatedTo: specialistId,
    status: 'COMPLETED',
    startedAt,
    completedAt,
    durationMs: composeDurationMs,
    summary: `${specialistId} composed a reply (${composed.confidence} confidence${composed.suggestEscalation ? ', escalation suggested' : ''})`,
    toolResult: JSON.stringify(stepResultPayload),
    operatorApproved: true,
    specialistsUsed: [specialistId],
  };

  const senderLabel = input.senderHandle ?? input.senderId.slice(0, 12);
  const platformLabel = PLATFORM_LABELS[input.platform];
  const mission: Mission = {
    missionId,
    conversationId,
    status: 'COMPLETED',
    title: `Reply to inbound ${platformLabel} DM from ${senderLabel}`,
    userPrompt: `Inbound ${platformLabel} DM from ${senderLabel}: "${input.inboundText.slice(0, 200)}"`,
    steps: [step],
    createdAt: startedAt,
    updatedAt: completedAt,
    completedAt,
    plannedAt: startedAt,
    sourceEvent: {
      kind: SOURCE_EVENT_KIND_BY_PLATFORM[input.platform],
      eventId: input.inboundEventId,
      senderId: input.senderId,
      ...(input.senderHandle ? { senderHandle: input.senderHandle } : {}),
    },
  };

  // Persist mission directly in Firestore
  const missionPath = getSubCollection('missions');
  await adminDb.collection(missionPath).doc(missionId).set(mission);

  logger.info('[inbound-dm-orchestration] Mission created', {
    missionId,
    platform: input.platform,
    inboundEventId: input.inboundEventId,
    composeDurationMs,
    confidence: composed.confidence,
    suggestEscalation: composed.suggestEscalation,
  });

  return {
    missionId,
    composedReply: composed.replyText,
    reasoning: composed.reasoning,
    confidence: composed.confidence,
    suggestEscalation: composed.suggestEscalation,
  };
}
