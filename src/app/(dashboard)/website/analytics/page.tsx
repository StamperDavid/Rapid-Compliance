/**
 * Website Analytics
 *
 * Honest analytics surface — shows real content counts (pages, blog
 * posts, forms) from Firestore, plus empty-state cards for traffic
 * data that requires a connected analytics source (GA4 / Plausible /
 * Vercel Analytics). Does NOT fabricate visitor metrics.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText,
  PenSquare,
  ClipboardList,
  CheckCircle2,
  Activity,
  TrendingUp,
  MapPin,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import {
  PageTitle,
  SectionDescription,
  SectionTitle,
  CardTitle as TypographyCardTitle,
} from '@/components/ui/typography';
import { Button } from '@/components/ui/button';

interface AnalyticsData {
  pageCount: number;
  publishedPageCount: number;
  draftPageCount: number;
  blogPostCount: number;
  formCount: number;
  generatedAt: string;
}

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  href?: string;
  hint?: string;
}

function StatCard({ label, value, icon: Icon, href, hint }: StatCardProps) {
  const card = (
    <div className="bg-card border border-border-strong rounded-2xl p-6 transition hover:border-border-stronger">
      <div className="flex items-start justify-between mb-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
        {href && <ExternalLink className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="text-3xl font-semibold text-foreground">{value}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
      {hint && (
        <div className="text-xs text-muted-foreground mt-2">{hint}</div>
      )}
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

interface EmptyStateCardProps {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  icon: React.ElementType;
}

function EmptyStateCard({
  title,
  description,
  ctaLabel,
  ctaHref,
  icon: Icon,
}: EmptyStateCardProps) {
  return (
    <div className="bg-card border border-border-strong rounded-2xl p-6">
      <div className="flex items-start gap-4">
        <div className="bg-surface-elevated rounded-xl p-3">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <TypographyCardTitle>{title}</TypographyCardTitle>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {description}
          </p>
          <Link href={ctaHref}>
            <Button variant="outline" size="sm">
              {ctaLabel}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function WebsiteAnalyticsPage() {
  const authFetch = useAuthFetch();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await authFetch('/api/website/analytics');
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Request failed: ${response.status}`);
      }
      const body = (await response.json()) as AnalyticsData;
      setData(body);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load analytics';
      setError(message);
      logger.error('Website analytics load failed', err instanceof Error ? err : undefined);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  return (
    <div className="p-8 space-y-6">
      <div>
        <PageTitle>Website Analytics</PageTitle>
        <SectionDescription>
          Real-time content + structure metrics. Visitor traffic data
          requires a connected analytics source — see the empty-state
          cards below to set one up.
        </SectionDescription>
      </div>

      {error && (
        <div className="bg-card border border-border-strong rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-foreground">
              Couldn&apos;t load content counts
            </div>
            <div className="text-sm text-muted-foreground mt-1">{error}</div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadAnalytics()}
              className="mt-3"
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      <section>
        <SectionTitle>Content overview</SectionTitle>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Live counts from Firestore.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total pages"
            value={loading ? '—' : (data?.pageCount ?? 0)}
            icon={FileText}
            href="/website/pages"
            hint={
              data
                ? `${data.publishedPageCount} published · ${data.draftPageCount} draft`
                : undefined
            }
          />
          <StatCard
            label="Published pages"
            value={loading ? '—' : (data?.publishedPageCount ?? 0)}
            icon={CheckCircle2}
            href="/website/pages"
          />
          <StatCard
            label="Blog posts"
            value={loading ? '—' : (data?.blogPostCount ?? 0)}
            icon={PenSquare}
            href="/website/blog"
          />
          <StatCard
            label="Forms"
            value={loading ? '—' : (data?.formCount ?? 0)}
            icon={ClipboardList}
            href="/forms"
          />
        </div>
      </section>

      <section>
        <SectionTitle>Traffic data</SectionTitle>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Visitor metrics live in your analytics provider. Connect one
          to populate these panels.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <EmptyStateCard
            icon={Activity}
            title="Traffic over time"
            description="Sessions, unique visitors, and bounce rate. Connect Google Analytics 4, Plausible, or Vercel Analytics."
            ctaLabel="Set up integration"
            ctaHref="/integrations"
          />
          <EmptyStateCard
            icon={TrendingUp}
            title="Top pages by views"
            description="Page-level traffic ranking, time-on-page, and exit rates — populated from your analytics provider."
            ctaLabel="Set up integration"
            ctaHref="/integrations"
          />
          <EmptyStateCard
            icon={MapPin}
            title="Traffic sources"
            description="Referrers, organic search keywords, and campaign attribution."
            ctaLabel="Set up integration"
            ctaHref="/integrations"
          />
          <EmptyStateCard
            icon={ClipboardList}
            title="Conversions"
            description="Form submissions are tracked in the Forms hub. Combine with traffic data once an analytics source is connected."
            ctaLabel="Open Forms hub"
            ctaHref="/forms"
          />
        </div>
      </section>

      <section>
        <SectionTitle>Related dashboards</SectionTitle>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Other surfaces that touch website performance.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/website/seo"
            className="bg-card border border-border-strong rounded-2xl p-4 transition hover:border-border-stronger flex items-center justify-between"
          >
            <div>
              <div className="text-sm font-medium text-foreground">
                SEO management
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                robots.txt, llms.txt, AI bot access
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            href="/website/audit-log"
            className="bg-card border border-border-strong rounded-2xl p-4 transition hover:border-border-stronger flex items-center justify-between"
          >
            <div>
              <div className="text-sm font-medium text-foreground">
                Audit log
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Page edits, publishes, deletions
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            href="/website/domains"
            className="bg-card border border-border-strong rounded-2xl p-4 transition hover:border-border-stronger flex items-center justify-between"
          >
            <div>
              <div className="text-sm font-medium text-foreground">
                Domains
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Custom domain config + DNS
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>
      </section>
    </div>
  );
}
