'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import type { ComplianceRecord } from '@/types/admin';

export default function CompliancePage() {
  const { adminUser, hasPermission } = useAdminAuth();
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    setTimeout(() => {
      setRecords([
        {
          id: 'comp-1',
          organizationId: 'org-1',
          type: 'gdpr',
          status: 'compliant',
          requirements: [
            { id: 'req-1', name: 'Data Encryption', description: 'All data encrypted at rest', status: 'met', evidence: 'AES-256 encryption enabled' },
            { id: 'req-2', name: 'Right to Access', description: 'Users can export their data', status: 'met', evidence: 'Export feature implemented' },
            { id: 'req-3', name: 'Right to Deletion', description: 'Users can delete their data', status: 'met', evidence: 'Delete functionality available' },
          ],
          lastAuditAt: new Date('2024-03-01') as any,
          nextAuditAt: new Date('2024-06-01') as any,
          updatedAt: new Date() as any,
        },
        {
          id: 'comp-2',
          organizationId: 'org-2',
          type: 'ccpa',
          status: 'compliant',
          requirements: [
            { id: 'req-4', name: 'Privacy Notice', description: 'Clear privacy policy displayed', status: 'met', evidence: 'Privacy policy published' },
            { id: 'req-5', name: 'Opt-Out Rights', description: 'Users can opt-out of data sales', status: 'met', evidence: 'Do Not Sell option available' },
            { id: 'req-6', name: 'Data Deletion', description: 'Users can request deletion', status: 'met', evidence: 'Deletion workflow implemented' },
          ],
          lastAuditAt: new Date('2024-02-15') as any,
          nextAuditAt: new Date('2024-05-15') as any,
          updatedAt: new Date() as any,
        },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  if (!hasPermission('canManageCompliance')) {
    return (
      <div style={{ padding: '2rem', color: '#fff' }}>
        <div style={{ padding: '1.5rem', backgroundColor: '#7f1d1d', border: '1px solid #991b1b', borderRadius: '0.5rem', color: '#fff' }}>
          <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Access Denied</div>
          <div style={{ fontSize: '0.875rem' }}>You don't have permission to manage compliance.</div>
        </div>
      </div>
    );
  }

  // Note: Currently showing demo compliance data. In production, this would be connected
  // to a real compliance tracking system like Vanta, Drata, or custom compliance auditing.
  
  const filteredRecords = filterType === 'all' 
    ? records 
    : records.filter(r => r.type === filterType);

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const primaryColor = '#6366f1';

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Compliance Management
          </h1>
          <p style={{ color: '#666', fontSize: '0.875rem' }}>
            Track compliance status across organizations
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard label="Total Records" value={records.length} />
        <StatCard label="Compliant" value={records.filter(r => r.status === 'compliant').length} />
        <StatCard label="Non-Compliant" value={records.filter(r => r.status === 'non_compliant').length} />
        <StatCard label="Pending Review" value={records.filter(r => r.status === 'pending_review').length} />
      </div>

      {/* Filter */}
      <div style={{ marginBottom: '1.5rem' }}>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            padding: '0.625rem 1rem',
            backgroundColor: bgPaper,
            border: `1px solid ${borderColor}`,
            borderRadius: '0.5rem',
            color: '#fff',
            fontSize: '0.875rem'
          }}
        >
          <option value="all">All Types</option>
          <option value="gdpr">GDPR</option>
          <option value="ccpa">CCPA</option>
          <option value="sox">SOX</option>
        </select>
      </div>

      {/* Compliance Records */}
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          Loading compliance records...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredRecords.map((record) => (
            <div
              key={record.id}
              style={{
                backgroundColor: bgPaper,
                border: `1px solid ${borderColor}`,
                borderRadius: '0.75rem',
                padding: '1.5rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>
                      {record.type.toUpperCase()} - Organization {record.organizationId}
                    </h3>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      backgroundColor: record.status === 'compliant' ? '#065f46' : record.status === 'non_compliant' ? '#7f1d1d' : '#78350f',
                      color: record.status === 'compliant' ? '#10b981' : record.status === 'non_compliant' ? '#ef4444' : '#f59e0b',
                      textTransform: 'uppercase'
                    }}>
                      {record.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>
                    Last audit: {record.lastAuditAt ? new Date(record.lastAuditAt as any).toLocaleDateString() : 'Never'} • 
                    Next audit: {record.nextAuditAt ? new Date(record.nextAuditAt as any).toLocaleDateString() : 'Not scheduled'}
                  </div>
                </div>
              </div>

              {/* Requirements */}
              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem' }}>Requirements</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {record.requirements.map((req) => (
                    <div
                      key={req.id}
                      style={{
                        padding: '0.75rem',
                        backgroundColor: '#0a0a0a',
                        border: `1px solid ${borderColor}`,
                        borderRadius: '0.5rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'start'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{req.name}</div>
                        <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>{req.description}</div>
                        {req.evidence && (
                          <div style={{ fontSize: '0.75rem', color: '#999' }}>Evidence: {req.evidence}</div>
                        )}
                      </div>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        backgroundColor: req.status === 'met' ? '#065f46' : req.status === 'not_met' ? '#7f1d1d' : '#4b5563',
                        color: req.status === 'met' ? '#10b981' : req.status === 'not_met' ? '#ef4444' : '#9ca3af',
                        textTransform: 'uppercase'
                      }}>
                        {req.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {record.auditNotes && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#78350f', border: '1px solid #92400e', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Audit Notes</div>
                  <div style={{ fontSize: '0.875rem', color: '#fecaca' }}>{record.auditNotes}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  return (
    <div style={{
      backgroundColor: bgPaper,
      border: `1px solid ${borderColor}`,
      borderRadius: '0.5rem',
      padding: '1rem',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#666' }}>{label}</div>
    </div>
  );
}






