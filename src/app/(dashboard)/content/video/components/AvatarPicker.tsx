'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { motion } from 'framer-motion';
import { User, Loader2, AlertCircle, Search, Check, Mic, Sparkles, Trash2, Video, Crown, Library, Star, Theater } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { HedraCharacterBrowser } from './HedraCharacterBrowser';

// Avatar Profile shape returned by GET /api/video/avatar-profiles
interface AvatarProfileItem {
  id: string;
  name: string;
  source: 'custom' | 'hedra';
  role: 'hero' | 'villain' | 'extra' | 'narrator' | 'presenter' | 'custom';
  styleTag: 'real' | 'anime' | 'stylized';
  tier: 'premium' | 'standard';
  frontalImageUrl: string;
  additionalImageUrls: string[];
  fullBodyImageUrl: string | null;
  upperBodyImageUrl: string | null;
  greenScreenClips: Array<{
    id: string;
    videoUrl: string;
    thumbnailUrl: string | null;
    script: string;
    duration: number;
    createdAt: string;
  }>;
  voiceId: string | null;
  voiceProvider: 'elevenlabs' | 'unrealspeech' | 'custom' | 'hedra' | null;
  description: string | null;
  isDefault: boolean;
  isFavorite: boolean;
  createdAt: string;
}

interface AvatarPickerProps {
  selectedAvatarId: string | null;
  onSelect: (avatarId: string, avatarName: string) => void;
  onProfileLoaded?: (profile: AvatarProfileItem) => void;
}

function AvatarCard({
  profile,
  isSelected,
  onSelect,
  onDelete,
  onToggleFavorite,
  isConfirmingDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  profile: AvatarProfileItem;
  isSelected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  onToggleFavorite?: () => void;
  isConfirmingDelete?: boolean;
  onConfirmDelete?: () => void;
  onCancelDelete?: () => void;
}) {
  const [imgError, setImgError] = useState(false);

  const referenceCount =
    (profile.additionalImageUrls?.length ?? 0) +
    (profile.fullBodyImageUrl ? 1 : 0) +
    (profile.upperBodyImageUrl ? 1 : 0);

  return (
    <motion.button
      onClick={onSelect}
      className={cn(
        'relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all',
        isSelected
          ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30'
          : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-500 hover:bg-zinc-800',
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
    >
      {/* Thumbnail */}
      {profile.frontalImageUrl && !imgError ? (
        <div className="relative w-20 h-20 rounded-full overflow-hidden ring-2 ring-green-500/40">
          <Image
            src={profile.frontalImageUrl}
            alt={profile.name}
            fill
            className="object-cover"
            sizes="80px"
            unoptimized={profile.frontalImageUrl.startsWith('data:') || profile.frontalImageUrl.includes('imagedelivery.net')}
            onError={() => setImgError(true)}
          />
        </div>
      ) : (
        <div className="w-20 h-20 rounded-full bg-zinc-700 flex items-center justify-center ring-2 ring-zinc-700/50">
          <User className="w-8 h-8 text-zinc-400" />
        </div>
      )}

      {/* Name */}
      <span className="text-xs font-medium text-zinc-200 truncate w-full text-center">
        {profile.name}
      </span>

      {/* Role + style + metadata row */}
      <div className="flex items-center gap-1 flex-wrap justify-center">
        {profile.role && profile.role !== 'presenter' && (
          <span className="px-1.5 py-0.5 bg-amber-500/10 rounded text-[10px] text-amber-300 capitalize">
            {profile.role}
          </span>
        )}
        {profile.styleTag && profile.styleTag !== 'real' && (
          <span className="px-1.5 py-0.5 bg-blue-500/10 rounded text-[10px] text-blue-300 capitalize">
            {profile.styleTag}
          </span>
        )}
        {profile.greenScreenClips?.length > 0 && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-500/10 rounded text-[10px] text-purple-300">
            <Video className="w-2.5 h-2.5" />
            {profile.greenScreenClips.length} clips
          </span>
        )}
        {referenceCount > 0 && (
          <span className="px-1.5 py-0.5 bg-zinc-700/50 rounded text-[10px] text-zinc-400">
            {referenceCount + 1} refs
          </span>
        )}
        {profile.description && (
          <span className="px-1.5 py-0.5 bg-zinc-700/50 rounded text-[10px] text-zinc-400 truncate max-w-[80px]">
            {profile.description}
          </span>
        )}
      </div>

      {/* Voice assignment indicator */}
      {profile.voiceProvider && (
        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-[10px] text-purple-300 w-full justify-center">
          <Mic className="w-2.5 h-2.5 flex-shrink-0" />
          <span className="truncate">{profile.voiceProvider}</span>
        </div>
      )}

      {/* Source + tier + action badges */}
      <span className="absolute top-1.5 right-1.5 flex items-center gap-1">
        {profile.source === 'hedra' ? (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-[9px] font-bold rounded">
            <Theater className="w-2.5 h-2.5" />
            HEDRA
          </span>
        ) : profile.tier === 'premium' ? (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/30 text-purple-400 text-[9px] font-bold rounded">
            <Crown className="w-2.5 h-2.5" />
            PREMIUM
          </span>
        ) : (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-green-500/20 border border-green-500/30 text-green-400 text-[9px] font-bold rounded">
            <Sparkles className="w-2.5 h-2.5" />
            CUSTOM
          </span>
        )}
        {onToggleFavorite && !isConfirmingDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className={cn(
              'p-1 rounded transition-colors',
              profile.isFavorite
                ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                : 'bg-zinc-700/50 border border-zinc-600/30 text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10',
            )}
            title={profile.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={cn('w-2.5 h-2.5', profile.isFavorite && 'fill-current')} />
          </button>
        )}
        {onDelete && !isConfirmingDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 bg-red-500/20 border border-red-500/30 text-red-400 rounded hover:bg-red-500/40 transition-colors"
            title="Delete profile"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        )}
      </span>

      {/* Confirm delete overlay */}
      {isConfirmingDelete && (
        <div
          className="absolute inset-0 bg-black/70 rounded-xl flex flex-col items-center justify-center gap-2 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] text-zinc-300 font-medium">Delete?</p>
          <div className="flex gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConfirmDelete?.();
              }}
              className="px-2.5 py-1 bg-red-600 text-white text-[10px] font-medium rounded hover:bg-red-500 transition-colors"
            >
              Yes
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancelDelete?.();
              }}
              className="px-2.5 py-1 bg-zinc-700 text-zinc-300 text-[10px] font-medium rounded hover:bg-zinc-600 transition-colors"
            >
              No
            </button>
          </div>
        </div>
      )}

      {/* Selected checkmark */}
      {isSelected && (
        <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
          <Check className="w-3 h-3 text-black" />
        </div>
      )}
    </motion.button>
  );
}

