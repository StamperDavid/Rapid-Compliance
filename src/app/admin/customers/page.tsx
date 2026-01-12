'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { logger } from '@/lib/logger/logger';

export default function CustomersAdminPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const { getAllCustomers } = await import('@/lib/admin/subscription-manager');
      const customersData = await getAllCustomers();
      setCustomers(customersData);
    } catch (error) {
      logger.error('Failed to load customers:', error, { file: 'page.tsx' });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const companyMatches = customer.companyName.toLowerCase().includes(searchQuery.toLowerCase());
    const emailMatches = customer.primaryContact.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = searchQuery === '' ? true : [companyMatches, emailMatches].some(Boolean);
    
    const matchesStatus = filterStatus === 'all' ? true : customer.subscription.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Customers</h1>
              <p className="text-gray-400">
                {customers.length} total customers • {customers.filter(c => c.subscription.status === 'active').length} active
              </p>
            </div>
            <Link
              href="/admin"
              className="px-4 py-2 text-gray-300 hover:text-white transition"
            >
              ← Back to Admin
            </Link>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 border-b border-gray-700 px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customers..."
              className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            >
              <option value="all">All Status</option>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="past_due">Past Due</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customer List */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-gray-400">Loading customers...</div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">👥</div>
            <div className="text-xl text-gray-400">No customers found</div>
          </div>
        ) : (
          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300 uppercase">MRR</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Health</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Usage</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredCustomers.map((customer) => {
                  const mrr = customer.subscription.billingCycle === 'monthly'
                    ? customer.subscription.amount
                    : customer.subscription.amount / 12;

                  return (
                    <tr key={customer.id} className="hover:bg-gray-700/50 transition">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">{customer.companyName}</div>
                        <div className="text-sm text-gray-400">{customer.primaryContact.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-white">{customer.subscription.planName}</div>
                        <div className="text-xs text-gray-400">{customer.subscription.billingCycle}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          customer.subscription.status === 'active' ? 'bg-green-500/20 text-green-300' :
                          customer.subscription.status === 'trial' ? 'bg-blue-500/20 text-blue-300' :
                          customer.subscription.status === 'past_due' ? 'bg-red-500/20 text-red-300' :
                          'bg-gray-500/20 text-gray-300'
                        }`}>
                          {customer.subscription.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-white font-semibold">
                        ${mrr.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                customer.healthScore >= 70 ? 'bg-green-400' :
                                customer.healthScore >= 40 ? 'bg-yellow-400' :
                                'bg-red-400'
                              }`}
                              style={{ width: `${customer.healthScore}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-400 w-12">{customer.healthScore}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-300">
                          {customer.usage.conversations.toLocaleString()} conv
                        </div>
                        <div className="text-xs text-gray-500">
                          {customer.usage.agents} agents
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button className="text-purple-400 hover:text-purple-300 text-sm font-semibold">
                          View Details →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}






















