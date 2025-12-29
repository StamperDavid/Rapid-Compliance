'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { logger } from '@/lib/logger/logger';
import DuplicateWarning from '@/components/DuplicateWarning';
import type { DuplicateDetectionResult } from '@/lib/crm/duplicate-detection';
import type { DataQualityScore } from '@/lib/crm/data-quality';

export default function NewLeadPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const [lead, setLead] = useState({ firstName: '', lastName: '', email: '', phone: '', company: '', title: '', source: '', status: 'new' as const });
  const [saving, setSaving] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateDetectionResult | null>(null);
  const [dataQuality, setDataQuality] = useState<DataQualityScore | null>(null);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  // Check for duplicates when email or phone changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (lead.email || lead.phone) {
        checkDuplicates();
      }
    }, 1000); // Debounce 1 second

    return () => clearTimeout(timer);
  }, [lead.email, lead.phone, lead.firstName, lead.lastName, lead.company]);

  // Calculate data quality in real-time
  useEffect(() => {
    if (lead.firstName || lead.email) {
      calculateQuality();
    }
  }, [lead]);

  const checkDuplicates = async () => {
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
      const data = await response.json();
      if (data.success) {
        setDuplicateResult(data.data);
      }
    } catch (error) {
      logger.error('Error checking duplicates:', error, { file: 'page.tsx' });
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const calculateQuality = async () => {
    try {
      const { calculateLeadDataQuality } = await import('@/lib/crm/data-quality');
      const quality = calculateLeadDataQuality(lead);
      setDataQuality(quality);
    } catch (error) {
      logger.error('Error calculating quality:', error, { file: 'page.tsx' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Warn about high-confidence duplicates
    if (duplicateResult?.hasDuplicates && duplicateResult.highestMatch && duplicateResult.highestMatch.confidence === 'high') {
      const proceed = confirm('High-confidence duplicate detected. Are you sure you want to create this lead?');
      if (!proceed) return;
    }

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
      
      router.push(`/workspace/${orgId}/leads`);
    } catch (error) {
      logger.error('Error creating lead:', error, { file: 'page.tsx' });
      alert('Failed to create lead');
    } finally {
      setSaving(false);
    }
  };

  const handleMerge = async (keepId: string, mergeId: string) => {
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
        router.push(`/workspace/${orgId}/leads/${mergeId}`);
      }
    } catch (error) {
      logger.error('Error merging:', error, { file: 'page.tsx' });
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Add New Lead</h1>

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

        <form onSubmit={handleSubmit}>
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
                        setLead({...lead, phone: suggestion.suggestedValue});
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
