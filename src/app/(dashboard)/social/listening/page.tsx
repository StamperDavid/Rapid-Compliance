'use client';

/**
 * Social Listening Dashboard
 * Monitor mentions, keywords, and hashtags. View sentiment analysis results.
 * Manage tracked keywords and respond to mentions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { SocialMention, MentionSentiment, MentionStatus, ListeningConfig } from '@/types/social';

const SENTIMENT_COLORS: Record<MentionSentiment, { bg: string; text: string; label: string }> = {
  positive: { bg: 'rgba(76,175,80,0.15)', text: '#4CAF50', label: 'Positive' },
  neutral: { bg: 'rgba(158,158,158,0.15)', text: '#9E9E9E', label: 'Neutral' },
  negative: { bg: 'rgba(244,67,54,0.15)', text: '#F44336', label: 'Negative' },
  unknown: { bg: 'rgba(158,158,158,0.1)', text: '#757575', label: 'Unknown' },
};

const STATUS_LABELS: Record<MentionStatus, string> = {
  new: 'New',
  seen: 'Seen',
  replied: 'Replied',
  escalated: 'Escalated',
  dismissed: 'Dismissed',
};

interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
  unknown: number;
  total: number;
}

export default function SocialListeningPage() {
  const [mentions, setMentions] = useState<SocialMention[]>([]);
  const [breakdown, setBreakdown] = useState<SentimentBreakdown>({ positive: 0, neutral: 0, negative: 0, unknown: 0, total: 0 });
  const [config, setConfig] = useState<ListeningConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [sentimentFilter, setSentimentFilter] = useState<MentionSentiment | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<MentionStatus | 'all'>('all');

  // Config form state
  const [keywords, setKeywords] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [competitors, setCompetitors] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (sentimentFilter !== 'all') {params.set('sentiment', sentimentFilter);}
      if (statusFilter !== 'all') {params.set('status', statusFilter);}

      const [mentionsRes, breakdownRes, configRes] = await Promise.all([
        fetch(`/api/social/listening?${params.toString()}`),
        fetch('/api/social/listening?breakdown=true'),
        fetch('/api/social/listening/config'),
      ]);

      const mentionsData = await mentionsRes.json() as { success: boolean; mentions?: SocialMention[] };
      const breakdownData = await breakdownRes.json() as { success: boolean; breakdown?: SentimentBreakdown };
      const configData = await configRes.json() as { success: boolean; config?: ListeningConfig };

      if (mentionsData.success && mentionsData.mentions) {
        setMentions(mentionsData.mentions);
      }
      if (breakdownData.success && breakdownData.breakdown) {
        setBreakdown(breakdownData.breakdown);
      }
      if (configData.success && configData.config) {
        setConfig(configData.config);
        setKeywords(configData.config.trackedKeywords.join(', '));
        setHashtags(configData.config.trackedHashtags.join(', '));
        setCompetitors(configData.config.trackedCompetitors.join(', '));
      }
    } catch (error) {
      console.error('Failed to fetch listening data:', error);
    } finally {
      setLoading(false);
    }
  }, [sentimentFilter, statusFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleUpdateStatus = async (mentionId: string, status: MentionStatus) => {
    try {
      await fetch('/api/social/listening', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mentionId, status }),
      });
      await fetchData();
    } catch (error) {
      console.error('Failed to update mention:', error);
    }
  };

  const handleSaveConfig = async () => {
    try {
      await fetch('/api/social/listening/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackedKeywords: keywords.split(',').map((s) => s.trim()).filter(Boolean),
          trackedHashtags: hashtags.split(',').map((s) => s.trim()).filter(Boolean),
          trackedCompetitors: competitors.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });
      setShowConfig(false);
      await fetchData();
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  const selectStyle: React.CSSProperties = {
    padding: '0.375rem 0.5rem',
    borderRadius: '0.375rem',
    border: '1px solid var(--color-border-light)',
    backgroundColor: 'var(--color-bg-paper)',
    color: 'var(--color-text-secondary)',
    fontSize: '0.8125rem',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.375rem',
    border: '1px solid var(--color-border-light)',
    backgroundColor: 'var(--color-bg-main)',
    color: 'var(--color-text-primary)',
    fontSize: '0.8125rem',
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
            Social Listening
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Monitor mentions, keywords, and sentiment across platforms
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowConfig(!showConfig)}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            border: '1px solid var(--color-border-light)',
            backgroundColor: 'var(--color-bg-paper)',
            color: 'var(--color-text-secondary)',
            fontSize: '0.8125rem',
            cursor: 'pointer',
          }}
        >
          {showConfig ? 'Hide Config' : 'Configure'}
        </button>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <div style={{
          marginBottom: '1.5rem',
          padding: '1.25rem',
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.5rem',
          border: '1px solid var(--color-border-light)',
        }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '1rem' }}>
            Listening Configuration
          </h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
                Tracked Keywords (comma separated)
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="SalesVelocity, AI CRM, sales automation"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
                Tracked Hashtags (comma separated)
              </label>
              <input
                type="text"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#SalesVelocity, #AICRM, #SalesAutomation"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
                Tracked Competitors (handles, comma separated)
              </label>
              <input
                type="text"
                value={competitors}
                onChange={(e) => setCompetitors(e.target.value)}
                placeholder="competitor1, competitor2"
                style={inputStyle}
              />
            </div>
            <button
              type="button"
              onClick={() => { void handleSaveConfig(); }}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: 'var(--color-primary)',
                color: '#fff',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                width: 'fit-content',
              }}
            >
              Save Configuration
            </button>
          </div>
        </div>
      )}

      {/* Sentiment Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{
          padding: '1rem',
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.5rem',
          border: '1px solid var(--color-border-light)',
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Total Mentions</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{breakdown.total}</div>
        </div>
        {(['positive', 'neutral', 'negative'] as const).map((s) => {
          const info = SENTIMENT_COLORS[s];
          const pct = breakdown.total > 0 ? Math.round((breakdown[s] / breakdown.total) * 100) : 0;
          return (
            <div
              key={s}
              style={{
                padding: '1rem',
                backgroundColor: 'var(--color-bg-paper)',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-border-light)',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{info.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: info.text }}>
                {breakdown[s]} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <select
          value={sentimentFilter}
          onChange={(e) => setSentimentFilter(e.target.value as MentionSentiment | 'all')}
          style={selectStyle}
        >
          <option value="all">All Sentiments</option>
          <option value="positive">Positive</option>
          <option value="neutral">Neutral</option>
          <option value="negative">Negative</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as MentionStatus | 'all')}
          style={selectStyle}
        >
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="seen">Seen</option>
          <option value="replied">Replied</option>
          <option value="escalated">Escalated</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>

      {/* Mentions Feed */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>Loading...</div>
      ) : mentions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
          {config?.trackedKeywords.length === 0
            ? 'Configure tracked keywords to start monitoring mentions'
            : 'No mentions found'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {mentions.map((mention) => {
            const sentimentInfo = SENTIMENT_COLORS[mention.sentiment];
            return (
              <div
                key={mention.id}
                style={{
                  backgroundColor: 'var(--color-bg-paper)',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--color-border-light)',
                  padding: '1rem',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <span style={{
                    padding: '0.125rem 0.375rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    color: '#fff',
                    backgroundColor: mention.platform === 'twitter' ? '#000' : '#0A66C2',
                    textTransform: 'uppercase',
                  }}>
                    {mention.platform}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-text-primary)' }}>
                    @{mention.authorHandle}
                  </span>
                  <span style={{
                    padding: '0.125rem 0.5rem',
                    borderRadius: '1rem',
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    backgroundColor: sentimentInfo.bg,
                    color: sentimentInfo.text,
                  }}>
                    {sentimentInfo.label}
                    {mention.sentimentConfidence != null && ` (${Math.round(mention.sentimentConfidence * 100)}%)`}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>
                    {new Date(mention.detectedAt).toLocaleString()}
                  </span>
                </div>

                {/* Content */}
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', marginBottom: '0.5rem', lineHeight: 1.5 }}>
                  {mention.content}
                </div>

                {/* Matched keywords */}
                {mention.matchedKeywords.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                    {mention.matchedKeywords.map((kw) => (
                      <span
                        key={kw}
                        style={{
                          padding: '0.125rem 0.375rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.625rem',
                          backgroundColor: 'rgba(var(--color-primary-rgb), 0.1)',
                          color: 'var(--color-primary)',
                        }}
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}

                {/* Key phrases from sentiment */}
                {mention.keyPhrases && mention.keyPhrases.length > 0 && (
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)', marginBottom: '0.5rem' }}>
                    Key phrases: {mention.keyPhrases.join(', ')}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {mention.status === 'new' && (
                    <>
                      <button
                        type="button"
                        onClick={() => { void handleUpdateStatus(mention.id, 'seen'); }}
                        style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          border: '1px solid var(--color-border-light)',
                          backgroundColor: 'var(--color-bg-main)',
                          color: 'var(--color-text-secondary)',
                          fontSize: '0.6875rem',
                          cursor: 'pointer',
                        }}
                      >
                        Mark Seen
                      </button>
                      <button
                        type="button"
                        onClick={() => { void handleUpdateStatus(mention.id, 'escalated'); }}
                        style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          border: 'none',
                          backgroundColor: '#FF9800',
                          color: '#fff',
                          fontSize: '0.6875rem',
                          cursor: 'pointer',
                        }}
                      >
                        Escalate
                      </button>
                      <button
                        type="button"
                        onClick={() => { void handleUpdateStatus(mention.id, 'dismissed'); }}
                        style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          border: '1px solid var(--color-border-light)',
                          backgroundColor: 'transparent',
                          color: 'var(--color-text-disabled)',
                          fontSize: '0.6875rem',
                          cursor: 'pointer',
                        }}
                      >
                        Dismiss
                      </button>
                    </>
                  )}
                  {mention.sourceUrl && (
                    <a
                      href={mention.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        border: '1px solid var(--color-border-light)',
                        backgroundColor: 'var(--color-bg-main)',
                        color: 'var(--color-primary)',
                        fontSize: '0.6875rem',
                        textDecoration: 'none',
                        marginLeft: 'auto',
                      }}
                    >
                      View on {mention.platform}
                    </a>
                  )}
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.6875rem',
                    color: 'var(--color-text-disabled)',
                    marginLeft: mention.sourceUrl ? '0' : 'auto',
                  }}>
                    {STATUS_LABELS[mention.status]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
