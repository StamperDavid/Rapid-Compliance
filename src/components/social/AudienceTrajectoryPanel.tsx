'use client';

/**
 * AudienceTrajectoryPanel
 *
 * Renders a per-platform "improvement since connecting" panel:
 *   - three delta tiles (followers / following / posts) with absolute +
 *     percentage change vs the baseline captured at OAuth-connect time
 *   - a sparkline showing the audience trajectory over the most recent N
 *     daily snapshots
 *
 * Powered by GET /api/social/platforms/{platform}/audience.
 *
 * Empty states:
 *   - account not connected → "Connect to start tracking"
 *   - connected but no baseline yet → "Capturing baseline now... refresh in a moment"
 *   - connected with baseline + 0 deltas → tiles show "± 0" with neutral styling
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Users,
  UserPlus,
  Pencil,
} from 'lucide-react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PLATFORM_META } from '@/lib/social/platform-config';
import type { SocialPlatform } from '@/types/social';

interface DeltaPair {
  absolute: number;
  percentage: number;
}

interface AudienceImprovement {
  followers: DeltaPair;
  following: DeltaPair;
  posts: DeltaPair;
  daysSinceBaseline: number;
}

interface AudienceCounts {
  followersCount: number;
  followingCount: number;
  postsCount: number;
}

interface AudienceBaselineSummary extends AudienceCounts {
  capturedAt: string;
  source: string;
}

interface SnapshotPoint extends AudienceCounts {
  dayKey: string;
}

interface TrajectoryResponse {
  success: boolean;
  connected?: boolean;
  baseline?: AudienceBaselineSummary | null;
  current?: AudienceCounts | null;
  improvement?: AudienceImprovement | null;
  history?: SnapshotPoint[];
  error?: string;
}

interface AudienceTrajectoryPanelProps {
  platform: SocialPlatform;
}

function formatDelta(absolute: number): string {
  if (absolute === 0) { return '± 0'; }
  const sign = absolute > 0 ? '+' : '−';
  return `${sign}${Math.abs(absolute).toLocaleString()}`;
}

function formatPct(percentage: number): string {
  if (percentage === 0) { return '0%'; }
  const sign = percentage > 0 ? '+' : '';
  return `${sign}${percentage.toFixed(1)}%`;
}

function deltaToneClass(absolute: number): string {
  if (absolute > 0) { return 'text-success'; }
  if (absolute < 0) { return 'text-destructive'; }
  return 'text-muted-foreground';
}

function DeltaIcon({ absolute }: { absolute: number }): React.ReactElement {
  if (absolute > 0) { return <ArrowUpRight size={14} className="text-success" />; }
  if (absolute < 0) { return <ArrowDownRight size={14} className="text-destructive" />; }
  return <Minus size={14} className="text-muted-foreground" />;
}

function DeltaTile({
  label,
  current,
  delta,
  icon,
}: {
  label: string;
  current: number;
  delta: DeltaPair;
  icon: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="rounded-lg border border-border-light bg-card p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        <DeltaIcon absolute={delta.absolute} />
      </div>
      <div className="text-2xl font-bold text-foreground">{current.toLocaleString()}</div>
      <div className={`mt-1 text-xs font-medium ${deltaToneClass(delta.absolute)}`}>
        {formatDelta(delta.absolute)}{' '}
        <span className="text-muted-foreground">({formatPct(delta.percentage)})</span>
      </div>
    </div>
  );
}

function Sparkline({
  history,
  baseline,
  platformColor,
}: {
  history: SnapshotPoint[];
  baseline: AudienceBaselineSummary | null;
  platformColor: string;
}): React.ReactElement {
  const data = useMemo(() => {
    if (history.length === 0 && baseline) {
      // Single-point: draw a flat baseline marker so the chart isn't empty
      return [
        { dayKey: 'baseline', followersCount: baseline.followersCount },
      ];
    }
    return history.map((p) => ({
      dayKey: p.dayKey,
      followersCount: p.followersCount,
    }));
  }, [history, baseline]);

  if (data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center rounded-lg border border-dashed border-border-strong bg-card text-xs text-muted-foreground">
        Sparkline appears once 2+ days of history accumulate
      </div>
    );
  }

  return (
    <div className="h-32 -mx-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <XAxis
            dataKey="dayKey"
            tick={{ fontSize: 10, fill: 'currentColor' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            className="text-muted-foreground"
          />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
            }}
            labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
            formatter={(v: number) => [v.toLocaleString(), 'Followers']}
          />
          <Line
            type="monotone"
            dataKey="followersCount"
            stroke={platformColor}
            strokeWidth={2}
            dot={{ r: 3, fill: platformColor }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AudienceTrajectoryPanel({ platform }: AudienceTrajectoryPanelProps) {
  const authFetch = useAuthFetch();
  const meta = PLATFORM_META[platform];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TrajectoryResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/social/platforms/${platform}/audience`);
      const body = (await res.json()) as TrajectoryResponse;
      if (!res.ok || !body.success) {
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load trajectory');
    } finally {
      setLoading(false);
    }
  }, [authFetch, platform]);

  useEffect(() => { void load(); }, [load]);

  return (
    <Card className="border-border-light">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity size={14} className="text-muted-foreground" />
            Audience growth
          </CardTitle>
          {data?.improvement && (
            <span className="text-xs text-muted-foreground">
              Since connecting · {data.improvement.daysSinceBaseline}{' '}
              {data.improvement.daysSinceBaseline === 1 ? 'day' : 'days'}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {loading && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 rounded-lg bg-surface-elevated animate-pulse" />
              ))}
            </div>
            <div className="h-32 rounded-lg bg-surface-elevated animate-pulse" />
          </>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Couldn&apos;t load audience trajectory: {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            {!data.connected && (
              <p className="text-sm text-muted-foreground">
                Connect your {meta.label} account to start tracking audience growth.
              </p>
            )}

            {data.connected && !data.baseline && (
              <p className="text-sm text-muted-foreground">
                Capturing baseline now — this populates after the next daily snapshot run.
              </p>
            )}

            {data.connected && data.baseline && data.current && data.improvement && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <DeltaTile
                    label="Followers"
                    current={data.current.followersCount}
                    delta={data.improvement.followers}
                    icon={<Users size={12} />}
                  />
                  <DeltaTile
                    label="Following"
                    current={data.current.followingCount}
                    delta={data.improvement.following}
                    icon={<UserPlus size={12} />}
                  />
                  <DeltaTile
                    label="Posts"
                    current={data.current.postsCount}
                    delta={data.improvement.posts}
                    icon={<Pencil size={12} />}
                  />
                </div>
                <Sparkline
                  history={data.history ?? []}
                  baseline={data.baseline ?? null}
                  platformColor={meta.color}
                />
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
