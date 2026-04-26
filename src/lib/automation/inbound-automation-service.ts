/**
 * Inbound Automation Config Service
 *
 * Per-channel auto-approve toggles for inbound-event-driven missions.
 * Default for every flag is `false` — every inbound DM/comment/etc. goes
 * through full Mission Control review until the operator has graded
 * enough live runs to trust the agent at that channel.
 *
 * The toggle skips OPERATOR GATES only (plan approval + per-step
 * approval). The Jasper → manager → specialist delegation path itself
 * is unchanged whether the toggle is on or off, per
 * `feedback_no_jasper_bypass_even_for_simple_replies`.
 *
 * Doc path: `organizations/{PLATFORM_ID}/automation/inbound`
 *
 * Schema:
 * ```
 * {
 *   xDmReply: {
 *     autoApprove: boolean,       // default false
 *     updatedAt?: string,
 *     updatedBy?: string,
 *   },
 *   // future: smsReply, instagramComment, linkedinDmReply, ...
 * }
 * ```
 */

import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

const DOC_PATH = (): string => `organizations/${PLATFORM_ID}/automation`;
const DOC_ID = 'inbound';

export interface ChannelAutoApprove {
  autoApprove: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface InboundAutomationConfig {
  xDmReply: ChannelAutoApprove;
}

const DEFAULT_CONFIG: InboundAutomationConfig = {
  xDmReply: { autoApprove: false },
};

function normalizeChannel(raw: unknown): ChannelAutoApprove {
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    return {
      autoApprove: r.autoApprove === true,
      ...(typeof r.updatedAt === 'string' ? { updatedAt: r.updatedAt } : {}),
      ...(typeof r.updatedBy === 'string' ? { updatedBy: r.updatedBy } : {}),
    };
  }
  return { autoApprove: false };
}

/**
 * Read the current inbound-automation config. Returns sensible defaults
 * (everything off) when the doc does not yet exist — no auto-approval
 * happens until the operator explicitly opts in via the settings page.
 */
export async function getInboundAutomationConfig(): Promise<InboundAutomationConfig> {
  if (!adminDb) {
    logger.warn('[inbound-automation-service] adminDb not available — returning defaults');
    return DEFAULT_CONFIG;
  }
  try {
    const snap = await adminDb.collection(DOC_PATH()).doc(DOC_ID).get();
    if (!snap.exists) { return DEFAULT_CONFIG; }
    const data = snap.data() as Record<string, unknown>;
    return {
      xDmReply: normalizeChannel(data.xDmReply),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      '[inbound-automation-service] getInboundAutomationConfig failed — falling back to defaults',
      err instanceof Error ? err : new Error(msg),
    );
    return DEFAULT_CONFIG;
  }
}

/**
 * Patch a single channel's auto-approve flag. Operator-only — the
 * settings API route gates this on requireRole(['owner', 'admin']).
 */
export async function setChannelAutoApprove(input: {
  channel: keyof InboundAutomationConfig;
  autoApprove: boolean;
  actorUid: string;
}): Promise<boolean> {
  if (!adminDb) { return false; }
  try {
    const ref = adminDb.collection(DOC_PATH()).doc(DOC_ID);
    const now = new Date().toISOString();
    await ref.set(
      {
        [input.channel]: {
          autoApprove: input.autoApprove,
          updatedAt: now,
          updatedBy: input.actorUid,
        },
      },
      { merge: true },
    );
    logger.info('[inbound-automation-service] channel auto-approve updated', {
      channel: input.channel,
      autoApprove: input.autoApprove,
      actorUid: input.actorUid,
    });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      '[inbound-automation-service] setChannelAutoApprove failed',
      err instanceof Error ? err : new Error(msg),
      { channel: input.channel },
    );
    return false;
  }
}
