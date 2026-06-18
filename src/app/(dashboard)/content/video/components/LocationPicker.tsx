'use client';

/**
 * LocationPicker — pick from the operator's saved locations (digital sets).
 *
 * Mirrors AvatarPicker, but for PLACES. Lists every saved location
 * (GET /api/video/locations?scope=own) as a card with its name + a thumbnail
 * (first referenceImageUrl). Because a Shot Plan can use more than one set, the
 * picker supports MULTI-select: clicking a card toggles it in/out of the chosen
 * set, and the parent tracks the chosen location ids.
 *
 * Also exposes:
 *   - "New location" → opens the LocationForm to create a set inline
 *   - per-card edit → opens the LocationForm to edit that set
 *   - per-card two-step-confirm delete (DELETE /api/video/locations/[id])
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Button } from '@/components/ui/button';
import { Caption, SectionDescription } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import {
  MapPin,
  Loader2,
  AlertCircle,
  Search,
  Check,
  Plus,
  Pencil,
  Trash2,
  Image as ImageIcon,
  Film,
} from 'lucide-react';
import LocationForm from './LocationForm';
import type { LocationProfile, LocationsListResponse, LocationDeleteResponse } from './location-types';

// ============================================================================
// Single location card
// ============================================================================

function LocationCard({
  location,
  isSelected,
  onToggle,
  onEdit,
  onDelete,
  isConfirmingDelete,
  onConfirmDelete,
  onCancelDelete,
  isDeleting,
}: {
  location: LocationProfile;
  isSelected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isConfirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  isDeleting: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const thumb = location.referenceImageUrls[0];

  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-all',
        isSelected
          ? 'border-primary ring-1 ring-primary/30'
          : 'border-border-strong hover:border-border',
      )}
    >
      {/* Thumbnail — clicking toggles selection */}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={isSelected}
        className="relative aspect-video w-full overflow-hidden bg-surface-elevated text-left"
      >
        {thumb && !imgError ? (
          <Image
            src={thumb}
            alt={location.name}
            fill
            sizes="(max-width: 768px) 50vw, 240px"
            unoptimized
            className="object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-7 w-7" />
          </span>
        )}
        {isSelected && (
          <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
            <Check className="h-3 w-3 text-primary-foreground" />
          </span>
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
      </button>

      {/* Body */}
      <div className="flex flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {location.name}
          </p>
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${location.name}`}
              title="Edit location"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {!isConfirmingDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={isDeleting}
                aria-label={`Delete ${location.name}`}
                title="Delete location"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-destructive disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        </div>
        {location.description && (
          <Caption className="line-clamp-2">{location.description}</Caption>
        )}
        {isConfirmingDelete && (
          <div className="mt-1 flex items-center gap-1.5">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onConfirmDelete}
              className="gap-1.5 text-xs"
            >
              <Trash2 className="h-3 w-3" /> Click again to delete
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onCancelDelete} className="text-xs">
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// LocationPicker
// ============================================================================

interface LocationPickerProps {
  /** The currently-chosen location ids (multi-select). */
  selectedLocationIds: string[];
  /** Toggle one location in/out of the chosen set; receives the full profile so the
   *  caller can show a chip with the location's name + thumbnail. */
  onToggle: (location: LocationProfile) => void;
}

export function LocationPicker({ selectedLocationIds, onToggle }: LocationPickerProps) {
  const authFetch = useAuthFetch();
  const [locations, setLocations] = useState<LocationProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // null = closed; { location: null } = create; { location } = edit.
  const [formState, setFormState] = useState<{ location: LocationProfile | null } | null>(null);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await authFetch('/api/video/locations?scope=own');
      if (!res.ok) {
        throw new Error('Could not load your locations.');
      }
      const data = (await res.json()) as LocationsListResponse;
      setLocations(data.locations ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your locations.');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchLocations();
  }, [fetchLocations]);

  const executeDelete = useCallback(
    async (locationId: string) => {
      setConfirmDeleteId(null);
      setDeletingId(locationId);
      try {
        const res = await authFetch(`/api/video/locations/${encodeURIComponent(locationId)}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const data = (await res.json()) as LocationDeleteResponse;
          throw new Error(data.error ?? 'Could not delete that location.');
        }
        setLocations((prev) => prev.filter((l) => l.id !== locationId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not delete that location.');
      } finally {
        setDeletingId(null);
      }
    },
    [authFetch],
  );

  const handleSaved = useCallback(
    (saved?: LocationProfile) => {
      setFormState(null);
      if (saved) {
        // Upsert the saved location into the list, then refresh from source.
        setLocations((prev) => {
          const without = prev.filter((l) => l.id !== saved.id);
          return [saved, ...without];
        });
      }
      void fetchLocations();
    },
    [fetchLocations],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return locations;
    }
    return locations.filter(
      (l) => l.name.toLowerCase().includes(q) || l.description.toLowerCase().includes(q),
    );
  }, [locations, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading your locations…</span>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <MapPin className="h-8 w-8 text-muted-foreground" />
          <SectionDescription className="text-center">
            {error ?? 'No locations yet. Create a reusable set to use across your videos.'}
          </SectionDescription>
          <Button className="gap-2" onClick={() => setFormState({ location: null })}>
            <Plus className="h-4 w-4" /> New location
          </Button>
        </div>
        <LocationForm
          location={null}
          open={formState !== null}
          onClose={() => setFormState(null)}
          onSaved={handleSaved}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + new */}
      <div className="flex items-center gap-2">
        {locations.length > 3 && (
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search locations…"
              className="w-full rounded-lg border border-border-strong bg-surface-elevated py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}
        <Button variant="outline" size="sm" className="gap-1.5 whitespace-nowrap" onClick={() => setFormState({ location: null })}>
          <Plus className="h-3.5 w-3.5" /> New location
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <Caption>
        {filtered.length} location{filtered.length !== 1 ? 's' : ''}
        {searchQuery ? ' matching search' : ' available'}
      </Caption>

      <div className="max-h-[520px] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((location) => (
            <LocationCard
              key={location.id}
              location={location}
              isSelected={selectedLocationIds.includes(location.id)}
              onToggle={() => onToggle(location)}
              onEdit={() => setFormState({ location })}
              onDelete={() => setConfirmDeleteId(location.id)}
              isConfirmingDelete={confirmDeleteId === location.id}
              onConfirmDelete={() => void executeDelete(location.id)}
              onCancelDelete={() => setConfirmDeleteId(null)}
              isDeleting={deletingId === location.id}
            />
          ))}
        </div>
      </div>

      {filtered.length === 0 && searchQuery && (
        <div className="flex flex-col items-center justify-center gap-2 py-8">
          <Search className="h-6 w-6 text-muted-foreground" />
          <SectionDescription>No locations match your search.</SectionDescription>
        </div>
      )}

      <LocationForm
        location={formState?.location ?? null}
        open={formState !== null}
        onClose={() => setFormState(null)}
        onSaved={handleSaved}
      />
    </div>
  );
}
