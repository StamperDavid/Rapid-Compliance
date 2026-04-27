'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { PLATFORM_META } from '@/lib/social/platform-config';
import { PlatformComposer } from '@/components/social/composers';
import type { SocialPlatform } from '@/types/social';

export default function PlatformPage() {
  const params = useParams();
  const router = useRouter();
  const authFetch = useAuthFetch();
  const platform = params.platform as string;

  const meta = PLATFORM_META[platform as SocialPlatform];

  const [connected, setConnected] = useState<boolean | null>(null);
  const [recentPosts, setRecentPosts] = useState<Array<{ id: string; content: string; publishedAt: string; status: string }>>([]);

  const checkConnection = useCallback(async () => {
    try {
      const res = await authFetch(`/api/social/accounts?platform=${platform}`);
      if (res.ok) {
        const data = (await res.json()) as { accounts?: Array<{ status: string }> };
        setConnected(data.accounts?.some((a) => a.status === 'active') ?? false);
      }
    } catch {
      setConnected(false);
    }
  }, [authFetch, platform]);

  const fetchRecentPosts = useCallback(async () => {
    try {
      const res = await authFetch(`/api/social/posts?platform=${platform}&limit=5`);
      if (res.ok) {
        const data = (await res.json()) as { posts?: Array<{ id: string; content: string; publishedAt: string; status: string }> };
        setRecentPosts(data.posts ?? []);
      }
    } catch {
      // Non-critical
    }
  }, [authFetch, platform]);

  useEffect(() => {
    void checkConnection();
    void fetchRecentPosts();
  }, [checkConnection, fetchRecentPosts]);

  if (!meta) {
    return (
      <div className="p-8">
        <PageTitle>Platform not found</PageTitle>
        <SectionDescription>
          &ldquo;{platform}&rdquo; is not a supported platform.{' '}
          <button onClick={() => router.push('/social/command-center')} className="text-primary underline">
            Back to Social Command Center
          </button>
        </SectionDescription>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold"
          style={{ backgroundColor: meta.color }}
        >
          {meta.icon}
        </div>
        <div>
          <PageTitle>{meta.label}</PageTitle>
          <SectionDescription>
            {connected === true && <span className="text-success font-medium">Connected</span>}
            {connected === false && (
              <span>
                <span className="text-destructive font-medium">Not connected</span>
                {' — '}
                <button onClick={() => router.push('/settings/integrations')} className="text-primary underline">
                  Connect in Settings
                </button>
              </span>
            )}
            {connected === null && <span className="text-muted-foreground">Checking connection...</span>}
          </SectionDescription>
        </div>
      </div>

      {/* ── Platform Metrics ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Followers', value: '—', trend: null },
          { label: 'Following', value: '—', trend: null },
          { label: 'Posts', value: String(recentPosts.length), trend: null },
          { label: 'Engagement Rate', value: '—', trend: null },
          { label: 'Reach (30d)', value: '—', trend: null },
          { label: 'Impressions (30d)', value: '—', trend: null },
        ].map((metric) => (
          <Card key={metric.label}>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-xs text-muted-foreground">{metric.label}</div>
              <div className="text-xl font-bold text-foreground mt-1">{metric.value}</div>
              {metric.trend !== null && (
                <div className={`text-xs mt-0.5 ${Number(metric.trend) >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {Number(metric.trend) >= 0 ? '+' : ''}{metric.trend}%
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── AI Strategy & Advice ──────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">AI Strategy for {meta.label}</CardTitle>
          <CardDescription>
            Your {meta.label} specialist analyzes your performance and recommends what to do next.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connected === false ? (
            <div className="text-sm text-muted-foreground py-4">
              Connect your {meta.label} account to get personalized strategy recommendations from your AI specialist.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-surface-elevated border border-border-light">
                <div className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Content Recommendation</div>
                <div className="text-sm text-foreground">
                  Connect your {meta.label} account and post a few times. Your AI specialist will analyze your engagement patterns and recommend the best content types, posting times, and topics for your audience.
                </div>
              </div>
              <div className="p-3 rounded-lg bg-surface-elevated border border-border-light">
                <div className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Growth Strategy</div>
                <div className="text-sm text-foreground">
                  Once you have engagement data, your specialist will identify growth opportunities — hashtag strategies, audience segments to target, competitors to study, and content gaps to fill.
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/dashboard')}
              >
                Ask Jasper for {meta.label} strategy now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Composer */}
        <div className="lg:col-span-2">
          <PlatformComposer platform={platform as SocialPlatform} />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Paid Advertising */}
          {['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok', 'pinterest', 'reddit'].includes(platform) && (
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Paid Advertising</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  Run paid ads on {meta?.label ?? platform} to reach more people. Our AI plans your budget, targeting, and creative.
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => router.push('/dashboard')}
                >
                  Create Ad Campaign
                </Button>
                <div className="text-[10px] text-muted-foreground">
                  Tell Jasper your goal and budget — the Paid Advertising Specialist handles the rest.
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent Posts</CardTitle>
            </CardHeader>
            <CardContent>
              {recentPosts.length === 0 ? (
                <div className="text-sm text-muted-foreground">No recent posts on {meta.label}</div>
              ) : (
                <div className="space-y-3">
                  {recentPosts.map((post) => (
                    <div key={post.id} className="border-b border-border-light pb-2 last:border-0 last:pb-0">
                      <div className="text-sm text-foreground line-clamp-2">{post.content}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(post.publishedAt).toLocaleDateString()} · {post.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Let AI Write It</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground mb-3">
                Tell Jasper what you want to post and your {meta.label} specialist will draft it for you.
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/dashboard')}
                className="w-full"
              >
                Open Jasper Chat
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
