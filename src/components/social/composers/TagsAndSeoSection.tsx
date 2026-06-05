'use client';

/**
 * TagsAndSeoSection — unified hashtag / keyword / platform-specific metadata
 * input used by every per-platform composer.
 *
 * Renders:
 *  1. Hashtag chip input  — type/paste `#tag`, commit on space or comma,
 *     each chip is removable.
 *  2. Keyword chip input  — same pattern, no # prefix.
 *  3. Platform-specific fields — varies by platform:
 *       bluesky / instagram  → alt-text field for the attached image
 *       youtube / tiktok     → video-tags chip input
 *       pinterest            → board category
 *       all others           → nothing
 *
 * On mount, pre-fills from the per-platform saved-tags doc via GET
 * /api/social/platforms/{platform}/composer-tags. The parent owns the form
 * state and is responsible for saving on submit — this component has no
 * auto-save side effects.
 *
 * Design system: design tokens only, no raw Tailwind shades, no inline-style
 * colour values (per CLAUDE.md).
 */

import * as React from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import type { SocialPlatform } from '@/types/social';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TagsAndSeoValue {
  hashtags: string[];
  keywords: string[];
  /** Keyed by field name (e.g. altText, videoTags, boardCategory, soundSuggestion). */
  platformSpecific: Record<string, string>;
}

export interface TagsAndSeoSectionProps {
  value: TagsAndSeoValue;
  onChange: (next: TagsAndSeoValue) => void;
  platform: SocialPlatform;
  disabled: boolean;
}

// ─── Saved-tags API response ──────────────────────────────────────────────────

interface SavedTagsResponse {
  success: boolean;
  hashtags?: string[];
  keywords?: string[];
  platformSpecific?: Record<string, string>;
}

// ─── Platforms that use the hashtag input ─────────────────────────────────────

const HASHTAG_PLATFORMS = new Set<SocialPlatform>([
  'twitter', 'bluesky', 'mastodon', 'linkedin', 'threads',
  'instagram', 'tiktok', 'pinterest',
]);

// ─── Small helpers ────────────────────────────────────────────────────────────

