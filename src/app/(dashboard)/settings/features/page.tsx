'use client';

/**
 * Features & Modules Settings Page
 *
 * 4-tab consultative setup experience:
 *   1. Your Business — business profile questions
 *   2. Feature Modules — toggle which features to enable
 *   3. API Keys Setup — configure keys based on enabled features
 *   4. Summary — review everything and launch
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useFeatureModules } from '@/hooks/useFeatureModules';
import { FEATURE_MODULES, DEFAULT_FEATURE_CONFIG, getRequiredApiKeys } from '@/lib/constants/feature-modules';
import type { FeatureModuleId, BusinessProfile, RequiredApiKey } from '@/types/feature-modules';
import { FeatureModuleCard } from './components/FeatureModuleCard';
import { BusinessQuestionCard } from './components/BusinessQuestionCard';
import { ApiKeySetupCard } from './components/ApiKeySetupCard';
import { OnboardingSummary } from './components/OnboardingSummary';
import { useEntityConfig } from '@/hooks/useEntityConfig';
import { ENTITY_METADATA, ALWAYS_ON_ENTITIES } from '@/lib/constants/entity-config';
import type { EntityMetadata } from '@/types/entity-config';

// Business question definitions
const BUSINESS_QUESTIONS = [
  {
    key: 'businessModel' as const,
    question: 'What\'s your business model?',
    description: 'This helps us recommend the right features.',
    type: 'select' as const,
    options: [
      { value: 'b2b', label: 'B2B (Business to Business)' },
      { value: 'b2c', label: 'B2C (Business to Consumer)' },
      { value: 'b2b2c', label: 'B2B2C (Both)' },
      { value: 'marketplace', label: 'Marketplace / Platform' },
      { value: 'agency', label: 'Agency / Services' },
    ],
  },
  {
    key: 'teamSize' as const,
    question: 'How big is your team?',
    type: 'select' as const,
    options: [
      { value: 'solo', label: 'Just me' },
      { value: '2-5', label: '2-5 people' },
      { value: '6-20', label: '6-20 people' },
      { value: '21-50', label: '21-50 people' },
      { value: '50+', label: '50+ people' },
    ],
  },
  {
    key: 'primaryGoal' as const,
    question: 'What\'s your primary goal?',
    type: 'select' as const,
    options: [
      { value: 'generate_leads', label: 'Generate more leads' },
      { value: 'close_deals', label: 'Close more deals' },
      { value: 'automate', label: 'Automate sales processes' },
      { value: 'marketing', label: 'Improve marketing reach' },
      { value: 'ecommerce', label: 'Sell online' },
      { value: 'all_in_one', label: 'All-in-one platform' },
    ],
  },
  { key: 'sellsOnline' as const, question: 'Do you sell products or services online?', type: 'checkbox' as const },
  { key: 'usesEmail' as const, question: 'Do you send email campaigns or outbound emails?', type: 'checkbox' as const },
  { key: 'usesSocialMedia' as const, question: 'Do you actively manage social media accounts?', type: 'checkbox' as const },
  { key: 'usesVideo' as const, question: 'Do you create marketing or sales videos?', type: 'checkbox' as const },
  { key: 'needsForms' as const, question: 'Do you need forms for lead capture or surveys?', type: 'checkbox' as const },
];

const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  businessModel: '',
  teamSize: '',
  primaryGoal: '',
  sellsOnline: false,
  usesEmail: false,
  usesSocialMedia: false,
  usesVideo: false,
  needsForms: false,
};

export default function FeaturesPage() {
  const router = useRouter();
  const { config, updateAllModules, setConfig, loadConfig, initialized } = useFeatureModules();
  const { config: entityConfig, isEntityEnabled, updateEntity, loadConfig: loadEntityConfig, initialized: entityConfigInitialized } = useEntityConfig();

  const [activeTab, setActiveTab] = useState('business');
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(DEFAULT_BUSINESS_PROFILE);
  const [modules, setModules] = useState<Record<FeatureModuleId, boolean>>(
    DEFAULT_FEATURE_CONFIG.modules,
  );
  const [entityToggles, setEntityToggles] = useState<Record<string, boolean>>({});
  const [savingEntities, setSavingEntities] = useState(false);
  const [configuredKeys, setConfiguredKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);

  // Load existing entity config
  useEffect(() => {
    if (entityConfigInitialized && entityConfig) {
      setEntityToggles(entityConfig.entities);
    }
  }, [entityConfigInitialized, entityConfig]);

  // Load existing config
  useEffect(() => {
    if (initialized && config) {
      setModules(config.modules);
    }
  }, [initialized, config]);

  // Load existing business profile
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/features/business-profile');
        if (res.ok) {
          const data = (await res.json()) as { profile: BusinessProfile | null };
          if (data.profile) {
            setBusinessProfile(data.profile);
          }
        }
      } catch {
        // Ignore — default profile is fine
      }
    })();
  }, []);

  // Load configured API keys to check status
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/settings/api-keys');
        if (res.ok) {
          const data = (await res.json()) as { keys: Record<string, string> };
          const configured = new Set(
            Object.entries(data.keys)
              .filter(([, val]) => val.length > 0)
              .map(([svc]) => svc),
          );
          setConfiguredKeys(configured);
        }
      } catch {
        // Ignore
      }
    })();
  }, []);

  // Auto-suggest features based on business answers
  const applySuggestions = useCallback(() => {
    const updated = { ...modules };
    if (businessProfile.sellsOnline) { updated.ecommerce = true; }
    if (businessProfile.usesEmail) { updated.email_outreach = true; }
    if (businessProfile.usesSocialMedia) { updated.social_media = true; }
    if (businessProfile.usesVideo) { updated.video_production = true; }
    if (businessProfile.needsForms) { updated.forms_surveys = true; }
    if (businessProfile.primaryGoal === 'close_deals') {
      updated.sales_automation = true;
      updated.conversations = true;
    }
    if (businessProfile.primaryGoal === 'automate') {
      updated.workflows = true;
      updated.sales_automation = true;
    }
    if (businessProfile.primaryGoal === 'marketing') {
      updated.social_media = true;
      updated.email_outreach = true;
    }
    if (businessProfile.primaryGoal === 'all_in_one') {
      for (const key of Object.keys(updated) as FeatureModuleId[]) {
        updated[key] = true;
      }
    }
    setModules(updated);
  }, [businessProfile, modules]);

  const handleSaveBusinessProfile = async () => {
    setSaving(true);
    try {
      await fetch('/api/features/business-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(businessProfile),
      });
      applySuggestions();
      setActiveTab('modules');
    } catch {
      // Continue anyway
      setActiveTab('modules');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveModules = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/features', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules }),
      });
      if (res.ok) {
        const data = (await res.json()) as { config: { modules: Record<FeatureModuleId, boolean>; updatedAt: string; updatedBy: string } };
        setConfig(data.config);
        updateAllModules(modules);
      }
      setActiveTab('entities');
    } catch {
      setActiveTab('entities');
    } finally {
      setSaving(false);
    }
  };

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      // Save final feature config
      await fetch('/api/features', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules }),
      });
      updateAllModules(modules);
      await loadConfig();
      router.push('/dashboard');
    } catch {
      router.push('/dashboard');
    } finally {
      setLaunching(false);
    }
  };

  const requiredApiKeys = getRequiredApiKeys(modules);

  const getKeyStatus = (key: RequiredApiKey): 'configured' | 'needed' | 'optional' => {
    if (configuredKeys.has(key.serviceId)) { return 'configured'; }
    if (key.priority === 'optional') { return 'optional'; }
    return 'needed';
  };

  return (
    <div style={{ padding: '2rem', overflowY: 'auto', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
          Features & Modules
        </h1>
        <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem', margin: 0 }}>
          Tell us about your business, choose which features to enable, and set up your API keys.
        </p>
      </div>

      {/* Persistent banner */}
      <div
        style={{
          padding: '0.625rem 1rem',
          borderRadius: '0.5rem',
          backgroundColor: 'rgba(var(--color-primary-rgb), 0.06)',
          border: '1px solid rgba(var(--color-primary-rgb), 0.15)',
          marginBottom: '1.5rem',
          fontSize: '0.8125rem',
          color: 'var(--color-primary)',
        }}
      >
        Nothing is permanent — you can turn any feature on or off at any time from this page.
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList
          style={{
            display: 'flex',
            gap: '0.25rem',
            padding: '0.25rem',
            backgroundColor: 'var(--color-bg-elevated)',
            borderRadius: '0.5rem',
            border: '1px solid var(--color-border-light)',
            marginBottom: '1.5rem',
          }}
        >
          <TabsTrigger value="business" style={{ flex: 1 }}>1. Your Business</TabsTrigger>
          <TabsTrigger value="modules" style={{ flex: 1 }}>2. Features</TabsTrigger>
          <TabsTrigger value="entities" style={{ flex: 1 }}>3. CRM Entities</TabsTrigger>
          <TabsTrigger value="api-keys" style={{ flex: 1 }}>4. API Keys</TabsTrigger>
          <TabsTrigger value="summary" style={{ flex: 1 }}>5. Summary</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Your Business ──────────────────────────────────── */}
        <TabsContent value="business">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1rem' }}>
            {BUSINESS_QUESTIONS.map((q) => (
              <BusinessQuestionCard
                key={q.key}
                question={q.question}
                description={q.type === 'select' ? q.options?.[0] ? undefined : undefined : undefined}
                type={q.type}
                options={'options' in q ? q.options : undefined}
                value={businessProfile[q.key]}
                onChange={(val) =>
                  setBusinessProfile((prev) => ({ ...prev, [q.key]: val }))
                }
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => void handleSaveBusinessProfile()}
            disabled={saving}
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 2rem',
              borderRadius: '0.5rem',
              border: 'none',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save & Continue'}
          </button>
        </TabsContent>

        {/* ── Tab 2: Feature Modules ───────────────────────────────── */}
        <TabsContent value="modules">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1rem' }}>
            {FEATURE_MODULES.map((mod) => (
              <FeatureModuleCard
                key={mod.id}
                module={mod}
                enabled={modules[mod.id]}
                onToggle={(enabled) =>
                  setModules((prev) => ({ ...prev, [mod.id]: enabled }))
                }
              />
            ))}
          </div>

          {/* Always-on info */}
          <div
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              backgroundColor: 'rgba(var(--color-text-primary-rgb, 255, 255, 255), 0.03)',
              border: '1px solid var(--color-border-light)',
              fontSize: '0.8125rem',
              color: 'var(--color-text-disabled)',
            }}
          >
            <strong style={{ color: 'var(--color-text-secondary)' }}>Always on:</strong>{' '}
            Dashboard, Team, Performance, Analytics Overview, AI Workforce, and System settings are always available.
          </div>

          <button
            type="button"
            onClick={() => void handleSaveModules()}
            disabled={saving}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 2rem',
              borderRadius: '0.5rem',
              border: 'none',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save & Continue'}
          </button>
        </TabsContent>

        {/* ── Tab 3: CRM Entities ──────────────────────────────────── */}
        <TabsContent value="entities">
          {/* Always-On Entities */}
          <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Always On
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {ALWAYS_ON_ENTITIES.map((entityId) => (
              <div
                key={entityId}
                style={{
                  padding: '0.875rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--color-border-light)',
                  backgroundColor: 'var(--color-bg-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  opacity: 0.6,
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>
                  {entityId === 'leads' ? '🎯' : entityId === 'contacts' ? '👤' : entityId === 'companies' ? '🏢' : entityId === 'deals' ? '💼' : '✅'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {entityId.charAt(0).toUpperCase() + entityId.slice(1)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Core CRM — always enabled</div>
                </div>
                <span style={{ fontSize: '0.625rem', fontWeight: '600', color: 'var(--color-success)', backgroundColor: 'var(--color-success-dark)', padding: '0.125rem 0.5rem', borderRadius: '9999px', textTransform: 'uppercase' }}>
                  Locked
                </span>
              </div>
            ))}
          </div>

          {/* CRM Extended */}
          <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            CRM Extended
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {ENTITY_METADATA.filter((e) => e.tier === 'crm_extended').map((entity: EntityMetadata) => {
              const enabled = entityToggles[entity.id] ?? isEntityEnabled(entity.id);
              return (
                <div
                  key={entity.id}
                  style={{
                    padding: '0.875rem 1rem',
                    borderRadius: '0.5rem',
                    border: `1px solid ${enabled ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
                    backgroundColor: enabled ? 'rgba(var(--color-primary-rgb), 0.04)' : 'var(--color-bg-paper)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, background-color 0.2s',
                  }}
                  onClick={() => setEntityToggles((prev) => ({ ...prev, [entity.id]: !enabled }))}
                >
                  <span style={{ fontSize: '1.25rem' }}>{entity.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{entity.pluralLabel}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{entity.description}</div>
                  </div>
                  <div
                    style={{
                      width: '2.5rem',
                      height: '1.375rem',
                      borderRadius: '9999px',
                      backgroundColor: enabled ? 'var(--color-primary)' : 'var(--color-border-strong)',
                      position: 'relative',
                      transition: 'background-color 0.2s',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: '1rem',
                        height: '1rem',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        position: 'absolute',
                        top: '0.1875rem',
                        left: enabled ? '1.3125rem' : '0.1875rem',
                        transition: 'left 0.2s',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Industry-Specific */}
          <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Industry-Specific
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {ENTITY_METADATA.filter((e) => e.tier === 'industry_specific').map((entity: EntityMetadata) => {
              const enabled = entityToggles[entity.id] ?? isEntityEnabled(entity.id);
              return (
                <div
                  key={entity.id}
                  style={{
                    padding: '0.875rem 1rem',
                    borderRadius: '0.5rem',
                    border: `1px solid ${enabled ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
                    backgroundColor: enabled ? 'rgba(var(--color-primary-rgb), 0.04)' : 'var(--color-bg-paper)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, background-color 0.2s',
                  }}
                  onClick={() => setEntityToggles((prev) => ({ ...prev, [entity.id]: !enabled }))}
                >
                  <span style={{ fontSize: '1.25rem' }}>{entity.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{entity.pluralLabel}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{entity.description}</div>
                  </div>
                  <div
                    style={{
                      width: '2.5rem',
                      height: '1.375rem',
                      borderRadius: '9999px',
                      backgroundColor: enabled ? 'var(--color-primary)' : 'var(--color-border-strong)',
                      position: 'relative',
                      transition: 'background-color 0.2s',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: '1rem',
                        height: '1rem',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        position: 'absolute',
                        top: '0.1875rem',
                        left: enabled ? '1.3125rem' : '0.1875rem',
                        transition: 'left 0.2s',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              backgroundColor: 'rgba(var(--color-text-primary-rgb, 255, 255, 255), 0.03)',
              border: '1px solid var(--color-border-light)',
              fontSize: '0.8125rem',
              color: 'var(--color-text-disabled)',
              marginBottom: '1rem',
            }}
          >
            <strong style={{ color: 'var(--color-text-secondary)' }}>Platform schemas</strong>{' '}
            (activities, campaigns, workflows, etc.) are controlled by the Feature Modules tab above.
          </div>

          <button
            type="button"
            disabled={savingEntities}
            onClick={() => {
              void (async () => {
                setSavingEntities(true);
                try {
                  const res = await fetch('/api/entity-config', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ entities: entityToggles }),
                  });
                  if (res.ok) {
                    // Update store with each toggle
                    for (const [id, enabled] of Object.entries(entityToggles)) {
                      updateEntity(id, enabled);
                    }
                    await loadEntityConfig();
                  }
                  setActiveTab('api-keys');
                } catch {
                  setActiveTab('api-keys');
                } finally {
                  setSavingEntities(false);
                }
              })();
            }}
            style={{
              padding: '0.75rem 2rem',
              borderRadius: '0.5rem',
              border: 'none',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: savingEntities ? 'not-allowed' : 'pointer',
              opacity: savingEntities ? 0.7 : 1,
            }}
          >
            {savingEntities ? 'Saving...' : 'Save & Continue'}
          </button>
        </TabsContent>

        {/* ── Tab 4: API Keys Setup ────────────────────────────────── */}
        <TabsContent value="api-keys">
          {requiredApiKeys.length === 0 ? (
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'var(--color-text-disabled)',
                fontSize: '0.875rem',
              }}
            >
              No API keys needed for your enabled features. You can continue.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Required keys */}
              {requiredApiKeys.filter((k) => k.priority === 'required').length > 0 && (
                <>
                  <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '-0.5rem' }}>
                    Required
                  </h3>
                  {requiredApiKeys
                    .filter((k) => k.priority === 'required')
                    .map((key) => (
                      <ApiKeySetupCard
                        key={key.serviceId}
                        apiKey={key}
                        status={getKeyStatus(key)}
                        highlight={key.serviceId === 'openrouter'}
                        highlightMessage={
                          key.serviceId === 'openrouter'
                            ? 'This is the most important key — it powers Jasper, your AI assistant. Without it, AI features won\'t work.'
                            : undefined
                        }
                      />
                    ))}
                </>
              )}

              {/* Recommended keys */}
              {requiredApiKeys.filter((k) => k.priority === 'recommended').length > 0 && (
                <>
                  <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '-0.5rem', marginTop: '0.5rem' }}>
                    Recommended
                  </h3>
                  {requiredApiKeys
                    .filter((k) => k.priority === 'recommended')
                    .map((key) => (
                      <ApiKeySetupCard key={key.serviceId} apiKey={key} status={getKeyStatus(key)} />
                    ))}
                </>
              )}

              {/* Optional keys */}
              {requiredApiKeys.filter((k) => k.priority === 'optional').length > 0 && (
                <>
                  <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '-0.5rem', marginTop: '0.5rem' }}>
                    Optional
                  </h3>
                  {requiredApiKeys
                    .filter((k) => k.priority === 'optional')
                    .map((key) => (
                      <ApiKeySetupCard key={key.serviceId} apiKey={key} status={getKeyStatus(key)} />
                    ))}
                </>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 2rem',
              borderRadius: '0.5rem',
              border: 'none',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Continue to Summary
          </button>
        </TabsContent>

        {/* ── Tab 4: Summary ────────────────────────────────────────── */}
        <TabsContent value="summary">
          <OnboardingSummary
            modules={modules}
            businessProfile={businessProfile.businessModel ? businessProfile : null}
            configuredKeys={configuredKeys}
            onLaunch={() => void handleLaunch()}
            launching={launching}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
