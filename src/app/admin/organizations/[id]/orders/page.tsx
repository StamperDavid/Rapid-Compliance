'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft, ShoppingCart, Loader2, Package, Clock, CheckCircle } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { logger } from '@/lib/logger/logger';
import type { Organization } from '@/types/organization';

interface Order {
  id: string;
  orderNumber: string;
  customer: string;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  items: number;
  createdAt: string;
}

/**
 * Admin Support View: Orders
 * View e-commerce orders for any tenant organization.
 */
export default function AdminOrgOrdersPage() {
  const { hasPermission } = useAdminAuth();
  const params = useParams();
  const orgId = params.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [orders] = useState<Order[]>([]);
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
        logger.error('Failed to load organization:', error instanceof Error ? error : new Error(String(error)), { file: 'admin/organizations/[id]/orders/page.tsx' });
      } finally {
        setOrgLoading(false);
        setLoading(false);
      }
    }
    void loadData();
  }, [orgId]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
      pending: { bg: '#f59e0b20', text: '#fbbf24', icon: Clock },
      processing: { bg: '#3b82f620', text: '#60a5fa', icon: Package },
      shipped: { bg: '#8b5cf620', text: '#a78bfa', icon: ShoppingCart },
      delivered: { bg: '#22c55e20', text: '#4ade80', icon: CheckCircle },
      cancelled: { bg: '#ef444420', text: '#f87171', icon: Clock },
    };
    const style = styles[status] ?? styles.pending;
    const Icon = style.icon;
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium capitalize" style={{ backgroundColor: style.bg, color: style.text }}><Icon className="w-3 h-3" />{status}</span>;
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
            <div style={{ fontSize: '0.75rem', color: '#666' }}>Orders for: {orgLoading ? 'Loading...' : (organization?.name ?? orgId)}</div>
          </div>
          {canManageOrg && <div className="px-3 py-1 bg-emerald-500/20 rounded-full text-xs text-emerald-400 font-semibold">Full Access</div>}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: '#10b981' }}>
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Orders</h1>
              <p className="text-gray-400">E-commerce order management</p>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
        ) : orders.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#10b98110', border: '1px solid #ffffff10' }}>
              <ShoppingCart className="w-10 h-10 text-gray-500" />
            </div>
            <div className="text-xl font-semibold text-white mb-2">No orders found</div>
            <div className="text-gray-400">This organization has no e-commerce orders.</div>
          </motion.div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Order #</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Customer</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Items</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Total</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, idx) => (
                  <tr key={order.id} style={{ borderBottom: idx < orders.length - 1 ? `1px solid ${borderColor}` : 'none' }} className="hover:bg-white/5">
                    <td className="px-6 py-4 text-white font-mono">{order.orderNumber}</td>
                    <td className="px-6 py-4 text-white">{order.customer}</td>
                    <td className="px-6 py-4 text-gray-400">{order.items} items</td>
                    <td className="px-6 py-4 text-emerald-400 font-semibold">{formatCurrency(order.total)}</td>
                    <td className="px-6 py-4">{getStatusBadge(order.status)}</td>
                    <td className="px-6 py-4 text-gray-500 text-sm">{order.createdAt}</td>
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
