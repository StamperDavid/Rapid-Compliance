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
import { AlertCircle, CheckCircle2, Loader2, Sparkles, Calendar as CalendarIcon, X, Wand2, Undo2, ChevronDown, Link2, CalendarDays, Hash, Layers, Plus, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/typography';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';
import { PLATFORM_META } from '@/lib/social/platform-config';
import { getPlatformConfig } from '@/components/social/_platform-state';
import { MediaUploader } from '@/components/social/MediaUploader';
import type { SocialPlatform } from '@/types/social';
import { normalizeFormat } from '@/lib/social/format-normalizer';
import type { UpcomingOccasion } from '@/lib/social/occasions';

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
import { WhatsAppBusinessComposer } from './WhatsAppBusinessComposer';
import { GoogleBusinessComposer } from './GoogleBusinessComposer';
import { DiscordComposer } from './DiscordComposer';
import { TwitchComposer } from './TwitchComposer';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ComposerFormState {
  /** Primary text body (caption / post / message). Empty string when none. */
  content: string;
  /** Per-platform variant. e.g. 'post' | 'thread' | 'reel' | 'video' | 'short' | 'pin' | 'message' | 'article' | 'story' | 'carousel' | 'offer' | 'link'. */
  contentType: string;
  /** Free-form key/value bag for platform-specific fields (title, hashtags, channel, visibility, etc.). */
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

// ─── Inline AI assist (rephrase / shorten / expand / change tone) ──────────────

type AssistAction = 'rephrase' | 'shorten' | 'expand' | 'tone';
type AssistTone = 'professional' | 'casual' | 'bold' | 'friendly';

interface ComposerAssistResponse {
  success: boolean;
  text?: string;
  error?: string;
}

const ASSIST_TONES: ReadonlyArray<{ value: AssistTone; label: string }> = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'bold', label: 'Bold' },
  { value: 'friendly', label: 'Friendly' },
];

// ─── Quick-win composer controls (link / occasion / hashtags / variants) ───────

interface FromLinkResponse {
  success: boolean;
  text?: string;
  source?: 'url' | 'pasted';
  error?: string;
}

interface OccasionsListResponse {
  success: boolean;
  occasions?: UpcomingOccasion[];
  error?: string;
}

interface OccasionPostResponse {
  success: boolean;
  text?: string;
  error?: string;
}

interface HashtagsResponse {
  success: boolean;
  hashtags?: string[];
  error?: string;
}

interface VariantsResponse {
  success: boolean;
  variants?: string[];
  error?: string;
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
  mastodon: MastodonComposer,
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
  mastodon: 'post',
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

  // Inline AI assist state. `assistBusy` holds the action currently running so
  // we can show a per-control spinner; `prevContent` keeps the pre-transform
  // draft so the operator can revert in one click; `showToneMenu` toggles the
  // small tone picker.
  const [assistBusy, setAssistBusy] = useState<AssistAction | null>(null);
  const [prevContent, setPrevContent] = useState<string | null>(null);
  const [showToneMenu, setShowToneMenu] = useState(false);

  // Quick-win control state.
  // 1) Link / article → post.
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [linkAngle, setLinkAngle] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  // 2) Occasion / holiday → post.
  const [showOccasionPanel, setShowOccasionPanel] = useState(false);
  const [occasions, setOccasions] = useState<UpcomingOccasion[] | null>(null);
  const [occasionsLoading, setOccasionsLoading] = useState(false);
  const [occasionBusyId, setOccasionBusyId] = useState<string | null>(null);
  // 3) Hashtag generator.
  const [hashtagBusy, setHashtagBusy] = useState(false);
  const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>([]);
  // 4) Multi-variant generation.
  const [variantsBusy, setVariantsBusy] = useState(false);
  const [variants, setVariants] = useState<string[]>([]);

  // AI assist is only offered where a real platform specialist exists (mirrors
  // the AI Generate gate and the composer-assist endpoint).
  const assistAvailable = getPlatformConfig(platform).specialistId !== null;

