'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';

interface SwarmControlState {
  globalPause: boolean;
  pausedManagers: string[];
  updatedAt: string;
  updatedBy: string;
}

const DEPARTMENT_NAMES: Record<string, string> = {
  INTELLIGENCE_MANAGER: 'Research',
  MARKETING_MANAGER: 'Social & Marketing',
  BUILDER_MANAGER: 'Website',
  COMMERCE_MANAGER: 'E-commerce',
  OUTREACH_MANAGER: 'Email & Outreach',
  CONTENT_MANAGER: 'Content',
  ARCHITECT_MANAGER: 'Strategy',
  REVENUE_DIRECTOR: 'Sales',
  REPUTATION_MANAGER: 'Reviews & Reputation',
};

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
  const authFetch = useAuthFetch();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [swarmControl, setSwarmControl] = useState<SwarmControlState | null>(null);
  const [swarmToggling, setSwarmToggling] = useState(false);
  const [managerToggling, setManagerToggling] = useState<string | null>(null);

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

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await authFetch('/api/social/settings');
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
  }, [authFetch]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const saveSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await authFetch('/api/social/settings', {
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

  // Load swarm control state
  const loadSwarmControl = useCallback(async () => {
    try {
      const res = await authFetch('/api/orchestrator/swarm-control');
      const data = (await res.json()) as { success: boolean; state?: SwarmControlState };
      if (data.success && data.state) { setSwarmControl(data.state); }
    } catch (err) {
      logger.error('Failed to load swarm control', err instanceof Error ? err : undefined);
    }
  }, [authFetch]);

  useEffect(() => { void loadSwarmControl(); }, [loadSwarmControl]);

  const handleToggleSwarm = async () => {
    if (!swarmControl) { return; }
    setSwarmToggling(true);
    try {
      const action = swarmControl.globalPause ? 'resume_swarm' : 'pause_swarm';
      const res = await authFetch('/api/orchestrator/swarm-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as { success: boolean; state?: SwarmControlState };
      if (data.success && data.state) { setSwarmControl(data.state); }
    } catch (err) {
      logger.error('Failed to toggle swarm', err instanceof Error ? err : undefined);
    } finally {
      setSwarmToggling(false);
    }
  };

  const handleToggleManager = async (managerId: string) => {
    if (!swarmControl) { return; }
    setManagerToggling(managerId);
    try {
      const isPaused = swarmControl.pausedManagers.includes(managerId);
      const action = isPaused ? 'resume_manager' : 'pause_manager';
      const res = await authFetch('/api/orchestrator/swarm-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, managerId }),
      });
      const data = (await res.json()) as { success: boolean; state?: SwarmControlState };
      if (data.success && data.state) { setSwarmControl(data.state); }
    } catch (err) {
      logger.error('Failed to toggle manager', err instanceof Error ? err : undefined);
    } finally {
      setManagerToggling(null);
    }
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
          AI Settings
        </h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem', marginBottom: 0 }}>
          Control AI automation, set posting limits, and manage department activity
        </p>
      </div>

      {/* ── AI Department Controls ──────────────────────────────────── */}
      {swarmControl && (
        <div style={{
          backgroundColor: 'var(--color-bg-paper)',
          border: `1px solid ${swarmControl.globalPause ? 'rgba(244,67,54,0.3)' : 'var(--color-border-strong)'}`,
          borderRadius: '0.75rem',
          padding: '1.25rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                AI Departments
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem', margin: 0 }}>
                {swarmControl.globalPause
                  ? 'All AI activity is paused. Click resume to restart.'
                  : 'All departments are active. Pause individual departments below.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { void handleToggleSwarm(); }}
              disabled={swarmToggling}
              style={{
                padding: '0.5rem 1.25rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#fff',
                backgroundColor: swarmControl.globalPause ? '#4CAF50' : '#F44336',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: swarmToggling ? 'not-allowed' : 'pointer',
                opacity: swarmToggling ? 0.6 : 1,
              }}
            >
              {swarmToggling
                ? (swarmControl.globalPause ? 'Resuming...' : 'Pausing...')
                : (swarmControl.globalPause ? 'Resume All' : 'Pause All')}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {Object.entries(DEPARTMENT_NAMES).map(([managerId, displayName]) => {
              const isPaused = swarmControl.globalPause || swarmControl.pausedManagers.includes(managerId);
              const isThisToggling = managerToggling === managerId;
              return (
                <button
                  key={managerId}
                  type="button"
                  onClick={() => { void handleToggleManager(managerId); }}
                  disabled={swarmControl.globalPause || isThisToggling}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: 'var(--color-text-primary)',
                    border: `1px solid ${isPaused ? 'rgba(244,67,54,0.3)' : 'rgba(76,175,80,0.3)'}`,
                    backgroundColor: isPaused ? 'rgba(244,67,54,0.06)' : 'rgba(76,175,80,0.06)',
                    borderRadius: '0.375rem',
                    cursor: swarmControl.globalPause || isThisToggling ? 'not-allowed' : 'pointer',
                    opacity: swarmControl.globalPause ? 0.5 : 1,
                  }}
                >
                  <span>{displayName}</span>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    backgroundColor: isPaused ? '#F44336' : '#4CAF50',
                  }} />
                </button>
              );
            })}
          </div>
        </div>
      )}

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
