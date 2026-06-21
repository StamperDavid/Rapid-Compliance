'use client';

/**
 * Character Studio → Character Library — create / edit form.
 *
 * Wraps the existing AvatarProfile data model (src/lib/video/avatar-profile-service.ts):
 *   - name + description (the character's DNA prompt)
 *   - role + styleTag selects
 *   - face anchor upload (required) → frontalImageUrl
 *   - unlimited additional/body reference images → additionalImageUrls
 *   - optional full-body + upper-body references
 *   - voice assignment from the existing /api/video/voices roster
 *   - favorite + default toggles
 *
 * Image persistence reuses the SAME upload route the Media Library uses:
 * POST /api/media (multipart) → { asset: { url } }. No new upload route invented.
 *
 *   - "Looks" (alter egos): SAME face/identity, different outfit/state, each
 *     with its own reference set (images, video, audio) → looks[]
 *
 * Saving:
 *   - create → POST /api/video/avatar-profiles
 *   - edit   → PATCH /api/video/avatar-profiles/[profileId]
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Caption, CardTitle, SectionDescription } from '@/components/ui/typography';
import { MediaLibraryPicker, type LibraryAsset } from '@/components/content/MediaLibraryPicker';
import { CloneVoiceStudio } from '@/app/(dashboard)/content/voice-lab/components/clone-voice-studio/CloneVoiceStudio';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Loader2,
  Upload,
  X,
  Star,
  UserSquare2,
  Plus,
  Shirt,
  Film,
  Music,
  Trash2,
} from 'lucide-react';
import type {
  AvatarProfile,
  CharacterLook,
  CharacterRole,
  CharacterStyleTag,
} from '@/lib/video/avatar-profile-service';

// ============================================================================
// Constants
// ============================================================================

const ROLE_OPTIONS: Array<{ value: CharacterRole; label: string }> = [
  { value: 'presenter', label: 'Presenter' },
  { value: 'narrator', label: 'Narrator' },
  { value: 'hero', label: 'Hero' },
  { value: 'villain', label: 'Villain' },
  { value: 'extra', label: 'Extra' },
  { value: 'custom', label: 'Custom' },
];

const STYLE_OPTIONS: Array<{ value: CharacterStyleTag; label: string }> = [
  { value: 'real', label: 'Realistic' },
  { value: 'anime', label: 'Anime' },
  { value: 'stylized', label: 'Stylized' },
];

// Reference angles are unlimited — no per-character cap on additional images.

const VOICE_PROVIDERS = ['elevenlabs', 'unrealspeech', 'custom'] as const;
type VoiceProvider = (typeof VOICE_PROVIDERS)[number];

// ============================================================================
// Types
// ============================================================================

/** A voice from GET /api/video/voices. */
interface VoiceOption {
  id: string;
  name: string;
  language: string;
  accent?: string;
  gender?: 'male' | 'female' | 'neutral';
  provider?: VoiceProvider;
}

interface VoicesApiResponse {
  success: boolean;
  voices?: VoiceOption[];
}

/** The media upload response from POST /api/media. */
interface MediaUploadResponse {
  success: boolean;
  asset?: { id: string; url: string };
  error?: string;
}

/** What Save emits to the API. Matches the create/update Zod schemas. */
interface CharacterFormPayload {
  name: string;
  description: string | null;
  role: CharacterRole;
  styleTag: CharacterStyleTag;
  frontalImageUrl: string;
  additionalImageUrls: string[];
  fullBodyImageUrl: string | null;
  upperBodyImageUrl: string | null;
  looks: CharacterLook[];
  voiceId: string | null;
  voiceName: string | null;
  voiceProvider: VoiceProvider | null;
  isDefault: boolean;
  isFavorite: boolean;
}

interface CharacterFormProps {
  /** Existing profile to edit, or null to create a new one. */
  profile: AvatarProfile | null;
  open: boolean;
  onClose: () => void;
  /** Called on a successful save; receives the saved profile (when the API returns it)
   *  so a caller like the Shot Doc can add the new character straight to the cast. */
  onSaved: (profile?: AvatarProfile) => void;
}

// ============================================================================
// Image upload helper
// ============================================================================

function isVoiceProvider(value: string | null | undefined): value is VoiceProvider {
  return value != null && (VOICE_PROVIDERS as readonly string[]).includes(value);
}

// ============================================================================
// Component
// ============================================================================

