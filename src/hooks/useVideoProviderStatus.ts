'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import type { VideoEngineId } from '@/types/video-pipeline';

interface ProviderStatusEntry {
  configured: boolean;
}

type ProviderStatusMap = Record<VideoEngineId, ProviderStatusEntry>;

interface UseVideoProviderStatusReturn {
  providerStatus: ProviderStatusMap | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const DEFAULT_STATUS: ProviderStatusMap = {
  sora: { configured: false },
  runway: { configured: false },
  kling: { configured: false },
  luma: { configured: false },
  hedra: { configured: false },
};

export function useVideoProviderStatus(): UseVideoProviderStatusReturn {
  const authFetch = useAuthFetch();
  const [providerStatus, setProviderStatus] = useState<ProviderStatusMap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authFetch('/api/video/provider-status');

      if (!response.ok) {
        throw new Error('Failed to fetch provider status');
      }

      const data = (await response.json()) as {
        success: boolean;
        providers: ProviderStatusMap;
        error?: string;
      };

      if (data.success && data.providers) {
        setProviderStatus(data.providers);
      } else {
        setProviderStatus(DEFAULT_STATUS);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setProviderStatus(DEFAULT_STATUS);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const refetch = useCallback(() => { void fetchStatus(); }, [fetchStatus]);

  return { providerStatus, isLoading, error, refetch };
}
