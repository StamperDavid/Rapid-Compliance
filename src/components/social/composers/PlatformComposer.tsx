'use client';

/**
 * PlatformComposer — top-level wrapper for the per-platform composer.
 *
 * Owns:
 *  - Form state (content, contentType, metadata, mediaUrls)
 *  - Connection check (`/api/social/accounts?platform=...`)
 *  - Manual Post → `POST /api/social/post`
 *  - Schedule → routes to `/social/calendar`
 *  - AI Generate → routes to `/dashboard?prefill=...`
 *  - MediaUploader (always rendered below the per-platform fields, except
 *    Truth Social which is parked entirely)
 *  - Posting loading state
 *
 * Per-platform composers are controlled components that own their native UX
 * for the form fields. They receive `value/onChange/disabled` only.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2, Sparkles, Calendar as CalendarIcon, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/typography';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';
import { PLATFORM_META } from '@/lib/social/platform-config';
import { MediaUploader } from '@/components/social/MediaUploader';
import type { SocialPlatform } from '@/types/social';
import { normalizeFormat } from '@/lib/social/format-normalizer';

import { TagsAndSeoSection, type TagsAndSeoValue } from './TagsAndSeoSection';
import { TwitterComposer } from './TwitterComposer';
import { LinkedInComposer } from './LinkedInComposer';
import { FacebookComposer } from './FacebookComposer';
import { InstagramComposer } from './InstagramComposer';
import { YouTubeComposer } from './YouTubeComposer';
import { TikTokComposer } from './TikTokComposer';
import { PinterestComposer } from './PinterestComposer';
import { BlueskyComposer } from './BlueskyComposer';
import { MastodonComposer } from './MastodonComposer';
import { ThreadsComposer } from './ThreadsComposer';
import { TelegramComposer } from './TelegramComposer';
import { RedditComposer } from './RedditComposer';
import { WhatsAppBusinessComposer } from './WhatsAppBusinessComposer';
import { GoogleBusinessComposer } from './GoogleBusinessComposer';
import { TruthSocialComposer } from './TruthSocialComposer';
import { DiscordComposer } from './DiscordComposer';
import { TwitchComposer } from './TwitchComposer';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ComposerFormState {
  /** Primary text body (caption / post / message). Empty string when none. */
  content: string;
  /** Per-platform variant. e.g. 'post' | 'thread' | 'reel' | 'video' | 'short' | 'pin' | 'message' | 'article' | 'story' | 'carousel' | 'offer' | 'link'. */
  contentType: string;
  /** Free-form key/value bag for platform-specific fields (title, hashtags, channel, subreddit, visibility, etc.). */
  metadata: Record<string, string>;
}

export interface PlatformComposerFormProps {
  value: ComposerFormState;
  onChange: (next: ComposerFormState) => void;
  disabled: boolean;
}

interface PlatformComposerProps {
  platform: SocialPlatform;
}

interface PostResult {
  success: boolean;
  postId?: string;
  error?: string;
}

interface GeneratePostResponse {
  success: boolean;
  missionId?: string;
  error?: string;
}

interface AccountListResponse {
  accounts?: Array<{ status: string }>;
}

// ─── Per-platform composer pickup ────────────────────────────────────────────

const COMPOSER_BY_PLATFORM: Record<SocialPlatform, React.ComponentType<PlatformComposerFormProps>> = {
  twitter: TwitterComposer,
  linkedin: LinkedInComposer,
  facebook: FacebookComposer,
  instagram: InstagramComposer,
  youtube: YouTubeComposer,
  tiktok: TikTokComposer,
  bluesky: BlueskyComposer,
  threads: ThreadsComposer,
  truth_social: TruthSocialComposer,
  mastodon: MastodonComposer,
  telegram: TelegramComposer,
  reddit: RedditComposer,
  pinterest: PinterestComposer,
  whatsapp_business: WhatsAppBusinessComposer,
  google_business: GoogleBusinessComposer,
  discord: DiscordComposer,
  twitch: TwitchComposer,
};

const DEFAULT_CONTENT_TYPE: Record<SocialPlatform, string> = {
  twitter: 'post',
  linkedin: 'post',
  facebook: 'post',
  instagram: 'post',
  youtube: 'video',
  tiktok: 'video',
  bluesky: 'post',
  threads: 'post',
  truth_social: 'post',
  mastodon: 'post',
  telegram: 'message',
  reddit: 'post',
  pinterest: 'pin',
  whatsapp_business: 'message',
  google_business: 'post',
  discord: 'channel_post',
  twitch: 'chat_announcement',
};

