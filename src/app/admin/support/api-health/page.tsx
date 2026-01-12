'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { logger } from '@/lib/logger/logger';

interface OrgAPIHealth {
  orgId: string;
  orgName: string;
  aiKeys: {
    openai: { configured: boolean; lastError?: string; lastChecked?: Date };
    anthropic: { configured: boolean; lastError?: string; lastChecked?: Date };
    openrouter: { configured: boolean; lastError?: string; lastChecked?: Date };
    gemini: { configured: boolean; lastError?: string; lastChecked?: Date };
  };
  otherServices: {
    sendgrid: { configured: boolean; lastError?: string };
    twilio: { configured: boolean; lastError?: string };
    stripe: { configured: boolean; lastError?: string };
  };
}

export default function APIHealthPage() {
  const { hasPermission } = useAdminAuth();
  const [orgs, setOrgs] = useState<OrgAPIHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);

  useEffect(() => {
    if (hasPermission('canAccessSupportTools')) {
      loadOrganizationHealth();
    }
  }, [hasPermission]);

  const loadOrganizationHealth = async () => {
    setLoading(true);
    try {
      const { FirestoreService } = await import('@/lib/db/firestore-service');
      const { adminDb } = await import('@/lib/firebase/admin');
      const { limit: firestoreLimit } = await import('firebase/firestore');
      
      // Get all organizations (using environment-aware collection)
      const { COLLECTIONS } = await import('@/lib/firebase/collections');
      let orgDocs: Array<{ id: string; data: () => any }>;
      if (adminDb) {
        const snapshot = await adminDb.collection(COLLECTIONS.ORGANIZATIONS).limit(50).get();
        orgDocs = snapshot.docs;
      } else {
        const orgsData = await FirestoreService.getAll('organizations', [firestoreLimit(50)]);
        // Convert array to snapshot-like structure
        orgDocs = orgsData.map((org: any) => ({
          id: org.id,
          data: () => org,
        }));
      }
      
      const orgHealthData: OrgAPIHealth[] = [];
      
      for (const orgDoc of orgDocs) {
        const orgData = orgDoc.data();
        const orgId = orgDoc.id;
        
        // Get API keys for this org (using environment-aware paths)
        let apiKeys;
        try {
          if (adminDb) {
            const { getOrgSubCollection } = await import('@/lib/firebase/collections');
            const apiKeysPath = getOrgSubCollection(orgId, 'apiKeys');
            const keysDoc = await adminDb
              .collection(apiKeysPath)
              .doc(orgId)
              .get();
            apiKeys = keysDoc.exists ? keysDoc.data() : null;
          } else {
            apiKeys = await FirestoreService.get(
              `organizations/${orgId}/apiKeys`,
              orgId
            );
          }
        } catch (error) {
          logger.error('Error loading API keys:', error, { file: 'page.tsx', orgId });
          apiKeys = null;
        }
        
        orgHealthData.push({
          orgId,
          orgName: (orgData.name !== '' && orgData.name != null) ? orgData.name : 'Unnamed Organization',
          aiKeys: {
            openai: {
              configured: !!apiKeys?.ai?.openaiApiKey,
              lastError: apiKeys?.ai?.openaiLastError ?? undefined,
              lastChecked: apiKeys?.ai?.openaiLastChecked ? new Date(apiKeys.ai.openaiLastChecked) : undefined
            },
            anthropic: {
              configured: !!apiKeys?.ai?.anthropicApiKey,
              lastError: apiKeys?.ai?.anthropicLastError ?? undefined,
              lastChecked: apiKeys?.ai?.anthropicLastChecked ? new Date(apiKeys.ai.anthropicLastChecked) : undefined
            },
            openrouter: {
              configured: !!apiKeys?.ai?.openrouterApiKey,
              lastError: apiKeys?.ai?.openrouterLastError ?? undefined,
              lastChecked: apiKeys?.ai?.openrouterLastChecked ? new Date(apiKeys.ai.openrouterLastChecked) : undefined
            },
            gemini: {
              configured: !!apiKeys?.ai?.geminiApiKey,
              lastError: apiKeys?.ai?.geminiLastError ?? undefined,
              lastChecked: apiKeys?.ai?.geminiLastChecked ? new Date(apiKeys.ai.geminiLastChecked) : undefined
            }
          },
          otherServices: {
            sendgrid: {
              configured: !!apiKeys?.email?.sendgrid?.apiKey,
              lastError: apiKeys?.email?.sendgrid?.lastError ?? undefined
            },
            twilio: {
              configured: !!apiKeys?.sms?.twilio?.accountSid,
              lastError: apiKeys?.sms?.twilio?.lastError ?? undefined
            },
            stripe: {
              configured: !!apiKeys?.payments?.stripe?.secretKey,
              lastError: apiKeys?.payments?.stripe?.lastError ?? undefined
            }
          }
        });
      }
      
      setOrgs(orgHealthData);
    } catch (error) {
      logger.error('Failed to load API health:', error, { file: 'page.tsx' });
      alert('Failed to load API health data');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (orgId: string, service: 'openai' | 'anthropic' | 'openrouter' | 'gemini') => {
    setTesting(`${orgId}-${service}`);
    try {
      // Call test endpoint
      const response = await fetch(`/api/admin/test-api-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, service })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`✅ ${service.toUpperCase()} connection successful!\n\nResponse: ${(result.message !== '' && result.message != null) ? result.message : 'API key is valid'}`);
        // Reload health data
        await loadOrganizationHealth();
      } else {
        alert(`❌ ${service.toUpperCase()} connection failed!\n\nError: ${result.error}`);
      }
    } catch (error: any) {
      logger.error('Test connection failed:', error, { file: 'page.tsx' });
      alert(`❌ Test failed: ${error.message}`);
    } finally {
      setTesting(null);
    }
  };

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const primaryColor = '#6366f1';

  if (!hasPermission('canAccessSupportTools')) {
    return (
      <div style={{ padding: '2rem', color: '#fff' }}>
        <div style={{ padding: '1.5rem', backgroundColor: '#7f1d1d', border: '1px solid #991b1b', borderRadius: '0.5rem', color: '#fff' }}>
          <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Access Denied</div>
          <div style={{ fontSize: '0.875rem' }}>You don't have permission to view API health.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          API Connectivity & Health
        </h1>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>
          Monitor API key configuration and test connections for all organizations (BYOK model)
        </p>
      </div>

      {/* Info Banner */}
      <div style={{
        padding: '1rem',
        backgroundColor: '#1e3a8a',
        border: '1px solid #3b82f6',
        borderRadius: '0.5rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'start',
        gap: '1rem'
      }}>
        <span style={{ fontSize: '1.5rem' }}>ℹ️</span>
        <div>
          <div style={{ fontWeight: '600', marginBottom: '0.25rem', color: '#93c5fd' }}>BYOK Model (Bring Your Own Key)</div>
          <div style={{ fontSize: '0.875rem', color: '#bfdbfe' }}>
            Each organization provides their own API keys. The platform stores them securely and injects them into workflows.
            OpenAI/Anthropic handle usage tracking and billing directly with the tenant.
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={loadOrganizationHealth}
          disabled={loading}
          style={{
            padding: '0.625rem 1.25rem',
            backgroundColor: loading ? '#4b5563' : primaryColor,
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Organizations List */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
          <div>Loading organization API health...</div>
        </div>
      ) : orgs.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📊</div>
          <div>No organizations found</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {orgs.map((org) => (
            <div
              key={org.orgId}
              style={{
                backgroundColor: bgPaper,
                border: `1px solid ${borderColor}`,
                borderRadius: '0.75rem',
                padding: '1.5rem'
              }}
            >
              {/* Org Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                    {org.orgName}
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: '#666', fontFamily: 'monospace' }}>
                    {org.orgId}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedOrg(selectedOrg === org.orgId ? null : org.orgId)}
                  style={{
                    padding: '0.375rem 0.75rem',
                    backgroundColor: 'transparent',
                    color: primaryColor,
                    border: `1px solid ${primaryColor}`,
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {selectedOrg === org.orgId ? '▲ Collapse' : '▼ Details'}
                </button>
              </div>

              {/* AI Services Overview */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                {Object.entries(org.aiKeys).map(([service, data]) => (
                  <div
                    key={service}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      border: `1px solid ${data.configured ? '#065f46' : '#374151'}`,
                      borderRadius: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: '600', textTransform: 'uppercase' }}>
                        {service}
                      </div>
                      <span style={{
                        fontSize: '1.25rem',
                        color: data.configured ? '#10b981' : '#6b7280'
                      }}>
                        {data.configured ? '✓' : '○'}
                      </span>
                    </div>
                    {data.configured && (
                      <>
                        {data.lastError && (
                          <div style={{ fontSize: '0.75rem', color: '#ef4444', marginBottom: '0.5rem' }}>
                            ⚠️ {data.lastError}
                          </div>
                        )}
                        {data.lastChecked && (
                          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>
                            Last checked: {data.lastChecked.toLocaleString()}
                          </div>
                        )}
                        <button
                          onClick={() => testConnection(org.orgId, service as any)}
                          disabled={testing === `${org.orgId}-${service}`}
                          style={{
                            width: '100%',
                            padding: '0.375rem',
                            backgroundColor: testing === `${org.orgId}-${service}` ? '#4b5563' : '#065f46',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '0.375rem',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            cursor: testing === `${org.orgId}-${service}` ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {testing === `${org.orgId}-${service}` ? 'Testing...' : 'Test Connection'}
                        </button>
                      </>
                    )}
                    {!data.configured && (
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        No key configured
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Expanded Details */}
              {selectedOrg === org.orgId && (
                <div style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  backgroundColor: '#0a0a0a',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '0.5rem'
                }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem', color: '#9ca3af' }}>
                    Other Services
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                    {Object.entries(org.otherServices).map(([service, data]) => (
                      <div key={service} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                        <span style={{ textTransform: 'capitalize' }}>{service}:</span>
                        <span style={{ color: data.configured ? '#10b981' : '#6b7280' }}>
                          {data.configured ? '✓ Configured' : '○ Not Set'}
                        </span>
                      </div>
                    ))}
                  </div>
                  {Object.values(org.otherServices).some(s => s.lastError) && (
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: `1px solid ${borderColor}` }}>
                      <h5 style={{ fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.5rem', color: '#ef4444' }}>
                        Recent Errors:
                      </h5>
                      {Object.entries(org.otherServices).map(([service, data]) =>
                        data.lastError ? (
                          <div key={service} style={{ fontSize: '0.75rem', color: '#ef4444', marginBottom: '0.25rem' }}>
                            • {service}: {data.lastError}
                          </div>
                        ) : null
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '0.5rem' }}>
        <div style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#94a3b8' }}>
          ℹ️ API Key Storage
        </div>
        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
          • Keys are stored in Firestore at: <code style={{ backgroundColor: '#020617', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontFamily: 'monospace' }}>organizations/{'{orgId}'}/apiKeys/{'{orgId}'}</code><br />
          • Encryption is handled by the platform's encryption utility<br />
          • "Test Connection" sends a dummy prompt to verify key validity<br />
          • Errors are captured from provider responses (401, 403, 429, etc.)
        </div>
      </div>
    </div>
  );
}
