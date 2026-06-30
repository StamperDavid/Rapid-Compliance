'use client';

/**
 * ImageField / ImageArrayField — image controls for the website-builder
 * PropertiesPanel. They let an operator UPLOAD a file (→ permanent Storage URL)
 * or PICK an already-uploaded asset from the media library, and keep a manual
 * URL field as a fallback. Set value is the resulting permanent URL.
 *
 * Reuses:
 *  - POST /api/website/media/upload  (upload → Storage + library catalog)
 *  - MediaLibraryPicker              (choose an existing asset)
 *
 * Styled inline to match the PropertiesPanel's dark editor theme (the panel is
 * a bespoke dark surface, not a standard dashboard page).
 */

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';

import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { MediaLibraryPicker, type LibraryAsset } from '@/components/content/MediaLibraryPicker';

const PLACEHOLDER_HOST = 'via.placeholder.com';

interface UploadResponse {
  success?: boolean;
  url?: string;
  error?: string;
}

function useImageActions(): {
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  uploadFile: (file: File) => Promise<string>;
} {
  const { getIdToken } = useUnifiedAuth();

  const authFetch = useCallback(
    async (input: string, init?: RequestInit): Promise<Response> => {
      const token = await getIdToken();
      const headers = new Headers(init?.headers);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return fetch(input, { ...init, headers });
    },
    [getIdToken],
  );

  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      const form = new FormData();
      form.append('file', file);
      form.append('name', file.name);
      const res = await authFetch('/api/website/media/upload', { method: 'POST', body: form });
      const data = (await res.json()) as UploadResponse;
      if (!res.ok || !data.success || !data.url) {
        throw new Error(data.error ?? 'Upload failed. Please try again.');
      }
      return data.url;
    },
    [authFetch],
  );

  return { authFetch, uploadFile };
}

// ---------------------------------------------------------------------------
// Single image field
// ---------------------------------------------------------------------------

interface ImageFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
}

