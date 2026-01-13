'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import type { PlatformPricingPlan, PlatformCoupon, FeatureLimits } from '@/types/pricing';
import { DEFAULT_PRICING_TIERS, DEFAULT_FEATURE_LIMITS } from '@/types/pricing';

type TabType = 'pricing' | 'coupons';

export default function GlobalConfigPage() {
  useAdminAuth();
  const [activeTab, setActiveTab] = useState<TabType>('pricing');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Pricing state
  const [pricingPlans, setPricingPlans] = useState<PlatformPricingPlan[]>([]);
  const [editingPlan, setEditingPlan] = useState<PlatformPricingPlan | null>(null);

  // Coupons state
  const [coupons, setCoupons] = useState<PlatformCoupon[]>([]);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Partial<PlatformCoupon> | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load pricing plans
      const pricingRes = await fetch('/api/admin/platform-pricing');
      if (pricingRes.ok) {
        const data = await pricingRes.json();
        setPricingPlans(data.plans || []);
      } else {
        // Use defaults
        const now = new Date().toISOString();
        setPricingPlans(DEFAULT_PRICING_TIERS.map(t => ({
          ...t,
          created_at: now,
          updated_at: now,
        })));
      }

      // Load platform coupons
      const couponsRes = await fetch('/api/admin/platform-coupons');
      if (couponsRes.ok) {
        const data = await couponsRes.json();
        setCoupons(data.coupons || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // PRICING PLAN HANDLERS
  // ============================================

  const handleQuickPriceUpdate = async (planId: string, newPrice: number) => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await fetch('/api/admin/platform-pricing/quick-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, price_usd: newPrice }),
      });

      if (response.ok) {
        setPricingPlans(prev => prev.map(p =>
          p.plan_id === planId ? { ...p, price_usd: newPrice, updated_at: new Date().toISOString() } : p
        ));
        setMessage({ type: 'success', text: `Price updated for ${planId}!` });
      } else {
        throw new Error('Failed to update price');
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to update price' });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePlan = async (plan: PlatformPricingPlan) => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await fetch('/api/admin/platform-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan),
      });

      if (response.ok) {
        const savedPlan = await response.json();
        setPricingPlans(prev => {
          const exists = prev.find(p => p.plan_id === plan.plan_id);
          if (exists) {
            return prev.map(p => p.plan_id === plan.plan_id ? savedPlan.plan : p);
          }
          return [...prev, savedPlan.plan];
        });
        setEditingPlan(null);
        setMessage({ type: 'success', text: 'Plan saved successfully!' });
      } else {
        throw new Error('Failed to save plan');
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save plan' });
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // COUPON HANDLERS
  // ============================================

  const handleSaveCoupon = async () => {
    if (!editingCoupon) return;

    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await fetch('/api/admin/platform-coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCoupon),
      });

      if (response.ok) {
        const savedCoupon = await response.json();
        setCoupons(prev => {
          const exists = prev.find(c => c.id === savedCoupon.coupon.id);
          if (exists) {
            return prev.map(c => c.id === savedCoupon.coupon.id ? savedCoupon.coupon : c);
          }
          return [...prev, savedCoupon.coupon];
        });
        setShowCouponModal(false);
        setEditingCoupon(null);
        setMessage({ type: 'success', text: 'Coupon saved successfully!' });
      } else {
        throw new Error('Failed to save coupon');
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save coupon' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCouponStatus = async (couponId: string, newStatus: 'active' | 'disabled') => {
    try {
      const response = await fetch(`/api/admin/platform-coupons/${couponId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setCoupons(prev => prev.map(c =>
          c.id === couponId ? { ...c, status: newStatus } : c
        ));
      }
    } catch (error) {
      console.error('Error toggling coupon status:', error);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#666' }}>Loading global configuration...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000', color: '#fff' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Global Configuration
          </h1>
          <p style={{ color: '#999' }}>
            Manage platform pricing plans and promotional coupons. Changes apply immediately.
          </p>
        </div>

        {/* Message */}
        {message.text && (
          <div style={{
            padding: '1rem',
            backgroundColor: message.type === 'success' ? '#065f46' : '#7f1d1d',
            border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
            borderRadius: '0.5rem',
            marginBottom: '1.5rem',
          }}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
          <button
            onClick={() => setActiveTab('pricing')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: activeTab === 'pricing' ? '#6366f1' : '#1a1a1a',
              color: activeTab === 'pricing' ? '#fff' : '#999',
              border: '1px solid #333',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: activeTab === 'pricing' ? '600' : '400',
            }}
          >
            Pricing Plans
          </button>
          <button
            onClick={() => setActiveTab('coupons')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: activeTab === 'coupons' ? '#6366f1' : '#1a1a1a',
              color: activeTab === 'coupons' ? '#fff' : '#999',
              border: '1px solid #333',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: activeTab === 'coupons' ? '600' : '400',
            }}
          >
            Platform Coupons
          </button>
        </div>

        {/* Content */}
        {activeTab === 'pricing' && (
          <PricingTab
            plans={pricingPlans}
            editingPlan={editingPlan}
            setEditingPlan={setEditingPlan}
            onQuickUpdate={handleQuickPriceUpdate}
            onSavePlan={handleSavePlan}
            saving={saving}
          />
        )}

        {activeTab === 'coupons' && (
          <CouponsTab
            coupons={coupons}
            showModal={showCouponModal}
            setShowModal={setShowCouponModal}
            editingCoupon={editingCoupon}
            setEditingCoupon={setEditingCoupon}
            onSaveCoupon={handleSaveCoupon}
            onToggleStatus={handleToggleCouponStatus}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// PRICING TAB COMPONENT
// ============================================

function PricingTab({
  plans,
  editingPlan,
  setEditingPlan,
  onQuickUpdate,
  onSavePlan,
  saving,
}: {
  plans: PlatformPricingPlan[];
  editingPlan: PlatformPricingPlan | null;
  setEditingPlan: (plan: PlatformPricingPlan | null) => void;
  onQuickUpdate: (planId: string, price: number) => void;
  onSavePlan: (plan: PlatformPricingPlan) => void;
  saving: boolean;
}) {
  const [quickPrices, setQuickPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    const prices: Record<string, number> = {};
    plans.forEach(p => { prices[p.plan_id] = p.price_usd; });
    setQuickPrices(prices);
  }, [plans]);

  return (
    <div>
      {/* Quick Price Update Section */}
      <div style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        marginBottom: '2rem',
      }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#6366f1' }}>
          Quick Price Update
        </h3>
        <p style={{ color: '#999', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Change plan prices instantly. Click &quot;Update&quot; to apply changes immediately.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {plans.filter(p => p.is_active).map(plan => (
            <div key={plan.plan_id} style={{
              backgroundColor: '#0a0a0a',
              padding: '1rem',
              borderRadius: '0.5rem',
              border: '1px solid #333',
            }}>
              <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>{plan.name}</div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ color: '#999' }}>$</span>
                <input
                  type="number"
                  value={quickPrices[plan.plan_id] || 0}
                  onChange={(e) => setQuickPrices(prev => ({
                    ...prev,
                    [plan.plan_id]: parseInt(e.target.value) || 0,
                  }))}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '0.25rem',
                    color: '#fff',
                  }}
                />
                <button
                  onClick={() => onQuickUpdate(plan.plan_id, quickPrices[plan.plan_id])}
                  disabled={saving || quickPrices[plan.plan_id] === plan.price_usd}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: quickPrices[plan.plan_id] !== plan.price_usd ? '#10b981' : '#333',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.25rem',
                    cursor: quickPrices[plan.plan_id] !== plan.price_usd ? 'pointer' : 'default',
                    opacity: quickPrices[plan.plan_id] !== plan.price_usd ? 1 : 0.5,
                  }}
                >
                  Update
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full Plan Editor */}
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {plans.map(plan => (
          <div
            key={plan.plan_id}
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '0.75rem',
              padding: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600' }}>{plan.name}</h3>
                  {plan.badge && (
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      backgroundColor: '#6366f1',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                    }}>
                      {plan.badge}
                    </span>
                  )}
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: plan.is_active ? '#065f46' : '#7f1d1d',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                  }}>
                    {plan.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p style={{ color: '#999', fontSize: '0.875rem' }}>{plan.description}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                  ${plan.price_usd}<span style={{ fontSize: '1rem', color: '#999' }}>/mo</span>
                </div>
                {plan.yearly_price_usd && (
                  <div style={{ color: '#999', fontSize: '0.875rem' }}>
                    ${plan.yearly_price_usd}/yr
                  </div>
                )}
              </div>
            </div>

            {/* Feature Limits Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
              <FeatureStat label="Records" value={plan.feature_limits.max_records} />
              <FeatureStat label="Workspaces" value={plan.feature_limits.max_workspaces} />
              <FeatureStat label="Team Members" value={plan.feature_limits.max_team_members} />
              <FeatureStat label="AI Agents" value={plan.feature_limits.ai_agents_count} />
            </div>

            <button
              onClick={() => setEditingPlan(plan)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#333',
                color: '#fff',
                border: 'none',
                borderRadius: '0.25rem',
                cursor: 'pointer',
              }}
            >
              Edit Full Plan
            </button>
          </div>
        ))}
      </div>

      {/* Plan Editor Modal */}
      {editingPlan && (
        <PlanEditorModal
          plan={editingPlan}
          onClose={() => setEditingPlan(null)}
          onSave={onSavePlan}
          saving={saving}
        />
      )}
    </div>
  );
}

function FeatureStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ backgroundColor: '#0a0a0a', padding: '0.75rem', borderRadius: '0.5rem' }}>
      <div style={{ color: '#999', fontSize: '0.75rem' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>
        {value === -1 ? 'Unlimited' : value.toLocaleString()}
      </div>
    </div>
  );
}

function PlanEditorModal({
  plan,
  onClose,
  onSave,
  saving,
}: {
  plan: PlatformPricingPlan;
  onClose: () => void;
  onSave: (plan: PlatformPricingPlan) => void;
  saving: boolean;
}) {
  const [editedPlan, setEditedPlan] = useState(plan);

  const updateField = (field: string, value: unknown) => {
    setEditedPlan(prev => ({ ...prev, [field]: value }));
  };

  const updateFeatureLimit = (field: keyof FeatureLimits, value: number) => {
    setEditedPlan(prev => ({
      ...prev,
      feature_limits: { ...prev.feature_limits, [field]: value },
    }));
  };

  const updateFeatureFlag = (flag: keyof FeatureLimits['features'], value: boolean) => {
    setEditedPlan(prev => ({
      ...prev,
      feature_limits: {
        ...prev.feature_limits,
        features: { ...prev.feature_limits.features, [flag]: value },
      },
    }));
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '0.75rem',
        padding: '2rem',
        width: '800px',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Edit Plan: {plan.name}</h2>
          <button onClick={onClose} style={{ fontSize: '1.5rem', background: 'none', border: 'none', color: '#999', cursor: 'pointer' }}>
            &times;
          </button>
        </div>

        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {/* Basic Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Plan Name</label>
              <input
                type="text"
                value={editedPlan.name}
                onChange={(e) => updateField('name', e.target.value)}
                style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.25rem', color: '#fff' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Badge</label>
              <input
                type="text"
                value={editedPlan.badge || ''}
                onChange={(e) => updateField('badge', e.target.value || undefined)}
                placeholder="e.g., Most Popular"
                style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.25rem', color: '#fff' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Description</label>
            <textarea
              value={editedPlan.description || ''}
              onChange={(e) => updateField('description', e.target.value)}
              style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.25rem', color: '#fff', minHeight: '80px' }}
            />
          </div>

          {/* Pricing */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Monthly Price ($)</label>
              <input
                type="number"
                value={editedPlan.price_usd}
                onChange={(e) => updateField('price_usd', parseInt(e.target.value) || 0)}
                style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.25rem', color: '#fff' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Yearly Price ($)</label>
              <input
                type="number"
                value={editedPlan.yearly_price_usd || ''}
                onChange={(e) => updateField('yearly_price_usd', parseInt(e.target.value) || undefined)}
                style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.25rem', color: '#fff' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Display Order</label>
              <input
                type="number"
                value={editedPlan.display_order}
                onChange={(e) => updateField('display_order', parseInt(e.target.value) || 0)}
                style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.25rem', color: '#fff' }}
              />
            </div>
          </div>

          {/* Feature Limits */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>Feature Limits (-1 = Unlimited)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              {['max_records', 'max_workspaces', 'max_team_members', 'ai_conversations_per_month', 'ai_email_generations_per_month', 'ai_agents_count', 'emails_per_month', 'sms_per_month', 'linkedin_actions_per_month'].map((field) => (
                <div key={field}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#999', marginBottom: '0.25rem' }}>
                    {field.replace(/_/g, ' ')}
                  </label>
                  <input
                    type="number"
                    value={editedPlan.feature_limits[field as keyof FeatureLimits] as number}
                    onChange={(e) => updateFeatureLimit(field as keyof FeatureLimits, parseInt(e.target.value) || 0)}
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.25rem', color: '#fff', fontSize: '0.875rem' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Feature Flags */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>Feature Access</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {Object.keys(editedPlan.feature_limits.features).map((flag) => (
                <label key={flag} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editedPlan.feature_limits.features[flag as keyof FeatureLimits['features']]}
                    onChange={(e) => updateFeatureFlag(flag as keyof FeatureLimits['features'], e.target.checked)}
                  />
                  <span style={{ fontSize: '0.875rem', color: '#ccc' }}>{flag.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Status */}
          <div style={{ display: 'flex', gap: '2rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={editedPlan.is_active}
                onChange={(e) => updateField('is_active', e.target.checked)}
              />
              <span>Active (available for subscription)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={editedPlan.is_public}
                onChange={(e) => updateField('is_public', e.target.checked)}
              />
              <span>Public (show on pricing page)</span>
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
          <button
            onClick={onClose}
            style={{ padding: '0.75rem 1.5rem', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(editedPlan)}
            disabled={saving}
            style={{ padding: '0.75rem 1.5rem', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
          >
            {saving ? 'Saving...' : 'Save Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// COUPONS TAB COMPONENT
// ============================================

function CouponsTab({
  coupons,
  showModal,
  setShowModal,
  editingCoupon,
  setEditingCoupon,
  onSaveCoupon,
  onToggleStatus,
  saving,
}: {
  coupons: PlatformCoupon[];
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  editingCoupon: Partial<PlatformCoupon> | null;
  setEditingCoupon: (coupon: Partial<PlatformCoupon> | null) => void;
  onSaveCoupon: () => void;
  onToggleStatus: (id: string, status: 'active' | 'disabled') => void;
  saving: boolean;
}) {
  const openNewCouponModal = () => {
    setEditingCoupon({
      code: '',
      discount_type: 'percentage',
      value: 10,
      is_free_forever: false,
      is_internal_only: false,
      applies_to_plans: 'all',
      billing_cycles: 'all',
      current_uses: 0,
      status: 'active',
      valid_from: new Date().toISOString(),
    });
    setShowModal(true);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>Platform Coupons</h3>
          <p style={{ color: '#999', fontSize: '0.875rem' }}>Manage promotional codes for SaaS subscriptions</p>
        </div>
        <button
          onClick={openNewCouponModal}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#6366f1',
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          + New Coupon
        </button>
      </div>

      {/* Free Forever Info Box */}
      <div style={{
        backgroundColor: '#1e3a5f',
        border: '1px solid #3b82f6',
        borderRadius: '0.5rem',
        padding: '1rem',
        marginBottom: '1.5rem',
      }}>
        <h4 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Free Forever Coupons</h4>
        <p style={{ fontSize: '0.875rem', color: '#93c5fd' }}>
          Create a coupon with 100% discount or toggle &quot;Free Forever&quot; to bypass Stripe checkout entirely.
          Organizations using these coupons will be marked as <code style={{ backgroundColor: '#0a0a0a', padding: '0.125rem 0.25rem', borderRadius: '0.125rem' }}>active_internal</code>.
        </p>
      </div>

      {/* Coupons List */}
      <div style={{ display: 'grid', gap: '1rem' }}>
        {coupons.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
            No coupons created yet. Click &quot;+ New Coupon&quot; to create one.
          </div>
        ) : (
          coupons.map(coupon => (
            <div
              key={coupon.id}
              style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '0.5rem',
                padding: '1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <code style={{ fontSize: '1.25rem', fontWeight: 'bold', backgroundColor: '#0a0a0a', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
                    {coupon.code}
                  </code>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: coupon.status === 'active' ? '#065f46' : '#7f1d1d',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                  }}>
                    {coupon.status}
                  </span>
                  {coupon.is_free_forever && (
                    <span style={{ padding: '0.25rem 0.5rem', backgroundColor: '#6366f1', borderRadius: '0.25rem', fontSize: '0.75rem' }}>
                      FREE FOREVER
                    </span>
                  )}
                  {coupon.is_internal_only && (
                    <span style={{ padding: '0.25rem 0.5rem', backgroundColor: '#92400e', borderRadius: '0.25rem', fontSize: '0.75rem' }}>
                      INTERNAL
                    </span>
                  )}
                </div>
                <div style={{ color: '#999', fontSize: '0.875rem' }}>
                  {coupon.discount_type === 'percentage' ? `${coupon.value}% off` : `$${coupon.value / 100} off`}
                  {' | '}
                  {coupon.current_uses} / {coupon.max_uses || '&infin;'} uses
                  {coupon.valid_until && ` | Expires ${new Date(coupon.valid_until).toLocaleDateString()}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => {
                    setEditingCoupon(coupon);
                    setShowModal(true);
                  }}
                  style={{ padding: '0.5rem 1rem', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => onToggleStatus(coupon.id, coupon.status === 'active' ? 'disabled' : 'active')}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: coupon.status === 'active' ? '#7f1d1d' : '#065f46',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                  }}
                >
                  {coupon.status === 'active' ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Coupon Editor Modal */}
      {showModal && editingCoupon && (
        <CouponEditorModal
          coupon={editingCoupon}
          setCoupon={setEditingCoupon}
          onClose={() => { setShowModal(false); setEditingCoupon(null); }}
          onSave={onSaveCoupon}
          saving={saving}
        />
      )}
    </div>
  );
}

