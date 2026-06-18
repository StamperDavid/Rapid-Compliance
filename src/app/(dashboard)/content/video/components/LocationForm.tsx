'use client';

/**
 * Location Library — create / edit form (mirrors CharacterForm, but for PLACES).
 *
 * A Location is a reusable "digital set": defined once — its locked layout,
 * furniture, windows, walls, materials and lighting — then reused across every
 * video so the room stays consistent shot to shot.
 *
 * Fields:
 *   - name
 *   - description (the LOCKED set description — the prominent field that keeps the
 *     room consistent; layout / furniture / windows / walls / materials / lighting)
 *   - reference IMAGES (multiple) — upload via POST /api/media OR choose from the
 *     existing Media Library (MediaLibraryPicker)
 *   - optional reference VIDEO(S) — upload via POST /api/media (mediaType video)
 *
 * Image/video persistence reuses the SAME upload route the Media Library uses:
 * POST /api/media (multipart) → { asset: { url } }. No new upload route invented.
 *
 * Saving:
 *   - create → POST  /api/video/locations
 *   - edit   → PATCH /api/video/locations/[locationId]
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Caption, CardTitle } from '@/components/ui/typography';
import { MediaLibraryPicker, type LibraryAsset } from '@/components/content/MediaLibraryPicker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, Upload, X, MapPin, Film, LibraryBig } from 'lucide-react';
import type {
  LocationProfile,
  LocationFormPayload,
  LocationMutationResponse,
} from './location-types';

// ============================================================================
// Constants
// ============================================================================

const MAX_REFERENCE_IMAGES = 8;
const MAX_REFERENCE_VIDEOS = 4;

// ============================================================================
// Types
// ============================================================================

/** The media upload response from POST /api/media (shared with CharacterForm). */
interface MediaUploadResponse {
  success: boolean;
  asset?: { id: string; url: string };
  error?: string;
}

interface LocationFormProps {
  /** Existing location to edit, or null to create a new one. */
  location: LocationProfile | null;
  open: boolean;
  onClose: () => void;
  /** Called on a successful save; receives the saved location (when the API returns it)
   *  so a caller like the Shot Plan can add the new location straight to the plan. */
  onSaved: (location?: LocationProfile) => void;
}

// ============================================================================
// Component
// ============================================================================

