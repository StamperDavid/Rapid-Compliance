/**
 * Backup API Route
 * Admin endpoints for backup operations
 *
 * POST: Trigger manual backup
 * GET: List available backups
 */

import { type NextRequest, NextResponse } from 'next/server';
import { backupService, type BackupConfig } from '@/lib/backup/backup-service';
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
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify admin token (in production, verify Firebase token and check admin role)
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json() as {
      organizationId?: string;
      collections?: string[];
      incremental?: boolean;
      storageType?: 'local' | 'gcs';
    };

    if (!body.organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

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
      organizationId: body.organizationId,
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
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const storageType = searchParams.get('storageType') as 'local' | 'gcs' | null;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId query parameter is required' },
        { status: 400 }
      );
    }

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
      organizationId,
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
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const retentionDays = parseInt(searchParams.get('retentionDays') ?? '30', 10);

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId query parameter is required' },
        { status: 400 }
      );
    }

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
      organizationId,
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