export function ImageField({ label, value, onChange }: ImageFieldProps): React.ReactElement {
  const { authFetch, uploadFile } = useImageActions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const hasRealImage = value.length > 0 && !value.includes(PLACEHOLDER_HOST);

  const handleFile = useCallback(
    async (file: File | undefined): Promise<void> => {
      if (!file) {
        return;
      }
      setUploading(true);
      setError(null);
      try {
        const url = await uploadFile(file);
        onChange(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      } finally {
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [onChange, uploadFile],
  );

  const handlePick = useCallback(
    (assets: LibraryAsset[]): void => {
      const first = assets[0];
      if (first) {
        onChange(first.url);
      }
    },
    [onChange],
  );

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={fieldLabelStyle}>{label}</label>

      {value.length > 0 && (
        <div style={previewWrapStyle}>
          <Image
            src={value}
            alt={label}
            fill
            sizes="288px"
            unoptimized
            style={{ objectFit: 'contain' }}
          />
          {!hasRealImage && <span style={previewBadgeStyle}>Default placeholder</span>}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        onChange={(e) => void handleFile(e.target.files?.[0])}
        style={{ display: 'none' }}
      />

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{ ...actionButtonStyle, opacity: uploading ? 0.6 : 1 }}
        >
          {uploading ? 'Uploading…' : hasRealImage ? 'Replace' : 'Upload'}
        </button>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={uploading}
          style={secondaryButtonStyle}
        >
          Choose from library
        </button>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…or paste an image URL"
        style={urlInputStyle}
      />

      <MediaLibraryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handlePick}
        authFetch={authFetch}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Array of images (gallery images, logo grid, slider slides)
// ---------------------------------------------------------------------------

type ImageArrayItem = Record<string, unknown>;

interface ImageArrayFieldProps {
  label: string;
  items: ImageArrayItem[];
  /** Key inside each item that holds the image URL (e.g. 'src' or 'image'). */
  imageKey: string;
  onChange: (items: ImageArrayItem[]) => void;
}

export function ImageArrayField({
  label,
  items,
  imageKey,
  onChange,
}: ImageArrayFieldProps): React.ReactElement {
  const updateItem = useCallback(
    (index: number, key: string, value: string): void => {
      const next = items.map((item, i) => (i === index ? { ...item, [key]: value } : item));
      onChange(next);
    },
    [items, onChange],
  );

  const removeItem = useCallback(
    (index: number): void => {
      onChange(items.filter((_, i) => i !== index));
    },
    [items, onChange],
  );

  const addItem = useCallback((): void => {
    onChange([...items, { [imageKey]: '', alt: '' }]);
  }, [imageKey, items, onChange]);

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={fieldLabelStyle}>{label}</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {items.map((item, index) => {
          const rawImage = item[imageKey];
          const imageUrl = typeof rawImage === 'string' ? rawImage : '';
          // Editable string fields other than the image (e.g. alt, caption).
          const textKeys = Object.keys(item).filter(
            (k) => k !== imageKey && typeof item[k] === 'string',
          );
          return (
            <div key={index} style={arrayItemStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={arrayItemTitleStyle}>Image {index + 1}</span>
                <button type="button" onClick={() => removeItem(index)} style={removeButtonStyle}>
                  Remove
                </button>
              </div>
              <ImageField
                label="Image"
                value={imageUrl}
                onChange={(url) => updateItem(index, imageKey, url)}
              />
              {textKeys.map((k) => (
                <div key={k} style={{ marginTop: '0.4rem' }}>
                  <label style={fieldLabelStyle}>{formatLabel(k)}</label>
                  <input
                    type="text"
                    value={(item[k] as string) ?? ''}
                    onChange={(e) => updateItem(index, k, e.target.value)}
                    style={urlInputStyle}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <button type="button" onClick={addItem} style={{ ...secondaryButtonStyle, marginTop: '0.6rem', width: '100%' }}>
        + Add image
      </button>
    </div>
  );
}

/** Detect the image-URL key inside an array item, if any. */
export function detectItemImageKey(item: unknown): string | null {
  if (typeof item !== 'object' || item === null) {
    return null;
  }
  const record = item as Record<string, unknown>;
  for (const key of ['src', 'image', 'imageUrl']) {
    if (typeof record[key] === 'string') {
      return key;
    }
  }
  return null;
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

// ---------------------------------------------------------------------------
// Dark-theme inline styles (match PropertiesPanel)
// ---------------------------------------------------------------------------

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.5)',
  marginBottom: '0.25rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const previewWrapStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '120px',
  borderRadius: '6px',
  overflow: 'hidden',
  marginBottom: '0.5rem',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
};

const previewBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '0.35rem',
  left: '0.35rem',
  fontSize: '0.6rem',
  padding: '0.15rem 0.4rem',
  borderRadius: '4px',
  background: 'rgba(0,0,0,0.6)',
  color: 'rgba(255,255,255,0.8)',
};

const actionButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.45rem 0.5rem',
  border: 'none',
  borderRadius: '4px',
  background: '#6366f1',
  color: '#ffffff',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.45rem 0.5rem',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: '4px',
  background: 'transparent',
  color: 'rgba(255,255,255,0.85)',
  fontSize: '0.75rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const urlInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.45rem 0.5rem',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '4px',
  fontSize: '0.8rem',
  background: 'rgba(255,255,255,0.05)',
  color: '#ffffff',
};

const errorStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#f87171',
  marginBottom: '0.4rem',
};

const arrayItemStyle: React.CSSProperties = {
  padding: '0.6rem',
  borderRadius: '6px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.03)',
};

const arrayItemTitleStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.6)',
};

const removeButtonStyle: React.CSSProperties = {
  padding: '0.2rem 0.5rem',
  border: '1px solid rgba(248,113,113,0.4)',
  borderRadius: '4px',
  background: 'transparent',
  color: '#f87171',
  fontSize: '0.65rem',
  cursor: 'pointer',
};