/** Normalise a raw user-typed token into a clean hashtag (adds # if missing). */
function normaliseHashtag(raw: string): string {
  const trimmed = raw.replace(/[,\s]+/g, '').trim();
  if (!trimmed) { return ''; }
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

/** Normalise a keyword (no # prefix, trim whitespace and leading commas). */
function normaliseKeyword(raw: string): string {
  return raw.replace(/^[,\s]+|[,\s]+$/g, '').replace(/^#+/, '');
}

// ─── ChipInput — reusable multi-value chip input ──────────────────────────────

interface ChipInputProps {
  chips: string[];
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
  normalise: (raw: string) => string;
  placeholder: string;
  disabled: boolean;
  inputId: string;
  chipColor: 'primary' | 'secondary';
}

function ChipInput({
  chips,
  onAdd,
  onRemove,
  normalise,
  placeholder,
  disabled,
  inputId,
  chipColor,
}: ChipInputProps): React.ReactElement {
  const [draft, setDraft] = React.useState('');

  const commit = React.useCallback(
    (raw: string) => {
      const value = normalise(raw);
      if (value && !chips.includes(value)) {
        onAdd(value);
      }
      setDraft('');
    },
    [chips, normalise, onAdd],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ' || e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Backspace' && draft === '' && chips.length > 0) {
      onRemove(chips.length - 1);
    }
  };

  const handleBlur = () => {
    if (draft.trim()) { commit(draft); }
  };

  const chipCls =
    chipColor === 'primary'
      ? 'bg-primary/10 text-primary border-primary/20'
      : 'bg-muted text-muted-foreground border-border-light';

  return (
    <div className="flex flex-wrap gap-1.5 rounded-md border border-border-strong bg-background px-2 py-1.5 min-h-[2.5rem] focus-within:ring-2 focus-within:ring-ring">
      {chips.map((chip, i) => (
        <span
          key={`${chip}-${i}`}
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium border ${chipCls}`}
        >
          {chip}
          {!disabled && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="hover:text-destructive focus:outline-none"
              aria-label={`Remove ${chip}`}
            >
              <X size={10} aria-hidden />
            </button>
          )}
        </span>
      ))}
      <input
        id={inputId}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={chips.length === 0 ? placeholder : ''}
        disabled={disabled}
        className="flex-1 min-w-[6rem] bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
      />
    </div>
  );
}

// ─── Platform-specific fields ─────────────────────────────────────────────────

interface PlatformSpecificFieldsProps {
  platform: SocialPlatform;
  value: Record<string, string>;
  onChange: (key: string, val: string) => void;
  disabled: boolean;
}

function PlatformSpecificFields({
  platform,
  value,
  onChange,
  disabled,
}: PlatformSpecificFieldsProps): React.ReactElement | null {
  if (platform === 'instagram' || platform === 'bluesky') {
    return (
      <div>
        <label
          className="text-xs font-medium text-muted-foreground"
          htmlFor={`${platform}-alttext`}
        >
          Alt text{' '}
          <span className="font-normal">
            (accessibility + SEO for attached image)
          </span>
        </label>
        <Textarea
          id={`${platform}-alttext`}
          value={value.altText ?? ''}
          onChange={(e) => onChange('altText', e.target.value)}
          placeholder="Describe the image clearly — helps screen readers and image search."
          rows={2}
          disabled={disabled}
          maxLength={500}
          className="mt-1 resize-none text-sm"
        />
      </div>
    );
  }

  if (platform === 'youtube' || platform === 'tiktok') {
    const videoTagStr = value.videoTags ?? '';
    const videoTags = videoTagStr
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const setVideoTags = (tags: string[]) => onChange('videoTags', tags.join(', '));

    return (
      <div className="space-y-2">
        <div>
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor={`${platform}-videotags`}
          >
            Video tags{' '}
            <span className="font-normal">(search tags for the upload form)</span>
          </label>
          <div className="mt-1">
            <ChipInput
              inputId={`${platform}-videotags`}
              chips={videoTags}
              onAdd={(v) => setVideoTags([...videoTags, v])}
              onRemove={(i) => {
                const next = [...videoTags];
                next.splice(i, 1);
                setVideoTags(next);
              }}
              normalise={normaliseKeyword}
              placeholder="Add tag, press Space"
              disabled={disabled}
              chipColor="secondary"
            />
          </div>
        </div>
        {platform === 'tiktok' && (
          <div>
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="tiktok-sound"
            >
              Trending sound suggestion
            </label>
            <Input
              id="tiktok-sound"
              value={value.soundSuggestion ?? ''}
              onChange={(e) => onChange('soundSuggestion', e.target.value)}
              placeholder="Trending audio clip or category"
              disabled={disabled}
              className="mt-1 text-sm"
            />
          </div>
        )}
      </div>
    );
  }

  if (platform === 'pinterest') {
    return (
      <div>
        <label
          className="text-xs font-medium text-muted-foreground"
          htmlFor="pinterest-boardcat"
        >
          Board category
        </label>
        <Input
          id="pinterest-boardcat"
          value={value.boardCategory ?? ''}
          onChange={(e) => onChange('boardCategory', e.target.value)}
          placeholder="e.g. Business &amp; Finance, Education"
          disabled={disabled}
          className="mt-1 text-sm"
        />
      </div>
    );
  }

  return null;
}

// ─── Utility — detect whether a platform renders platform-specific fields ─────

function hasPlatformSpecificFields(platform: SocialPlatform): boolean {
  return (
    platform === 'instagram' ||
    platform === 'bluesky' ||
    platform === 'youtube' ||
    platform === 'tiktok' ||
    platform === 'pinterest'
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TagsAndSeoSection({
  value,
  onChange,
  platform,
  disabled,
}: TagsAndSeoSectionProps): React.ReactElement {
  const authFetch = useAuthFetch();
  const showHashtags = HASHTAG_PLATFORMS.has(platform);
  const prefilled = React.useRef(false);

  // ── Pre-fill from saved-tags doc on mount ──────────────────────────────────
  React.useEffect(() => {
    if (prefilled.current) { return; }
    prefilled.current = true;

    let cancelled = false;
    const load = async () => {
      try {
        const res = await authFetch(`/api/social/platforms/${platform}/composer-tags`);
        if (!res.ok || cancelled) { return; }
        const body = (await res.json()) as SavedTagsResponse;
        if (!body.success || cancelled) { return; }
        // Pre-fill only for fields that are currently empty — don't stomp
        // a value the parent explicitly set before mounting.
        onChange({
          hashtags:
            value.hashtags.length > 0
              ? value.hashtags
              : (body.hashtags ?? []),
          keywords:
            value.keywords.length > 0
              ? value.keywords
              : (body.keywords ?? []),
          platformSpecific:
            Object.keys(value.platformSpecific).length > 0
              ? value.platformSpecific
              : (body.platformSpecific ?? {}),
        });
      } catch {
        // Swallow — empty initial state is fine on network error
      }
    };
    void load();
    return () => { cancelled = true; };
    // onChange and value intentionally omitted — this runs only once on mount
    // to pre-fill from persisted tags. Subsequent changes go through onChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);

  const setHashtags = (next: string[]) =>
    onChange({ ...value, hashtags: next });

  const setKeywords = (next: string[]) =>
    onChange({ ...value, keywords: next });

  const setPlatformSpecific = (key: string, val: string) =>
    onChange({
      ...value,
      platformSpecific: { ...value.platformSpecific, [key]: val },
    });

  return (
    <div className="space-y-3 rounded-lg border border-border-light bg-card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Discovery &amp; SEO
      </div>

      {/* Hashtags — only for hashtag-aware platforms */}
      {showHashtags && (
        <div>
          <label
            className="text-xs font-medium text-foreground"
            htmlFor={`${platform}-hashtags`}
          >
            Hashtags
            <span className="ml-1.5 font-normal text-muted-foreground">
              — type and press Space or comma to add
            </span>
          </label>
          <div className="mt-1">
            <ChipInput
              inputId={`${platform}-hashtags`}
              chips={value.hashtags}
              onAdd={(v) => setHashtags([...value.hashtags, v])}
              onRemove={(i) => {
                const next = [...value.hashtags];
                next.splice(i, 1);
                setHashtags(next);
              }}
              normalise={normaliseHashtag}
              placeholder="#yourhashtag"
              disabled={disabled}
              chipColor="primary"
            />
          </div>
        </div>
      )}

      {/* Keywords — all platforms */}
      <div>
        <label
          className="text-xs font-medium text-foreground"
          htmlFor={`${platform}-keywords`}
        >
          Keywords
          <span className="ml-1.5 font-normal text-muted-foreground">
            — phrases to weave into copy for search discoverability
          </span>
        </label>
        <div className="mt-1">
          <ChipInput
            inputId={`${platform}-keywords`}
            chips={value.keywords}
            onAdd={(v) => setKeywords([...value.keywords, v])}
            onRemove={(i) => {
              const next = [...value.keywords];
              next.splice(i, 1);
              setKeywords(next);
            }}
            normalise={normaliseKeyword}
            placeholder="Add keyword, press Space"
            disabled={disabled}
            chipColor="secondary"
          />
        </div>
      </div>

      {/* Platform-specific extras */}
      {hasPlatformSpecificFields(platform) && (
        <PlatformSpecificFields
          platform={platform}
          value={value.platformSpecific}
          onChange={setPlatformSpecific}
          disabled={disabled}
        />
      )}
    </div>
  );
}

export default TagsAndSeoSection;
