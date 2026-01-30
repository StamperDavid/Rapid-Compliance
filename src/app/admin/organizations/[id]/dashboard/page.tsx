'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Shield,
  ArrowLeft,
  LayoutDashboard,
  Users,
  Briefcase,
  DollarSign,
  TrendingUp,
  Activity,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { logger } from '@/lib/logger/logger';
import type { Organization } from '@/types/organization';

interface DashboardStats {
  leadsCount: number;
  dealsCount: number;
  pipelineValue: number;
  winRate: number;
  recentActivity: number;
}

/**
 * Admin Support View: Organization Dashboard
 * Quick overview dashboard for any tenant organization.
 */
export default function AdminOrgDashboardPage() {
  const { hasPermission } = useAdminAuth();
  const params = useParams();
  const orgId = params.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const canManageOrg = hasPermission('canEditOrganizations');

  const primaryColor = '#6366f1';
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  useEffect(() => {
    async function loadOrganization() {
      try {
        setOrgLoading(true);
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        const org = await FirestoreService.get<Organization>(COLLECTIONS.ORGANIZATIONS, orgId);
        setOrganization(org);
      } catch (error) {
        logger.error('Failed to load organization:', error instanceof Error ? error : new Error(String(error)), { file: 'admin/organizations/[id]/dashboard/page.tsx' });
      } finally {
        setOrgLoading(false);
      }
    }
    void loadOrganization();
  }, [orgId]);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        // Load stats from multiple endpoints
        const [leadsRes, dealsRes, pipelineRes] = await Promise.all([
          fetch(`/api/workspace/${orgId}/leads?workspaceId=default&pageSize=1`).then(r => r.json() as Promise<{ total?: number; data?: unknown[] }>),
          fetch(`/api/workspace/${orgId}/deals?workspaceId=default&pageSize=1`).then(r => r.json() as Promise<{ total?: number; data?: unknown[] }>),
          fetch(`/api/analytics/pipeline?orgId=${orgId}&period=30d`).then(r => r.json() as Promise<{ analytics?: { totalValue?: number; winRate?: number } }>),
        ]);

        setStats({
          leadsCount: leadsRes.total ?? leadsRes.data?.length ?? 0,
          dealsCount: dealsRes.total ?? dealsRes.data?.length ?? 0,
          pipelineValue: pipelineRes.analytics?.totalValue ?? 0,
          winRate: pipelineRes.analytics?.winRate ?? 0,
          recentActivity: 0,
        });
      } catch (error) {
        logger.error('Failed to load dashboard stats:', error instanceof Error ? error : new Error(String(error)), { file: 'admin/organizations/[id]/dashboard/page.tsx' });
      } finally {
        setLoading(false);
      }
    };
    void loadStats();
  }, [orgId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  const quickLinks = [
    { label: 'Leads', href: `/admin/organizations/${orgId}/leads`, icon: Users, color: '#3b82f6' },
    { label: 'Deals', href: `/admin/organizations/${orgId}/deals`, icon: Briefcase, color: '#8b5cf6' },
    { label: 'Analytics', href: `/admin/organizations/${orgId}/analytics`, icon: TrendingUp, color: '#10b981' },
    { label: 'Workflows', href: `/admin/organizations/${orgId}/workflows`, icon: Activity, color: '#f59e0b' },
  ];

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#000' }}>
      <div className="max-w-7xl mx-auto">
        {/* Back Navigation */}
        <Link
          href={`/admin/organizations/${orgId}`}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Organization
        </Link>

        {/* God Mode Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            backgroundColor: '#1a1a2e',
            border: `1px solid ${primaryColor}40`,
            borderRadius: '0.75rem',
            padding: '1rem 1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div style={{ width: '40px', height: '40px', borderRadius: '0.5rem', backgroundColor: `${primaryColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield className="w-5 h-5" style={{ color: primaryColor }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>Admin Support View</div>
            <div style={{ fontSize: '0.75rem', color: '#666' }}>
              Dashboard for: {orgLoading ? 'Loading...' : (organization?.name ?? orgId)}
            </div>
          </div>
          {canManageOrg && (
            <div className="px-3 py-1 bg-emerald-500/20 rounded-full text-xs text-emerald-400 font-semibold">Full Access</div>
          )}
        </motion.div>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: primaryColor }}>
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Dashboard</h1>
              <p className="text-gray-400">Quick overview of organization performance</p>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 rounded-xl" style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/20">
                    <Users className="w-5 h-5 text-blue-400" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-white">{stats?.leadsCount ?? 0}</div>
                <div className="text-sm text-gray-400">Total Leads</div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-6 rounded-xl" style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/20">
                    <Briefcase className="w-5 h-5 text-purple-400" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-white">{stats?.dealsCount ?? 0}</div>
                <div className="text-sm text-gray-400">Active Deals</div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-6 rounded-xl" style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/20">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-white">{formatCurrency(stats?.pipelineValue ?? 0)}</div>
                <div className="text-sm text-gray-400">Pipeline Value</div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="p-6 rounded-xl" style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-500/20">
                    <TrendingUp className="w-5 h-5 text-amber-400" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-white">{(stats?.winRate ?? 0).toFixed(1)}%</div>
                <div className="text-sm text-gray-400">Win Rate</div>
              </motion.div>
            </div>

            {/* Quick Links */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="p-6 rounded-xl" style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}>
              <h3 className="text-lg font-semibold text-white mb-4">Quick Access</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {quickLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="p-4 rounded-xl transition-all hover:scale-[1.02] flex items-center gap-4"
                      style={{ backgroundColor: '#0a0a0a', border: `1px solid ${borderColor}` }}
                    >
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${link.color}20` }}>
                        <Icon className="w-5 h-5" style={{ color: link.color }} />
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-medium">{link.label}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-500" />
                    </Link>
                  );
                })}
              </div>
            </motion.div>

            {/* Organization Info */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="p-6 rounded-xl" style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}>
              <h3 className="text-lg font-semibold text-white mb-4">Organization Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Name</div>
                  <div className="text-white font-medium">{organization?.name ?? '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">Plan</div>
                  <div className="text-white font-medium capitalize">{organization?.plan ?? '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">Status</div>
                  <div className="text-white font-medium capitalize">{organization?.status ?? '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">Slug</div>
                  <div className="text-white font-medium">{organization?.slug ?? '-'}</div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
