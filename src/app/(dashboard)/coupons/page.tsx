'use client';

/**
 * Coupons Management Page
 * Create, manage, and monitor merchant coupons — public marketing and negotiation categories.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '@/lib/firebase/config';
import { logger } from '@/lib/logger/logger';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import SubpageNav from '@/components/ui/SubpageNav';
import { CATALOG_TABS } from '@/lib/constants/subpage-nav';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MerchantCoupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  value: number;
  min_purchase: number;
  max_discount?: number;
  max_uses?: number;
  max_uses_per_customer?: number;
  current_uses: number;
  valid_from: string;
  valid_until?: string;
  coupon_category: 'public_marketing' | 'negotiation';
  ai_authorized: boolean;
  ai_discount_limit: number;
  ai_auto_apply: boolean;
  applies_to: 'all' | 'specific_products' | 'specific_categories' | 'first_purchase';
  product_ids?: string[];
  category_ids?: string[];
  status: 'active' | 'paused' | 'expired' | 'disabled';
  created_at: string;
  updated_at: string;
  created_by: string;
  notes?: string;
}

type FilterTab = 'all' | 'active' | 'expired' | 'disabled';

interface CouponsApiResponse {
  success: boolean;
  data: MerchantCoupon[];
}

interface CouponActionResponse {
  success: boolean;
  data?: MerchantCoupon;
  error?: string;
}

interface CreateFormState {
  code: string;
  discount_type: 'percentage' | 'fixed';
  value: string;
  min_purchase: string;
  max_uses: string;
  valid_from: string;
  valid_until: string;
  coupon_category: 'public_marketing' | 'negotiation';
  ai_authorized: boolean;
  applies_to: 'all' | 'specific_products' | 'specific_categories' | 'first_purchase';
  status: 'active' | 'paused' | 'expired' | 'disabled';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthToken(): Promise<string | null> {
  return auth?.currentUser?.getIdToken() ?? null;
}

function formatDiscount(coupon: MerchantCoupon): string {
  if (coupon.discount_type === 'percentage') {
    return `${coupon.value}% off`;
  }
  return `$${coupon.value.toFixed(2)} off`;
}

function formatUsage(coupon: MerchantCoupon): string {
  if (coupon.max_uses === undefined || coupon.max_uses === null) {
    return `${coupon.current_uses} used (unlimited)`;
  }
  return `${coupon.current_uses} / ${coupon.max_uses} used`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatAppliesTo(
  applies_to: MerchantCoupon['applies_to'],
  product_ids?: string[],
  category_ids?: string[],
): string {
  switch (applies_to) {
    case 'all':
      return 'All products';
    case 'specific_products':
      return `${product_ids?.length ?? 0} product(s)`;
    case 'specific_categories':
      return `${category_ids?.length ?? 0} category(ies)`;
    case 'first_purchase':
      return 'First purchase only';
  }
}

// ---------------------------------------------------------------------------
// Badge sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: MerchantCoupon['status'] }) {
  const config: Record<MerchantCoupon['status'], { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-success/15 text-success' },
    paused: { label: 'Paused', className: 'bg-warning/15 text-warning' },
    expired: { label: 'Expired', className: 'bg-error/15 text-error' },
    disabled: { label: 'Disabled', className: 'bg-muted/30 text-muted-foreground' },
  };
  const { label, className } = config[status];
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function CategoryBadge({ category }: { category: MerchantCoupon['coupon_category'] }) {
  const config: Record<MerchantCoupon['coupon_category'], { label: string; className: string }> = {
    public_marketing: { label: 'Marketing', className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
    negotiation: { label: 'Negotiation', className: 'bg-purple-500/15 text-purple-600 dark:text-purple-400' },
  };
  const { label, className } = config[category];
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Coupon Card
// ---------------------------------------------------------------------------

interface CouponCardProps {
  coupon: MerchantCoupon;
  onToggleStatus: (id: string, current: MerchantCoupon['status']) => void;
  onDeleteRequest: (id: string, code: string) => void;
  actionLoading: string | null;
}

function CouponCard({ coupon, onToggleStatus, onDeleteRequest, actionLoading }: CouponCardProps) {
  const isLoading = actionLoading === coupon.id;
  const canToggle = coupon.status === 'active' || coupon.status === 'paused';

  return (
    <div className="bg-card border border-border-light rounded-xl p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-mono text-lg font-bold text-foreground tracking-widest break-all">
            {coupon.code}
          </span>
          <span className="text-base font-semibold text-primary">
            {formatDiscount(coupon)}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusBadge status={coupon.status} />
          <CategoryBadge category={coupon.coupon_category} />
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div className="text-muted-foreground">Usage</div>
        <div className="text-foreground text-right">{formatUsage(coupon)}</div>

        <div className="text-muted-foreground">Applies to</div>
        <div className="text-foreground text-right">
          {formatAppliesTo(coupon.applies_to, coupon.product_ids, coupon.category_ids)}
        </div>

        {coupon.min_purchase > 0 && (
          <>
            <div className="text-muted-foreground">Min. purchase</div>
            <div className="text-foreground text-right">${coupon.min_purchase.toFixed(2)}</div>
          </>
        )}

        <div className="text-muted-foreground">Valid from</div>
        <div className="text-foreground text-right">{formatDate(coupon.valid_from)}</div>

        {coupon.valid_until && (
          <>
            <div className="text-muted-foreground">Valid until</div>
            <div className="text-foreground text-right">{formatDate(coupon.valid_until)}</div>
          </>
        )}
      </div>

      {/* AI indicator */}
      {coupon.ai_authorized && (
        <div className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 bg-purple-500/10 rounded-lg px-3 py-1.5">
          <span className="font-semibold">AI Authorized</span>
          <span className="text-muted-foreground">
            — up to {coupon.discount_type === 'percentage'
              ? `${coupon.ai_discount_limit}%`
              : `$${coupon.ai_discount_limit}`}
            {coupon.ai_auto_apply ? ' · auto-apply on' : ''}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-border-light">
        {canToggle && (
          <button
            onClick={() => onToggleStatus(coupon.id, coupon.status)}
            disabled={isLoading}
            className="flex-1 text-sm px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-primary/10 text-foreground hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Updating…' : coupon.status === 'active' ? 'Pause' : 'Activate'}
          </button>
        )}
        <button
          onClick={() => onDeleteRequest(coupon.id, coupon.code)}
          disabled={isLoading}
          className="flex-1 text-sm px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-error/10 text-muted-foreground hover:text-error transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Coupon Modal
// ---------------------------------------------------------------------------

interface CreateCouponModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const DEFAULT_FORM: CreateFormState = {
  code: '',
  discount_type: 'percentage',
  value: '',
  min_purchase: '0',
  max_uses: '',
  valid_from: new Date().toISOString().slice(0, 10),
  valid_until: '',
  coupon_category: 'public_marketing',
  ai_authorized: false,
  applies_to: 'all',
  status: 'active',
};

function CreateCouponModal({ onClose, onCreated }: CreateCouponModalProps) {
  const [form, setForm] = useState<CreateFormState>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function setField<K extends keyof CreateFormState>(key: K, value: CreateFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const parsedValue = parseFloat(form.value);
    const parsedMinPurchase = parseFloat(form.min_purchase);
    const parsedMaxUses = form.max_uses.trim() ? parseInt(form.max_uses, 10) : undefined;

    if (!form.code.trim()) {
      setFormError('Coupon code is required.');
      return;
    }
    if (isNaN(parsedValue) || parsedValue <= 0) {
      setFormError('Discount value must be a positive number.');
      return;
    }
    if (form.discount_type === 'percentage' && parsedValue > 100) {
      setFormError('Percentage discount cannot exceed 100.');
      return;
    }

    setSubmitting(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setFormError('Not authenticated. Please refresh and try again.');
        return;
      }

      const payload: Record<string, unknown> = {
        code: form.code.trim().toUpperCase(),
        discount_type: form.discount_type,
        value: parsedValue,
        min_purchase: isNaN(parsedMinPurchase) ? 0 : parsedMinPurchase,
        coupon_category: form.coupon_category,
        ai_authorized: form.ai_authorized,
        applies_to: form.applies_to,
        status: form.status,
        valid_from: form.valid_from
          ? new Date(form.valid_from).toISOString()
          : new Date().toISOString(),
      };

      if (parsedMaxUses !== undefined && !isNaN(parsedMaxUses)) {
        payload.max_uses = parsedMaxUses;
      }
      if (form.valid_until.trim()) {
        payload.valid_until = new Date(form.valid_until).toISOString();
      }

      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as CouponActionResponse;

      if (!res.ok || !data.success) {
        setFormError(data.error ?? 'Failed to create coupon.');
        return;
      }

      onCreated();
    } catch (err: unknown) {
      logger.error(
        'Failed to create coupon',
        err instanceof Error ? err : new Error(String(err)),
        { file: 'coupons/page.tsx' },
      );
      setFormError('Unexpected error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border-light rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-foreground">Create Coupon</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Coupon Code <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setField('code', e.target.value.toUpperCase())}
              placeholder="e.g. SAVE20"
              className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
            />
          </div>

          {/* Discount type + value */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Discount Type</label>
              <select
                value={form.discount_type}
                onChange={(e) => setField('discount_type', e.target.value as 'percentage' | 'fixed')}
                className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Value <span className="text-error">*</span>
              </label>
              <input
                type="number"
                value={form.value}
                onChange={(e) => setField('value', e.target.value)}
                min="0.01"
                step="0.01"
                placeholder={form.discount_type === 'percentage' ? '20' : '10.00'}
                className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                required
              />
            </div>
          </div>

          {/* Min purchase + Max uses */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Min. Purchase ($)</label>
              <input
                type="number"
                value={form.min_purchase}
                onChange={(e) => setField('min_purchase', e.target.value)}
                min="0"
                step="0.01"
                placeholder="0"
                className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Max Uses (blank = unlimited)</label>
              <input
                type="number"
                value={form.max_uses}
                onChange={(e) => setField('max_uses', e.target.value)}
                min="1"
                step="1"
                placeholder="Unlimited"
                className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          {/* Valid dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Valid From</label>
              <input
                type="date"
                value={form.valid_from}
                onChange={(e) => setField('valid_from', e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Valid Until (optional)</label>
              <input
                type="date"
                value={form.valid_until}
                onChange={(e) => setField('valid_until', e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Category</label>
            <select
              value={form.coupon_category}
              onChange={(e) =>
                setField('coupon_category', e.target.value as 'public_marketing' | 'negotiation')
              }
              className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="public_marketing">Public Marketing</option>
              <option value="negotiation">Negotiation</option>
            </select>
          </div>

          {/* Applies to */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Applies To</label>
            <select
              value={form.applies_to}
              onChange={(e) =>
                setField(
                  'applies_to',
                  e.target.value as
                    | 'all'
                    | 'specific_products'
                    | 'specific_categories'
                    | 'first_purchase',
                )
              }
              className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="all">All Products</option>
              <option value="specific_products">Specific Products</option>
              <option value="specific_categories">Specific Categories</option>
              <option value="first_purchase">First Purchase Only</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Initial Status</label>
            <select
              value={form.status}
              onChange={(e) =>
                setField('status', e.target.value as MerchantCoupon['status'])
              }
              className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          {/* AI Authorized toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.ai_authorized}
              onChange={(e) => setField('ai_authorized', e.target.checked)}
              className="w-4 h-4 rounded border border-border-light accent-primary"
            />
            <span className="text-sm text-foreground">AI Authorized — allow Jasper to apply this coupon automatically</span>
          </label>

          {formError && (
            <p className="text-sm text-error bg-error/10 border border-error/30 rounded-lg px-3 py-2">
              {formError}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-surface-elevated border border-border-light rounded-lg text-foreground hover:bg-surface-paper transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating…' : 'Create Coupon'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirmation Modal
// ---------------------------------------------------------------------------

interface DeleteConfirmProps {
  couponCode: string;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}

function DeleteConfirmModal({ couponCode, onConfirm, onCancel, deleting }: DeleteConfirmProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border-light rounded-xl p-6 w-full max-w-sm">
        <h2 className="text-xl font-bold text-foreground mb-3">Delete Coupon</h2>
        <p className="text-muted-foreground mb-6">
          Are you sure you want to permanently delete{' '}
          <span className="font-mono font-semibold text-foreground">{couponCode}</span>? This action
          cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 px-4 py-2 bg-surface-elevated border border-border-light rounded-lg text-foreground hover:bg-surface-paper transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 px-4 py-2 bg-error text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<MerchantCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; code: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setFetchError('Not authenticated.');
        return;
      }

      const res = await fetch('/api/coupons', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        setFetchError(`Failed to load coupons (${res.status}).`);
        return;
      }

      const data = (await res.json()) as CouponsApiResponse;
      if (data.success) {
        setCoupons(data.data);
      } else {
        setFetchError('Unexpected response from server.');
      }
    } catch (err: unknown) {
      logger.error(
        'Failed to fetch coupons',
        err instanceof Error ? err : new Error(String(err)),
        { file: 'coupons/page.tsx' },
      );
      setFetchError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCoupons();
  }, [loadCoupons]);

  const handleToggleStatus = useCallback(
    async (id: string, currentStatus: MerchantCoupon['status']) => {
      const nextStatus: MerchantCoupon['status'] =
        currentStatus === 'active' ? 'paused' : 'active';

      setActionLoading(id);
      try {
        const token = await getAuthToken();
        if (!token) {return;}

        const res = await fetch(`/api/coupons/${id}/status`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: nextStatus }),
        });

        const data = (await res.json()) as CouponActionResponse;
        if (res.ok && data.success && data.data) {
          const updatedStatus = data.data.status;
          setCoupons((prev) =>
            prev.map((c) => (c.id === id ? { ...c, status: updatedStatus } : c)),
          );
        } else {
          logger.error(
            'Failed to update coupon status',
            new Error(data.error ?? 'Unknown error'),
            { file: 'coupons/page.tsx', couponId: id },
          );
        }
      } catch (err: unknown) {
        logger.error(
          'Error toggling coupon status',
          err instanceof Error ? err : new Error(String(err)),
          { file: 'coupons/page.tsx' },
        );
      } finally {
        setActionLoading(null);
      }
    },
    [],
  );

  const handleDeleteRequest = useCallback((id: string, code: string) => {
    setDeleteTarget({ id, code });
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) {return;}
    setDeleting(true);
    try {
      const token = await getAuthToken();
      if (!token) {return;}

      const res = await fetch(`/api/coupons/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setCoupons((prev) => prev.filter((c) => c.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        const data = (await res.json()) as CouponActionResponse;
        logger.error(
          'Failed to delete coupon',
          new Error(data.error ?? 'Unknown error'),
          { file: 'coupons/page.tsx', couponId: deleteTarget.id },
        );
      }
    } catch (err: unknown) {
      logger.error(
        'Error deleting coupon',
        err instanceof Error ? err : new Error(String(err)),
        { file: 'coupons/page.tsx' },
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteTarget(null);
  };

  const handleCreated = async () => {
    setShowCreateModal(false);
    await loadCoupons();
  };

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------
  const filteredCoupons = coupons.filter((c) => {
    if (activeTab === 'all') {return true;}
    if (activeTab === 'active') {return c.status === 'active';}
    if (activeTab === 'expired') {return c.status === 'expired';}
    if (activeTab === 'disabled') {return c.status === 'disabled' || c.status === 'paused';}
    return true;
  });

  const tabCounts: Record<FilterTab, number> = {
    all: coupons.length,
    active: coupons.filter((c) => c.status === 'active').length,
    expired: coupons.filter((c) => c.status === 'expired').length,
    disabled: coupons.filter((c) => c.status === 'disabled' || c.status === 'paused').length,
  };

  const TABS: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'expired', label: 'Expired' },
    { id: 'disabled', label: 'Disabled / Paused' },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="p-8 space-y-6">
      <SubpageNav items={CATALOG_TABS} />

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <PageTitle>Coupons</PageTitle>
          <SectionDescription className="mt-1">
            Create and manage discount coupons for marketing campaigns and sales negotiations.
          </SectionDescription>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="self-start sm:self-auto px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          + Create Coupon
        </button>
      </div>

      {/* Error banner */}
      {fetchError && (
        <div className="p-4 border border-error/30 rounded-lg text-error bg-error/10 text-sm">
          {fetchError}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-surface-elevated rounded-lg p-1 w-fit flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            <span
              className={`ml-1.5 text-xs ${
                activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              ({tabCounts[tab.id]})
            </span>
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <span className="text-sm">Loading coupons…</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredCoupons.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 bg-surface-elevated rounded-xl border border-border-light">
          <div className="text-4xl">🏷️</div>
          <div className="text-center">
            <p className="text-foreground font-medium">
              {activeTab === 'all' ? 'No coupons yet' : `No ${activeTab} coupons`}
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              {activeTab === 'all'
                ? 'Create your first coupon to start offering discounts.'
                : 'Try switching to a different tab.'}
            </p>
          </div>
          {activeTab === 'all' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity text-sm"
            >
              + Create your first coupon
            </button>
          )}
        </div>
      )}

      {/* Coupon grid — 1 col mobile, 2 col tablet, 3 col desktop */}
      {!loading && filteredCoupons.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredCoupons.map((coupon) => (
            <CouponCard
              key={coupon.id}
              coupon={coupon}
              onToggleStatus={(id, status) => void handleToggleStatus(id, status)}
              onDeleteRequest={handleDeleteRequest}
              actionLoading={actionLoading}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <CreateCouponModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => void handleCreated()}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteConfirmModal
          couponCode={deleteTarget.code}
          onConfirm={() => void handleDeleteConfirm()}
          onCancel={handleDeleteCancel}
          deleting={deleting}
        />
      )}
    </div>
  );
}
