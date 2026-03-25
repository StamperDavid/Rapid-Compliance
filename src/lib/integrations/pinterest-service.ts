/**
 * Pinterest Service — Pinterest API v5 integration
 * Creates pins via the Pinterest API
 *
 * Auth: OAuth 2.0
 * API: https://api.pinterest.com/v5/
 *
 * @module integrations/pinterest-service
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PinterestConfig {
  accessToken?: string;
  refreshToken?: string;
  defaultBoardId?: string;
}

export interface PinterestPinRequest {
  title: string;
  description?: string;
  link?: string;
  imageUrl: string;
  boardId?: string;
}

export interface PinterestPinResponse {
  success: boolean;
  pinId?: string;
  error?: string;
}

interface PinterestUser {
  username: string;
  account_type: string;
  profile_image: string;
  website_url: string;
  follower_count: number;
  pin_count: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.pinterest.com/v5';

export class PinterestService {
  private config: PinterestConfig;

  constructor(config: PinterestConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return Boolean(this.config.accessToken);
  }

  async createPin(request: PinterestPinRequest): Promise<PinterestPinResponse> {
    try {
      if (!this.config.accessToken) {
        return { success: false, error: 'Pinterest not configured' };
      }

      const boardId = request.boardId ?? this.config.defaultBoardId;
      if (!boardId) {
        return { success: false, error: 'No Pinterest board specified' };
      }

      const response = await fetch(`${API_BASE}/pins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.accessToken}`,
        },
        body: JSON.stringify({
          title: request.title,
          description: request.description ?? '',
          board_id: boardId,
          media_source: {
            source_type: 'image_url',
            url: request.imageUrl,
          },
          ...(request.link ? { link: request.link } : {}),
        }),
      });

      const data = (await response.json()) as { id?: string; message?: string };
      if (!response.ok || !data.id) {
        return { success: false, error: data.message ?? `Pinterest pin failed: ${response.status}` };
      }

      return { success: true, pinId: data.id };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[PinterestService] Pin creation failed', error instanceof Error ? error : new Error(msg));
      return { success: false, error: msg };
    }
  }

  async getUserAccount(): Promise<PinterestUser | null> {
    try {
      if (!this.config.accessToken) {
        return null;
      }

      const res = await fetch(`${API_BASE}/user_account`, {
        headers: { Authorization: `Bearer ${this.config.accessToken}` },
      });

      if (!res.ok) {
        return null;
      }

      return (await res.json()) as PinterestUser;
    } catch {
      return null;
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export async function createPinterestService(): Promise<PinterestService | null> {
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'pinterest') as PinterestConfig | null;
  if (!keys) {
    return null;
  }
  const service = new PinterestService(keys);
  return service.isConfigured() ? service : null;
}
