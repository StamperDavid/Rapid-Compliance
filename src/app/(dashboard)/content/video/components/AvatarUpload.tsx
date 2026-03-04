'use client';

import { useState } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AvatarUploadProps {
  onAvatarCreated: (avatarId: string, avatarName: string) => void;
}

export function AvatarUpload({ onAvatarCreated }: AvatarUploadProps) {
  const authFetch = useAuthFetch();
  const [photoUrl, setPhotoUrl] = useState('');
  const [avatarName, setAvatarName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleCreate = async () => {
    if (!photoUrl || !avatarName) { return; }

    setIsCreating(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await authFetch('/api/video/avatar/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl, avatarName }),
      });

      const data = await response.json() as {
        success: boolean;
        avatarId?: string;
        error?: string;
      };

      if (!response.ok || !data.success || !data.avatarId) {
        throw new Error(data.error ?? 'Failed to create avatar');
      }

      setSuccess(true);
      onAvatarCreated(data.avatarId, avatarName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create avatar');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
        <Upload className="w-4 h-4 text-amber-500" />
        Create Custom Avatar from Photo
      </div>

      <p className="text-xs text-zinc-500">
        Provide a URL to a clear, well-lit headshot photo. HeyGen will create an
        Instant Avatar that you can use in your videos. Training takes a few minutes.
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Photo URL</label>
          <input
            type="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://example.com/your-headshot.jpg"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            disabled={isCreating}
          />
        </div>

        <div>
          <label className="block text-xs text-zinc-400 mb-1">Avatar Name</label>
          <input
            type="text"
            value={avatarName}
            onChange={(e) => setAvatarName(e.target.value)}
            placeholder="e.g., David - Casual"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            disabled={isCreating}
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-xs text-green-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Avatar created! It may take a few minutes to finish training.
        </div>
      )}

      <Button
        onClick={() => { void handleCreate(); }}
        disabled={!photoUrl || !avatarName || isCreating}
        size="sm"
        className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
      >
        {isCreating ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Creating Avatar...
          </>
        ) : (
          <>
            <Upload className="w-3.5 h-3.5" />
            Create Avatar
          </>
        )}
      </Button>
    </div>
  );
}
