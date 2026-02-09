'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { logger } from '@/lib/logger/logger';
import type { BaseModel } from '@/types/agent-memory';
import { useToast } from '@/hooks/useToast';

// Extended types for dynamic field access
type ExtendedBusinessContext = Record<string, string | undefined>;
type ExtendedAgentPersona = Record<string, string | number | undefined>;
type ExtendedBehaviorConfig = Record<string, string | number | boolean | undefined>;

export default function AgentConfigurationPage() {
  const { user: _user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [baseModel, setBaseModel] = useState<BaseModel | null>(null);
  const [activeSection, setActiveSection] = useState('business');
  const { theme } = useOrgTheme();
  const toast = useToast();

  const loadBaseModel = useCallback(async () => {
    try {
      const { getBaseModel } = await import('@/lib/agent/base-model-builder');
      const model = await getBaseModel();

      if (model) {
        setBaseModel(model);
      } else {
        // No base model yet - redirect to onboarding
        toast.warning('Please complete onboarding first to configure your AI agent.');
      }
    } catch (error) {
      logger.error('Error loading base model:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadBaseModel();
  }, [loadBaseModel]);

  const handleSave = async () => {
    if (!baseModel) {
      return;
    }

    setSaving(true);
    try {
      const { updateBaseModel } = await import('@/lib/agent/base-model-builder');

      await updateBaseModel(baseModel.id, {
        businessContext: baseModel.businessContext,
        agentPersona: baseModel.agentPersona,
        behaviorConfig: baseModel.behaviorConfig,
        knowledgeBase: baseModel.knowledgeBase,
      });

      toast.success('Configuration saved successfully! Your Base Model has been updated. Changes will take effect in training and future Golden Masters.');
    } catch (error) {
      logger.error('Error saving configuration:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to save configuration. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (section: 'businessContext' | 'agentPersona' | 'behaviorConfig', field: string, value: string | number) => {
    setBaseModel((prev: BaseModel | null) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value,
        },
      } as BaseModel;
    });
  };

  // Helper to safely get string value from optional fields
  const safeString = (value: unknown): string => {
    if (value === undefined || value === null) {
      return '';
    }
    return String(value);
  };

  const primaryColor = theme?.colors?.primary?.main ?? 'var(--color-primary)';

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading configuration...</p>
        </div>
      </div>
    );
  }

  if (!baseModel) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <div style={{ textAlign: 'center', maxWidth: '500px', padding: '2rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
              No Configuration Found
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
              Please complete the onboarding wizard first to set up your AI agent.
            </p>
            <a
              href={`/onboarding`}
              style={{
                display: 'inline-block',
                padding: '0.75rem 1.5rem',
                backgroundColor: primaryColor,
                color: 'var(--color-text-primary)',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                fontWeight: '600',
              }}
            >
              Go to Onboarding
            </a>
          </div>
        </div>
      </div>
    );
  }

  const sections = [
    { id: 'business', label: '🏢 Business Details', icon: '🏢' },
    { id: 'products', label: '📦 Products & Services', icon: '📦' },
    { id: 'pricing', label: '💰 Pricing & Sales', icon: '💰' },
    { id: 'operations', label: '🚚 Operations & Fulfillment', icon: '🚚' },
    { id: 'policies', label: '📋 Policies & Guarantees', icon: '📋' },
    { id: 'sales', label: '🎯 Sales Process', icon: '🎯' },
    { id: 'objections', label: '💬 Objection Handling', icon: '💬' },
    { id: 'personality', label: '🎭 Agent Personality', icon: '🎭' },
    { id: 'behavior', label: '⚙️ Behavioral Controls', icon: '⚙️' },
    { id: 'compliance', label: '⚖️ Compliance & Legal', icon: '⚖️' },
  ];

  const renderSection = () => {
    if (!baseModel) {
      return null;
    }

    // Extract sections for easier access - use extended types for dynamic field access
    const ctx = baseModel.businessContext as unknown as ExtendedBusinessContext;
    const persona = baseModel.agentPersona as unknown as ExtendedAgentPersona;
    const behavior = baseModel.behaviorConfig as unknown as ExtendedBehaviorConfig;

    switch (activeSection) {
      case 'business':
        return (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--color-text-primary)' }}>
              Business Details
            </h2>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Business Name
              </label>
              <input
                type="text"
                value={safeString(ctx.businessName)}
                onChange={(e) => updateField('businessContext', 'businessName', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Industry
              </label>
              <input
                type="text"
                value={safeString(ctx.industry)}
                onChange={(e) => updateField('businessContext', 'industry', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Website
              </label>
              <input
                type="url"
                value={safeString(ctx.website)}
                onChange={(e) => updateField('businessContext', 'website', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                What problem do you solve for customers?
              </label>
              <textarea
                value={safeString(ctx.problemSolved)}
                onChange={(e) => updateField('businessContext', 'problemSolved', e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                What makes you unique? (Competitive advantage)
              </label>
              <textarea
                value={safeString(ctx.uniqueValue)}
                onChange={(e) => updateField('businessContext', 'uniqueValue', e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Why do customers buy from you?
              </label>
              <textarea
                value={safeString(ctx.whyBuy)}
                onChange={(e) => updateField('businessContext', 'whyBuy', e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Why might customers NOT buy? (Common hesitations)
              </label>
              <textarea
                value={safeString(ctx.whyNotBuy)}
                onChange={(e) => updateField('businessContext', 'whyNotBuy', e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>
        );

      case 'products':
        return (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--color-text-primary)' }}>
              Products & Services
            </h2>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Primary Offering
              </label>
              <input
                type="text"
                value={safeString(ctx.primaryOffering)}
                onChange={(e) => updateField('businessContext', 'primaryOffering', e.target.value)}
                placeholder="e.g., B2B SaaS Platform, Physical Products, Consulting Services"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Top Products/Services (List your best sellers)
              </label>
              <textarea
                value={safeString(ctx.topProducts)}
                onChange={(e) => updateField('businessContext', 'topProducts', e.target.value)}
                rows={6}
                placeholder="Product 1: Description, key features, who it's for&#10;Product 2: Description, key features, who it's for&#10;..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Product Comparison Guide
              </label>
              <textarea
                value={safeString(ctx.productComparison)}
                onChange={(e) => updateField('businessContext', 'productComparison', e.target.value)}
                rows={4}
                placeholder="When to recommend Product A vs Product B..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Target Customer Profile
              </label>
              <textarea
                value={safeString(ctx.targetCustomer)}
                onChange={(e) => updateField('businessContext', 'targetCustomer', e.target.value)}
                rows={3}
                placeholder="Demographics, company size, industry, role..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Who Should NOT Buy? (Qualify out poor fits)
              </label>
              <textarea
                value={safeString(ctx.whoShouldNotBuy)}
                onChange={(e) => updateField('businessContext', 'whoShouldNotBuy', e.target.value)}
                rows={3}
                placeholder="Too small budget, wrong industry, specific requirements we can't meet..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>
        );

      case 'pricing':
        return (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--color-text-primary)' }}>
              Pricing & Sales Strategy
            </h2>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Price Range
              </label>
              <input
                type="text"
                value={safeString(ctx.priceRange)}
                onChange={(e) => updateField('businessContext', 'priceRange', e.target.value)}
                placeholder="e.g., $49-$499/month, $5,000-$50,000 per project"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Pricing Strategy
              </label>
              <textarea
                value={safeString(ctx.pricingStrategy)}
                onChange={(e) => updateField('businessContext', 'pricingStrategy', e.target.value)}
                rows={4}
                placeholder="Value-based, tiered pricing, usage-based, etc. Explain your pricing model..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Discount Policy
              </label>
              <textarea
                value={safeString(ctx.discountPolicy)}
                onChange={(e) => updateField('businessContext', 'discountPolicy', e.target.value)}
                rows={3}
                placeholder="When can agent offer discounts? What's the maximum? Any restrictions?"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Volume Discounts
              </label>
              <textarea
                value={safeString(ctx.volumeDiscounts)}
                onChange={(e) => updateField('businessContext', 'volumeDiscounts', e.target.value)}
                rows={3}
                placeholder="Discounts for bulk orders, annual contracts, etc."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                First-Time Buyer Incentive
              </label>
              <input
                type="text"
                value={safeString(ctx.firstTimeBuyerIncentive)}
                onChange={(e) => updateField('businessContext', 'firstTimeBuyerIncentive', e.target.value)}
                placeholder="e.g., 10% off first order, free trial, bonus features"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Financing Options
              </label>
              <textarea
                value={safeString(ctx.financingOptions)}
                onChange={(e) => updateField('businessContext', 'financingOptions', e.target.value)}
                rows={3}
                placeholder="Payment plans, net terms, financing partners, etc."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>
        );

      case 'operations':
        return (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--color-text-primary)' }}>
              Operations & Fulfillment
            </h2>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Geographic Coverage
              </label>
              <input
                type="text"
                value={safeString(ctx.geographicCoverage)}
                onChange={(e) => updateField('businessContext', 'geographicCoverage', e.target.value)}
                placeholder="e.g., Worldwide, US only, North America, Specific states"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Delivery Timeframes
              </label>
              <textarea
                value={safeString(ctx.deliveryTimeframes)}
                onChange={(e) => updateField('businessContext', 'deliveryTimeframes', e.target.value)}
                rows={3}
                placeholder="Standard: 5-7 business days, Express: 2-3 days, etc."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Inventory Constraints
              </label>
              <textarea
                value={safeString(ctx.inventoryConstraints)}
                onChange={(e) => updateField('businessContext', 'inventoryConstraints', e.target.value)}
                rows={3}
                placeholder="Out of stock items, seasonal availability, lead times, etc."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Capacity Limitations
              </label>
              <textarea
                value={safeString(ctx.capacityLimitations)}
                onChange={(e) => updateField('businessContext', 'capacityLimitations', e.target.value)}
                rows={3}
                placeholder="Maximum order size, concurrent projects, onboarding timeline, etc."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>
        );

      case 'policies':
        return (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--color-text-primary)' }}>
              Policies & Guarantees
            </h2>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Return Policy
              </label>
              <textarea
                value={safeString(ctx.returnPolicy)}
                onChange={(e) => updateField('businessContext', 'returnPolicy', e.target.value)}
                rows={4}
                placeholder="30-day money-back guarantee, conditions, restocking fees, process, etc."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Warranty Terms
              </label>
              <textarea
                value={safeString(ctx.warrantyTerms)}
                onChange={(e) => updateField('businessContext', 'warrantyTerms', e.target.value)}
                rows={4}
                placeholder="What's covered, how long, what's excluded, claim process..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Cancellation Policy
              </label>
              <textarea
                value={safeString(ctx.cancellationPolicy)}
                onChange={(e) => updateField('businessContext', 'cancellationPolicy', e.target.value)}
                rows={3}
                placeholder="Notice required, cancellation fees, refund terms..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Satisfaction Guarantee
              </label>
              <textarea
                value={safeString(ctx.satisfactionGuarantee)}
                onChange={(e) => updateField('businessContext', 'satisfactionGuarantee', e.target.value)}
                rows={3}
                placeholder="100% satisfaction guarantee, performance guarantees, what's promised..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>
        );

      case 'sales':
        return (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--color-text-primary)' }}>
              Sales Process & Flow
            </h2>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Typical Sales Flow
              </label>
              <textarea
                value={safeString(ctx.typicalSalesFlow)}
                onChange={(e) => updateField('businessContext', 'typicalSalesFlow', e.target.value)}
                rows={6}
                placeholder="Step 1: Discovery questions&#10;Step 2: Understand needs&#10;Step 3: Recommend solution&#10;Step 4: Handle objections&#10;Step 5: Close sale&#10;..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Qualification Criteria
              </label>
              <textarea
                value={safeString(ctx.qualificationCriteria)}
                onChange={(e) => updateField('businessContext', 'qualificationCriteria', e.target.value)}
                rows={4}
                placeholder="BANT: Budget, Authority, Need, Timeline... or your criteria"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Discovery Questions to Ask
              </label>
              <textarea
                value={safeString(ctx.discoveryQuestions)}
                onChange={(e) => updateField('businessContext', 'discoveryQuestions', e.target.value)}
                rows={5}
                placeholder="- What brings you here today?&#10;- What challenges are you facing?&#10;- What have you tried so far?&#10;- What's your timeline?&#10;..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Closing Strategy
              </label>
              <textarea
                value={safeString(ctx.closingStrategy)}
                onChange={(e) => updateField('businessContext', 'closingStrategy', e.target.value)}
                rows={4}
                placeholder="How to ask for the sale, trial closes, assumptive close, etc."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>
        );

      case 'objections':
        return (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--color-text-primary)' }}>
              Objection Handling
            </h2>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Common Objections
              </label>
              <textarea
                value={safeString(ctx.commonObjections)}
                onChange={(e) => updateField('businessContext', 'commonObjections', e.target.value)}
                rows={5}
                placeholder="List common objections and how to handle each one..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Price Objections
              </label>
              <textarea
                value={safeString(ctx.priceObjections)}
                onChange={(e) => updateField('businessContext', 'priceObjections', e.target.value)}
                rows={5}
                placeholder='"Too expensive" → Focus on ROI, payment plans, value not price&#10;"Competitor is cheaper" → Emphasize unique value, quality, support&#10;...'
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Time Objections
              </label>
              <textarea
                value={safeString(ctx.timeObjections)}
                onChange={(e) => updateField('businessContext', 'timeObjections', e.target.value)}
                rows={4}
                placeholder='"Need to think about it" → What specific concerns can I address?&#10;"Wrong timing" → Ask about future timeline&#10;...'
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Competitor Objections
              </label>
              <textarea
                value={safeString(ctx.competitorObjections)}
                onChange={(e) => updateField('businessContext', 'competitorObjections', e.target.value)}
                rows={5}
                placeholder={'"Already using [competitor]" → What\'s working? What\'s not?\n"Considering [competitor]" → Here\'s how we\'re different...\n...'}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>
        );

      case 'personality':
        return (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--color-text-primary)' }}>
              Agent Personality
            </h2>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Agent Name (Optional)
              </label>
              <input
                type="text"
                value={safeString(persona.name)}
                onChange={(e) => updateField('agentPersona', 'name', e.target.value)}
                placeholder="e.g., Sarah, Alex, or leave blank for 'AI Assistant'"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Tone & Voice
              </label>
              <select
                value={(persona.tone !== '' && persona.tone !== undefined) ? persona.tone : 'professional'}
                onChange={(e) => updateField('agentPersona', 'tone', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                }}
              >
                <option value="professional">Professional & Polished</option>
                <option value="friendly">Friendly & Casual</option>
                <option value="enthusiastic">Enthusiastic & Energetic</option>
                <option value="empathetic">Empathetic & Understanding</option>
                <option value="technical">Technical & Expert</option>
                <option value="luxury">Luxury & Premium</option>
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Greeting Message
              </label>
              <textarea
                value={safeString(persona.greeting)}
                onChange={(e) => updateField('agentPersona', 'greeting', e.target.value)}
                rows={3}
                placeholder="Hi! How can I help you today?"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Closing Message
              </label>
              <textarea
                value={safeString(persona.closingMessage)}
                onChange={(e) => updateField('agentPersona', 'closingMessage', e.target.value)}
                rows={3}
                placeholder="Thanks for chatting! Feel free to reach out anytime."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>
        );

      case 'behavior':
        return (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--color-text-primary)' }}>
              Behavioral Controls
            </h2>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Closing Aggressiveness: {behavior.closingAggressiveness}/10
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={Number(behavior.closingAggressiveness) || 5}
                onChange={(e) => updateField('behaviorConfig', 'closingAggressiveness', parseInt(e.target.value))}
                style={{
                  width: '100%',
                }}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.5rem' }}>
                1 = Never pushy, 10 = Very aggressive about closing
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Discovery Question Frequency: {behavior.questionFrequency}
              </label>
              <input
                type="range"
                min="1"
                max="7"
                value={Number(behavior.questionFrequency) || 3}
                onChange={(e) => updateField('behaviorConfig', 'questionFrequency', parseInt(e.target.value))}
                style={{
                  width: '100%',
                }}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.5rem' }}>
                Number of discovery questions to ask before recommending
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Response Length
              </label>
              <select
                value={String(behavior.responseLength ?? 'balanced')}
                onChange={(e) => updateField('behaviorConfig', 'responseLength', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                }}
              >
                <option value="concise">Concise (2-3 sentences)</option>
                <option value="balanced">Balanced (1 paragraph)</option>
                <option value="detailed">Detailed (multiple paragraphs)</option>
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Proactive Level: {behavior.proactiveLevel}/10
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={Number(behavior.proactiveLevel) || 5}
                onChange={(e) => updateField('behaviorConfig', 'proactiveLevel', parseInt(e.target.value))}
                style={{
                  width: '100%',
                }}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.5rem' }}>
                1 = Reactive (wait for customer), 10 = Proactive (suggest, recommend, ask)
              </p>
            </div>
          </div>
        );

      case 'compliance':
        return (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--color-text-primary)' }}>
              Compliance & Legal
            </h2>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Required Disclosures
              </label>
              <textarea
                value={safeString(ctx.requiredDisclosures)}
                onChange={(e) => updateField('businessContext', 'requiredDisclosures', e.target.value)}
                rows={4}
                placeholder="Legal disclaimers agent must mention, medical disclaimers, financial disclaimers, etc."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Industry Regulations
              </label>
              <textarea
                value={safeString(ctx.industryRegulations)}
                onChange={(e) => updateField('businessContext', 'industryRegulations', e.target.value)}
                rows={4}
                placeholder="GDPR, CCPA, SOC 2, financial regulations, industry-specific compliance..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Prohibited Topics
              </label>
              <textarea
                value={safeString(ctx.prohibitedTopics)}
                onChange={(e) => updateField('businessContext', 'prohibitedTopics', e.target.value)}
                rows={4}
                placeholder="Topics the agent should NEVER discuss or must escalate to human (medical advice, legal advice, etc.)"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>
        );

      default:
        return <div style={{ color: 'var(--color-text-secondary)' }}>Select a section from the sidebar</div>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Sidebar */}
        <div style={{ width: '280px', backgroundColor: 'var(--color-bg-main)', borderRight: '1px solid var(--color-border-light)', padding: '1.5rem 1rem', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--color-text-disabled)', marginBottom: '1rem', letterSpacing: '0.05em' }}>
            Configuration Sections
          </h3>
          
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '0.75rem 1rem',
                marginBottom: '0.5rem',
                backgroundColor: activeSection === section.id ? 'var(--color-bg-paper)' : 'transparent',
                border: activeSection === section.id ? `1px solid ${primaryColor}` : '1px solid transparent',
                borderRadius: '0.5rem',
                color: activeSection === section.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ marginRight: '0.5rem' }}>{section.icon}</span>
              {section.label}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto', maxWidth: '900px' }}>
          <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--color-border-light)' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--color-text-primary)' }}>
              AI Agent Configuration
            </h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Edit your agent&apos;s base configuration. Changes will be applied to training and future Golden Masters.
            </p>
          </div>

          {renderSection()}

          {/* Save Button */}
          <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--color-border-light)', display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              style={{
                padding: '0.75rem 2rem',
                backgroundColor: saving ? 'var(--color-border-strong)' : primaryColor,
                color: 'var(--color-text-primary)',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: '600',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
              }}
            >
              {saving ? 'Saving...' : '💾 Save Configuration'}
            </button>
            
            <a
              href={`/settings/ai-agents/training`}
              style={{
                display: 'inline-block',
                padding: '0.75rem 2rem',
                backgroundColor: 'var(--color-bg-paper)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '1rem',
              }}
            >
              Go to Training
            </a>
          </div>

          <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.5rem', border: '1px solid var(--color-border-strong)' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0 }}>
              <strong style={{ color: 'var(--color-text-primary)' }}>💡 Tip:</strong> Changes made here update your Base Model. 
              After training with the new configuration, save a new Golden Master version to deploy these changes to production.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

