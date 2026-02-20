/**
 * Authenticated Fetch Hook
 * Wraps the native fetch() with Firebase ID token in the Authorization header.
 * All API calls from client components should use this instead of bare fetch().
 */

'use client';

import { useCallback } from 'react';
import { useUnifiedAuth } from './useUnifiedAuth';

/**
 * Returns an auth-aware fetch function that automatically attaches
 * the Firebase Bearer token to every request.
 *
 * Usage:
 *   const authFetch = useAuthFetch();
 *   const res = await authFetch('/api/social/agent-status');
 */
export function useAuthFetch(): (url: string, options?: RequestInit) => Promise<Response> {
  const { getIdToken } = useUnifiedAuth();

  return useCallback(
    async (url: string, options?: RequestInit): Promise<Response> => {
      const token = await getIdToken();
      const headers = new Headers(options?.headers);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return fetch(url, { ...options, headers });
    },
    [getIdToken]
  );
}
