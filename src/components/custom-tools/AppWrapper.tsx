'use client';

import React, { useState, useCallback } from 'react';
import { validateToolUrl } from '@/types/custom-tools';

interface AppWrapperProps {
  url: string;
  name: string;
  onError?: (error: string) => void;
}

/**
 * AppWrapper Component
 *
 * Renders external apps/tools in a secure, sandboxed iframe.
 * Features:
 * - Sandboxed iframe with restricted permissions
 * - Loading state with spinner
 * - Error handling for failed loads
 * - Full height rendering
 */
export default function AppWrapper({ url, name, onError }: AppWrapperProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Validate URL before rendering
  const validation = validateToolUrl(url);

  const handleLoad = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  const handleError = useCallback(() => {
    setLoading(false);
    const errorMsg = 'Failed to load the external application. The URL may be inaccessible or blocking iframe embedding.';
    setError(errorMsg);
    onError?.(errorMsg);
  }, [onError]);

  // Show error if URL is invalid
  if (!validation.valid) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: '400px',
        backgroundColor: '#0a0a0a',
        padding: '2rem',
      }}>
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '1rem',
          padding: '2rem',
          maxWidth: '500px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
            ⚠️
          </div>
          <h2 style={{ color: '#ef4444', fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            Invalid URL
          </h2>
          <p style={{ color: '#999', fontSize: '0.875rem' }}>
            {validation.error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      minHeight: 'calc(100vh - 60px)',
      backgroundColor: '#0a0a0a',
    }}>
      {/* Loading Overlay */}
      {loading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          zIndex: 10,
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid #333',
            borderTopColor: '#6366f1',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '1rem',
          }} />
          <p style={{ color: '#999', fontSize: '0.875rem' }}>
            Loading {name}...
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          padding: '2rem',
          zIndex: 10,
        }}>
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '1rem',
            padding: '2rem',
            maxWidth: '500px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
              ❌
            </div>
            <h2 style={{ color: '#ef4444', fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Failed to Load
            </h2>
            <p style={{ color: '#999', fontSize: '0.875rem', marginBottom: '1rem' }}>
              {error}
            </p>
            <p style={{ color: '#666', fontSize: '0.75rem' }}>
              URL: {url}
            </p>
            <button
              onClick={() => {
                setLoading(true);
                setError(null);
              }}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#333',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Sandboxed Iframe */}
      <iframe
        src={url}
        title={name}
        sandbox="allow-scripts allow-same-origin allow-forms"
        referrerPolicy="no-referrer"
        onLoad={handleLoad}
        onError={handleError}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 'calc(100vh - 60px)',
          border: 'none',
          backgroundColor: '#fff',
          opacity: loading || error ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out',
        }}
        allow="clipboard-write"
      />
    </div>
  );
}
