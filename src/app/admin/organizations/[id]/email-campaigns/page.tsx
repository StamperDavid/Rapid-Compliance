'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft, Send, Loader2, ChevronDown } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { usePagination } from '@/hooks/usePagination';
import { logger } from '@/lib/logger/logger';
import type { Organization } from '@/types/organization';
import type { EmailCampaign } from '@/lib/email/campaign-service';

/**
 * Admin Support View: Email Campaigns
 * View email campaigns for any tenant organization.
 */
export default function AdminOrgEmailCampaignsPage() {
  const { hasPermission } = useAdminAuth();
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);

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
        logger.error('Failed to load organization:', error instanceof Error ? error : new Error(String(error)), { file: 'admin/organizations/[id]/email-campaigns/page.tsx' });
      } finally {
        setOrgLoading(false);
      }
    }
    void loadOrganization();
  }, [orgId]);

  const fetchCampaigns = useCallback(async (lastDoc?: unknown) => {
    const { getCampaigns } = await import('@/lib/email/campaign-service');
    return getCampaigns(orgId, undefined, { pageSize: 50, lastDoc: lastDoc as undefined });
  }, [orgId]);

  const { data: campaigns, loading, hasMore, loadMore, refresh } = usePagination<EmailCampaign>({ fetchFn: fetchCampaigns });

  useEffect(() => { void refresh(); }, [refresh]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string }> = {
      sent: { bg: '#22c55e20', text: '#4ade80' },
      scheduled: { bg: '#3b82f620', text: '#60a5fa' },
      sending: { bg: '#f59e0b20', text: '#fbbf24' },
      paused: { bg: '#ef444420', text: '#f87171' },
      draft: { bg: '#6b728020', text: '#9ca3af' },
    };
    const style = styles[status] ?? styles.draft;
    return <span className="px-2.5 py-1 rounded-lg text-xs font-medium capitalize" style={{ backgroundColor: style.bg, color: style.text }}>{status}</span>;
  };

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#000' }}>
      <div className="max-w-7xl mx-auto">
        <Link href={`/admin/organizations/${orgId}`} className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Organization
        </Link>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ backgroundColor: '#1a1a2e', border: `1px solid ${primaryColor}40`, borderRadius: '0.75rem', padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '0.5rem', backgroundColor: `${primaryColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield className="w-5 h-5" style={{ color: primaryColor }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>Admin Support View</div>
            <div style={{ fontSize: '0.75rem', color: '#666' }}>Email campaigns for: {orgLoading ? 'Loading...' : (organization?.name ?? orgId)}</div>
          </div>
          {canManageOrg && <div className="px-3 py-1 bg-emerald-500/20 rounded-full text-xs text-emerald-400 font-semibold">Full Access</div>}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: '#3b82f6' }}>
              <Send className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Email Campaigns</h1>
              <p className="text-gray-400">{campaigns.length} campaigns</p>
            </div>
          </div>
        </motion.div>

        {loading && campaigns.length === 0 ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
        ) : campaigns.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#3b82f610', border: '1px solid #ffffff10' }}>
              <Send className="w-10 h-10 text-gray-500" />
            </div>
            <div className="text-xl font-semibold text-white mb-2">No campaigns found</div>
            <div className="text-gray-400">This organization has no email campaigns.</div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((campaign) => (
              <div key={campaign.id} onClick={() => router.push(`/workspace/${orgId}/email/campaigns/${campaign.id}`)} className="p-5 rounded-xl cursor-pointer transition-all hover:scale-[1.02]" style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="font-semibold text-white">{campaign.name}</div>
                  {getStatusBadge(campaign.status)}
                </div>
                {campaign.subject && <div className="text-sm text-gray-400 mb-3 truncate">{campaign.subject}</div>}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  {campaign.stats?.sent !== undefined && <span>{campaign.stats.sent} sent</span>}
                  {campaign.stats?.openRate !== undefined && <span>{campaign.stats.openRate.toFixed(1)}% opens</span>}
                  {campaign.stats?.clickRate !== undefined && <span>{campaign.stats.clickRate.toFixed(1)}% clicks</span>}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {hasMore && <div className="mt-6 text-center"><button onClick={() => void loadMore()} disabled={loading} className="px-6 py-2.5 rounded-xl flex items-center gap-2 mx-auto disabled:opacity-50" style={{ backgroundColor: '#ffffff10', border: '1px solid #ffffff20', color: '#fff' }}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}{loading ? 'Loading...' : 'Load More'}</button></div>}
      </div>
    </div>
  );
}
