'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft, Brain, Loader2, Bot, Database, Sparkles } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { logger } from '@/lib/logger/logger';
import type { Organization } from '@/types/organization';

/**
 * Admin Support View: AI Agent Training
 */
export default function AdminOrgAgentTrainingPage() {
  const { hasPermission } = useAdminAuth();
  const params = useParams();
  const orgId = params.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  const canManageOrg = hasPermission('canEditOrganizations');
  const primaryColor = '#6366f1';
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  useEffect(() => {
    async function loadData() {
      try {
        setOrgLoading(true);
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        const org = await FirestoreService.get<Organization>(COLLECTIONS.ORGANIZATIONS, orgId);
        setOrganization(org);
      } catch (error) {
        logger.error('Failed to load organization:', error instanceof Error ? error : new Error(String(error)), { file: 'admin/organizations/[id]/agent-training/page.tsx' });
      } finally { setOrgLoading(false); setLoading(false); }
    }
    void loadData();
  }, [orgId]);

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#000' }}>
      <div className="max-w-7xl mx-auto">
        <Link href={`/admin/organizations/${orgId}`} className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm mb-4"><ArrowLeft className="w-4 h-4" /> Back to Organization</Link>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ backgroundColor: '#1a1a2e', border: `1px solid ${primaryColor}40`, borderRadius: '0.75rem', padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '0.5rem', backgroundColor: `${primaryColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield className="w-5 h-5" style={{ color: primaryColor }} /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>Admin Support View</div><div style={{ fontSize: '0.75rem', color: '#666' }}>Agent training for: {orgLoading ? 'Loading...' : (organization?.name ?? orgId)}</div></div>
          {canManageOrg && <div className="px-3 py-1 bg-emerald-500/20 rounded-full text-xs text-emerald-400 font-semibold">Full Access</div>}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: '#8b5cf6' }}><Brain className="w-6 h-6 text-white" /></div>
            <div><h1 className="text-3xl font-bold text-white">AI Agent Training</h1><p className="text-gray-400">Custom AI model training and fine-tuning</p></div>
          </div>
        </motion.div>

        {loading ? <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div> : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[{ icon: Bot, label: 'Active Models', value: '0', color: '#8b5cf6' }, { icon: Database, label: 'Training Data', value: '0 MB', color: '#3b82f6' }, { icon: Sparkles, label: 'Fine-tunes', value: '0', color: '#22c55e' }].map((item) => {
              const Icon = item.icon;
              return <div key={item.label} className="p-6 rounded-xl" style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${item.color}20` }}><Icon className="w-6 h-6" style={{ color: item.color }} /></div>
                <div className="text-2xl font-bold text-white mb-1">{item.value}</div>
                <div className="text-sm text-gray-500">{item.label}</div>
              </div>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