export function AvatarPicker({ selectedAvatarId, onSelect, onProfileLoaded }: AvatarPickerProps) {
  const authFetch = useAuthFetch();
  const [profiles, setProfiles] = useState<AvatarProfileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isHedraBrowserOpen, setIsHedraBrowserOpen] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [syncingHedra, setSyncingHedra] = useState(false);
  const hedraAutoSyncedRef = useRef(false);

  const toggleFavorite = useCallback(async (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) { return; }

    const newValue = !profile.isFavorite;

    // Optimistic update
    setProfiles((prev) =>
      prev.map((p) => (p.id === profileId ? { ...p, isFavorite: newValue } : p))
    );

    try {
      const response = await authFetch(`/api/video/avatar-profiles/${encodeURIComponent(profileId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: newValue }),
      });
      if (!response.ok) {
        // Revert on failure
        setProfiles((prev) =>
          prev.map((p) => (p.id === profileId ? { ...p, isFavorite: !newValue } : p))
        );
      }
    } catch {
      // Revert on failure
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, isFavorite: !newValue } : p))
      );
    }
  }, [profiles, authFetch]);

  const executeDelete = useCallback(async (profileId: string) => {
    setConfirmDeleteId(null);
    setDeletingId(profileId);
    try {
      const response = await authFetch(`/api/video/avatar-profiles/${encodeURIComponent(profileId)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to delete profile');
      }
      setProfiles(prev => prev.filter(p => p.id !== profileId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete profile');
    } finally {
      setDeletingId(null);
    }
  }, [authFetch]);

  const fetchProfiles = useCallback(async () => {
    try {
      const response = await authFetch('/api/video/avatar-profiles');
      if (!response.ok) {
        throw new Error('Failed to fetch avatar profiles');
      }
      const data = await response.json() as { success: boolean; profiles: AvatarProfileItem[] };
      setProfiles(data.profiles ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load avatar profiles');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  // Auto-sync all Hedra characters into avatar profiles on mount.
  // Runs once after the initial profile load completes. Any un-imported
  // Hedra characters get created as avatar profiles automatically.
  useEffect(() => {
    if (hedraAutoSyncedRef.current || isLoading) { return; }
    hedraAutoSyncedRef.current = true;

    void (async () => {
      try {
        setSyncingHedra(true);

        const response = await authFetch('/api/video/avatar-profiles/hedra-characters');
        if (!response.ok) { return; }

        const data = await response.json() as {
          success: boolean;
          characters: Array<{ id: string; alreadyImported: boolean; imageUrl: string | null }>;
        };
        if (!data.success) { return; }

        const unimported = data.characters.filter((c) => !c.alreadyImported && c.imageUrl);
        if (unimported.length === 0) { return; }

        const syncResponse = await authFetch('/api/video/avatar-profiles/sync-hedra', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ characterIds: unimported.map((c) => c.id) }),
        });
        const syncData = await syncResponse.json() as { success: boolean; imported?: number };

        if (syncData.success && syncData.imported && syncData.imported > 0) {
          await fetchProfiles();
        }
      } catch {
        // Silent — don't block the picker if Hedra sync fails
      } finally {
        setSyncingHedra(false);
      }
    })();
  }, [isLoading, authFetch, fetchProfiles]);

  const filteredProfiles = useMemo(() => {
    let result = profiles;

    if (showFavoritesOnly) {
      result = result.filter((p) => p.isFavorite);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((p) =>
        p.name.toLowerCase().includes(query) ||
        (p.description?.toLowerCase().includes(query) ?? false)
      );
    }

    return result;
  }, [profiles, searchQuery, showFavoritesOnly]);

  const favoritesCount = useMemo(() => profiles.filter((p) => p.isFavorite).length, [profiles]);

  if (isLoading || (syncingHedra && profiles.length === 0)) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">
          {syncingHedra ? 'Syncing Hedra characters...' : 'Loading avatar profiles...'}
        </span>
      </div>
    );
  }

  if (error || profiles.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <AlertCircle className="w-8 h-8 text-zinc-500" />
          <p className="text-sm text-zinc-400">
            {error ?? 'No avatar profiles yet. Upload a headshot or browse Hedra characters.'}
          </p>
          <button
            onClick={() => setIsHedraBrowserOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Library className="w-4 h-4" />
            Browse Hedra Characters
          </button>
        </div>
        <HedraCharacterBrowser
          isOpen={isHedraBrowserOpen}
          onClose={() => setIsHedraBrowserOpen(false)}
          onImportComplete={() => void fetchProfiles()}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + Favorites + Hedra row */}
      <div className="flex items-center gap-2">
        {profiles.length > 3 && (
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search profiles..."
              className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>
        )}
        {favoritesCount > 0 && (
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap',
              showFavoritesOnly
                ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                : 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-amber-500/50 hover:text-amber-400',
            )}
            title={showFavoritesOnly ? 'Show all profiles' : 'Show favorites only'}
          >
            <Star className={cn('w-3.5 h-3.5', showFavoritesOnly && 'fill-current')} />
            {favoritesCount}
          </button>
        )}
        <button
          onClick={() => setIsHedraBrowserOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 border border-zinc-700 hover:border-amber-500/50 hover:bg-zinc-700 text-zinc-300 hover:text-amber-400 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
          title="Browse and import characters from Hedra"
        >
          <Library className="w-3.5 h-3.5" />
          Browse Hedra
        </button>
      </div>

      {/* Results count */}
      <p className="text-xs text-zinc-500">
        {filteredProfiles.length} profile{filteredProfiles.length !== 1 ? 's' : ''}
        {searchQuery ? ' matching search' : ' available'}
        {syncingHedra && (
          <span className="inline-flex items-center gap-1 ml-2 text-amber-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            Syncing Hedra characters...
          </span>
        )}
      </p>

      <div className="max-h-[520px] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredProfiles.map((profile) => (
            <AvatarCard
              key={profile.id}
              profile={profile}
              isSelected={selectedAvatarId === profile.id}
              onSelect={() => {
                onSelect(profile.id, profile.name);
                onProfileLoaded?.(profile);
              }}
              onToggleFavorite={() => void toggleFavorite(profile.id)}
              onDelete={deletingId === profile.id ? undefined : () => setConfirmDeleteId(profile.id)}
              isConfirmingDelete={confirmDeleteId === profile.id}
              onConfirmDelete={() => void executeDelete(profile.id)}
              onCancelDelete={() => setConfirmDeleteId(null)}
            />
          ))}
        </div>
      </div>

      {filteredProfiles.length === 0 && searchQuery && (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <Search className="w-6 h-6 text-zinc-600" />
          <p className="text-sm text-zinc-500">No profiles match your search.</p>
        </div>
      )}

      <HedraCharacterBrowser
        isOpen={isHedraBrowserOpen}
        onClose={() => setIsHedraBrowserOpen(false)}
        onImportComplete={() => void fetchProfiles()}
      />
    </div>
  );
}
