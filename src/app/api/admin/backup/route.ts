/**
 * Backup API Route
 * Admin endpoints for backup operations
 *
 * POST: Trigger manual backup
 * GET: List available backups
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { backupService, type BackupConfig } from '@/lib/backup/backup-service';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

// Default collections to backup
const DEFAULT_COLLECTIONS = [
  'leads',
  'contacts',
  'deals',
  'activities',
  'sequences',
  'campaigns',
  'workflows',
  'products',
  'orders',
  'goldenMasters',
  'customerMemories',
];

/**
 * POST /api/admin/backup
 * Trigger a manual backup
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireRole(request, ['owner', 'admin']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Parse and validate request body
    const rawBody: unknown = await request.json();
    const backupSchema = z.object({
      collections: z.array(z.string()).optional(),
      incremental: z.boolean().optional(),
      storageType: z.enum(['local', 'gcs']).optional(),
    });
    const parsed = backupSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const body = parsed.data;

    // Get encryption key from environment
    const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
    if (!encryptionKey) {
      logger.error('BACKUP_ENCRYPTION_KEY not configured', new Error('Missing BACKUP_ENCRYPTION_KEY'), { file: 'backup/route.ts' });
      return NextResponse.json(
        { error: 'Backup encryption not configured' },
        { status: 500 }
      );
    }

    const config: BackupConfig = {
      collections: body.collections ?? DEFAULT_COLLECTIONS,
      encryptionKey,
      storageType: body.storageType ?? 'gcs',
      storagePath: process.env.BACKUP_STORAGE_PATH ?? './backups',
      incrementalEnabled: body.incremental ?? true,
    };

    const result = await backupService.runBackup(config);

    if (result.success) {
      return NextResponse.json({
        success: true,
        backupId: result.backupId,
        metadata: result.metadata,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          backupId: result.backupId,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Backup API error:', err, { file: 'backup/route.ts' });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/backup
 * List available backups
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireRole(request, ['owner', 'admin']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const storageTypeParam = searchParams.get('storageType');
    const storageType = (storageTypeParam === 'local' || storageTypeParam === 'gcs') ? storageTypeParam : null;

    // Get encryption key from environment
    const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
    if (!encryptionKey) {
      return NextResponse.json(
        { error: 'Backup encryption not configured' },
        { status: 500 }
      );
    }

    const config: BackupConfig = {
      collections: DEFAULT_COLLECTIONS,
      encryptionKey,
      storageType: storageType ?? 'gcs',
      storagePath: process.env.BACKUP_STORAGE_PATH ?? './backups',
      incrementalEnabled: true,
    };

    const backups = await backupService.listBackups(config);

    return NextResponse.json({
      success: true,
      backups,
      count: backups.length,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Backup list API error:', err, { file: 'backup/route.ts' });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/backup
 * Prune old backups
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireRole(request, ['owner', 'admin']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const retentionDays = parseInt(searchParams.get('retentionDays') ?? '30', 10);

    // Get encryption key from environment
    const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
    if (!encryptionKey) {
      return NextResponse.json(
        { error: 'Backup encryption not configured' },
        { status: 500 }
      );
    }

    const config: BackupConfig = {
      collections: DEFAULT_COLLECTIONS,
      encryptionKey,
      storageType: 'gcs',
      storagePath: process.env.BACKUP_STORAGE_PATH ?? './backups',
      incrementalEnabled: true,
    };

    const deletedCount = await backupService.pruneOldBackups(config, retentionDays);

    return NextResponse.json({
      success: true,
      deletedCount,
      retentionDays,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Backup prune API error:', err, { file: 'backup/route.ts' });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
