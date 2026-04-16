'use client';

/**
 * Social Media Hub — the client's social media home page
 *
 * Layout: platforms sidebar on the left, content feed in the center,
 * AI quick actions at the top. Designed so a client immediately sees
 * their platforms, what's been posted, and what's coming up — without
 * needing to understand any internal terminology.
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';
import { PLATFORM_META } from '@/lib/social/platform-config';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SubpageNav from '@/components/ui/SubpageNav';
import { SOCIAL_TABS } from '@/lib/constants/subpage-nav';

interface PlatformStatus {
  platform: SocialPlatform;
  connected: boolean;
  accountName?: string;
  handle?: string;
}

interface RecentPost {
  id: string;
  platform: string;
  content: string;
  status: string;
  publishedAt?: string;
  createdAt: string;
}

export default function SocialHubPage() {
  const authFetch = useAuthFetch();
  const router = useRouter();
  const [platforms, setPlatforms] = useState<PlatformStatus[]>([]);
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [accountsRes, postsRes] = await Promise.all([
        authFetch('/api/social/accounts'),
        authFetch('/api/social/posts?limit=15'),
      ]);

      if (accountsRes.ok) {
        const data = (await accountsRes.json()) as { accounts?: Array<{ platform: string; status: string; accountName?: string; handle?: string }> };
        const accounts = data.accounts ?? [];
        setPlatforms(SOCIAL_PLATFORMS.map((p) => {
          const account = accounts.find((a) => a.platform === p && a.status === 'active');
          return { platform: p, connected: Boolean(account), accountName: account?.accountName, handle: account?.handle };
        }));
      } else {
        setPlatforms(SOCIAL_PLATFORMS.map((p) => ({ platform: p, connected: false })));
      }

      if (postsRes.ok) {
        const data = (await postsRes.json()) as { posts?: RecentPost[] };
        setRecentPosts(data.posts ?? []);
      }
    } catch {
      setPlatforms(SOCIAL_PLATFORMS.map((p) => ({ platform: p, connected: false })));
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { void loadData(); }, [loadData]);

  const connectedCount = platforms.filter((p) => p.connected).length;
  const connectedPlatforms = platforms.filter((p) => p.connected);
  const unconnectedPlatforms = platforms.filter((p) => !p.connected);

  return (
    <div className="p-8 space-y-6">
      <SubpageNav items={SOCIAL_TABS} />

      <div>
        <PageTitle>Social Media</PageTitle>
        <SectionDescription>
          {connectedCount > 0
            ? `${connectedCount} platform${connectedCount === 1 ? '' : 's'} connected`
            : 'Connect your social media accounts to get started'}
        </SectionDescription>
      </div>

      {/* AI Quick Actions — the main differentiator */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Button
          className="h-auto py-4 flex flex-col items-center gap-1"
          onClick={() => router.push('/dashboard')}
        >
          <span className="text-lg">✨</span>
          <span className="text-sm font-semibold">Create with AI</span>
          <span className="text-xs opacity-80">Tell Jasper what to post</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col items-center gap-1"
          onClick={() => router.push('/social/campaigns')}
        >
          <span className="text-lg">🚀</span>
          <span className="text-sm font-semibold">New Campaign</span>
          <span className="text-xs text-muted-foreground">Multi-platform campaign</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col items-center gap-1"
          onClick={() => router.push('/social/calendar')}
        >
          <span className="text-lg">📅</span>
          <span className="text-sm font-semibold">Calendar</span>
          <span className="text-xs text-muted-foreground">See what&apos;s scheduled</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col items-center gap-1"
          onClick={() => router.push('/social/analytics')}
        >
          <span className="text-lg">📊</span>
          <span className="text-sm font-semibold">Analytics</span>
          <span className="text-xs text-muted-foreground">See performance</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Platforms Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Your Platforms</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 rounded bg-surface-elevated animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  {connectedPlatforms.map((p) => {
                    const meta = PLATFORM_META[p.platform];
                    return (
                      <Link
                        key={p.platform}
                        href={`/social/platforms/${p.platform}`}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-elevated transition-colors"
                      >
                        <div
                          className="w-7 h-7 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: meta.color }}
                        >
                          {meta.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-foreground truncate">{meta.label}</div>
                          {p.handle && <div className="text-xs text-muted-foreground truncate">@{p.handle}</div>}
                        </div>
                        <div className="w-2 h-2 rounded-full bg-success flex-shrink-0" />
                      </Link>
                    );
                  })}

                  {unconnectedPlatforms.length > 0 && (
                    <>
                      <div className="border-t border-border-light my-2" />
                      <div className="text-xs text-muted-foreground px-2 py-1">Not connected</div>
                      {unconnectedPlatforms.map((p) => {
                        const meta = PLATFORM_META[p.platform];
                        return (
                          <div
                            key={p.platform}
                            className="flex items-center gap-2 p-2 rounded-lg opacity-50"
                          >
                            <div
                              className="w-7 h-7 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: meta.color }}
                            >
                              {meta.icon}
                            </div>
                            <span className="text-sm text-muted-foreground truncate">{meta.label}</span>
                          </div>
                        );
                      })}
                      <Link href="/settings/integrations" className="block mt-2">
                        <Button variant="outline" size="sm" className="w-full text-xs">
                          Connect More Platforms
                        </Button>
                      </Link>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Content Feed */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Recent Activity</CardTitle>
                <Link href="/social/calendar" className="text-xs text-primary font-medium">
                  View Calendar →
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 rounded bg-surface-elevated animate-pulse" />
                  ))}
                </div>
              ) : recentPosts.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="text-3xl mb-3 opacity-40">📝</div>
                  <div className="text-sm font-medium text-foreground mb-1">No posts yet</div>
                  <div className="text-xs text-muted-foreground mb-4">
                    Create your first post by clicking &ldquo;Create with AI&rdquo; above, or go to any platform and compose directly.
                  </div>
                  <Button size="sm" onClick={() => router.push('/dashboard')}>
                    Create Your First Post with AI
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentPosts.map((post) => {
                    const meta = PLATFORM_META[post.platform as SocialPlatform];
                    const statusColors: Record<string, string> = {
                      published: 'text-success',
                      scheduled: 'text-primary',
                      draft: 'text-muted-foreground',
                      failed: 'text-destructive',
                    };
                    return (
                      <div
                        key={post.id}
                        className="flex items-start gap-3 p-3 rounded-lg border border-border-light hover:bg-surface-elevated transition-colors cursor-pointer"
                        onClick={() => {
                          if (meta) { router.push(`/social/platforms/${post.platform}`); }
                        }}
                      >
                        {meta && (
                          <div
                            className="w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: meta.color }}
                          >
                            {meta.icon}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-foreground line-clamp-2">{post.content}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs font-medium ${statusColors[post.status] ?? 'text-muted-foreground'}`}>
                              {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(post.publishedAt ?? post.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
