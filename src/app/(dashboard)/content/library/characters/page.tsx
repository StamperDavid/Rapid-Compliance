'use client';

/**
 * Content Generator → Library → Characters section — the Character Library.
 *
 * Lists every saved character (AvatarProfile) as a responsive grid of cards:
 *   - face anchor thumbnail (fallback icon if none)
 *   - name, role, short description
 *   - favorite star toggle
 *   - two-step-confirm delete (per feedback_destructive_actions_two_step_confirmation)
 *
 * "New Character" opens the create form; clicking a card opens it for edit.
 *
 * Data model + API are the existing avatar-profile service / routes:
 *   GET    /api/video/avatar-profiles
 *   POST   /api/video/avatar-profiles
 *   PATCH  /api/video/avatar-profiles/[profileId]   (favorite toggle lives here too)
 *   DELETE /api/video/avatar-profiles/[profileId]
 *
 * All API calls go through the auth-aware useAuthFetch hook.
 *
 * The two-level nav (Content Generator tabs + Library sections) and the page
 * padding/spacing are supplied by the Library layout at
 * `src/app/(dashboard)/content/library/layout.tsx`. This page renders only its
 * own content as fragment children.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Button } from '@/components/ui/button';
import {
  PageTitle,
  SectionTitle,
  SectionDescription,
  Caption,
  CardTitle,
} from '@/components/ui/typography';
import {
  Users,
  Plus,
  Loader2,
  Star,
  Trash2,
  UserSquare2,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { AvatarProfile, CharacterRole } from '@/lib/video/avatar-profile-service';
import CharacterForm from '@/app/(dashboard)/content/characters/CharacterForm';

// ============================================================================
// Constants
// ============================================================================

// 5-second auto-disarm window per feedback_destructive_actions_two_step_confirmation
const DISARM_TIMEOUT_MS = 5000;

const ROLE_LABELS: Record<CharacterRole, string> = {
  presenter: 'Presenter',
  narrator: 'Narrator',
  hero: 'Hero',
  villain: 'Villain',
  extra: 'Extra',
  custom: 'Custom',
};

// ============================================================================
// API response types
// ============================================================================

interface ListProfilesResponse {
  success: boolean;
  profiles?: AvatarProfile[];
  error?: string;
}

// ============================================================================
// Image collection — every reference image a character carries, labelled
// ============================================================================

interface CharacterImage {
  url: string;
  label: string;
}

/**
 * Gather EVERY image stored on a character — the primary face, full/upper body,
 * all additional angles, and every per-look reference — deduped and labelled, so
 * the viewer can show the whole set full-size (not just the cropped card thumbnail).
 */
function collectCharacterImages(profile: AvatarProfile): CharacterImage[] {
  const out: CharacterImage[] = [];
  const seen = new Set<string>();
  const add = (url: string | null | undefined, label: string) => {
    const u = url?.trim();
    if (!u || seen.has(u)) {
      return;
    }
    seen.add(u);
    out.push({ url: u, label });
  };

  add(profile.frontalImageUrl, 'Front');
  add(profile.fullBodyImageUrl, 'Full body');
  add(profile.upperBodyImageUrl, 'Upper body');
  profile.additionalImageUrls.forEach((u, i) => add(u, `View ${i + 1}`));
  profile.looks.forEach((look) => {
    look.imageUrls.forEach((u) => add(u, look.name || 'Look'));
  });

  return out;
}

// ============================================================================
// Component
// ============================================================================

