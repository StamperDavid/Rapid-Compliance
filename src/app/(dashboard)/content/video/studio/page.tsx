'use client';

/**
 * Content Generator → Studio tab.
 *
 * Magic Studio-pattern unified composer for image / video / music / text.
 * Lives under the Content Generator hub at /content/video/studio. The
 * SubpageNav along the top is shared with the rest of the hub (Video,
 * Calendar, Image, Editor, Library, Audio Lab).
 *
 * Layout:
 *   ┌──────────────┬──────────────────────────────────────┬──────────────┐
 *   │              │ Command Bar (prompt + selectors)     │              │
 *   │  Tool        ├──────────────────────────────────────┤  Recent      │
 *   │  Palette     │                                      │  Generations │
 *   │              │  Persistent Canvas                   │              │
 *   │  - Image     │  (result lives here while operator   │              │
 *   │  - Video     │   iterates — switching tools does    │              │
 *   │  - Music     │   NOT clear it)                      │              │
 *   │  - Text      │                                      │              │
 *   │              │                                      │              │
 *   └──────────────┴──────────────────────────────────────┴──────────────┘
 *
 * State persistence across tool switches:
 *   The page keeps a per-tool record of `commandState` (prompt + selectors)
 *   AND a per-tool `result`. Switching tools restores the slot for that tool.
 *   Generated images can be dragged from Recent onto the canvas while the
 *   Video tool is active — they become the avatar portrait.
 *
 * Deep-link entry:
 *   Platform dashboards may link here with query params:
 *     ?platform=bluesky&format=thread&brief=<encoded>&hook=<encoded>&body=<encoded>&returnTo=%2Fsocial%2Fplatforms%2Fbluesky
 *   parseDeepLinkBrief() converts these into initial tool + command state.
 *   A "← Back to {platform} dashboard" breadcrumb renders when returnTo is present.
 */

import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import SubpageNav from '@/components/ui/SubpageNav';
import { CONTENT_GENERATOR_TABS } from '@/lib/constants/subpage-nav';
import { StudioToolPalette, type StudioTool } from '@/components/studio/StudioToolPalette';
import {
  StudioCommandBar,
  DEFAULT_COMMAND_STATE,
  type StudioCommandState,
} from '@/components/studio/StudioCommandBar';
import { StudioCanvas, type StudioResult } from '@/components/studio/StudioCanvas';
import { StudioRecentSidebar } from '@/components/studio/StudioRecentSidebar';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import { PLATFORM_META } from '@/lib/social/platform-config';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';
import type {
  MediaItem,
  MediaType,
  MediaCategory,
} from '@/types/media-library';

// ============================================================================
// Per-tool slot
// ============================================================================

interface ToolSlot {
  command: StudioCommandState;
  result: StudioResult | null;
  error: string | null;
}

const TOOL_IDS: readonly StudioTool[] = ['image', 'video', 'music', 'text'];

function buildInitialSlots(): Record<StudioTool, ToolSlot> {
  const slots: Partial<Record<StudioTool, ToolSlot>> = {};
  for (const id of TOOL_IDS) {
    slots[id] = {
      command: { ...DEFAULT_COMMAND_STATE },
      result: null,
      error: null,
    };
  }
  return slots as Record<StudioTool, ToolSlot>;
}

// ============================================================================
// Deep-link param parser
// ============================================================================

interface DeepLinkBrief {
  platform: SocialPlatform | null;
  tool: StudioTool;
  command: Partial<StudioCommandState>;
  returnTo: string | null;
}

const FORMAT_TO_TOOL: Record<string, StudioTool> = {
  'single-post': 'text',
  'thread': 'text',
  'short-form-video': 'video',
  'long-form-video': 'video',
  'carousel': 'image',
  'image-post': 'image',
  'audio-clip': 'music',
};

const FORMAT_SUB_DEFAULTS: Record<string, Partial<StudioCommandState>> = {
  'single-post':      { textKind: 'caption' },
  'thread':           { textKind: 'thread' },
  'short-form-video': { videoAspect: '9:16', videoDurationMs: 10000, videoMode: 'prompt' },
  'long-form-video':  { videoAspect: '16:9', videoDurationMs: 15000, videoMode: 'prompt' },
  'carousel':         { imageAspect: '1:1' },
  'image-post':       { imageAspect: '1:1' },
  'audio-clip':       { musicStyle: 'cinematic' },
};

