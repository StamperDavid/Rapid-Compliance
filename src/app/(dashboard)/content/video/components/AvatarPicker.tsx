'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { motion } from 'framer-motion';
import { User, Loader2, AlertCircle, Search, Check, Mic, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { HeyGenAvatar } from '@/types/video';

interface AvatarPickerProps {
  selectedAvatarId: string | null;
  onSelect: (avatarId: string, avatarName: string) => void;
}

const GENDER_FILTERS = ['all', 'male', 'female'] as const;

function AvatarCard({
  avatar,
  isSelected,
  onSelect,
}: {
  avatar: HeyGenAvatar;
  isSelected: boolean;
  onSelect: () => void;
}) {
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
      {avatar.thumbnailUrl ? (
        <div className={cn(
          'relative w-20 h-20 rounded-full overflow-hidden ring-2',
          avatar.isCustom ? 'ring-green-500/40' : 'ring-zinc-700/50',
        )}>
          <Image
            src={avatar.thumbnailUrl}
            alt={avatar.name}
            fill
            className="object-cover"
            sizes="80px"
            unoptimized={avatar.thumbnailUrl.startsWith('data:')}
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

      {/* Metadata row */}
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

      {/* Voice assignment indicator */}
      {avatar.assignedVoiceName && (
        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-[10px] text-purple-300 w-full justify-center">
          <Mic className="w-2.5 h-2.5 flex-shrink-0" />
          <span className="truncate">{avatar.assignedVoiceName}</span>
        </div>
      )}

      {/* Custom badge */}
      {avatar.isCustom && (
        <span className="absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 bg-green-500/20 border border-green-500/30 text-green-400 text-[9px] font-bold rounded">
          <Sparkles className="w-2.5 h-2.5" />
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
}

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

  // Split into custom vs stock
  const { customAvatars, stockAvatars } = useMemo(() => {
    let custom = avatars.filter(a => a.isCustom);
    let stock = avatars.filter(a => !a.isCustom);

    if (filterGender !== 'all') {
      custom = custom.filter(a => !a.gender || a.gender === filterGender);
      stock = stock.filter(a => a.gender === filterGender);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchFn = (a: HeyGenAvatar) =>
        a.name.toLowerCase().includes(query) ||
        (a.style?.toLowerCase().includes(query) ?? false) ||
        (a.ethnicity?.toLowerCase().includes(query) ?? false) ||
        (a.assignedVoiceName?.toLowerCase().includes(query) ?? false);
      custom = custom.filter(matchFn);
      stock = stock.filter(matchFn);
    }

    return { customAvatars: custom, stockAvatars: stock };
  }, [avatars, filterGender, searchQuery]);

  const totalFiltered = customAvatars.length + stockAvatars.length;

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
        {totalFiltered} avatar{totalFiltered !== 1 ? 's' : ''}
        {searchQuery || filterGender !== 'all' ? ' matching filters' : ' available'}
        {customAvatars.length > 0 ? ` (${customAvatars.length} custom)` : ''}
      </p>

      <div className="max-h-[520px] overflow-y-auto pr-1 space-y-6">
        {/* Custom Avatars Section */}
        {customAvatars.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-lg">
                <Sparkles className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs font-semibold text-green-400">Your Avatars</span>
              </div>
              <div className="flex-1 h-px bg-zinc-700/50" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {customAvatars.map((avatar) => (
                <AvatarCard
                  key={avatar.id}
                  avatar={avatar}
                  isSelected={selectedAvatarId === avatar.id}
                  onSelect={() => onSelect(avatar.id, avatar.name)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Stock Avatars Section */}
        {stockAvatars.length > 0 && (
          <div>
            {customAvatars.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium text-zinc-500 px-2.5 py-1">Stock Avatars</span>
                <div className="flex-1 h-px bg-zinc-700/50" />
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {stockAvatars.map((avatar) => (
                <AvatarCard
                  key={avatar.id}
                  avatar={avatar}
                  isSelected={selectedAvatarId === avatar.id}
                  onSelect={() => onSelect(avatar.id, avatar.name)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {totalFiltered === 0 && (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <Search className="w-6 h-6 text-zinc-600" />
          <p className="text-sm text-zinc-500">No avatars match your search.</p>
        </div>
      )}
    </div>
  );
}
