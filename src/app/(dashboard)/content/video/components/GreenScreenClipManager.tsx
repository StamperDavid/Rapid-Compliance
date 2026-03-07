'use client';

import { useState, useRef, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
  Video,
  Upload,
  Loader2,
  Trash2,
  Plus,
  Crown,
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GreenScreenClip {
  id: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  script: string;
  duration: number;
  createdAt: string;
}

interface GreenScreenClipManagerProps {
  profileId: string;
  profileName: string;
  clips: GreenScreenClip[];
  onClipsChange: (clips: GreenScreenClip[]) => void;
}

type UploadState = 'idle' | 'uploading' | 'saving' | 'done' | 'error';

export function GreenScreenClipManager({
  profileId,
  profileName,
  clips,
  onClipsChange,
}: GreenScreenClipManagerProps) {
  const authFetch = useAuthFetch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [script, setScript] = useState('');
  const [duration, setDuration] = useState<number>(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deletingClipId, setDeletingClipId] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);

  const handleFileSelect = useCallback((file: File) => {
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    if (!validTypes.includes(file.type)) {
      setError('Use MP4, WebM, MOV, or AVI format.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('File must be under 50MB.');
      return;
    }

    setSelectedFile(file);
    setError(null);

    // Try to get video duration from the file
    const videoEl = document.createElement('video');
    videoEl.preload = 'metadata';
    videoEl.onloadedmetadata = () => {
      setDuration(Math.round(videoEl.duration));
      URL.revokeObjectURL(videoEl.src);
    };
    videoEl.src = URL.createObjectURL(file);
  }, []);

  const handleUploadClip = useCallback(async () => {
    if (!selectedFile || !script.trim()) {
      setError('Please select a video file and enter the script spoken in the clip.');
      return;
    }

    setError(null);
    setUploadState('uploading');

    try {
      // Step 1: Upload the video file
      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploadResponse = await authFetch('/api/video/avatar/upload-clip', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadResponse.json() as {
        success: boolean;
        url?: string;
        error?: string;
      };

      if (!uploadResponse.ok || !uploadData.success || !uploadData.url) {
        throw new Error(uploadData.error ?? 'Video upload failed');
      }

      // Step 2: Add clip to avatar profile
      setUploadState('saving');

      const clipResponse = await authFetch(
        `/api/video/avatar-profiles/${encodeURIComponent(profileId)}/clips`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoUrl: uploadData.url,
            thumbnailUrl: null,
            script: script.trim(),
            duration: duration || 10,
          }),
        },
      );

      const clipData = await clipResponse.json() as {
        success: boolean;
        clipId?: string;
        error?: string;
      };

      if (!clipResponse.ok || !clipData.success) {
        throw new Error(clipData.error ?? 'Failed to save clip');
      }

      // Add new clip to local state
      const newClip: GreenScreenClip = {
        id: clipData.clipId ?? crypto.randomUUID(),
        videoUrl: uploadData.url,
        thumbnailUrl: null,
        script: script.trim(),
        duration: duration || 10,
        createdAt: new Date().toISOString(),
      };

      onClipsChange([...clips, newClip]);
      setUploadState('done');
      setSelectedFile(null);
      setScript('');
      setDuration(0);
      setShowUploadForm(false);

      // Reset done state after a moment
      setTimeout(() => setUploadState('idle'), 2000);
    } catch (err) {
      setUploadState('error');
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }, [authFetch, profileId, selectedFile, script, duration, clips, onClipsChange]);

  const handleDeleteClip = useCallback(async (clipId: string) => {
    setDeletingClipId(clipId);
    try {
      const response = await authFetch(
        `/api/video/avatar-profiles/${encodeURIComponent(profileId)}/clips`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clipId }),
        },
      );

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to delete clip');
      }

      onClipsChange(clips.filter((c) => c.id !== clipId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete clip');
    } finally {
      setDeletingClipId(null);
    }
  }, [authFetch, profileId, clips, onClipsChange]);

  const isProcessing = uploadState === 'uploading' || uploadState === 'saving';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-zinc-200">
            Green Screen Clips — {profileName}
          </span>
          <span className="px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/30 text-purple-400 text-[10px] font-bold rounded">
            {clips.length} clip{clips.length !== 1 ? 's' : ''}
          </span>
        </div>
        {!showUploadForm && (
          <button
            onClick={() => setShowUploadForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 border border-purple-500/30 text-purple-300 text-xs font-medium rounded-lg hover:bg-purple-600/30 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Clip
          </button>
        )}
      </div>

      <p className="text-xs text-zinc-500">
        Upload short videos of yourself speaking on a green screen. Each clip should use a
        different script so the AI learns your speech patterns, expressions, and intonation.
        More clips = better digital avatar quality.
      </p>

      {/* Upload Form */}
      {showUploadForm && (
        <div className="p-4 bg-zinc-800/50 rounded-xl border border-purple-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-purple-300 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              New Training Clip
            </span>
            {!isProcessing && (
              <button
                onClick={() => { setShowUploadForm(false); setSelectedFile(null); setError(null); }}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                Cancel
              </button>
            )}
          </div>

          {/* File drop zone */}
          <div
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) { handleFileSelect(file); }
            }}
            onDragOver={(e) => e.preventDefault()}
            className={cn(
              'flex flex-col items-center justify-center py-6 border-2 border-dashed rounded-lg transition-colors',
              selectedFile
                ? 'border-purple-500/40 bg-purple-500/5'
                : 'border-zinc-700 cursor-pointer hover:border-purple-500/30 hover:bg-purple-500/5',
              isProcessing && 'pointer-events-none opacity-50',
            )}
          >
            {selectedFile ? (
              <div className="flex items-center gap-2 text-sm text-purple-300">
                <Video className="w-4 h-4" />
                <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                <span className="text-zinc-500">
                  ({(selectedFile.size / (1024 * 1024)).toFixed(1)}MB)
                </span>
                {duration > 0 && (
                  <span className="flex items-center gap-0.5 text-zinc-500">
                    <Clock className="w-3 h-3" />
                    {duration}s
                  </span>
                )}
              </div>
            ) : (
              <>
                <Video className="w-6 h-6 text-zinc-600 mb-1.5" />
                <p className="text-xs text-zinc-400">Drop your green screen video or click to browse</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">MP4, WebM, MOV, AVI — max 50MB</p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) { handleFileSelect(file); }
            }}
          />

          {/* Script input */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              <FileText className="w-3 h-3 inline mr-1" />
              Script spoken in this clip
            </label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Type the exact words you speak in this video clip..."
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none"
              rows={3}
              disabled={isProcessing}
            />
          </div>

          {/* Upload button */}
          <button
            onClick={() => void handleUploadClip()}
            disabled={!selectedFile || !script.trim() || isProcessing}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
              !selectedFile || !script.trim() || isProcessing
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-500',
            )}
          >
            {uploadState === 'uploading' && (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading video...
              </>
            )}
            {uploadState === 'saving' && (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving to profile...
              </>
            )}
            {uploadState === 'done' && (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                Clip added!
              </>
            )}
            {(uploadState === 'idle' || uploadState === 'error') && (
              <>
                <Upload className="w-4 h-4" />
                Upload Training Clip
              </>
            )}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 p-2 bg-red-500/5 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Clip List */}
      {clips.length > 0 ? (
        <div className="space-y-2">
          {clips.map((clip, idx) => (
            <div
              key={clip.id}
              className="flex items-start gap-3 p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/50 group"
            >
              {/* Clip number */}
              <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-purple-300">{idx + 1}</span>
              </div>

              {/* Clip info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200 line-clamp-2">{clip.script}</p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-500">
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {clip.duration}s
                  </span>
                  <span>{new Date(clip.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={() => void handleDeleteClip(clip.id)}
                disabled={deletingClipId === clip.id}
                className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                title="Remove clip"
              >
                {deletingClipId === clip.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center py-6 text-zinc-500">
          <Video className="w-8 h-8 text-zinc-700 mb-2" />
          <p className="text-xs">No training clips yet. Add your first green screen recording.</p>
        </div>
      )}

      {/* Upload State Summary */}
      {uploadState === 'done' && (
        <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <span className="text-xs text-green-300">
            Training clip added! Your avatar profile is now premium tier.
          </span>
        </div>
      )}
    </div>
  );
}
