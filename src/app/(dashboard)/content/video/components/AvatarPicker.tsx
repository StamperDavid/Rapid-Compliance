'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { motion } from 'framer-motion';
import { User, Loader2, AlertCircle, Search, Check, Mic, Sparkles, Trash2, Video, Crown } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

// Avatar Profile shape returned by GET /api/video/avatar-profiles
interface AvatarProfileItem {
  id: string;
  name: string;
  tier: 'premium' | 'standard';
  frontalImageUrl: string;
  additionalImageUrls: string[];
  fullBodyImageUrl: string | null;
  upperBodyImageUrl: string | null;
  greenScreenClips: Array<{ id: string; script: string; duration: number }>;
  voiceId: string | null;
  voiceProvider: 'elevenlabs' | 'unrealspeech' | 'custom' | null;
  description: string | null;
  isDefault: boolean;
  createdAt: string;
}

interface AvatarPickerProps {
  selectedAvatarId: string | null;
  onSelect: (avatarId: string, avatarName: string) => void;
}

function AvatarCard({
  profile,
  isSelected,
  onSelect,
  onDelete,
  isConfirmingDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  profile: AvatarProfileItem;
  isSelected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  isConfirmingDelete?: boolean;
  onConfirmDelete?: () => void;
  onCancelDelete?: () => void;
}) {
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
      {profile.frontalImageUrl ? (
        <div className="relative w-20 h-20 rounded-full overflow-hidden ring-2 ring-green-500/40">
          <Image
            src={profile.frontalImageUrl}
            alt={profile.name}
            fill
            className="object-cover"
            sizes="80px"
            unoptimized={profile.frontalImageUrl.startsWith('data:')}
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

      {/* Metadata row */}
      <div className="flex items-center gap-1 flex-wrap justify-center">
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

      {/* Tier + default + delete badges */}
      <span className="absolute top-1.5 right-1.5 flex items-center gap-1">
        {profile.tier === 'premium' ? (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/30 text-purple-400 text-[9px] font-bold rounded">
            <Crown className="w-2.5 h-2.5" />
            PREMIUM
          </span>
        ) : (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-green-500/20 border border-green-500/30 text-green-400 text-[9px] font-bold rounded">
            <Sparkles className="w-2.5 h-2.5" />
            STANDARD
          </span>
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

export function AvatarPicker({ selectedAvatarId, onSelect }: AvatarPickerProps) {
  const authFetch = useAuthFetch();
  const [profiles, setProfiles] = useState<AvatarProfileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  const filteredProfiles = useMemo(() => {
    if (!searchQuery.trim()) { return profiles; }
    const query = searchQuery.toLowerCase();
    return profiles.filter(p =>
      p.name.toLowerCase().includes(query) ||
      (p.description?.toLowerCase().includes(query) ?? false)
    );
  }, [profiles, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading avatar profiles...</span>
      </div>
    );
  }

  if (error || profiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <AlertCircle className="w-8 h-8 text-zinc-500" />
        <p className="text-sm text-zinc-400">
          {error ?? 'No avatar profiles yet. Upload a headshot below to create one.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      {profiles.length > 3 && (
        <div className="relative">
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

      {/* Results count */}
      <p className="text-xs text-zinc-500">
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
              onSelect={() => onSelect(profile.id, profile.name)}
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
    </div>
  );
}
