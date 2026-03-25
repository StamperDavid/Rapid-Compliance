/**
 * Threads Service — Meta Threads API integration
 * Posts via the Threads Publishing API (graph.threads.net)
 *
 * Auth: Meta OAuth 2.0 (long-lived token via Instagram Graph API flow)
 * API: https://graph.threads.net/v1.0/
 *
 * @module integrations/threads-service
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ThreadsConfig {
  accessToken?: string;
  userId?: string;
}

export interface ThreadsPostRequest {
  text: string;
  mediaType?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'CAROUSEL';
  imageUrl?: string;
}

export interface ThreadsPostResponse {
  success: boolean;
  postId?: string;
  error?: string;
}

interface ThreadsProfile {
  id: string;
  username?: string;
  name?: string;
  threads_profile_picture_url?: string;
  threads_biography?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

const API_BASE = 'https://graph.threads.net/v1.0';

export class ThreadsService {
  private config: ThreadsConfig;

  constructor(config: ThreadsConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return Boolean(this.config.accessToken && this.config.userId);
  }

  async publishPost(request: ThreadsPostRequest): Promise<ThreadsPostResponse> {
    try {
      if (!this.config.accessToken || !this.config.userId) {
        return { success: false, error: 'Threads not configured' };
      }

      // Step 1: Create media container
      const containerParams = new URLSearchParams({
        media_type: request.mediaType ?? 'TEXT',
        text: request.text,
        access_token: this.config.accessToken,
      });

      if (request.imageUrl && request.mediaType === 'IMAGE') {
        containerParams.set('image_url', request.imageUrl);
      }

      const containerRes = await fetch(
        `${API_BASE}/${this.config.userId}/threads`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: containerParams.toString(),
        },
      );

      const containerData = (await containerRes.json()) as { id?: string; error?: { message?: string } };
      if (!containerRes.ok || !containerData.id) {
        return { success: false, error: containerData.error?.message ?? 'Failed to create Threads container' };
      }

      // Step 2: Publish the container
      const publishRes = await fetch(
        `${API_BASE}/${this.config.userId}/threads_publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            creation_id: containerData.id,
            access_token: this.config.accessToken,
          }).toString(),
        },
      );

      const publishData = (await publishRes.json()) as { id?: string; error?: { message?: string } };
      if (!publishRes.ok || !publishData.id) {
        return { success: false, error: publishData.error?.message ?? 'Failed to publish Threads post' };
      }

      return { success: true, postId: publishData.id };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[ThreadsService] Post failed', error instanceof Error ? error : new Error(msg));
      return { success: false, error: msg };
    }
  }

  async getProfile(): Promise<ThreadsProfile | null> {
    try {
      if (!this.config.accessToken || !this.config.userId) {
        return null;
      }

      const res = await fetch(
        `${API_BASE}/${this.config.userId}?fields=id,username,name,threads_profile_picture_url,threads_biography&access_token=${this.config.accessToken}`,
      );

      if (!res.ok) {
        return null;
      }

      return (await res.json()) as ThreadsProfile;
    } catch {
      return null;
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export async function createThreadsService(): Promise<ThreadsService | null> {
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'threads') as ThreadsConfig | null;
  if (!keys) {
    return null;
  }
  const service = new ThreadsService(keys);
  return service.isConfigured() ? service : null;
}