function parseDeepLinkBrief(searchParams: URLSearchParams): DeepLinkBrief {
  const rawPlatform = searchParams.get('platform');
  const platform = SOCIAL_PLATFORMS.includes(rawPlatform as SocialPlatform)
    ? (rawPlatform as SocialPlatform)
    : null;

  const rawFormat = searchParams.get('format') ?? 'single-post';
  const tool: StudioTool = FORMAT_TO_TOOL[rawFormat] ?? 'text';

  const hook  = searchParams.get('hook')  ?? '';
  const body  = searchParams.get('body')  ?? '';
  const brief = searchParams.get('brief') ?? '';
  const prompt = brief.trim() || [hook, body].filter(Boolean).join('\n\n');

  const command: Partial<StudioCommandState> = {
    ...FORMAT_SUB_DEFAULTS[rawFormat],
    ...(prompt ? { prompt } : {}),
  };

  const returnTo = searchParams.get('returnTo');

  return { platform, tool, command, returnTo };
}

// ============================================================================
// API response shapes (defensive — parallel agents may evolve them)
// ============================================================================

interface ImageGenerateResponse {
  success: boolean;
  url?: string;
  imageUrl?: string;
  mediaId?: string;
  error?: string;
}

interface VideoGenerateResponse {
  success: boolean;
  url?: string;
  videoUrl?: string;
  generationId?: string;
  mediaId?: string;
  error?: string;
}

interface MusicGenerateResponse {
  success: boolean;
  url?: string;
  audioUrl?: string;
  mediaId?: string;
  error?: string;
}

interface MediaCreateResponse {
  success: boolean;
  item?: { id: string };
  error?: string;
}

// ============================================================================
// Skeleton — shown while Suspense hydrates useSearchParams
// ============================================================================

function StudioPageSkeleton() {
  return (
    <div className="h-full flex flex-col items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading studio" />
    </div>
  );
}

// ============================================================================
// Inner page (client — reads search params and owns all state)
// ============================================================================

