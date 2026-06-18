'use client';

/**
 * Make Clips tool panel.
 *
 * Right-column panel (~380px) beside the shared Preview + Timeline — it never
 * renders its own preview and never forks project state. It reads
 * `state.clips` (the project timeline) and:
 *
 *   1. Lets the operator define one or more SHORTS by in/out points over the
 *      project timeline (segment-utils does the math).
 *   2. Lets the operator pick target PLATFORM FORMATS (each maps to a 9:16 or
 *      16:9 render aspect and a real social-scheduler platform).
 *   3. On "Make & schedule": for each short × format it renders the short at the
 *      right aspect via the real /api/video/editor/render route, then hands the
 *      finished clip to the real social scheduler (/api/social/schedule) with the
 *      platform, caption, and schedule time. With no schedule time, clips render
 *      to the Library and the result says so plainly.
 *
 * Honesty: render + scheduler calls are real. Nothing is faked — if a step can't
 * complete, the job reports the real reason.
 */

import { useMemo, useState } from 'react';
import { Scissors, Sparkles, Loader2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardTitle, Caption, SectionDescription } from '@/components/ui/typography';
import type { EditorToolProps } from '../editor-tools';
import {
  projectTimelineDuration,
  formatTimecode,
  type ShortSegment,
} from '../modes/social-repurpose/segment-utils';
import SegmentList from './make-clips/SegmentList';
import FormatPicker from './make-clips/FormatPicker';
import JobList from './make-clips/JobList';
import { useMakeClips } from './make-clips/useMakeClips';

let segmentCounter = 0;
function nextSegmentId(): string {
  segmentCounter += 1;
  return `short-${Date.now().toString(36)}-${segmentCounter}`;
}