export default function CharacterForm({
  profile,
  open,
  onClose,
  onSaved,
}: CharacterFormProps) {
  const authFetch = useAuthFetch();
  const isEdit = profile !== null;

  // ── Form fields ───────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [role, setRole] = useState<CharacterRole>('presenter');
  const [styleTag, setStyleTag] = useState<CharacterStyleTag>('real');
  const [frontalImageUrl, setFrontalImageUrl] = useState('');
  const [additionalImageUrls, setAdditionalImageUrls] = useState<string[]>([]);
  const [fullBodyImageUrl, setFullBodyImageUrl] = useState<string | null>(null);
  const [upperBodyImageUrl, setUpperBodyImageUrl] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider | null>(null);
  const [looks, setLooks] = useState<CharacterLook[]>([]);
  const [isDefault, setIsDefault] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  // ── Voices ────────────────────────────────────────────────────────────────
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  // Clone Voice Studio (record a custom voice for this character) — edit mode only.
  const [voiceStudioOpen, setVoiceStudioOpen] = useState(false);

  // ── Upload + save state ─────────────────────────────────────────────────────
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  // Which image slot the "from library" picker should fill (null = closed).
  const [libraryTarget, setLibraryTarget] = useState<
    null | 'frontal' | 'additional' | 'fullBody' | 'upperBody'
  >(null);
  // True while a library image is being MOVED onto a saved character.
  const [movingFromLibrary, setMovingFromLibrary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const frontalInputRef = useRef<HTMLInputElement>(null);
  const additionalInputRef = useRef<HTMLInputElement>(null);
  const fullBodyInputRef = useRef<HTMLInputElement>(null);
  const upperBodyInputRef = useRef<HTMLInputElement>(null);

  // Reset the form whenever it opens (or the target profile changes).
  useEffect(() => {
    if (!open) {
      return;
    }
    setName(profile?.name ?? '');
    setDescription(profile?.description ?? '');
    setRole(profile?.role ?? 'presenter');
    setStyleTag(profile?.styleTag ?? 'real');
    setFrontalImageUrl(profile?.frontalImageUrl ?? '');
    setAdditionalImageUrls(profile?.additionalImageUrls ?? []);
    setFullBodyImageUrl(profile?.fullBodyImageUrl ?? null);
    setUpperBodyImageUrl(profile?.upperBodyImageUrl ?? null);
    setVoiceId(profile?.voiceId ?? null);
    setVoiceName(profile?.voiceName ?? null);
    setVoiceProvider(isVoiceProvider(profile?.voiceProvider) ? profile.voiceProvider : null);
    setLooks(profile?.looks ?? []);
    setIsDefault(profile?.isDefault ?? false);
    setIsFavorite(profile?.isFavorite ?? false);
    setErrorMsg(null);
  }, [open, profile]);

  // Load the voice roster once the form is open.
  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setVoicesLoading(true);
    void (async () => {
      try {
        const res = await authFetch('/api/video/voices');
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as VoicesApiResponse;
        if (!cancelled) {
          setVoices(data.voices ?? []);
        }
      } catch {
        /* voices are optional — leave the dropdown empty on failure */
      } finally {
        if (!cancelled) {
          setVoicesLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, authFetch]);

  // ── Upload a media file through the Media Library (permanent URL) ───────────
  // Mirrors the face-anchor upload: POST /api/media multipart → { asset: { url } }.
  const uploadMedia = useCallback(
    async (file: File, mediaType: 'image' | 'video' | 'audio'): Promise<string | null> => {
      const category = mediaType === 'image' ? 'photo' : mediaType;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', mediaType);
      formData.append('category', category);
      formData.append('name', file.name);

      const res = await authFetch('/api/media', {
        method: 'POST',
        body: formData,
      });
      const data = (await res.json()) as MediaUploadResponse;
      if (!res.ok || !data.success || !data.asset?.url) {
        setErrorMsg(data.error ?? `${mediaType} upload failed. Try again.`);
        return null;
      }
      return data.asset.url;
    },
    [authFetch],
  );

  // Backwards-compatible image upload used by the face-anchor / body slots.
  const uploadImage = useCallback(
    (file: File): Promise<string | null> => uploadMedia(file, 'image'),
    [uploadMedia],
  );

  const handleSlotUpload = useCallback(
    async (
      e: React.ChangeEvent<HTMLInputElement>,
      slot: 'frontal' | 'fullBody' | 'upperBody' | 'additional',
    ) => {
      // Capture the input element up front: after the upload await, `e` may be
      // reused, so reset the value off this stable reference.
      const input = e.currentTarget;
      const file = input.files?.[0];
      if (file) {
        setUploadingSlot(slot);
        setErrorMsg(null);
        try {
          const url = await uploadImage(file);
          if (url) {
            if (slot === 'frontal') {
              setFrontalImageUrl(url);
            } else if (slot === 'fullBody') {
              setFullBodyImageUrl(url);
            } else if (slot === 'upperBody') {
              setUpperBodyImageUrl(url);
            } else {
              setAdditionalImageUrls((prev) => [...prev, url]);
            }
          }
        } finally {
          setUploadingSlot(null);
        }
      }
      // Reset the input so the same file can be re-picked.
      input.value = '';
    },
    [uploadImage],
  );

  const removeAdditional = useCallback((url: string) => {
    setAdditionalImageUrls((prev) => prev.filter((u) => u !== url));
  }, []);

  // Reflect a saved character's slot state from the AvatarProfile the move
  // endpoint returns. Keeps the UI in sync with what actually persisted without
  // re-appending anything (the server already added the reference image).
  const syncSlotsFromProfile = useCallback((updated: AvatarProfile) => {
    setFrontalImageUrl(updated.frontalImageUrl ?? '');
    setAdditionalImageUrls(updated.additionalImageUrls ?? []);
    setFullBodyImageUrl(updated.fullBodyImageUrl ?? null);
    setUpperBodyImageUrl(updated.upperBodyImageUrl ?? null);
  }, []);

  // Fill the open slot from EXISTING library images.
  //
  // EDIT mode (saved character → profile.id exists): MOVE the picked image.
  // POST /api/video/avatar-profiles/[id]/add-image { assetId } appends it to the
  // character's reference set AND deletes the media-library record, so the image
  // lives in one place. We then re-sync the form slots from the returned profile
  // (the server decides frontal vs. additional) so the move shows immediately and
  // the normal save path never re-adds it (no double-add).
  //
  // CREATE mode (no profile.id yet): the move endpoint can't run pre-save — there
  // is no character to move onto. So we just set the URL on the slot locally and
  // the image stays in the library. Moving the picked image is acceptable to skip
  // for a brand-new character; it can be re-picked and moved after first save.
  const applyLibrarySelection = useCallback(
    (assets: LibraryAsset[]) => {
      const target = libraryTarget;
      const imageAssets = assets.filter((a) => a.type === 'image');
      // Capture the picker target before we close it.
      setLibraryTarget(null);
      if (imageAssets.length === 0 || target === null) {
        return;
      }

      // ── CREATE mode: no character to move onto yet — copy the URL locally. ──
      if (!isEdit || profile === null) {
        const urls = imageAssets.map((a) => a.url);
        if (target === 'frontal') {
          setFrontalImageUrl(urls[0]);
        } else if (target === 'fullBody') {
          setFullBodyImageUrl(urls[0]);
        } else if (target === 'upperBody') {
          setUpperBodyImageUrl(urls[0]);
        } else {
          setAdditionalImageUrls((prev) => {
            const merged = [...prev];
            for (const u of urls) {
              if (!merged.includes(u)) {
                merged.push(u);
              }
            }
            return merged;
          });
        }
        return;
      }

      // ── EDIT mode: MOVE each picked image onto the saved character. ──
      const profileId = profile.id;
      const assetsToMove =
        target === 'additional' ? imageAssets : imageAssets.slice(0, 1);
      setMovingFromLibrary(true);
      setErrorMsg(null);
      void (async () => {
        try {
          for (const asset of assetsToMove) {
            const res = await authFetch(
              `/api/video/avatar-profiles/${profileId}/add-image`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Pass the exact slot the operator picked so a full-body / upper-body
                // pick lands in that slot — not silently in "additional".
                body: JSON.stringify({ assetId: asset.id, slot: target }),
              },
            );
            const data = (await res.json()) as {
              success: boolean;
              error?: string;
              profile?: AvatarProfile;
            };
            if (!res.ok || !data.success) {
              setErrorMsg(
                data.error ?? 'Could not move that image from the library. Try again.',
              );
              return;
            }
            // Re-sync from the authoritative profile after each move.
            if (data.profile) {
              syncSlotsFromProfile(data.profile);
            }
          }
        } catch (err) {
          setErrorMsg(
            err instanceof Error
              ? err.message
              : 'Could not move that image from the library. Try again.',
          );
        } finally {
          setMovingFromLibrary(false);
        }
      })();
    },
    [libraryTarget, isEdit, profile, authFetch, syncSlotsFromProfile],
  );

  // ── Looks (alter egos) ──────────────────────────────────────────────────────
  const addLook = useCallback(() => {
    setLooks((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: '',
        outfitDescription: '',
        imageUrls: [],
        videoUrls: [],
        audioUrls: [],
        // First look added becomes primary by default.
        isPrimary: prev.length === 0,
      },
    ]);
  }, []);

  const removeLook = useCallback((lookId: string) => {
    setLooks((prev) => {
      const removed = prev.find((l) => l.id === lookId);
      const next = prev.filter((l) => l.id !== lookId);
      // If we removed the primary look, promote the first remaining one.
      if (removed?.isPrimary && next.length > 0 && !next.some((l) => l.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return next;
    });
  }, []);

  const updateLookField = useCallback(
    (lookId: string, field: 'name' | 'outfitDescription', value: string) => {
      setLooks((prev) =>
        prev.map((l) => (l.id === lookId ? { ...l, [field]: value } : l)),
      );
    },
    [],
  );

  const setPrimaryLook = useCallback((lookId: string) => {
    setLooks((prev) => prev.map((l) => ({ ...l, isPrimary: l.id === lookId })));
  }, []);

  const addLookMediaUrl = useCallback(
    (lookId: string, mediaType: 'image' | 'video' | 'audio', url: string) => {
      setLooks((prev) =>
        prev.map((l) => {
          if (l.id !== lookId) {
            return l;
          }
          if (mediaType === 'image') {
            return { ...l, imageUrls: [...l.imageUrls, url] };
          }
          if (mediaType === 'video') {
            return { ...l, videoUrls: [...l.videoUrls, url] };
          }
          return { ...l, audioUrls: [...l.audioUrls, url] };
        }),
      );
    },
    [],
  );

  const removeLookMediaUrl = useCallback(
    (lookId: string, mediaType: 'image' | 'video' | 'audio', url: string) => {
      setLooks((prev) =>
        prev.map((l) => {
          if (l.id !== lookId) {
            return l;
          }
          if (mediaType === 'image') {
            return { ...l, imageUrls: l.imageUrls.filter((u) => u !== url) };
          }
          if (mediaType === 'video') {
            return { ...l, videoUrls: l.videoUrls.filter((u) => u !== url) };
          }
          return { ...l, audioUrls: l.audioUrls.filter((u) => u !== url) };
        }),
      );
    },
    [],
  );

  const handleLookUpload = useCallback(
    async (
      e: React.ChangeEvent<HTMLInputElement>,
      lookId: string,
      mediaType: 'image' | 'video' | 'audio',
    ) => {
      const input = e.currentTarget;
      const file = input.files?.[0];
      if (file) {
        const slotKey = `look-${lookId}-${mediaType}`;
        setUploadingSlot(slotKey);
        setErrorMsg(null);
        try {
          const url = await uploadMedia(file, mediaType);
          if (url) {
            addLookMediaUrl(lookId, mediaType, url);
          }
        } finally {
          setUploadingSlot(null);
        }
      }
      input.value = '';
    },
    [uploadMedia, addLookMediaUrl],
  );

  // ── Voice selection ─────────────────────────────────────────────────────────
  const handleVoiceChange = useCallback(
    (selectedId: string) => {
      if (!selectedId) {
        setVoiceId(null);
        setVoiceName(null);
        setVoiceProvider(null);
        return;
      }
      const match = voices.find((v) => v.id === selectedId);
      setVoiceId(selectedId);
      setVoiceName(match?.name ?? null);
      setVoiceProvider(isVoiceProvider(match?.provider) ? match.provider : null);
    },
    [voices],
  );

  // Called when the Clone Voice Studio finishes recording + cloning + assigning.
  // The studio already PATCHed this character's voice; we just reflect it in the
  // form (select the new voice, inject it into the roster so the dropdown shows it)
  // and close the studio.
  const handleVoiceAssigned = useCallback(
    ({ voiceId: newVoiceId, voiceName: newVoiceName }: { voiceId: string; voiceName: string }) => {
      setVoiceId(newVoiceId);
      setVoiceName(newVoiceName);
      setVoiceProvider('custom');
      setVoices((prev) =>
        prev.some((v) => v.id === newVoiceId)
          ? prev
          : [{ id: newVoiceId, name: newVoiceName, language: '', provider: 'custom' }, ...prev],
      );
      setVoiceStudioOpen(false);
    },
    [],
  );

  // ── Save (create or update) ─────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setErrorMsg(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('A name is required.');
      return;
    }
    if (!frontalImageUrl) {
      setErrorMsg('Upload a face anchor image so the character can be used.');
      return;
    }

    // Drop blank-name looks (an "Add Look" the operator never filled in).
    const cleanedLooks = looks.filter((l) => l.name.trim().length > 0);

    const payload: CharacterFormPayload = {
      name: trimmedName,
      description: description.trim() ? description.trim() : null,
      role,
      styleTag,
      frontalImageUrl,
      additionalImageUrls,
      fullBodyImageUrl,
      upperBodyImageUrl,
      looks: cleanedLooks,
      voiceId,
      voiceName,
      voiceProvider,
      isDefault,
      isFavorite,
    };

    setSaving(true);
    try {
      const res = isEdit
        ? await authFetch(`/api/video/avatar-profiles/${profile.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await authFetch('/api/video/avatar-profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      const data = (await res.json()) as { success: boolean; error?: string; profile?: AvatarProfile };
      if (!res.ok || !data.success) {
        setErrorMsg(data.error ?? 'Could not save the character. Try again.');
        return;
      }
      onSaved(data.profile);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not save the character.');
    } finally {
      setSaving(false);
    }
  }, [
    name,
    frontalImageUrl,
    description,
    role,
    styleTag,
    additionalImageUrls,
    fullBodyImageUrl,
    upperBodyImageUrl,
    looks,
    voiceId,
    voiceName,
    voiceProvider,
    isDefault,
    isFavorite,
    isEdit,
    profile,
    authFetch,
    onSaved,
  ]);

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit character' : 'New character'}</DialogTitle>
          <DialogDescription>
            Define the character once — its face, look, and voice — then reuse it across
            every video you build.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Name */}
          <div>
            <Caption className="mb-1 block">Name</Caption>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. David — Professional"
            />
          </div>

          {/* Description / DNA */}
          <div>
            <Caption className="mb-1 block">Description (the character&apos;s DNA)</Caption>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="30-year-old man, short dark hair, sharp jawline, navy suit"
              className="w-full resize-y rounded-md border border-border-strong bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Caption className="mt-1 block">
              The richer the description, the more consistent the character looks across scenes.
            </Caption>
          </div>

          {/* Role + style */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Caption className="mb-1 block">Role</Caption>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as CharacterRole)}
                className="w-full rounded-md border border-border-strong bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Caption className="mb-1 block">Style</Caption>
              <select
                value={styleTag}
                onChange={(e) => setStyleTag(e.target.value as CharacterStyleTag)}
                className="w-full rounded-md border border-border-strong bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {STYLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Face anchor (required) */}
          <div>
            <CardTitle className="mb-1">Face anchor</CardTitle>
            <Caption className="mb-2 block">
              The master face photo. Required — every generated scene is matched to this face.
            </Caption>
            <input
              ref={frontalInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void handleSlotUpload(e, 'frontal');
              }}
            />
            {frontalImageUrl ? (
              <div className="relative inline-block">
                <div className="relative h-32 w-32 overflow-hidden rounded-xl border border-border-strong bg-surface-elevated">
                  <Image
                    src={frontalImageUrl}
                    alt="Face anchor"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingSlot === 'frontal'}
                  onClick={() => frontalInputRef.current?.click()}
                  className="mt-2 gap-1.5 text-xs"
                >
                  {uploadingSlot === 'frontal' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Replace
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={uploadingSlot === 'frontal'}
                onClick={() => frontalInputRef.current?.click()}
                className="gap-2"
              >
                {uploadingSlot === 'frontal' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploadingSlot === 'frontal' ? 'Uploading…' : 'Upload face anchor'}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={movingFromLibrary}
              onClick={() => setLibraryTarget('frontal')}
              className="mt-2 ml-2 gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> From library
            </Button>
          </div>

          {/* Additional reference images */}
          <div>
            <CardTitle className="mb-1">Additional angles</CardTitle>
            <Caption className="mb-2 block">
              Optional side / body angles — add as many as you like. More references sharpen
              consistency.
            </Caption>
            <input
              ref={additionalInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void handleSlotUpload(e, 'additional');
              }}
            />
            <div className="flex flex-wrap gap-2">
              {additionalImageUrls.map((url) => (
                <div
                  key={url}
                  className="relative h-20 w-20 overflow-hidden rounded-lg border border-border-strong bg-surface-elevated"
                >
                  <Image src={url} alt="Reference angle" fill unoptimized className="object-cover" />
                  <button
                    type="button"
                    onClick={() => removeAdditional(url)}
                    aria-label="Remove image"
                    className="absolute right-0.5 top-0.5 rounded-md bg-black/55 p-0.5 text-white hover:bg-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={uploadingSlot === 'additional'}
                onClick={() => additionalInputRef.current?.click()}
                className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong bg-surface-elevated text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-50"
              >
                {uploadingSlot === 'additional' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <span className="text-[10px]">Add</span>
              </button>
              <button
                type="button"
                disabled={movingFromLibrary}
                onClick={() => setLibraryTarget('additional')}
                className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong bg-surface-elevated text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                <span className="text-[10px]">Library</span>
              </button>
            </div>
          </div>

          {/* Full-body + upper-body */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BodyImageSlot
              label="Full-body reference"
              url={fullBodyImageUrl}
              uploading={uploadingSlot === 'fullBody'}
              inputRef={fullBodyInputRef}
              onUpload={(e) => {
                void handleSlotUpload(e, 'fullBody');
              }}
              onClear={() => setFullBodyImageUrl(null)}
              onPickLibrary={() => setLibraryTarget('fullBody')}
              libraryDisabled={movingFromLibrary}
              // In edit mode a moved library image lands in the character's
              // reference set (face/angles), not strictly this body slot.
              libraryHint={
                isEdit
                  ? 'Adds the image to this character and removes it from your library'
                  : undefined
              }
            />
            <BodyImageSlot
              label="Upper-body reference"
              url={upperBodyImageUrl}
              uploading={uploadingSlot === 'upperBody'}
              inputRef={upperBodyInputRef}
              onUpload={(e) => {
                void handleSlotUpload(e, 'upperBody');
              }}
              onClear={() => setUpperBodyImageUrl(null)}
              onPickLibrary={() => setLibraryTarget('upperBody')}
              libraryDisabled={movingFromLibrary}
              libraryHint={
                isEdit
                  ? 'Adds the image to this character and removes it from your library'
                  : undefined
              }
            />
          </div>

          {/* Voice */}
          <div>
            <CardTitle className="mb-1">Voice</CardTitle>
            <Caption className="mb-2 block">
              Optional. Pick a voice from the roster, or record this character&apos;s own voice.
            </Caption>
            <select
              value={voiceId ?? ''}
              onChange={(e) => handleVoiceChange(e.target.value)}
              disabled={voicesLoading}
              className="w-full rounded-md border border-border-strong bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <option value="">{voicesLoading ? 'Loading voices…' : 'No voice'}</option>
              {voices.map((v) => (
                <option key={`${v.provider ?? 'voice'}-${v.id}`} value={v.id}>
                  {v.name}
                  {v.provider ? ` · ${v.provider}` : ''}
                  {v.gender && v.gender !== 'neutral' ? ` · ${v.gender}` : ''}
                </option>
              ))}
            </select>
            {!voicesLoading && voices.length === 0 && (
              <Caption className="mt-1 block">
                No voices available yet — connect a voice provider in settings, or record one below.
              </Caption>
            )}

            {/* Record a custom (cloned) voice — needs a saved character to assign to */}
            {isEdit ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setVoiceStudioOpen(true)}
                  className="gap-2"
                >
                  <Music className="h-4 w-4" />
                  Record this character&apos;s voice
                </Button>
                {voiceProvider === 'custom' && voiceName ? (
                  <Caption className="text-foreground">
                    Recorded voice: <span className="font-medium">{voiceName}</span>
                  </Caption>
                ) : (
                  <Caption>Read a short script aloud to clone a voice just for this character.</Caption>
                )}
              </div>
            ) : (
              <Caption className="mt-2 block">
                Save this character first, then you can record a custom voice for it.
              </Caption>
            )}
          </div>

          {/* Looks (alter egos) */}
          <div className="border-t border-border-light pt-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-1.5">
                <Shirt className="h-4 w-4 text-primary" />
                Looks
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLook}
                className="gap-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add look
              </Button>
            </div>
            <SectionDescription className="mb-3">
              Alter egos that share this character&apos;s face — same person, different outfit or
              state (e.g. civilian vs. hero). Each look keeps its own reference images, video, and
              audio.
            </SectionDescription>

            {looks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border-strong bg-surface-elevated p-4">
                <Caption className="block text-center">
                  No looks yet. Add one to give this character an alternate outfit or state.
                </Caption>
              </div>
            ) : (
              <div className="space-y-4">
                {looks.map((look) => (
                  <LookRow
                    key={look.id}
                    look={look}
                    uploadingSlot={uploadingSlot}
                    onNameChange={(value) => updateLookField(look.id, 'name', value)}
                    onOutfitChange={(value) =>
                      updateLookField(look.id, 'outfitDescription', value)
                    }
                    onSetPrimary={() => setPrimaryLook(look.id)}
                    onRemove={() => removeLook(look.id)}
                    onUpload={(e, mediaType) => {
                      void handleLookUpload(e, look.id, mediaType);
                    }}
                    onRemoveMedia={(mediaType, url) =>
                      removeLookMediaUrl(look.id, mediaType, url)
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-4 border-t border-border-light pt-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={isFavorite}
                onChange={(e) => setIsFavorite(e.target.checked)}
                className="h-4 w-4"
              />
              <Star className="h-4 w-4 text-primary" />
              Favorite
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4"
              />
              Default character
            </label>
          </div>

          {movingFromLibrary && (
            <div className="flex items-center gap-2 rounded-md border border-border-light bg-surface-elevated p-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <Caption>Moving the image from your library onto this character…</Caption>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2">
              <Caption className="text-destructive">{errorMsg}</Caption>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t border-border-light pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                void handleSave();
              }}
              disabled={saving || uploadingSlot !== null || movingFromLibrary}
              className="gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <UserSquare2 className="h-4 w-4" />
                  {isEdit ? 'Save changes' : 'Create character'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <MediaLibraryPicker
      open={libraryTarget !== null}
      onOpenChange={(o) => {
        if (!o) {
          setLibraryTarget(null);
        }
      }}
      onSelect={applyLibrarySelection}
      authFetch={authFetch}
    />
    {/* Clone Voice Studio — record a custom voice and assign it to this character.
        Edit-mode only: the studio assigns via PATCH /avatar-profiles/[id], so a
        saved profile id must exist. */}
    {isEdit && profile && (
      <Dialog open={voiceStudioOpen} onOpenChange={setVoiceStudioOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Music className="h-5 w-5 text-primary" />
              Record {name || profile.name}&apos;s voice
            </DialogTitle>
            <DialogDescription>
              Read the script aloud — once steady, once expressive. We build the voice clone and
              set it as this character&apos;s voice.
            </DialogDescription>
          </DialogHeader>
          <CloneVoiceStudio
            embedded
            targetCharacter={{ id: profile.id, name: name || profile.name }}
            onAssigned={handleVoiceAssigned}
          />
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}

// ============================================================================
// Body image slot sub-component
// ============================================================================

interface BodyImageSlotProps {
  label: string;
  url: string | null;
  uploading: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  onPickLibrary: () => void;
  libraryDisabled: boolean;
  libraryHint?: string;
}

function BodyImageSlot({
  label,
  url,
  uploading,
  inputRef,
  onUpload,
  onClear,
  onPickLibrary,
  libraryDisabled,
  libraryHint,
}: BodyImageSlotProps) {
  return (
    <div>
      <Caption className="mb-1 block">{label}</Caption>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
      {url ? (
        <div className="space-y-2">
          <div className="relative inline-block">
            <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-border-strong bg-surface-elevated">
              <Image src={url} alt={label} fill unoptimized className="object-cover" />
            </div>
            <button
              type="button"
              onClick={onClear}
              aria-label={`Remove ${label}`}
              className="absolute right-0.5 top-0.5 rounded-md bg-black/55 p-0.5 text-white hover:bg-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="gap-1.5 text-xs"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={libraryDisabled}
              onClick={onPickLibrary}
              title={libraryHint}
              className="gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> From library
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="gap-1.5 text-xs"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={libraryDisabled}
            onClick={onPickLibrary}
            title={libraryHint}
            className="gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> From library
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Look row sub-component (one alter ego: name + outfit + image/video/audio refs)
// ============================================================================

type LookMediaType = 'image' | 'video' | 'audio';

interface LookRowProps {
  look: CharacterLook;
  /** The currently-uploading slot key, used to disable + spin the right button. */
  uploadingSlot: string | null;
  onNameChange: (value: string) => void;
  onOutfitChange: (value: string) => void;
  onSetPrimary: () => void;
  onRemove: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>, mediaType: LookMediaType) => void;
  onRemoveMedia: (mediaType: LookMediaType, url: string) => void;
}

function LookRow({
  look,
  uploadingSlot,
  onNameChange,
  onOutfitChange,
  onSetPrimary,
  onRemove,
  onUpload,
  onRemoveMedia,
}: LookRowProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Two-step confirm only when the look already carries uploads; a brand-new
  // empty look removes in a single click.
  const hasUploads =
    look.imageUrls.length > 0 || look.videoUrls.length > 0 || look.audioUrls.length > 0;
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  useEffect(() => {
    if (!confirmingRemove) {
      return;
    }
    const timer = setTimeout(() => setConfirmingRemove(false), 5000);
    return () => clearTimeout(timer);
  }, [confirmingRemove]);

  const handleRemoveClick = useCallback(() => {
    if (!hasUploads) {
      onRemove();
      return;
    }
    if (confirmingRemove) {
      onRemove();
      return;
    }
    setConfirmingRemove(true);
  }, [hasUploads, confirmingRemove, onRemove]);

  const imageSlot = `look-${look.id}-image`;
  const videoSlot = `look-${look.id}-video`;
  const audioSlot = `look-${look.id}-audio`;

  return (
    <div className="rounded-xl border border-border-strong bg-card p-4">
      {/* Header: name + primary toggle + remove */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[12rem] flex-1">
          <Caption className="mb-1 block">Look name</Caption>
          <Input
            value={look.name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. David (civilian)"
          />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="radio"
              name={`primary-look-${look.id}`}
              checked={look.isPrimary}
              onChange={onSetPrimary}
              className="h-4 w-4"
            />
            Primary
          </label>
          {confirmingRemove ? (
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleRemoveClick}
                className="gap-1.5 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Click again to remove
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmingRemove(false)}
                className="text-xs"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemoveClick}
              aria-label="Remove look"
              className="gap-1.5 text-xs"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          )}
        </div>
      </div>

      {/* Outfit description */}
      <div className="mb-3">
        <Caption className="mb-1 block">Outfit / state</Caption>
        <textarea
          value={look.outfitDescription}
          onChange={(e) => onOutfitChange(e.target.value)}
          rows={2}
          placeholder="e.g. jeans and a grey t-shirt / dark armor, glowing purple energy"
          className="w-full resize-y rounded-md border border-border-strong bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Reference media: images */}
      <div className="mb-3">
        <Caption className="mb-1.5 block">Reference images</Caption>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onUpload(e, 'image')}
        />
        <div className="flex flex-wrap gap-2">
          {look.imageUrls.map((url) => (
            <div
              key={url}
              className="relative h-20 w-20 overflow-hidden rounded-lg border border-border-strong bg-surface-elevated"
            >
              <Image src={url} alt="Look reference" fill unoptimized className="object-cover" />
              <button
                type="button"
                onClick={() => onRemoveMedia('image', url)}
                aria-label="Remove reference image"
                className="absolute right-0.5 top-0.5 rounded-md bg-black/55 p-0.5 text-white hover:bg-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={uploadingSlot === imageSlot}
            onClick={() => imageInputRef.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong bg-surface-elevated text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-50"
          >
            {uploadingSlot === imageSlot ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span className="text-[10px]">Image</span>
          </button>
        </div>
      </div>

      {/* Reference media: video + audio */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LookMediaList
          label="Reference video"
          icon={<Film className="h-3.5 w-3.5" />}
          urls={look.videoUrls}
          uploading={uploadingSlot === videoSlot}
          inputRef={videoInputRef}
          accept="video/*"
          onUploadClick={() => videoInputRef.current?.click()}
          onUpload={(e) => onUpload(e, 'video')}
          onRemove={(url) => onRemoveMedia('video', url)}
        />
        <LookMediaList
          label="Reference audio"
          icon={<Music className="h-3.5 w-3.5" />}
          urls={look.audioUrls}
          uploading={uploadingSlot === audioSlot}
          inputRef={audioInputRef}
          accept="audio/*"
          onUploadClick={() => audioInputRef.current?.click()}
          onUpload={(e) => onUpload(e, 'audio')}
          onRemove={(url) => onRemoveMedia('audio', url)}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Look media list sub-component (video / audio reference clips)
// ============================================================================

interface LookMediaListProps {
  label: string;
  icon: React.ReactNode;
  urls: string[];
  uploading: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  accept: string;
  onUploadClick: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (url: string) => void;
}

function LookMediaList({
  label,
  icon,
  urls,
  uploading,
  inputRef,
  accept,
  onUploadClick,
  onUpload,
  onRemove,
}: LookMediaListProps) {
  return (
    <div>
      <Caption className="mb-1.5 flex items-center gap-1.5">
        {icon}
        {label}
      </Caption>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onUpload} />
      <div className="space-y-1.5">
        {urls.map((url) => (
          <div
            key={url}
            className="flex items-center justify-between gap-2 rounded-md border border-border-light bg-surface-elevated px-2 py-1.5"
          >
            <span className="truncate text-xs text-muted-foreground">
              {url.split('/').pop() ?? url}
            </span>
            <button
              type="button"
              onClick={() => onRemove(url)}
              aria-label={`Remove ${label}`}
              className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={onUploadClick}
          className="w-full gap-1.5 text-xs"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Add {label.toLowerCase().replace('reference ', '')}
        </Button>
      </div>
    </div>
  );
}