function StudioPageInner() {
  const { user } = useUnifiedAuth();
  const authFetch = useAuthFetch();
  const searchParams = useSearchParams();

  // Parse deep-link brief once on mount; memo is stable for the lifetime of
  // the page (searchParams doesn't change during a session).
  const deepLink = useMemo(
    () => parseDeepLinkBrief(searchParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // intentionally empty — parse only on initial mount
  );

  // Track whether the deep-link brief has been applied to slot state.
  // useRef avoids re-renders while still persisting across renders.
  const briefApplied = useRef<boolean>(false);

  const [activeTool, setActiveTool] = useState<StudioTool>(() => deepLink.tool);
  const [slots, setSlots] = useState<Record<StudioTool, ToolSlot>>(() => {
    const base = buildInitialSlots();
    // Apply the brief into the correct tool slot on first render.
    if (Object.keys(deepLink.command).length > 0) {
      briefApplied.current = true;
      const targetTool = deepLink.tool;
      base[targetTool] = {
        ...base[targetTool],
        command: { ...base[targetTool].command, ...deepLink.command },
      };
    }
    return base;
  });
  const [generatingTool, setGeneratingTool] = useState<StudioTool | null>(null);
  const [recentRefreshKey, setRecentRefreshKey] = useState(0);

  const slot = slots[activeTool];
  const isGenerating = generatingTool === activeTool;

  const { platform, returnTo } = deepLink;
  const platformLabel = platform ? PLATFORM_META[platform].label : 'dashboard';

  // ────────────────────────────────────────────────────────────────────────
  // Slot mutators
  // ────────────────────────────────────────────────────────────────────────

  const updateActiveSlot = useCallback(
    (patch: Partial<ToolSlot>) => {
      setSlots((prev) => ({
        ...prev,
        [activeTool]: { ...prev[activeTool], ...patch },
      }));
    },
    [activeTool],
  );

  const handleCommandChange = useCallback(
    (next: StudioCommandState) => {
      updateActiveSlot({ command: next });
    },
    [updateActiveSlot],
  );

  const handleClearResult = useCallback(() => {
    updateActiveSlot({ result: null, error: null });
  }, [updateActiveSlot]);

  // ────────────────────────────────────────────────────────────────────────
  // Portrait upload — convert to base64 data URI for the video engine
  // ────────────────────────────────────────────────────────────────────────

  const handlePortraitUpload = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = typeof reader.result === 'string' ? reader.result : null;
        if (url) {
          setSlots((prev) => ({
            ...prev,
            video: {
              ...prev.video,
              command: { ...prev.video.command, videoPortraitUrl: url },
            },
          }));
        }
      };
      reader.readAsDataURL(file);
    },
    [],
  );

  // ────────────────────────────────────────────────────────────────────────
  // Drop on canvas: switch a dragged image into the active tool's portrait
  // (only meaningful for video/avatar mode).
  // ────────────────────────────────────────────────────────────────────────

  const handleDropMediaUrl = useCallback(
    (url: string) => {
      if (activeTool === 'video') {
        setSlots((prev) => ({
          ...prev,
          video: {
            ...prev.video,
            command: {
              ...prev.video.command,
              videoMode: 'avatar',
              videoPortraitUrl: url,
            },
          },
        }));
      }
    },
    [activeTool],
  );

  // ────────────────────────────────────────────────────────────────────────
  // Recent click — restore a past generation as the current canvas result.
  // Switches to the tool that matches the asset type so the operator can
  // iterate from there.
  // ────────────────────────────────────────────────────────────────────────

  const handleSelectRecentItem = useCallback(
    (item: MediaItem) => {
      const targetTool = mediaTypeToTool(item.type);
      const promptFromMeta = item.metadata?.prompt ?? '';
      setSlots((prev) => ({
        ...prev,
        [targetTool]: {
          ...prev[targetTool],
          command: {
            ...prev[targetTool].command,
            prompt: promptFromMeta || prev[targetTool].command.prompt,
          },
          result: mediaItemToResult(item),
          error: null,
        },
      }));
      setActiveTool(targetTool);
    },
    [],
  );

  // ────────────────────────────────────────────────────────────────────────
  // Submit — dispatch to the right tool integration
  // ────────────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(() => {
    const command = slots[activeTool].command;
    if (!command.prompt.trim() || generatingTool) {
      return;
    }
    setGeneratingTool(activeTool);
    updateActiveSlot({ error: null });

    void (async () => {
      try {
        const result = await runGeneration(activeTool, command, authFetch);
        setSlots((prev) => ({
          ...prev,
          [activeTool]: { ...prev[activeTool], result, error: null },
        }));
        setRecentRefreshKey((n) => n + 1);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Generation failed';
        setSlots((prev) => ({
          ...prev,
          [activeTool]: { ...prev[activeTool], error: message },
        }));
      } finally {
        setGeneratingTool(null);
      }
    })();
  }, [activeTool, slots, generatingTool, authFetch, updateActiveSlot]);

  // ────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* Hub-shared subpage nav along the top */}
      <div className="px-6 pt-4 border-b border-border-light bg-card/30">
        <SubpageNav items={CONTENT_GENERATOR_TABS} />
      </div>

      {/* Header strip — page title sits above the workspace bands */}
      <header className="border-b border-border-light bg-card/30 px-6 py-4">
        {returnTo ? (
          <Link
            href={returnTo}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
          >
            <ChevronLeft className="h-3 w-3" aria-hidden="true" />
            Back to {platformLabel} dashboard
          </Link>
        ) : null}
        <PageTitle>Studio</PageTitle>
        <SectionDescription>
          Generate images, video, music, and text in a single canvas.
          {user?.displayName ? ` Signed in as ${user.displayName}.` : ''}
        </SectionDescription>
      </header>

      {/* Workspace: palette · canvas band · recent */}
      <div className="flex flex-1 min-h-0">
        <StudioToolPalette
          activeTool={activeTool}
          onToolChange={setActiveTool}
        />

        <section className="flex-1 flex flex-col min-w-0">
          <StudioCommandBar
            activeTool={activeTool}
            state={slot.command}
            onStateChange={handleCommandChange}
            onSubmit={handleSubmit}
            onClearResult={handleClearResult}
            isGenerating={isGenerating}
            hasResult={slot.result !== null}
            onPortraitUpload={handlePortraitUpload}
          />

          <StudioCanvas
            activeTool={activeTool}
            result={slot.result}
            isGenerating={isGenerating}
            error={slot.error}
            onDropMediaUrl={handleDropMediaUrl}
          />
        </section>

        <StudioRecentSidebar
          refreshKey={recentRefreshKey}
          onSelectItem={handleSelectRecentItem}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Page — Suspense wrapper required by Next 14 for useSearchParams
