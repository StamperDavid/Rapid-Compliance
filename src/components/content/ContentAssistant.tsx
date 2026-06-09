'use client';

/**
 * Content Assistant — slide-in conversational panel for the content studio.
 *
 * A content-scoped creative director (NOT the global Jasper assistant). It lives
 * on every content-generator tab and talks the operator through what they want
 * to create — image, video, music, or text — proposing ideas and asking the
 * clarifying questions a client wouldn't think of, in the tenant's brand voice.
 *
 * v1 is conversation only. It POSTs the running message history + the current
 * tab to /api/content/assistant and appends the reply. Structured-field filling
 * and tool hand-off come in later increments.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ImageIcon, MessageSquarePlus, Paperclip, Send, Sparkles, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SectionTitle, SectionDescription, Caption } from '@/components/ui/typography';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import { requestStoryboardThumbnail, sceneHasDescription } from '@/lib/video/storyboard-thumbnail';
import { cn } from '@/lib/utils';
import type { CinematicConfig } from '@/types/creative-studio';
import type { PipelineScene, SceneReference } from '@/types/video-pipeline';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Storyboard the assistant built, applied to the Video tab's pipeline store. */
interface AssistantStoryboard {
  title?: string;
  visualDescription?: string;
  scriptText?: string;
  duration?: number;
  location?: string;
  timeOfDay?: string;
  weather?: string;
  ambience?: string;
  musicCue?: string;
  wardrobe?: string;
  backgroundPrompt?: string;
  cinematicConfig?: CinematicConfig;
  references?: SceneReference[];
}

/** An image the operator attached in the composer (uploaded → permanent URL). */
interface AttachedImage {
  url: string;
  fileName: string;
  /** Object URL for the local preview thumbnail; revoked on remove/replace. */
  previewUrl: string;
}

function isVideoStoryboardTab(pathname: string | null): boolean {
  const p = (pathname ?? '').toLowerCase();
  return p.includes('/content/video') && !p.includes('/editor') && !p.includes('/library');
}

/**
 * Map an assistant-built storyboard onto a pipeline scene (without an id — the
 * store assigns one). Used for a fresh full build that REPLACES the scenes array.
 */
function storyboardToScene(sb: AssistantStoryboard, sceneNumber: number): Omit<PipelineScene, 'id'> {
  return {
    sceneNumber,
    title: sb.title ?? '',
    scriptText: sb.scriptText ?? '',
    visualDescription: sb.visualDescription ?? '',
    screenshotUrl: null,
    avatarId: null,
    avatarName: null,
    voiceId: null,
    voiceProvider: null,
    duration: sb.duration ?? 5,
    engine: 'hedra',
    backgroundPrompt: sb.backgroundPrompt ?? null,
    cinematicConfig: sb.cinematicConfig,
    location: sb.location,
    timeOfDay: sb.timeOfDay,
    weather: sb.weather,
    ambience: sb.ambience,
    musicCue: sb.musicCue,
    wardrobe: sb.wardrobe,
    ...(sb.references ? { references: sb.references } : {}),
    status: 'draft',
  };
}

const WELCOME: ChatMessage = {
  role: 'assistant',
  content:
    "Hey — I'm your creative director. Tell me what you're trying to make and I'll help you shape it. Even a rough idea works: who's it for, where will it live, what feeling should it leave behind?",
};

