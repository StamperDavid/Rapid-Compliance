'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { motion } from 'framer-motion';
import { User, Loader2, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { HeyGenAvatar } from '@/types/video';

interface AvatarPickerProps {
  selectedAvatarId: string | null;
  onSelect: (avatarId: string, avatarName: string) => void;
}

export function AvatarPicker({ selectedAvatarId, onSelect }: AvatarPickerProps) {
  const authFetch = useAuthFetch();
  const [avatars, setAvatars] = useState<HeyGenAvatar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading avatars...</span>
      </div>
    );
  }

  if (error || avatars.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <AlertCircle className="w-6 h-6 text-zinc-500" />
        <p className="text-sm text-zinc-400">
          {error ?? 'No avatars available. Configure HeyGen API key in Settings.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-64 overflow-y-auto pr-1">
      {avatars.map((avatar) => (
        <motion.button
          key={avatar.id}
          onClick={() => onSelect(avatar.id, avatar.name)}
          className={cn(
            'relative flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-colors',
            selectedAvatarId === avatar.id
              ? 'border-amber-500 bg-amber-500/10'
              : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600',
          )}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          {avatar.thumbnailUrl ? (
            <div className="relative w-12 h-12 rounded-full overflow-hidden">
              <Image
                src={avatar.thumbnailUrl}
                alt={avatar.name}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center">
              <User className="w-6 h-6 text-zinc-400" />
            </div>
          )}
          <span className="text-xs text-zinc-300 truncate w-full text-center">{avatar.name}</span>
          {avatar.isPremium && (
            <span className="absolute top-1 right-1 px-1 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] font-medium rounded">
              PRO
            </span>
          )}
        </motion.button>
      ))}
    </div>
  );
}
