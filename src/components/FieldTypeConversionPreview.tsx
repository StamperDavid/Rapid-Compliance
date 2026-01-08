/**
 * Field Type Conversion Preview Component
 * Shows preview of type conversion and allows user to approve/reject
 */

'use client';

import { useState, useEffect } from 'react';
import type { FieldType } from '@/types/schema';

interface FieldTypeConversionPreviewProps {
  organizationId: string;
  workspaceId: string;
  schemaId: string;
  fieldId: string;
  fieldKey: string;
  fieldLabel: string;
  oldType: FieldType;
  newType: FieldType;
  onApprove?: () => void;
  onCancel?: () => void;
}

interface ConversionPreviewItem {
  recordId: string;
  before: any;
  after: any;
  status: 'success' | 'fail' | 'warning';
  message?: string;
}

export default function FieldTypeConversionPreview({
  organizationId,
  workspaceId,
  schemaId,
  fieldId,
  fieldKey,
  fieldLabel,
  oldType,
  newType,
  onApprove,
  onCancel,
}: FieldTypeConversionPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [isSafe, setIsSafe] = useState(false);
  const [preview, setPreview] = useState<ConversionPreviewItem[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [estimatedSuccess, setEstimatedSuccess] = useState(0);
  const [estimatedFailures, setEstimatedFailures] = useState(0);
  const [successRate, setSuccessRate] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [conversionResult, setConversionResult] = useState<any>(null);

  useEffect(() => {
    loadPreview();
  }, [organizationId, workspaceId, schemaId, fieldId, oldType, newType]);

  const loadPreview = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/schema/${schemaId}/field/${fieldId}/convert-type?organizationId=${organizationId}&workspaceId=${workspaceId}&fieldKey=${fieldKey}&oldType=${oldType}&newType=${newType}`
      );

      if (!response.ok) {
        throw new Error('Failed to load conversion preview');
      }

      const data = await response.json();
      setIsSafe(data.isSafe);
      setPreview(data.preview ?? []);
      setTotalRecords(data.totalRecords);
      setEstimatedSuccess(data.estimatedSuccess);
      setEstimatedFailures(data.estimatedFailures);
      setSuccessRate(data.successRate);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async () => {
    if (!confirm(`Convert ${totalRecords} records from ${oldType} to ${newType}?`)) {
      return;
    }

    try {
      setConverting(true);
      const response = await fetch(
        `/api/schema/${schemaId}/field/${fieldId}/convert-type`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId,
            workspaceId,
            fieldKey,
            oldType,
            newType,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to convert field type');
      }

      const result = await response.json();
      setConversionResult(result);

      if (onApprove) {
        onApprove();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConverting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-semibold">Error</h3>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (conversionResult) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h3 className="text-green-800 font-semibold text-lg mb-4">✓ Conversion Complete</h3>
        <div className="space-y-2 mb-4">
          <div className="text-sm">
            <span className="text-green-600 font-medium">Successful:</span>{' '}
            <span className="text-green-900">{conversionResult.successful} records</span>
          </div>
          <div className="text-sm">
            <span className="text-red-600 font-medium">Failed:</span>{' '}
            <span className="text-red-900">{conversionResult.failed} records</span>
          </div>
        </div>
        {conversionResult.failedRecords && conversionResult.failedRecords.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-red-600 font-medium">
              View Failed Records ({conversionResult.failedRecords.length})
            </summary>
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {conversionResult.failedRecords.map((record: any, idx: number) => (
                <div key={idx} className="text-xs bg-white p-2 rounded border border-red-200">
                  <div><strong>Record:</strong> {record.recordId}</div>
                  <div><strong>Value:</strong> {JSON.stringify(record.oldValue)}</div>
                  <div><strong>Error:</strong> {record.error}</div>
                </div>
              ))}
            </div>
          </details>
        )}
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`border rounded-lg p-4 ${isSafe ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
        <h3 className={`text-lg font-semibold mb-2 ${isSafe ? 'text-green-900' : 'text-yellow-900'}`}>
          {isSafe ? '✓ Safe Conversion' : '⚠️ Complex Conversion'}
        </h3>
        <p className={`text-sm ${isSafe ? 'text-green-700' : 'text-yellow-700'}`}>
          Converting field <strong>"{fieldLabel}"</strong> from <code className="bg-white px-2 py-1 rounded">{oldType}</code> to <code className="bg-white px-2 py-1 rounded">{newType}</code>
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600">Total Records</div>
          <div className="text-2xl font-bold text-gray-900">{totalRecords}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-600">Est. Success</div>
          <div className="text-2xl font-bold text-green-900">{estimatedSuccess}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-sm text-red-600">Est. Failures</div>
          <div className="text-2xl font-bold text-red-900">{estimatedFailures}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-600">Success Rate</div>
          <div className="text-2xl font-bold text-blue-900">{successRate}%</div>
        </div>
      </div>

      {/* Preview Table */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Preview (Sample)</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Before
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  →
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  After
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {preview.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {JSON.stringify(item.before)}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400">→</td>
                  <td className="px-4 py-3">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {JSON.stringify(item.after)}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        item.status === 'success'
                          ? 'bg-green-100 text-green-700'
                          : item.status === 'fail'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {item.status}
                    </span>
                    {item.message && (
                      <div className="text-xs text-gray-500 mt-1">{item.message}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={onCancel}
          disabled={converting}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleConvert}
          disabled={converting}
          className={`px-6 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${
            successRate < 50
              ? 'bg-red-600 hover:bg-red-700'
              : successRate < 80
              ? 'bg-yellow-600 hover:bg-yellow-700'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {converting ? 'Converting...' : `Convert ${totalRecords} Records`}
        </button>
      </div>

      {/* Warning for low success rate */}
      {successRate < 80 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="text-yellow-800 font-semibold mb-2">⚠️ Warning</h4>
          <p className="text-yellow-700 text-sm">
            {successRate < 50
              ? 'Less than 50% of records will convert successfully. This may cause significant data loss.'
              : 'Some records may not convert successfully. Please review the preview carefully.'}
          </p>
        </div>
      )}
    </div>
  );
}