export default function CharacterLibraryPage() {
  const authFetch = useAuthFetch();

  const [profiles, setProfiles] = useState<AvatarProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form (create / edit)
  const [formOpen, setFormOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<AvatarProfile | null>(null);

  // Two-step delete arming
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const disarmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Favorite toggle in-flight
  const [favoritingId, setFavoritingId] = useState<string | null>(null);

  // Full-image viewer (lightbox)
  const [viewerProfile, setViewerProfile] = useState<AvatarProfile | null>(null);

  // ── Fetch ───────────────────────────────────────────────────────────────
  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // scope=own → only the operator's own created characters (never stock avatars).
      const res = await authFetch('/api/video/avatar-profiles?scope=own');
      if (!res.ok) {
        setErrorMsg(`Failed to load characters (${res.status})`);
        setProfiles([]);
        return;
      }
      const data = (await res.json()) as ListProfilesResponse;
      setProfiles(data.profiles ?? []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load characters');
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  // Cleanup the disarm timer on unmount.
  useEffect(() => {
    return () => {
      if (disarmTimerRef.current) {
        clearTimeout(disarmTimerRef.current);
      }
    };
  }, []);

  // ── Open form ─────────────────────────────────────────────────────────────
  const openCreate = useCallback(() => {
    setEditingProfile(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((profile: AvatarProfile) => {
    setEditingProfile(profile);
    setFormOpen(true);
  }, []);

  const handleSaved = useCallback(() => {
    setFormOpen(false);
    setEditingProfile(null);
    void fetchProfiles();
  }, [fetchProfiles]);

  // ── Two-step delete ─────────────────────────────────────────────────────
  const armDelete = useCallback((id: string) => {
    setArmedDeleteId(id);
    if (disarmTimerRef.current) {
      clearTimeout(disarmTimerRef.current);
    }
    disarmTimerRef.current = setTimeout(() => {
      setArmedDeleteId(null);
      disarmTimerRef.current = null;
    }, DISARM_TIMEOUT_MS);
  }, []);

  const cancelDelete = useCallback(() => {
    setArmedDeleteId(null);
    if (disarmTimerRef.current) {
      clearTimeout(disarmTimerRef.current);
      disarmTimerRef.current = null;
    }
  }, []);

  const confirmDelete = useCallback(
    async (id: string) => {
      setDeletingId(id);
      try {
        const res = await authFetch(`/api/video/avatar-profiles/${id}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          setProfiles((prev) => prev.filter((p) => p.id !== id));
        } else {
          setErrorMsg('Could not delete the character. Try again.');
        }
      } catch {
        setErrorMsg('Could not delete the character. Try again.');
      } finally {
        setDeletingId(null);
        setArmedDeleteId(null);
        if (disarmTimerRef.current) {
          clearTimeout(disarmTimerRef.current);
          disarmTimerRef.current = null;
        }
      }
    },
    [authFetch],
  );

  // ── Favorite toggle ─────────────────────────────────────────────────────
  const toggleFavorite = useCallback(
    async (profile: AvatarProfile) => {
      const next = !profile.isFavorite;
      setFavoritingId(profile.id);
      // Optimistic update.
      setProfiles((prev) =>
        prev.map((p) => (p.id === profile.id ? { ...p, isFavorite: next } : p)),
      );
      try {
        const res = await authFetch(`/api/video/avatar-profiles/${profile.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isFavorite: next }),
        });
        if (!res.ok) {
          // Revert on failure.
          setProfiles((prev) =>
            prev.map((p) => (p.id === profile.id ? { ...p, isFavorite: !next } : p)),
          );
        }
      } catch {
        setProfiles((prev) =>
          prev.map((p) => (p.id === profile.id ? { ...p, isFavorite: !next } : p)),
        );
      } finally {
        setFavoritingId(null);
      }
    },
    [authFetch],
  );

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <PageTitle className="flex items-center gap-3">
            <Users className="h-7 w-7 text-primary" />
            Character Library
          </PageTitle>
          <SectionDescription className="mt-1">
            Build a cast once — each character&apos;s face, look, and voice — then reuse them
            across every video you create.
          </SectionDescription>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New Character
        </Button>
      </div>

      {errorMsg && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
          <Caption className="text-destructive">{errorMsg}</Caption>
        </div>
      )}

      {/* Grid / states */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border-strong bg-card py-20 text-center">
          <UserSquare2 className="mb-3 h-12 w-12 text-muted-foreground" />
          <SectionTitle as="h3">No characters yet</SectionTitle>
          <SectionDescription className="mt-1 max-w-md">
            Create your first character — give it a name, a face anchor photo, and a
            description of how it looks — and it becomes reusable across your videos.
          </SectionDescription>
          <Button onClick={openCreate} className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            New Character
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {profiles.map((profile) => (
            <CharacterCard
              key={profile.id}
              profile={profile}
              isArmedDelete={armedDeleteId === profile.id}
              isDeleting={deletingId === profile.id}
              isFavoriting={favoritingId === profile.id}
              onOpen={() => openEdit(profile)}
              onView={() => setViewerProfile(profile)}
              onToggleFavorite={() => {
                void toggleFavorite(profile);
              }}
              onArmDelete={() => armDelete(profile.id)}
              onCancelDelete={cancelDelete}
              onConfirmDelete={() => {
                void confirmDelete(profile.id);
              }}
            />
          ))}
        </div>
      )}

      <CharacterForm
        profile={editingProfile}
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingProfile(null);
        }}
        onSaved={handleSaved}
      />

      {viewerProfile && (
        <CharacterImageLightbox
          profile={viewerProfile}
          onClose={() => setViewerProfile(null)}
          onEdit={() => {
            const p = viewerProfile;
            setViewerProfile(null);
            openEdit(p);
          }}
        />
      )}
    </>
  );
}

// ============================================================================
// Character card
// ============================================================================

