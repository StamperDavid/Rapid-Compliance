'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { SubscriptionTier } from '@/types/subscription';
import { VOLUME_TIERS, TIER_PRICING } from '@/types/subscription';
import AdminBar from '@/components/AdminBar';

interface TierConfig {
  id: SubscriptionTier;
  name: string;
  price: number;
  recordMin: number;
  recordMax: number;
  description: string;
  active: boolean;
}

export default function PricingTiersAdmin() {
  useAuth();
  const [tiers, setTiers] = useState<TierConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadTiers();
  }, []);

  const loadTiers = async () => {
    try {
      // Try to load from Firestore first
      const response = await fetch('/api/admin/pricing-tiers');
      if (response.ok) {
        const data = await response.json();
        setTiers(data.tiers);
      } else {
        // Fall back to code defaults
        setTiers([
          {
            id: 'tier1',
            name: VOLUME_TIERS.tier1.name,
            price: TIER_PRICING.tier1.monthly,
            recordMin: VOLUME_TIERS.tier1.recordMin,
            recordMax: VOLUME_TIERS.tier1.recordMax,
            description: VOLUME_TIERS.tier1.description,
            active: true,
          },
          {
            id: 'tier2',
            name: VOLUME_TIERS.tier2.name,
            price: TIER_PRICING.tier2.monthly,
            recordMin: VOLUME_TIERS.tier2.recordMin,
            recordMax: VOLUME_TIERS.tier2.recordMax,
            description: VOLUME_TIERS.tier2.description,
            active: true,
          },
          {
            id: 'tier3',
            name: VOLUME_TIERS.tier3.name,
            price: TIER_PRICING.tier3.monthly,
            recordMin: VOLUME_TIERS.tier3.recordMin,
            recordMax: VOLUME_TIERS.tier3.recordMax,
            description: VOLUME_TIERS.tier3.description,
            active: true,
          },
          {
            id: 'tier4',
            name: VOLUME_TIERS.tier4.name,
            price: TIER_PRICING.tier4.monthly,
            recordMin: VOLUME_TIERS.tier4.recordMin,
            recordMax: VOLUME_TIERS.tier4.recordMax,
            description: VOLUME_TIERS.tier4.description,
            active: true,
          },
        ]);
      }
    } catch (error) {
      console.error('Error loading tiers:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTier = (tierId: SubscriptionTier, field: string, value: any) => {
    setTiers(prev => prev.map(t => 
      t.id === tierId ? { ...t, [field]: value } : t
    ));
  };

  const saveTiers = async () => {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/pricing-tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiers }),
      });

      if (response.ok) {
        setMessage('✅ Pricing tiers saved! Changes will be live immediately.');
        
        // Update AI agent knowledge base
        await fetch('/api/admin/update-agent-pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tiers }),
        });
      } else {
        setMessage('❌ Error saving tiers. Please try again.');
      }
    } catch (error) {
      setMessage(`❌ Error: ${  (error as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#666' }}>Loading pricing tiers...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000', color: '#fff' }}>
      <AdminBar />
      
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '3rem 2rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Pricing Tier Management
          </h1>
          <p style={{ color: '#999', fontSize: '1.125rem' }}>
            Update pricing without touching code. Changes apply immediately to the website, billing system, and AI agent.
          </p>
        </div>

        {/* Message */}
        {message && (
          <div style={{
            padding: '1rem',
            backgroundColor: message.includes('✅') ? '#065f46' : '#7f1d1d',
            border: message.includes('✅') ? '1px solid #10b981' : '1px solid #ef4444',
            borderRadius: '0.5rem',
            marginBottom: '2rem',
          }}>
            {message}
          </div>
        )}

        {/* Info Box */}
        <div style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '2rem',
        }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#6366f1' }}>
            💡 How This Works
          </h3>
          <ul style={{ color: '#ccc', lineHeight: '1.8', paddingLeft: '1.5rem' }}>
            <li>Update pricing here - no code changes needed</li>
            <li>Changes are saved to Firestore and apply instantly</li>
            <li>Pricing page automatically updates</li>
            <li>AI sales agent gets updated knowledge</li>
            <li>New signups use the new tiers</li>
            <li>Existing customers stay on their current tier until they upgrade</li>
          </ul>
        </div>

        {/* Pricing Tiers */}
        <div style={{ display: 'grid', gap: '2rem' }}>
          {tiers.map(tier => (
            <div
              key={tier.id}
              style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '0.75rem',
                padding: '2rem',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                {/* Tier ID */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>
                    Tier ID
                  </label>
                  <input
                    type="text"
                    value={tier.id}
                    disabled
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      borderRadius: '0.375rem',
                      color: '#666',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                {/* Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={tier.name}
                    onChange={(e) => updateTier(tier.id, 'name', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      borderRadius: '0.375rem',
                      color: '#fff',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                {/* Monthly Price */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>
                    Monthly Price ($)
                  </label>
                  <input
                    type="number"
                    value={tier.price}
                    onChange={(e) => updateTier(tier.id, 'price', parseInt(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      borderRadius: '0.375rem',
                      color: '#fff',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                {/* Record Range */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>
                    Record Capacity
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="number"
                      value={tier.recordMin}
                      onChange={(e) => updateTier(tier.id, 'recordMin', parseInt(e.target.value))}
                      placeholder="Min"
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #333',
                        borderRadius: '0.375rem',
                        color: '#fff',
                        fontSize: '0.875rem',
                      }}
                    />
                    <span style={{ color: '#666' }}>to</span>
                    <input
                      type="number"
                      value={tier.recordMax}
                      onChange={(e) => updateTier(tier.id, 'recordMax', parseInt(e.target.value))}
                      placeholder="Max"
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #333',
                        borderRadius: '0.375rem',
                        color: '#fff',
                        fontSize: '0.875rem',
                      }}
                    />
                  </div>
                </div>

                {/* Description */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>
                    Description
                  </label>
                  <input
                    type="text"
                    value={tier.description}
                    onChange={(e) => updateTier(tier.id, 'description', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      borderRadius: '0.375rem',
                      color: '#fff',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                {/* Active Toggle */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={tier.active}
                      onChange={(e) => updateTier(tier.id, 'active', e.target.checked)}
                      style={{ width: '1.25rem', height: '1.25rem' }}
                    />
                    <span style={{ fontSize: '0.875rem', color: tier.active ? '#10b981' : '#999' }}>
                      {tier.active ? '✅ Active (visible to customers)' : '⏸️ Inactive (hidden from pricing page)'}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Save Button */}
        <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={saveTiers}
            disabled={saving}
            style={{
              padding: '1rem 3rem',
              backgroundColor: '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1.125rem',
              fontWeight: '600',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving...' : '💾 Save Pricing Changes'}
          </button>
        </div>

        {/* Warning */}
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#7f1d1d20',
          border: '1px solid #7f1d1d',
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
          color: '#fca5a5',
        }}>
          ⚠️ <strong>Important:</strong> Pricing changes apply to new signups immediately. 
          Existing customers remain on their current tier. You must manually upgrade/downgrade existing customers if needed.
        </div>
      </div>
    </div>
  );
}

