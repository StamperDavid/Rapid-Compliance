import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type { VideoEngineId } from '@/types/video-pipeline';
import type { APIServiceName } from '@/types/api-keys';

export const dynamic = 'force-dynamic';

interface ProviderStatusEntry {
  configured: boolean;
}

type ProviderStatusMap = Record<VideoEngineId, ProviderStatusEntry>;

/** Available engines that have real API integrations */
const CHECKABLE_ENGINES: Array<{ id: VideoEngineId; service: APIServiceName }> = [
  { id: 'heygen', service: 'heygen' },
  { id: 'runway', service: 'runway' },
  { id: 'sora', service: 'sora' },
];

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Check API key configuration for each available engine
    const statusEntries = await Promise.all(
      CHECKABLE_ENGINES.map(async ({ id, service }) => {
        try {
          const key = await apiKeyService.getServiceKey(PLATFORM_ID, service);
          return [id, { configured: key !== null && key !== '' }] as const;
        } catch {
          return [id, { configured: false }] as const;
        }
      })
    );

    const providers: ProviderStatusMap = {
      heygen: { configured: false },
      runway: { configured: false },
      sora: { configured: false },
      kling: { configured: false },
      luma: { configured: false },
    };

    for (const [id, status] of statusEntries) {
      providers[id] = status;
    }

    return NextResponse.json({ success: true, providers });
  } catch (error) {
    logger.error('Failed to check provider status', error as Error, {
      file: 'provider-status/route.ts',
    });

    return NextResponse.json(
      { success: false, error: 'Failed to check provider status' },
      { status: 500 }
    );
  }
}
