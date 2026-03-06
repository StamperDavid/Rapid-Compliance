'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { motion } from 'framer-motion';
import { User, Loader2, AlertCircle, Search, Check } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { HeyGenAvatar } from '@/types/video';

interface AvatarPickerProps {
  selectedAvatarId: string | null;
  onSelect: (avatarId: string, avatarName: string) => void;
}

const GENDER_FILTERS = ['all', 'male', 'female'] as const;

export function AvatarPicker({ selectedAvatarId, onSelect }: AvatarPickerProps) {
  const authFetch = useAuthFetch();
  const [avatars, setAvatars] = useState<HeyGenAvatar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGender, setFilterGender] = useState<string>('all');

  const fetchAvatars = useCallback(async () => {
    try {
      const response = await authFetch('/api/video/avatars');
      if (!response.ok) {
        throw new Error('Failed to fetch avatars');
      }
      const data = await response.json() as { success: boolean; avatars: HeyGenAvatar[] };
      setAvatars(data.avatars ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load avatars');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchAvatars();
  }, [fetchAvatars]);

  const filteredAvatars = useMemo(() => {
    let result = avatars;

    if (filterGender !== 'all') {
      result = result.filter((a) => a.gender === filterGender);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(query) ||
          (a.style?.toLowerCase().includes(query) ?? false) ||
          (a.ethnicity?.toLowerCase().includes(query) ?? false),
      );
    }

    return result;
  }, [avatars, filterGender, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading avatars...</span>
      </div>
    );
  }

  if (error || avatars.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <AlertCircle className="w-8 h-8 text-zinc-500" />
        <p className="text-sm text-zinc-400">
          {error ?? 'No avatars available. Configure HeyGen API key in Settings.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + Gender Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search avatars..."
            className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>
        <div className="flex gap-1.5">
          {GENDER_FILTERS.map((gender) => (
            <button
              key={gender}
              onClick={() => setFilterGender(gender)}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                filterGender === gender
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600',
              )}
            >
              {gender.charAt(0).toUpperCase() + gender.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-zinc-500">
        {filteredAvatars.length} avatar{filteredAvatars.length !== 1 ? 's' : ''}
        {searchQuery || filterGender !== 'all' ? ' matching filters' : ' available'}
      </p>

      {/* Avatar Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[420px] overflow-y-auto pr-1">
        {filteredAvatars.map((avatar) => {
          const isSelected = selectedAvatarId === avatar.id;
          return (
            <motion.button
              key={avatar.id}
              onClick={() => onSelect(avatar.id, avatar.name)}
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
              {avatar.thumbnailUrl ? (
                <div className="relative w-20 h-20 rounded-full overflow-hidden ring-2 ring-zinc-700/50">
                  <Image
                    src={avatar.thumbnailUrl}
                    alt={avatar.name}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-zinc-700 flex items-center justify-center ring-2 ring-zinc-700/50">
                  <User className="w-8 h-8 text-zinc-400" />
                </div>
              )}

              {/* Name */}
              <span className="text-xs font-medium text-zinc-200 truncate w-full text-center">
                {avatar.name}
              </span>

              {/* Metadata */}
              <div className="flex items-center gap-1 flex-wrap justify-center">
                {avatar.gender && (
                  <span className="px-1.5 py-0.5 bg-zinc-700/50 rounded text-[10px] text-zinc-400">
                    {avatar.gender}
                  </span>
                )}
                {avatar.style && (
                  <span className="px-1.5 py-0.5 bg-zinc-700/50 rounded text-[10px] text-zinc-400">
                    {avatar.style}
                  </span>
                )}
              </div>

              {/* Custom badge */}
              {avatar.isCustom && (
                <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[9px] font-bold rounded">
                  CUSTOM
                </span>
              )}
              {/* Premium badge */}
              {!avatar.isCustom && avatar.isPremium && (
                <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] font-bold rounded">
                  PRO
                </span>
              )}

              {/* Selected checkmark */}
              {isSelected && (
                <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-black" />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {filteredAvatars.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <Search className="w-6 h-6 text-zinc-600" />
          <p className="text-sm text-zinc-500">No avatars match your search.</p>
        </div>
      )}
    </div>
  );
}
