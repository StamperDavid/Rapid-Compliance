'use client';

import { useState, useRef, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Upload, Loader2, CheckCircle2, AlertCircle, X, ImageIcon } from 'lucide-react';
import Image from 'next/image';

interface AvatarUploadProps {
  onAvatarCreated: (avatarId: string, avatarName: string) => void;
}

type UploadPhase = 'idle' | 'uploading' | 'creating' | 'done' | 'error';

type CharacterRole = 'hero' | 'villain' | 'extra' | 'narrator' | 'presenter' | 'custom';
type CharacterStyleTag = 'real' | 'anime' | 'stylized';

export function AvatarUpload({ onAvatarCreated }: AvatarUploadProps) {
  const authFetch = useAuthFetch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [avatarName, setAvatarName] = useState('My Character');
  const [role, setRole] = useState<CharacterRole>('presenter');
  const [styleTag, setStyleTag] = useState<CharacterStyleTag>('real');

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, WebP)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB for avatar photos');
      return;
    }

    setError(null);
    setPhase('uploading');

    // Show local preview
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    try {
      // Step 1: Upload photo to Firestore (gets public URL)
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await authFetch('/api/video/avatar/upload-photo', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadResponse.json() as { success: boolean; url?: string; error?: string };

      if (!uploadResponse.ok || !uploadData.success || !uploadData.url) {
        throw new Error(uploadData.error ?? 'Photo upload failed');
      }

      // Step 2: Create an Avatar Profile with the uploaded photo
      setPhase('creating');

      const name = avatarName.trim() || 'My Character';
      const createResponse = await authFetch('/api/video/avatar-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          frontalImageUrl: uploadData.url,
          source: 'custom',
          role,
          styleTag,
          isDefault: true,
        }),
      });

      const createData = await createResponse.json() as {
        success: boolean;
        profile?: { id: string };
        error?: string;
      };

      if (!createResponse.ok || !createData.success || !createData.profile) {
        throw new Error(createData.error ?? 'Avatar profile creation failed');
      }

      setPhase('done');
      onAvatarCreated(createData.profile.id, name);
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Failed to create avatar');
    }
  }, [authFetch, avatarName, role, styleTag, onAvatarCreated]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      void handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const reset = () => {
    setPreviewUrl(null);
    setPhase('idle');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isProcessing = phase === 'uploading' || phase === 'creating';

  return (
    <div className="p-5 bg-zinc-800/30 rounded-xl border border-zinc-700/50 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
        <Upload className="w-4 h-4 text-amber-500" />
        Create Character
      </div>

      <p className="text-xs text-zinc-500">
        Upload a reference photo for your character. Set their role and style, then assign a voice in the Voice tab.
      </p>

      {/* Character Name */}
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Character Name</label>
        <input
          type="text"
          value={avatarName}
          onChange={(e) => setAvatarName(e.target.value)}
          placeholder="e.g., SalesVelocity Hero"
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          disabled={isProcessing}
        />
      </div>

      {/* Role + Style Tag */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as CharacterRole)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            disabled={isProcessing}
          >
            <option value="presenter">Presenter</option>
            <option value="hero">Hero</option>
            <option value="villain">Villain</option>
            <option value="narrator">Narrator</option>
            <option value="extra">Extra</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Style</label>
          <select
            value={styleTag}
            onChange={(e) => setStyleTag(e.target.value as CharacterStyleTag)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            disabled={isProcessing}
          >
            <option value="real">Real / Photorealistic</option>
            <option value="anime">Anime</option>
            <option value="stylized">Stylized</option>
          </select>
        </div>
      </div>

      {/* Photo Drop Zone or Preview */}
      {previewUrl ? (
        <div className="relative flex items-center gap-3 p-3 bg-zinc-900/50 rounded-lg border border-zinc-700">
          <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
            <Image
              src={previewUrl}
              alt="Avatar photo"
              fill
              className="object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            {phase === 'uploading' && (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <p className="text-xs text-amber-300">Uploading photo...</p>
              </div>
            )}
            {phase === 'creating' && (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <p className="text-xs text-amber-300">Creating avatar... This may take a moment.</p>
              </div>
            )}
            {phase === 'done' && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                <p className="text-xs text-green-300">Avatar created! Training may take a few minutes.</p>
              </div>
            )}
            {phase === 'error' && (
              <p className="text-xs text-red-400">{error}</p>
            )}
          </div>
          {!isProcessing && (
            <button
              onClick={reset}
              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-amber-500/30 hover:bg-amber-500/5 transition-colors"
        >
          <ImageIcon className="w-8 h-8 text-zinc-600 mb-2" />
          <p className="text-sm text-zinc-400">Drop your headshot here or click to browse</p>
          <p className="text-xs text-zinc-600 mt-1">JPG, PNG, or WebP — max 2MB. Avatar is created automatically.</p>
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

      {/* Error display (for non-preview states) */}
      {error && !previewUrl && (
        <div className="flex items-center gap-2 text-xs text-red-400 p-2 bg-red-500/5 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
