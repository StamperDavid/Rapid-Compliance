/**
 * Contact Activity Summary API
 *
 * POST /api/crm/contacts/[contactId]/summary
 *
 * Generates an AI-written summary of where things stand with a contact based on
 * their recent activity history. Calls the REAL LLM (Claude via the unified AI
 * service); the Anthropic key is resolved from Firestore by apiKeyService inside
 * the provider — never from env. There is NO hardcoded/templated summary path.
 *
 * Part of the AI-forward CRM (benchmark: Reevo "Summarize activity").
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { getActivities } from '@/lib/crm/activity-service';
import { sendUnifiedChatMessage } from '@/lib/ai/unified-ai-service';
import { logger } from '@/lib/logger/logger';
import type { Activity } from '@/types/activity';

/** Latest Claude Sonnet — fast, high-quality for narrative summarization. */
const SUMMARY_MODEL = 'claude-sonnet-4.6';

/** Safely turn an activity's occurredAt (Timestamp | Date | string) into a Date. */
function activityDate(value: unknown): Date | null {
  if (value == null) { return null; }
  if (value instanceof Date) { return value; }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object') {
    const ts = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof ts.toDate === 'function') {
      try { return ts.toDate(); } catch { return null; }
    }
    if (typeof ts.seconds === 'number') { return new Date(ts.seconds * 1000); }
    if (typeof ts._seconds === 'number') { return new Date(ts._seconds * 1000); }
  }
  return null;
}

/** Render one activity as a compact, LLM-friendly line. */
function formatActivityLine(activity: Activity): string {
  const date = activityDate(activity.occurredAt);
  const when = date ? date.toISOString().split('T')[0] : 'unknown date';
  const direction = activity.direction ? ` (${activity.direction})` : '';
  const subject = activity.subject ? ` — ${activity.subject}` : '';
  const body = activity.body ? `: ${activity.body.slice(0, 280)}` : '';
  return `- [${when}] ${activity.type}${direction}${subject}${body}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const { contactId } = await params;

    logger.info('Generating contact activity summary', {
      contactId,
      userId: user.uid,
    });

    // Pull the most recent activities for this contact.
    const { data: activities } = await getActivities(
      { entityType: 'contact', entityId: contactId },
      { pageSize: 50 }
    );

    // No-activity case: respond gracefully with a plain-English message rather
    // than calling the LLM with nothing to summarize.
    if (activities.length === 0) {
      return NextResponse.json({
        success: true,
        summary:
          "There's no recorded activity for this contact yet, so there's nothing to summarize. Once you log a call, email, meeting, or note, you'll be able to generate a summary here.",
      });
    }

    // Build the prompt from the real activity history (most recent first).
    const activityLog = activities.map(formatActivityLine).join('\n');

    const systemInstruction =
      'You are a sales operations analyst. You read a contact\'s raw CRM activity ' +
      'history and explain, in plain English, where the relationship stands. Be ' +
      'concise and concrete. Never invent facts that are not in the activity log.';

    const userPrompt =
      'Summarize where things stand with this contact based on the activity ' +
      'history below. Call out the current momentum (heating up, stalling, or ' +
      'cold), any risks, and the single most obvious next step. Keep it to a ' +
      'short paragraph or a few tight bullet points.\n\n' +
      `Activity history (most recent first):\n${activityLog}`;

    const response = await sendUnifiedChatMessage({
      model: SUMMARY_MODEL,
      systemInstruction,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.4,
      maxTokens: 600,
    });

    const summary = response.text.trim();

    if (!summary) {
      throw new Error('AI returned an empty summary');
    }

    logger.info('Contact activity summary generated', {
      contactId,
      userId: user.uid,
      activityCount: activities.length,
      model: response.model,
      provider: response.provider,
    });

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    logger.error(
      'Failed to generate contact activity summary',
      error instanceof Error ? error : new Error(String(error))
    );

    const errorMessage =
      error instanceof Error ? error.message : 'Failed to generate summary';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
