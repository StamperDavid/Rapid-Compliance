'use client';

import { PLATFORM_ID } from '@/lib/constants/platform';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger/logger';

interface StorefrontConfig {
  enabled: boolean;
  businessType: 'products' | 'services' | 'both';
  storeName: string;
  storeUrl: string;
  // Theme - kept for backwards compatibility with disabled UI section
  theme?: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
    fontFamily: string;
    headerStyle: string;
    productCardStyle: string;
    borderRadius: string;
    buttonRadius: string;
  };
  productSchema: string;
  serviceSchema: string;
  checkoutSettings: {
    enableGuestCheckout: boolean;
    requirePhone: boolean;
    collectShipping: boolean;
  };
  paymentProcessing: {
    enablePayments: boolean;
    stripeEnabled: boolean;
    paypalEnabled: boolean;
    squareEnabled: boolean;
    authorizenetEnabled: boolean;
    twocheckoutEnabled: boolean;
    mollieEnabled: boolean;
    autoCreateOrder: boolean;
    autoCreateInvoice: boolean;
    autoRecordPayment: boolean;
    currency: string;
    taxRate: number;
  };
}

const DEFAULT_CONFIG: StorefrontConfig = {
  enabled: false,
  businessType: 'products',
  storeName: 'My Store',
  storeUrl: 'mystore',
  theme: {
    primaryColor: 'var(--color-info)',
    secondaryColor: 'var(--color-primary)',
    accentColor: 'var(--color-success)',
    backgroundColor: 'var(--color-bg-main)',
    textColor: 'var(--color-text-primary)',
    fontFamily: 'Inter',
    headerStyle: 'modern',
    productCardStyle: 'card',
    borderRadius: '0.5rem',
    buttonRadius: '0.375rem',
  },
  productSchema: 'products',
  serviceSchema: 'services',
  checkoutSettings: {
    enableGuestCheckout: true,
    requirePhone: false,
    collectShipping: true,
  },
  paymentProcessing: {
    enablePayments: true,
    stripeEnabled: true,
    paypalEnabled: false,
    squareEnabled: false,
    authorizenetEnabled: false,
    twocheckoutEnabled: false,
    mollieEnabled: false,
    autoCreateOrder: true,
    autoCreateInvoice: true,
    autoRecordPayment: true,
    currency: 'USD',
    taxRate: 0,
  },
};

