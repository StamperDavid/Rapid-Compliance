'use client';

/**
 * Onboarding Summary
 *
 * Tab 4: Final review showing enabled features, API key status,
 * and business profile summary. Includes the "Launch" button.
 */

import React from 'react';
import { Check, AlertTriangle, ArrowRight } from 'lucide-react';
import { FEATURE_MODULES, getRequiredApiKeys } from '@/lib/constants/feature-modules';
import type { FeatureModuleId, BusinessProfile, RequiredApiKey } from '@/types/feature-modules';

interface OnboardingSummaryProps {
  modules: Record<FeatureModuleId, boolean>;
  businessProfile: BusinessProfile | null;
  configuredKeys: Set<string>;
  onLaunch: () => void;
  launching: boolean;
}

export function OnboardingSummary({
  modules,
  businessProfile,
  configuredKeys,
  onLaunch,
  launching,
}: OnboardingSummaryProps) {
  const enabledModules = FEATURE_MODULES.filter((m) => modules[m.id]);
  const disabledModules = FEATURE_MODULES.filter((m) => !modules[m.id]);
  const requiredKeys = getRequiredApiKeys(modules);

  const keyStatus = (key: RequiredApiKey) => configuredKeys.has(key.serviceId);

  const allRequiredConfigured = requiredKeys
    .filter((k) => k.priority === 'required')
    .every((k) => configuredKeys.has(k.serviceId));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Enabled Features */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border-light)',
          borderRadius: '0.75rem',
          padding: '1.25rem',
        }}
      >
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.75rem' }}>
          Enabled Features ({enabledModules.length})
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {enabledModules.map((mod) => (
            <div key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Check className="w-4 h-4" style={{ color: 'var(--color-success, #22c55e)' }} />
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>{mod.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Disabled Features */}
      {disabledModules.length > 0 && (
        <div
          style={{
            backgroundColor: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-light)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
            Not Enabled ({disabledModules.length})
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-disabled)', marginBottom: '0.75rem', marginTop: 0 }}>
            Available anytime from Settings &gt; Features &amp; Modules
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {disabledModules.map((mod) => (
              <span
                key={mod.id}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.625rem',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(var(--color-text-primary-rgb, 255, 255, 255), 0.05)',
                  color: 'var(--color-text-disabled)',
                }}
              >
                {mod.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* API Key Status */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border-light)',
          borderRadius: '0.75rem',
          padding: '1.25rem',
        }}
      >
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.75rem' }}>
          API Key Status
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {requiredKeys.map((key) => (
            <div key={key.serviceId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {keyStatus(key) ? (
                <Check className="w-4 h-4" style={{ color: 'var(--color-success, #22c55e)' }} />
              ) : (
                <AlertTriangle className="w-4 h-4" style={{ color: key.priority === 'required' ? 'var(--color-error, #ef4444)' : 'var(--color-warning, #fbbf24)' }} />
              )}
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                {key.label}
              </span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>
                ({keyStatus(key) ? 'configured' : key.priority === 'required' ? 'missing' : key.priority})
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Business Profile Summary */}
      {businessProfile && (
        <div
          style={{
            backgroundColor: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-light)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.75rem' }}>
            Business Profile
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
            {businessProfile.businessModel && (
              <div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)', textTransform: 'uppercase' }}>Model</span>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', margin: 0 }}>{businessProfile.businessModel}</p>
              </div>
            )}
            {businessProfile.teamSize && (
              <div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)', textTransform: 'uppercase' }}>Team Size</span>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', margin: 0 }}>{businessProfile.teamSize}</p>
              </div>
            )}
            {businessProfile.primaryGoal && (
              <div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)', textTransform: 'uppercase' }}>Primary Goal</span>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', margin: 0 }}>{businessProfile.primaryGoal}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Warning if required keys missing */}
      {!allRequiredConfigured && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(var(--color-warning-rgb, 251, 191, 36), 0.08)',
            border: '1px solid rgba(var(--color-warning-rgb, 251, 191, 36), 0.2)',
          }}
        >
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-warning, #fbbf24)', margin: 0 }}>
            Some required API keys are not configured. Features that depend on them may not work until keys are added. You can add them later in Settings &gt; API Keys.
          </p>
        </div>
      )}

      {/* Launch Button */}
      <button
        type="button"
        onClick={onLaunch}
        disabled={launching}
        style={{
          width: '100%',
          padding: '1rem',
          borderRadius: '0.75rem',
          border: 'none',
          background: 'var(--gradient-brand, var(--color-primary))',
          color: 'white',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: launching ? 'not-allowed' : 'pointer',
          opacity: launching ? 0.7 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          transition: 'all 0.2s',
        }}
      >
        {launching ? 'Launching...' : 'Launch Your Workspace'}
        {!launching && <ArrowRight className="w-5 h-5" />}
      </button>
    </div>
  );
}
