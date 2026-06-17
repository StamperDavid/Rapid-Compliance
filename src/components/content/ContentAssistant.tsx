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
import { usePathname, useRouter } from 'next/navigation';
import {
  File as FileIcon,
  FileText,
  FileUp,
  FileVideo,
  FolderUp,
  LibraryBig,
  Loader2,
  MessageSquarePlus,
  Music,
  Paperclip,
  Send,
  Sparkles,
  X,
} from 'lucide-react';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { SectionTitle, SectionDescription, Caption } from '@/components/ui/typography';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import { requestStoryboardThumbnail, sceneHasDescription, matchSubjectForScene } from '@/lib/video/storyboard-thumbnail';
import {
  useContentAssistantChatStore,
  WELCOME,
  type ChatMessage,
} from '@/lib/stores/content-assistant-chat-store';
import { stripIntentBlock, type IntentSubject } from '@/lib/content/content-intent';
import { cn } from '@/lib/utils';
import type { CinematicConfig } from '@/types/creative-studio';
import type { PipelineScene, SceneReference } from '@/types/video-pipeline';
import { MediaLibraryPicker, type LibraryAsset } from './MediaLibraryPicker';

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
  /** Saved character bound to this scene by the build (per-scene avatar override). */
  avatarId?: string | null;
  avatarName?: string | null;
}

/** A file the operator attached in the composer (uploaded → permanent URL). */
interface Attachment {
  /** Local-only id so we can key chips and remove individual attachments. */
  id: string;
  url: string;
  fileName: string;
  contentType: string;
  kind: 'image' | 'video' | 'document' | 'other';
  /** Object URL for the local preview thumbnail (images only); revoked on remove/clear. */
  previewUrl?: string;
  /** True while the AI is reading the file (vision / transcript / text extraction). */
  analyzing?: boolean;
  /** The AI's read of the file's content (vision for images, transcript for A/V, text for docs). */
  aiSummary?: string;
  /** Media-library record id for this upload — target for the operator's name/description/use. */
  libraryAssetId?: string;
}

/** Coarse medium for picking the chip icon — derived from kind + MIME type. */
type AttachmentMedium = 'image' | 'video' | 'audio' | 'document' | 'other';

/**
 * Decide which medium icon a chip should show. The upload route only emits
 * 'image' | 'video' | 'document' | 'other', collapsing audio into 'other', so we
 * inspect the MIME type to recover audio and text/document files for a fitting icon.
 */
function attachmentMedium(att: Pick<Attachment, 'kind' | 'contentType'>): AttachmentMedium {
  if (att.kind === 'image') {
    return 'image';
  }
  if (att.kind === 'video') {
    return 'video';
  }
  const ct = (att.contentType || '').toLowerCase();
  if (ct.startsWith('audio/')) {
    return 'audio';
  }
  if (att.kind === 'document') {
    return 'document';
  }
  if (
    ct.startsWith('text/') ||
    ct.includes('pdf') ||
    ct.includes('word') ||
    ct.includes('msword') ||
    ct.includes('officedocument') ||
    ct.includes('presentation') ||
    ct.includes('spreadsheet') ||
    ct.includes('excel') ||
    ct.includes('powerpoint') ||
    ct.includes('csv')
  ) {
    return 'document';
  }
  return 'other';
}

/** Max files we accept from a single folder pick — protects the upload queue. */
const FOLDER_FILE_CAP = 30;

/**
 * Keep only real, uploadable files from a folder's flat FileList: drop dotfiles
 * (names starting with '.'), macOS resource forks (`__MACOSX`), and zero-byte
 * files. `webkitRelativePath` carries the in-folder path, so we test both the
 * file name and every path segment for the junk markers.
 */
