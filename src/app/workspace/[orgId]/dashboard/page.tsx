'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface DashboardStats {
  leads: number;
  deals: number;
  conversations: number;
  revenue: number;
}

export default function DashboardPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [stats, setStats] = useState<DashboardStats>({
    leads: 0,
    deals: 0,
    conversations: 0,
    revenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    async function fetchStats() {
      if (!db || !orgId) {
        setLoading(false);
        return;
      }

      try {
        // Fetch leads count
        const leadsQuery = query(
          collection(db, 'organizations', orgId, 'records'),
          where('entityType', '==', 'leads')
        );
        const leadsSnapshot = await getDocs(leadsQuery);

        // Fetch deals count
        const dealsQuery = query(
          collection(db, 'organizations', orgId, 'records'),
          where('entityType', '==', 'deals')
        );
        const dealsSnapshot = await getDocs(dealsQuery);

        // Fetch conversations count
        const convoQuery = query(
          collection(db, 'organizations', orgId, 'conversations'),
          limit(100)
        );
        const convoSnapshot = await getDocs(convoQuery);

        // Calculate revenue from deals
        let totalRevenue = 0;
        dealsSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.value) {
            totalRevenue += Number(data.value) || 0;
          }
        });

        setStats({
          leads: leadsSnapshot.size,
          deals: dealsSnapshot.size,
          conversations: convoSnapshot.size,
          revenue: totalRevenue,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [orgId]);

  const quickLinks = [
    { name: 'Leads', href: `/workspace/${orgId}/entities/leads`, icon: '👤', color: 'bg-blue-500' },
    { name: 'Deals', href: `/workspace/${orgId}/entities/deals`, icon: '💰', color: 'bg-green-500' },
    { name: 'Conversations', href: `/workspace/${orgId}/conversations`, icon: '💬', color: 'bg-purple-500' },
    { name: 'Analytics', href: `/workspace/${orgId}/analytics`, icon: '📊', color: 'bg-orange-500' },
    { name: 'AI Agent', href: `/workspace/${orgId}/settings/ai-agents`, icon: '🤖', color: 'bg-indigo-500' },
    { name: 'Settings', href: `/workspace/${orgId}/settings`, icon: '⚙️', color: 'bg-gray-500' },
  ];

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-gray-400">Welcome back! Here's an overview of your workspace.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="text-gray-400 text-sm mb-1">Total Leads</div>
            <div className="text-3xl font-bold">
              {loading ? '...' : stats.leads.toLocaleString()}
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="text-gray-400 text-sm mb-1">Active Deals</div>
            <div className="text-3xl font-bold">
              {loading ? '...' : stats.deals.toLocaleString()}
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="text-gray-400 text-sm mb-1">Conversations</div>
            <div className="text-3xl font-bold">
              {loading ? '...' : stats.conversations.toLocaleString()}
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="text-gray-400 text-sm mb-1">Pipeline Value</div>
            <div className="text-3xl font-bold">
              {loading ? '...' : `$${stats.revenue.toLocaleString()}`}
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Quick Access</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {quickLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:bg-gray-800 transition text-center"
              >
                <div className="text-3xl mb-2">{link.icon}</div>
                <div className="text-sm font-medium">{link.name}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Getting Started */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Getting Started</h2>
          <div className="space-y-3">
            <Link 
              href={`/workspace/${orgId}/settings/ai-agents`}
              className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
            >
              <span className="text-2xl">🤖</span>
              <div>
                <div className="font-medium">Configure your AI Agent</div>
                <div className="text-sm text-gray-400">Train your AI on your business</div>
              </div>
            </Link>
            <Link 
              href={`/workspace/${orgId}/entities/leads`}
              className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
            >
              <span className="text-2xl">👤</span>
              <div>
                <div className="font-medium">Add your first leads</div>
                <div className="text-sm text-gray-400">Import or create leads manually</div>
              </div>
            </Link>
            <Link 
              href={`/workspace/${orgId}/settings/integrations`}
              className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
            >
              <span className="text-2xl">🔗</span>
              <div>
                <div className="font-medium">Connect integrations</div>
                <div className="text-sm text-gray-400">Gmail, Slack, Stripe, and more</div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