export function ContentAssistant() {
  const pathname = usePathname();
  const authFetch = useAuthFetch();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<AttachedImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const threadRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Track the live object URL so we always revoke the previous one on replace/remove.
  const previewUrlRef = useRef<string | null>(null);

  // Revoke any outstanding preview object URL when the component unmounts.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const clearAttachment = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setAttachment(null);
  }, []);

  const uploadImage = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setError('Please attach an image file.');
        return;
      }
      setError(null);
      setUploading(true);

      // Show an instant local preview while the upload runs.
      const previewUrl = URL.createObjectURL(file);
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      previewUrlRef.current = previewUrl;

      try {
        const form = new FormData();
        form.append('file', file);
        const res = await authFetch('/api/settings/brand-identity/asset', {
          method: 'POST',
          body: form,
        });
        const data = (await res.json()) as {
          success: boolean;
          url?: string;
          fileName?: string;
          error?: string;
        };
        if (!res.ok || !data.success || !data.url) {
          throw new Error(data.error ?? 'The image could not be uploaded.');
        }
        setAttachment({ url: data.url, fileName: data.fileName ?? file.name, previewUrl });
      } catch (err) {
        if (previewUrlRef.current === previewUrl) {
          URL.revokeObjectURL(previewUrl);
          previewUrlRef.current = null;
        }
        setError(err instanceof Error ? err.message : 'The image could not be uploaded.');
      } finally {
        setUploading(false);
      }
    },
    [authFetch],
  );

  const onFileSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Reset the input so selecting the same file again still fires onChange.
      e.target.value = '';
      if (file) {
        void uploadImage(file);
      }
    },
    [uploadImage],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
        void uploadImage(file);
      }
    },
    [uploadImage],
  );

  // Keep the thread scrolled to the newest message.
  useEffect(() => {
    if (open && threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

  const send = useCallback(async () => {
    const text = input.trim();
    const sentAttachment = attachment;
    if ((!text && !sentAttachment) || loading || uploading) {
      return;
    }

    // If there's an attachment but no typed text, give the message a body so the
    // conversation history (which requires non-empty content) stays valid.
    const messageText =
      text.length > 0 ? text : `Here's a reference image (${sentAttachment?.fileName ?? 'photo'}).`;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: messageText }];
    setMessages(nextMessages);
    setInput('');
    clearAttachment();
    setError(null);
    setLoading(true);

    try {
      // Drop the canned welcome before sending — it isn't real conversation.
      const history = nextMessages.filter((m) => m !== WELCOME);

      const res = await authFetch('/api/content/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          activeTab: pathname,
          ...(sentAttachment
            ? { referenceImage: { url: sentAttachment.url, fileName: sentAttachment.fileName } }
            : {}),
        }),
      });

      const data = (await res.json()) as {
        success: boolean;
        reply?: string;
        storyboards?: AssistantStoryboard[];
        targetSceneNumber?: number;
        error?: string;
      };

      if (!res.ok || !data.success || !data.reply) {
        throw new Error(data.error ?? 'The assistant could not respond.');
      }

      // If the director built storyboards and we're on the Video tab, drop them
      // straight onto the canvas for the operator to review, tweak, and approve.
      const storyboards = data.storyboards ?? [];
      const onVideoTab = isVideoStoryboardTab(pathname);

      // Rework path: the operator asked to rebuild ONE existing storyboard. Replace
      // that scene in place (keep its position/number) instead of appending a new one.
      const targetIdx =
        data.targetSceneNumber !== undefined ? data.targetSceneNumber - 1 : -1;
      const reworkTarget =
        onVideoTab && storyboards.length >= 1 && targetIdx >= 0
          ? useVideoPipelineStore.getState().scenes[targetIdx]
          : undefined;
      const reworked = reworkTarget !== undefined;

      if (reworked && reworkTarget) {
        const sb = storyboards[0];
        const targetId = reworkTarget.id;
        useVideoPipelineStore.getState().updateScene(targetId, {
          // Keep the scene's existing sceneNumber — do NOT overwrite its position.
          title: sb.title ?? '',
          scriptText: sb.scriptText ?? '',
          visualDescription: sb.visualDescription ?? '',
          screenshotUrl: null,
          avatarId: null,
          avatarName: null,
          voiceId: null,
          voiceProvider: null,
          duration: sb.duration ?? 5,
          engine: 'hedra',
          backgroundPrompt: sb.backgroundPrompt ?? null,
          cinematicConfig: sb.cinematicConfig,
          location: sb.location,
          timeOfDay: sb.timeOfDay,
          weather: sb.weather,
          ambience: sb.ambience,
          musicCue: sb.musicCue,
          wardrobe: sb.wardrobe,
          status: 'draft',
        });

        // Regenerate the reworked scene's thumbnail in the background.
        void (async () => {
          const aspectRatio = useVideoPipelineStore.getState().brief.aspectRatio;
          const scene = useVideoPipelineStore.getState().scenes.find((s) => s.id === targetId);
          if (scene && sceneHasDescription(scene)) {
            const result = await requestStoryboardThumbnail(authFetch, scene, aspectRatio);
            if ('url' in result) {
              useVideoPipelineStore.getState().updateScene(targetId, { screenshotUrl: result.url });
            }
          }
        })();
      }

      // Fresh-build path: a full multi-scene storyboard (no rework target). REPLACE
      // the entire scenes array so the first storyboard IS scene 1 — appending onto
      // the default empty "Storyboard 1" left scene 1 blank (no preview, never ready).
      const applied = !reworked && storyboards.length > 0 && onVideoTab;
      if (applied) {
        const newScenes: PipelineScene[] = storyboards.map((sb, idx) => ({
          ...storyboardToScene(sb, idx + 1),
          id: crypto.randomUUID(),
        }));
        useVideoPipelineStore.getState().setScenes(newScenes);
        const createdIds = newScenes.map((s) => s.id);

        // Auto-generate EVERY scene's thumbnail in the background (including scene 1)
        // so the previews appear right after creation (same as the manual flow).
        void (async () => {
          const aspectRatio = useVideoPipelineStore.getState().brief.aspectRatio;
          for (const id of createdIds) {
            const scene = useVideoPipelineStore.getState().scenes.find((s) => s.id === id);
            if (scene && sceneHasDescription(scene)) {
              const result = await requestStoryboardThumbnail(authFetch, scene, aspectRatio);
              if ('url' in result) {
                useVideoPipelineStore.getState().updateScene(id, { screenshotUrl: result.url });
              }
            }
          }
        })();
      }

      setMessages((prev) => {
        const next: ChatMessage[] = [...prev, { role: 'assistant', content: data.reply as string }];
        if (reworked) {
          next.push({
            role: 'assistant',
            content: `✓ Reworked storyboard ${data.targetSceneNumber} — review the updated fields.`,
          });
        } else if (applied) {
          next.push({
            role: 'assistant',
            content: `✓ Added ${storyboards.length} storyboard${storyboards.length > 1 ? 's' : ''} to your strip — review the fields, cast your character, and mark each ready.`,
          });
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [input, loading, uploading, attachment, clearAttachment, messages, authFetch, pathname]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void send();
      }
    },
    [send],
  );

  return (
    <>
      {/* Floating toggle — bottom-right of the content area, offset from Jasper's
          global bubble so the two never overlap. */}
      {!open && (
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-24 z-40 h-12 gap-2 rounded-full shadow-lg"
          aria-label="Open the Content Assistant"
        >
          <Sparkles className="h-4 w-4" />
          Content Assistant
        </Button>
      )}

      {/* Slide-in panel */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'pointer-events-none translate-x-full',
        )}
        aria-hidden={!open}
        role="complementary"
        aria-label="Content Assistant"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <SectionTitle className="text-base">Content Assistant</SectionTitle>
              <SectionDescription className="text-xs">
                Your creative director — let&apos;s shape what you want to make.
              </SectionDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            aria-label="Close the Content Assistant"
            className="h-8 w-8 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Thread */}
        <div ref={threadRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-surface-elevated text-foreground',
                )}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-surface-elevated px-4 py-2.5 text-sm text-muted-foreground">
                Thinking&hellip;
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border px-5 py-4">
          {/* Attachment chip — shown above the input once an image is attached/uploading. */}
          {(attachment !== null || uploading) && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-2 py-1.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-background">
                {attachment ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local object-URL preview, not a remote asset
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.fileName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <span className="flex-1 truncate text-xs text-foreground">
                {uploading ? 'Uploading image…' : attachment?.fileName}
              </span>
              {attachment && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={clearAttachment}
                  aria-label="Remove attached image"
                  className="h-7 w-7 shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}

          <div
            className={cn(
              'flex items-end gap-2 rounded-xl',
              dragActive && 'ring-2 ring-ring ring-offset-2 ring-offset-card',
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileSelected}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || uploading}
              aria-label="Attach an image"
              className="h-10 w-10 shrink-0"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder="Describe what you want to create…"
              disabled={loading}
              className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
            <Button
              type="button"
              size="icon"
              onClick={() => void send()}
              disabled={loading || uploading || (input.trim().length === 0 && !attachment)}
              aria-label="Send message"
              className="h-10 w-10 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <Caption className="mt-2 flex items-center gap-1.5">
            <MessageSquarePlus className="h-3 w-3" />
            On the Video tab I can build your storyboards — attach a photo to build around it.
          </Caption>
        </div>
      </div>
    </>
  );
}

export default ContentAssistant;
