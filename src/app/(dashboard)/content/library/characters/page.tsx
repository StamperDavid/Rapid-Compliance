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
  onToggleFavorite,
  onArmDelete,
  onCancelDelete,
  onConfirmDelete,
}: CharacterCardProps) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border-strong bg-card transition-all hover:border-primary/40">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        {/* Full character image — shown WHOLE (contain), never cropped, so the full
            body is visible right on the card. */}
        <div className="relative aspect-[4/5] overflow-hidden bg-surface-elevated">
          {profile.frontalImageUrl ? (
            <Image
              src={profile.frontalImageUrl}
              alt={profile.name}
              fill
              unoptimized
              className="object-contain"
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
        </div>

        {/* Meta */}
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