function CouponEditorModal({
  coupon,
  setCoupon,
  onClose,
  onSave,
  saving,
}: {
  coupon: Partial<PlatformCoupon>;
  setCoupon: (coupon: Partial<PlatformCoupon>) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const updateField = (field: string, value: unknown) => {
    setCoupon({ ...coupon, [field]: value });
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '0.75rem',
        padding: '2rem',
        width: '600px',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
            {coupon.id ? 'Edit Coupon' : 'Create New Coupon'}
          </h2>
          <button onClick={onClose} style={{ fontSize: '1.5rem', background: 'none', border: 'none', color: '#999', cursor: 'pointer' }}>
            &times;
          </button>
        </div>

        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {/* Coupon Code */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>
              Coupon Code (will be uppercase)
            </label>
            <input
              type="text"
              value={coupon.code || ''}
              onChange={(e) => updateField('code', e.target.value.toUpperCase())}
              placeholder="e.g., LAUNCH2024"
              style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.25rem', color: '#fff', fontFamily: 'monospace', fontSize: '1.125rem' }}
            />
          </div>

          {/* Discount Type & Value */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Discount Type</label>
              <select
                value={coupon.discount_type || 'percentage'}
                onChange={(e) => updateField('discount_type', e.target.value)}
                style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.25rem', color: '#fff' }}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount ($)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>
                Value {coupon.discount_type === 'percentage' ? '(%)' : '(cents)'}
              </label>
              <input
                type="number"
                value={coupon.value || 0}
                onChange={(e) => updateField('value', parseInt(e.target.value) || 0)}
                style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.25rem', color: '#fff' }}
              />
            </div>
          </div>

          {/* Usage Limits */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Max Uses (empty = unlimited)</label>
              <input
                type="number"
                value={coupon.max_uses || ''}
                onChange={(e) => updateField('max_uses', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Unlimited"
                style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.25rem', color: '#fff' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Expiration Date</label>
              <input
                type="date"
                value={coupon.valid_until ? coupon.valid_until.split('T')[0] : ''}
                onChange={(e) => updateField('valid_until', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.25rem', color: '#fff' }}
              />
            </div>
          </div>

          {/* Special Flags */}
          <div style={{ backgroundColor: '#0a0a0a', padding: '1rem', borderRadius: '0.5rem' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem' }}>Special Options</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={coupon.is_free_forever || false}
                  onChange={(e) => {
                    updateField('is_free_forever', e.target.checked);
                    if (e.target.checked) {
                      updateField('discount_type', 'percentage');
                      updateField('value', 100);
                    }
                  }}
                />
                <div>
                  <span style={{ fontWeight: '500' }}>Free Forever</span>
                  <p style={{ fontSize: '0.75rem', color: '#999', margin: 0 }}>
                    Bypasses Stripe checkout. Organization marked as active_internal.
                  </p>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={coupon.is_internal_only || false}
                  onChange={(e) => updateField('is_internal_only', e.target.checked)}
                />
                <div>
                  <span style={{ fontWeight: '500' }}>Internal Only</span>
                  <p style={{ fontSize: '0.75rem', color: '#999', margin: 0 }}>
                    Only visible to platform admins. For testing purposes.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Internal Notes</label>
            <textarea
              value={coupon.notes || ''}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="e.g., For Product Hunt launch campaign"
              style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.25rem', color: '#fff', minHeight: '60px' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
          <button
            onClick={onClose}
            style={{ padding: '0.75rem 1.5rem', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !coupon.code}
            style={{ padding: '0.75rem 1.5rem', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', opacity: saving || !coupon.code ? 0.5 : 1 }}
          >
            {saving ? 'Saving...' : coupon.id ? 'Update Coupon' : 'Create Coupon'}
          </button>
        </div>
      </div>
    </div>
  );
}
