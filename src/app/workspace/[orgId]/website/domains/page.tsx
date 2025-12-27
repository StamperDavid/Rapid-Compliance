/**
 * Custom Domains Management
 * Add, verify, and manage custom domains for the website
 * CRITICAL: Multi-tenant - scoped to organizationId
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useOrgTheme } from '@/hooks/useOrgTheme';

interface CustomDomain {
  id: string;
  organizationId: string;
  verified: boolean;
  verificationMethod: 'cname' | 'a-record' | 'txt';
  verificationValue: string;
  verifiedAt?: string;
  sslEnabled: boolean;
  sslStatus: 'pending' | 'active' | 'failed';
  sslIssuedAt?: string;
  sslExpiresAt?: string;
  dnsRecords: Array<{
    type: string;
    name: string;
    value: string;
    status: string;
  }>;
  status: 'pending' | 'active' | 'failed' | 'suspended';
  createdAt: string;
  lastCheckedAt: string;
}

export default function CustomDomainsPage() {
  const params = useParams();
  const organizationId = params.orgId as string;
  const { theme } = useOrgTheme();

  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Get theme colors
  const primaryColor = theme?.colors?.primary?.main || '#3b82f6';
  const bgColor = theme?.colors?.background?.main || '#000000';
  const textColor = theme?.colors?.text?.primary || '#ffffff';

  useEffect(() => {
    loadDomains();
  }, [organizationId]);

  const loadDomains = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/website/domains?organizationId=${organizationId}`);

      if (!response.ok) {
        throw new Error('Failed to load domains');
      }

      const data = await response.json();
      setDomains(data.domains || []);
    } catch (err: any) {
      console.error('[Domains] Error loading:', err);
      setError(err.message || 'Failed to load domains');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newDomain.trim()) {
      setError('Please enter a domain name');
      return;
    }

    // Basic domain validation
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    if (!domainRegex.test(newDomain)) {
      setError('Please enter a valid domain name (e.g., example.com or www.example.com)');
      return;
    }

    try {
      setAdding(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/website/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          domain: newDomain.toLowerCase().trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add domain');
      }

      const data = await response.json();
      setDomains([...domains, data.domain]);
      setNewDomain('');
      setShowAddDomain(false);
      setSuccess('Domain added successfully! Please configure DNS records.');
    } catch (err: any) {
      console.error('[Domains] Error adding:', err);
      setError(err.message || 'Failed to add domain');
    } finally {
      setAdding(false);
    }
  };

  const handleVerifyDomain = async (domainId: string) => {
    try {
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/website/domains/${domainId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Verification failed');
      }

      const data = await response.json();
      
      if (data.verified) {
        setSuccess('Domain verified successfully!');
        loadDomains(); // Reload to get updated status
      } else {
        setError('Domain not yet verified. Please check DNS records and try again.');
      }
    } catch (err: any) {
      console.error('[Domains] Error verifying:', err);
      setError(err.message || 'Failed to verify domain');
    }
  };

  const handleRemoveDomain = async (domainId: string) => {
    if (!confirm('Are you sure you want to remove this domain?')) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/website/domains/${domainId}?organizationId=${organizationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove domain');
      }

      setDomains(domains.filter(d => d.id !== domainId));
      setSuccess('Domain removed successfully');
    } catch (err: any) {
      console.error('[Domains] Error removing:', err);
      setError(err.message || 'Failed to remove domain');
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
      }}>
        <div>Loading domains...</div>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '40px 20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '32px',
      }}>
        <div>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: '8px',
          }}>
            Custom Domains
          </h1>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>
            Connect your own domain to your website
          </p>
        </div>

        <button
          onClick={() => setShowAddDomain(true)}
          style={{
            padding: '12px 24px',
            backgroundColor: primaryColor,
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          + Add Domain
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div style={{
          padding: '16px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          color: '#991b1b',
          marginBottom: '24px',
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '16px',
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '6px',
          color: '#166534',
          marginBottom: '24px',
        }}>
          {success}
        </div>
      )}

      {/* Add Domain Modal */}
      {showAddDomain && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '32px',
            maxWidth: '500px',
            width: '90%',
          }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '16px',
            }}>
              Add Custom Domain
            </h2>

            <form onSubmit={handleAddDomain}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '8px',
                  color: '#374151',
                }}>
                  Domain Name
                </label>
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="example.com or www.example.com"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                  disabled={adding}
                />
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddDomain(false);
                    setNewDomain('');
                    setError(null);
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                  disabled={adding}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    backgroundColor: primaryColor,
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: adding ? 'not-allowed' : 'pointer',
                    opacity: adding ? 0.6 : 1,
                  }}
                  disabled={adding}
                >
                  {adding ? 'Adding...' : 'Add Domain'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Domains List */}
      {domains.length === 0 ? (
        <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        backgroundColor: bgColor,
        borderRadius: '8px',
        border: `2px dashed ${primaryColor}40`,
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌐</div>
          <h3 style={{
          fontSize: '20px',
          fontWeight: '600',
          color: textColor,
          marginBottom: '8px',
          }}>
            No custom domains yet
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>
            Add a custom domain to use your own branded URL
          </p>
          <button
            onClick={() => setShowAddDomain(true)}
            style={{
              padding: '12px 24px',
              backgroundColor: primaryColor,
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Add Your First Domain
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {domains.map(domain => (
            <DomainCard
              key={domain.id}
              domain={domain}
              onVerify={handleVerifyDomain}
              onRemove={handleRemoveDomain}
              primaryColor={primaryColor}
              bgColor={bgColor}
              textColor={textColor}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DomainCard({
  domain,
  onVerify,
  onRemove,
  primaryColor,
  bgColor,
  textColor,
}: {
  domain: CustomDomain;
  onVerify: (id: string) => void;
  onRemove: (id: string) => void;
  primaryColor: string;
  bgColor: string;
  textColor: string;
}) {
  const [showDNS, setShowDNS] = useState(false);

  const getStatusBadge = () => {
    if (domain.verified && domain.sslStatus === 'active') {
      return (
        <span style={{
          padding: '4px 12px',
          backgroundColor: '#dcfce7',
          color: '#166534',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '500',
        }}>
          ✓ Active
        </span>
      );
    }
    if (domain.verified && domain.sslStatus === 'pending') {
      return (
        <span style={{
          padding: '4px 12px',
          backgroundColor: '#fef3c7',
          color: '#92400e',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '500',
        }}>
          ⏳ SSL Pending
        </span>
      );
    }
    return (
      <span style={{
        padding: '4px 12px',
        backgroundColor: '#fee2e2',
        color: '#991b1b',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '500',
      }}>
        ⚠️ Pending Verification
      </span>
    );
  };

  return (
    <div style={{
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '24px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#111827',
          }}>
            {domain.id}
          </h3>
          {getStatusBadge()}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {!domain.verified && (
            <button
              onClick={() => onVerify(domain.id)}
              style={{
                padding: '8px 16px',
                backgroundColor: primaryColor,
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Verify DNS
            </button>
          )}
          <button
            onClick={() => setShowDNS(!showDNS)}
            style={{
              padding: '8px 16px',
              backgroundColor: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            {showDNS ? 'Hide' : 'Show'} DNS Records
          </button>
          <button
            onClick={() => onRemove(domain.id)}
            style={{
              padding: '8px 16px',
              backgroundColor: 'white',
              color: '#dc2626',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Remove
          </button>
        </div>
      </div>

      {/* SSL Info */}
      {domain.verified && (
        <div style={{
          display: 'flex',
          gap: '24px',
          marginBottom: '16px',
          fontSize: '14px',
          color: '#6b7280',
        }}>
          <div>
            <strong>SSL Status:</strong> {domain.sslStatus}
          </div>
          {domain.sslIssuedAt && (
            <div>
              <strong>SSL Issued:</strong> {new Date(domain.sslIssuedAt).toLocaleDateString()}
            </div>
          )}
          {domain.sslExpiresAt && (
            <div>
              <strong>SSL Expires:</strong> {new Date(domain.sslExpiresAt).toLocaleDateString()}
            </div>
          )}
        </div>
      )}

      {/* DNS Records */}
      {showDNS && (
        <div style={{
          marginTop: '16px',
          padding: '16px',
          backgroundColor: bgColor,
          borderRadius: '6px',
        }}>
          <h4 style={{
            fontSize: '14px',
            fontWeight: '600',
            marginBottom: '12px',
            color: '#374151',
          }}>
            DNS Configuration
          </h4>
          <p style={{
            fontSize: '13px',
            color: '#6b7280',
            marginBottom: '16px',
          }}>
            Add these records to your DNS provider:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {domain.dnsRecords.map((record, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px' }}>
                  <div style={{ fontWeight: '600', color: '#374151' }}>Type:</div>
                  <div style={{ color: '#111827' }}>{record.type}</div>
                  
                  <div style={{ fontWeight: '600', color: '#374151' }}>Name:</div>
                  <div style={{ color: '#111827' }}>{record.name}</div>
                  
                  <div style={{ fontWeight: '600', color: '#374151' }}>Value:</div>
                  <div style={{ color: '#111827', wordBreak: 'break-all' }}>{record.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

