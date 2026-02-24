'use client';

/**
 * Mission Control History — Paginated list of completed missions.
 * Click a row to navigate to the read-only timeline replay.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import SubpageNav from '@/components/ui/SubpageNav';
import type { Mission, MissionStatus } from '@/lib/orchestrator/mission-persistence';

interface MissionListResponse {
  success: boolean;
  data?: { missions: Mission[]; hasMore: boolean };
}

const STATUS_COLORS: Record<MissionStatus, string> = {
  PENDING: 'var(--color-text-secondary)',
  IN_PROGRESS: 'var(--color-success)',
  AWAITING_APPROVAL: 'var(--color-warning)',
  COMPLETED: 'var(--color-primary)',
  FAILED: 'var(--color-error)',
};

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(mission: Mission): string {
  if (!mission.completedAt) { return '-'; }
  const ms = new Date(mission.completedAt).getTime() - new Date(mission.createdAt).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) { return `${seconds}s`; }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) { return `${minutes}m`; }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export default function MissionHistoryPage() {
  const authFetch = useAuthFetch();
  const router = useRouter();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  const fetchMissions = useCallback(async (startAfter?: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (startAfter) { params.set('startAfter', startAfter); }

      const res = await authFetch(`/api/orchestrator/missions?${params.toString()}`);
      if (!res.ok) { return; }

      const data = (await res.json()) as MissionListResponse;
      if (data.success && data.data) {
        const { missions: fetchedMissions, hasMore: fetchedHasMore } = data.data;
        if (startAfter) {
          setMissions((prev) => [...prev, ...fetchedMissions]);
        } else {
          setMissions(fetchedMissions);
        }
        setHasMore(fetchedHasMore);
        const last = fetchedMissions[fetchedMissions.length - 1];
        setCursor(last?.missionId);
      }
    } catch {
      // Silent fail
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchMissions();
  }, [fetchMissions]);

  const loadMore = () => {
    if (cursor) {
      void fetchMissions(cursor);
    }
  };

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1 style={{
        fontSize: '1.5rem',
        fontWeight: 700,
        color: 'var(--color-text-primary)',
        marginBottom: '1rem',
      }}>
        Mission Control
      </h1>

      <SubpageNav items={[
        { label: 'Live', href: '/mission-control' },
        { label: 'History', href: '/mission-control/history' },
      ]} />

      {/* Table */}
      <div style={{
        backgroundColor: 'var(--color-bg-paper)',
        borderRadius: '0.75rem',
        border: '1px solid var(--color-border-light)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 100px 80px 80px 130px',
          gap: '0.5rem',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--color-border-light)',
          backgroundColor: 'var(--color-bg-elevated)',
        }}>
          {['Title', 'Status', 'Steps', 'Duration', 'Date'].map((col) => (
            <div key={col} style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-text-disabled)',
            }}>
              {col}
            </div>
          ))}
        </div>

        {/* Rows */}
        {missions.length === 0 && !isLoading ? (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            color: 'var(--color-text-disabled)',
            fontSize: '0.875rem',
          }}>
            No missions found.
          </div>
        ) : (
          missions.map((mission) => (
            <div
              key={mission.missionId}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/mission-control?mission=${mission.missionId}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  router.push(`/mission-control?mission=${mission.missionId}`);
                }
              }}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 100px 80px 80px 130px',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--color-border-light)',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(var(--color-primary-rgb), 0.04)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {/* Title */}
              <div style={{
                fontSize: '0.8125rem',
                color: 'var(--color-text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {mission.title}
              </div>

              {/* Status */}
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: STATUS_COLORS[mission.status],
              }}>
                {mission.status}
              </div>

              {/* Steps */}
              <div style={{
                fontSize: '0.8125rem',
                color: 'var(--color-text-secondary)',
              }}>
                {mission.steps.length}
              </div>

              {/* Duration */}
              <div style={{
                fontSize: '0.8125rem',
                color: 'var(--color-text-secondary)',
              }}>
                {formatDuration(mission)}
              </div>

              {/* Date */}
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-disabled)',
              }}>
                {formatDate(mission.createdAt)}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div style={{
            padding: '1rem',
            textAlign: 'center',
            color: 'var(--color-text-disabled)',
            fontSize: '0.8125rem',
          }}>
            Loading...
          </div>
        )}

        {/* Load More */}
        {hasMore && !isLoading && (
          <div style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
            <button
              type="button"
              onClick={loadMore}
              style={{
                padding: '0.5rem 1.5rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-border-light)',
                backgroundColor: 'transparent',
                color: 'var(--color-primary)',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
