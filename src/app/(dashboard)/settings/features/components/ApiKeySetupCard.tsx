'use client';

/**
 * API Key Setup Card
 *
 * Shows a single API key input with test button and status indicator.
 * Saves directly to /api/settings/api-keys (same as the Settings > API Keys page).
 */

import React, { useState } from 'react';
import { ExternalLink, Check, AlertTriangle, Circle, Loader2 } from 'lucide-react';
import type { RequiredApiKey } from '@/types/feature-modules';

interface ApiKeySetupCardProps {
  apiKey: RequiredApiKey;
  /** Current status: configured | needed | optional */
  status: 'configured' | 'needed' | 'optional';
  /** Highlight — e.g. for the Jasper key */
  highlight?: boolean;
  highlightMessage?: string;
}

export function ApiKeySetupCard({
  apiKey,
  status,
  highlight,
  highlightMessage,
}: ApiKeySetupCardProps) {
  const [keyValue, setKeyValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [localStatus, setLocalStatus] = useState(status);
  const [message, setMessage] = useState('');

  const handleSave = async () => {
    if (!keyValue.trim()) { return; }
    setSaving(true);
    setMessage('');

    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: apiKey.serviceId, key: keyValue.trim() }),
      });

      if (res.ok) {
        setLocalStatus('configured');
        setMessage('Saved');
        setKeyValue('');
      } else {
        const errorData = (await res.json()) as { error?: { message?: string } };
        setMessage(errorData.error?.message ?? 'Failed to save');
      }
    } catch {
      setMessage('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage('');

    try {
      const res = await fetch(`/api/settings/api-keys/test?service=${apiKey.serviceId}`);
      if (res.ok) {
        setMessage('Key is valid');
        setLocalStatus('configured');
      } else {
        const data = (await res.json()) as { error?: string };
        setMessage(data.error ?? 'Test failed');
      }
    } catch {
      setMessage('Network error');
    } finally {
      setTesting(false);
    }
  };

  const statusIcon = () => {
    switch (localStatus) {
      case 'configured':
        return <Check className="w-4 h-4" style={{ color: 'var(--color-success, #22c55e)' }} />;
      case 'needed':
        return <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-warning, #fbbf24)' }} />;
      case 'optional':
        return <Circle className="w-4 h-4" style={{ color: 'var(--color-text-disabled)' }} />;
    }
  };

  const priorityColor = apiKey.priority === 'required'
    ? 'var(--color-error, #ef4444)'
    : apiKey.priority === 'recommended'
      ? 'var(--color-warning, #fbbf24)'
      : 'var(--color-text-disabled)';

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-elevated)',
        border: `1px solid ${highlight ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
        borderRadius: '0.75rem',
        padding: '1.25rem',
        ...(highlight ? { boxShadow: '0 0 0 1px rgba(var(--color-primary-rgb), 0.3)' } : {}),
      }}
    >
      {/* Highlight callout */}
      {highlight && highlightMessage && (
        <div
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            backgroundColor: 'rgba(var(--color-primary-rgb), 0.08)',
            marginBottom: '0.75rem',
            fontSize: '0.75rem',
            fontWeight: 500,
            color: 'var(--color-primary)',
          }}
        >
          {highlightMessage}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            {statusIcon()}
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              {apiKey.label}
            </h4>
            <span
              style={{
                fontSize: '0.625rem',
                fontWeight: 700,
                padding: '0.125rem 0.375rem',
                borderRadius: '9999px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: priorityColor,
                backgroundColor: `color-mix(in srgb, ${priorityColor} 10%, transparent)`,
              }}
            >
              {apiKey.priority}
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0 }}>
            {apiKey.description}
          </p>
        </div>
        <a
          href={apiKey.setupUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.75rem',
            fontWeight: 500,
            color: 'var(--color-primary)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Get your key <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Input + Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <input
          type="password"
          value={keyValue}
          onChange={(e) => setKeyValue(e.target.value)}
          placeholder={localStatus === 'configured' ? 'Key configured — paste to replace' : 'Paste your API key'}
          style={{
            flex: 1,
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--color-border-light)',
            backgroundColor: 'var(--color-bg-paper)',
            color: 'var(--color-text-primary)',
            fontSize: '0.8125rem',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !keyValue.trim()}
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            border: 'none',
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            fontSize: '0.8125rem',
            fontWeight: 500,
            cursor: saving || !keyValue.trim() ? 'not-allowed' : 'pointer',
            opacity: saving || !keyValue.trim() ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
        </button>
        {localStatus === 'configured' && (
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={testing}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--color-border-light)',
              backgroundColor: 'transparent',
              color: 'var(--color-text-secondary)',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: testing ? 'not-allowed' : 'pointer',
              opacity: testing ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Test'}
          </button>
        )}
      </div>

      {/* Status message */}
      {message && (
        <p
          style={{
            fontSize: '0.75rem',
            marginTop: '0.375rem',
            color: message.includes('valid') || message === 'Saved'
              ? 'var(--color-success, #22c55e)'
              : 'var(--color-error, #ef4444)',
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