export default function ClipsToolPanel({ state, authFetch }: EditorToolProps) {
  const { clips, playheadTime } = state;
  const timelineDuration = useMemo(() => projectTimelineDuration(clips), [clips]);

  const [segments, setSegments] = useState<ShortSegment[]>([]);
  const [selectedFormatIds, setSelectedFormatIds] = useState<string[]>(['tiktok']);
  const [autoCaptions, setAutoCaptions] = useState(true);
  const [resolution, setResolution] = useState<'720p' | '1080p'>('1080p');
  const [caption, setCaption] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);

  const { jobs, isRunning, run } = useMakeClips(clips, authFetch);

  const hasTimeline = clips.length > 0 && timelineDuration > 0;

  // ── Segment editing ────────────────────────────────────────────────────
  function addSegment() {
    const start = Math.min(playheadTime, Math.max(0, timelineDuration - 1));
    const end = Math.min(timelineDuration, start + 15);
    setSegments((prev) => [
      ...prev,
      {
        id: nextSegmentId(),
        name: `Short ${prev.length + 1}`,
        startSec: Number(start.toFixed(1)),
        endSec: Number(end.toFixed(1)),
        autoCaptions,
      },
    ]);
  }

  function updateSegment(
    id: string,
    updates: Partial<Pick<ShortSegment, 'startSec' | 'endSec' | 'name'>>,
  ) {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }

  function removeSegment(id: string) {
    // Two-step confirm per project rule.
    if (armedDeleteId !== id) {
      setArmedDeleteId(id);
      window.setTimeout(() => setArmedDeleteId((cur) => (cur === id ? null : cur)), 5000);
      return;
    }
    setSegments((prev) => prev.filter((s) => s.id !== id));
    setArmedDeleteId(null);
  }

  function toggleFormat(formatId: string) {
    setSelectedFormatIds((prev) =>
      prev.includes(formatId) ? prev.filter((id) => id !== formatId) : [...prev, formatId],
    );
  }

  // ── Validation for the action button ───────────────────────────────────
  const validSegments = segments.filter(
    (s) => s.endSec > s.startSec && s.startSec < timelineDuration,
  );
  const canRun =
    hasTimeline &&
    validSegments.length > 0 &&
    selectedFormatIds.length > 0 &&
    !isRunning;

  // A future schedule time is required to schedule; otherwise we save to Library.
  const scheduleIso = useMemo(() => {
    if (!scheduledAt) {
      return null;
    }
    const date = new Date(scheduledAt);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      return null;
    }
    return date.toISOString();
  }, [scheduledAt]);

  const scheduleTimeInvalid = scheduledAt !== '' && scheduleIso === null;

  function handleRun() {
    void run(validSegments, selectedFormatIds, {
      caption,
      scheduledAt: scheduleIso,
      autoCaptions,
      resolution,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Scissors className="h-5 w-5 text-primary" />
        <CardTitle>Make Clips</CardTitle>
      </div>
      <SectionDescription>
        Cut short clips from your video, pick where they go, and schedule them.
      </SectionDescription>

      {!hasTimeline ? (
        <div className="rounded-xl border border-dashed border-border-strong bg-card p-4 text-center">
          <Caption className="block">Add clips to the timeline first, then make shorts from them.</Caption>
        </div>
      ) : (
        <>
          <SegmentList
            segments={segments}
            timelineDuration={timelineDuration}
            playheadTime={playheadTime}
            onAdd={addSegment}
            onUpdate={updateSegment}
            onRemove={removeSegment}
            armedDeleteId={armedDeleteId}
          />

          <FormatPicker selectedIds={selectedFormatIds} onToggle={toggleFormat} />

          {/* ── Options ──────────────────────────────────────────────── */}
          <section className="space-y-3 rounded-xl border border-border-strong bg-card p-4">
            <CardTitle className="text-sm">Options</CardTitle>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoCaptions}
                onChange={(e) => setAutoCaptions(e.target.checked)}
                className="h-4 w-4 rounded border-border-strong accent-primary"
              />
              <span className="text-sm text-foreground">Burn in auto-captions</span>
            </label>

            <div className="space-y-1">
              <Caption className="block">Quality</Caption>
              <div className="flex gap-2">
                {(['720p', '1080p'] as const).map((res) => (
                  <Button
                    key={res}
                    size="sm"
                    variant={resolution === res ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setResolution(res)}
                  >
                    {res}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Caption className="block">Caption (sent with the post)</Caption>
              <Input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption…"
                className="text-sm"
              />
            </div>

            <div className="space-y-1">
              <Caption className="block">Schedule for</Caption>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="text-sm"
              />
              {scheduleTimeInvalid ? (
                <Caption className="block text-destructive">Pick a time in the future.</Caption>
              ) : (
                <Caption className="block">
                  {scheduleIso
                    ? 'Each clip will be scheduled to its platform.'
                    : 'Leave empty to just save the clips to your Library.'}
                </Caption>
              )}
            </div>
          </section>

          {/* ── Action ───────────────────────────────────────────────── */}
          <Button className="w-full" onClick={handleRun} disabled={!canRun}>
            {isRunning ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Working…
              </>
            ) : scheduleIso ? (
              <>
                <Calendar className="mr-1 h-4 w-4" /> Make &amp; schedule
                {' '}
                {validSegments.length * selectedFormatIds.length} clip
                {validSegments.length * selectedFormatIds.length === 1 ? '' : 's'}
              </>
            ) : (
              <>
                <Sparkles className="mr-1 h-4 w-4" /> Make
                {' '}
                {validSegments.length * selectedFormatIds.length} clip
                {validSegments.length * selectedFormatIds.length === 1 ? '' : 's'}
              </>
            )}
          </Button>
          {!canRun && !isRunning ? (
            <Caption className="block text-center">
              Add a short with a valid in/out and pick at least one place to post.
            </Caption>
          ) : (
            <Caption className="block text-center">
              {validSegments.length} short{validSegments.length === 1 ? '' : 's'} ·{' '}
              {selectedFormatIds.length} format{selectedFormatIds.length === 1 ? '' : 's'} ·{' '}
              {formatTimecode(timelineDuration)} total
            </Caption>
          )}

          <JobList jobs={jobs} />
        </>
      )}
    </div>
  );
}
