'use client';

import { useState } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import type { BulkOperation } from '@/types/admin';

export default function DataExportsPage() {
  const { adminUser, hasPermission } = useAdminAuth();
  const [exports, setExports] = useState<BulkOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportType, setExportType] = useState<'organizations' | 'users' | 'data' | 'audit'>('organizations');
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);
  const [format, setFormat] = useState<'json' | 'csv' | 'xlsx'>('json');

  if (!hasPermission('canExportData')) {
    return (
      <div style={{ padding: '2rem', color: '#fff' }}>
        <div style={{ padding: '1.5rem', backgroundColor: '#7f1d1d', border: '1px solid #991b1b', borderRadius: '0.5rem', color: '#fff' }}>
          <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Access Denied</div>
          <div style={{ fontSize: '0.875rem' }}>You don't have permission to export data.</div>
        </div>
      </div>
    );
  }

  const handleExport = async () => {
    setLoading(true);
    try {
      // In production, this would trigger a background job
      const newExport: BulkOperation = {
        id: `export-${Date.now()}`,
        type: 'export',
        status: 'processing',
        resourceType: exportType,
        parameters: {
          organizationIds: selectedOrgs,
          format,
        },
        totalItems: 0,
        processedItems: 0,
        successCount: 0,
        errorCount: 0,
        createdBy: adminUser?.id || '',
        createdAt: new Date() as any,
      };
      setExports([newExport, ...exports]);
      
      // Simulate processing
      setTimeout(() => {
        setExports(exports.map(e => 
          e.id === newExport.id 
            ? { ...e, status: 'completed', totalItems: 100, processedItems: 100, successCount: 100, downloadUrl: '/exports/export-123.json' }
            : e
        ));
      }, 2000);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const primaryColor = '#6366f1';

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Data Exports
        </h1>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>
          Export organization data, user information, and audit logs
        </p>
      </div>

      {/* Export Form */}
      <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Create Export</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Export Type
            </label>
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value as any)}
              style={{
                width: '100%',
                padding: '0.625rem 1rem',
                backgroundColor: '#0a0a0a',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                color: '#fff',
                fontSize: '0.875rem'
              }}
            >
              <option value="organizations">Organizations</option>
              <option value="users">Users</option>
              <option value="data">Organization Data</option>
              <option value="audit">Audit Logs</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Format
            </label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {(['json', 'csv', 'xlsx'] as const).map(fmt => (
                <label key={fmt} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    value={fmt}
                    checked={format === fmt}
                    onChange={(e) => setFormat(e.target.value as any)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.875rem', textTransform: 'uppercase' }}>{fmt}</span>
                </label>
              ))}
            </div>
          </div>

          {exportType === 'data' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                Select Organizations (leave empty for all)
              </label>
              <input
                type="text"
                placeholder="Comma-separated organization IDs"
                value={selectedOrgs.join(', ')}
                onChange={(e) => setSelectedOrgs(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                style={{
                  width: '100%',
                  padding: '0.625rem 1rem',
                  backgroundColor: '#0a0a0a',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontSize: '0.875rem'
                }}
              />
            </div>
          )}

          <button
            onClick={handleExport}
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: loading ? '#4b5563' : primaryColor,
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Creating Export...' : 'Create Export'}
          </button>
        </div>
      </div>

      {/* Export History */}
      <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Export History</h2>
        {exports.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
            No exports yet. Create your first export above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {exports.map((exp) => (
              <div
                key={exp.id}
                style={{
                  padding: '1rem',
                  backgroundColor: '#0a0a0a',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '0.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                    {exp.resourceType} Export ({(exp as any).format || 'json'})
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>
                    Created: {new Date(exp.createdAt as any).toLocaleString()}
                  </div>
                  {exp.status === 'processing' && (
                    <div style={{ fontSize: '0.875rem', color: '#f59e0b', marginTop: '0.25rem' }}>
                      Processing... {exp.processedItems}/{exp.totalItems}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    backgroundColor: exp.status === 'completed' ? '#065f46' : exp.status === 'processing' ? '#78350f' : '#7f1d1d',
                    color: exp.status === 'completed' ? '#10b981' : exp.status === 'processing' ? '#f59e0b' : '#ef4444',
                    textTransform: 'uppercase'
                  }}>
                    {exp.status}
                  </span>
                  {exp.status === 'completed' && exp.downloadUrl && (
                    <a
                      href={exp.downloadUrl}
                      download
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: primaryColor,
                        color: '#fff',
                        borderRadius: '0.375rem',
                        textDecoration: 'none',
                        fontSize: '0.875rem',
                        fontWeight: '600'
                      }}
                    >
                      Download
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}





