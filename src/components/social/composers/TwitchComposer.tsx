'use client';

/**
 * TwitchComposer — Native Twitch composer.
 *
 * Twitch posting in this product covers four creator-shape surfaces. The
 * operator picks one with the content-type pills and the composer adapts
 * its labels, helper copy, and char ceiling to match. Whispers (DMs) are
 * intentionally NOT a content type here — Twitch's Whisper API is gated
 * and the platform viability matrix marks it inert.
 *
 * Char ceilings:
 *   - stream_announcement (channel title): 140
 *   - chat_announcement:                   500
 *   - clip_caption (working cap):          140
 *   - schedule_segment (working cap):      200
 *
 * NOTE: PLATFORM_META.twitch does not yet exist in platform-config.ts —
 * the operator will add it after the central Twitch developer app is
 * registered. Until then we use a hard-coded Twitch purple as the accent.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { PlatformComposerFormProps } from './PlatformComposer';
import { useCharCountdownColor } from './_utils';

// ─── Local constants (replace with PLATFORM_META.twitch once added) ───────────

const TWITCH_PURPLE = '#9146FF';

type TwitchContentType =
  | 'stream_announcement'
  | 'chat_announcement'
  | 'clip_caption'
  | 'schedule_segment';

interface TwitchTypeMeta {
  label: string;
  helper: string;
  hardMax: number;
  contentLabel: string;
  contentPlaceholder: string;
  contentRows: number;
}

const TYPE_META: Record<TwitchContentType, TwitchTypeMeta> = {
  stream_announcement: {
    label: 'Stream announcement',
    helper: 'Channel title for the next live session. Subscribers see this in their notifications.',
    hardMax: 140,
    contentLabel: 'Channel title',
    contentPlaceholder: 'e.g. friday night devstream — shipping the new training UI',
    contentRows: 2,
  },
  chat_announcement: {
    label: 'Chat announcement',
    helper: 'Pinned chat highlight while live. Used for shipped features, raids, milestones, drops.',
    hardMax: 500,
    contentLabel: 'Chat announcement',
    contentPlaceholder: 'we just shipped the v2 grading UI — try it and break it for me, the bugs go straight on the board',
    contentRows: 4,
  },
  clip_caption: {
    label: 'Clip caption',
    helper: 'Caption that ships alongside a clipped highlight moment. Discovery surfaces truncate past ~140.',
    hardMax: 140,
    contentLabel: 'Clip caption',
    contentPlaceholder: 'the moment the build finally went green at 2am — chat lost it',
    contentRows: 3,
  },
  schedule_segment: {
    label: 'Schedule segment',
    helper: 'Description that appears next to the segment on your channel\'s Schedule tab.',
    hardMax: 200,
    contentLabel: 'Segment description',
    contentPlaceholder: 'pair-coding session: rebuilding the social hub onboarding flow live, viewer Qs welcome',
    contentRows: 3,
  },
};

const ALL_TYPES: TwitchContentType[] = [
  'stream_announcement',
  'chat_announcement',
  'clip_caption',
  'schedule_segment',
];

function isTwitchContentType(value: string): value is TwitchContentType {
  return (ALL_TYPES as string[]).includes(value);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TwitchComposer({
  value,
  onChange,
  disabled,
}: PlatformComposerFormProps): React.ReactElement {
  const currentType: TwitchContentType = isTwitchContentType(value.contentType)
    ? value.contentType
    : 'stream_announcement';
  const meta = TYPE_META[currentType];
  const countdownColor = useCharCountdownColor(value.content.length, meta.hardMax);

  const setContentType = (next: TwitchContentType) => {
    onChange({ ...value, contentType: next });
  };

  const setContent = (content: string) => {
    onChange({ ...value, content });
  };

  const setMetaField = (key: string, val: string) => {
    onChange({ ...value, metadata: { ...value.metadata, [key]: val } });
  };

  return (
    <div className="space-y-3">
      {/* ── Content type picker ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {ALL_TYPES.map((type) => (
          <Button
            key={type}
            type="button"
            size="sm"
            variant={currentType === type ? 'default' : 'outline'}
            onClick={() => setContentType(type)}
            disabled={disabled}
          >
            {TYPE_META[type].label}
          </Button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">{meta.helper}</p>

      {/* ── Stream-announcement only: category field ─────────────────────── */}
      {currentType === 'stream_announcement' && (
        <div>
          <label className="text-sm font-medium text-foreground" htmlFor="twitch-category">
            Category / game (optional)
          </label>
          <Input
            id="twitch-category"
            value={value.metadata.category ?? ''}
            onChange={(e) => setMetaField('category', e.target.value)}
            placeholder="e.g. Software and Game Development"
            disabled={disabled}
            className="mt-1"
          />
        </div>
      )}

      {/* ── Chat-announcement only: highlight color picker ───────────────── */}
      {currentType === 'chat_announcement' && (
        <div>
          <label className="text-sm font-medium text-foreground" htmlFor="twitch-color">
            Highlight color
          </label>
          <select
            id="twitch-color"
            value={value.metadata.color ?? 'primary'}
            onChange={(e) => setMetaField('color', e.target.value)}
            disabled={disabled}
            className="mt-1 w-full rounded-md border border-border-light bg-card px-3 py-2 text-sm text-foreground"
          >
            <option value="primary">Channel primary</option>
            <option value="blue">Blue</option>
            <option value="green">Green</option>
            <option value="orange">Orange</option>
            <option value="purple">Purple</option>
          </select>
        </div>
      )}

      {/* ── Schedule-segment only: title + duration ──────────────────────── */}
      {currentType === 'schedule_segment' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="twitch-segment-title">
              Segment title (max 25)
            </label>
            <Input
              id="twitch-segment-title"
              value={value.metadata.segmentTitle ?? ''}
              onChange={(e) => setMetaField('segmentTitle', e.target.value)}
              placeholder="Friday Devstream"
              maxLength={25}
              disabled={disabled}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="twitch-duration">
              Duration (minutes, 30-1440)
            </label>
            <Input
              id="twitch-duration"
              type="number"
              min={30}
              max={1440}
              value={value.metadata.durationMinutes ?? ''}
              onChange={(e) => setMetaField('durationMinutes', e.target.value)}
              placeholder="120"
              disabled={disabled}
              className="mt-1"
            />
          </div>
        </div>
      )}

      {/* ── Primary content area ─────────────────────────────────────────── */}
      <div>
        <label className="text-sm font-medium text-foreground" htmlFor="twitch-content">
          {meta.contentLabel} <span className="text-destructive">*</span>
        </label>
        <div className="relative mt-1">
          <Textarea
            id="twitch-content"
            value={value.content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={meta.contentPlaceholder}
            rows={meta.contentRows}
            maxLength={meta.hardMax}
            disabled={disabled}
            className="resize-none pr-16"
            style={{ borderColor: TWITCH_PURPLE }}
          />
          <div className={`absolute bottom-2 right-3 text-xs font-medium ${countdownColor}`}>
            {meta.hardMax - value.content.length}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TwitchComposer;
