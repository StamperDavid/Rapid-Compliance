'use client';

import { useState, useRef, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Upload, Loader2, CheckCircle2, AlertCircle, X, ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

interface AvatarUploadProps {
  onAvatarCreated: (avatarId: string, avatarName: string) => void;
}

export function AvatarUpload({ onAvatarCreated }: AvatarUploadProps) {
  const authFetch = useAuthFetch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [avatarName, setAvatarName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [inputMode, setInputMode] = useState<'upload' | 'url'>('upload');

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, WebP)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10MB');
      return;
    }

    setError(null);
    setIsUploading(true);

    // Show local preview immediately
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    try {
      // Upload to our API which stores in Firebase Storage
      const formData = new FormData();
      formData.append('file', file);

      const response = await authFetch('/api/video/avatar/upload-photo', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json() as { success: boolean; url?: string; error?: string };

      if (!response.ok || !data.success || !data.url) {
        throw new Error(data.error ?? 'Upload failed');
      }

      setPhotoUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setPreviewUrl(null);
      setPhotoUrl('');
    } finally {
      setIsUploading(false);
    }
  }, [authFetch]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      void handleFileSelect(file);
    }
  }, [handleFileSelect]);

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

  const clearPhoto = () => {
    setPhotoUrl('');
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-5 bg-zinc-800/30 rounded-xl border border-zinc-700/50 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
          <Upload className="w-4 h-4 text-amber-500" />
          Create Custom Avatar
        </div>
        {/* Toggle between upload and URL */}
        <div className="flex gap-1 p-0.5 bg-zinc-800/50 rounded-lg">
          <button
            onClick={() => setInputMode('upload')}
            className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
              inputMode === 'upload'
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Upload Photo
          </button>
          <button
            onClick={() => setInputMode('url')}
            className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
              inputMode === 'url'
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Paste URL
          </button>
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        Use a clear, well-lit headshot photo. HeyGen will create an Instant Avatar that you can use in your videos.
      </p>

      <div className="space-y-3">
        {/* Photo Input */}
        {inputMode === 'upload' ? (
          <div>
            {previewUrl || photoUrl ? (
              <div className="relative flex items-center gap-3 p-3 bg-zinc-900/50 rounded-lg border border-zinc-700">
                <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                  <Image
                    src={previewUrl ?? photoUrl}
                    alt="Avatar photo"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-300 truncate">
                    {isUploading ? 'Uploading...' : 'Photo ready'}
                  </p>
                  {isUploading && (
                    <div className="mt-1 h-1 bg-zinc-700 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full animate-pulse w-2/3" />
                    </div>
                  )}
                </div>
                <button
                  onClick={clearPhoto}
                  className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-zinc-500 transition-colors"
              >
                <ImageIcon className="w-8 h-8 text-zinc-600 mb-2" />
                <p className="text-sm text-zinc-400">Drop a photo here or click to browse</p>
                <p className="text-xs text-zinc-600 mt-1">JPG, PNG, or WebP — max 10MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void handleFileSelect(file);
                }
              }}
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Photo URL</label>
            <input
              type="url"
              value={photoUrl}
              onChange={(e) => { setPhotoUrl(e.target.value); setPreviewUrl(e.target.value || null); }}
              placeholder="https://example.com/your-headshot.jpg"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              disabled={isCreating}
            />
          </div>
        )}

        {/* Avatar Name */}
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
        <div className="flex items-center gap-2 text-xs text-red-400 p-2 bg-red-500/5 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-xs text-green-400 p-2 bg-green-500/5 rounded-lg">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          Avatar created! It may take a few minutes to finish training.
        </div>
      )}

      <Button
        onClick={() => { void handleCreate(); }}
        disabled={!photoUrl || !avatarName || isCreating || isUploading}
        size="sm"
        className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white"
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
