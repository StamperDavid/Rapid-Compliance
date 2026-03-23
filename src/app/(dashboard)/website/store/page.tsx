'use client';

/**
 * Website Store Configuration
 *
 * Storefront configuration within the website builder hub.
 * This is the same storefront settings UI, now accessible from
 * the Website > Store tab instead of a separate nav item.
 */

import { PLATFORM_ID } from '@/lib/constants/platform';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFeatureModules } from '@/hooks/useFeatureModules';
import { logger } from '@/lib/logger/logger';

interface StoreConfig {
  enabled: boolean;
  businessType: 'products' | 'services' | 'both';
  storeName: string;
  storeUrl: string;
  checkoutSettings: {
    enableGuestCheckout: boolean;
    requirePhone: boolean;
    collectShipping: boolean;
  };
  paymentProcessing: {
    enablePayments: boolean;
    stripeEnabled: boolean;
    paypalEnabled: boolean;
    autoCreateOrder: boolean;
    autoCreateInvoice: boolean;
    autoRecordPayment: boolean;
    currency: string;
    taxRate: number;
  };
}

const DEFAULT_CONFIG: StoreConfig = {
  enabled: false,
  businessType: 'both',
  storeName: 'My Store',
  storeUrl: 'store',
  checkoutSettings: {
    enableGuestCheckout: true,
    requirePhone: false,
    collectShipping: true,
  },
  paymentProcessing: {
    enablePayments: true,
    stripeEnabled: true,
    paypalEnabled: false,
    autoCreateOrder: true,
    autoCreateInvoice: true,
    autoRecordPayment: true,
    currency: 'USD',
    taxRate: 0,
  },
};

