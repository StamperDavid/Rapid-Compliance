'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppWrapper from '@/components/custom-tools/AppWrapper';
import type { CustomTool } from '@/types/custom-tools';

/**
 * Dynamic Tool Page
 *
 * Renders a custom tool embedded in the workspace.
 * Fetches tool configuration from Firestore and displays it
 * using the AppWrapper component.
 */
export default function CustomToolPage() {
  const params = useParams();
  const router = useRouter();
  const toolId = params.toolId as string;

  const [tool, setTool] = useState<CustomTool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTool = async () => {
      try {
        const response = await fetch(`/api/custom-tools?id=${toolId}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Tool not found');
          } else {
            setError('Failed to load tool');
          }
          return;
        }

        const data = await response.json() as { tool?: CustomTool };
        const fetchedTool = data.tool;

        if (!fetchedTool) {
          setError('Tool not found');
          return;
        }

        // Check if tool is enabled
        if (fetchedTool?.enabled === false) {
          setError('This tool is currently disabled');
          return;
        }

        setTool(fetchedTool ?? null);
      } catch (err) {
        console.error('Error fetching tool:', err);
        setError('Failed to load tool');
      } finally {
        setLoading(false);
      }
    };

    void fetchTool();
  }, [toolId]);

  // Loading State
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#000',
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
        <p style={{ color: '#999', fontSize: '0.875rem' }}>Loading tool...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Error / 404 State
  if (error || !tool) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#000',
        padding: '2rem',
      }}>
        <div style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '1rem',
          padding: '3rem',
          maxWidth: '500px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>
            {error === 'Tool not found' ? '🔍' : error === 'This tool is currently disabled' ? '🚫' : '⚠️'}
          </div>
          <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            {error === 'Tool not found' ? 'Tool Not Found' : error === 'This tool is currently disabled' ? 'Tool Disabled' : 'Error'}
          </h1>
          <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {error === 'Tool not found'
              ? 'The custom tool you are looking for does not exist or has been removed.'
              : error === 'This tool is currently disabled'
                ? 'This tool has been temporarily disabled by an administrator.'
                : error ?? 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => router.push(`/dashboard`)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Render Tool
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: '100vh',
      backgroundColor: '#000',
    }}>
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1.5rem',
        backgroundColor: '#0a0a0a',
        borderBottom: '1px solid #1a1a1a',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '1.5rem' }}>{tool.icon}</span>
        <div>
          <h1 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600' }}>{tool.name}</h1>
          <p style={{ color: '#666', fontSize: '0.75rem' }}>
            {new URL(tool.url).hostname}
          </p>
        </div>
      </div>

      {/* App Content */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <AppWrapper
          url={tool.url}
          name={tool.name}
          onError={(error) => console.error('AppWrapper error:', error)}
        />
      </div>
    </div>
  );
}
