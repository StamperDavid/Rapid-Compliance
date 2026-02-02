'use client';

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger/logger';
import DuplicateWarning from '@/components/DuplicateWarning';
import { useToast } from '@/hooks/useToast';
import type { DuplicateDetectionResult } from '@/lib/crm/duplicate-detection';
import type { DataQualityScore } from '@/lib/crm/data-quality';

export default function NewLeadPage() {
  const router = useRouter();
  const toast = useToast();
  const orgId = DEFAULT_ORG_ID;
  const [lead, setLead] = useState({ firstName: '', lastName: '', email: '', phone: '', company: '', title: '', source: '', status: 'new' as const });
  const [saving, setSaving] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateDetectionResult | null>(null);
  const [dataQuality, setDataQuality] = useState<DataQualityScore | null>(null);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const checkDuplicates = useCallback(async () => {
    setCheckingDuplicates(true);
    try {
      const response = await fetch('/api/crm/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'lead',
          record: lead,
          workspaceId: 'default',
        }),
      });
      const rawData: unknown = await response.json();
      const data = rawData as { success?: boolean; data?: DuplicateDetectionResult };
      if (data.success && data.data) {
        setDuplicateResult(data.data);
      }
    } catch (error: unknown) {
      logger.error('Error checking duplicates:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setCheckingDuplicates(false);
    }
  }, [lead]);

  const calculateQuality = useCallback(async () => {
    try {
      const { calculateLeadDataQuality } = await import('@/lib/crm/data-quality');
      const quality = calculateLeadDataQuality(lead);
      setDataQuality(quality);
    } catch (error: unknown) {
      logger.error('Error calculating quality:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    }
  }, [lead]);

  // Check for duplicates when email or phone changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (lead.email || lead.phone) {
        void checkDuplicates();
      }
    }, 1000); // Debounce 1 second

    return () => clearTimeout(timer);
  }, [lead.email, lead.phone, lead.firstName, lead.lastName, lead.company, checkDuplicates]);

  // Calculate data quality in real-time
  useEffect(() => {
    if (lead.firstName || lead.email) {
      void calculateQuality();
    }
  }, [lead, calculateQuality]);

  const proceedWithSubmit = useCallback(async () => {
    try {
      setSaving(true);

      const response = await fetch(`/api/workspace/${orgId}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'default',
          leadData: { ...lead, autoEnrich: true }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create lead');
      }

      router.push(`/leads`);
    } catch (error: unknown) {
      logger.error('Error creating lead:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to create lead');
    } finally {
      setSaving(false);
    }
  }, [orgId, lead, router, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Warn about high-confidence duplicates
    if (duplicateResult?.hasDuplicates && duplicateResult.highestMatch?.confidence === 'high') {
      setShowConfirmDialog(true);
      return;
    }

    await proceedWithSubmit();
  };

  const _handleMerge = async (keepId: string, mergeId: string) => {
    try {
      const response = await fetch('/api/crm/duplicates/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'lead',
          keepId: mergeId, // Existing record
          mergeId: keepId, // This is placeholder, we haven't created yet
          workspaceId: 'default',
        }),
      });
      if (response.ok) {
        router.push(`/leads/${mergeId}`);
      }
    } catch (error: unknown) {
      logger.error('Error merging:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Add New Lead</h1>

        {/* Confirmation Dialog */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md">
              <h2 className="text-xl font-bold mb-4">High-Confidence Duplicate Detected</h2>
              <p className="text-gray-400 mb-6">
                A high-confidence duplicate has been detected. Are you sure you want to create this lead?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowConfirmDialog(false);
                    void proceedWithSubmit();
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Anyway
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Data Quality Score */}
        {dataQuality && (
          <div className="mb-4">
            <div className="flex items-center justify-between bg-gray-900 rounded-lg p-4">
              <div>
                <div className="text-sm text-gray-400">Data Quality Score</div>
                <div className="text-2xl font-bold">
                  {dataQuality.overall}%
                </div>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <div className="text-gray-400">Completeness</div>
                  <div className="font-medium">{dataQuality.completeness}%</div>
                </div>
                <div>
                  <div className="text-gray-400">Accuracy</div>
                  <div className="font-medium">{dataQuality.accuracy}%</div>
                </div>
                <div>
                  <div className="text-gray-400">Consistency</div>
                  <div className="font-medium">{dataQuality.consistency}%</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Duplicate Warning */}
        {duplicateResult?.hasDuplicates && duplicateResult.duplicates.length > 0 && (
          <div className="mb-6">
            <DuplicateWarning
              duplicates={duplicateResult.duplicates}
              entityType="lead"
              onIgnore={() => setDuplicateResult(null)}
            />
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="bg-gray-900 rounded-lg p-6 mb-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">First Name *</label>
                  <input 
                    type="text" 
                    value={lead.firstName} 
                    onChange={(e) => setLead({...lead, firstName: e.target.value})} 
                    required 
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none" 
                  />
                  {dataQuality?.suggestions.find(s => s.field === 'firstName') && (
                    <div className="text-xs text-yellow-400 mt-1">
                      💡 {dataQuality.suggestions.find(s => s.field === 'firstName')?.suggestion}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Last Name *</label>
                  <input 
                    type="text" 
                    value={lead.lastName} 
                    onChange={(e) => setLead({...lead, lastName: e.target.value})} 
                    required 
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email *</label>
                <input 
                  type="email" 
                  value={lead.email} 
                  onChange={(e) => setLead({...lead, email: e.target.value})} 
                  required 
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none" 
                />
                {checkingDuplicates && <div className="text-xs text-gray-400 mt-1">Checking for duplicates...</div>}
                {dataQuality?.issues.find(i => i.field === 'email') && (
                  <div className="text-xs text-red-400 mt-1">
                    ⚠️ {dataQuality.issues.find(i => i.field === 'email')?.issue}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Phone</label>
                <input 
                  type="tel" 
                  value={lead.phone} 
                  onChange={(e) => setLead({...lead, phone: e.target.value})} 
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none" 
                />
                {dataQuality?.suggestions.find(s => s.field === 'phone')?.suggestedValue && (
                  <button
                    type="button"
                    onClick={() => {
                      const suggestion = dataQuality.suggestions.find(s => s.field === 'phone');
                      if (suggestion?.suggestedValue) {
                        setLead({...lead, phone: String(suggestion.suggestedValue)});
                      }
                    }}
                    className="text-xs text-blue-400 mt-1 hover:text-blue-300"
                  >
                    💡 Format as: {dataQuality.suggestions.find(s => s.field === 'phone')?.suggestedValue}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Company</label>
                  <input 
                    type="text" 
                    value={lead.company} 
                    onChange={(e) => setLead({...lead, company: e.target.value})} 
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none" 
                  />
                  {lead.company && <div className="text-xs text-gray-400 mt-1">✨ Will auto-enrich company data on save</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Title</label>
                  <input 
                    type="text" 
                    value={lead.title} 
                    onChange={(e) => setLead({...lead, title: e.target.value})} 
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Source</label>
                <input 
                  type="text" 
                  value={lead.source} 
                  onChange={(e) => setLead({...lead, source: e.target.value})} 
                  placeholder="e.g., Website, Referral, LinkedIn" 
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none" 
                />
              </div>
            </div>
          </div>

          {/* Data Quality Issues */}
          {dataQuality && dataQuality.issues.length > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4 mb-4">
              <div className="font-medium mb-2">⚠️ Data Quality Issues:</div>
              <div className="space-y-1 text-sm">
                {dataQuality.issues.map((issue, idx) => (
                  <div key={idx}>
                    • <span className="font-medium">{issue.field}:</span> {issue.issue}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="px-6 py-3 bg-gray-800 rounded-lg hover:bg-gray-700">
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={saving || checkingDuplicates} 
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Creating...' : checkingDuplicates ? 'Checking duplicates...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