export default function WebsiteStorePage() {
  const { user } = useAuth();
  const { updateModule } = useFeatureModules();
  const [config, setConfig] = useState<StoreConfig>(DEFAULT_CONFIG);
  const [isSaving, setIsSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) { return; }

    const loadConfig = async () => {
      try {
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        const configData = await FirestoreService.get(
          `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/storefrontConfig`,
          'default'
        );
        if (configData) {
          const storedConfig = configData as StoreConfig;
          setConfig(storedConfig);
          updateModule('storefront', storedConfig.enabled);
        }
        setLoaded(true);
      } catch (error: unknown) {
        logger.error('Failed to load store config', error instanceof Error ? error : new Error(String(error)));
        setLoaded(true);
      }
    };

    void loadConfig();
  }, [user, updateModule]);

  const handleSave = async () => {
    if (!user) { return; }
    setIsSaving(true);
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/storefrontConfig`,
        'default',
        { ...config, updatedAt: new Date().toISOString() },
        false
      );
      updateModule('storefront', config.enabled);
    } catch (error: unknown) {
      logger.error('Failed to save store config', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setTimeout(() => setIsSaving(false), 1000);
    }
  };

  const updateConfig = <K extends keyof StoreConfig>(key: K, value: StoreConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  if (!loaded) {
    return (
      <div className="p-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>
        Loading store configuration...
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Online Store
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Configure your website&apos;s storefront — let customers browse and buy directly from your site.
          </p>
        </div>
        <button
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: isSaving ? 'var(--color-text-disabled)' : 'var(--color-primary)' }}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="space-y-6">
        {/* Enable/Disable */}
        <div
          className="p-5 rounded-xl border"
          style={{ borderColor: 'var(--color-border-light)', backgroundColor: 'var(--color-bg-elevated)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Enable Online Store
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                Add browseable product and service pages to your website with checkout.
              </p>
            </div>
            <button
              onClick={() => updateConfig('enabled', !config.enabled)}
              className="relative w-11 h-6 rounded-full transition-colors"
              style={{ backgroundColor: config.enabled ? 'var(--color-primary)' : 'var(--color-bg-main)' }}
            >
              <div
                className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
                style={{
                  backgroundColor: config.enabled ? 'white' : 'var(--color-text-disabled)',
                  transform: config.enabled ? 'translateX(1.25rem)' : 'translateX(0.125rem)',
                }}
              />
            </button>
          </div>
        </div>

        {config.enabled && (
          <>
            {/* Store Details */}
            <div
              className="p-5 rounded-xl border space-y-4"
              style={{ borderColor: 'var(--color-border-light)', backgroundColor: 'var(--color-bg-elevated)' }}
            >
              <h2 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Store Details
              </h2>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Store Name
                </label>
                <input
                  type="text"
                  value={config.storeName}
                  onChange={(e) => updateConfig('storeName', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-border-light)', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  What do you sell?
                </label>
                <select
                  value={config.businessType}
                  onChange={(e) => updateConfig('businessType', e.target.value as StoreConfig['businessType'])}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-border-light)', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-primary)' }}
                >
                  <option value="products">Products only</option>
                  <option value="services">Services only</option>
                  <option value="both">Products and Services</option>
                </select>
              </div>
            </div>

            {/* Checkout Settings */}
            <div
              className="p-5 rounded-xl border space-y-3"
              style={{ borderColor: 'var(--color-border-light)', backgroundColor: 'var(--color-bg-elevated)' }}
            >
              <h2 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Checkout
              </h2>
              {[
                { key: 'enableGuestCheckout' as const, label: 'Allow guest checkout', desc: 'Customers can buy without creating an account' },
                { key: 'requirePhone' as const, label: 'Require phone number', desc: 'Phone number required at checkout' },
                { key: 'collectShipping' as const, label: 'Collect shipping address', desc: 'Required for physical product delivery' },
              ].map((setting) => (
                <div key={setting.key} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{setting.label}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>{setting.desc}</p>
                  </div>
                  <button
                    onClick={() => setConfig((prev) => ({
                      ...prev,
                      checkoutSettings: { ...prev.checkoutSettings, [setting.key]: !prev.checkoutSettings[setting.key] },
                    }))}
                    className="relative w-11 h-6 rounded-full transition-colors"
                    style={{ backgroundColor: config.checkoutSettings[setting.key] ? 'var(--color-primary)' : 'var(--color-bg-main)' }}
                  >
                    <div
                      className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
                      style={{
                        backgroundColor: config.checkoutSettings[setting.key] ? 'white' : 'var(--color-text-disabled)',
                        transform: config.checkoutSettings[setting.key] ? 'translateX(1.25rem)' : 'translateX(0.125rem)',
                      }}
                    />
                  </button>
                </div>
              ))}
            </div>

            {/* Payment Processing */}
            <div
              className="p-5 rounded-xl border space-y-3"
              style={{ borderColor: 'var(--color-border-light)', backgroundColor: 'var(--color-bg-elevated)' }}
            >
              <h2 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Payment Processing
              </h2>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Stripe</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>Accept credit/debit cards</p>
                </div>
                <button
                  onClick={() => setConfig((prev) => ({
                    ...prev,
                    paymentProcessing: { ...prev.paymentProcessing, stripeEnabled: !prev.paymentProcessing.stripeEnabled },
                  }))}
                  className="relative w-11 h-6 rounded-full transition-colors"
                  style={{ backgroundColor: config.paymentProcessing.stripeEnabled ? 'var(--color-primary)' : 'var(--color-bg-main)' }}
                >
                  <div
                    className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
                    style={{
                      backgroundColor: config.paymentProcessing.stripeEnabled ? 'white' : 'var(--color-text-disabled)',
                      transform: config.paymentProcessing.stripeEnabled ? 'translateX(1.25rem)' : 'translateX(0.125rem)',
                    }}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>PayPal</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>Accept PayPal payments</p>
                </div>
                <button
                  onClick={() => setConfig((prev) => ({
                    ...prev,
                    paymentProcessing: { ...prev.paymentProcessing, paypalEnabled: !prev.paymentProcessing.paypalEnabled },
                  }))}
                  className="relative w-11 h-6 rounded-full transition-colors"
                  style={{ backgroundColor: config.paymentProcessing.paypalEnabled ? 'var(--color-primary)' : 'var(--color-bg-main)' }}
                >
                  <div
                    className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
                    style={{
                      backgroundColor: config.paymentProcessing.paypalEnabled ? 'white' : 'var(--color-text-disabled)',
                      transform: config.paymentProcessing.paypalEnabled ? 'translateX(1.25rem)' : 'translateX(0.125rem)',
                    }}
                  />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
