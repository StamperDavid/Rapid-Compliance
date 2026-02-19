'use client';

import { useState, useEffect } from 'react';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import SubpageNav from '@/components/ui/SubpageNav';

const SOCIAL_NAV_ITEMS = [
  { label: 'Command Center', href: '/social/command-center' },
  { label: 'Campaigns', href: '/social/campaigns' },
  { label: 'Calendar', href: '/social/calendar' },
  { label: 'Approvals', href: '/social/approvals' },
  { label: 'Listening', href: '/social/listening' },
  { label: 'Activity', href: '/social/activity' },
  { label: 'Agent Rules', href: '/social/agent-rules' },
  { label: 'Playbook', href: '/social/playbook' },
];

interface AutonomousAgentSettings {
  agentEnabled: boolean;
  velocityLimits: Record<string, number>;
  sentimentBlockKeywords: string[];
  escalationTriggerKeywords: string[];
  recycleCooldownDays: number;
  maxDailyPosts: number;
  pauseOnWeekends: boolean;
  autoApprovalEnabled: boolean;
}

const ACTION_TYPES = [
  { key: 'POST', label: 'Posts per hour' },
  { key: 'REPLY', label: 'Replies per hour' },
  { key: 'LIKE', label: 'Likes per hour' },
  { key: 'FOLLOW', label: 'Follows per hour' },
  { key: 'REPOST', label: 'Reposts per hour' },
  { key: 'RECYCLE', label: 'Recycles per hour' },
];

