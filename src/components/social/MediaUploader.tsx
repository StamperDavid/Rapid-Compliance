'use client';

/**
 * MediaUploader — Drag-and-drop media upload for social media posts.
 *
 * Features:
 *  - Drag-and-drop zone + click-to-browse
 *  - Upload progress bar
 *  - Image preview (thumbnail) after upload
 *  - Video filename + size after upload
 *  - Calls onUpload with the resulting URL and media type
 */

import React, { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';

type MediaType = 'image' | 'video';

interface MediaUploaderProps {
  /** Called when a file finishes uploading successfully */
  onUpload: (url: string, type: MediaType) => void;
  /** Called when media is removed */
  onRemove?: () => void;
  /** Comma-separated MIME types or file extensions (defaults to images + videos) */
  accept?: string;
  /** Maximum file size in MB (defaults to 100) */
  maxSizeMB?: number;
  /** Whether uploading is disabled */
  disabled?: boolean;
}

interface UploadedMedia {
  url: string;
  type: MediaType;
  fileName: string;
  size: number;
}

const DEFAULT_ACCEPT =
  'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaUploader({
  onUpload,
  onRemove,
  accept = DEFAULT_ACCEPT,
  maxSizeMB = 100,
  disabled = false,
}: MediaUploaderProps) {
  const { getIdToken } = useUnifiedAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia | null>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);

      // Client-side size check
      if (file.size > maxSizeBytes) {
        setError(`File is too large. Maximum size: ${maxSizeMB} MB`);
        return;
      }

      setUploading(true);
      setProgress(0);

      try {
        const token = await getIdToken();
        if (!token) {
          setError('Not authenticated. Please sign in and try again.');
          return;
        }

        const formData = new FormData();
        formData.append('file', file);

        // Use XMLHttpRequest for progress tracking
        const xhr = new XMLHttpRequest();

        const result = await new Promise<{ success: boolean; url?: string; type?: MediaType; size?: number; error?: string }>(
          (resolve, reject) => {
            xhr.upload.addEventListener('progress', (e) => {
              if (e.lengthComputable) {
                setProgress(Math.round((e.loaded / e.total) * 100));
              }
            });

            xhr.addEventListener('load', () => {
              try {
                const data = JSON.parse(xhr.responseText) as {
                  success: boolean;
                  url?: string;
                  type?: MediaType;
                  size?: number;
                  error?: string;
                };
                resolve(data);
              } catch {
                reject(new Error('Invalid response from server'));
              }
            });

            xhr.addEventListener('error', () => {
              reject(new Error('Network error during upload'));
            });

            xhr.addEventListener('abort', () => {
              reject(new Error('Upload was cancelled'));
            });

            xhr.open('POST', '/api/social/upload');
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.send(formData);
          },
        );

        if (result.success && result.url && result.type) {
          const media: UploadedMedia = {
            url: result.url,
            type: result.type,
            fileName: file.name,
            size: result.size ?? file.size,
          };
          setUploadedMedia(media);
          onUpload(result.url, result.type);
        } else {
          setError(result.error ?? 'Upload failed');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [getIdToken, maxSizeBytes, maxSizeMB, onUpload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);

      if (disabled || uploading) {
        return;
      }

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        void uploadFile(droppedFile);
      }
    },
    [disabled, uploading, uploadFile],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !uploading) {
        setDragOver(true);
      }
    },
    [disabled, uploading],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
    },
    [],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        void uploadFile(selectedFile);
      }
      // Reset the input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [uploadFile],
  );

  const handleRemove = useCallback(() => {
    setUploadedMedia(null);
    setError(null);
    setProgress(0);
    onRemove?.();
  }, [onRemove]);

  // Already uploaded — show preview
  if (uploadedMedia) {
    return (
      <div className="border border-border-strong rounded-xl p-4 bg-card">
        <div className="flex items-center gap-3">
          {uploadedMedia.type === 'image' ? (
            <Image
              src={uploadedMedia.url}
              alt={uploadedMedia.fileName}
              width={64}
              height={64}
              unoptimized
              className="w-16 h-16 object-cover rounded-lg border border-border-light"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-surface-elevated border border-border-light flex items-center justify-center text-muted-foreground">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{uploadedMedia.fileName}</p>
            <p className="text-xs text-muted-foreground">
              {uploadedMedia.type === 'image' ? 'Image' : 'Video'} — {formatFileSize(uploadedMedia.size)}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRemove}>
            Remove
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!disabled && !uploading) {
              fileInputRef.current?.click();
            }
          }
        }}
        className={[
          'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-border-light hover:border-primary/50',
          (disabled || uploading) ? 'opacity-50 cursor-not-allowed' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {uploading ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Uploading...</p>
            <div className="w-full bg-surface-elevated rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{progress}%</p>
          </div>
        ) : (
          <div className="space-y-1">
            <svg
              className="mx-auto w-8 h-8 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <p className="text-sm text-muted-foreground">
              Drag and drop an image or video, or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              JPG, PNG, GIF, WebP, MP4, MOV, WebM — up to {maxSizeMB} MB
            </p>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Select media file"
      />

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
