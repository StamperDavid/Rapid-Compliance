/**
 * AI Search Optimization Dashboard
 * Visual health monitor for robots.txt, llms.txt, schema markup, AI bot access
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
  Sparkles,
  Shield,
  FileText,
  Bot,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  Globe,
  Braces,
} from 'lucide-react';

interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  score: number;
  details: string;
}

interface AiBotStatus {
  userAgent: string;
  label: string;
  allowed: boolean;
}

interface SchemaCoverage {
  totalPages: number;
  pagesWithSchema: number;
  totalPosts: number;
  postsWithSchema: number;
  coveragePercent: number;
}

interface HealthReport {
  success: boolean;
  overallScore: number;
  grade: string;
  checks: HealthCheck[];
  aiBots: AiBotStatus[];
  schemaCoverage: SchemaCoverage;
  contentStats: {
    publishedPages: number;
    publishedPosts: number;
    totalContent: number;
  };
}

const statusConfig = {
  pass: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  warn: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  fail: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
};

const checkIcons: Record<string, typeof Sparkles> = {
  'Robots.txt': Bot,
  'llms.txt': Sparkles,
  'Schema Markup': Braces,
  'Sitemap': FileText,
  'SEO Metadata': Globe,
  'AI Bot Access': Shield,
};

export default function AISearchDashboardPage() {
  const authFetch = useAuthFetch();
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReport = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await authFetch('/api/admin/seo/ai-search');
      if (response.ok) {
        const data = await response.json() as HealthReport;
        setReport(data);
      }
    } catch {
      // Silently handle — UI shows empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-main)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--color-text-secondary)]">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Running AI search health check...</span>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-main)] flex items-center justify-center">
        <div className="text-[var(--color-text-secondary)]">Failed to load health report</div>
      </div>
    );
  }

  const gradeColor = report.overallScore >= 90 ? 'text-emerald-400'
    : report.overallScore >= 75 ? 'text-blue-400'
    : report.overallScore >= 60 ? 'text-amber-400'
    : 'text-red-400';

  const gradeGlow = report.overallScore >= 90 ? 'shadow-emerald-500/20'
    : report.overallScore >= 75 ? 'shadow-blue-500/20'
    : report.overallScore >= 60 ? 'shadow-amber-500/20'
    : 'shadow-red-500/20';

  return (
    <div className="min-h-screen bg-[var(--color-bg-main)] p-8">
      <div>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">AI Search Optimization</h1>
                <p className="text-[var(--color-text-secondary)]">Monitor how AI models discover and understand your site</p>
              </div>
            </div>
            <button
              onClick={() => void loadReport(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border-light bg-surface-paper hover:bg-surface-elevated transition-all text-sm text-[var(--color-text-secondary)]"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </motion.div>

        {/* Overall Score */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-8 mb-6"
        >
          <div className="flex items-center gap-8">
            <div className={`w-28 h-28 rounded-2xl bg-surface-elevated border border-border-light flex flex-col items-center justify-center shadow-lg ${gradeGlow}`}>
              <span className={`text-4xl font-bold ${gradeColor}`}>{report.grade}</span>
              <span className="text-xs text-[var(--color-text-disabled)] mt-1">{report.overallScore}/100</span>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">Overall Health Score</h2>
              <div className="w-full h-3 rounded-full bg-surface-elevated overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${report.overallScore}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${
                    report.overallScore >= 90 ? 'bg-emerald-500'
                    : report.overallScore >= 75 ? 'bg-blue-500'
                    : report.overallScore >= 60 ? 'bg-amber-500'
                    : 'bg-red-500'
                  }`}
                />
              </div>
              <div className="flex gap-6 mt-3 text-sm text-[var(--color-text-secondary)]">
                <span>{report.contentStats.publishedPages} published pages</span>
                <span>{report.contentStats.publishedPosts} blog posts</span>
                <span>{report.aiBots.filter(b => b.allowed).length}/{report.aiBots.length} AI bots allowed</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Health Checks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {report.checks.map((check, index) => {
            const config = statusConfig[check.status];
            const Icon = config.icon;
            const CheckIcon = checkIcons[check.name] ?? Globe;

            return (
              <motion.div
                key={check.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                className={`rounded-xl ${config.bg} border ${config.border} p-5`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CheckIcon className={`w-4 h-4 ${config.color}`} />
                    <span className="font-medium text-[var(--color-text-primary)]">{check.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Icon className={`w-4 h-4 ${config.color}`} />
                    <span className={`text-sm font-semibold ${config.color}`}>{check.score}</span>
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{check.details}</p>
              </motion.div>
            );
          })}
        </div>

        {/* AI Bot Access Matrix */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">AI Bot Access Matrix</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {report.aiBots.map((bot) => (
              <div
                key={bot.userAgent}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border ${
                  bot.allowed
                    ? 'bg-emerald-500/10 border-emerald-500/20'
                    : 'bg-red-500/10 border-red-500/20'
                }`}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  bot.allowed ? 'bg-emerald-400' : 'bg-red-400'
                }`} />
                <span className="text-sm text-[var(--color-text-primary)] truncate">{bot.label}</span>
              </div>
            ))}
          </div>

          <p className="mt-3 text-xs text-[var(--color-text-disabled)]">
            Manage AI bot access in SEO Settings. Blocked bots receive a Disallow directive in robots.txt.
          </p>
        </motion.div>

        {/* Schema Coverage Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Braces className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Schema Markup Coverage</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-surface-elevated border border-border-light p-4 text-center">
              <div className="text-3xl font-bold text-[var(--color-text-primary)]">{report.schemaCoverage.coveragePercent}%</div>
              <div className="text-sm text-[var(--color-text-secondary)] mt-1">Overall Coverage</div>
            </div>
            <div className="rounded-xl bg-surface-elevated border border-border-light p-4 text-center">
              <div className="text-3xl font-bold text-[var(--color-text-primary)]">
                {report.schemaCoverage.pagesWithSchema}/{report.schemaCoverage.totalPages}
              </div>
              <div className="text-sm text-[var(--color-text-secondary)] mt-1">Pages with JSON-LD</div>
            </div>
            <div className="rounded-xl bg-surface-elevated border border-border-light p-4 text-center">
              <div className="text-3xl font-bold text-[var(--color-text-primary)]">
                {report.schemaCoverage.postsWithSchema}/{report.schemaCoverage.totalPosts}
              </div>
              <div className="text-sm text-[var(--color-text-secondary)] mt-1">Blog Posts with JSON-LD</div>
            </div>
          </div>

          <p className="mt-4 text-xs text-[var(--color-text-disabled)]">
            JSON-LD structured data is auto-generated for all published pages and blog posts. Schema types include Organization, WebSite, WebPage, BlogPosting, and BreadcrumbList.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