// ============================================================================

export default function StudioPage() {
  return (
    <Suspense fallback={<StudioPageSkeleton />}>
      <StudioPageInner />
    </Suspense>
  );
}

// ============================================================================
// Generation dispatch
// ============================================================================

type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

async function runGeneration(
  tool: StudioTool,
  command: StudioCommandState,
  authFetch: AuthFetch,
): Promise<StudioResult> {
  switch (tool) {
    case 'image':
      return runImageGeneration(command, authFetch);
    case 'video':
      return runVideoGeneration(command, authFetch);
    case 'music':
      return runMusicGeneration(command, authFetch);
    case 'text':
      return runTextGeneration(command);
  }
}

// ────────────────────────────────────────────────────────────────────────
// Image — calls /api/content/asset-generator/generate (built or pending).
// Endpoint contract: { prompt, aspectRatio } → { success, url|imageUrl }.
// ────────────────────────────────────────────────────────────────────────

async function runImageGeneration(
  command: StudioCommandState,
  authFetch: AuthFetch,
): Promise<StudioResult> {
  const response = await authFetch('/api/content/asset-generator/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: command.prompt,
      aspectRatio: command.imageAspect,
    }),
  });

  const data = (await safeJson(response)) as ImageGenerateResponse | null;
  if (!response.ok || !data?.success) {
    throw new Error(data?.error ?? `Image generation failed (${response.status})`);
  }

  const url = data.url ?? data.imageUrl;
  if (!url) {
    throw new Error('Image generation succeeded but returned no URL');
  }

  // Persist into media library if the route didn't already.
  const mediaId = data.mediaId
    ?? (await persistMedia(authFetch, {
      type: 'image',
      category: 'graphic',
      url,
      name: deriveName(command.prompt, 'image'),
      mimeType: inferImageMimeType(url),
      prompt: command.prompt,
    }));

  return { kind: 'image', url, prompt: command.prompt, mediaId };
}

// ────────────────────────────────────────────────────────────────────────
// Video — calls /api/content/video/generate.
// Two paths: prompt-only (Kling O3) and avatar (Character 3 + portrait).
// ────────────────────────────────────────────────────────────────────────

async function runVideoGeneration(
  command: StudioCommandState,
  authFetch: AuthFetch,
): Promise<StudioResult> {
  if (command.videoMode === 'avatar' && !command.videoPortraitUrl) {
    throw new Error('Upload a portrait image before generating an avatar video.');
  }

  const response = await authFetch('/api/content/video/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: command.videoMode,
      prompt: command.prompt,
      aspectRatio: command.videoAspect,
      durationMs: command.videoDurationMs,
      portraitUrl: command.videoPortraitUrl,
    }),
  });

  const data = (await safeJson(response)) as VideoGenerateResponse | null;
  if (!response.ok || !data?.success) {
    throw new Error(data?.error ?? `Video generation failed (${response.status})`);
  }

  const url = data.url ?? data.videoUrl ?? null;
  const generationId = data.generationId ?? null;

  // Persist into media library if there's a finished URL and route didn't.
  let mediaId = data.mediaId ?? null;
  if (url && !mediaId) {
    mediaId = await persistMedia(authFetch, {
      type: 'video',
      category: 'final',
      url,
      name: deriveName(command.prompt, 'video'),
      mimeType: 'video/mp4',
      prompt: command.prompt,
      durationMs: command.videoDurationMs,
    });
  }

  return {
    kind: 'video',
    url,
    prompt: command.prompt,
    mediaId,
    generationId,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Music — calls /api/content/music/generate (built by parallel agent B).
// ────────────────────────────────────────────────────────────────────────

async function runMusicGeneration(
  command: StudioCommandState,
  authFetch: AuthFetch,
): Promise<StudioResult> {
  const response = await authFetch('/api/content/music/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: command.prompt,
      durationSec: command.musicDurationSec,
      style: command.musicStyle,
    }),
  });

  const data = (await safeJson(response)) as MusicGenerateResponse | null;
  if (!response.ok || !data?.success) {
    throw new Error(data?.error ?? `Music generation failed (${response.status})`);
  }

  const url = data.url ?? data.audioUrl;
  if (!url) {
    throw new Error('Music generation succeeded but returned no URL');
  }

  const mediaId = data.mediaId
    ?? (await persistMedia(authFetch, {
      type: 'audio',
      category: 'music',
      url,
      name: deriveName(command.prompt, 'music'),
      mimeType: 'audio/mpeg',
      prompt: command.prompt,
      durationSec: command.musicDurationSec,
    }));

  return { kind: 'audio', url, prompt: command.prompt, mediaId };
}

