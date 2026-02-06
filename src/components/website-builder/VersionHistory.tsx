/**
 * Version History Panel
 * Display page version history and allow restoration
 */

'use client';

import { useState, useEffect } from 'react';
import type { PageSection } from '@/types/website';

interface PageSEO {
  title?: string;
  description?: string;
  keywords?: string[];
}

interface FirebaseTimestamp {
  toDate?: () => Date;
  seconds?: number;
}

interface PageVersion {
  id: string;
  version: number;
  content: PageSection[];
  seo: PageSEO;
  title: string;
  slug: string;
  status: string;
  createdAt: FirebaseTimestamp | Date | string;
  createdBy: string;
}

interface VersionsResponse {
  versions: PageVersion[];
}

interface VersionHistoryProps {
  pageId: string;
  organizationId: string;
  onRestore: (version: PageVersion) => void;
  onClose: () => void;
}

export default function VersionHistory({
  pageId,
  organizationId,
  onRestore,
  onClose,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<PageVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);

  useEffect(() => {
    void loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, organizationId]);

  async function loadVersions() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/website/pages/${pageId}/versions`
      );

      if (!response.ok) {
        throw new Error('Failed to load version history');
      }

      const data = (await response.json()) as VersionsResponse;
      setVersions(data.versions ?? []);
    } catch (err) {
      console.error('[Version History] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load versions');
    } finally {
      setLoading(false);
    }
  }

  function handleRestore(version: PageVersion) {
    // eslint-disable-next-line no-alert
    const confirmed = window.confirm(`Restore to Version ${version.version}? Current changes will become a new version.`);
    if (!confirmed) {
      return;
    }

    try {
      setRestoring(version.version);

      // Call the parent's restore handler
      onRestore(version);

      // Close the panel after successful restore
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err) {
      console.error('[Version History] Restore error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      // eslint-disable-next-line no-alert
      window.alert(`Failed to restore version: ${errorMessage}`);
    } finally {
      setRestoring(null);
    }
  }

  function formatDate(timestamp: FirebaseTimestamp | Date | string): string {
    if (!timestamp) {
      return 'Unknown';
    }

    let date: Date;
    const ts = timestamp as FirebaseTimestamp;
    if (ts.toDate) {
      date = ts.toDate();
    } else if (ts.seconds) {
      date = new Date(ts.seconds * 1000);
    } else {
      date = new Date(timestamp as Date | string);
    }

    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '400px',
        background: 'white',
        boxShadow: '-4px 0 8px rgba(0,0,0,0.1)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827' }}>
          Version History
        </h2>
        <button
          onClick={onClose}
          style={{
            padding: '0.5rem',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.5rem',
            color: '#6b7280',
            lineHeight: 1,
          }}
          title="Close"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
            Loading versions...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '1rem',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#991b1b',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && versions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: '#6b7280', marginBottom: '0.5rem' }}>
              No version history yet
            </p>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
              Versions are created when you publish changes
            </p>
          </div>
        )}

        {!loading && !error && versions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {versions.map((version) => (
              <div
                key={version.id}
                style={{
                  padding: '1rem',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              >
                {/* Version Header */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: '#3498db',
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                    }}
                  >
                    v{version.version}
                  </div>
                  <div
                    style={{
                      marginLeft: '0.5rem',
                      padding: '0.25rem 0.5rem',
                      background: version.status === 'published' ? '#27ae60' : '#95a5a6',
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    {version.status}
                  </div>
                </div>

                {/* Version Info */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontWeight: '500', color: '#111827', marginBottom: '0.25rem' }}>
                    {version.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    /{version.slug}
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.75rem' }}>
                  {formatDate(version.createdAt)}
                  <br />
                  By {version.createdBy}
                </div>

                {/* Restore Button */}
                <button
                  onClick={() => {
                    handleRestore(version);
                  }}
                  disabled={restoring === version.version}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: restoring === version.version ? '#95a5a6' : '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: restoring === version.version ? 'not-allowed' : 'pointer',
                  }}
                >
                  {restoring === version.version ? 'Restoring...' : '↶ Restore This Version'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