export default function StorefrontSettingsPage() {
  const { user } = useAuth();
  const { theme: crmTheme } = useOrgTheme(); // Get CRM theme automatically
  const [config, setConfig] = useState<StorefrontConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<'setup' | 'widgets'>('setup'); // Removed 'theme' tab
  const [showPreview, setShowPreview] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load saved config from Firestore
  useEffect(() => {
    if (!user) {return;}

    const loadConfig = async () => {
      try {
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        const configData = await FirestoreService.get(
          `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/storefrontConfig`,
          'default'
        );

        if (configData) {
          setConfig(configData as StorefrontConfig);
        }
      } catch (error: unknown) {
        logger.error('Failed to load storefront config', error instanceof Error ? error : new Error(String(error)));
      }
    };

    void loadConfig();
  }, [user]);

  const handleSave = async () => {
    if (!user) {return;}

    setIsSaving(true);
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/storefrontConfig`,
        'default',
        {
          ...config,
          updatedAt: new Date().toISOString(),
        },
        false
      );
    } catch (error: unknown) {
      logger.error('Failed to save storefront config', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setTimeout(() => setIsSaving(false), 1000);
    }
  };

  const updateConfig = (path: string[], value: unknown) => {
    setConfig(prev => {
      const newConfig = JSON.parse(JSON.stringify(prev)) as StorefrontConfig;
      let current: Record<string, unknown> = newConfig as unknown as Record<string, unknown>;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]] as Record<string, unknown>;
      }
      current[path[path.length - 1]] = value;
      return newConfig;
    });
  };

  const _generateWidgetId = () => {
    return `widget_${Math.random().toString(36).substring(2, 15)}`;
  };

  const widgetId = 'demo_store_widget';

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : 'https://salesvelocity.ai');

  const embedCodes = {
    wordpress: `[crm-store id="${widgetId}" type="full"]`,
    html: `<!-- Add to your website -->
<script src="${appUrl}/embed.js" async></script>
<div data-crm-widget="${widgetId}" data-type="full_store"></div>`,
    react: `import { CRMStoreWidget } from '@salesvelocity/react-widgets'

<CRMStoreWidget
  widgetId="${widgetId}"
  type="full_store"
/>`,
    iframe: `<iframe
  src="${appUrl}/store/embed/${widgetId}"
  width="100%"
  height="800px"
  frameborder="0">
</iframe>`
  };

  const copyCode = (code: string, type: string) => {
    void navigator.clipboard.writeText(code);
    setCopiedCode(type);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
      {/* Header */}
      <div style={{ backgroundColor: 'var(--color-bg-main)', borderBottom: '1px solid var(--color-border-light)', position: 'sticky', top: '60px', zIndex: 40 }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '1rem 2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Link href={`/settings`} style={{ color: 'var(--color-primary)', fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', display: 'inline-block', marginBottom: '0.5rem' }}>
                ← Back to Settings
              </Link>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--color-text-primary)', margin: 0 }}>Online Storefront</h1>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)', marginTop: '0.25rem' }}>
                Configure your embeddable e-commerce store
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.25rem', backgroundColor: config.enabled ? 'var(--color-success-dark)' : 'var(--color-bg-paper)', border: '1px solid', borderColor: config.enabled ? 'var(--color-success)' : 'var(--color-border-strong)', borderRadius: '0.5rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={config.enabled}
                  onChange={(e) => updateConfig(['enabled'], e.target.checked)}
                  style={{ width: '1.25rem', height: '1.25rem' }}
                />
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: config.enabled ? 'var(--color-success-light)' : 'var(--color-text-secondary)' }}>
                  {config.enabled ? '🟢 Store Enabled' : '⚪ Store Disabled'}
                </span>
              </label>
              <button
                onClick={() => { void handleSave(); }}
                disabled={isSaving}
                style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--color-primary)', color: 'white', borderRadius: '0.5rem', border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: '600', opacity: isSaving ? 0.5 : 1 }}
              >
                {isSaving ? 'Saving...' : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', maxWidth: '100%', margin: '0 auto' }}>
        {/* Main Content */}
        <div style={{ flex: showPreview ? '0 0 55%' : '1', padding: '2rem', overflowY: 'auto', maxHeight: 'calc(100vh - 140px)' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1rem' }}>
            <button
              onClick={() => setActiveTab('setup')}
              style={{ padding: '0.75rem 1.5rem', backgroundColor: activeTab === 'setup' ? 'var(--color-bg-paper)' : 'transparent', color: activeTab === 'setup' ? 'var(--color-primary)' : 'var(--color-text-secondary)', border: 'none', borderBottom: activeTab === 'setup' ? '2px solid var(--color-primary)' : '2px solid transparent', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600', transition: 'all 0.2s' }}
            >
              ⚙️ Setup
            </button>
            <button
              onClick={() => setActiveTab('widgets')}
              style={{ padding: '0.75rem 1.5rem', backgroundColor: activeTab === 'widgets' ? 'var(--color-bg-paper)' : 'transparent', color: activeTab === 'widgets' ? 'var(--color-primary)' : 'var(--color-text-secondary)', border: 'none', borderBottom: activeTab === 'widgets' ? '2px solid var(--color-primary)' : '2px solid transparent', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600', transition: 'all 0.2s' }}
            >
              📦 Embed Codes
            </button>
          </div>
          
          {/* Theme Info Banner */}
          <div style={{ backgroundColor: 'var(--color-success-dark)', border: '1px solid var(--color-success)', borderRadius: '0.5rem', padding: '1rem', marginBottom: '2rem', display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
            <span style={{ fontSize: '1.25rem' }}>✨</span>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-success-light)', lineHeight: '1.5' }}>
              <strong>Automatic Theme Sync:</strong> Your storefront automatically uses your CRM theme colors and branding. 
              To change colors, logo, or fonts, go to <Link href={`/settings/theme`} style={{ color: 'var(--color-success-light)', textDecoration: 'underline' }}>Theme Settings</Link>.
            </div>
          </div>

          {/* Setup Tab */}
          {activeTab === 'setup' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Business Type */}
              <div style={{ backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.75rem', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>Business Type</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
                  What will you be selling through your online storefront?
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  {[
                    { value: 'products', icon: '📦', label: 'Products', desc: 'Physical or digital products' },
                    { value: 'services', icon: '💼', label: 'Services', desc: 'Bookings and appointments' },
                    { value: 'both', icon: '🛍️', label: 'Both', desc: 'Products and services' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => updateConfig(['businessType'], option.value)}
                      style={{
                        padding: '1.5rem',
                        backgroundColor: config.businessType === option.value ? 'var(--color-bg-paper)' : 'var(--color-bg-main)',
                        border: '2px solid',
                        borderColor: config.businessType === option.value ? 'var(--color-primary)' : 'var(--color-border-strong)',
                        borderRadius: '0.75rem',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{option.icon}</div>
                      <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>{option.label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>{option.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Store Details */}
              <div style={{ backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.75rem', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>Store Details</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                      Store Name
                    </label>
                    <input
                      type="text"
                      value={config.storeName}
                      onChange={(e) => updateConfig(['storeName'], e.target.value)}
                      placeholder="My Awesome Store"
                      style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                      Store URL Slug
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>store.yourplatform.com/</span>
                      <input
                        type="text"
                        value={config.storeUrl}
                        onChange={(e) => updateConfig(['storeUrl'], e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="mystore"
                        style={{ flex: 1, padding: '0.625rem 0.875rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Schema Mapping */}
              <div style={{ backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.75rem', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>Schema Mapping</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
                  Choose which CRM schemas to display in your storefront
                </p>

                {(config.businessType === 'products' || config.businessType === 'both') && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                      Products Schema
                    </label>
                    <select
                      value={config.productSchema}
                      onChange={(e) => updateConfig(['productSchema'], e.target.value)}
                      style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                    >
                      <option value="products">Products</option>
                      <option value="inventory">Inventory</option>
                      <option value="catalog">Catalog</option>
                    </select>
                  </div>
                )}

                {(config.businessType === 'services' || config.businessType === 'both') && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                      Services Schema
                    </label>
                    <select
                      value={config.serviceSchema}
                      onChange={(e) => updateConfig(['serviceSchema'], e.target.value)}
                      style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                    >
                      <option value="services">Services</option>
                      <option value="appointments">Appointments</option>
                      <option value="packages">Service Packages</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Checkout Settings */}
              <div style={{ backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.75rem', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>Checkout Settings</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', backgroundColor: 'var(--color-bg-main)', borderRadius: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={config.checkoutSettings.enableGuestCheckout}
                      onChange={(e) => updateConfig(['checkoutSettings', 'enableGuestCheckout'], e.target.checked)}
                      style={{ width: '1.25rem', height: '1.25rem' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>Allow Guest Checkout</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Customers can purchase without creating an account</div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', backgroundColor: 'var(--color-bg-main)', borderRadius: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={config.checkoutSettings.requirePhone}
                      onChange={(e) => updateConfig(['checkoutSettings', 'requirePhone'], e.target.checked)}
                      style={{ width: '1.25rem', height: '1.25rem' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>Require Phone Number</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Collect customer phone during checkout</div>
                    </div>
                  </label>

                  {config.businessType !== 'services' && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', backgroundColor: 'var(--color-bg-main)', borderRadius: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={config.checkoutSettings.collectShipping}
                        onChange={(e) => updateConfig(['checkoutSettings', 'collectShipping'], e.target.checked)}
                        style={{ width: '1.25rem', height: '1.25rem' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>Collect Shipping Address</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Required for physical product delivery</div>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Payment Processing */}
              <div style={{ backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.75rem', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>Payment Processing</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
                  Configure payment gateways and automatic CRM integration
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Payment Gateways */}
                  <div style={{ backgroundColor: 'var(--color-bg-main)', borderRadius: '0.5rem', padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>Payment Gateways</div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={config.paymentProcessing.stripeEnabled}
                          onChange={(e) => updateConfig(['paymentProcessing', 'stripeEnabled'], e.target.checked)}
                          style={{ width: '1.25rem', height: '1.25rem' }}
                        />
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>💳 Stripe</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginLeft: 'auto' }}>Credit/Debit Cards, Apple Pay, Google Pay</span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={config.paymentProcessing.paypalEnabled}
                          onChange={(e) => updateConfig(['paymentProcessing', 'paypalEnabled'], e.target.checked)}
                          style={{ width: '1.25rem', height: '1.25rem' }}
                        />
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>🅿️ PayPal</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginLeft: 'auto' }}>PayPal Checkout</span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={config.paymentProcessing.squareEnabled}
                          onChange={(e) => updateConfig(['paymentProcessing', 'squareEnabled'], e.target.checked)}
                          style={{ width: '1.25rem', height: '1.25rem' }}
                        />
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>⬛ Square</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginLeft: 'auto' }}>Square Payments</span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={config.paymentProcessing.authorizenetEnabled}
                          onChange={(e) => updateConfig(['paymentProcessing', 'authorizenetEnabled'], e.target.checked)}
                          style={{ width: '1.25rem', height: '1.25rem' }}
                        />
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>🔒 Authorize.Net</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginLeft: 'auto' }}>Trusted payment gateway</span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={config.paymentProcessing.twocheckoutEnabled}
                          onChange={(e) => updateConfig(['paymentProcessing', 'twocheckoutEnabled'], e.target.checked)}
                          style={{ width: '1.25rem', height: '1.25rem' }}
                        />
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>✓✓ 2Checkout (Verifone)</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginLeft: 'auto' }}>Global payment platform</span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={config.paymentProcessing.mollieEnabled}
                          onChange={(e) => updateConfig(['paymentProcessing', 'mollieEnabled'], e.target.checked)}
                          style={{ width: '1.25rem', height: '1.25rem' }}
                        />
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>🇪🇺 Mollie</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginLeft: 'auto' }}>Popular in Europe</span>
                      </label>
                    </div>
                  </div>

                  {/* CRM Auto-Sync */}
                  <div style={{ backgroundColor: 'var(--color-bg-main)', borderRadius: '0.5rem', padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>CRM Auto-Sync</div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '1rem' }}>When a customer completes a purchase:</p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={config.paymentProcessing.autoCreateOrder}
                          onChange={(e) => updateConfig(['paymentProcessing', 'autoCreateOrder'], e.target.checked)}
                          style={{ width: '1.25rem', height: '1.25rem' }}
                        />
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>📋 Auto-Create Order</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Create order record in CRM → Orders tab</div>
                        </div>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={config.paymentProcessing.autoCreateInvoice}
                          onChange={(e) => updateConfig(['paymentProcessing', 'autoCreateInvoice'], e.target.checked)}
                          style={{ width: '1.25rem', height: '1.25rem' }}
                        />
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>🧾 Auto-Create Invoice</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Create invoice record in CRM → Invoices tab</div>
                        </div>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={config.paymentProcessing.autoRecordPayment}
                          onChange={(e) => updateConfig(['paymentProcessing', 'autoRecordPayment'], e.target.checked)}
                          style={{ width: '1.25rem', height: '1.25rem' }}
                        />
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>💳 Auto-Record Payment</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Record payment in CRM → Payments tab</div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Currency & Tax */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                        Currency
                      </label>
                      <select
                        value={config.paymentProcessing.currency}
                        onChange={(e) => updateConfig(['paymentProcessing', 'currency'], e.target.value)}
                        style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                      >
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="CAD">CAD ($)</option>
                        <option value="AUD">AUD ($)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                        Default Tax Rate (%)
                      </label>
                      <input
                        type="number"
                        value={config.paymentProcessing.taxRate}
                        onChange={(e) => updateConfig(['paymentProcessing', 'taxRate'], parseFloat(e.target.value) || 0)}
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="0.00"
                        style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                      />
                    </div>
                  </div>

                  {/* Info Box */}
                  <div style={{ backgroundColor: 'var(--color-success-dark)', border: '1px solid var(--color-success)', borderRadius: '0.5rem', padding: '1rem', display: 'flex', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>💡</span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-success-light)', lineHeight: '1.5' }}>
                      <strong>Payment Gateway API Keys:</strong> Configure your Stripe, PayPal, and Square credentials in the <Link href={`/settings/api-keys`} style={{ color: 'var(--color-success-light)', textDecoration: 'underline' }}>API Keys settings</Link>.
                    </div>
                  </div>

                  {/* Visual Flow to CRM */}
                  <div style={{ backgroundColor: 'var(--color-success-dark)', border: '1px solid var(--color-success-dark)', borderRadius: '0.5rem', padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-success-light)', marginBottom: '1rem' }}>✅ Automatic CRM Flow</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-success-light)', lineHeight: '1.8', fontFamily: 'monospace' }}>
                      🛒 Customer Completes Purchase<br/>
                      &nbsp;&nbsp;↓<br/>
                      💳 Payment Processes (Gateway)<br/>
                      &nbsp;&nbsp;↓<br/>
                      {config.paymentProcessing.autoCreateOrder && '📋 Order → CRM Orders Tab'}<br/>
                      {config.paymentProcessing.autoCreateInvoice && '🧾 Invoice → CRM Invoices Tab'}<br/>
                      {config.paymentProcessing.autoRecordPayment && '💳 Payment → CRM Payments Tab'}<br/>
                      &nbsp;&nbsp;↓<br/>
                      📊 Syncs to Accounting Software (if enabled)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Widgets Tab */}
          {activeTab === 'widgets' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {!config.enabled && (
                <div style={{ backgroundColor: 'var(--color-error-dark)', border: '1px solid var(--color-error-dark)', borderRadius: '0.75rem', padding: '1.5rem', display: 'flex', alignItems: 'start', gap: '1rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-error-light)', marginBottom: '0.5rem' }}>Store Not Enabled</h4>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-error-light)' }}>
                      Enable your storefront using the toggle above to generate embed codes.
                    </p>
                  </div>
                </div>
              )}

              {/* WordPress Shortcode */}
              <div style={{ backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.75rem', padding: '1.5rem', opacity: config.enabled ? 1 : 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>🔌</span>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-text-primary)', margin: 0 }}>WordPress Shortcode</h3>
                  </div>
                  <button
                    onClick={() => copyCode(embedCodes.wordpress, 'wordpress')}
                    disabled={!config.enabled}
                    style={{ padding: '0.5rem 1rem', backgroundColor: copiedCode === 'wordpress' ? 'var(--color-success-dark)' : 'var(--color-bg-paper)', color: copiedCode === 'wordpress' ? 'var(--color-success-light)' : 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: '600', cursor: config.enabled ? 'pointer' : 'not-allowed' }}
                  >
                    {copiedCode === 'wordpress' ? '✓ Copied!' : '📋 Copy'}
                  </button>
                </div>
                <pre style={{ backgroundColor: 'var(--color-bg-main)', padding: '1rem', borderRadius: '0.5rem', overflow: 'auto', fontSize: '0.875rem', color: 'var(--color-success-light)', fontFamily: 'monospace' }}>
{embedCodes.wordpress}
                </pre>
              </div>

              {/* HTML/JavaScript */}
              <div style={{ backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.75rem', padding: '1.5rem', opacity: config.enabled ? 1 : 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>🌐</span>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-text-primary)', margin: 0 }}>HTML/JavaScript</h3>
                  </div>
                  <button
                    onClick={() => copyCode(embedCodes.html, 'html')}
                    disabled={!config.enabled}
                    style={{ padding: '0.5rem 1rem', backgroundColor: copiedCode === 'html' ? 'var(--color-success-dark)' : 'var(--color-bg-paper)', color: copiedCode === 'html' ? 'var(--color-success-light)' : 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: '600', cursor: config.enabled ? 'pointer' : 'not-allowed' }}
                  >
                    {copiedCode === 'html' ? '✓ Copied!' : '📋 Copy'}
                  </button>
                </div>
                <pre style={{ backgroundColor: 'var(--color-bg-main)', padding: '1rem', borderRadius: '0.5rem', overflow: 'auto', fontSize: '0.875rem', color: 'var(--color-success-light)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
{embedCodes.html}
                </pre>
              </div>

              {/* React Component */}
              <div style={{ backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.75rem', padding: '1.5rem', opacity: config.enabled ? 1 : 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>⚛️</span>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-text-primary)', margin: 0 }}>React Component</h3>
                  </div>
                  <button
                    onClick={() => copyCode(embedCodes.react, 'react')}
                    disabled={!config.enabled}
                    style={{ padding: '0.5rem 1rem', backgroundColor: copiedCode === 'react' ? 'var(--color-success-dark)' : 'var(--color-bg-paper)', color: copiedCode === 'react' ? 'var(--color-success-light)' : 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: '600', cursor: config.enabled ? 'pointer' : 'not-allowed' }}
                  >
                    {copiedCode === 'react' ? '✓ Copied!' : '📋 Copy'}
                  </button>
                </div>
                <pre style={{ backgroundColor: 'var(--color-bg-main)', padding: '1rem', borderRadius: '0.5rem', overflow: 'auto', fontSize: '0.875rem', color: 'var(--color-success-light)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
{embedCodes.react}
                </pre>
              </div>

              {/* iframe */}
              <div style={{ backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.75rem', padding: '1.5rem', opacity: config.enabled ? 1 : 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>🖼️</span>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-text-primary)', margin: 0 }}>iframe Embed</h3>
                  </div>
                  <button
                    onClick={() => copyCode(embedCodes.iframe, 'iframe')}
                    disabled={!config.enabled}
                    style={{ padding: '0.5rem 1rem', backgroundColor: copiedCode === 'iframe' ? 'var(--color-success-dark)' : 'var(--color-bg-paper)', color: copiedCode === 'iframe' ? 'var(--color-success-light)' : 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: '600', cursor: config.enabled ? 'pointer' : 'not-allowed' }}
                  >
                    {copiedCode === 'iframe' ? '✓ Copied!' : '📋 Copy'}
                  </button>
                </div>
                <pre style={{ backgroundColor: 'var(--color-bg-main)', padding: '1rem', borderRadius: '0.5rem', overflow: 'auto', fontSize: '0.875rem', color: 'var(--color-success-light)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
{embedCodes.iframe}
                </pre>
              </div>

              {/* Usage Instructions */}
              <div style={{ backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.75rem', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>📚 Quick Start Guide</h3>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
                  <p style={{ marginBottom: '0.75rem' }}><strong style={{ color: 'var(--color-text-primary)' }}>WordPress:</strong> Copy the shortcode and paste it into any page/post editor</p>
                  <p style={{ marginBottom: '0.75rem' }}><strong style={{ color: 'var(--color-text-primary)' }}>Wix/Squarespace:</strong> Add HTML embed element and paste the HTML code</p>
                  <p style={{ marginBottom: '0.75rem' }}><strong style={{ color: 'var(--color-text-primary)' }}>React App:</strong> Install our package and use the React component</p>
                  <p><strong style={{ color: 'var(--color-text-primary)' }}>Any Website:</strong> Use the iframe embed - works everywhere, no configuration needed</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Preview Panel */}
        {showPreview && (
          <div style={{ flex: '0 0 45%', backgroundColor: 'var(--color-bg-main)', borderLeft: '1px solid var(--color-border-light)', padding: '2rem', overflowY: 'auto', maxHeight: 'calc(100vh - 140px)', position: 'sticky', top: '140px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-text-primary)', margin: 0 }}>Live Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                style={{ color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.75rem', cursor: 'pointer' }}
              >
                Hide Preview
              </button>
            </div>

            {/* Preview Frame - Using CRM Theme */}
            <div style={{ 
              backgroundColor: 'var(--color-text-primary)', 
              border: '2px solid var(--color-border-strong)', 
              borderRadius: '0.75rem', 
              padding: '2rem',
              minHeight: '600px'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <h1 style={{ 
                  fontSize: '2rem', 
                  fontWeight: 'bold', 
                  color: 'var(--color-text-primary)',
                  fontFamily: crmTheme.typography.fontFamily.heading,
                  marginBottom: '0.5rem'
                }}>
                  {config.storeName}
                </h1>
                <p style={{ fontSize: '1rem', color: 'var(--color-text-disabled)' }}>
                  {config.businessType === 'products' ? 'Browse our products' : config.businessType === 'services' ? 'Book our services' : 'Products & Services'}
                </p>
              </div>

              {/* Sample Product/Service Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} style={{ 
                    backgroundColor: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: crmTheme.layout.borderRadius.card,
                    padding: '1rem',
                    fontFamily: crmTheme.typography.fontFamily.body
                  }}>
                    <div style={{ 
                      width: '100%', 
                      height: '120px', 
                      backgroundColor: 'var(--color-border-light)',
                      borderRadius: '0.5rem',
                      marginBottom: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2rem'
                    }}>
                      {config.businessType === 'services' ? '💼' : '📦'}
                    </div>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
                      {config.businessType === 'services' ? `Service ${i}` : `Product ${i}`}
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.75rem' }}>
                      Sample description
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '1.125rem', fontWeight: 'bold', color: crmTheme.colors.primary.main }}>
                        ${(i * 25).toFixed(2)}
                      </span>
                      <button style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: crmTheme.colors.primary.main,
                        color: 'var(--color-text-primary)',
                        border: 'none',
                        borderRadius: crmTheme.layout.borderRadius.button,
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        fontFamily: crmTheme.typography.fontFamily.body
                      }}>
                        {config.businessType === 'services' ? 'Book Now' : 'Add to Cart'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sample Buttons */}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: crmTheme.colors.primary.main,
                  color: 'var(--color-text-primary)',
                  border: 'none',
                  borderRadius: crmTheme.layout.borderRadius.button,
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: crmTheme.typography.fontFamily.body
                }}>
                  Primary Button
                </button>
                <button style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'transparent',
                  color: crmTheme.colors.primary.main,
                  border: `2px solid ${crmTheme.colors.primary.main}`,
                  borderRadius: crmTheme.layout.borderRadius.button,
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: crmTheme.typography.fontFamily.body
                }}>
                  Outline Button
                </button>
              </div>
            </div>
          </div>
        )}

        {!showPreview && (
          <button
            onClick={() => setShowPreview(true)}
            style={{
              position: 'fixed',
              right: '2rem',
              bottom: '2rem',
              padding: '1rem 1.5rem',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-primary)',
              border: 'none',
              borderRadius: '0.75rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 10px 40px rgba(var(--color-primary-rgb), 0.3)',
              zIndex: 50
            }}
          >
            👁️ Show Preview
          </button>
        )}
      </div>
    </div>
  );
}

