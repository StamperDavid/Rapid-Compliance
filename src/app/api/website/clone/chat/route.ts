import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { runCloneAgentChat } from '@/lib/website-builder/clone-agent';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/website/clone/chat
 *
 * The chat endpoint for the Website Clone Agent — the conversational agent the
 * client talks to in the Clone Site workspace's chat panel.
 *
 * Auth-gated. Validates the body with Zod, delegates the turn to
 * runCloneAgentChat (which loads the Golden Master with Brand DNA baked in —
 * Standing Rule #1), and returns the reply plus `specialistId` so a human grade
 * can be routed to WEBSITE_CLONE_AGENT via the training loop (Standing Rule #2).
 */

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});

const requestSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z.array(chatMessageSchema).max(50).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid request: please provide a message (1–4000 characters).' },
        { status: 400 },
      );
    }

    const { message, history } = parsed.data;

    const result = await runCloneAgentChat({ message, history });

    return NextResponse.json({
      success: true,
      reply: result.reply,
      // Exposed so replies are gradeable via the training loop (Standing Rule #2).
      specialistId: result.specialistId,
    });
  } catch (error: unknown) {
    logger.error(
      'Website clone agent chat error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/website/clone/chat' },
    );
    const message = error instanceof Error ? error.message : 'The website assistant is unavailable right now. Please try again.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
