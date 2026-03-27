'use client';

/**
 * Music Library Management — Upload background music tracks to Firebase Storage.
 *
 * Displays the status of all 15 curated tracks (uploaded vs missing)
 * and provides a file upload interface for each.
 *
 * Admin-only page.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
  Music,
  Upload,
  Check,
  AlertCircle,
  RefreshCw,
  Volume2,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface TrackStatus {
  id: string;
  name: string;
  category: string;
  storagePath: string;
  durationSeconds: number;
  bpm: number;
  uploaded: boolean;
}

interface MusicStatusResponse {
  success: boolean;
  summary: { total: number; uploaded: number; missing: number };
  tracks: TrackStatus[];
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function MusicLibraryPage() {
  const authFetch = useAuthFetch();
  const [tracks, setTracks] = useState<TrackStatus[]>([]);
  const [summary, setSummary] = useState({ total: 0, uploaded: 0, missing: 0 });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/music/status');
      const json = await res.json() as MusicStatusResponse;
      if (json.success) {
        setTracks(json.tracks);
        setSummary(json.summary);
      }
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { void fetchStatus(); }, [fetchStatus]);

  const handleUpload = async (trackId: string, file: File) => {
    setUploading(trackId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('trackId', trackId);

      const res = await authFetch('/api/admin/music/upload', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        await fetchStatus();
      }
    } catch {
      // handled
    } finally {
      setUploading(null);
    }
  };

  const triggerFileInput = (trackId: string) => {
    const input = fileInputRefs.current.get(trackId);
    if (input) { input.click(); }
  };

  const categoryColors: Record<string, string> = {
    upbeat: '#22c55e',
    corporate: '#6366f1',
    chill: '#06b6d4',
    dramatic: '#ef4444',
    inspirational: '#f59e0b',
    ambient: '#8b5cf6',
  };

  if (loading) {
    return (
      <div style={{ padding: '1.5rem', maxWidth: 1200 }}>
        <div style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading music library status...
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Music className="w-6 h-6" /> Music Library
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0' }}>
            Upload royalty-free background music tracks for video assembly.
          </p>
        </div>
        <button type="button" onClick={() => { void fetchStatus(); }} style={btnSecondary}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={cardStyle}>
          <p style={cardLabel}>Total Tracks</p>
          <p style={cardValue}>{summary.total}</p>
        </div>
        <div style={cardStyle}>
          <p style={cardLabel}>Uploaded</p>
          <p style={{ ...cardValue, color: 'var(--color-success)' }}>{summary.uploaded}</p>
        </div>
        <div style={cardStyle}>
          <p style={cardLabel}>Missing</p>
          <p style={{ ...cardValue, color: summary.missing > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>{summary.missing}</p>
        </div>
      </div>

      {/* Info box */}
      <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.15)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--color-text-primary)' }}>Royalty-Free Sources:</strong>{' '}
        <a href="https://pixabay.com/music/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>Pixabay Music</a>,{' '}
        <a href="https://www.bensound.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>Bensound</a>,{' '}
        <a href="https://freemusicarchive.org/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>Free Music Archive</a>,{' '}
        <a href="https://incompetech.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>Incompetech</a>.
        {' '}Upload MP3 files (~60 seconds each) that match the BPM and mood of each track.
      </div>

      {/* Track list */}
      <div style={{ backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-light)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-bg-elevated)' }}>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Track</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Category</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>BPM</th>
              <th style={thStyle}>Storage Path</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((track) => (
              <tr key={track.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                <td style={{ ...tdStyle, width: 40 }}>
                  {track.uploaded ? (
                    <Check className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
                  ) : (
                    <AlertCircle className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
                  )}
                </td>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Volume2 className="w-3.5 h-3.5" style={{ color: 'var(--color-text-secondary)' }} />
                    {track.name}
                  </div>
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '0.125rem 0.5rem', borderRadius: '9999px',
                    fontSize: '0.6875rem', fontWeight: 600,
                    backgroundColor: `${categoryColors[track.category] ?? '#6b7280'}15`,
                    color: categoryColors[track.category] ?? '#6b7280',
                  }}>
                    {track.category}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  {track.bpm}
                </td>
                <td style={{ ...tdStyle, color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {track.storagePath}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <input
                    type="file"
                    accept="audio/*"
                    style={{ display: 'none' }}
                    ref={(el) => { if (el) { fileInputRefs.current.set(track.id, el); } }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { void handleUpload(track.id, file); }
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => triggerFileInput(track.id)}
                    disabled={uploading === track.id}
                    style={{
                      ...btnSmall,
                      opacity: uploading === track.id ? 0.6 : 1,
                      backgroundColor: track.uploaded ? 'var(--color-bg-elevated)' : 'var(--color-primary)',
                      color: track.uploaded ? 'var(--color-text-secondary)' : '#fff',
                      border: track.uploaded ? '1px solid var(--color-border-light)' : 'none',
                    }}
                  >
                    {uploading === track.id ? (
                      <><RefreshCw className="w-3 h-3 animate-spin" /> Uploading...</>
                    ) : track.uploaded ? (
                      <><Upload className="w-3 h-3" /> Replace</>
                    ) : (
                      <><Upload className="w-3 h-3" /> Upload</>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const btnSecondary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.5rem',
  padding: '0.5rem 1rem', borderRadius: '0.5rem',
  border: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '0.8125rem',
};

const btnSmall: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
  padding: '0.3125rem 0.625rem', borderRadius: '0.375rem',
  cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600,
  whiteSpace: 'nowrap',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem',
  border: '1px solid var(--color-border-light)', padding: '1rem',
};

const cardLabel: React.CSSProperties = {
  fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0,
};

const cardValue: React.CSSProperties = {
  fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0.25rem 0 0',
};

const thStyle: React.CSSProperties = {
  padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)',
};

const tdStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
};
