'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Shield,
  ArrowLeft,
  Bot,
  Users,
  Activity,
  Cpu,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Pause
} from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useSystemStatus } from '@/hooks/useSystemStatus';
import { logger } from '@/lib/logger/logger';
import type { Organization } from '@/types/organization';
import type { SystemAgentStatus } from '@/app/api/system/status/route';

/**
 * Admin Support View: AI Workforce
 * View AI agent workforce for any tenant organization.
 */
export default function AdminOrgWorkforcePage() {
  const { hasPermission } = useAdminAuth();
  const params = useParams();
  const orgId = params.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'hierarchy'>('grid');

  const { agents, loading, hierarchy } = useSystemStatus();

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
        logger.error('Failed to load organization:', error instanceof Error ? error : new Error(String(error)), { file: 'admin/organizations/[id]/workforce/page.tsx' });
      } finally {
        setOrgLoading(false);
      }
    }
    void loadOrganization();
  }, [orgId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'FUNCTIONAL':
      case 'EXECUTING':
        return <Activity className="w-4 h-4 text-emerald-400" />;
      case 'SHELL':
        return <Pause className="w-4 h-4 text-gray-400" />;
      case 'GHOST':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default:
        return <CheckCircle className="w-4 h-4 text-blue-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FUNCTIONAL':
      case 'EXECUTING':
        return { bg: '#22c55e20', border: '#22c55e40', text: '#4ade80' };
      case 'SHELL':
        return { bg: '#6b728020', border: '#6b728040', text: '#9ca3af' };
      case 'GHOST':
        return { bg: '#ef444420', border: '#ef444440', text: '#f87171' };
      default:
        return { bg: '#3b82f620', border: '#3b82f640', text: '#60a5fa' };
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'L1':
        return '#f59e0b';
      case 'L2':
        return '#8b5cf6';
      case 'L3':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  const activeAgents = agents?.filter((a) => a.status === 'FUNCTIONAL' || a.status === 'EXECUTING').length ?? 0;
  const totalAgents = agents?.length ?? 47;

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
              AI Workforce for: {orgLoading ? 'Loading...' : (organization?.name ?? orgId)}
            </div>
          </div>
          {canManageOrg && (
            <div className="px-3 py-1 bg-emerald-500/20 rounded-full text-xs text-emerald-400 font-semibold">Full Access</div>
          )}
        </motion.div>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: '#8b5cf6' }}>
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">AI Workforce</h1>
                <p className="text-gray-400">{activeAgents} of {totalAgents} agents active</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setView('grid')}
                className="px-4 py-2 rounded-xl font-medium transition-all"
                style={{
                  backgroundColor: view === 'grid' ? primaryColor : bgPaper,
                  border: `1px solid ${view === 'grid' ? primaryColor : borderColor}`,
                  color: '#fff'
                }}
              >
                Grid
              </button>
              <button
                onClick={() => setView('hierarchy')}
                className="px-4 py-2 rounded-xl font-medium transition-all"
                style={{
                  backgroundColor: view === 'hierarchy' ? primaryColor : bgPaper,
                  border: `1px solid ${view === 'hierarchy' ? primaryColor : borderColor}`,
                  color: '#fff'
                }}
              >
                Hierarchy
              </button>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Agents', value: totalAgents, icon: Bot, color: '#8b5cf6' },
            { label: 'Active', value: activeAgents, icon: Activity, color: '#22c55e' },
            { label: 'Orchestrator', value: hierarchy.orchestrator ? 1 : 0, icon: Users, color: '#f59e0b' },
            { label: 'Managers', value: hierarchy.managers.length, icon: Cpu, color: '#3b82f6' },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="p-4 rounded-xl" style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${stat.color}20` }}>
                    <Icon className="w-4 h-4" style={{ color: stat.color }} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            );
          })}
        </motion.div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        )}

        {/* Agent Grid */}
        {!loading && view === 'grid' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(agents ?? []).slice(0, 16).map((agent: SystemAgentStatus, idx: number) => {
              const statusColors = getStatusColor(agent.status);
              return (
                <div
                  key={agent.id ?? idx}
                  className="p-4 rounded-xl transition-all hover:scale-[1.02]"
                  style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${getTierColor(agent.tier)}20` }}
                      >
                        <Bot className="w-5 h-5" style={{ color: getTierColor(agent.tier) }} />
                      </div>
                      <div>
                        <div className="font-medium text-white text-sm">{agent.name}</div>
                        <div className="text-xs text-gray-500">{agent.role}</div>
                      </div>
                    </div>
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: getTierColor(agent.tier), color: '#000' }}
                    >
                      {agent.tier}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5" style={{ color: statusColors.text }}>
                      {getStatusIcon(agent.status)}
                      <span className="text-xs capitalize">{agent.status.toLowerCase()}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {agent.capabilities?.length ?? 0} capabilities
                    </div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Hierarchy View */}
        {!loading && view === 'hierarchy' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-6">
            {/* Orchestrator */}
            {hierarchy.orchestrator && (
              <div className="p-6 rounded-xl" style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 rounded-full text-sm font-bold" style={{ backgroundColor: '#f59e0b', color: '#000' }}>L1</span>
                  <span className="text-gray-400">Executive Leadership</span>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#0a0a0a', border: `1px solid ${borderColor}` }}>
                  <div className="font-medium text-white text-sm">{hierarchy.orchestrator.name}</div>
                  <div className="text-xs text-gray-500">{hierarchy.orchestrator.role}</div>
                </div>
              </div>
            )}

            {/* Managers */}
            <div className="p-6 rounded-xl" style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}>
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 rounded-full text-sm font-bold" style={{ backgroundColor: '#8b5cf6', color: '#000' }}>L2</span>
                <span className="text-gray-400">Department Managers ({hierarchy.managers.length} agents)</span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {hierarchy.managers.slice(0, 8).map((agent: SystemAgentStatus, idx: number) => (
                  <div key={agent.id ?? idx} className="p-3 rounded-lg" style={{ backgroundColor: '#0a0a0a', border: `1px solid ${borderColor}` }}>
                    <div className="font-medium text-white text-sm">{agent.name}</div>
                    <div className="text-xs text-gray-500">{agent.role}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Specialists */}
            <div className="p-6 rounded-xl" style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}>
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 rounded-full text-sm font-bold" style={{ backgroundColor: '#3b82f6', color: '#000' }}>L3</span>
                <span className="text-gray-400">Specialists ({hierarchy.specialists.length} agents)</span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {hierarchy.specialists.slice(0, 12).map((agent: SystemAgentStatus, idx: number) => (
                  <div key={agent.id ?? idx} className="p-3 rounded-lg" style={{ backgroundColor: '#0a0a0a', border: `1px solid ${borderColor}` }}>
                    <div className="font-medium text-white text-sm">{agent.name}</div>
                    <div className="text-xs text-gray-500">{agent.role}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