// ────────────────────────────────────────────────────────────────────────
// Text — synchronous in-process placeholder.
// TODO: wire to a Copywriter route once the path is finalised. For now,
// echo the prompt so the canvas exercises the text result kind.
// ────────────────────────────────────────────────────────────────────────

async function runTextGeneration(command: StudioCommandState): Promise<StudioResult> {
  // No HTTP call yet — keep the contract uniform so the page wiring is correct
  // when the route lands.
  return Promise.resolve({
    kind: 'text',
    text: `[${command.textKind} draft]\n\n${command.prompt}`,
    prompt: command.prompt,
    mediaId: null,
  });
}

// ============================================================================
// Helpers
// ============================================================================

interface PersistMediaArgs {
  type: MediaType;
  category: MediaCategory;
  url: string;
  name: string;
  mimeType: string;
  prompt: string;
  durationMs?: number;
  durationSec?: number;
}

async function persistMedia(
  authFetch: AuthFetch,
  args: PersistMediaArgs,
): Promise<string | null> {
  try {
    const duration = args.durationSec
      ?? (typeof args.durationMs === 'number' ? args.durationMs / 1000 : undefined);

    const response = await authFetch('/api/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: args.type,
        category: args.category,
        name: args.name,
        url: args.url,
        mimeType: args.mimeType,
        fileSize: 0,
        duration,
        metadata: { prompt: args.prompt, source: 'studio' },
      }),
    });
    const data = (await safeJson(response)) as MediaCreateResponse | null;
    return data?.item?.id ?? null;
  } catch {
    // Non-fatal — the asset still rendered on the canvas. Recent will refresh
    // on next successful persist or page reload.
    return null;
  }
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function deriveName(prompt: string, kind: string): string {
  const trimmed = prompt.trim().replace(/\s+/g, ' ');
  const slice = trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
  return slice.length > 0 ? slice : `Studio ${kind}`;
}

function inferImageMimeType(url: string): string {
  if (url.startsWith('data:')) {
    const match = /^data:([^;]+);/.exec(url);
    return match?.[1] ?? 'image/png';
  }
  if (url.endsWith('.png')) {
    return 'image/png';
  }
  if (url.endsWith('.webp')) {
    return 'image/webp';
  }
  if (url.endsWith('.gif')) {
    return 'image/gif';
  }
  return 'image/jpeg';
}

function mediaTypeToTool(type: MediaType): StudioTool {
  switch (type) {
    case 'image':
      return 'image';
    case 'video':
      return 'video';
    case 'audio':
      return 'music';
  }
}

function mediaItemToResult(item: MediaItem): StudioResult {
  const prompt = item.metadata?.prompt ?? '';
  switch (item.type) {
    case 'image':
      return { kind: 'image', url: item.url, prompt, mediaId: item.id };
    case 'video':
      return {
        kind: 'video',
        url: item.url,
        prompt,
        mediaId: item.id,
        generationId: null,
      };
    case 'audio':
      return { kind: 'audio', url: item.url, prompt, mediaId: item.id };
  }
}