  const checkConnection = useCallback(async (): Promise<'connected' | 'not_connected' | 'auth_not_ready'> => {
    try {
      const res = await authFetch(`/api/social/accounts?platform=${platform}`);
      if (res.ok) {
        const data = (await res.json()) as AccountListResponse;
        const isActive = data.accounts?.some((a) => a.status === 'active') ?? false;
        return isActive ? 'connected' : 'not_connected';
      }
      // 401/403 means the auth token isn't ready yet — distinguish from a
      // real "no active account" answer so we can retry instead of locking
      // the composer out.
      if (res.status === 401 || res.status === 403) {
        return 'auth_not_ready';
      }
      return 'not_connected';
    } catch {
      // Network error → treat as auth-not-ready so we retry, not lock out.
      return 'auth_not_ready';
    }
  }, [authFetch, platform]);

  // Retry the connection check on transient auth-not-ready failures so the
  // composer doesn't permanently disable itself when authFetch hadn't
  // finished hydrating its token at first-paint. Backs off (250 ms, 500 ms,
  // 1 s, 2 s, 4 s) and gives up after ~8 s — by that point the token is
  // either ready or genuinely missing.
  useEffect(() => {
    let cancelled = false;
    const delays = [0, 250, 500, 1000, 2000, 4000];
    void (async () => {
      for (const delay of delays) {
        if (cancelled) { return; }
        if (delay > 0) {
          await new Promise<void>((r) => { setTimeout(r, delay); });
          if (cancelled) { return; }
        }
        const result = await checkConnection();
        if (cancelled) { return; }
        if (result === 'connected') {
          setConnected(true);
          return;
        }
        if (result === 'not_connected') {
          setConnected(false);
          return;
        }
        // 'auth_not_ready' — keep retrying.
      }
      // Exhausted retries without a definitive answer — treat as not
      // connected so the composer at least gives the operator the
      // "Connect your account" nudge instead of staying stuck on
      // "Checking…".
      if (!cancelled) {
        setConnected(false);
      }
    })();
    return () => { cancelled = true; };
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
    if (platform === 'linkedin' && formState.contentType === 'article' && !md.title?.trim()) {
      missing.push('Article title');
    }
    if (platform === 'google_business' && formState.contentType === 'offer' && !md.title?.trim()) {
      missing.push('Offer title');
    }
    return missing;
  }, [formState, platform]);

  const postDisabled =
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

