'use client';

/**
 * Social Media Hub — Platform-first landing page
 *
 * When a client opens Social Media, this is what they see:
 * their platforms as cards, each one clickable, with connection
 * status and quick actions. No jargon, no engineering dashboards.
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';
import { PLATFORM_META } from '@/lib/social/platform-config';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import SubpageNav from '@/components/ui/SubpageNav';
import { SOCIAL_TABS } from '@/lib/constants/subpage-nav';

interface PlatformStatus {
  platform: SocialPlatform;
  connected: boolean;
  accountName?: string;
  handle?: string;
  lastPostDate?: string;
  postsThisWeek?: number;
}

export default function SocialHubPage() {
  const authFetch = useAuthFetch();
  const [platforms, setPlatforms] = useState<PlatformStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPlatformStatus = useCallback(async () => {
    try {
      const res = await authFetch('/api/social/accounts');
      if (res.ok) {
        const data = (await res.json()) as { accounts?: Array<{ platform: string; status: string; accountName?: string; handle?: string }> };
        const accounts = data.accounts ?? [];

        const statuses: PlatformStatus[] = SOCIAL_PLATFORMS.map((p) => {
          const account = accounts.find((a) => a.platform === p && a.status === 'active');
          return {
            platform: p,
            connected: Boolean(account),
            accountName: account?.accountName,
            handle: account?.handle,
          };
        });

        setPlatforms(statuses);
      } else {
        setPlatforms(SOCIAL_PLATFORMS.map((p) => ({ platform: p, connected: false })));
      }
    } catch {
      setPlatforms(SOCIAL_PLATFORMS.map((p) => ({ platform: p, connected: false })));
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadPlatformStatus();
  }, [loadPlatformStatus]);

  const connectedCount = platforms.filter((p) => p.connected).length;

  return (
    <div className="p-8 space-y-6">
      <SubpageNav items={SOCIAL_TABS} />

      <div>
        <PageTitle>Social Media</PageTitle>
        <SectionDescription>
          {connectedCount > 0
            ? `${connectedCount} platform${connectedCount === 1 ? '' : 's'} connected. Click any platform to create content, view posts, or manage your account.`
            : 'Connect your social media accounts to start posting. Click any platform below to get started.'}
        </SectionDescription>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-card border border-border-light animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Connected Platforms */}
          {connectedCount > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3">Your Platforms</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {platforms.filter((p) => p.connected).map((p) => {
                  const meta = PLATFORM_META[p.platform];
                  return (
                    <Link key={p.platform} href={`/social/platforms/${p.platform}`}>
                      <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                        <CardContent className="pt-5 pb-5">
                          <div className="flex items-center gap-3 mb-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                              style={{ backgroundColor: meta.color }}
                            >
                              {meta.icon}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-sm text-foreground">{meta.label}</div>
                              {p.handle && (
                                <div className="text-xs text-muted-foreground truncate">@{p.handle}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-success font-medium">Connected</span>
                            <span className="text-xs text-primary font-medium">Open →</span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unconnected Platforms */}
          {platforms.some((p) => !p.connected) && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">
                {connectedCount > 0 ? 'Available Platforms' : 'Connect a Platform to Get Started'}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {platforms.filter((p) => !p.connected).map((p) => {
                  const meta = PLATFORM_META[p.platform];
                  return (
                    <Card key={p.platform} className="border-dashed">
                      <CardContent className="pt-5 pb-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0 opacity-60"
                            style={{ backgroundColor: meta.color }}
                          >
                            {meta.icon}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-foreground">{meta.label}</div>
                            <div className="text-xs text-muted-foreground">Not connected</div>
                          </div>
                        </div>
                        <Link href="/settings/integrations">
                          <Button variant="outline" size="sm" className="w-full">
                            Connect {meta.label}
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            <Link href="/social/calendar">
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="pt-5 pb-5 text-center">
                  <div className="text-2xl mb-2">📅</div>
                  <div className="font-semibold text-sm text-foreground">Content Calendar</div>
                  <div className="text-xs text-muted-foreground mt-1">See what&apos;s scheduled</div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/social/analytics">
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="pt-5 pb-5 text-center">
                  <div className="text-2xl mb-2">📊</div>
                  <div className="font-semibold text-sm text-foreground">Analytics</div>
                  <div className="text-xs text-muted-foreground mt-1">See how your content performed</div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/social/campaigns">
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="pt-5 pb-5 text-center">
                  <div className="text-2xl mb-2">🚀</div>
                  <div className="font-semibold text-sm text-foreground">Campaigns</div>
                  <div className="text-xs text-muted-foreground mt-1">Create a multi-platform campaign</div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
