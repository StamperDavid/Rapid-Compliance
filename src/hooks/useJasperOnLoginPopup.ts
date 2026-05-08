'use client';

/**
 * useJasperOnLoginPopup
 *
 * Drives the auto-open behavior of <JasperOnLoginPopup>. The popup is
 * "Finish Setting Up" ONLY — Jasper's insights live in his chat window
 * via the arrow-down button on the orchestrator chat panel.
 *
 * On dashboard mount:
 *   1. If sessionStorage flag is set → don't auto-open (already shown this session).
 *   2. If pathname starts with /mission-control → don't auto-open (focused work).
 *   3. If another modal is already open → don't pile on top.
 *   4. GET /api/jasper/insights → read setupItems (we ignore insights here).
 *   5. If `lastGeneratedAt` is null OR older than 24h → POST .../generate first.
 *   6. If at least 1 setupItem returned → open the popup. Once everything is
 *      set up (zero unresolved items), the popup never opens again.
 *
 * This hook NEVER calls an LLM directly — it only consumes the backend API.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import type { Insight, SetupItem } from '@/types/jasper-insights';

const SESSION_FLAG = 'jasper-popup-shown-this-session';
const STALE_AFTER_MS = 24 * 60 * 60 * 1000; // 24 hours

interface InsightsApiResponse {
  success?: boolean;
  insights?: Insight[];
  setupItems?: SetupItem[];
  lastGeneratedAt?: string | null;
  error?: string;
}

interface GenerateApiResponse {
  success?: boolean;
  insights?: Insight[];
  setupItems?: SetupItem[];
  error?: string;
}

export interface UseJasperOnLoginPopupResult {
  /** Whether the modal is currently open. */
  open: boolean;
  /** Setter passed to <Dialog onOpenChange>. */
  setOpen: (open: boolean) => void;
  /** Insights to render in the popup body. */
  insights: Insight[];
  /** Setup items to render above the insights. */
  setupItems: SetupItem[];
  /** True while we're fetching/regenerating from the server. */
  loading: boolean;
}

function isStale(lastGeneratedAt: string | null | undefined): boolean {
  if (lastGeneratedAt === null || lastGeneratedAt === undefined || lastGeneratedAt === '') {
    return true;
  }
  const last = Date.parse(lastGeneratedAt);
  if (Number.isNaN(last)) {
    return true;
  }
  return Date.now() - last > STALE_AFTER_MS;
}

function readSessionFlag(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.sessionStorage.getItem(SESSION_FLAG) === '1';
  } catch {
    return false;
  }
}

function writeSessionFlag(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem(SESSION_FLAG, '1');
  } catch {
    // sessionStorage may be unavailable in some embedded contexts — silently skip.
  }
}

function anyDialogAlreadyOpen(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  return document.querySelector('[role="dialog"]') !== null;
}

export function useJasperOnLoginPopup(): UseJasperOnLoginPopupResult {
  const authFetch = useAuthFetch();
  const pathname = usePathname();

  const [open, setOpenState] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [setupItems, setSetupItems] = useState<SetupItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Capture latest pathname without making the effect depend on it (we only
  // want the effect to fire once per mount).
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  // Capture authFetch the same way — its identity changes when the auth
  // token does, but we only need a stable reference for the one-shot fetch.
  const authFetchRef = useRef(authFetch);
  authFetchRef.current = authFetch;

  const hasRunRef = useRef(false);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    if (!next) {
      // Closing — make sure the session flag is set so we don't reopen later.
      writeSessionFlag();
    }
  }, []);

  useEffect(() => {
    if (hasRunRef.current) {
      return;
    }
    hasRunRef.current = true;

    // Skip if already shown this session.
    if (readSessionFlag()) {
      return;
    }

    // Don't interrupt focused work in Mission Control.
    const currentPath = pathnameRef.current;
    if (currentPath?.startsWith('/mission-control') === true) {
      return;
    }

    // Don't pile on top of an already-open dialog.
    if (anyDialogAlreadyOpen()) {
      return;
    }

    // No cancellation flag here — under React Strict Mode in dev, the
    // first mount's cleanup would set cancelled=true and the second mount's
    // hasRunRef-guard would skip the rerun, dropping the fetched data
    // entirely. React 18's setState on a truly-unmounted component is a
    // no-op and produces no warning, so it's safe to let the state setter
    // run unconditionally. The hasRunRef above guarantees only one fetch.
    const run = async () => {
      setLoading(true);
      try {
        const fetchFn = authFetchRef.current;

        // 1. Read what we have.
        const listRes = await fetchFn('/api/jasper/insights');
        const listData = (await listRes.json().catch(() => ({}))) as InsightsApiResponse;

        if (!listRes.ok || listData.success !== true) {
          throw new Error(listData.error ?? `Insights load failed (${listRes.status})`);
        }

        let nextInsights = listData.insights ?? [];
        let nextSetupItems = listData.setupItems ?? [];

        // 2. Regenerate if stale.
        if (isStale(listData.lastGeneratedAt)) {
          try {
            const genRes = await fetchFn('/api/jasper/insights/generate', {
              method: 'POST',
            });
            const genData = (await genRes.json().catch(() => ({}))) as GenerateApiResponse;
            if (genRes.ok && genData.success === true) {
              nextInsights = genData.insights ?? nextInsights;
              nextSetupItems = genData.setupItems ?? nextSetupItems;
            } else {
              logger.warn(
                '[useJasperOnLoginPopup] generate returned non-success — falling back to cached insights',
              );
            }
          } catch (genErr: unknown) {
            logger.warn(
              '[useJasperOnLoginPopup] generate threw — falling back to cached insights',
            );
            void genErr;
          }
        }

        setInsights(nextInsights);
        setSetupItems(nextSetupItems);

        // Open ONLY when there are unresolved setup items. Insights live
        // in Jasper's chat window now — they don't drive this popup.
        // Once setup is complete, this popup never opens again.
        if (nextSetupItems.length > 0) {
          if (!anyDialogAlreadyOpen()) {
            setOpenState(true);
            writeSessionFlag();
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error(
          '[useJasperOnLoginPopup] failed to load insights',
          err instanceof Error ? err : new Error(msg),
        );
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  return { open, setOpen, insights, setupItems, loading };
}

export default useJasperOnLoginPopup;