export default function LocationForm({ location, open, onClose, onSaved }: LocationFormProps) {
  const authFetch = useAuthFetch();
  const isEdit = location !== null;

  // ── Form fields ───────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>([]);
  const [referenceVideoUrls, setReferenceVideoUrls] = useState<string[]>([]);

  // ── Upload + save state ─────────────────────────────────────────────────────
  // The slot key currently uploading ('image' | 'video'), null when idle.
  const [uploadingSlot, setUploadingSlot] = useState<'image' | 'video' | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Reset the form whenever it opens (or the target location changes).
  useEffect(() => {
    if (!open) {
      return;
    }
    setName(location?.name ?? '');
    setDescription(location?.description ?? '');
    setReferenceImageUrls(location?.referenceImageUrls ?? []);
    setReferenceVideoUrls(location?.referenceVideoUrls ?? []);
    setErrorMsg(null);
  }, [open, location]);

  // ── Upload a media file through the Media Library (permanent URL) ───────────
  // Mirrors CharacterForm's uploadMedia: POST /api/media multipart → { asset: { url } }.
  const uploadMedia = useCallback(
    async (file: File, mediaType: 'image' | 'video'): Promise<string | null> => {
      const category = mediaType === 'image' ? 'photo' : mediaType;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', mediaType);
      formData.append('category', category);
      formData.append('name', file.name);

      const res = await authFetch('/api/media', { method: 'POST', body: formData });
      const data = (await res.json()) as MediaUploadResponse;
      if (!res.ok || !data.success || !data.asset?.url) {
        setErrorMsg(data.error ?? `${mediaType} upload failed. Try again.`);
        return null;
      }
      return data.asset.url;
    },
    [authFetch],
  );

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      const file = input.files?.[0];
      if (file) {
        setUploadingSlot('image');
        setErrorMsg(null);
        try {
          const url = await uploadMedia(file, 'image');
          if (url) {
            setReferenceImageUrls((prev) =>
              prev.length >= MAX_REFERENCE_IMAGES || prev.includes(url) ? prev : [...prev, url],
            );
          }
        } finally {
          setUploadingSlot(null);
        }
      }
      input.value = '';
    },
    [uploadMedia],
  );

  const handleVideoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      const file = input.files?.[0];
      if (file) {
        setUploadingSlot('video');
        setErrorMsg(null);
        try {
          const url = await uploadMedia(file, 'video');
          if (url) {
            setReferenceVideoUrls((prev) =>
              prev.length >= MAX_REFERENCE_VIDEOS || prev.includes(url) ? prev : [...prev, url],
            );
          }
        } finally {
          setUploadingSlot(null);
        }
      }
      input.value = '';
    },
    [uploadMedia],
  );

  const removeImage = useCallback((url: string) => {
    setReferenceImageUrls((prev) => prev.filter((u) => u !== url));
  }, []);

  const removeVideo = useCallback((url: string) => {
    setReferenceVideoUrls((prev) => prev.filter((u) => u !== url));
  }, []);

  // Fill reference images from EXISTING library images (no re-upload).
  const applyLibrarySelection = useCallback((assets: LibraryAsset[]) => {
    const urls = assets.filter((a) => a.type === 'image').map((a) => a.url);
    if (urls.length > 0) {
      setReferenceImageUrls((prev) => {
        const merged = [...prev];
        for (const u of urls) {
          if (!merged.includes(u) && merged.length < MAX_REFERENCE_IMAGES) {
            merged.push(u);
          }
        }
        return merged;
      });
    }
    setLibraryOpen(false);
  }, []);

  // ── Save (create or update) ─────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setErrorMsg(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('A name is required.');
      return;
    }
    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      setErrorMsg('Describe the set so the room stays consistent across every shot.');
      return;
    }

    const payload: LocationFormPayload = {
      name: trimmedName,
      description: trimmedDescription,
      referenceImageUrls,
      referenceVideoUrls,
    };

    setSaving(true);
    try {
      const res = isEdit
        ? await authFetch(`/api/video/locations/${encodeURIComponent(location.id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await authFetch('/api/video/locations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      const data = (await res.json()) as LocationMutationResponse;
      if (!res.ok || !data.success) {
        setErrorMsg(data.error ?? 'Could not save the location. Try again.');
        return;
      }
      onSaved(data.location);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not save the location.');
    } finally {
      setSaving(false);
    }
  }, [
    name,
    description,
    referenceImageUrls,
    referenceVideoUrls,
    isEdit,
    location,
    authFetch,
    onSaved,
  ]);

  const canAddImage = referenceImageUrls.length < MAX_REFERENCE_IMAGES;
  const canAddVideo = referenceVideoUrls.length < MAX_REFERENCE_VIDEOS;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {isEdit ? 'Edit location' : 'New location'}
            </DialogTitle>
            <DialogDescription>
              Define a set once — its layout, furniture, materials and lighting — then reuse it
              across every video so the place looks the same in every shot.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Name */}
            <div>
              <Caption className="mb-1 block">Name</Caption>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. The corner office — golden hour"
              />
            </div>

            {/* Locked set description — the prominent, load-bearing field */}
            <div className="rounded-2xl border border-border-strong bg-card p-6">
              <CardTitle className="mb-1 flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-primary" />
                Locked set description
              </CardTitle>
              <Caption className="mb-2 block">
                This is what keeps the room consistent. Describe the layout, furniture, windows,
                walls, materials and lighting in detail — every shot is matched to this set.
              </Caption>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder="e.g. A 20ft-wide corner office. Floor-to-ceiling windows on the left and back walls, warm golden-hour light pouring in. Dark walnut desk centered, two charcoal leather chairs facing it, matte concrete floor, a low brass bookshelf along the right wall, a single brushed-steel pendant lamp overhead."
                className="w-full resize-y rounded-md border border-border-strong bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Caption className="mt-1 block">
                The richer the description, the more consistent the set looks across scenes.
              </Caption>
            </div>

            {/* Reference images */}
            <div>
              <CardTitle className="mb-1">Reference images</CardTitle>
              <Caption className="mb-2 block">
                Photos of the set (up to {MAX_REFERENCE_IMAGES}) that anchor its look. Upload new
                ones or pick from your Media Library.
              </Caption>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void handleImageUpload(e);
                }}
              />
              <div className="flex flex-wrap gap-2">
                {referenceImageUrls.map((url) => (
                  <div
                    key={url}
                    className="relative h-24 w-24 overflow-hidden rounded-lg border border-border-strong bg-surface-elevated"
                  >
                    <Image src={url} alt="Set reference" fill unoptimized className="object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      aria-label="Remove reference image"
                      className="absolute right-0.5 top-0.5 rounded-md bg-black/55 p-0.5 text-white hover:bg-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {canAddImage && (
                  <button
                    type="button"
                    disabled={uploadingSlot === 'image'}
                    onClick={() => imageInputRef.current?.click()}
                    className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong bg-surface-elevated text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                  >
                    {uploadingSlot === 'image' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    <span className="text-[10px]">Upload</span>
                  </button>
                )}
                {canAddImage && (
                  <button
                    type="button"
                    onClick={() => setLibraryOpen(true)}
                    className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong bg-surface-elevated text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  >
                    <LibraryBig className="h-4 w-4" />
                    <span className="text-[10px]">Library</span>
                  </button>
                )}
              </div>
            </div>

            {/* Reference videos (optional) */}
            <div>
              <CardTitle className="mb-1 flex items-center gap-1.5">
                <Film className="h-4 w-4 text-primary" />
                Reference video
              </CardTitle>
              <Caption className="mb-2 block">
                Optional. A walk-through clip of the set (up to {MAX_REFERENCE_VIDEOS}) gives the
                engine a fuller read of the space.
              </Caption>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  void handleVideoUpload(e);
                }}
              />
              <div className="space-y-1.5">
                {referenceVideoUrls.map((url) => (
                  <div
                    key={url}
                    className="flex items-center justify-between gap-2 rounded-md border border-border-light bg-surface-elevated px-2 py-1.5"
                  >
                    <span className="truncate text-xs text-muted-foreground">
                      {url.split('/').pop() ?? url}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeVideo(url)}
                      aria-label="Remove reference video"
                      className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {canAddVideo && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingSlot === 'video'}
                    onClick={() => videoInputRef.current?.click()}
                    className="gap-1.5 text-xs"
                  >
                    {uploadingSlot === 'video' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    Add reference video
                  </Button>
                )}
              </div>
            </div>

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
                disabled={saving || uploadingSlot !== null}
                className="gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <MapPin className="h-4 w-4" />
                    {isEdit ? 'Save changes' : 'Create location'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <MediaLibraryPicker
        open={libraryOpen}
        onOpenChange={(o) => {
          if (!o) {
            setLibraryOpen(false);
          }
        }}
        onSelect={applyLibrarySelection}
        authFetch={authFetch}
      />
    </>
  );
}
