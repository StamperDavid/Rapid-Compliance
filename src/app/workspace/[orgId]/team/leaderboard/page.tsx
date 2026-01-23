'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { LeaderboardEntry } from '@/lib/team/collaboration';

export default function TeamLeaderboardPage() {
  const params = useParams();
  const _orgId = params.orgId as string;
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/team/leaderboard?period=${period}`);
      const data = await response.json() as { success: boolean; data: LeaderboardEntry[] };
      if (data.success) {
        setLeaderboard(data.data);
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

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
                period === p ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {leaderboard.map((entry, index) => (
            <div
              key={entry.userId}
              className={`bg-gray-900 rounded-lg p-6 ${
                index < 3 ? 'border-2 border-yellow-500' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold">
                    {getRankEmoji(entry.rank)}
                  </div>
                  <div>
                    <div className="font-bold text-xl">{entry.userName}</div>
                    <div className="text-sm text-gray-400">{entry.userEmail}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-400">{entry.points.toLocaleString()}</div>
                  <div className="text-sm text-gray-400">points</div>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-400">{entry.metrics.dealsClosed}</div>
                  <div className="text-xs text-gray-400">Deals Closed</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-400">{formatCurrency(entry.metrics.revenueGenerated)}</div>
                  <div className="text-xs text-gray-400">Revenue</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{entry.metrics.leadsCreated}</div>
                  <div className="text-xs text-gray-400">Leads Created</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{entry.metrics.activitiesLogged}</div>
                  <div className="text-xs text-gray-400">Activities</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{entry.metrics.winRate?.toFixed(0)}%</div>
                  <div className="text-xs text-gray-400">Win Rate</div>
                </div>
              </div>
            </div>
          ))}

          {leaderboard.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              No data for this period
            </div>
          )}
        </div>
      )}
    </div>
  );
}

