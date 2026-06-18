'use client';

/**
 * Content Generator → Library → Locations section — the Location Library.
 *
 * Lists every saved location (digital set) as a responsive grid of cards:
 *   - first reference image thumbnail (fallback icon if none)
 *   - name + locked set description preview
 *   - reference image / video counts
 *   - two-step-confirm delete (per feedback_destructive_actions_two_step_confirmation)
 *
 * "New Location" opens the create form; clicking a card opens it for edit.
 *
 * The two-level Library nav + page padding/spacing are supplied by the parent
 * layout (`content/library/layout.tsx`); this page renders only its own content.
 *
 * Data model + API are the location service / routes (owned by a sibling agent):
 *   GET    /api/video/locations?scope=own
 *   POST   /api/video/locations
 *   PATCH  /api/video/locations/[locationId]
 *   DELETE /api/video/locations/[locationId]
 *
 * All API calls go through the auth-aware useAuthFetch hook.
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
import { MapPin, Plus, Loader2, Trash2, Image as ImageIcon, Film } from 'lucide-react';
import LocationForm from '@/app/(dashboard)/content/video/components/LocationForm';
import type {
  LocationProfile,
  LocationsListResponse,
  LocationDeleteResponse,
} from '@/app/(dashboard)/content/video/components/location-types';

// 5-second auto-disarm window per feedback_destructive_actions_two_step_confirmation
const DISARM_TIMEOUT_MS = 5000;

export default function LocationLibraryPage() {
  const authFetch = useAuthFetch();

  const [locations, setLocations] = useState<LocationProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form (create / edit)
  const [formOpen, setFormOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationProfile | null>(null);

  // Two-step delete arming
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const disarmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ───────────────────────────────────────────────────────────────
  const fetchLocations = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await authFetch('/api/video/locations?scope=own');
      if (!res.ok) {
        setErrorMsg(`Failed to load locations (${res.status})`);
        setLocations([]);
        return;
      }
      const data = (await res.json()) as LocationsListResponse;
      setLocations(data.locations ?? []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load locations');
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchLocations();
  }, [fetchLocations]);

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
    setEditingLocation(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((location: LocationProfile) => {
    setEditingLocation(location);
    setFormOpen(true);
  }, []);

  const handleSaved = useCallback(() => {
    setFormOpen(false);
    setEditingLocation(null);
    void fetchLocations();
  }, [fetchLocations]);

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
        const res = await authFetch(`/api/video/locations/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          setLocations((prev) => prev.filter((l) => l.id !== id));
        } else {
          const data = (await res.json()) as LocationDeleteResponse;
          setErrorMsg(data.error ?? 'Could not delete the location. Try again.');
        }
      } catch {
        setErrorMsg('Could not delete the location. Try again.');
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

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <PageTitle className="flex items-center gap-3">
            <MapPin className="h-7 w-7 text-primary" />
            Location Library
          </PageTitle>
          <SectionDescription className="mt-1">
            Build a set once — its layout, furniture, materials and lighting — then reuse it across
            every video so the place looks the same in every shot.
          </SectionDescription>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New Location
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
      ) : locations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border-strong bg-card py-20 text-center">
          <MapPin className="mb-3 h-12 w-12 text-muted-foreground" />
          <SectionTitle as="h3">No locations yet</SectionTitle>
          <SectionDescription className="mt-1 max-w-md">
            Create your first set — give it a name, a locked description of the room, and a few
            reference photos — and it becomes reusable across your videos.
          </SectionDescription>
          <Button onClick={openCreate} className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            New Location
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {locations.map((location) => (
            <LocationLibraryCard
              key={location.id}
              location={location}
              isArmedDelete={armedDeleteId === location.id}
              isDeleting={deletingId === location.id}
              onOpen={() => openEdit(location)}
              onArmDelete={() => armDelete(location.id)}
              onCancelDelete={cancelDelete}
              onConfirmDelete={() => {
                void confirmDelete(location.id);
              }}
            />
          ))}
        </div>
      )}

      <LocationForm
        location={editingLocation}
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingLocation(null);
        }}
        onSaved={handleSaved}
      />
    </>
  );
}

// ============================================================================
// Location card
// ============================================================================

interface LocationLibraryCardProps {
  location: LocationProfile;
  isArmedDelete: boolean;
  isDeleting: boolean;
  onOpen: () => void;
  onArmDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

function LocationLibraryCard({
  location,
  isArmedDelete,
  isDeleting,
  onOpen,
  onArmDelete,
  onCancelDelete,
  onConfirmDelete,
}: LocationLibraryCardProps) {
  const [imgError, setImgError] = useState(false);
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const thumb = location.referenceImageUrls[0];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border-strong bg-card transition-all hover:border-primary/40">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        {/* Thumbnail */}
        <div className="relative aspect-video overflow-hidden bg-surface-elevated">
          {thumb && !imgError ? (
            <Image
              src={thumb}
              alt={location.name}
              fill
              sizes="(max-width: 768px) 100vw, 320px"
              unoptimized
              className="object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <MapPin className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          {/* Counts */}
          <span className="absolute bottom-2 right-2 flex items-center gap-1.5">
            {location.referenceImageUrls.length > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
                <ImageIcon className="h-2.5 w-2.5" />
                {location.referenceImageUrls.length}
              </span>
            )}
            {location.referenceVideoUrls.length > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
                <Film className="h-2.5 w-2.5" />
                {location.referenceVideoUrls.length}
              </span>
            )}
          </span>
        </div>

        {/* Meta */}
        <div className="p-3">
          <CardTitle className="truncate">{location.name}</CardTitle>
          {location.description && (
            <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
              {location.description}
            </p>
          )}
        </div>
      </button>

      {/* Delete — top-right (two-step) */}
      {!isArmedDelete ? (
        <button
          type="button"
          onClick={(e) => {
            stop(e);
            onArmDelete();
          }}
          aria-label="Delete location"
          className="absolute right-2 top-2 rounded-md bg-black/45 p-1.5 text-white opacity-0 transition-opacity hover:bg-destructive group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : (
        <div
          onClick={stop}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/75 p-3 text-center"
        >
          <p className="text-sm font-medium text-white">Delete this location?</p>
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
