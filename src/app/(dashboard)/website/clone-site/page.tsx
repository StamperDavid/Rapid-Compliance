/**
 * Clone Site workspace
 *
 * Paste a client's site URL → discover its pages → pick which to replicate →
 * kick off a clone MISSION → hand the operator to Mission Control to review and
 * grade each cloned page. A conversational Website Agent lives in the right rail.
 *
 * Backend contracts consumed (auth-gated, called via useAuthFetch):
 *   POST /api/website/clone/discover  { url, maxPages? }
 *     → { success, origin, pages: { path, url, title }[], message? }
 *   POST /api/website/clone/run       { url, paths }
 *     → { success, missionId, results }   (we only need missionId here)
 *   POST /api/website/clone/chat      (handled inside CloneChatPanel)
 *
 * Grading is NOT done here — it happens in Mission Control, where the operator
 * reviews each cloned page for training. This workspace kicks off the mission
 * and routes there. Nothing here publishes.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  PageTitle,
  SectionTitle,
  SectionDescription,
  Caption,
} from '@/components/ui/typography';
import { ClonePageList, type DiscoveredPage } from '@/components/website-builder/clone/ClonePageList';
import { CloneChatPanel } from '@/components/website-builder/clone/CloneChatPanel';
import { logger } from '@/lib/logger/logger';

// ── Response shapes (match the backend contracts) ────────────────────────────

interface DiscoverResponse {
  success: boolean;
  origin: string;
  pages: DiscoveredPage[];
  message?: string;
}

interface RunResponse {
  success: boolean;
  missionId: string;
  message?: string;
}

// ── Narrowing helpers (Zero-Any: never trust the wire) ───────────────────────

function isDiscoverResponse(value: unknown): value is DiscoverResponse {
  return (
    value !== null &&
    typeof value === 'object' &&
    Array.isArray((value as { pages?: unknown }).pages)
  );
}

function isRunResponse(value: unknown): value is RunResponse {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { missionId?: unknown }).missionId === 'string'
  );
}

function isValidHttpUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function CloneSitePage() {
  const authFetch = useAuthFetch();
  const router = useRouter();

  const [url, setUrl] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState('');
  const [pages, setPages] = useState<DiscoveredPage[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState('');

  // ── Discover ───────────────────────────────────────────────────────────────

  async function discover(): Promise<void> {
    const trimmed = url.trim();
    if (!isValidHttpUrl(trimmed)) {
      setDiscoverError('Enter a full URL starting with http:// or https:// (e.g. https://example.com).');
      return;
    }
    setDiscovering(true);
    setDiscoverError('');
    setPages([]);
    setSelected(new Set());
    setCloneError('');

    try {
      const res = await authFetch('/api/website/clone/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok || !isDiscoverResponse(json) || !json.success) {
        const detail =
          isDiscoverResponse(json) && typeof json.message === 'string'
            ? json.message
            : `Could not read that site (${res.status}).`;
        throw new Error(detail);
      }
      setPages(json.pages);
      // Default: everything selected.
      setSelected(new Set(json.pages.map((p) => p.path)));
      if (json.pages.length === 0) {
        setDiscoverError('No pages were found on that site. Try a different URL.');
      }
    } catch (err) {
      logger.error(
        '[CloneSite] Discover failed',
        err instanceof Error ? err : new Error(String(err)),
      );
      setDiscoverError(err instanceof Error ? err.message : 'Could not read that site.');
    } finally {
      setDiscovering(false);
    }
  }

  // ── Selection ────────────────────────────────────────────────────────────────

  function toggle(path: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  function selectAll(): void {
    setSelected(new Set(pages.map((p) => p.path)));
  }

  function clearSelection(): void {
    setSelected(new Set());
  }

  // ── Clone → kick off the mission, then hand off to Mission Control ───────────

  async function cloneSelected(): Promise<void> {
    const paths = pages.map((p) => p.path).filter((path) => selected.has(path));
    if (paths.length === 0) {
      return;
    }
    setCloning(true);
    setCloneError('');

    try {
      const res = await authFetch('/api/website/clone/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), paths }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok || !isRunResponse(json) || !json.success) {
        const detail =
          isRunResponse(json) && typeof json.message === 'string'
            ? json.message
            : `Could not start the clone (${res.status}).`;
        throw new Error(detail);
      }
      // Review + grading happen in Mission Control for this mission.
      router.push(`/mission-control?mission=${encodeURIComponent(json.missionId)}`);
    } catch (err) {
      logger.error(
        '[CloneSite] Clone run failed',
        err instanceof Error ? err : new Error(String(err)),
      );
      setCloneError(err instanceof Error ? err.message : 'Could not start the clone.');
      setCloning(false);
    }
    // On success we navigate away, so we intentionally leave `cloning` true.
  }

  const selectedCount = selected.size;

  return (
    <div className="p-8 space-y-6">
      <div>
        <PageTitle>Clone Site</PageTitle>
        <SectionDescription>
          Paste a client&apos;s website, pick the pages to replicate, and clone them faithfully
          into your site as editable drafts. You&apos;ll review and grade each cloned page in
          Mission Control. Nothing here goes live.
        </SectionDescription>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* 1. URL + Discover */}
          <Card className="p-6 space-y-4">
            <div>
              <SectionTitle>Client website</SectionTitle>
              <SectionDescription>
                Enter the full address of the site you want to clone.
              </SectionDescription>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void discover();
                  }
                }}
                placeholder="https://example.com"
                disabled={discovering}
                className="sm:flex-1"
              />
              <Button
                type="button"
                onClick={() => void discover()}
                disabled={discovering || url.trim() === ''}
              >
                {discovering ? 'Discovering…' : 'Discover pages'}
              </Button>
            </div>
            {discovering && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-border-strong border-t-primary" />
                Crawling the site for pages…
              </div>
            )}
            {discoverError !== '' && (
              <SectionDescription className="text-destructive">{discoverError}</SectionDescription>
            )}
          </Card>

          {/* 2. Page list + 3. Clone selected */}
          {pages.length > 0 && (
            <Card className="p-6 space-y-4">
              <ClonePageList
                pages={pages}
                selected={selected}
                onToggle={toggle}
                onSelectAll={selectAll}
                onClear={clearSelection}
              />
              <div className="flex items-center justify-between gap-3 border-t border-border-light pt-4">
                <Caption>
                  {cloning
                    ? 'Starting clone… taking you to Mission Control'
                    : `${selectedCount} page${selectedCount === 1 ? '' : 's'} ready to clone`}
                </Caption>
                <Button
                  type="button"
                  onClick={() => void cloneSelected()}
                  disabled={cloning || selectedCount === 0}
                >
                  {cloning ? 'Starting clone…' : 'Clone selected'}
                </Button>
              </div>
              {cloneError !== '' && (
                <SectionDescription className="text-destructive">{cloneError}</SectionDescription>
              )}
            </Card>
          )}
        </div>

        {/* Right rail — chat */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-6">
            <CloneChatPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
