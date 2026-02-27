/**
 * Playbook Builder Dashboard Page
 *
 * Main interface for viewing and managing playbooks.
 * Displays playbook library, patterns, talk tracks, and adoption metrics.
 *
 * FEATURES:
 * - Browse playbook library
 * - View extracted patterns and talk tracks
 * - Track playbook adoption and effectiveness
 * - Generate new playbooks
 *
 * @module app/dashboard/playbook
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PlaybooksCard } from '@/components/playbook/PlaybooksCard';
import { PatternsCard } from '@/components/playbook/PatternsCard';
import { TalkTracksCard } from '@/components/playbook/TalkTracksCard';
import { AdoptionMetricsCard } from '@/components/playbook/AdoptionMetricsCard';
import { auth } from '@/lib/firebase/config';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import SubpageNav from '@/components/ui/SubpageNav';
import { COACHING_TABS } from '@/lib/constants/subpage-nav';
import type {
  Playbook,
  PlaybookAdoptionMetrics,
} from '@/lib/playbook/types';

interface PlaybooksApiResponse {
  data?: PlaybookRecord[];
  playbooks?: PlaybookRecord[];
}

interface PlaybookRecord {
  id: string;
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  conversationType?: string;
  patterns?: Playbook['patterns'];
  talkTracks?: Playbook['talkTracks'];
  objectionResponses?: Playbook['objectionResponses'];
  bestPractices?: Playbook['bestPractices'];
  successMetrics?: Playbook['successMetrics'];
  sourceConversations?: string[];
  topPerformers?: string[];
  adoptionRate?: number;
  effectiveness?: number;
  usageCount?: number;
  status?: string;
  confidence?: number;
  createdBy?: string;
  createdAt?: string;
  version?: number;
}

interface MetricsApiResponse {
  data?: PlaybookAdoptionMetrics;
  metrics?: PlaybookAdoptionMetrics;
}

export default function PlaybookDashboardPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [adoptionMetrics, setAdoptionMetrics] = useState<PlaybookAdoptionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch playbooks from Firestore via API
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await auth?.currentUser?.getIdToken();
      const headers: Record<string, string> = {
        'x-organization-id': PLATFORM_ID,
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Fetch playbooks from the playbook API
      const response = await fetch('/api/playbook/list', { headers });

      if (response.ok) {
        const data = (await response.json()) as PlaybooksApiResponse;
        const rawPlaybooks = data.data ?? data.playbooks ?? [];
        const fetchedPlaybooks: Playbook[] = rawPlaybooks.map((pb) => ({
          id: pb.id,
          name: pb.name ?? '',
          description: pb.description ?? '',
          category: (pb.category ?? 'general') as Playbook['category'],
          tags: pb.tags ?? [],
          conversationType: (pb.conversationType ?? 'general') as Playbook['conversationType'],
          patterns: pb.patterns ?? [],
          talkTracks: pb.talkTracks ?? [],
          objectionResponses: pb.objectionResponses ?? [],
          bestPractices: pb.bestPractices ?? [],
          successMetrics: pb.successMetrics ?? {
            avgConversionRate: 0,
            vsBaselineConversion: 0,
            avgSentimentScore: 0,
            vsBaselineSentiment: 0,
            avgOverallScore: 0,
            vsBaselineScore: 0,
            objectionSuccessRate: 0,
            vsBaselineObjectionSuccess: 0,
            winRate: 0,
            vsBaselineWinRate: 0,
            conversationsAnalyzed: 0,
            repsUsing: 0,
            confidence: 0,
          },
          sourceConversations: pb.sourceConversations ?? [],
          topPerformers: pb.topPerformers ?? [],
          adoptionRate: pb.adoptionRate ?? 0,
          effectiveness: pb.effectiveness ?? 0,
          usageCount: pb.usageCount ?? 0,
          status: (pb.status as Playbook['status']) ?? 'draft',
          confidence: pb.confidence ?? 0,
          createdBy: pb.createdBy ?? '',
          createdAt: pb.createdAt ? new Date(pb.createdAt) : new Date(),
          version: pb.version ?? 1,
        }));

        setPlaybooks(fetchedPlaybooks);
        if (fetchedPlaybooks.length > 0) {
          setSelectedPlaybook(fetchedPlaybooks[0]);
        }
      } else {
        // No playbooks found - this is expected for empty collections
        logger.info('No playbooks found', { status: response.status });
        setPlaybooks([]);
      }

      setLoading(false);
    } catch (err) {
      logger.error('Failed to load playbooks', err instanceof Error ? err : new Error(String(err)));
      setError(err instanceof Error ? err.message : 'Failed to load playbooks');
      setPlaybooks([]);
      setLoading(false);
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Load adoption metrics when a playbook is selected
  useEffect(() => {
    const loadAdoptionMetrics = async () => {
      if (!selectedPlaybook) {
        setAdoptionMetrics(null);
        return;
      }

      try {
        const token = await auth?.currentUser?.getIdToken();
        const headers: Record<string, string> = {
          'x-organization-id': PLATFORM_ID,
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`/api/playbook/${selectedPlaybook.id}/metrics`, { headers });

        if (response.ok) {
          const data = (await response.json()) as MetricsApiResponse;
          setAdoptionMetrics(data.data ?? data.metrics ?? null);
        } else {
          setAdoptionMetrics(null);
        }
      } catch {
        setAdoptionMetrics(null);
      }
    };

    void loadAdoptionMetrics();
  }, [selectedPlaybook]);

  const handleSelectPlaybook = (playbook: Playbook) => {
    setSelectedPlaybook(playbook);
  };
  
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--color-bg-main)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 48,
              height: 48,
              border: '2px solid var(--color-border-light)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem',
            }}
          />
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading playbooks...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--color-bg-main)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--color-error)', fontSize: '1.25rem', marginBottom: '0.5rem' }}>Error</div>
          <p style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
          <button
            onClick={() => void loadData()}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-primary)',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-main)', padding: '1.5rem' }}>
      <SubpageNav items={COACHING_TABS} />
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
          Playbook Builder
        </h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Extract winning patterns from top performers and create reusable playbooks
        </p>
      </div>

      {/* Action Buttons */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-text-primary)',
            border: 'none',
            borderRadius: '0.5rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          + Generate New Playbook
        </button>
        <button
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--color-bg-paper)',
            border: '1px solid var(--color-border-light)',
            color: 'var(--color-text-primary)',
            borderRadius: '0.5rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Extract Patterns
        </button>
        <button
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--color-bg-paper)',
            border: '1px solid var(--color-border-light)',
            color: 'var(--color-text-primary)',
            borderRadius: '0.5rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          View Analytics
        </button>
      </div>

      {/* Empty State */}
      {playbooks.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            backgroundColor: 'var(--color-bg-paper)',
            borderRadius: '1rem',
            border: '1px solid var(--color-border-main)',
          }}
        >
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📚</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
            No Playbooks Yet
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
            Get started by generating your first playbook from conversation intelligence data,
            or add playbooks directly to your Firestore collection.
          </p>
          <button
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-primary)',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Generate Your First Playbook
          </button>
        </div>
      ) : (
        <>
          {/* Main Content */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
            {/* Left Column - Playbooks List */}
            <div>
              <PlaybooksCard playbooks={playbooks} onSelectPlaybook={handleSelectPlaybook} />
            </div>

            {/* Right Column - Adoption Metrics */}
            <div>
              {selectedPlaybook && adoptionMetrics && <AdoptionMetricsCard metrics={adoptionMetrics} />}
              {selectedPlaybook && !adoptionMetrics && (
                <div
                  style={{
                    padding: '2rem',
                    backgroundColor: 'var(--color-bg-paper)',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--color-border-main)',
                    textAlign: 'center',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  No adoption metrics available for this playbook yet.
                </div>
              )}
            </div>
          </div>

          {/* Bottom Row - Patterns and Talk Tracks */}
          {selectedPlaybook && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
              <PatternsCard patterns={selectedPlaybook.patterns} />
              <TalkTracksCard talkTracks={selectedPlaybook.talkTracks} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
