'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft, Phone, Loader2, PhoneCall, PhoneMissed, PhoneIncoming } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { logger } from '@/lib/logger/logger';
import type { Organization } from '@/types/organization';

/**
 * Admin Support View: Call Logs
 * View call activity for any tenant organization.
 */
export default function AdminOrgCallsPage() {
  const { hasPermission } = useAdminAuth();
  const params = useParams();
  const orgId = params.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [calls] = useState<Array<{ id: string; contact: string; duration: number; type: string; status: string; timestamp: string }>>([]);
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
        logger.error('Failed to load organization:', error instanceof Error ? error : new Error(String(error)), { file: 'admin/organizations/[id]/calls/page.tsx' });
      } finally {
        setOrgLoading(false);
        setLoading(false);
      }
    }
    void loadData();
  }, [orgId]);

  const getCallIcon = (type: string) => {
    switch (type) {
      case 'outgoing': return <PhoneCall className="w-4 h-4 text-blue-400" />;
      case 'incoming': return <PhoneIncoming className="w-4 h-4 text-emerald-400" />;
      case 'missed': return <PhoneMissed className="w-4 h-4 text-red-400" />;
      default: return <Phone className="w-4 h-4 text-gray-400" />;
    }
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
            <div style={{ fontSize: '0.75rem', color: '#666' }}>Call logs for: {orgLoading ? 'Loading...' : (organization?.name ?? orgId)}</div>
          </div>
          {canManageOrg && <div className="px-3 py-1 bg-emerald-500/20 rounded-full text-xs text-emerald-400 font-semibold">Full Access</div>}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: '#22c55e' }}>
              <Phone className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Call Logs</h1>
              <p className="text-gray-400">Voice call activity and recordings</p>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
        ) : calls.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#22c55e10', border: '1px solid #ffffff10' }}>
              <Phone className="w-10 h-10 text-gray-500" />
            </div>
            <div className="text-xl font-semibold text-white mb-2">No call logs</div>
            <div className="text-gray-400">This organization has no recorded calls.</div>
          </motion.div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Type</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Contact</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Duration</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Time</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call, idx) => (
                  <tr key={call.id} style={{ borderBottom: idx < calls.length - 1 ? `1px solid ${borderColor}` : 'none' }} className="hover:bg-white/5">
                    <td className="px-6 py-4">{getCallIcon(call.type)}</td>
                    <td className="px-6 py-4 text-white">{call.contact}</td>
                    <td className="px-6 py-4 text-gray-400">{Math.floor(call.duration / 60)}:{(call.duration % 60).toString().padStart(2, '0')}</td>
                    <td className="px-6 py-4"><span className="px-2 py-1 rounded-lg text-xs bg-white/10 text-gray-300">{call.status}</span></td>
                    <td className="px-6 py-4 text-gray-500 text-sm">{call.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
