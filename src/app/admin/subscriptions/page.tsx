'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export default function SubscriptionsAdminPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<any>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setIsLoading(true);
    try {
      const { getAllPlans } = await import('@/lib/admin/subscription-manager');
      const plansData = await getAllPlans();
      setPlans(plansData);
    } catch (error) {
      console.error('Failed to load plans:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePlan = async () => {
    if (!editingPlan) return;
    
    try {
      const { savePlan } = await import('@/lib/admin/subscription-manager');
      await savePlan(editingPlan);
      await loadPlans();
      setEditingPlan(null);
      alert('Plan saved successfully!');
    } catch (error) {
      console.error('Failed to save plan:', error);
      alert('Failed to save plan');
    }
  };

  const handleCreatePlan = () => {
    setEditingPlan({
      id: `plan_${Date.now()}`,
      name: '',
      description: '',
      monthlyPrice: 0,
      yearlyPrice: 0,
      currency: 'usd',
      limits: {
        agents: 1,
        conversationsPerMonth: 1000,
        crmRecords: 1000,
        users: 5,
        workspaces: 1,
        apiCallsPerMonth: 10000,
        storageGB: 10,
      },
      features: [],
      displayOrder: plans.length,
      isPopular: false,
      isActive: true,
    });
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Subscription Plans</h1>
              <p className="text-gray-400">Manage pricing plans and customer subscriptions</p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/admin"
                className="px-4 py-2 text-gray-300 hover:text-white transition"
              >
                ← Back to Admin
              </Link>
              <button
                onClick={handleCreatePlan}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold"
              >
                + Create Plan
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-gray-400">Loading plans...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-purple-500 transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                    {plan.isPopular && (
                      <span className="inline-block px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded">
                        POPULAR
                      </span>
                    )}
                  </div>
                  <div className={`w-3 h-3 rounded-full ${plan.isActive ? 'bg-green-400' : 'bg-gray-600'}`} />
                </div>

                <p className="text-gray-400 text-sm mb-4">{plan.description}</p>

                <div className="mb-4 pb-4 border-b border-gray-700">
                  {plan.monthlyPrice !== null ? (
                    <>
                      <div className="text-3xl font-bold text-white">
                        ${plan.monthlyPrice}
                        <span className="text-lg text-gray-400">/mo</span>
                      </div>
                      {plan.yearlyPrice && (
                        <div className="text-sm text-gray-400">
                          ${plan.yearlyPrice}/year
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-2xl font-bold text-white">Custom</div>
                  )}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="text-xs text-gray-500">Limits:</div>
                  {Object.entries(plan.limits).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                      <span className="text-white font-semibold">
                        {value === null ? 'Unlimited' : value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingPlan(plan)}
                    className="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition text-sm"
                  >
                    Edit
                  </button>
                  <button
                    className="px-4 py-2 bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 transition text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingPlan && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4">
              <h2 className="text-xl font-bold text-white">
                {editingPlan.id.startsWith('plan_') ? 'Create Plan' : 'Edit Plan'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              {/* Basic Info */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Plan Name</label>
                <input
                  type="text"
                  value={editingPlan.name}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="e.g., Professional"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Description</label>
                <textarea
                  value={editingPlan.description}
                  onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  rows={3}
                  placeholder="For growing teams that need more power"
                />
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Monthly Price ($)</label>
                  <input
                    type="number"
                    value={editingPlan.monthlyPrice || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, monthlyPrice: parseFloat(e.target.value) || null })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    placeholder="49"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Yearly Price ($)</label>
                  <input
                    type="number"
                    value={editingPlan.yearlyPrice || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, yearlyPrice: parseFloat(e.target.value) || null })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    placeholder="470"
                  />
                </div>
              </div>

              {/* Limits */}
              <div className="border-t border-gray-700 pt-4">
                <h3 className="text-white font-semibold mb-3">Plan Limits</h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(editingPlan.limits).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-sm text-gray-400 mb-2 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      <input
                        type="number"
                        value={value === null ? '' : (value as number | string)}
                        onChange={(e) => setEditingPlan({
                          ...editingPlan,
                          limits: {
                            ...editingPlan.limits,
                            [key]: e.target.value === '' ? null : parseInt(e.target.value)
                          }
                        })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        placeholder="Unlimited"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPlan.isPopular}
                    onChange={(e) => setEditingPlan({ ...editingPlan, isPopular: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-gray-300">Mark as Popular</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPlan.isActive}
                    onChange={(e) => setEditingPlan({ ...editingPlan, isActive: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-gray-300">Active (visible to customers)</span>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 px-6 py-4 flex justify-end gap-4">
              <button
                onClick={() => setEditingPlan(null)}
                className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePlan}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold"
              >
                Save Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