  const runAssist = useCallback(
    async (action: AssistAction, tone?: AssistTone) => {
      const draft = formState.content.trim();
      if (!draft) {
        toast.error('Write a draft first, then let the AI refine it.');
        return;
      }
      setShowToneMenu(false);
      setAssistBusy(action);
      const before = formState.content;
      try {
        const res = await authFetch('/api/social/composer-assist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform,
            text: draft,
            action,
            ...(tone ? { tone } : {}),
          }),
        });
        const data = (await res.json()) as ComposerAssistResponse;
        if (!res.ok || !data.success || !data.text) {
          toast.error(data.error ?? `HTTP ${res.status} — AI assist could not run`);
          return;
        }
        // Keep the pre-transform draft so the operator can undo in one click.
        setPrevContent(before);
        setFormState((prev) => ({ ...prev, content: data.text ?? prev.content }));
        toast.success('Draft updated — use Revert if you preferred the original.');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'AI assist failed. Check your connection.');
      } finally {
        setAssistBusy(null);
      }
    },
    [authFetch, formState.content, platform, toast],
  );

  const revertAssist = useCallback(() => {
    if (prevContent === null) { return; }
    setFormState((prev) => ({ ...prev, content: prevContent }));
    setPrevContent(null);
    toast.success('Reverted to your previous draft.');
  }, [prevContent, toast]);

  // Drop newly generated copy into the composer, keeping the prior draft so the
  // operator can Revert in one click. Shared by link / occasion / variants.
  const applyGeneratedContent = useCallback((next: string) => {
    setPrevContent(formState.content);
    setFormState((prev) => ({ ...prev, content: next }));
  }, [formState.content]);

  // ── 1) Link / article → post ────────────────────────────────────────────
  const handleFromLink = useCallback(async () => {
    const url = linkUrl.trim();
    const text = linkText.trim();
    if (!url && !text) {
      toast.error('Paste an article link or the article text first.');
      return;
    }
    setLinkBusy(true);
    try {
      const res = await authFetch('/api/social/composer-from-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          contentType: formState.contentType,
          ...(url ? { url } : {}),
          ...(text ? { articleText: text } : {}),
          ...(linkAngle.trim() ? { angle: linkAngle.trim() } : {}),
        }),
      });
      const data = (await res.json()) as FromLinkResponse;
      if (!res.ok || !data.success || !data.text) {
        toast.error(data.error ?? `HTTP ${res.status} — could not draft from that link`);
        return;
      }
      applyGeneratedContent(data.text);
      setShowLinkPanel(false);
      setLinkUrl('');
      setLinkText('');
      setLinkAngle('');
      toast.success('Draft created from your article — use Revert if you preferred what you had.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to draft from link. Check your connection.');
    } finally {
      setLinkBusy(false);
    }
  }, [authFetch, applyGeneratedContent, formState.contentType, linkAngle, linkText, linkUrl, platform, toast]);

  // ── 2) Occasion / holiday → post ────────────────────────────────────────
  const openOccasionPanel = useCallback(async () => {
    setShowOccasionPanel(true);
    if (occasions !== null || occasionsLoading) { return; }
    setOccasionsLoading(true);
    try {
      const res = await authFetch('/api/social/composer-occasion');
      const data = (await res.json()) as OccasionsListResponse;
      if (res.ok && data.success && data.occasions) {
        setOccasions(data.occasions);
      } else {
        toast.error(data.error ?? 'Could not load upcoming occasions.');
      }
    } catch {
      toast.error('Could not load upcoming occasions. Check your connection.');
    } finally {
      setOccasionsLoading(false);
    }
  }, [authFetch, occasions, occasionsLoading, toast]);

  const handleOccasionPost = useCallback(async (occasion: UpcomingOccasion) => {
    setOccasionBusyId(occasion.id);
    try {
      const res = await authFetch('/api/social/composer-occasion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          contentType: formState.contentType,
          occasionName: occasion.name,
          occasionDateIso: occasion.nextDateIso,
        }),
      });
      const data = (await res.json()) as OccasionPostResponse;
      if (!res.ok || !data.success || !data.text) {
        toast.error(data.error ?? `HTTP ${res.status} — could not draft that post`);
        return;
      }
      applyGeneratedContent(data.text);
      setShowOccasionPanel(false);
      toast.success(`Draft created for ${occasion.name} — use Revert if you preferred what you had.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to draft occasion post. Check your connection.');
    } finally {
      setOccasionBusyId(null);
    }
  }, [authFetch, applyGeneratedContent, formState.contentType, platform, toast]);

  // ── 3) Hashtag generator ────────────────────────────────────────────────
  const handleSuggestHashtags = useCallback(async () => {
    const draft = formState.content.trim();
    if (!draft) {
      toast.error('Write a draft first, then I can suggest hashtags.');
      return;
    }
    setHashtagBusy(true);
    try {
      const res = await authFetch('/api/social/composer-hashtags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, contentType: formState.contentType, text: draft }),
      });
      const data = (await res.json()) as HashtagsResponse;
      if (!res.ok || !data.success || !data.hashtags || data.hashtags.length === 0) {
        toast.error(data.error ?? `HTTP ${res.status} — could not suggest hashtags`);
        return;
      }
      setSuggestedHashtags(data.hashtags);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to suggest hashtags. Check your connection.');
    } finally {
      setHashtagBusy(false);
    }
  }, [authFetch, formState.content, formState.contentType, platform, toast]);

  const appendHashtag = useCallback((tag: string) => {
    setFormState((prev) => {
      const base = prev.content.trimEnd();
      // Don't double-append a tag that's already in the draft.
      if (new RegExp(`(^|\\s)${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i').test(prev.content)) {
        return prev;
      }
      const joined = base.length > 0 ? `${base} ${tag}` : tag;
      return { ...prev, content: joined };
    });
    setSuggestedHashtags((prev) => prev.filter((t) => t.toLowerCase() !== tag.toLowerCase()));
  }, []);

  const appendAllHashtags = useCallback(() => {
    setFormState((prev) => {
      const existing = prev.content;
      const toAdd = suggestedHashtags.filter(
        (tag) => !new RegExp(`(^|\\s)${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i').test(existing),
      );
      if (toAdd.length === 0) { return prev; }
      const base = existing.trimEnd();
      const joined = base.length > 0 ? `${base} ${toAdd.join(' ')}` : toAdd.join(' ');
      return { ...prev, content: joined };
    });
    setSuggestedHashtags([]);
  }, [suggestedHashtags]);

  // ── 4) Multi-variant generation ─────────────────────────────────────────
  const handleVariants = useCallback(async () => {
    const draft = formState.content.trim();
    if (!draft) {
      toast.error('Write a draft first, then I can give you variations.');
      return;
    }
    setVariantsBusy(true);
    setVariants([]);
    try {
      const res = await authFetch('/api/social/composer-variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, contentType: formState.contentType, text: draft, count: 3 }),
      });
      const data = (await res.json()) as VariantsResponse;
      if (!res.ok || !data.success || !data.variants || data.variants.length === 0) {
        toast.error(data.error ?? `HTTP ${res.status} — could not generate variations`);
        return;
      }
      setVariants(data.variants);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate variations. Check your connection.');
    } finally {
      setVariantsBusy(false);
    }
  }, [authFetch, formState.content, formState.contentType, platform, toast]);

  const pickVariant = useCallback((variant: string) => {
    applyGeneratedContent(variant);
    setVariants([]);
    toast.success('Draft replaced with the variation you picked — use Revert to undo.');
  }, [applyGeneratedContent, toast]);

  const handleSchedule = useCallback(() => {
    router.push('/social/calendar');
  }, [router]);

  const inputsDisabled = posting || connected === null || connected === false;

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

      {/* ── Inline AI assist ────────────────────────────────────────────── */}
      {assistAvailable && (
        <div className="rounded-xl border border-border-light bg-surface-elevated p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Wand2 className="h-3.5 w-3.5 text-primary" aria-hidden />
            <span className="text-xs font-semibold text-foreground">AI assist</span>
            <span className="text-[11px] text-muted-foreground">
              Refine your draft with the {meta.label} specialist
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void runAssist('rephrase')}
              disabled={inputsDisabled || assistBusy !== null || !hasContent}
            >
              {assistBusy === 'rephrase'
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                : <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
              Rephrase
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void runAssist('shorten')}
              disabled={inputsDisabled || assistBusy !== null || !hasContent}
            >
              {assistBusy === 'shorten'
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                : null}
              Shorten
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void runAssist('expand')}
              disabled={inputsDisabled || assistBusy !== null || !hasContent}
            >
              {assistBusy === 'expand'
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                : null}
              Expand
            </Button>

            {/* Change tone — small inline tone picker */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowToneMenu((v) => !v)}
                disabled={inputsDisabled || assistBusy !== null || !hasContent}
                aria-haspopup="menu"
                aria-expanded={showToneMenu}
              >
                {assistBusy === 'tone'
                  ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                  : null}
                Change tone
                <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" aria-hidden />
              </Button>
              {showToneMenu && (
                <div
                  role="menu"
                  className="absolute z-50 mt-1 w-44 rounded-lg border border-border-strong bg-popover text-popover-foreground shadow-md p-1"
                >
                  {ASSIST_TONES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      role="menuitem"
                      onClick={() => void runAssist('tone', t.value)}
                      className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleSuggestHashtags()}
              disabled={inputsDisabled || hashtagBusy || variantsBusy || !hasContent}
            >
              {hashtagBusy
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                : <Hash className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
              Suggest hashtags
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleVariants()}
              disabled={inputsDisabled || variantsBusy || hashtagBusy || !hasContent}
            >
              {variantsBusy
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                : <Layers className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
              Variations
            </Button>

            {prevContent !== null && (
              <Button
                variant="ghost"
                size="sm"
                onClick={revertAssist}
                disabled={assistBusy !== null}
              >
                <Undo2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Revert
              </Button>
            )}
          </div>

          {/* Suggested hashtags */}
          {suggestedHashtags.length > 0 && (
            <div className="mt-3 rounded-lg border border-border-light bg-card p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-foreground">Suggested hashtags</span>
                <Button variant="outline" size="sm" onClick={appendAllHashtags}>
                  <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
                  Add all
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestedHashtags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => appendHashtag(tag)}
                    className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface-elevated px-2.5 py-1 text-xs text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Plus className="h-3 w-3 opacity-70" aria-hidden />
                    {tag}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Tap a tag to add it to your draft.</p>
            </div>
          )}

          {/* Variations */}
          {variants.length > 0 && (
            <div className="mt-3 space-y-2">
              <span className="text-xs font-semibold text-foreground">Pick a variation to use</span>
              {variants.map((variant, idx) => (
                <div
                  key={`${idx}-${variant.slice(0, 24)}`}
                  className="rounded-lg border border-border-light bg-card p-3"
                >
                  <p className="text-sm text-foreground whitespace-pre-wrap">{variant}</p>
                  <div className="mt-2 flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => pickVariant(variant)}>
                      <Check className="mr-1 h-3.5 w-3.5" aria-hidden />
                      Use this one
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Quick create: from a link / for an occasion ─────────────────── */}
      {assistAvailable && (
        <div className="rounded-xl border border-border-light bg-surface-elevated p-3 space-y-3">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            <span className="text-xs font-semibold text-foreground">Quick create</span>
            <span className="text-[11px] text-muted-foreground">
              Start a draft from an article or an upcoming occasion
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowLinkPanel((v) => !v); setShowOccasionPanel(false); }}
              disabled={inputsDisabled}
              aria-expanded={showLinkPanel}
            >
              <Link2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              From a link or article
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowOccasionPanel((v) => !v); setShowLinkPanel(false); if (!showOccasionPanel) { void openOccasionPanel(); } }}
              disabled={inputsDisabled}
              aria-expanded={showOccasionPanel}
            >
              <CalendarDays className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              For an occasion
            </Button>
          </div>

          {/* Link panel */}
          {showLinkPanel && (
            <div className="rounded-lg border border-border-strong bg-card p-3 space-y-2">
              <label className="text-xs font-medium text-foreground" htmlFor="composer-link-url">
                Article link
              </label>
              <input
                id="composer-link-url"
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                disabled={linkBusy}
                placeholder="https://example.com/article"
                className="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
              />
              <div className="text-[11px] text-muted-foreground">
                Or paste the article text instead (more reliable if the link is behind a paywall):
              </div>
              <textarea
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                disabled={linkBusy}
                rows={3}
                placeholder="Paste the article text here…"
                className="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
              />
              <input
                type="text"
                value={linkAngle}
                onChange={(e) => setLinkAngle(e.target.value)}
                disabled={linkBusy}
                placeholder="Optional: angle to emphasize (e.g. the time-savings)"
                className="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => void handleFromLink()}
                  disabled={linkBusy || (!linkUrl.trim() && !linkText.trim())}
                >
                  {linkBusy
                    ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />Drafting…</>
                    : <><Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden />Draft post</>}
                </Button>
              </div>
            </div>
          )}

          {/* Occasion panel */}
          {showOccasionPanel && (
            <div className="rounded-lg border border-border-strong bg-card p-3">
              {occasionsLoading && occasions === null ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading upcoming occasions…
                </div>
              ) : occasions && occasions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {occasions.map((occ) => (
                    <button
                      key={occ.id}
                      type="button"
                      onClick={() => void handleOccasionPost(occ)}
                      disabled={occasionBusyId !== null}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-elevated px-3 py-1.5 text-xs text-foreground hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                    >
                      {occasionBusyId === occ.id
                        ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                        : <CalendarDays className="h-3 w-3 opacity-70" aria-hidden />}
                      <span>{occ.name}</span>
                      <span className="text-muted-foreground">· {occ.daysAway === 0 ? 'today' : `${occ.daysAway}d`}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming occasions to show.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Discovery & SEO ─────────────────────────────────────────────── */}
      <TagsAndSeoSection
        value={tagsValue}
        onChange={setTagsValue}
        platform={platform}
        disabled={inputsDisabled}
      />

      {/* ── Media uploader ──────────────────────────────────────────────── */}
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

      {/* ── Action row ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button
          onClick={() => void handlePost()}
          disabled={postDisabled}
          // Always paint the brand color so the button reads as a real
          // primary action, not a "broken" black/grey placeholder. Disabled
          // state drops opacity so the operator can see at a glance whether
          // they need to type content / wait for the connection check
          // without confusing it for a permanent error.
          style={{
            backgroundColor: meta.color,
            color: '#fff',
            opacity: postDisabled ? 0.55 : 1,
          }}
          className="text-white"
        >
          {posting ? 'Posting…' : `Post to ${meta.label}`}
        </Button>
        <Button variant="outline" onClick={handleSchedule} disabled={posting}>
          <CalendarIcon className="mr-1.5 h-4 w-4" />
          Schedule for later
        </Button>
        <Button
          variant="outline"
          onClick={openGeneratePopover}
          disabled={posting}
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
