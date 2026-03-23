'use client';

import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useFeatureModules } from '@/hooks/useFeatureModules';
import { FEATURE_MODULES } from '@/lib/constants/feature-modules';
import {
  SLUG_TO_MODULE_ID,
  MODULE_SETTINGS,
  getModuleDefaultConfig,
  type ModuleSettingField,
} from '@/lib/constants/module-settings';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

// =============================================================================
// SETTING FIELD COMPONENT
// =============================================================================

function SettingField({
  field,
  value,
  onChange,
}: {
  field: ModuleSettingField;
  value: string | number | boolean;
  onChange: (v: string | number | boolean) => void;
}) {
  switch (field.type) {
    case 'toggle':
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, marginRight: '1rem' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>
              {field.label}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-disabled)', marginTop: '0.125rem' }}>
              {field.description}
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              style={{ width: '1.125rem', height: '1.125rem' }}
            />
          </label>
        </div>
      );

    case 'text':
      return (
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
            {field.label}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-disabled)', marginBottom: '0.5rem' }}>
            {field.description}
          </div>
          <input
            type="text"
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            placeholder={typeof field.defaultValue === 'string' ? field.defaultValue : ''}
            style={{
              width: '100%',
              padding: '0.625rem 0.75rem',
              backgroundColor: 'var(--color-bg-main)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: '0.375rem',
              color: 'var(--color-text-primary)',
              fontSize: '0.875rem',
            }}
          />
        </div>
      );

    case 'number':
      return (
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
            {field.label}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-disabled)', marginBottom: '0.5rem' }}>
            {field.description}
          </div>
          <input
            type="number"
            value={Number(value)}
            min={field.min}
            max={field.max}
            onChange={(e) => onChange(Number(e.target.value))}
            style={{
              width: '140px',
              padding: '0.625rem 0.75rem',
              backgroundColor: 'var(--color-bg-main)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: '0.375rem',
              color: 'var(--color-text-primary)',
              fontSize: '0.875rem',
            }}
          />
        </div>
      );

    case 'select':
      return (
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
            {field.label}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-disabled)', marginBottom: '0.5rem' }}>
            {field.description}
          </div>
          <select
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            style={{
              padding: '0.625rem 0.75rem',
              backgroundColor: 'var(--color-bg-main)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: '0.375rem',
              color: 'var(--color-text-primary)',
              fontSize: '0.875rem',
              minWidth: '200px',
            }}
          >
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );

    default:
      return null;
  }
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function ModuleSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { user } = useAuth();
  const { updateModule, isModuleEnabled } = useFeatureModules();

  const moduleId = SLUG_TO_MODULE_ID[slug];
  const moduleDef = FEATURE_MODULES.find((m) => m.id === moduleId);
  const settings = moduleId ? MODULE_SETTINGS[moduleId] ?? [] : [];

  const [config, setConfig] = useState<Record<string, unknown>>(() =>
    getModuleDefaultConfig(moduleId ?? ''),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Stable callback for syncing enabled state on load
  const syncEnabled = useCallback(
    (enabled: boolean) => {
      if (moduleId) {
        updateModule(moduleId, enabled);
      }
    },
    [moduleId, updateModule],
  );

  // Load config from Firestore on mount & sync enabled → feature module
  useEffect(() => {
    if (!user || !moduleId) { return; }

    const loadConfig = async () => {
      try {
        const { FirestoreService, COLLECTIONS } = await import(
          '@/lib/db/firestore-service'
        );
        const data = await FirestoreService.get(
          `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/moduleConfig`,
          moduleId,
        );

        if (data) {
          const loaded = data as Record<string, unknown>;
          setConfig((prev) => ({ ...prev, ...loaded }));
          // Reconcile: sync saved enabled state → feature module
          if (typeof loaded.enabled === 'boolean') {
            syncEnabled(loaded.enabled);
          }
        } else {
          // No saved config — reflect current feature module state
          const currentEnabled = isModuleEnabled(moduleId);
          setConfig((prev) => ({ ...prev, enabled: currentEnabled }));
        }
      } catch (error: unknown) {
        logger.error(
          'Failed to load module config',
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    };

    void loadConfig();
  }, [user, moduleId, syncEnabled, isModuleEnabled]);

  const handleSave = async () => {
    if (!user || !moduleId) { return; }

    setIsSaving(true);
    setSaveMessage('');
    try {
      const { FirestoreService, COLLECTIONS } = await import(
        '@/lib/db/firestore-service'
      );
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/moduleConfig`,
        moduleId,
        {
          ...config,
          updatedAt: new Date().toISOString(),
          updatedBy: user.id,
        },
        false,
      );

      // Sync enabled state → feature module
      updateModule(moduleId, Boolean(config.enabled));
      setSaveMessage('Settings saved successfully!');
    } catch (error: unknown) {
      logger.error(
        'Failed to save module config',
        error instanceof Error ? error : new Error(String(error)),
      );
      setSaveMessage('Failed to save. Please try again.');
    } finally {
      setTimeout(() => setIsSaving(false), 1000);
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const updateField = (key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  // --------------------------------------------------------------------------
  // 404
  // --------------------------------------------------------------------------
  if (!moduleId || !moduleDef) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1 style={{ color: 'var(--color-text-primary)', marginBottom: '1rem' }}>
          Module not found
        </h1>
        <Link href="/settings" style={{ color: 'var(--color-primary)' }}>
          ← Back to Settings
        </Link>
      </div>
    );
  }

  const enabled = Boolean(config.enabled);

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
      {/* Sticky header */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-main)',
          borderBottom: '1px solid var(--color-border-light)',
          position: 'sticky',
          top: '60px',
          zIndex: 40,
        }}
      >
        <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '1rem 2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Link
                href="/settings"
                style={{
                  color: 'var(--color-primary)',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  textDecoration: 'none',
                  display: 'inline-block',
                  marginBottom: '0.5rem',
                }}
              >
                ← Back to Settings
              </Link>
              <h1
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 'bold',
                  color: 'var(--color-text-primary)',
                  margin: 0,
                }}
              >
                {moduleDef.label}
              </h1>
              <p
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--color-text-disabled)',
                  marginTop: '0.25rem',
                }}
              >
                {moduleDef.description}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              {/* Enable / disable toggle */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1.25rem',
                  backgroundColor: enabled
                    ? 'var(--color-success-dark)'
                    : 'var(--color-bg-paper)',
                  border: '1px solid',
                  borderColor: enabled
                    ? 'var(--color-success)'
                    : 'var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => updateField('enabled', e.target.checked)}
                  style={{ width: '1.25rem', height: '1.25rem' }}
                />
                <span
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: enabled
                      ? 'var(--color-success-light)'
                      : 'var(--color-text-secondary)',
                  }}
                >
                  {enabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>

              {/* Save */}
              <button
                onClick={() => {
                  void handleSave();
                }}
                disabled={isSaving}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'var(--color-primary)',
                  color: 'white',
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  opacity: isSaving ? 0.5 : 1,
                }}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {saveMessage && (
            <div
              style={{
                marginTop: '0.5rem',
                fontSize: '0.875rem',
                color: saveMessage.includes('success')
                  ? 'var(--color-success)'
                  : 'var(--color-error)',
              }}
            >
              {saveMessage}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '2rem' }}>
        {/* Visibility info banner */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-light)',
            borderRadius: '0.75rem',
            padding: '1rem 1.5rem',
            marginBottom: '2rem',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'start',
          }}
        >
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>ℹ️</span>
          <div
            style={{
              fontSize: '0.875rem',
              color: 'var(--color-text-secondary)',
              lineHeight: '1.5',
            }}
          >
            The toggle controls <strong>sidebar visibility</strong> — when disabled,{' '}
            {moduleDef.label} nav items are hidden. The feature remains fully configured
            and can be re-enabled at any time.
          </div>
        </div>

        {/* Module-specific settings */}
        {settings.length > 0 && (
          <div
            style={{
              backgroundColor: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              marginBottom: '2rem',
            }}
          >
            <h3
              style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                color: 'var(--color-text-primary)',
                marginBottom: '1.5rem',
              }}
            >
              Settings
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {settings.map((field) => (
                <SettingField
                  key={field.key}
                  field={field}
                  value={
                    (config[field.key] as string | number | boolean) ??
                    field.defaultValue
                  }
                  onChange={(v) => updateField(field.key, v)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Required API Keys */}
        {moduleDef.requiredApiKeys.length > 0 && (
          <div
            style={{
              backgroundColor: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              marginBottom: '2rem',
            }}
          >
            <h3
              style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                color: 'var(--color-text-primary)',
                marginBottom: '1rem',
              }}
            >
              API Keys
            </h3>
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-secondary)',
                marginBottom: '1.5rem',
              }}
            >
              Configure these in{' '}
              <Link
                href="/settings/api-keys"
                style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}
              >
                Settings → API Keys
              </Link>
              .
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {moduleDef.requiredApiKeys.map((apiKey) => (
                <div
                  key={apiKey.serviceId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--color-bg-main)',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--color-border-light)',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {apiKey.label}
                    </div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--color-text-disabled)',
                      }}
                    >
                      {apiKey.description}
                    </div>
                  </div>
                  <span
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      flexShrink: 0,
                      backgroundColor:
                        apiKey.priority === 'required'
                          ? 'var(--color-error-dark)'
                          : apiKey.priority === 'recommended'
                            ? 'var(--color-warning-dark)'
                            : 'var(--color-bg-paper)',
                      color:
                        apiKey.priority === 'required'
                          ? 'var(--color-error-light)'
                          : apiKey.priority === 'recommended'
                            ? 'var(--color-warning-light)'
                            : 'var(--color-text-secondary)',
                    }}
                  >
                    {apiKey.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Included features */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-light)',
            borderRadius: '0.75rem',
            padding: '1.5rem',
          }}
        >
          <h3
            style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              color: 'var(--color-text-primary)',
              marginBottom: '1rem',
            }}
          >
            Included Features
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {moduleDef.features.map((feature) => (
              <span
                key={feature}
                style={{
                  padding: '0.375rem 0.75rem',
                  backgroundColor: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
