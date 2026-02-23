'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, usePermission } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import type { MerchantCoupon, DiscountType, CouponStatus } from '@/types/pricing';
import { logger } from '@/lib/logger/logger';

interface CouponsResponse {
  coupons?: MerchantCoupon[];
}

interface AnalyticsResponse {
  analytics?: {
    totalCoupons: number;
    activeCoupons: number;
    totalRedemptions: number;
    totalDiscountGiven: number;
    topCoupons: { code: string; uses: number; revenue_impact: number }[];
  };
}

interface SaveCouponResponse {
  coupon: MerchantCoupon;
}

interface ErrorResponse {
  error?: string;
}

type TabType = 'active' | 'all' | 'analytics';

export default function PromotionsPage() {
  const { user: _user } = useAuth();
  const { theme } = useOrgTheme();
  const canManageOrganization = usePermission('canManageOrganization');
  const authFetch = useAuthFetch();

  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [coupons, setCoupons] = useState<MerchantCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Partial<MerchantCoupon> | null>(null);
  const [analytics, setAnalytics] = useState<{
    totalCoupons: number;
    activeCoupons: number;
    totalRedemptions: number;
    totalDiscountGiven: number;
    topCoupons: { code: string; uses: number; revenue_impact: number }[];
  } | null>(null);

  const primaryColor = theme?.colors?.primary?.main ?? 'var(--color-primary)';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load coupons
      const couponsRes = await authFetch(`/api/coupons`);
      if (couponsRes.ok) {
        const data = await couponsRes.json() as CouponsResponse;
        setCoupons(data.coupons ?? []);
      }

      // Load analytics
      const analyticsRes = await authFetch(`/api/coupons/analytics`);
      if (analyticsRes.ok) {
        const data = await analyticsRes.json() as AnalyticsResponse;
        setAnalytics(data.analytics ?? null);
      }
    } catch (error) {
      logger.error('Error loading data', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateNew = () => {
    setEditingCoupon({
      code: '',
      discount_type: 'percentage',
      value: 10,
      min_purchase: 0,
      ai_authorized: true,
      ai_discount_limit: 20,
      ai_auto_apply: false,
      applies_to: 'all',
      status: 'active',
      valid_from: new Date().toISOString(),
    });
    setShowModal(true);
  };

  const handleSaveCoupon = async () => {
    if (!editingCoupon) { return; }

    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await authFetch(`/api/coupons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCoupon),
      });

      if (response.ok) {
        const data = await response.json() as SaveCouponResponse;
        setCoupons(prev => {
          const exists = prev.find(c => c.id === data.coupon.id);
          if (exists) {
            return prev.map(c => c.id === data.coupon.id ? data.coupon : c);
          }
          return [...prev, data.coupon];
        });
        setShowModal(false);
        setEditingCoupon(null);
        setMessage({ type: 'success', text: 'Coupon saved successfully!' });
        void loadData(); // Refresh analytics
      } else {
        const errorData = await response.json() as ErrorResponse;
        throw new Error(errorData.error ?? 'Failed to save coupon');
      }
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (couponId: string, newStatus: CouponStatus) => {
    try {
      const response = await authFetch(`/api/coupons/${couponId}/status`, {
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
      logger.error('Error toggling status', error instanceof Error ? error : new Error(String(error)));
    }
  };

  const activeCoupons = coupons.filter(c => c.status === 'active');

  if (loading) {
    return (
      <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ color: 'var(--color-text-disabled)' }}>Loading promotions...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', overflowY: 'auto' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
              Promotions & Coupons
            </h1>
            <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
              Create discount codes for your customers. Configure AI authorization for automated offers.
            </p>
          </div>
          {canManageOrganization && (
            <button
              onClick={handleCreateNew}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: primaryColor,
                color: 'var(--color-text-primary)',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              + Create Coupon
            </button>
          )}
        </div>

        {/* Message */}
        {message.text && (
          <div style={{
            padding: '1rem',
            backgroundColor: message.type === 'success' ? 'var(--color-success-dark)' : 'var(--color-error-dark)',
            border: `1px solid ${message.type === 'success' ? 'var(--color-success)' : 'var(--color-error)'}`,
            borderRadius: '0.5rem',
            marginBottom: '1.5rem',
          }}>
            {message.text}
          </div>
        )}

        {/* Stats Cards */}
        {analytics && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
            <StatCard label="Active Coupons" value={analytics.activeCoupons} primaryColor={primaryColor} />
            <StatCard label="Total Coupons" value={analytics.totalCoupons} primaryColor={primaryColor} />
            <StatCard label="Redemptions" value={analytics.totalRedemptions} primaryColor={primaryColor} />
            <StatCard label="Total Discount Given" value={`$${(analytics.totalDiscountGiven / 100).toFixed(2)}`} primaryColor={primaryColor} />
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border-strong)', paddingBottom: '0.5rem' }}>
          <TabButton active={activeTab === 'active'} onClick={() => setActiveTab('active')} primaryColor={primaryColor}>
            Active ({activeCoupons.length})
          </TabButton>
          <TabButton active={activeTab === 'all'} onClick={() => setActiveTab('all')} primaryColor={primaryColor}>
            All Coupons ({coupons.length})
          </TabButton>
          <TabButton active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} primaryColor={primaryColor}>
            Analytics
          </TabButton>
        </div>

        {/* Content */}
        {activeTab === 'analytics' ? (
          <AnalyticsView analytics={analytics} primaryColor={primaryColor} />
        ) : (
          <CouponsListView
            coupons={activeTab === 'active' ? activeCoupons : coupons}
            onEdit={(coupon) => { setEditingCoupon(coupon); setShowModal(true); }}
            onToggleStatus={(couponId, status) => { void handleToggleStatus(couponId, status); }}
            primaryColor={primaryColor}
          />
        )}

        {/* Coupon Editor Modal */}
        {showModal && editingCoupon && (
          <CouponEditorModal
            coupon={editingCoupon}
            setCoupon={setEditingCoupon}
            onClose={() => { setShowModal(false); setEditingCoupon(null); }}
            onSave={() => { void handleSaveCoupon(); }}
            saving={saving}
            primaryColor={primaryColor}
          />
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, primaryColor }: { label: string; value: string | number; primaryColor: string }) {
  return (
    <div style={{
      backgroundColor: 'var(--color-bg-paper)',
      border: '1px solid var(--color-border-strong)',
      borderRadius: '0.75rem',
      padding: '1.25rem',
    }}>
      <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: primaryColor }}>{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, children, primaryColor }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  primaryColor: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.5rem 1rem',
        backgroundColor: 'transparent',
        color: active ? primaryColor : 'var(--color-text-secondary)',
        border: 'none',
        borderBottom: active ? `2px solid ${primaryColor}` : '2px solid transparent',
        cursor: 'pointer',
        fontWeight: active ? '600' : '400',
        marginBottom: '-0.5rem',
      }}
    >
      {children}
    </button>
  );
}

function CouponsListView({
  coupons,
  onEdit,
  onToggleStatus,
  primaryColor,
}: {
  coupons: MerchantCoupon[];
  onEdit: (coupon: MerchantCoupon) => void;
  onToggleStatus: (id: string, status: CouponStatus) => void;
  primaryColor: string;
}) {
  if (coupons.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-disabled)' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏷️</div>
        <p>No coupons yet. Create your first coupon to start offering discounts!</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {coupons.map(coupon => (
        <div
          key={coupon.id}
          style={{
            backgroundColor: 'var(--color-bg-paper)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <code style={{
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                  backgroundColor: 'var(--color-bg-main)',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '0.25rem',
                  color: primaryColor,
                }}>
                  {coupon.code}
                </code>
                <span style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: coupon.status === 'active' ? 'var(--color-success-dark)' : 'var(--color-error-dark)',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                }}>
                  {coupon.status}
                </span>
                {coupon.ai_authorized && (
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: 'var(--color-info-dark)',
                    color: 'var(--color-info-light)',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                  }}>
                    AI Authorized
                  </span>
                )}
              </div>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', display: 'flex', gap: '1.5rem' }}>
                <span>
                  {coupon.discount_type === 'percentage' ? `${coupon.value}% off` : `$${(coupon.value / 100).toFixed(2)} off`}
                </span>
                {coupon.min_purchase > 0 && (
                  <span>Min: ${(coupon.min_purchase / 100).toFixed(2)}</span>
                )}
                <span>{coupon.current_uses} / {coupon.max_uses ?? '∞'} uses</span>
                {coupon.valid_until && (
                  <span>Expires: {new Date(coupon.valid_until).toLocaleDateString()}</span>
                )}
              </div>
              {coupon.ai_authorized && coupon.ai_discount_limit && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--color-info-light)' }}>
                  AI can offer up to {coupon.ai_discount_limit}% without approval
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => onEdit(coupon)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'var(--color-border-strong)',
                  color: 'var(--color-text-primary)',
                  border: 'none',
                  borderRadius: '0.25rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Edit
              </button>
              <button
                onClick={() => onToggleStatus(coupon.id, coupon.status === 'active' ? 'disabled' : 'active')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: coupon.status === 'active' ? 'var(--color-error-dark)' : 'var(--color-success-dark)',
                  color: 'var(--color-text-primary)',
                  border: 'none',
                  borderRadius: '0.25rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                {coupon.status === 'active' ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AnalyticsView({
  analytics,
  primaryColor,
}: {
  analytics: { topCoupons: { code: string; uses: number; revenue_impact: number }[] } | null;
  primaryColor: string;
}) {
  if (!analytics) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-disabled)' }}>
        No analytics data available yet.
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>Top Performing Coupons</h3>
      {analytics.topCoupons.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-disabled)' }}>
          No redemption data yet. Analytics will appear once customers start using coupons.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {analytics.topCoupons.map((coupon, idx) => (
            <div
              key={coupon.code}
              style={{
                backgroundColor: 'var(--color-bg-paper)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '0.5rem',
                padding: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-disabled)' }}>#{idx + 1}</span>
                <code style={{ fontSize: '1rem', fontWeight: 'bold', color: primaryColor }}>{coupon.code}</code>
              </div>
              <div style={{ display: 'flex', gap: '2rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                <span><strong style={{ color: 'var(--color-text-primary)' }}>{coupon.uses}</strong> uses</span>
                <span><strong style={{ color: 'var(--color-text-primary)' }}>${(coupon.revenue_impact / 100).toFixed(2)}</strong> discounts given</span>
              </div>
            </div>
          ))}
        </div>
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
  primaryColor,
}: {
  coupon: Partial<MerchantCoupon>;
  setCoupon: (coupon: Partial<MerchantCoupon>) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  primaryColor: string;
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
        backgroundColor: 'var(--color-bg-paper)',
        borderRadius: '0.75rem',
        padding: '2rem',
        width: '600px',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
            {coupon.id ? 'Edit Coupon' : 'Create New Coupon'}
          </h2>
          <button onClick={onClose} style={{ fontSize: '1.5rem', background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
            &times;
          </button>
        </div>

        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {/* Coupon Code */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
              Coupon Code
            </label>
            <input
              type="text"
              value={coupon.code ?? ''}
              onChange={(e) => updateField('code', e.target.value.toUpperCase())}
              placeholder="e.g., SUMMER20"
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'var(--color-bg-main)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '0.25rem',
                color: 'var(--color-text-primary)',
                fontFamily: 'monospace',
                fontSize: '1.125rem',
                textTransform: 'uppercase',
              }}
            />
          </div>

          {/* Discount Type & Value */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                Discount Type
              </label>
              <select
                value={coupon.discount_type ?? 'percentage'}
                onChange={(e) => updateField('discount_type', e.target.value as DiscountType)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.25rem',
                  color: 'var(--color-text-primary)',
                }}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount ($)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                Value {coupon.discount_type === 'percentage' ? '(%)' : '(in cents)'}
              </label>
              <input
                type="number"
                value={coupon.value ?? 0}
                onChange={(e) => updateField('value', parseInt(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.25rem',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>
          </div>

          {/* Min Purchase & Max Uses */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                Minimum Purchase (cents, 0 = no minimum)
              </label>
              <input
                type="number"
                value={coupon.min_purchase ?? 0}
                onChange={(e) => updateField('min_purchase', parseInt(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.25rem',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                Max Uses (empty = unlimited)
              </label>
              <input
                type="number"
                value={coupon.max_uses ?? ''}
                onChange={(e) => updateField('max_uses', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Unlimited"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.25rem',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>
          </div>

          {/* Expiration */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
              Expiration Date (optional)
            </label>
            <input
              type="date"
              value={coupon.valid_until ? coupon.valid_until.split('T')[0] : ''}
              onChange={(e) => updateField('valid_until', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'var(--color-bg-main)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '0.25rem',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          {/* AI Authorization Section */}
          <div style={{ backgroundColor: 'var(--color-bg-main)', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--color-border-strong)' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--color-info-light)' }}>
              AI Agent Settings
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
              Configure how your AI Inbound Closer can use this coupon during conversations with leads.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={coupon.ai_authorized ?? false}
                  onChange={(e) => updateField('ai_authorized', e.target.checked)}
                  style={{ width: '1.25rem', height: '1.25rem' }}
                />
                <div>
                  <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>AI Authorized</span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                    Allow AI agents to offer this coupon to customers
                  </p>
                </div>
              </label>

              {coupon.ai_authorized && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
                      AI Discount Limit (%) - Max discount AI can offer without human approval
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={coupon.ai_discount_limit ?? 20}
                      onChange={(e) => updateField('ai_discount_limit', parseInt(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: 'var(--color-bg-paper)',
                        border: '1px solid var(--color-border-strong)',
                        borderRadius: '0.25rem',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={coupon.ai_auto_apply ?? false}
                      onChange={(e) => updateField('ai_auto_apply', e.target.checked)}
                    />
                    <div>
                      <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>Auto-offer on Price Objection</span>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                        AI will automatically mention this coupon when a lead hesitates on price
                      </p>
                    </div>
                  </label>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
              Internal Notes (optional)
            </label>
            <textarea
              value={coupon.notes ?? ''}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="e.g., For email campaign Q1 2024"
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'var(--color-bg-main)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '0.25rem',
                color: 'var(--color-text-primary)',
                minHeight: '60px',
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--color-border-strong)',
              color: 'var(--color-text-primary)',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !coupon.code}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: primaryColor,
              color: 'var(--color-text-primary)',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer',
              opacity: saving || !coupon.code ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving...' : coupon.id ? 'Update Coupon' : 'Create Coupon'}
          </button>
        </div>
      </div>
    </div>
  );
}
