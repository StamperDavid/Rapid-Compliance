'use client';

/**
 * Social Repurposing mode (parity floor: Reap / OpusClip).
 *
 * Turn a long project into captioned, vertical short clips. This workspace drives
 * the SHARED reducer's project (state.clips) — it never forks its own project
 * state. The operator defines in/out points over the concatenated project
 * timeline, queues multiple shorts, then renders each one through the REAL
 * render route (/api/video/editor/render).
 *
 * Wiring honesty (see CLAUDE.md standing rules):
 *  - The manual segment picker is fully real: in/out points map to actual
 *    per-clip trims via segment-utils, and "Create short" calls the real route.
 *  - Auto-highlight ("let AI pick the best moments") is NOT built — there is no
 *    highlight-detection service yet, so it is shown as disabled/"coming soon",
 *    never faked.
 *  - Auto-captions: a Deepgram transcription service exists in the codebase
 *    (src/lib/video/transcription-service.ts) but is server-only with no
 *    client-callable route, and the render route cannot generate captions from a
 *    transcript. So the toggle is present and honest about what it needs, and
 *    does not silently no-op or fake burned-in captions.
 *  - 9:16 vertical output: the render route only accepts resolution 720p/1080p
 *    (landscape) with no aspect/crop param. The 9:16 framing is shown in the
 *    preview, the render is wired for real, and the UI states plainly that the
 *    delivered file is currently landscape until the route gains a 9:16 param.
 */

import { useMemo, useState } from 'react';
import { Share2, Plus, Trash2, Scissors, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  SectionTitle,
  SubsectionTitle,
  CardTitle,
  SectionDescription,
  Caption,
} from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { EditorModeProps } from '../editor-modes';
import {
  projectTimelineDuration,
  sliceTimelineToClips,
  formatTimecode,
  type ShortSegment,
  type ShortRenderStatus,
} from './social-repurpose/segment-utils';

/** Default length (seconds) suggested when adding a fresh short. */
const DEFAULT_SHORT_LENGTH = 30;

/** Render route response shape we rely on (subset). */
interface RenderResponse {
  success: boolean;
  error?: string;
  item?: { url?: string };
}

let shortCounter = 0;
function nextShortId(): string {
  shortCounter += 1;
  return `short-${Date.now()}-${shortCounter}`;
}

