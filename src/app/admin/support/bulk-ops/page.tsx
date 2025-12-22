'use client';

import { useState } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import type { BulkOperation } from '@/types/admin';

export default function BulkOperationsPage() {
  const { adminUser, hasPermission } = useAdminAuth();
  const [operations, setOperations] = useState<BulkOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [operationType, setOperationType] = useState<'update' | 'delete' | 'suspend'>('update');
  const [targetOrgs, setTargetOrgs] = useState<string[]>([]);
  const [parameters, setParameters] = useState<Record<string, any>>({});

  // This page is intentionally disabled - too dangerous for production
  const isDisabled = true;

  if (isDisabled) {
    return (
      <div style={{ padding: '2rem', color: '#fff' }}>
        <div style={{ padding: '2rem', backgroundColor: '#7f1d1d', border: '2px solid #991b1b', borderRadius: '1rem', color: '#fff', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚠️</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Bulk Operations Disabled</div>
          <div style={{ fontSize: '0.875rem', color: '#fecaca', maxWidth: '500px', margin: '0 auto' }}>
            Bulk operations have been disabled for safety. These operations can cause irreversible damage to customer data.
            <br /><br />
            If you need to perform bulk operations, please use the Firebase Console directly with proper backup procedures.
          </div>
        </div>
      </div>
    );
  }

  if (!hasPermission('canAccessSupportTools')) {
    return (
      <div style={{ padding: '2rem', color: '#fff' }}>
        <div style={{ padding: '1.5rem', backgroundColor: '#7f1d1d', border: '1px solid #991b1b', borderRadius: '0.5rem', color: '#fff' }}>
          <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Access Denied</div>
          <div style={{ fontSize: '0.875rem' }}>You don't have permission to perform bulk operations.</div>
        </div>
      </div>
    );
  }

  const handleBulkOperation = async () => {
    if (!targetOrgs.length) {
      alert('Please select at least one organization');
      return;
    }

    setLoading(true);
    try {
      const newOp: BulkOperation = {
        id: `bulk-${Date.now()}`,
        type: operationType,
        status: 'processing',
        organizationIds: targetOrgs,
        resourceType: 'organization',
        parameters,
        totalItems: targetOrgs.length,
        processedItems: 0,
        successCount: 0,
        errorCount: 0,
        createdBy: adminUser?.id || '',
        createdAt: new Date() as any,
      };
      setOperations([newOp, ...operations]);
      
      // Simulate processing
      setTimeout(() => {
        setOperations(operations.map(o => 
          o.id === newOp.id 
            ? { ...o, status: 'completed', processedItems: targetOrgs.length, successCount: targetOrgs.length }
            : o
        ));
      }, 2000);
    } catch (error) {
      console.error('Bulk operation failed:', error);
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
          Bulk Operations
        </h1>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>
          Perform bulk actions across multiple organizations
        </p>
      </div>

      {/* Warning */}
      <div style={{
        padding: '1rem',
        backgroundColor: '#78350f',
        border: '1px solid #92400e',
        borderRadius: '0.5rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'start',
        gap: '1rem'
      }}>
        <span style={{ fontSize: '1.5rem' }}>⚠️</span>
        <div>
          <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Warning</div>
          <div style={{ fontSize: '0.875rem' }}>
            Bulk operations cannot be undone. Please verify all parameters before executing.
          </div>
        </div>
      </div>

      {/* Operation Form */}
      <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Create Bulk Operation</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Operation Type
            </label>
            <select
              value={operationType}
              onChange={(e) => setOperationType(e.target.value as any)}
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
              <option value="update">Update Organizations</option>
              <option value="suspend">Suspend Organizations</option>
              <option value="delete">Delete Organizations</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Target Organizations (comma-separated IDs)
            </label>
            <input
              type="text"
              placeholder="org-1, org-2, org-3"
              value={targetOrgs.join(', ')}
              onChange={(e) => setTargetOrgs(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
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

          {operationType === 'update' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                Update Parameters (JSON)
              </label>
              <textarea
                value={JSON.stringify(parameters, null, 2)}
                onChange={(e) => {
                  try {
                    setParameters(JSON.parse(e.target.value));
                  } catch (err) {
                    // Invalid JSON, ignore
                  }
                }}
                rows={6}
                style={{
                  width: '100%',
                  padding: '0.625rem 1rem',
                  backgroundColor: '#0a0a0a',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontSize: '0.875rem',
                  fontFamily: 'monospace'
                }}
                placeholder='{"plan": "pro", "status": "active"}'
              />
            </div>
          )}

          <button
            onClick={handleBulkOperation}
            disabled={loading || !targetOrgs.length}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: loading || !targetOrgs.length ? '#4b5563' : operationType === 'delete' ? '#7f1d1d' : primaryColor,
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: loading || !targetOrgs.length ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Processing...' : `Execute ${operationType.charAt(0).toUpperCase() + operationType.slice(1)} Operation`}
          </button>
        </div>
      </div>

      {/* Operation History */}
      <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Operation History</h2>
        {operations.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
            No operations yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {operations.map((op) => (
              <div
                key={op.id}
                style={{
                  padding: '1rem',
                  backgroundColor: '#0a0a0a',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                      {op.type.toUpperCase()} - {op.resourceType}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#666' }}>
                      {op.organizationIds?.length || 0} organizations • Created: {new Date(op.createdAt as any).toLocaleString()}
                    </div>
                  </div>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    backgroundColor: op.status === 'completed' ? '#065f46' : op.status === 'processing' ? '#78350f' : '#7f1d1d',
                    color: op.status === 'completed' ? '#10b981' : op.status === 'processing' ? '#f59e0b' : '#ef4444',
                    textTransform: 'uppercase'
                  }}>
                    {op.status}
                  </span>
                </div>
                {op.status === 'processing' && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>
                      Progress: {op.processedItems}/{op.totalItems}
                    </div>
                    <div style={{
                      width: '100%',
                      height: '4px',
                      backgroundColor: '#0a0a0a',
                      borderRadius: '2px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${(op.processedItems / op.totalItems) * 100}%`,
                        height: '100%',
                        backgroundColor: primaryColor,
                        transition: 'width 0.3s'
                      }} />
                    </div>
                  </div>
                )}
                {op.status === 'completed' && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
                    Success: {op.successCount} • Errors: {op.errorCount}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}




