interface CharacterCardProps {
  profile: AvatarProfile;
  isArmedDelete: boolean;
  isDeleting: boolean;
  isFavoriting: boolean;
  onOpen: () => void;
  onView: () => void;
  onToggleFavorite: () => void;
  onArmDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

function CharacterCard({
  profile,
  isArmedDelete,
  isDeleting,
  isFavoriting,
  onOpen,
  onView,
  onToggleFavorite,
  onArmDelete,
  onCancelDelete,
  onConfirmDelete,
}: CharacterCardProps) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const imageCount = collectCharacterImages(profile).length;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border-strong bg-card transition-all hover:border-primary/40">
      {/* Image → opens the full-size viewer (click the picture to SEE the picture) */}
      <button
        type="button"
        onClick={onView}
        className="block w-full text-left"
        aria-label={`View ${profile.name}'s images full size`}
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-surface-elevated">
          {profile.frontalImageUrl ? (
            <Image
              src={profile.frontalImageUrl}
              alt={profile.name}
              fill
              unoptimized
              className="object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <UserSquare2 className="h-14 w-14 text-muted-foreground" />
            </div>
          )}
          {profile.isDefault && (
            <div className="absolute bottom-2 left-2 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
              Default
            </div>
          )}
          {/* Expand affordance — bottom-right, with the image count */}
          {profile.frontalImageUrl && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
              <Maximize2 className="h-3.5 w-3.5" />
              {imageCount > 1 ? `View ${imageCount}` : 'View'}
            </div>
          )}
        </div>
      </button>

      {/* Meta → opens the edit form */}
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Edit ${profile.name}`}>
        <div className="p-3">
          <CardTitle className="truncate">{profile.name}</CardTitle>
          <Caption className="mt-0.5 block">{ROLE_LABELS[profile.role]}</Caption>
          {profile.description && (
            <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
              {profile.description}
            </p>
          )}
        </div>
      </button>

      {/* Favorite star — top-left */}
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          onToggleFavorite();
        }}
        disabled={isFavoriting}
        aria-label={profile.isFavorite ? 'Unfavorite' : 'Favorite'}
        className={`absolute left-2 top-2 rounded-md p-1.5 transition-colors ${
          profile.isFavorite
            ? 'bg-primary/90 text-primary-foreground'
            : 'bg-black/45 text-white opacity-0 group-hover:opacity-100'
        }`}
      >
        {isFavoriting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Star className={`h-4 w-4 ${profile.isFavorite ? 'fill-current' : ''}`} />
        )}
      </button>

      {/* Delete — top-right (two-step) */}
      {!isArmedDelete ? (
        <button
          type="button"
          onClick={(e) => {
            stop(e);
            onArmDelete();
          }}
          aria-label="Delete character"
          className="absolute right-2 top-2 rounded-md bg-black/45 p-1.5 text-white opacity-0 transition-opacity hover:bg-destructive group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : (
        <div
          onClick={stop}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/75 p-3 text-center"
        >
          <p className="text-sm font-medium text-white">Delete this character?</p>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={onConfirmDelete}
              className="h-8 gap-1 px-2 text-xs"
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Click again to confirm
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={onCancelDelete}
              className="h-8 px-2 text-xs"
            >
              Cancel
            </Button>
          </div>
          <Caption className="text-white/70">Auto-cancels in 5 seconds</Caption>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Full-image viewer (lightbox)
// ============================================================================

interface CharacterImageLightboxProps {
  profile: AvatarProfile;
  onClose: () => void;
  onEdit: () => void;
}

function CharacterImageLightbox({ profile, onClose, onEdit }: CharacterImageLightboxProps) {
  const images = collectCharacterImages(profile);
  const [index, setIndex] = useState(0);

  const count = images.length;
  const go = useCallback(
    (delta: number) => {
      if (count === 0) {
        return;
      }
      setIndex((i) => (i + delta + count) % count);
    },
    [count],
  );

  // Keyboard: Esc closes, arrows page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        go(1);
      } else if (e.key === 'ArrowLeft') {
        go(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  const current = images[index];

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${profile.name} images`}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between gap-4 px-6 py-4 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <SectionTitle as="h2" className="truncate text-white">
            {profile.name}
          </SectionTitle>
          <Caption className="text-white/60">
            {count > 0 ? `${current?.label} · ${index + 1} of ${count}` : 'No images yet'}
          </Caption>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit} className="border-white/30 bg-transparent text-white hover:bg-white/10">
            Edit character
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            aria-label="Close"
            className="border-white/30 bg-transparent text-white hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Image stage */}
      <div className="relative flex flex-1 items-center justify-center px-4 pb-4" onClick={(e) => e.stopPropagation()}>
        {count === 0 || !current ? (
          <div className="flex flex-col items-center gap-3 text-white/60">
            <UserSquare2 className="h-16 w-16" />
            <p className="text-sm">This character has no images yet.</p>
          </div>
        ) : (
          <>
            <div className="relative h-full w-full max-w-5xl">
              <Image
                src={current.url}
                alt={`${profile.name} — ${current.label}`}
                fill
                unoptimized
                className="object-contain"
                sizes="90vw"
              />
            </div>

            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Previous image"
                  className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Next image"
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {count > 1 && (
        <div
          className="flex items-center justify-center gap-2 overflow-x-auto px-6 py-4"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, i) => (
            <button
              type="button"
              key={img.url}
              onClick={() => setIndex(i)}
              aria-label={`Show ${img.label}`}
              className={`relative h-16 w-14 flex-shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
                i === index ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <Image src={img.url} alt={img.label} fill unoptimized className="object-cover" sizes="56px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