function keepRealFolderFiles(files: FileList | File[]): File[] {
  return Array.from(files).filter((file) => {
    if (file.size === 0) {
      return false;
    }
    const relative = file.webkitRelativePath || file.name;
    const segments = relative.split('/');
    if (segments.some((seg) => seg.startsWith('.') || seg === '__MACOSX')) {
      return false;
    }
    return !file.name.startsWith('.');
  });
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
    // Saved character bound to this scene by the build (per-scene avatar override).
    avatarId: sb.avatarId ?? null,
    avatarName: sb.avatarName ?? null,
    voiceId: null,
    voiceProvider: null,
    duration: sb.duration ?? 5,
    engine: 'fal',
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

export function ContentAssistant() {
  const pathname = usePathname();
  const router = useRouter();
  const authFetch = useAuthFetch();

  // Conversation + panel-open persist across content-page nav and refresh
  // (content-assistant-chat-store, localStorage-backed). Everything else below
  // is transient session state.
  const open = useContentAssistantChatStore((s) => s.open);
  const setOpen = useContentAssistantChatStore((s) => s.setOpen);
  const messages = useContentAssistantChatStore((s) => s.messages);
  const setMessages = useContentAssistantChatStore((s) => s.setMessages);
  const resetChat = useContentAssistantChatStore((s) => s.resetChat);
  // Two-step arm for "New conversation" — it discards the current chat, so the
  // first click arms and the second confirms (auto-disarms after 4s).
  const [armNewChat, setArmNewChat] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  /** How many files are currently uploading (lets us show "Uploading N…"). */
  const [uploadingCount, setUploadingCount] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  // Labeling flow: after fresh uploads finish, the assistant asks the operator for
  // a name / description / intended use; until they answer, the next send is routed
  // to the label-apply endpoint instead of the creative flow.
  const [awaitingLabels, setAwaitingLabels] = useState(false);
  const pendingLabelRef = useRef<Array<{ id: string; fileName: string }>>([]);
  const freshUploadsRef = useRef<Array<{ id: string; fileName: string }>>([]);

  const threadRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  // Hover dropdown of attach options (files / folder / library) + the library picker.
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  // Map of attachment id → its live object URL so we can revoke each one exactly
  // once on remove/clear/send/unmount (no leaks).
  const previewUrlsRef = useRef<Map<string, string>>(new Map());
  // Map of attachment id → its in-flight "understand this file" analysis promise.
  // `send` awaits any still running so the server always gets the AI's read.
  const analysisPromisesRef = useRef<Map<string, Promise<void>>>(new Map());
  // Live mirror of the attachments array so `send` can read the freshest
  // aiSummaries after awaiting in-flight analyses (state updates are async).
  const attachmentsRef = useRef<Attachment[]>([]);

  const revokePreview = useCallback((id: string) => {
    const url = previewUrlsRef.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      previewUrlsRef.current.delete(id);
    }
  }, []);

  const revokeAllPreviews = useCallback(() => {
    for (const url of previewUrlsRef.current.values()) {
      URL.revokeObjectURL(url);
    }
    previewUrlsRef.current.clear();
  }, []);

  // Keep the live attachments mirror in sync for `send` to read post-await.
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  // Revoke every outstanding preview object URL when the component unmounts.
  useEffect(() => {
    return () => {
      revokeAllPreviews();
    };
  }, [revokeAllPreviews]);

  // The folder picker needs `webkitdirectory`/`directory`, which aren't typed on
  // React's input props — set them imperatively so the input selects a whole
  // folder while the regular file picker stays single/multi-file.
  useEffect(() => {
    const el = folderInputRef.current;
    if (el) {
      el.setAttribute('webkitdirectory', '');
      el.setAttribute('directory', '');
    }
  }, []);

  const removeAttachment = useCallback(
    (id: string) => {
      revokePreview(id);
      analysisPromisesRef.current.delete(id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    },
    [revokePreview],
  );

  const clearAttachments = useCallback(() => {
    revokeAllPreviews();
    analysisPromisesRef.current.clear();
    setAttachments([]);
  }, [revokeAllPreviews]);

  // Start a fresh conversation: wipe the chat back to the welcome and clear all
  // in-progress composer/labeling state. Two-step armed via `armNewChat`.
  const startNewConversation = useCallback(() => {
    resetChat();
    clearAttachments();
    pendingLabelRef.current = [];
    freshUploadsRef.current = [];
    setAwaitingLabels(false);
    setInput('');
    setError(null);
    setArmNewChat(false);
  }, [resetChat, clearAttachments]);

  // Auto-disarm the "New conversation" confirm if the operator doesn't follow through.
  useEffect(() => {
    if (!armNewChat) {
      return;
    }
    const t = setTimeout(() => { setArmNewChat(false); }, 4000);
    return () => { clearTimeout(t); };
  }, [armNewChat]);

  /**
   * Ask the AI to READ an uploaded file (vision for images, transcript for
   * audio/video, text for documents) and store its summary on the attachment.
   * Best-effort: a failure leaves the attachment usable, just without a summary.
   */
  const analyzeAttachment = useCallback(
    async (att: Pick<Attachment, 'id' | 'url' | 'contentType' | 'kind'>) => {
      setAttachments((prev) =>
        prev.map((a) => (a.id === att.id ? { ...a, analyzing: true } : a)),
      );
      try {
        const res = await authFetch('/api/settings/brand-identity/asset/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: att.url, contentType: att.contentType, kind: att.kind }),
        });
        const data = (await res.json()) as { success?: boolean; aiSummary?: string };
        const summary = res.ok && data.aiSummary ? data.aiSummary.trim() : '';
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === att.id
              ? { ...a, analyzing: false, ...(summary ? { aiSummary: summary } : {}) }
              : a,
          ),
        );
      } catch {
        // Understanding is best-effort — clear the spinner and move on.
        setAttachments((prev) =>
          prev.map((a) => (a.id === att.id ? { ...a, analyzing: false } : a)),
        );
      } finally {
        analysisPromisesRef.current.delete(att.id);
      }
    },
    [authFetch],
  );

  /** Upload ONE file and append it to the attachment list. Tolerates failure. */
  const uploadOne = useCallback(
    async (file: File) => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      // Show an instant local preview for images while the upload runs. Only
      // images get an object-URL preview — every other medium uses an icon chip.
      const localId = crypto.randomUUID();
      let previewUrl: string | undefined;
      if (isImage) {
        previewUrl = URL.createObjectURL(file);
        previewUrlsRef.current.set(localId, previewUrl);
      }

      setUploadingCount((n) => n + 1);
      try {
        const form = new FormData();
        form.append('file', file);
        // Accept any file the upload route allows — the route validates the type
        // and returns a 400 for anything it can't take, which we surface per file.
        const res = await authFetch('/api/settings/brand-identity/asset', {
          method: 'POST',
          body: form,
        });
        const data = (await res.json()) as {
          success: boolean;
          url?: string;
          fileName?: string;
          contentType?: string;
          kind?: Attachment['kind'];
          libraryAssetId?: string;
          error?: string;
        };
        if (!res.ok || !data.success || !data.url) {
          throw new Error(data.error ?? `"${file.name}" could not be uploaded.`);
        }
        const attachment: Attachment = {
          id: localId,
          url: data.url,
          fileName: data.fileName ?? file.name,
          contentType: data.contentType ?? file.type,
          kind: data.kind ?? (isVideo ? 'video' : isImage ? 'image' : 'other'),
          analyzing: true,
          ...(data.libraryAssetId ? { libraryAssetId: data.libraryAssetId } : {}),
          ...(previewUrl ? { previewUrl } : {}),
        };
        setAttachments((prev) => [...prev, attachment]);
        // Track this fresh upload so we can prompt for its name/description/use
        // once the whole batch finishes uploading.
        if (data.libraryAssetId) {
          freshUploadsRef.current.push({ id: data.libraryAssetId, fileName: attachment.fileName });
        }

        // Kick off the AI read of this file in the background. `send` awaits any
        // in-flight analysis so the server always has the understanding.
        const analysis = analyzeAttachment({
          id: attachment.id,
          url: attachment.url,
          contentType: attachment.contentType,
          kind: attachment.kind,
        });
        analysisPromisesRef.current.set(attachment.id, analysis);
        void analysis;
      } catch (err) {
        // One bad file must not blow away the others — just surface a brief error
        // and clean up this file's preview URL.
        revokePreview(localId);
        setError(err instanceof Error ? err.message : `"${file.name}" could not be uploaded.`);
      } finally {
        setUploadingCount((n) => n - 1);
      }
    },
    [authFetch, revokePreview, analyzeAttachment],
  );

  /** Attach assets the operator picked from the existing media library. */
  const addFromLibrary = useCallback(
    (picked: LibraryAsset[]) => {
      for (const asset of picked) {
        const id = crypto.randomUUID();
        const kind: Attachment['kind'] =
          asset.type === 'image' ? 'image'
            : asset.type === 'video' ? 'video'
              : asset.type === 'document' ? 'document'
                : 'other';
        const attachment: Attachment = {
          id,
          url: asset.url,
          fileName: asset.name,
          contentType: asset.mimeType,
          kind,
          analyzing: true,
          ...(asset.type === 'image' ? { previewUrl: asset.url } : {}),
        };
        setAttachments((prev) => [...prev, attachment]);
        // Have the agent read/understand it, exactly like an upload — but no
        // re-upload, since the asset is already stored in the library.
        const analysis = analyzeAttachment({ id, url: asset.url, contentType: asset.mimeType, kind });
        analysisPromisesRef.current.set(id, analysis);
        void analysis;
      }
    },
    [analyzeAttachment],
  );

  /** Apply the operator's typed answer (name / description / use) to pending uploads. */
  const submitLabels = useCallback(
    async (reply: string) => {
      const pending = pendingLabelRef.current;
      const text = reply.trim();
      if (pending.length === 0 || text.length === 0) {
        setAwaitingLabels(false);
        return;
      }
      pendingLabelRef.current = [];
      setMessages((prev) => [...prev, { role: 'user', content: text }]);
      setInput('');
      setLoading(true);
      try {
        const res = await authFetch('/api/content/assistant/label-uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assets: pending, reply: text }),
        });
        const data = (await res.json()) as {
          success?: boolean;
          project?: string;
          applied?: Array<{ name: string }>;
          error?: string;
        };
        if (res.ok && data.success) {
          const count = (data.applied ?? []).length;
          const content = data.project
            ? `Saved ${count} item${count === 1 ? '' : 's'} to your library under project "${data.project}". Search that project name anytime to pull them all back up.`
            : `Saved ${count} item${count === 1 ? '' : 's'} to your library.`;
          setMessages((prev) => [...prev, { role: 'assistant', content }]);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: `I couldn't save those: ${data.error ?? 'unknown error'}. Want to try again?` },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'I couldn\'t save those right now — try again in a moment.' },
        ]);
      } finally {
        setAwaitingLabels(false);
        clearAttachments();
        setLoading(false);
      }
    },
    [authFetch, clearAttachments, setMessages],
  );

  /** Upload every picked/dropped file concurrently, appending each result. */
  const uploadFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) {
        return;
      }
      setError(null);
      for (const file of list) {
        void uploadOne(file);
      }
    },
    [uploadOne],
  );

  const onFileSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Snapshot into a stable array BEFORE resetting the input. `e.target.files`
      // is a LIVE FileList — `value = ''` empties it, so reading length/items after
      // the reset returns nothing. (This is the bug that made attaching a silent
      // no-op: file picked, nothing uploaded, no chip, no error.)
      const list = Array.from(e.target.files ?? []);
      e.target.value = '';
      if (list.length > 0) {
        uploadFiles(list);
      }
    },
    [uploadFiles],
  );

  const onFolderSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Snapshot before reset — `value = ''` empties the live FileList (see onFileSelected).
      const picked = Array.from(e.target.files ?? []);
      e.target.value = '';
      if (picked.length === 0) {
        return;
      }
      setError(null);
      const kept = keepRealFolderFiles(picked);
      if (kept.length === 0) {
        setError('That folder had no uploadable files.');
        return;
      }
      let toUpload = kept;
      if (kept.length > FOLDER_FILE_CAP) {
        toUpload = kept.slice(0, FOLDER_FILE_CAP);
        setError(
          `Folder has ${kept.length} files — uploading the first ${FOLDER_FILE_CAP}.`,
        );
      }
      for (const file of toUpload) {
        void uploadOne(file);
      }
    },
    [uploadOne],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        uploadFiles(e.dataTransfer.files);
      }
    },
    [uploadFiles],
  );

  // Keep the thread scrolled to the newest message.
  useEffect(() => {
    if (open && threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

  const send = useCallback(async () => {
    // If we're waiting on the operator to label fresh uploads, this turn IS their
    // answer — route it to the label-apply step instead of the creative flow.
    if (awaitingLabels) {
      await submitLabels(input);
      return;
    }
    const text = input.trim();
    const sentAttachments = attachments;
    const uploading = uploadingCount > 0;
    if ((!text && sentAttachments.length === 0) || loading || uploading) {
      return;
    }

    // First explicit submit after fresh uploads WITH NO PROMPT → start the
    // library-labeling exchange (the operator is cataloguing). If they typed a
    // prompt alongside the uploads, that's a creative request that USES the
    // attachments as references — fall through to the normal flow, don't intercept.
    if (freshUploadsRef.current.length > 0 && text.length === 0) {
      const pending = freshUploadsRef.current.slice();
      freshUploadsRef.current = [];
      pendingLabelRef.current = pending;
      setAwaitingLabels(true);
      const count = pending.length;
      const firstName = (pending[0]?.fileName ?? 'your file').split(/[\\/]/).pop();
      const ask =
        count > 1
          ? `I've added ${count} files. To file them in your library so you can find them later, tell me three things — the project they belong to, a brief description of what they are, and what they're used for. I'll tag all ${count} with the project.`
          : `I've added "${firstName}". To file it in your library, tell me three things — the project it belongs to, a brief description, and what it's used for.`;
      setInput('');
      setMessages((prev) => [...prev, { role: 'assistant', content: ask }]);
      return;
    }

    // If there are attachments but no typed text, give the message a body so the
    // conversation history (which requires non-empty content) stays valid.
    const messageText =
      text.length > 0
        ? text
        : sentAttachments.length === 1
          ? `Here's a reference file (${sentAttachments[0].fileName}).`
          : `Here are ${sentAttachments.length} reference files.`;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: messageText }];
    setMessages(nextMessages);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      // Make sure the AI has finished reading every attached file before we send,
      // so the server gets each file's understanding (not just that it exists).
      // Don't block forever on a stuck analysis — whatever's ready is included.
      if (sentAttachments.length > 0) {
        const pending = sentAttachments
          .map((a) => analysisPromisesRef.current.get(a.id))
          .filter((p): p is Promise<void> => p !== undefined);
        if (pending.length > 0) {
          await Promise.allSettled(pending);
        }
      }

      // Read the freshest summaries (the awaited analyses updated state → mirror).
      const summaryById = new Map(attachmentsRef.current.map((a) => [a.id, a.aiSummary]));
      const outboundAttachments = sentAttachments.map((a) => {
        const aiSummary = summaryById.get(a.id) ?? a.aiSummary;
        return {
          url: a.url,
          fileName: a.fileName,
          contentType: a.contentType,
          kind: a.kind,
          ...(aiSummary ? { aiSummary } : {}),
        };
      });

      // Attachments now PERSIST across the propose/refine turns (they're the build's
      // references and must still be present on the approval turn). They're cleared
      // only once a build actually fires — see the post-response clear below.

      // Drop the canned welcome before sending — it isn't real conversation.
      // Match by content, not reference: after a persisted reload the welcome is
      // a deserialized copy, so `!== WELCOME` would no longer catch it.
      const history = nextMessages.filter(
        (m) => !(m.role === WELCOME.role && m.content === WELCOME.content),
      );

      const res = await authFetch('/api/content/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          activeTab: pathname,
          ...(outboundAttachments.length > 0 ? { attachments: outboundAttachments } : {}),
        }),
      });

      const data = (await res.json()) as {
        success: boolean;
        reply?: string;
        storyboards?: AssistantStoryboard[];
        subjects?: IntentSubject[];
        targetSceneNumber?: number;
        imageRequests?: Array<{ name: string; prompt: string; fidelity: string; referenceImageUrl?: string }>;
        musicRequests?: Array<{ prompt: string; genre?: string; durationSeconds?: number; name?: string }>;
        mediaLibraryUpdated?: boolean;
        error?: string;
      };

      if (!res.ok || !data.success || !data.reply) {
        throw new Error(data.error ?? 'The assistant could not respond.');
      }

      // Image generation: the server returned a list of images to create. Generate each
      // (the asset-generator endpoint saves every result to the media library), then post
      // a completion message. We hand the operator to the Library where the images appear.
      const imageRequests = data.imageRequests ?? [];
      if (imageRequests.length > 0) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply as string }]);
        clearAttachments();
        setLoading(false);
        void (async () => {
          let made = 0;
          // Run them in PARALLEL — one stuck/slow generation must not block the rest.
          // Each has its own timeout so a hung generation call can't hang the batch forever.
          await Promise.allSettled(
            imageRequests.map(async (req) => {
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), 150000);
              try {
                const gen = await authFetch('/api/content/asset-generator/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  signal: controller.signal,
                  body: JSON.stringify({
                    prompt: req.prompt,
                    aspectRatio: '2:3',
                    ...(req.referenceImageUrl ? { referenceImageUrl: req.referenceImageUrl } : {}),
                    name: req.name,
                  }),
                });
                if (gen.ok) {
                  made += 1;
                  setMessages((prev) => [
                    ...prev,
                    { role: 'assistant', content: `✓ Image ${made}/${imageRequests.length} done — "${req.name}".` },
                  ]);
                  // Tell the Library (if open) to refresh so the new image shows live.
                  window.dispatchEvent(new Event('media-library-updated'));
                }
              } catch {
                /* timeout or failure on this one — the others continue */
              } finally {
                clearTimeout(timer);
              }
            }),
          );
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `Done — created ${made} of ${imageRequests.length} image${imageRequests.length === 1 ? '' : 's'}. They're saved in your Library (open/refresh the Library to see them).`,
            },
          ]);
        })();
        return;
      }

      // Music generation: the server returned music request(s). Generate each via the
      // proven /api/content/music/generate endpoint (which saves to the media library),
      // then post a completion message. Mirrors the image flow.
      const musicRequests = data.musicRequests ?? [];
      if (musicRequests.length > 0) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply as string }]);
        clearAttachments();
        setLoading(false);
        void (async () => {
          let made = 0;
          await Promise.allSettled(
            musicRequests.map(async (req) => {
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), 180000);
              try {
                const gen = await authFetch('/api/content/music/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  signal: controller.signal,
                  body: JSON.stringify({
                    prompt: req.prompt,
                    ...(req.genre ? { genre: req.genre } : {}),
                    ...(req.durationSeconds ? { durationSeconds: req.durationSeconds } : {}),
                    ...(req.name ? { name: req.name } : {}),
                  }),
                });
                if (gen.ok) {
                  made += 1;
                  // Tell the Library / Audio Lab (if open) to refresh so the track shows live.
                  window.dispatchEvent(new Event('media-library-updated'));
                }
              } catch {
                /* timeout or failure on this one — the others continue */
              } finally {
                clearTimeout(timer);
              }
            }),
          );
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content:
                made > 0
                  ? `Done — your track${musicRequests.length === 1 ? ' is' : 's are'} saved in your Audio Lab and Library (open/refresh to hear ${musicRequests.length === 1 ? 'it' : 'them'}).`
                  : `I couldn't finish composing that — try again, or use the music studio in the Audio Lab directly.`,
            },
          ]);
        })();
        return;
      }

      // If the director built storyboards and we're on the Video tab, drop them
      // straight onto the canvas for the operator to review, tweak, and approve.
      const storyboards = data.storyboards ?? [];
      // The CONFIRMED intent subjects (name → references → fidelity) drive which
      // reference each scene is built from and how faithfully (exact / inspired / new).
      const subjects = data.subjects ?? [];
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
          avatarId: sb.avatarId ?? null,
          avatarName: sb.avatarName ?? null,
          voiceId: null,
          voiceProvider: null,
          duration: sb.duration ?? 5,
          engine: 'fal',
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
          const allScenes = useVideoPipelineStore.getState().scenes;
          const scene = allScenes.find((s) => s.id === targetId);
          if (scene && sceneHasDescription(scene)) {
            const { refUrl, fidelity } = matchSubjectForScene(scene, subjects, allScenes[0]?.references ?? []);
            const result = await requestStoryboardThumbnail(authFetch, scene, aspectRatio, refUrl, fidelity);
            if ('url' in result) {
              useVideoPipelineStore.getState().updateScene(targetId, { screenshotUrl: result.url });
            }
          }
        })();
      }

      // Fresh-build path: a full multi-scene storyboard (no rework target). REPLACE
      // the entire scenes array so the first storyboard IS scene 1 — appending onto
      // the default empty "Storyboard 1" left scene 1 blank (no preview, never ready).
      const applied = !reworked && storyboards.length > 0;
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
          // The operator's uploaded reference images are seeded onto scene 1 — use
          // them as the pool so each scene is generated FROM the matching character.
          const referencePool = newScenes[0]?.references ?? [];
          for (const id of createdIds) {
            const scene = useVideoPipelineStore.getState().scenes.find((s) => s.id === id);
            if (scene && sceneHasDescription(scene)) {
              const { refUrl, fidelity } = matchSubjectForScene(scene, subjects, referencePool);
              const result = await requestStoryboardThumbnail(authFetch, scene, aspectRatio, refUrl, fidelity);
              if ('url' in result) {
                useVideoPipelineStore.getState().updateScene(id, { screenshotUrl: result.url });
              }
            }
          }
        })();
      }

      // Built from a non-video content page (e.g. the Library) — the storyboards
      // were applied to the (persisted) pipeline store above, so take the operator
      // to the video canvas to review them. The chat panel persists across the nav.
      if (applied && !onVideoTab) {
        router.push('/content/video');
      }

      // A build fired (storyboards came back) — the references did their job, so clear
      // the composer now. Until a build, attachments persist across propose/refine turns.
      if (storyboards.length > 0) {
        clearAttachments();
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

      // Live-refresh the Library / Audio Lab when the route saved an asset inline
      // (e.g. a chat background-removal or image edit) with no imageRequests batch.
      if (data.mediaLibraryUpdated) {
        window.dispatchEvent(new Event('media-library-updated'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [input, loading, uploadingCount, attachments, clearAttachments, messages, authFetch, pathname, awaitingLabels, submitLabels, router, setMessages]);

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
          aria-label="Open the Content Manager chat"
        >
          <Sparkles className="h-4 w-4" />
          Content Manager
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
        aria-label="Content Manager chat"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <SectionTitle className="text-base">Content Manager</SectionTitle>
              <SectionDescription className="text-xs">
                Your creative director — let&apos;s shape what you want to make.
              </SectionDescription>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant={armNewChat ? 'default' : 'ghost'}
              size={armNewChat ? 'sm' : 'icon'}
              onClick={() => (armNewChat ? startNewConversation() : setArmNewChat(true))}
              aria-label={armNewChat ? 'Confirm: start a new conversation' : 'Start a new conversation'}
              title={armNewChat ? 'Click again to start fresh' : 'New conversation'}
              className={armNewChat ? 'h-8 gap-1.5 px-2.5 text-xs' : 'h-8 w-8'}
            >
              <MessageSquarePlus className="h-4 w-4" />
              {armNewChat && 'Start new?'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label="Close the Content Manager chat"
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
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
                {m.role === 'assistant' ? stripIntentBlock(m.content) : m.content}
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
          {/* Attachment chips — one per attached file; image → thumbnail, video → icon tile. */}
          {(attachments.length > 0 || uploadingCount > 0) && (
            <div className="mb-2 max-h-40 space-y-1.5 overflow-y-auto pr-1">
              {attachments.map((att) => {
                const medium = attachmentMedium(att);
                return (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-2 py-1.5"
                  >
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-background">
                      {medium === 'image' && att.previewUrl ? (
                        <Image
                          src={att.previewUrl}
                          alt={att.fileName}
                          fill
                          sizes="40px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : medium === 'video' ? (
                        <FileVideo className="h-4 w-4 text-muted-foreground" />
                      ) : medium === 'audio' ? (
                        <Music className="h-4 w-4 text-muted-foreground" />
                      ) : medium === 'document' ? (
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-xs text-foreground">{att.fileName}</span>
                      {att.analyzing ? (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Understanding…
                        </span>
                      ) : att.aiSummary ? (
                        <span
                          className="truncate text-[11px] text-muted-foreground"
                          title={att.aiSummary}
                        >
                          ✓ Understood
                        </span>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAttachment(att.id)}
                      aria-label={`Remove ${att.fileName}`}
                      className="h-7 w-7 shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
              {uploadingCount > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    Uploading {uploadingCount} file{uploadingCount > 1 ? 's' : ''}…
                  </span>
                </div>
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
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,application/pdf"
              multiple
              className="hidden"
              onChange={onFileSelected}
            />
            {/* Folder picker — `webkitdirectory`/`directory` set imperatively above. */}
            <input
              ref={folderInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={onFolderSelected}
            />
            <div
              className="relative shrink-0"
              onMouseEnter={() => setAttachMenuOpen(true)}
              onMouseLeave={() => setAttachMenuOpen(false)}
            >
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setAttachMenuOpen((o) => !o)}
                disabled={loading}
                aria-label="Add reference materials"
                title="Add reference materials"
                className="h-10 w-10"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              {attachMenuOpen && (
                <div className="absolute bottom-full left-0 z-20 pb-2">
                  <div className="w-52 rounded-xl border border-border-strong bg-card p-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => { setAttachMenuOpen(false); fileInputRef.current?.click(); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-surface-elevated"
                  >
                    <FileUp className="h-4 w-4 shrink-0" /> Upload files
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAttachMenuOpen(false); folderInputRef.current?.click(); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-surface-elevated"
                  >
                    <FolderUp className="h-4 w-4 shrink-0" /> Upload a folder
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAttachMenuOpen(false); setLibraryOpen(true); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-surface-elevated"
                  >
                    <LibraryBig className="h-4 w-4 shrink-0" /> Search library
                  </button>
                  </div>
                </div>
              )}
            </div>
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
              disabled={
                loading || uploadingCount > 0 || (input.trim().length === 0 && attachments.length === 0)
              }
              aria-label="Send message"
              className="h-10 w-10 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <Caption className="mt-2 flex items-center gap-1.5">
            <MessageSquarePlus className="h-3 w-3" />
            Attach anything — photos, clips, audio, PDFs or docs — and I&apos;ll read each one and build around it.
          </Caption>
        </div>
      </div>
      <MediaLibraryPicker
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        onSelect={addFromLibrary}
        authFetch={authFetch}
      />
    </>
  );
}

export default ContentAssistant;
