import 'server-only';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { orderBy, limit } from 'firebase/firestore';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const SECURITY_DOC_ID = 'config';
const settingsPath = getSubCollection('securitySettings');
const auditLogsPath = getSubCollection('auditLogs');

interface AuditLogEntry {
  id: string;
  action: string;
  user: string;
  ip: string;
  timestamp: string;
  status: 'success' | 'failed';
  details?: string;
}

const securitySettingsSchema = z.object({
  twoFactorEnabled: z.boolean().optional(),
  ipWhitelistEnabled: z.boolean().optional(),
  ipWhitelist: z.string().optional(),
  sessionTimeout: z.string().optional(),
  auditLogRetention: z.string().optional(),
});

/**
 * GET /api/settings/security - Fetch security settings + recent audit logs
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const settings = await AdminFirestoreService.get(settingsPath, SECURITY_DOC_ID);

    let auditLogs: AuditLogEntry[] = [];
    try {
      auditLogs = await AdminFirestoreService.getAll<AuditLogEntry>(
        auditLogsPath,
        [orderBy('timestamp', 'desc'), limit(50)]
      );
    } catch (logErr) {
      // Audit logs are best-effort (collection/index may not exist yet) — settings still return
      logger.warn('Failed to fetch audit logs for security settings', { file: 'api/settings/security/route.ts', error: logErr instanceof Error ? logErr.message : String(logErr) });
    }

    return NextResponse.json({ success: true, settings, auditLogs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch security settings';
    logger.error('Failed to fetch security settings', error instanceof Error ? error : new Error(String(error)), { file: 'api/settings/security/route.ts' });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Upsert handler shared by PUT and POST.
 */
async function upsert(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const body: unknown = await request.json();
  const bodyResult = securitySettingsSchema.safeParse(body);

  if (!bodyResult.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: bodyResult.error.errors },
      { status: 400 }
    );
  }

  await AdminFirestoreService.set(
    settingsPath,
    SECURITY_DOC_ID,
    {
      ...bodyResult.data,
      updatedAt: new Date().toISOString(),
      updatedBy: authResult.user.uid,
    },
    true
  );

  return NextResponse.json({ success: true });
}

/**
 * PUT /api/settings/security - Upsert security settings
 */
export async function PUT(request: NextRequest) {
  try {
    return await upsert(request);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save security settings';
    logger.error('Failed to save security settings', error instanceof Error ? error : new Error(String(error)), { file: 'api/settings/security/route.ts' });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/settings/security - Upsert security settings (alias of PUT)
 */
export async function POST(request: NextRequest) {
  try {
    return await upsert(request);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save security settings';
    logger.error('Failed to save security settings', error instanceof Error ? error : new Error(String(error)), { file: 'api/settings/security/route.ts' });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