const REQUIRES_MEDIA: Partial<Record<SocialPlatform, boolean>> = {
  instagram: true,
  pinterest: true,
  tiktok: true,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function PlatformComposer({ platform }: PlatformComposerProps): React.ReactElement {
  const router = useRouter();
  const authFetch = useAuthFetch();
  const toast = useToast();
  const meta = PLATFORM_META[platform];
  const PerPlatformComposer = COMPOSER_BY_PLATFORM[platform];
  const isParked = platform === 'truth_social';

  const [formState, setFormState] = useState<ComposerFormState>({
    content: '',
    contentType: DEFAULT_CONTENT_TYPE[platform],
    metadata: {},
  });

  // Discovery & SEO state — managed separately so TagsAndSeoSection has its
  // own clean state slice; merged into metadata at post time via handlePost.
  const [tagsValue, setTagsValue] = useState<TagsAndSeoValue>({
    hashtags: [],
    keywords: [],
    platformSpecific: {},
  });

  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);

  // AI Generate popover state
  const [showGeneratePopover, setShowGeneratePopover] = useState(false);
  const [generateBrief, setGenerateBrief] = useState('');
  const [generating, setGenerating] = useState(false);
  const briefTextareaRef = useRef<HTMLTextAreaElement>(null);

  const checkConnection = useCallback(async () => {
    try {
      const res = await authFetch(`/api/social/accounts?platform=${platform}`);
      if (res.ok) {
        const data = (await res.json()) as AccountListResponse;
        setConnected(data.accounts?.some((a) => a.status === 'active') ?? false);
      } else {
        setConnected(false);
      }
    } catch {
      setConnected(false);
    }
  }, [authFetch, platform]);

  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  const requiresMedia = REQUIRES_MEDIA[platform] ?? false;
  const hasMedia = mediaUrls.length > 0;
  const hasContent = formState.content.trim().length > 0;

  // Per-platform required-field gates beyond just `content`.
  const missingPlatformRequiredFields = useMemo<string[]>(() => {
    const missing: string[] = [];
    const md = formState.metadata;
    if (platform === 'youtube' && !md.title?.trim()) {missing.push('Title');}
    if (platform === 'pinterest') {
      if (!md.title?.trim()) {missing.push('Pin title');}
    }
    if (platform === 'reddit') {
      if (!md.subreddit?.trim()) {missing.push('Subreddit');}
      if (!md.title?.trim()) {missing.push('Title');}
      if (formState.contentType === 'link' && !md.url?.trim()) {missing.push('URL');}
    }
    if (platform === 'linkedin' && formState.contentType === 'article' && !md.title?.trim()) {
      missing.push('Article title');
    }
    if (platform === 'google_business' && formState.contentType === 'offer' && !md.title?.trim()) {
      missing.push('Offer title');
    }
    if (platform === 'telegram' && !md.channel?.trim()) {missing.push('Channel');}
    return missing;
  }, [formState, platform]);

  const postDisabled =
    isParked ||
    posting ||
    connected === null ||
    connected === false ||
    !hasContent ||
    (requiresMedia && !hasMedia) ||
    missingPlatformRequiredFields.length > 0;

  const handlePost = useCallback(async () => {
    if (postDisabled) {
      if (!hasContent) {
        toast.error('Please write some content before posting.');
      } else if (requiresMedia && !hasMedia) {
        toast.error(`${meta.label} requires media. Upload below.`);
      } else if (missingPlatformRequiredFields.length > 0) {
        toast.error(`Please fill in: ${missingPlatformRequiredFields.join(', ')}`);
      }
      return;
    }
    setPosting(true);
    try {
      const res = await authFetch('/api/social/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          contentType: formState.contentType,
          content: formState.content,
          metadata: {
            ...formState.metadata,
            // SEO / discovery fields stored as comma-separated strings in
            // metadata so the existing Record<string, string> contract is
            // preserved. The posting route passes metadata through verbatim
            // to the platform handler — see TODO in /api/social/post/route.ts.
            // TODO: thread hashtags/keywords into the platform posting body
            // (each platform handler needs to be updated to read these keys).
            ...(tagsValue.hashtags.length > 0
              ? { hashtags: tagsValue.hashtags.join(', ') }
              : {}),
            ...(tagsValue.keywords.length > 0
              ? { keywords: tagsValue.keywords.join(', ') }
              : {}),
            ...tagsValue.platformSpecific,
            ...(mediaUrls.length > 0 ? { mediaUrl: mediaUrls[0] } : {}),
          },
        }),
      });
      const result = (await res.json()) as PostResult;
      if (result.success) {
        toast.success(`Posted to ${meta.label}!`);
        setFormState({
          content: '',
          contentType: DEFAULT_CONTENT_TYPE[platform],
          metadata: {},
        });
        setTagsValue({ hashtags: [], keywords: [], platformSpecific: {} });
        setMediaUrls([]);
      } else {
        toast.error(result.error ?? 'Post failed');
      }
    } catch {
      toast.error('Failed to post. Check your connection.');
    } finally {
      setPosting(false);
    }
  }, [
    authFetch,
    formState,
    hasContent,
    hasMedia,
    mediaUrls,
    meta.label,
    missingPlatformRequiredFields,
    platform,
    postDisabled,
    requiresMedia,
    tagsValue.hashtags,
    tagsValue.keywords,
    tagsValue.platformSpecific,
    toast,
  ]);

  const openGeneratePopover = useCallback(() => {
    setShowGeneratePopover(true);
    setGenerateBrief('');
    // Focus the textarea on next paint
    requestAnimationFrame(() => {
      briefTextareaRef.current?.focus();
    });
  }, []);

  const closeGeneratePopover = useCallback(() => {
    setShowGeneratePopover(false);
    setGenerateBrief('');
  }, []);

  const handleAIGenerate = useCallback(async () => {
    if (!generateBrief.trim()) {
      toast.error('Please describe what to write about.');
      return;
    }
    setGenerating(true);
    try {
      const res = await authFetch(
        `/api/social/platforms/${platform}/generate-post`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brief: generateBrief.trim(),
            format: normalizeFormat(undefined, formState.contentType),
          }),
        },
      );
      const data = (await res.json()) as GeneratePostResponse;
      if (!res.ok || !data.success) {
        toast.error(data.error ?? `HTTP ${res.status} — could not start mission`);
        return;
      }
      closeGeneratePopover();
      toast.success('Mission started — review at the top of this page');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to start mission');
    } finally {
      setGenerating(false);
    }
  }, [
    authFetch,
    closeGeneratePopover,
    formState.contentType,
    generateBrief,
    platform,
    router,
    toast,
  ]);

  const handleSchedule = useCallback(() => {
    router.push('/social/calendar');
  }, [router]);

  const inputsDisabled = posting || isParked || connected === null || connected === false;

  return (
    <div className="rounded-2xl border border-border-strong bg-card p-6 space-y-5 w-full h-full flex flex-col overflow-y-auto">
      {/* ── Composer header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle as="h3">
              Compose for {meta.label}
            </CardTitle>
            {connected === true && (
              <span className="inline-flex items-center gap-1 text-xs text-success font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Connected
              </span>
            )}
            {connected === false && (
              <span className="inline-flex items-center gap-1 text-xs text-destructive font-medium">
                <AlertCircle className="h-3.5 w-3.5" />
                Not connected
              </span>
            )}
            {connected === null && (
              <span className="text-xs text-muted-foreground">Checking…</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Native {meta.label} composer — write what you&apos;d post and hit send.
          </p>
        </div>
      </div>

      {/* ── Per-platform composer ───────────────────────────────────────── */}
      <PerPlatformComposer
        value={formState}
        onChange={setFormState}
        disabled={inputsDisabled}
      />

      {/* ── Discovery & SEO (hidden for Truth Social) ──────────────────── */}
      {!isParked && (
        <TagsAndSeoSection
          value={tagsValue}
          onChange={setTagsValue}
          platform={platform}
          disabled={inputsDisabled}
        />
      )}

      {/* ── Media uploader (hidden for Truth Social) ────────────────────── */}
      {!isParked && (
        <div>
          <label className="text-sm font-medium text-foreground">
            Attach Media{requiresMedia && <span className="text-destructive ml-1">*</span>}
          </label>
          <div className="mt-1">
            <MediaUploader
              onUpload={(url) => setMediaUrls([url])}
              onRemove={() => setMediaUrls([])}
              disabled={inputsDisabled}
            />
          </div>
        </div>
      )}

      {/* ── Action row ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button
          onClick={() => void handlePost()}
          disabled={postDisabled}
          style={
            postDisabled
              ? undefined
              : { backgroundColor: meta.color, color: '#fff' }
          }
          className="text-white"
        >
          {posting ? 'Posting…' : `Post to ${meta.label}`}
        </Button>
        <Button variant="outline" onClick={handleSchedule} disabled={posting || isParked}>
          <CalendarIcon className="mr-1.5 h-4 w-4" />
          Schedule for later
        </Button>
        <Button
          variant="outline"
          onClick={openGeneratePopover}
          disabled={posting || isParked}
        >
          <Sparkles className="mr-1.5 h-4 w-4" />
          AI Generate with {meta.label} Specialist
        </Button>
      </div>

      {/* ── AI Generate popover ─────────────────────────────────────────── */}
      {showGeneratePopover && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="AI content brief"
          className="mt-3 rounded-2xl border border-border-strong bg-card p-4 space-y-3 shadow-lg"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              <span className="text-sm font-semibold text-foreground">
                What should I write about?
              </span>
            </div>
            <button
              type="button"
              onClick={closeGeneratePopover}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <textarea
            ref={briefTextareaRef}
            value={generateBrief}
            onChange={(e) => setGenerateBrief(e.target.value)}
            disabled={generating}
            placeholder={`e.g. "Our new compliance automation feature — highlight the time savings"`}
            rows={3}
            className="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                void handleAIGenerate();
              }
              if (e.key === 'Escape') {
                closeGeneratePopover();
              }
            }}
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={closeGeneratePopover}
              disabled={generating}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleAIGenerate()}
              disabled={generating || !generateBrief.trim()}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                  Starting...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Generate
                </>
              )}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Tip: Press Cmd/Ctrl + Enter to generate.
          </p>
        </div>
      )}
    </div>
  );
}

export default PlatformComposer;