export default function AgentRulesPage() {
  const { user: _user } = useUnifiedAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [config, setConfig] = useState<AutonomousAgentSettings>({
    agentEnabled: false,
    velocityLimits: {
      POST: 5,
      REPLY: 10,
      LIKE: 20,
      FOLLOW: 5,
      REPOST: 8,
      RECYCLE: 3,
    },
    sentimentBlockKeywords: [],
    escalationTriggerKeywords: [],
    recycleCooldownDays: 30,
    maxDailyPosts: 20,
    pauseOnWeekends: false,
    autoApprovalEnabled: false,
  });

  const [newBlockKeyword, setNewBlockKeyword] = useState('');
  const [newEscalationKeyword, setNewEscalationKeyword] = useState('');

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/social/settings');
      const data = await response.json() as { success: boolean; config?: AutonomousAgentSettings; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to load settings');
      }

      if (data.config) {
        setConfig(data.config);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/social/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await response.json() as { success: boolean; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to save settings');
      }

      setSuccessMessage('Settings saved successfully');
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateVelocityLimit = (actionType: string, value: number) => {
    setConfig(prev => ({
      ...prev,
      velocityLimits: {
        ...prev.velocityLimits,
        [actionType]: value,
      },
    }));
  };

  const addBlockKeyword = () => {
    const trimmed = newBlockKeyword.trim();
    if (trimmed && !config.sentimentBlockKeywords.includes(trimmed)) {
      setConfig(prev => ({
        ...prev,
        sentimentBlockKeywords: [...prev.sentimentBlockKeywords, trimmed],
      }));
      setNewBlockKeyword('');
    }
  };

  const removeBlockKeyword = (keyword: string) => {
    setConfig(prev => ({
      ...prev,
      sentimentBlockKeywords: prev.sentimentBlockKeywords.filter(k => k !== keyword),
    }));
  };

  const addEscalationKeyword = () => {
    const trimmed = newEscalationKeyword.trim();
    if (trimmed && !config.escalationTriggerKeywords.includes(trimmed)) {
      setConfig(prev => ({
        ...prev,
        escalationTriggerKeywords: [...prev.escalationTriggerKeywords, trimmed],
      }));
      setNewEscalationKeyword('');
    }
  };

  const removeEscalationKeyword = (keyword: string) => {
    setConfig(prev => ({
      ...prev,
      escalationTriggerKeywords: prev.escalationTriggerKeywords.filter(k => k !== keyword),
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
          Loading agent rules...
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
          Agent Rules
        </h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem', marginBottom: 0 }}>
          Configure guardrails and limits for the autonomous posting agent
        </p>
      </div>

      <SubpageNav items={SOCIAL_NAV_ITEMS} />

      {error && (
        <div
          style={{
            backgroundColor: 'var(--color-bg-paper)',
            border: '1px solid var(--color-warning)',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1rem',
            color: 'var(--color-warning)',
            fontSize: '0.8125rem',
          }}
        >
          {error}
        </div>
      )}

      {successMessage && (
        <div
          style={{
            backgroundColor: 'var(--color-bg-paper)',
            border: '1px solid var(--color-success)',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1rem',
            color: 'var(--color-success)',
            fontSize: '0.8125rem',
          }}
        >
          {successMessage}
        </div>
      )}

      {/* General Settings */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border-light)',
          padding: '1.25rem',
          marginBottom: '1rem',
        }}
      >
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 1rem 0' }}>
          General Settings
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={config.agentEnabled}
              onChange={(e) => {
                setConfig(prev => ({ ...prev, agentEnabled: e.target.checked }));
              }}
              style={{ cursor: 'pointer', width: '1rem', height: '1rem' }}
            />
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-primary)' }}>
              Agent Enabled
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={config.autoApprovalEnabled}
              onChange={(e) => {
                setConfig(prev => ({ ...prev, autoApprovalEnabled: e.target.checked }));
              }}
              style={{ cursor: 'pointer', width: '1rem', height: '1rem' }}
            />
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-primary)' }}>
              Auto-Approval Enabled
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={config.pauseOnWeekends}
              onChange={(e) => {
                setConfig(prev => ({ ...prev, pauseOnWeekends: e.target.checked }));
              }}
              style={{ cursor: 'pointer', width: '1rem', height: '1rem' }}
            />
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-primary)' }}>
              Pause on Weekends
            </span>
          </label>
        </div>
      </div>

      {/* Velocity Limits */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border-light)',
          padding: '1.25rem',
          marginBottom: '1rem',
        }}
      >
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 1rem 0' }}>
          Velocity Limits
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          {ACTION_TYPES.map(({ key, label }) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                {label}
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={config.velocityLimits[key] || 0}
                onChange={(e) => {
                  updateVelocityLimit(key, parseInt(e.target.value, 10) || 0);
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.8125rem',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '0.375rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Daily Limits */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border-light)',
          padding: '1.25rem',
          marginBottom: '1rem',
        }}
      >
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 1rem 0' }}>
          Daily Limits
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
              Max Daily Posts (1-50)
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={config.maxDailyPosts}
              onChange={(e) => {
                setConfig(prev => ({ ...prev, maxDailyPosts: parseInt(e.target.value, 10) || 1 }));
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '0.8125rem',
                border: '1px solid var(--color-border-light)',
                borderRadius: '0.375rem',
                backgroundColor: 'var(--color-bg-paper)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
              Recycle Cooldown (days, 1-365)
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={config.recycleCooldownDays}
              onChange={(e) => {
                setConfig(prev => ({ ...prev, recycleCooldownDays: parseInt(e.target.value, 10) || 1 }));
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '0.8125rem',
                border: '1px solid var(--color-border-light)',
                borderRadius: '0.375rem',
                backgroundColor: 'var(--color-bg-paper)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Sentiment Block Keywords */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border-light)',
          padding: '1.25rem',
          marginBottom: '1rem',
        }}
      >
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 0.5rem 0' }}>
          Sentiment Block Keywords
        </h2>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: '1rem' }}>
          Block auto-replies if these keywords are detected
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            value={newBlockKeyword}
            onChange={(e) => {
              setNewBlockKeyword(e.target.value);
            }}
            onKeyDown={(e) => {
              handleKeyDown(e, addBlockKeyword);
            }}
            placeholder="Add keyword..."
            style={{
              flex: 1,
              padding: '0.5rem',
              fontSize: '0.8125rem',
              border: '1px solid var(--color-border-light)',
              borderRadius: '0.375rem',
              backgroundColor: 'var(--color-bg-paper)',
              color: 'var(--color-text-primary)',
            }}
          />
          <button
            type="button"
            onClick={addBlockKeyword}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.8125rem',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Add
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {config.sentimentBlockKeywords.length === 0 ? (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
              No keywords added
            </span>
          ) : (
            config.sentimentBlockKeywords.map((keyword) => (
              <div
                key={keyword}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.375rem 0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  color: 'var(--color-text-primary)',
                }}
              >
                <span>{keyword}</span>
                <button
                  type="button"
                  onClick={() => {
                    removeBlockKeyword(keyword);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '1rem',
                    lineHeight: 1,
                  }}
                  aria-label="Remove keyword"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Escalation Trigger Keywords */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border-light)',
          padding: '1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 0.5rem 0' }}>
          Escalation Trigger Keywords
        </h2>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: '1rem' }}>
          Trigger human approval if these keywords are detected
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            value={newEscalationKeyword}
            onChange={(e) => {
              setNewEscalationKeyword(e.target.value);
            }}
            onKeyDown={(e) => {
              handleKeyDown(e, addEscalationKeyword);
            }}
            placeholder="Add keyword..."
            style={{
              flex: 1,
              padding: '0.5rem',
              fontSize: '0.8125rem',
              border: '1px solid var(--color-border-light)',
              borderRadius: '0.375rem',
              backgroundColor: 'var(--color-bg-paper)',
              color: 'var(--color-text-primary)',
            }}
          />
          <button
            type="button"
            onClick={addEscalationKeyword}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.8125rem',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Add
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {config.escalationTriggerKeywords.length === 0 ? (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
              No keywords added
            </span>
          ) : (
            config.escalationTriggerKeywords.map((keyword) => (
              <div
                key={keyword}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.375rem 0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  color: 'var(--color-text-primary)',
                }}
              >
                <span>{keyword}</span>
                <button
                  type="button"
                  onClick={() => {
                    removeEscalationKeyword(keyword);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '1rem',
                    lineHeight: 1,
                  }}
                  aria-label="Remove keyword"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => {
            void saveSettings();
          }}
          disabled={saving}
          style={{
            padding: '0.75rem 2rem',
            fontSize: '0.8125rem',
            backgroundColor: saving ? 'var(--color-text-disabled)' : 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontWeight: 600,
          }}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
