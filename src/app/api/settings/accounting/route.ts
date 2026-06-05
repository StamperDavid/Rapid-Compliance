import 'server-only';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const ACCOUNTING_DOC_ID = 'default';
const accountingPath = getSubCollection('accountingConfig');

const accountingConfigSchema = z.object({
  platform: z.enum(['quickbooks', 'xero', 'freshbooks', 'wave', 'sage', 'none']).optional(),
  connected: z.boolean().optional(),
  autoSyncInvoices: z.boolean().optional(),
  autoSyncPayments: z.boolean().optional(),
  autoSyncCustomers: z.boolean().optional(),
  autoSyncProducts: z.boolean().optional(),
  syncFrequency: z.enum(['realtime', 'hourly', 'daily']).optional(),
  accountMapping: z.object({
    revenueAccount: z.string().optional(),
    taxAccount: z.string().optional(),
    receivablesAccount: z.string().optional(),
  }).optional(),
});

/**
 * GET /api/settings/accounting - Fetch the single accounting config doc
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const config = await AdminFirestoreService.get(accountingPath, ACCOUNTING_DOC_ID);

    return NextResponse.json({ success: true, config });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch accounting config';
    logger.error('Failed to fetch accounting config', error instanceof Error ? error : new Error(String(error)), { file: 'api/settings/accounting/route.ts' });
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
  const bodyResult = accountingConfigSchema.safeParse(body);

  if (!bodyResult.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: bodyResult.error.errors },
      { status: 400 }
    );
  }

  await AdminFirestoreService.set(
    accountingPath,
    ACCOUNTING_DOC_ID,
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
 * PUT /api/settings/accounting - Upsert the accounting config doc
 */
export async function PUT(request: NextRequest) {
  try {
    return await upsert(request);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save accounting config';
    logger.error('Failed to save accounting config', error instanceof Error ? error : new Error(String(error)), { file: 'api/settings/accounting/route.ts' });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/settings/accounting - Upsert the accounting config doc (alias of PUT)
 */
export async function POST(request: NextRequest) {
  try {
    return await upsert(request);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save accounting config';
    logger.error('Failed to save accounting config', error instanceof Error ? error : new Error(String(error)), { file: 'api/settings/accounting/route.ts' });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
