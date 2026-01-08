'use client';

import React, { useState, useEffect } from 'react';

import { useAuth } from '@/hooks/useAuth'
import { logger } from '@/lib/logger/logger';

export default function SubscriptionsAdminPage() {
  const { _user } = useAuth();
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
      logger.error('Failed to load plans:', error, { file: 'page.tsx' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePlan = async () => {
    if (!editingPlan) {return;}
    
    try {
      const { savePlan } = await import('@/lib/admin/subscription-manager');
      await savePlan(editingPlan);
      await loadPlans();
      setEditingPlan(null);
      alert('Plan saved successfully!');
    } catch (error) {
      logger.error('Failed to save plan:', error, { file: 'page.tsx' });
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

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const primaryColor = '#6366f1';

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Subscription Plans
          </h1>
          <p style={{ color: '#666', fontSize: '0.875rem' }}>
            Manage pricing plans and customer subscriptions
          </p>
        </div>
        <button
          onClick={handleCreatePlan}
          style={{
            padding: '0.625rem 1.25rem',
            backgroundColor: primaryColor,
            color: '#fff',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '600'
          }}
        >
          + Create Plan
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
          Loading plans...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {plans.map((plan) => (
            <div
              key={plan.id}
              style={{
                backgroundColor: bgPaper,
                border: `1px solid ${borderColor}`,
                borderRadius: '0.75rem',
                padding: '1.5rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = primaryColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = borderColor;
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
                    {plan.name}
                  </h3>
                  {plan.isPopular && (
                    <span style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#fbbf2433',
                      color: '#fbbf24',
                      fontSize: '0.75rem',
                      borderRadius: '0.25rem'
                    }}>
                      POPULAR
                    </span>
                  )}
                </div>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: plan.isActive ? '#10b981' : '#6b7280'
                }} />
              </div>

              <p style={{ color: '#999', fontSize: '0.875rem', marginBottom: '1rem' }}>
                {plan.description}
              </p>

              <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: `1px solid ${borderColor}` }}>
                {plan.monthlyPrice !== null ? (
                  <>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff' }}>
                      ${plan.monthlyPrice}
                      <span style={{ fontSize: '1rem', color: '#999' }}>/mo</span>
                    </div>
                    {plan.yearlyPrice && (
                      <div style={{ fontSize: '0.875rem', color: '#999' }}>
                        ${plan.yearlyPrice}/year
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>Custom</div>
                )}
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>Limits:</div>
                {Object.entries(plan.limits).map(([key, value]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                    <span style={{ color: '#999', textTransform: 'capitalize' }}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}:
                    </span>
                    <span style={{ color: '#fff', fontWeight: '600' }}>
                      {value === null ? 'Unlimited' : (value as number).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setEditingPlan(plan)}
                  style={{
                    flex: 1,
                    padding: '0.5rem 1rem',
                    backgroundColor: '#333',
                    color: '#fff',
                    borderRadius: '0.375rem',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  Edit
                </button>
                <button
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#dc262633',
                    color: '#dc2626',
                    borderRadius: '0.375rem',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingPlan && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#0a0a0a',
            border: `1px solid ${borderColor}`,
            borderRadius: '0.75rem',
            maxWidth: '40rem',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{
              position: 'sticky',
              top: 0,
              backgroundColor: '#0a0a0a',
              borderBottom: `1px solid ${borderColor}`,
              padding: '1.5rem'
            }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>
                {editingPlan.id.startsWith('plan_') ? 'Create Plan' : 'Edit Plan'}
              </h2>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>
                  Plan Name
                </label>
                <input
                  type="text"
                  value={editingPlan.name}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    backgroundColor: '#1a1a1a',
                    border: `1px solid ${borderColor}`,
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontSize: '0.875rem'
                  }}
                  placeholder="e.g., Professional"
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>
                  Description
                </label>
                <textarea
                  value={editingPlan.description}
                  onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    backgroundColor: '#1a1a1a',
                    border: `1px solid ${borderColor}`,
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontSize: '0.875rem',
                    minHeight: '80px'
                  }}
                  placeholder="For growing teams that need more power"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>
                    Monthly Price ($)
                  </label>
                  <input
                    type="number"
                    value={editingPlan.monthlyPrice ?? ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, monthlyPrice: parseFloat(e.target.value) ?? null })}
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      backgroundColor: '#1a1a1a',
                      border: `1px solid ${borderColor}`,
                      borderRadius: '0.5rem',
                      color: '#fff',
                      fontSize: '0.875rem'
                    }}
                    placeholder="49"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>
                    Yearly Price ($)
                  </label>
                  <input
                    type="number"
                    value={editingPlan.yearlyPrice ?? ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, yearlyPrice: parseFloat(e.target.value) ?? null })}
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      backgroundColor: '#1a1a1a',
                      border: `1px solid ${borderColor}`,
                      borderRadius: '0.5rem',
                      color: '#fff',
                      fontSize: '0.875rem'
                    }}
                    placeholder="470"
                  />
                </div>
              </div>

              <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: '1rem', marginBottom: '1rem' }}>
                <h3 style={{ color: '#fff', fontWeight: '600', marginBottom: '1rem', fontSize: '1rem' }}>Plan Limits</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {Object.entries(editingPlan.limits).map(([key, value]) => (
                    <div key={key}>
                      <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem', textTransform: 'capitalize' }}>
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
                        style={{
                          width: '100%',
                          padding: '0.625rem',
                          backgroundColor: '#1a1a1a',
                          border: `1px solid ${borderColor}`,
                          borderRadius: '0.5rem',
                          color: '#fff',
                          fontSize: '0.875rem'
                        }}
                        placeholder="Unlimited"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingPlan.isPopular}
                    onChange={(e) => setEditingPlan({ ...editingPlan, isPopular: e.target.checked })}
                    style={{ width: '1rem', height: '1rem' }}
                  />
                  <span style={{ color: '#ddd', fontSize: '0.875rem' }}>Mark as Popular</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingPlan.isActive}
                    onChange={(e) => setEditingPlan({ ...editingPlan, isActive: e.target.checked })}
                    style={{ width: '1rem', height: '1rem' }}
                  />
                  <span style={{ color: '#ddd', fontSize: '0.875rem' }}>Active (visible to customers)</span>
                </label>
              </div>
            </div>

            <div style={{
              position: 'sticky',
              bottom: 0,
              backgroundColor: '#0a0a0a',
              borderTop: `1px solid ${borderColor}`,
              padding: '1.5rem',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '1rem'
            }}>
              <button
                onClick={() => setEditingPlan(null)}
                style={{
                  padding: '0.625rem 1.5rem',
                  backgroundColor: '#333',
                  color: '#fff',
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSavePlan}
                style={{
                  padding: '0.625rem 1.5rem',
                  backgroundColor: primaryColor,
                  color: '#fff',
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}
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
