'use client';

import { useEffect, useState, useCallback } from 'react';
import type { LeaderboardEntry } from '@/lib/team/collaboration';
import { logger } from '@/lib/logger/logger';

export default function TeamLeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [loading, setLoading] = useState(true);

  const loadLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/team/leaderboard?period=${period}`);
      const data = await response.json() as { success: boolean; data: LeaderboardEntry[] };
      if (data.success) {
        setLeaderboard(data.data);
      }
    } catch (error) {
      logger.error('Error loading leaderboard', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const getRankEmoji = (rank: number) => {
    if (rank === 1) {return '🥇';}
    if (rank === 2) {return '🥈';}
    if (rank === 3) {return '🥉';}
    return rank;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Team Leaderboard</h1>
        <div className="flex gap-2">
          {(['week', 'month', 'quarter'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg capitalize ${
                period === p ? 'bg-primary text-white' : 'bg-surface-elevated text-[var(--color-text-secondary)] hover:bg-surface-paper'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {leaderboard.map((entry, index) => (
            <div
              key={entry.userId}
              className={`bg-surface-paper rounded-lg p-6 ${
                index < 3 ? 'border-2 border-warning' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold">
                    {getRankEmoji(entry.rank)}
                  </div>
                  <div>
                    <div className="font-bold text-xl">{entry.userName}</div>
                    <div className="text-sm text-[var(--color-text-secondary)]">{entry.userEmail}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-primary">{entry.points.toLocaleString()}</div>
                  <div className="text-sm text-[var(--color-text-secondary)]">points</div>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-success">{entry.metrics.dealsClosed}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">Deals Closed</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-success">{formatCurrency(entry.metrics.revenueGenerated)}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">Revenue</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{entry.metrics.leadsCreated}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">Leads Created</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{entry.metrics.activitiesLogged}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">Activities</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{entry.metrics.winRate?.toFixed(0)}%</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">Win Rate</div>
                </div>
              </div>
            </div>
          ))}

          {leaderboard.length === 0 && (
            <div className="text-center py-12 text-[var(--color-text-secondary)]">
              No data for this period
            </div>
          )}
        </div>
      )}
    </div>
  );
}

