'use client';

/**
 * Campaigns Dashboard
 *
 * Lists all orchestrated campaigns with status filters, deliverable progress,
 * and click-through to the Mission Control review interface.
 *
 * @route /campaigns
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket,
  Plus,
  Eye,
  FileText,
  Video,
  Mail,
  Image,
  Share2,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  BarChart3,
  ArrowRight,
  Target,
  Calendar,
  BookOpen,
  Megaphone,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import type { Campaign, CampaignStatus, CampaignDeliverable } from '@/types/campaign';

// ============================================================================
// TYPES
// ============================================================================

interface CampaignWithDeliverables extends Campaign {
  deliverableItems?: CampaignDeliverable[];
}

interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  iconName: string;
  deliverableTypes: string[];
  exampleTopics: string[];
}

interface CampaignsApiResponse {
  success: boolean;
  data?: {
    campaigns: Campaign[];
    hasMore: boolean;
  };
}

interface CampaignDetailResponse {
  success: boolean;
  data?: CampaignWithDeliverables;
}

type StatusFilter = 'all' | CampaignStatus;

// ============================================================================
// TEMPLATE ICON MAP
// ============================================================================

const TEMPLATE_ICON_MAP: Record<string, React.ReactNode> = {
  Rocket: <Rocket className="w-5 h-5" />,
  FileText: <FileText className="w-5 h-5" />,
  Target: <Target className="w-5 h-5" />,
  Video: <Video className="w-5 h-5" />,
  Calendar: <Calendar className="w-5 h-5" />,
  BookOpen: <BookOpen className="w-5 h-5" />,
  Megaphone: <Megaphone className="w-5 h-5" />,
  Mail: <Mail className="w-5 h-5" />,
};

// ============================================================================
// STATUS CONFIG
// ============================================================================

const STATUS_CONFIG: Record<CampaignStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  researching:    { label: 'Researching',    color: 'text-blue-400',    bgColor: 'bg-blue-500/15',    borderColor: 'border-blue-500/30' },
  strategizing:   { label: 'Strategizing',   color: 'text-purple-400',  bgColor: 'bg-purple-500/15',  borderColor: 'border-purple-500/30' },
  producing:      { label: 'Producing',      color: 'text-amber-400',   bgColor: 'bg-amber-500/15',   borderColor: 'border-amber-500/30' },
  pending_review: { label: 'Pending Review', color: 'text-orange-400',  bgColor: 'bg-orange-500/15',  borderColor: 'border-orange-500/30' },
  approved:       { label: 'Approved',       color: 'text-emerald-400', bgColor: 'bg-emerald-500/15', borderColor: 'border-emerald-500/30' },
  published:      { label: 'Published',      color: 'text-green-400',   bgColor: 'bg-green-500/15',   borderColor: 'border-green-500/30' },
};

const DELIVERABLE_ICONS: Record<string, React.ReactNode> = {
  blog:        <FileText className="w-3.5 h-3.5" />,
  video:       <Video className="w-3.5 h-3.5" />,
  email:       <Mail className="w-3.5 h-3.5" />,
  image:       <Image className="w-3.5 h-3.5" />,
  social_post: <Share2 className="w-3.5 h-3.5" />,
  research:    <Search className="w-3.5 h-3.5" />,
  strategy:    <BarChart3 className="w-3.5 h-3.5" />,
};

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max).trimEnd()}...`;
}

// ============================================================================
// SKELETON LOADER
// ============================================================================

function CampaignCardSkeleton() {
  return (
    <div className="bg-surface-paper border border-border-light rounded-2xl p-6 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="h-6 w-2/5 bg-surface-elevated rounded" />
        <div className="h-6 w-24 bg-surface-elevated rounded-full" />
      </div>
      <div className="h-4 w-4/5 bg-surface-elevated rounded mb-6" />
      <div className="flex gap-2 mb-4">
        {[1, 2, 3].map(i => <div key={i} className="h-6 w-16 bg-surface-elevated rounded" />)}
      </div>
      <div className="h-2 w-full bg-surface-elevated rounded" />
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CampaignsPage() {
  const router = useRouter();
  const authFetch = useAuthFetch();

  const [campaigns, setCampaigns] = useState<CampaignWithDeliverables[]>([]);
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch campaigns from API
  const fetchCampaigns = useCallback(async (startAfter?: string) => {
    try {
      if (!startAfter) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const params = new URLSearchParams({ limit: '20' });
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (startAfter) {
        params.set('startAfter', startAfter);
      }

      const res = await authFetch(`/api/campaigns?${params}`);
      if (!res.ok) {
        throw new Error('Failed to fetch campaigns');
      }

      const json = await res.json() as CampaignsApiResponse;
      if (!json.success || !json.data) {
        throw new Error('Invalid response');
      }

      // Fetch deliverables for each campaign (in parallel, max 10)
      const campaignsWithDeliverables = await Promise.all(
        json.data.campaigns.map(async (campaign) => {
          try {
            const detailRes = await authFetch(`/api/campaigns/${campaign.id}`);
            if (detailRes.ok) {
              const detail = await detailRes.json() as CampaignDetailResponse;
              if (detail.success && detail.data) {
                return detail.data;
              }
            }
          } catch {
            // Fall back to campaign without deliverables
          }
          return { ...campaign, deliverableItems: [] };
        })
      );

      if (startAfter) {
        setCampaigns(prev => [...prev, ...campaignsWithDeliverables]);
      } else {
        setCampaigns(campaignsWithDeliverables);
      }
      setHasMore(json.data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [authFetch, statusFilter]);

  useEffect(() => {
    void fetchCampaigns();
  }, [fetchCampaigns]);

  // Load campaign templates
  useEffect(() => {
    async function loadTemplates() {
      try {
        const res = await authFetch('/api/campaigns/templates');
        if (res.ok) {
          const data = await res.json() as { templates?: CampaignTemplate[] };
          if (data.templates?.length) {
            setTemplates(data.templates);
          }
        }
      } catch {
        // Templates are optional — page works without them
      }
    }
    void loadTemplates();
  }, [authFetch]);

  // Computed stats
  const stats = useMemo(() => {
    const total = campaigns.length;
    const pendingReview = campaigns.filter(c => c.status === 'pending_review').length;
    const published = campaigns.filter(c => c.status === 'published').length;
    const totalDeliverables = campaigns.reduce((sum, c) => sum + (c.deliverableItems?.length ?? c.deliverables.length), 0);
    return { total, pendingReview, published, totalDeliverables };
  }, [campaigns]);

  // Filter tabs
  const filterTabs: { value: StatusFilter; label: string; count?: number }[] = [
    { value: 'all', label: 'All', count: stats.total },
    { value: 'pending_review', label: 'Pending Review', count: stats.pendingReview },
    { value: 'producing', label: 'In Production' },
    { value: 'approved', label: 'Approved' },
    { value: 'published', label: 'Published', count: stats.published },
  ];

  return (
    <div className="min-h-screen bg-surface-main p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/25">
            <Rocket className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Campaigns</h1>
            <p className="text-[var(--color-text-secondary)] text-sm mt-1">
              Multi-channel content campaigns orchestrated by Jasper
            </p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowTemplates(prev => !prev)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-secondary text-white rounded-xl font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-shadow"
        >
          {showTemplates ? <ChevronRight className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {showTemplates ? 'Close' : 'New Campaign'}
        </motion.button>
      </motion.div>

      {/* Campaign Templates */}
      <AnimatePresence>
        {showTemplates && templates.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8 overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Choose a Template</h2>
              <span className="text-sm text-[var(--color-text-secondary)]">or ask Jasper to create a custom campaign</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {templates.map((template, i) => (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    const topic = template.exampleTopics[0] ?? template.name;
                    router.push(`/mission-control?prompt=${encodeURIComponent(`Create a ${template.name.toLowerCase()} campaign about: ${topic}`)}`);
                  }}
                  className="bg-surface-paper border border-border-light rounded-xl p-4 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group"
                >
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/15 to-secondary/15 flex items-center justify-center mb-3 text-primary group-hover:from-primary/25 group-hover:to-secondary/25 transition-colors">
                    {TEMPLATE_ICON_MAP[template.iconName] ?? <Rocket className="w-5 h-5" />}
                  </div>
                  <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">{template.name}</div>
                  <div className="text-xs text-[var(--color-text-secondary)] line-clamp-2 mb-3">{template.description}</div>
                  <div className="flex gap-1">
                    {template.deliverableTypes.slice(0, 4).map(type => (
                      <span key={type} className="px-1.5 py-0.5 text-[10px] rounded bg-surface-elevated text-[var(--color-text-disabled)] border border-border-light">
                        {type.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="mt-3 text-center">
              <button
                onClick={() => router.push('/mission-control')}
                className="text-sm text-primary hover:underline"
              >
                Or start a custom campaign with Jasper
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Campaigns', value: stats.total, icon: <Rocket className="w-5 h-5 text-primary" /> },
          { label: 'Pending Review', value: stats.pendingReview, icon: <Clock className="w-5 h-5 text-orange-400" /> },
          { label: 'Published', value: stats.published, icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" /> },
          { label: 'Total Deliverables', value: stats.totalDeliverables, icon: <BarChart3 className="w-5 h-5 text-blue-400" /> },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-surface-paper border border-border-light rounded-xl p-4 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-surface-elevated flex items-center justify-center">
              {stat.icon}
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">{stat.value}</div>
              <div className="text-xs text-[var(--color-text-secondary)]">{stat.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {filterTabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
              ${statusFilter === tab.value
                ? 'bg-primary text-white shadow-md shadow-primary/25'
                : 'bg-surface-paper text-[var(--color-text-secondary)] hover:bg-surface-elevated border border-border-light'
              }
            `}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`ml-1.5 text-xs ${statusFilter === tab.value ? 'text-white/70' : 'text-[var(--color-text-disabled)]'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 p-4 rounded-xl bg-error/10 border border-error/30 text-error flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </motion.div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid gap-4">
          {[1, 2, 3, 4].map(i => <CampaignCardSkeleton key={i} />)}
        </div>
      )}

      {/* Empty State */}
      {!loading && campaigns.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16 bg-surface-paper rounded-2xl border border-border-light"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-6">
            <Rocket className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">No campaigns yet</h3>
          <p className="text-[var(--color-text-secondary)] mb-6 max-w-md mx-auto">
            Ask Jasper to orchestrate a campaign and he&apos;ll research, strategize, and produce blog posts, videos, social content, and emails all at once.
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/mission-control')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-xl font-medium shadow-lg shadow-primary/25"
          >
            <Plus className="w-5 h-5" />
            Create Your First Campaign
          </motion.button>
        </motion.div>
      )}

      {/* Campaign Cards */}
      {!loading && campaigns.length > 0 && (
        <AnimatePresence mode="popLayout">
          <div className="grid gap-4">
            {campaigns.map((campaign, index) => {
              const deliverables = campaign.deliverableItems ?? [];
              const approved = deliverables.filter(d => d.status === 'approved' || d.status === 'published').length;
              const pending = deliverables.filter(d => d.status === 'pending_review').length;
              const total = deliverables.length || campaign.deliverables.length;
              const progressPct = total > 0 ? Math.round((approved / total) * 100) : 0;
              const statusInfo = STATUS_CONFIG[campaign.status];

              // Group deliverables by type
              const typeGroups = deliverables.reduce<Record<string, number>>((acc, d) => {
                acc[d.type] = (acc[d.type] ?? 0) + 1;
                return acc;
              }, {});

              return (
                <motion.div
                  key={campaign.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.04 }}
                  whileHover={{ scale: 1.005 }}
                  onClick={() => router.push(`/mission-control?campaign=${campaign.id}`)}
                  className="bg-surface-paper border border-border-light rounded-2xl p-6 cursor-pointer hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all group"
                >
                  {/* Row 1: Title + Status */}
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] group-hover:text-primary transition-colors line-clamp-1 flex-1 mr-4">
                      {truncate(campaign.brief, 80)}
                    </h3>
                    <span className={`
                      px-3 py-1 rounded-full text-xs font-semibold border shrink-0
                      ${statusInfo.bgColor} ${statusInfo.color} ${statusInfo.borderColor}
                    `}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Row 2: Date + Deliverable Type Tags */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs text-[var(--color-text-disabled)]">
                      Created {formatDate(campaign.createdAt)}
                    </span>
                    <div className="flex gap-1.5">
                      {Object.entries(typeGroups).map(([type, count]) => (
                        <span
                          key={type}
                          className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-surface-elevated text-[var(--color-text-secondary)] border border-border-light"
                        >
                          {DELIVERABLE_ICONS[type] ?? <FileText className="w-3.5 h-3.5" />}
                          {count}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Row 3: Progress Bar + Stats */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-2 rounded-full bg-surface-elevated overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 0.6, delay: index * 0.04 }}
                      />
                    </div>
                    <div className="flex items-center gap-3 text-xs shrink-0">
                      <span className="text-emerald-400 font-medium">{approved} approved</span>
                      {pending > 0 && (
                        <span className="text-orange-400 font-medium">{pending} pending</span>
                      )}
                      <span className="text-[var(--color-text-disabled)]">{total} total</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[var(--color-text-disabled)] group-hover:text-primary transition-colors shrink-0" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}

      {/* Load More */}
      {hasMore && !loading && (
        <div className="flex justify-center mt-6">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              const lastId = campaigns[campaigns.length - 1]?.id;
              if (lastId) {
                void fetchCampaigns(lastId);
              }
            }}
            disabled={loadingMore}
            className="flex items-center gap-2 px-6 py-2.5 bg-surface-paper border border-border-light rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:bg-surface-elevated transition-colors"
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                Load More Campaigns
              </>
            )}
          </motion.button>
        </div>
      )}
    </div>
  );
}
