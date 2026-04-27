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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Sparkles, Calendar as CalendarIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';
import { PLATFORM_META } from '@/lib/social/platform-config';
import { MediaUploader } from '@/components/social/MediaUploader';
import type { SocialPlatform } from '@/types/social';

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
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);

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
    toast,
  ]);

  const handleAIGenerate = useCallback(() => {
    const prompt = `Draft a ${meta.label} ${meta.verb.toLowerCase()} about [your topic here]`;
    router.push(`/dashboard?prefill=${encodeURIComponent(prompt)}`);
  }, [meta.label, meta.verb, router]);

  const handleSchedule = useCallback(() => {
    router.push('/social/calendar');
  }, [router]);

  const inputsDisabled = posting || isParked || connected === false;

  return (
    <div className="rounded-2xl border border-border-strong bg-card p-6 space-y-5">
      {/* ── Composer header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">
              Compose for {meta.label}
            </h3>
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
        <Button variant="outline" onClick={handleAIGenerate} disabled={posting || isParked}>
          <Sparkles className="mr-1.5 h-4 w-4" />
          AI Generate with {meta.label} Specialist
        </Button>
      </div>
    </div>
  );
}

export default PlatformComposer;
