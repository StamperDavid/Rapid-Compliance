/**
 * Jasper Command API Endpoint
 *
 * POST /api/orchestrator/command
 *   Issue a command to any manager, override decisions, or set objectives.
 *   Body: { action: 'issue' | 'override' | 'set-objective', ... }
 *
 * GET /api/orchestrator/command?limit=50
 *   Returns recent command history.
 *
 * Authentication: Required (owner or admin)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getJasperCommandAuthority } from '@/lib/orchestrator/jasper-command-authority';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const IssueCommandSchema = z.object({
  action: z.literal('issue'),
  targetManager: z.string().min(1),
  command: z.string().min(1),
  parameters: z.record(z.unknown()).default({}),
  priority: z.enum(['NORMAL', 'HIGH', 'CRITICAL']).default('NORMAL'),
});

const OverrideSchema = z.object({
  action: z.literal('override'),
  targetManager: z.string().min(1),
  overrideType: z.string().min(1),
  details: z.record(z.unknown()).default({}),
});

const ObjectiveSchema = z.object({
  action: z.literal('set-objective'),
  targetManager: z.string().min(1),
  objective: z.string().min(1),
  timeframe: z.string().min(1),
  target: z.string().min(1),
});

const CommandSchema = z.discriminatedUnion('action', [
  IssueCommandSchema,
  OverrideSchema,
  ObjectiveSchema,
]);

export async function GET(request: NextRequest) {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);

    const authority = getJasperCommandAuthority();
    const history = authority.getCommandHistory(limit);

    return NextResponse.json({
      success: true,
      commands: history.map(cmd => ({
        ...cmd,
        issuedAt: cmd.issuedAt.toISOString(),
      })),
      count: history.length,
    });
  } catch (error: unknown) {
    logger.error(
      'Command history fetch failed',
      error instanceof Error ? error : undefined,
      { route: '/api/orchestrator/command' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to fetch command history' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body: unknown = await request.json();
    const parsed = CommandSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid command', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const authority = getJasperCommandAuthority();
    const data = parsed.data;

    switch (data.action) {
      case 'issue': {
        const result = await authority.issueCommand(
          data.targetManager,
          data.command,
          data.parameters,
          data.priority
        );
        return NextResponse.json({ success: result.status !== 'FAILED', result });
      }
      case 'override': {
        const result = await authority.overrideAutonomousDecision(
          data.targetManager,
          data.overrideType,
          data.details
        );
        return NextResponse.json({ success: result.status !== 'FAILED', result });
      }
      case 'set-objective': {
        const result = await authority.setObjective(
          data.targetManager,
          data.objective,
          data.timeframe,
          data.target
        );
        return NextResponse.json({ success: result.status !== 'FAILED', result });
      }
    }
  } catch (error: unknown) {
    logger.error(
      'Command execution failed',
      error instanceof Error ? error : undefined,
      { route: '/api/orchestrator/command' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to execute command' },
      { status: 500 }
    );
  }
}