export default function SocialRepurposeMode({ state, authFetch }: EditorModeProps) {
  const timelineDuration = useMemo(
    () => projectTimelineDuration(state.clips),
    [state.clips],
  );

  const [segments, setSegments] = useState<ShortSegment[]>([]);
  const [statusById, setStatusById] = useState<Record<string, ShortRenderStatus>>({});

  const hasProject = state.clips.length > 0 && timelineDuration > 0;

  // --- Segment queue management (all REAL, local to this workspace) ---------

  function addSegment() {
    const start = 0;
    const end = Math.min(DEFAULT_SHORT_LENGTH, timelineDuration);
    setSegments((prev) => [
      ...prev,
      {
        id: nextShortId(),
        name: `Short ${prev.length + 1}`,
        startSec: start,
        endSec: end,
        autoCaptions: false,
      },
    ]);
  }

  function updateSegment(id: string, updates: Partial<ShortSegment>) {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }

  function removeSegment(id: string) {
    setSegments((prev) => prev.filter((s) => s.id !== id));
    setStatusById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  // --- Render one short through the REAL route ------------------------------

  async function createShort(segment: ShortSegment) {
    const clips = sliceTimelineToClips(state.clips, segment.startSec, segment.endSec);
    if (clips.length === 0) {
      setStatusById((prev) => ({
        ...prev,
        [segment.id]: {
          phase: 'error',
          error: 'This in/out range does not cover any of the project. Adjust the start and end.',
          url: null,
        },
      }));
      return;
    }

    setStatusById((prev) => ({
      ...prev,
      [segment.id]: { phase: 'rendering', error: null, url: null },
    }));

    try {
      const response = await authFetch('/api/video/editor/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: segment.name,
          // Each sliced clip is rendered back-to-back with hard cuts inside the short.
          clips: clips.map((c) => ({
            id: c.id,
            url: c.url,
            trimStart: c.trimStart,
            trimEnd: c.trimEnd,
            transitionType: 'cut',
            ...(c.effect ? { effect: c.effect } : {}),
          })),
          transition: 'cut',
          // The route maxes out at 1080p landscape today; see the pending note
          // in the UI. We request the highest it supports.
          resolution: '1080p',
          derivedFromMediaIds: state.clips.map((clip) => clip.id),
        }),
      });

      const data = (await response.json()) as RenderResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? 'The render service returned an error.');
      }

      setStatusById((prev) => ({
        ...prev,
        [segment.id]: { phase: 'done', error: null, url: data.item?.url ?? null },
      }));
    } catch (error) {
      setStatusById((prev) => ({
        ...prev,
        [segment.id]: {
          phase: 'error',
          error: error instanceof Error ? error.message : 'Something went wrong while rendering.',
          url: null,
        },
      }));
    }
  }

  // --- Empty state ----------------------------------------------------------

  if (!hasProject) {
    return (
      <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center">
        <Share2 className="mx-auto mb-3 h-10 w-10 text-primary" />
        <SectionTitle as="h3">Social Repurposing</SectionTitle>
        <SectionDescription className="mx-auto mt-1 max-w-md">
          Turn a long video into captioned, vertical short clips. Load at least one clip into this
          project to start cutting shorts.
        </SectionDescription>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionTitle as="h3">Social Repurposing</SectionTitle>
          <SectionDescription className="mt-1 max-w-2xl">
            Cut your {formatTimecode(timelineDuration)} project into vertical shorts. Set the start
            and end of each short over the timeline, queue as many as you want, then create them.
          </SectionDescription>
        </div>
        <Button onClick={addSegment} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Add a short
        </Button>
      </div>

      {/* Auto-highlight: honest "coming soon", never faked */}
      <div className="rounded-2xl border border-border-light bg-surface-elevated p-4">
        <div className="flex items-center gap-2">
          <CardTitle>Let AI pick the best moments</CardTitle>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Coming soon
          </span>
        </div>
        <Caption className="mt-1 block">
          Automatic highlight detection needs a highlight-detection service, which is not connected
          yet. For now you choose each short&apos;s start and end by hand below — every cut is real.
        </Caption>
      </div>

      {/* Queue */}
      {segments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-card p-8 text-center">
          <Scissors className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <SubsectionTitle as="h4">No shorts queued yet</SubsectionTitle>
          <SectionDescription className="mx-auto mt-1 max-w-md">
            Click &quot;Add a short&quot; to mark the first segment you want to pull from this video.
          </SectionDescription>
        </div>
      ) : (
        <div className="space-y-4">
          {segments.map((segment) => (
            <ShortCard
              key={segment.id}
              segment={segment}
              timelineDuration={timelineDuration}
              status={statusById[segment.id] ?? { phase: 'queued', error: null, url: null }}
              onUpdate={(updates) => updateSegment(segment.id, updates)}
              onRemove={() => removeSegment(segment.id)}
              onCreate={() => void createShort(segment)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// One queued short
// ===========================================================================

interface ShortCardProps {
  segment: ShortSegment;
  timelineDuration: number;
  status: ShortRenderStatus;
  onUpdate: (updates: Partial<ShortSegment>) => void;
  onRemove: () => void;
  onCreate: () => void;
}

function ShortCard({
  segment,
  timelineDuration,
  status,
  onUpdate,
  onRemove,
  onCreate,
}: ShortCardProps) {
  const length = Math.max(0, segment.endSec - segment.startSec);
  const rendering = status.phase === 'rendering';

  // Clamp helpers keep start < end and both inside the project.
  function setStart(value: number) {
    const start = Math.max(0, Math.min(value, segment.endSec - 1));
    onUpdate({ startSec: start });
  }
  function setEnd(value: number) {
    const end = Math.min(timelineDuration, Math.max(value, segment.startSec + 1));
    onUpdate({ endSec: end });
  }

  // Left edge / width of the highlighted span on the mini timeline (0..100%).
  const spanLeft = timelineDuration > 0 ? (segment.startSec / timelineDuration) * 100 : 0;
  const spanWidth = timelineDuration > 0 ? (length / timelineDuration) * 100 : 0;

  return (
    <div className="rounded-2xl border border-border-strong bg-card p-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[180px_1fr]">
        {/* 9:16 vertical preview framing */}
        <div className="space-y-2">
          <div className="relative mx-auto aspect-[9/16] w-full max-w-[160px] overflow-hidden rounded-xl border border-border-light bg-background">
            <div className="flex h-full w-full items-center justify-center">
              <div className="text-center">
                <Share2 className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                <Caption className="block px-2">Vertical 9:16 frame</Caption>
              </div>
            </div>
          </div>
          <Caption className="block text-center">
            {formatTimecode(length)} long
          </Caption>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Input
              value={segment.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="max-w-xs"
              aria-label="Short name"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              disabled={rendering}
              aria-label="Remove this short"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Mini timeline showing where this short sits in the project */}
          <div className="space-y-2">
            <Caption className="block">Where this short sits in your video</Caption>
            <div className="relative h-3 w-full rounded-full bg-surface-elevated">
              <div
                className="absolute top-0 h-3 rounded-full bg-primary"
                style={{ left: `${spanLeft}%`, width: `${spanWidth}%` }}
              />
            </div>
          </div>

          {/* In / out controls */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Caption className="mb-1 block">Start ({formatTimecode(segment.startSec)})</Caption>
              <Input
                type="number"
                min={0}
                max={Math.max(0, timelineDuration - 1)}
                step={1}
                value={Math.round(segment.startSec)}
                onChange={(e) => setStart(Number(e.target.value))}
                disabled={rendering}
                aria-label="Start time in seconds"
              />
            </div>
            <div>
              <Caption className="mb-1 block">End ({formatTimecode(segment.endSec)})</Caption>
              <Input
                type="number"
                min={1}
                max={Math.round(timelineDuration)}
                step={1}
                value={Math.round(segment.endSec)}
                onChange={(e) => setEnd(Number(e.target.value))}
                disabled={rendering}
                aria-label="End time in seconds"
              />
            </div>
          </div>

          {/* Auto-captions toggle — honest about its backend dependency */}
          <label className="flex items-start gap-3 rounded-xl border border-border-light bg-surface-elevated p-3">
            <input
              type="checkbox"
              checked={segment.autoCaptions}
              onChange={(e) => onUpdate({ autoCaptions: e.target.checked })}
              disabled={rendering}
              className="mt-1 h-4 w-4 accent-primary"
            />
            <span>
              <CardTitle as="span" className="block">Auto-captions</CardTitle>
              <Caption className="mt-0.5 block">
                Burned-in captions need a transcription route that returns word timings. That route
                isn&apos;t connected here yet, so checking this records your intent but captions
                won&apos;t be added until the backend is wired (see the note below).
              </Caption>
            </span>
          </label>

          {/* Render status — plain English */}
          <RenderStatusLine status={status} />

          <div className="flex items-center justify-end">
            <Button onClick={onCreate} disabled={rendering}>
              {rendering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating short…
                </>
              ) : (
                <>
                  <Scissors className="mr-2 h-4 w-4" />
                  Create short
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Plain-English render status
// ===========================================================================

function RenderStatusLine({ status }: { status: ShortRenderStatus }) {
  if (status.phase === 'queued') {
    return (
      <Caption className="block">
        Ready to create. The short will render and save to your media library.
      </Caption>
    );
  }
  if (status.phase === 'rendering') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Rendering your short — this can take a minute.
      </div>
    );
  }
  if (status.phase === 'error') {
    return (
      <div className="flex items-start gap-2 text-sm text-destructive">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{status.error ?? 'Something went wrong.'}</span>
      </div>
    );
  }
  // done
  return (
    <div className="flex items-start gap-2 text-sm text-foreground">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>
        Saved to your media library.{' '}
        {status.url ? (
          <a href={status.url} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
            Open the short
          </a>
        ) : null}{' '}
        Note: it&apos;s currently a landscape file — vertical 9:16 output needs the render-route
        change described below.
      </span>
    </div>
  );
}
