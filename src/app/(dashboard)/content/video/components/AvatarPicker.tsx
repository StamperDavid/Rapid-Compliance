'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { motion } from 'framer-motion';
import { User, Loader2, AlertCircle, Search, Check, Mic, Sparkles, Trash2, Video, Crown, Star, Wand2 } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { CloneWizard } from '@/components/video/CloneWizard';

// Avatar Profile shape returned by GET /api/video/avatar-profiles
interface AvatarProfileItem {
  id: string;
  name: string;
  source: 'custom';
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
  voiceProvider: 'elevenlabs' | 'unrealspeech' | 'custom' | null;
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
          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
          : 'border-border-strong bg-surface-elevated/50 hover:border-border hover:bg-surface-elevated',
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
        <div className="w-20 h-20 rounded-full bg-border-strong flex items-center justify-center ring-2 ring-border-strong/50">
          <User className="w-8 h-8 text-muted-foreground" />
        </div>
      )}

      {/* Name */}
      <span className="text-xs font-medium text-foreground truncate w-full text-center">
        {profile.name}
      </span>

      {/* Role + style + metadata row */}
      <div className="flex items-center gap-1 flex-wrap justify-center">
        {profile.role && profile.role !== 'presenter' && (
          <span className="px-1.5 py-0.5 bg-primary/10 rounded text-[10px] text-primary-light capitalize">
            {profile.role}
          </span>
        )}
        {profile.styleTag && profile.styleTag !== 'real' && (
          <span className="px-1.5 py-0.5 bg-blue-500/10 rounded text-[10px] text-blue-300 capitalize">
            {profile.styleTag}
          </span>
        )}
        {profile.greenScreenClips?.length > 0 && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-primary/10 rounded text-[10px] text-primary-light">
            <Video className="w-2.5 h-2.5" />
            {profile.greenScreenClips.length} clips
          </span>
        )}
        {referenceCount > 0 && (
          <span className="px-1.5 py-0.5 bg-border-strong/50 rounded text-[10px] text-muted-foreground">
            {referenceCount + 1} refs
          </span>
        )}
        {profile.description && (
          <span className="px-1.5 py-0.5 bg-border-strong/50 rounded text-[10px] text-muted-foreground truncate max-w-[80px]">
            {profile.description}
          </span>
        )}
      </div>

      {/* Voice assignment indicator */}
      {profile.voiceProvider && (
        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 border border-primary/20 rounded text-[10px] text-primary-light w-full justify-center">
          <Mic className="w-2.5 h-2.5 flex-shrink-0" />
          <span className="truncate">{profile.voiceProvider}</span>
        </div>
      )}

      {/* Tier + action badges */}
      <span className="absolute top-1.5 right-1.5 flex items-center gap-1">
        {profile.tier === 'premium' ? (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-primary/20 border border-primary/30 text-primary-light text-[9px] font-bold rounded">
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
                ? 'bg-primary/20 border border-primary/30 text-primary-light'
                : 'bg-border-strong/50 border border-border/30 text-muted-foreground hover:text-primary-light hover:bg-primary/10',
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
            className="p-1 bg-destructive/20 border border-destructive/30 text-destructive rounded hover:bg-destructive/40 transition-colors"
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
          <p className="text-[10px] text-foreground font-medium">Delete?</p>
          <div className="flex gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConfirmDelete?.();
              }}
              className="px-2.5 py-1 bg-destructive text-white text-[10px] font-medium rounded hover:bg-destructive transition-colors"
            >
              Yes
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancelDelete?.();
              }}
              className="px-2.5 py-1 bg-border-strong text-foreground text-[10px] font-medium rounded hover:bg-border-strong transition-colors"
            >
              No
            </button>
          </div>
        </div>
      )}

      {/* Selected checkmark */}
      {isSelected && (
        <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
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
  const [isCloneWizardOpen, setIsCloneWizardOpen] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

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

  const handleCloneComplete = useCallback((avatarId: string, avatarName: string) => {
    onSelect(avatarId, avatarName);
    void fetchProfiles();
  }, [onSelect, fetchProfiles]);

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading avatar profiles...</span>
      </div>
    );
  }

  if (error || profiles.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <AlertCircle className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {error ?? 'No avatar profiles yet. Create your AI clone to get started.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setIsCloneWizardOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Wand2 className="w-4 h-4" />
              Create Your AI Clone
            </button>
          </div>
        </div>
        <CloneWizard
          isOpen={isCloneWizardOpen}
          onClose={() => setIsCloneWizardOpen(false)}
          onComplete={handleCloneComplete}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + Favorites + Clone row */}
      <div className="flex items-center gap-2">
        {profiles.length > 3 && (
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search profiles..."
              className="w-full pl-9 pr-3 py-2 bg-surface-elevated border border-border-strong rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        )}
        {favoritesCount > 0 && (
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap',
              showFavoritesOnly
                ? 'bg-primary/20 border border-primary/30 text-primary-light'
                : 'bg-surface-elevated border border-border-strong text-foreground hover:border-primary/50 hover:text-primary-light',
            )}
            title={showFavoritesOnly ? 'Show all profiles' : 'Show favorites only'}
          >
            <Star className={cn('w-3.5 h-3.5', showFavoritesOnly && 'fill-current')} />
            {favoritesCount}
          </button>
        )}
        <button
          onClick={() => setIsCloneWizardOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
          title="Create your AI clone with face and voice capture"
        >
          <Wand2 className="w-3.5 h-3.5" />
          Clone Yourself
        </button>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {filteredProfiles.length} profile{filteredProfiles.length !== 1 ? 's' : ''}
        {searchQuery ? ' matching search' : ' available'}
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
          <Search className="w-6 h-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No profiles match your search.</p>
        </div>
      )}

      <CloneWizard
        isOpen={isCloneWizardOpen}
        onClose={() => setIsCloneWizardOpen(false)}
        onComplete={handleCloneComplete}
      />
    </div>
  );
}
