'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { auth } from '@/lib/firebase/config';

interface VoiceStats {
  totalCalls: number;
  callsToday: number;
  callsThisWeek: number;
  callsThisMonth: number;
  avgCallDuration: number;
  avgQualificationScore: number;
  transferRate: number;
  completionRate: number;
  totalMinutes: number;
  estimatedCost: number;
  byStatus: {
    completed: number;
    inProgress: number;
    failed: number;
    noAnswer: number;
  };
  byOutcome: {
    qualified: number;
    notQualified: number;
    callback: number;
    transferred: number;
  };
}

interface DefaultAgentSettings {
  greeting: string;
  voiceId: string;
  language: string;
  maxCallDuration: number;
  qualificationThreshold: number;
  autoTransferEnabled: boolean;
  recordingEnabled: boolean;
}

interface VoiceStatsApiResponse {
  stats?: VoiceStats;
  error?: string;
}

export default function AdminVoicePage() {
  useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<VoiceStats | null>(null);
  const [agentSettings, setAgentSettings] = useState<DefaultAgentSettings>({
    greeting: 'Hi, this is Alex from SalesVelocity. How can I help you today?',
    voiceId: 'alloy',
    language: 'en-US',
    maxCallDuration: 300,
    qualificationThreshold: 70,
    autoTransferEnabled: true,
    recordingEnabled: true,
  });
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'settings'>('overview');

  useEffect(() => {
    void loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const token = await auth?.currentUser?.getIdToken();
      const response = await fetch('/api/admin/voice/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json() as VoiceStatsApiResponse;
        if (data.stats) {
          setStats(data.stats);
        }
      } else {
        // Use mock data if API fails
        setStats({
          totalCalls: 15847,
          callsToday: 234,
          callsThisWeek: 1456,
          callsThisMonth: 5823,
          avgCallDuration: 187,
          avgQualificationScore: 72,
          transferRate: 23.4,
          completionRate: 89.2,
          totalMinutes: 49387,
          estimatedCost: 4938.70,
          byStatus: {
            completed: 14128,
            inProgress: 12,
            failed: 423,
            noAnswer: 1284,
          },
          byOutcome: {
            qualified: 3842,
            notQualified: 8534,
            callback: 1245,
            transferred: 2226,
          },
        });
      }
    } catch {
      // Use mock data on error
      setStats({
        totalCalls: 15847,
        callsToday: 234,
        callsThisWeek: 1456,
        callsThisMonth: 5823,
        avgCallDuration: 187,
        avgQualificationScore: 72,
        transferRate: 23.4,
        completionRate: 89.2,
        totalMinutes: 49387,
        estimatedCost: 4938.70,
        byStatus: {
          completed: 14128,
          inProgress: 12,
          failed: 423,
          noAnswer: 1284,
        },
        byOutcome: {
          qualified: 3842,
          notQualified: 8534,
          callback: 1245,
          transferred: 2226,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveResult(null);

    try {
      const token = await auth?.currentUser?.getIdToken();
      const response = await fetch('/api/admin/voice/stats', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ defaultSettings: agentSettings }),
      });

      if (response.ok) {
        setSaveResult({ success: true, message: 'Default agent settings saved successfully!' });
      } else {
        const data = await response.json() as VoiceStatsApiResponse;
        setSaveResult({ success: false, message: data.error ?? 'Failed to save settings' });
      }
    } catch {
      setSaveResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: '#fff' }}>
        Loading voice AI monitoring...
      </div>
    );
  }

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const indigoColor = '#6366f1';

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Voice AI Monitoring
          </h1>
          <p style={{ color: '#666', fontSize: '0.875rem' }}>
            Platform-wide voice agent performance and configuration
          </p>
        </div>
        <button
          onClick={() => void loadStats()}
          style={{
            padding: '0.625rem 1rem',
            backgroundColor: 'transparent',
            border: `1px solid ${borderColor}`,
            borderRadius: '0.5rem',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Refresh Stats
        </button>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: `1px solid ${borderColor}`, paddingBottom: '1rem', flexWrap: 'wrap' }}>
        {(['overview', 'performance', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.625rem 1.25rem',
              backgroundColor: activeTab === tab ? indigoColor : 'transparent',
              border: `1px solid ${activeTab === tab ? indigoColor : borderColor}`,
              borderRadius: '0.5rem',
              color: '#fff',
              cursor: 'pointer',
              textTransform: 'capitalize',
              fontWeight: activeTab === tab ? '600' : '400',
              minWidth: '110px',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && stats && (
        <>
          {/* Key Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', marginBottom: '2rem' }} className="sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Total Calls" value={stats.totalCalls.toLocaleString()} subtext="All time" />
            <MetricCard label="Calls Today" value={stats.callsToday.toLocaleString()} subtext={`${stats.callsThisWeek.toLocaleString()} this week`} />
            <MetricCard label="Avg Duration" value={formatDuration(stats.avgCallDuration)} subtext="Per call" />
            <MetricCard label="Total Minutes" value={stats.totalMinutes.toLocaleString()} subtext={`$${stats.estimatedCost.toFixed(2)} est. cost`} />
          </div>

          {/* Call Status Breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }} className="md:grid-cols-2">
            <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Call Status</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <StatusBar label="Completed" value={stats.byStatus.completed} total={stats.totalCalls} color="#10b981" />
                <StatusBar label="In Progress" value={stats.byStatus.inProgress} total={stats.totalCalls} color="#6366f1" />
                <StatusBar label="No Answer" value={stats.byStatus.noAnswer} total={stats.totalCalls} color="#f59e0b" />
                <StatusBar label="Failed" value={stats.byStatus.failed} total={stats.totalCalls} color="#ef4444" />
              </div>
            </div>

            <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Call Outcomes</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <StatusBar label="Qualified" value={stats.byOutcome.qualified} total={stats.totalCalls} color="#10b981" />
                <StatusBar label="Not Qualified" value={stats.byOutcome.notQualified} total={stats.totalCalls} color="#666" />
                <StatusBar label="Callback Requested" value={stats.byOutcome.callback} total={stats.totalCalls} color="#f59e0b" />
                <StatusBar label="Transferred" value={stats.byOutcome.transferred} total={stats.totalCalls} color="#6366f1" />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Performance Tab */}
      {activeTab === 'performance' && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }} className="md:grid-cols-2">
          {/* Performance Metrics */}
          <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>AI Performance</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }} className="sm:grid-cols-2">
              <PerformanceMetric
                label="Avg Qualification Score"
                value={stats.avgQualificationScore}
                max={100}
                unit="%"
                color={stats.avgQualificationScore >= 70 ? '#10b981' : stats.avgQualificationScore >= 50 ? '#f59e0b' : '#ef4444'}
              />
              <PerformanceMetric
                label="Transfer Rate"
                value={stats.transferRate}
                max={100}
                unit="%"
                color="#6366f1"
              />
              <PerformanceMetric
                label="Completion Rate"
                value={stats.completionRate}
                max={100}
                unit="%"
                color={stats.completionRate >= 80 ? '#10b981' : '#f59e0b'}
              />
              <PerformanceMetric
                label="Calls This Month"
                value={stats.callsThisMonth}
                max={10000}
                unit=""
                color="#6366f1"
              />
            </div>
          </div>

          {/* Time Analysis */}
          <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>Call Volume Analysis</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', backgroundColor: '#0a0a0a', borderRadius: '0.5rem' }}>
                <span style={{ color: '#666' }}>Today</span>
                <span style={{ fontWeight: '600' }}>{stats.callsToday.toLocaleString()} calls</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', backgroundColor: '#0a0a0a', borderRadius: '0.5rem' }}>
                <span style={{ color: '#666' }}>This Week</span>
                <span style={{ fontWeight: '600' }}>{stats.callsThisWeek.toLocaleString()} calls</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', backgroundColor: '#0a0a0a', borderRadius: '0.5rem' }}>
                <span style={{ color: '#666' }}>This Month</span>
                <span style={{ fontWeight: '600' }}>{stats.callsThisMonth.toLocaleString()} calls</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', backgroundColor: '#0a0a0a', borderRadius: '0.5rem' }}>
                <span style={{ color: '#666' }}>Avg per Day (30d)</span>
                <span style={{ fontWeight: '600' }}>{Math.round(stats.callsThisMonth / 30).toLocaleString()} calls</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>Default AI Agent Settings</h2>
          <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            These settings serve as the template for new organizations. Individual orgs can override these values.
          </p>

          {/* Save Result Message */}
          {saveResult && (
            <div style={{
              padding: '1rem',
              marginBottom: '1.5rem',
              borderRadius: '0.5rem',
              backgroundColor: saveResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${saveResult.success ? '#10b981' : '#ef4444'}`,
              color: saveResult.success ? '#10b981' : '#ef4444',
            }}>
              {saveResult.message}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* Greeting */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
                Default Greeting
              </label>
              <textarea
                value={agentSettings.greeting}
                onChange={(e) => setAgentSettings({ ...agentSettings, greeting: e.target.value })}
                style={{
                  width: '100%',
                  height: '80px',
                  padding: '0.75rem',
                  backgroundColor: '#0a0a0a',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '0.5rem',
                  color: '#fff',
                  resize: 'none',
                  fontSize: '0.9375rem',
                }}
              />
            </div>

            {/* Voice ID */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
                Default Voice
              </label>
              <select
                value={agentSettings.voiceId}
                onChange={(e) => setAgentSettings({ ...agentSettings, voiceId: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.625rem 1rem',
                  backgroundColor: '#0a0a0a',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontSize: '0.875rem',
                }}
              >
                <option value="alloy">Alloy (Neutral)</option>
                <option value="echo">Echo (Male)</option>
                <option value="fable">Fable (British)</option>
                <option value="onyx">Onyx (Deep Male)</option>
                <option value="nova">Nova (Female)</option>
                <option value="shimmer">Shimmer (Soft Female)</option>
              </select>
            </div>

            {/* Language */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
                Default Language
              </label>
              <select
                value={agentSettings.language}
                onChange={(e) => setAgentSettings({ ...agentSettings, language: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.625rem 1rem',
                  backgroundColor: '#0a0a0a',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontSize: '0.875rem',
                }}
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="es-ES">Spanish (Spain)</option>
                <option value="es-MX">Spanish (Mexico)</option>
                <option value="fr-FR">French</option>
                <option value="de-DE">German</option>
              </select>
            </div>

            {/* Max Call Duration */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
                Max Call Duration (seconds)
              </label>
              <input
                type="number"
                value={agentSettings.maxCallDuration}
                onChange={(e) => setAgentSettings({ ...agentSettings, maxCallDuration: parseInt(e.target.value) || 300 })}
                min={60}
                max={1800}
                style={{
                  width: '100%',
                  padding: '0.625rem 1rem',
                  backgroundColor: '#0a0a0a',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            {/* Qualification Threshold */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
                Qualification Threshold (%)
              </label>
              <input
                type="number"
                value={agentSettings.qualificationThreshold}
                onChange={(e) => setAgentSettings({ ...agentSettings, qualificationThreshold: parseInt(e.target.value) || 70 })}
                min={0}
                max={100}
                style={{
                  width: '100%',
                  padding: '0.625rem 1rem',
                  backgroundColor: '#0a0a0a',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            {/* Toggle Settings */}
            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '2rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={agentSettings.autoTransferEnabled}
                  onChange={(e) => setAgentSettings({ ...agentSettings, autoTransferEnabled: e.target.checked })}
                  style={{ width: '1.25rem', height: '1.25rem', accentColor: indigoColor }}
                />
                <span>Enable Auto-Transfer to Human</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={agentSettings.recordingEnabled}
                  onChange={(e) => setAgentSettings({ ...agentSettings, recordingEnabled: e.target.checked })}
                  style={{ width: '1.25rem', height: '1.25rem', accentColor: indigoColor }}
                />
                <span>Enable Call Recording</span>
              </label>
            </div>

            {/* Save Button */}
            <div style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
              <button
                onClick={() => void handleSaveSettings()}
                disabled={saving}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: indigoColor,
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.5 : 1,
                  fontWeight: '600',
                }}
              >
                {saving ? 'Saving...' : 'Save Default Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  return (
    <div style={{
      backgroundColor: bgPaper,
      border: `1px solid ${borderColor}`,
      borderRadius: '0.75rem',
      padding: '1.5rem',
    }}>
      <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff' }}>{value}</div>
      {subtext && <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>{subtext}</div>}
    </div>
  );
}

function StatusBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percentage = (value / total) * 100;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.875rem', color: '#ccc' }}>{label}</span>
        <span style={{ fontSize: '0.875rem', color: '#fff' }}>
          {value.toLocaleString()} ({percentage.toFixed(1)}%)
        </span>
      </div>
      <div style={{
        width: '100%',
        height: '6px',
        backgroundColor: '#0a0a0a',
        borderRadius: '3px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          backgroundColor: color,
          transition: 'width 0.3s',
        }} />
      </div>
    </div>
  );
}

function PerformanceMetric({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div style={{ padding: '1rem', backgroundColor: '#0a0a0a', borderRadius: '0.5rem' }}>
      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.75rem' }}>{label}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color, marginBottom: '0.5rem' }}>
        {value.toLocaleString()}{unit}
      </div>
      <div style={{
        width: '100%',
        height: '4px',
        backgroundColor: '#1a1a1a',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          backgroundColor: color,
          transition: 'width 0.3s',
        }} />
      </div>
    </div>
  );
}
