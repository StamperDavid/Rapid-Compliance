'use client';

/**
 * Feature Module Card
 *
 * Expandable card with toggle switch for a single feature module.
 * Shows description, features, use cases, and skip warning.
 */

import React, { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { FeatureModuleDefinition } from '@/types/feature-modules';

interface FeatureModuleCardProps {
  module: FeatureModuleDefinition;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function FeatureModuleCard({ module, enabled, onToggle }: FeatureModuleCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-elevated)',
        border: `1px solid ${enabled ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
        borderRadius: '0.75rem',
        padding: '1.25rem',
        transition: 'all 0.2s ease',
        opacity: enabled ? 1 : 0.75,
      }}
    >
      {/* Header Row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              {module.label}
            </h3>
            {module.defaultEnabled && (
              <span
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  color: 'var(--color-primary)',
                  backgroundColor: 'rgba(var(--color-primary-rgb), 0.1)',
                  padding: '0.125rem 0.5rem',
                  borderRadius: '9999px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Default
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
            {module.description}
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          label={`Toggle ${module.label}`}
        />
      </div>

      {/* Expand/Collapse */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          marginTop: '0.75rem',
          padding: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.75rem',
          fontWeight: 500,
          color: 'var(--color-primary)',
        }}
      >
        {expanded ? 'Show less' : 'Learn more'}
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border-light)' }}>
          {/* Why it matters */}
          <div style={{ marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Why it matters
            </h4>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0 }}>
              {module.whyItMatters}
            </p>
          </div>

          {/* Features */}
          <div style={{ marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Features
            </h4>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              {module.features.map((f) => (
                <li key={f} style={{ marginBottom: '0.125rem' }}>{f}</li>
              ))}
            </ul>
          </div>

          {/* Use cases */}
          <div style={{ marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Best for
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {module.useCases.map((uc) => (
                <span
                  key={uc}
                  style={{
                    fontSize: '0.6875rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(var(--color-primary-rgb), 0.08)',
                    color: 'var(--color-primary)',
                  }}
                >
                  {uc}
                </span>
              ))}
            </div>
          </div>

          {/* If you skip */}
          {!enabled && (
            <div
              style={{
                padding: '0.625rem 0.75rem',
                borderRadius: '0.5rem',
                backgroundColor: 'rgba(var(--color-warning-rgb, 251, 191, 36), 0.08)',
                border: '1px solid rgba(var(--color-warning-rgb, 251, 191, 36), 0.2)',
              }}
            >
              <p style={{ fontSize: '0.75rem', color: 'var(--color-warning, #fbbf24)', margin: 0 }}>
                <strong>If you skip:</strong> {module.ifYouSkip}
              </p>
            </div>
          )}

          {/* Required API Keys */}
          {module.requiredApiKeys.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Required API Keys
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {module.requiredApiKeys.map((key) => (
                  <span
                    key={key.serviceId}
                    style={{
                      fontSize: '0.6875rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '9999px',
                      backgroundColor: key.priority === 'required'
                        ? 'rgba(var(--color-error-rgb, 239, 68, 68), 0.08)'
                        : 'rgba(var(--color-text-primary-rgb, 255, 255, 255), 0.05)',
                      color: key.priority === 'required'
                        ? 'var(--color-error, #ef4444)'
                        : 'var(--color-text-secondary)',
                    }}
                  >
                    {key.label} ({key.priority})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
