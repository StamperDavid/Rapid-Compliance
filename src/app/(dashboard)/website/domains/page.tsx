/**
 * Custom Domains Management
 * Add, verify, and manage custom domains for the website
 */

'use client';


import { useState, useEffect, useCallback } from 'react';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import SubpageNav from '@/components/ui/SubpageNav';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/lib/logger/logger';

interface CustomDomain {
  id: string;
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

interface DomainsResponse {
  domains: CustomDomain[];
}

interface AddDomainResponse {
  domain: CustomDomain;
  error?: string;
}

interface VerifyDomainResponse {
  verified: boolean;
  error?: string;
}

export default function CustomDomainsPage() {
  const { theme } = useOrgTheme();

  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const toast = useToast();

  // Get theme colors
  const primaryColor = (theme?.colors?.primary?.main !== '' && theme?.colors?.primary?.main != null) ? theme.colors.primary.main : 'var(--color-info)';
  const bgColor = (theme?.colors?.background?.main !== '' && theme?.colors?.background?.main != null) ? theme.colors.background.main : 'var(--color-bg-main)';
  const textColor = (theme?.colors?.text?.primary !== '' && theme?.colors?.text?.primary != null) ? theme.colors.text.primary : 'var(--color-text-primary)';

  const loadDomains = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/website/domains');

      if (!response.ok) {
        throw new Error('Failed to load domains');
      }

      const data = await response.json() as DomainsResponse;
      setDomains(data.domains ?? []);
    } catch (err: unknown) {
      logger.error('[Domains] Error loading', err instanceof Error ? err : new Error(String(err)));
      const errorMessage = err instanceof Error ? err.message : 'Failed to load domains';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDomains();
  }, [loadDomains]);

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
          domain: newDomain.toLowerCase().trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json() as AddDomainResponse;
        throw new Error((data.error !== '' && data.error != null) ? data.error : 'Failed to add domain');
      }

      const data = await response.json() as AddDomainResponse;
      setDomains([...domains, data.domain]);
      setNewDomain('');
      setShowAddDomain(false);
      setSuccess('Domain added successfully! Please configure DNS records.');
    } catch (err: unknown) {
      logger.error('[Domains] Error adding', err instanceof Error ? err : new Error(String(err)));
      const errorMessage = err instanceof Error ? err.message : 'Failed to add domain';
      setError(errorMessage);
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
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json() as VerifyDomainResponse;
        throw new Error((data.error !== '' && data.error != null) ? data.error : 'Verification failed');
      }

      const data = await response.json() as VerifyDomainResponse;

      if (data.verified) {
        setSuccess('Domain verified successfully!');
        void loadDomains(); // Reload to get updated status
      } else {
        setError('Domain not yet verified. Please check DNS records and try again.');
      }
    } catch (err: unknown) {
      logger.error('[Domains] Error verifying', err instanceof Error ? err : new Error(String(err)));
      const errorMessage = err instanceof Error ? err.message : 'Failed to verify domain';
      setError(errorMessage);
    }
  };

  const handleRemoveDomain = (domainId: string) => {
    toast.warning('Are you sure you want to remove this domain?');

    void (async () => {
      try {
        setError(null);
        setSuccess(null);

        const response = await fetch(`/api/website/domains/${domainId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to remove domain');
        }

        setDomains(domains.filter(d => d.id !== domainId));
        setSuccess('Domain removed successfully');
      } catch (err: unknown) {
        logger.error('[Domains] Error removing', err instanceof Error ? err : new Error(String(err)));
        const errorMessage = err instanceof Error ? err.message : 'Failed to remove domain';
        setError(errorMessage);
      }
    })();
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
      padding: '40px 20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <SubpageNav items={[
        { label: 'SEO', href: '/website/seo' },
        { label: 'Domains', href: '/website/domains' },
        { label: 'Site Settings', href: '/website/settings' },
      ]} />

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
            color: 'var(--color-text-primary)',
            marginBottom: '8px',
          }}>
            Custom Domains
          </h1>
          <p style={{ color: 'var(--color-text-disabled)', fontSize: '16px' }}>
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
          backgroundColor: 'var(--color-error-light)',
          border: '1px solid var(--color-error-light)',
          borderRadius: '6px',
          color: 'var(--color-error-dark)',
          marginBottom: '24px',
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '16px',
          backgroundColor: 'var(--color-success-light)',
          border: '1px solid var(--color-success-light)',
          borderRadius: '6px',
          color: 'var(--color-success-dark)',
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
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
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

            <form onSubmit={(e) => void handleAddDomain(e)}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '8px',
                  color: 'var(--color-border-strong)',
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
                    border: '1px solid var(--color-border-light)',
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
                    border: '1px solid var(--color-border-light)',
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
          <p style={{ color: 'var(--color-text-disabled)', marginBottom: '24px' }}>
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
              onVerify={(id) => void handleVerifyDomain(id)}
              onRemove={(id) => handleRemoveDomain(id)}
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
  textColor: _textColor,
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
          backgroundColor: 'var(--color-success-light)',
          color: 'var(--color-success-dark)',
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
          backgroundColor: 'var(--color-warning-light)',
          color: 'var(--color-warning-dark)',
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
        backgroundColor: 'var(--color-error-light)',
        color: 'var(--color-error-dark)',
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
      border: '1px solid var(--color-border-light)',
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
            color: 'var(--color-text-primary)',
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
              border: '1px solid var(--color-border-light)',
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
              color: 'var(--color-error)',
              border: '1px solid var(--color-border-light)',
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
          color: 'var(--color-text-disabled)',
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
            color: 'var(--color-border-strong)',
          }}>
            DNS Configuration
          </h4>
          <p style={{
            fontSize: '13px',
            color: 'var(--color-text-disabled)',
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
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px' }}>
                  <div style={{ fontWeight: '600', color: 'var(--color-border-strong)' }}>Type:</div>
                  <div style={{ color: 'var(--color-text-primary)' }}>{record.type}</div>
                  
                  <div style={{ fontWeight: '600', color: 'var(--color-border-strong)' }}>Name:</div>
                  <div style={{ color: 'var(--color-text-primary)' }}>{record.name}</div>
                  
                  <div style={{ fontWeight: '600', color: 'var(--color-border-strong)' }}>Value:</div>
                  <div style={{ color: 'var(--color-text-primary)', wordBreak: 'break-all' }}>{record.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

