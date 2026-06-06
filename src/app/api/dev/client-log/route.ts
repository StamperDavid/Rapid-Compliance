/**
 * Dev-only client telemetry sink.
 * POST /api/dev/client-log
 *
 * The browser-side ClientLogBridge forwards window errors, unhandled promise
 * rejections, React/console errors, and route changes here so they land in the
 * dev-server log alongside the server's own request/response lines — giving a
 * single comprehensive view of what the operator did and how the system
 * responded. No-ops (404) in production; this is a development aid only.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const ClientLogSchema = z.object({
  level: z.enum(['error', 'warn', 'info']).default('info'),
  message: z.string().trim().max(4000),
  path: z.string().trim().max(300).optional(),
  stack: z.string().trim().max(4000).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Development aid only — never active in production.
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  let parsed: z.infer<typeof ClientLogSchema>;
  try {
    parsed = ClientLogSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const tagged = `[CLIENT] ${parsed.message}`;
  const meta: { file: string; path?: string; clientStack?: string } = { file: 'client' };
  if (parsed.path) {
    meta.path = parsed.path;
  }
  if (parsed.stack) {
    meta.clientStack = parsed.stack;
  }

  if (parsed.level === 'error') {
    logger.error(tagged, new Error(parsed.message), meta);
  } else if (parsed.level === 'warn') {
    logger.warn(tagged, meta);
  } else {
    logger.info(tagged, meta);
  }

  return NextResponse.json({ ok: true });
}
