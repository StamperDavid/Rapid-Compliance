'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase/firestore'
import { logger } from '@/lib/logger/logger';
import ActivityTimeline from '@/components/ActivityTimeline';
import type { PredictiveScore } from '@/lib/crm/predictive-scoring';
import type { DataQualityScore } from '@/lib/crm/data-quality';
import type { Lead } from '@/lib/crm/lead-service';

/**
 * Extended Lead interface with legacy fields for backward compatibility
 */
interface ExtendedLead extends Lead {
  phoneNumber?: string; // Legacy field - use `phone` instead
  notes?: string;
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;
  const [lead, setLead] = useState<ExtendedLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [predictiveScore, setPredictiveScore] = useState<PredictiveScore | null>(null);
  const [dataQuality, setDataQuality] = useState<DataQualityScore | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const loadLead = useCallback(async (): Promise<void> => {
    try {
      const data = await FirestoreService.get(`${getSubCollection('workspaces')}/default/entities/leads/records`, leadId);

      // Type guard for lead data
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid lead data received');
      }

      const leadData = data as ExtendedLead;
      setLead(leadData);

      // Load intelligence features
      void loadIntelligence(leadData);
    } catch (error: unknown) {
      logger.error('Error loading lead:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void loadLead();
  }, [loadLead]);

  const loadIntelligence = async (leadData: ExtendedLead): Promise<void> => {
    try {
      // Calculate predictive score - use only Lead fields
      const { calculatePredictiveLeadScore } = await import('@/lib/crm/predictive-scoring');
      const leadForScoring: Lead = {
        id: leadData.id,
        workspaceId: leadData.workspaceId,
        firstName: leadData.firstName,
        lastName: leadData.lastName,
        email: leadData.email,
        phone: leadData.phone,
        company: leadData.company,
        companyName: leadData.companyName,
        title: leadData.title,
        source: leadData.source,
        status: leadData.status,
        score: leadData.score,
        ownerId: leadData.ownerId,
        tags: leadData.tags,
        customFields: leadData.customFields,
        enrichmentData: leadData.enrichmentData,
        createdAt: leadData.createdAt,
        updatedAt: leadData.updatedAt,
        name: leadData.name
      };
      const score = await calculatePredictiveLeadScore('default', leadForScoring);
      setPredictiveScore(score);

      // Calculate data quality
      const { calculateLeadDataQuality } = await import('@/lib/crm/data-quality');
      const quality = calculateLeadDataQuality(leadForScoring);
      setDataQuality(quality);
    } catch (error: unknown) {
      logger.error('Error loading intelligence:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    }
  };

  if (loading || !lead) {return <div className="p-8">Loading...</div>;}

  // Helper functions for safe field access
  const getDisplayName = (): string => {
    if (lead.name && lead.name !== '') {
      return lead.name;
    }
    return `${lead.firstName} ${lead.lastName}`;
  };

  const getCompanyName = (): string => {
    if (lead.company && lead.company !== '') {
      return lead.company;
    }
    return lead.companyName ?? '';
  };

  const getPhoneNumber = (): string => {
    if (lead.phone && lead.phone !== '') {
      return lead.phone;
    }
    return lead.phoneNumber ?? '';
  };

  const getEmailValue = (): string => {
    return lead.email ?? '';
  };

  const getTitle = (): string => {
    return lead.title ?? '';
  };

  const getSource = (): string => {
    return lead.source ?? 'Unknown';
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-[var(--color-primary)] hover:opacity-80 mb-4">← Back to Leads</button>

        {/* Notification */}
        {notification && (
          <div style={{
            backgroundColor: notification.type === 'success' ? 'rgba(var(--color-success-rgb), 0.1)' : 'rgba(var(--color-error-rgb), 0.1)',
            color: notification.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
            borderColor: notification.type === 'success' ? 'rgba(var(--color-success-rgb), 0.2)' : 'rgba(var(--color-error-rgb), 0.2)'
          }} className="mb-4 p-3 rounded-lg text-sm border">
            <div className="flex items-center justify-between">
              <span>{notification.message}</span>
              <button onClick={() => setNotification(null)} className="ml-2 text-current opacity-60 hover:opacity-100">&times;</button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{getDisplayName()}</h1>
            <p className="text-[var(--color-text-secondary)]">{getCompanyName() || '-'}</p>
          </div>
          <div className="flex items-center gap-3">
            {predictiveScore && (
              <div className="flex items-center gap-2">
                <span style={{
                  backgroundColor: predictiveScore.tier === 'hot' ? 'var(--color-error)' :
                    predictiveScore.tier === 'warm' ? 'var(--color-warning)' :
                    'var(--color-primary)',
                  color: 'var(--color-text-primary)'
                }} className="px-3 py-1 rounded-lg text-sm font-bold">
                  {predictiveScore.tier.toUpperCase()}
                </span>
                <span className="text-[var(--color-text-secondary)] text-sm">{predictiveScore.score}/100</span>
              </div>
            )}
            {dataQuality && (
              <span style={{
                backgroundColor: dataQuality.overall >= 80 ? 'rgba(var(--color-success-rgb), 0.2)' :
                  dataQuality.overall >= 60 ? 'rgba(var(--color-warning-rgb), 0.2)' :
                  'rgba(var(--color-error-rgb), 0.2)',
                color: dataQuality.overall >= 80 ? 'var(--color-success)' :
                  dataQuality.overall >= 60 ? 'var(--color-warning)' :
                  'var(--color-error)'
              }} className="px-3 py-1 rounded text-sm font-medium">
                Quality: {dataQuality.overall}%
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {/* Predictive Insights & Recommended Actions */}
          {predictiveScore && predictiveScore.recommendedActions.length > 0 && (
            <div style={{
              backgroundColor: predictiveScore.tier === 'hot' ? 'rgba(var(--color-error-rgb), 0.1)' :
                predictiveScore.tier === 'warm' ? 'rgba(var(--color-warning-rgb), 0.1)' :
                'rgba(var(--color-info-rgb), 0.1)',
              borderColor: predictiveScore.tier === 'hot' ? 'var(--color-error)' :
                predictiveScore.tier === 'warm' ? 'var(--color-warning)' :
                'var(--color-info)'
            }} className="rounded-lg border-2 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg">💡 Next Best Actions</h3>
                  <p className="text-sm opacity-90">Conversion Probability: {predictiveScore.conversionProbability}% • Confidence: {predictiveScore.confidence}%</p>
                </div>
              </div>
              <div className="space-y-2">
                {predictiveScore.recommendedActions.map((action, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-lg">{idx === 0 ? '🎯' : '•'}</span>
                    <span className="text-sm">{action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data Quality Issues */}
          {dataQuality && dataQuality.issues.length > 0 && (
            <div style={{ backgroundColor: 'rgba(var(--color-warning-rgb), 0.1)', borderColor: 'var(--color-warning)' }} className="border-2 rounded-lg p-4">
              <h3 className="font-bold mb-3">⚠️ Data Quality Issues</h3>
              <div className="space-y-2">
                {dataQuality.issues.slice(0, 3).map((issue, idx) => (
                  <div key={idx} className="text-sm">
                    <span className="font-medium">{issue.field}:</span> {issue.issue}
                  </div>
                ))}
              </div>
              {dataQuality.suggestions.length > 0 && (
                <button className="mt-3 text-sm text-[var(--color-warning)] hover:opacity-80">
                  View {dataQuality.suggestions.length} suggestions →
                </button>
              )}
            </div>
          )}

          {/* Contact Information */}
          <div className="bg-[var(--color-bg-paper)] rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><div className="text-sm text-[var(--color-text-secondary)] mb-1">Email</div><div>{getEmailValue() || '-'}</div></div>
              <div><div className="text-sm text-[var(--color-text-secondary)] mb-1">Phone</div><div>{getPhoneNumber() || '-'}</div></div>
              <div><div className="text-sm text-[var(--color-text-secondary)] mb-1">Company</div><div>{getCompanyName() || '-'}</div></div>
              <div><div className="text-sm text-[var(--color-text-secondary)] mb-1">Title</div><div>{getTitle() || '-'}</div></div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Activity Timeline</h2>
            <ActivityTimeline
              entityType="lead"
              entityId={leadId}
              workspaceId="default"
              showInsights={true}
              showNextAction={true}
              maxHeight="500px"
            />
          </div>

          {/* Additional Details */}
          <div className="bg-[var(--color-bg-paper)] rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Additional Details</h2>
            <div className="space-y-2 text-sm">
              <div><span className="text-[var(--color-text-secondary)]">Source:</span> {getSource()}</div>
              <div>
                <span className="text-[var(--color-text-secondary)]">Created:</span>{' '}
                {(() => {
                  if (!lead.createdAt) {return '-';}
                  if (lead.createdAt instanceof Date) {
                    return lead.createdAt.toLocaleDateString();
                  }
                  if (typeof lead.createdAt === 'string') {
                    return new Date(lead.createdAt).toLocaleDateString();
                  }
                  if ('toDate' in lead.createdAt && typeof lead.createdAt.toDate === 'function') {
                    return lead.createdAt.toDate().toLocaleDateString();
                  }
                  return '-';
                })()}
              </div>
              {lead.enrichmentData && (
                <div className="mt-4">
                  <div className="text-[var(--color-text-secondary)] mb-2">Enrichment Data:</div>
                  <div className="bg-[var(--color-bg-elevated)] rounded p-3 space-y-1">
                    {lead.enrichmentData.companySize && (
                      <div>Company Size: {
                        typeof lead.enrichmentData.companySize === 'number'
                          ? `${lead.enrichmentData.companySize} employees`
                          : lead.enrichmentData.companySize
                      }</div>
                    )}
                    {lead.enrichmentData.revenue && typeof lead.enrichmentData.revenue === 'string' && (
                      <div>Revenue: {lead.enrichmentData.revenue}</div>
                    )}
                    {lead.enrichmentData.industry && (
                      <div>Industry: {lead.enrichmentData.industry}</div>
                    )}
                  </div>
                </div>
              )}
              {lead.notes && (
                <div className="mt-4">
                  <div className="text-[var(--color-text-secondary)] mb-2">Notes:</div>
                  <div className="bg-[var(--color-bg-elevated)] rounded p-3">{lead.notes}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Predictive Score Breakdown */}
          {predictiveScore && (
            <div className="bg-[var(--color-bg-paper)] rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Lead Score Breakdown</h2>
              <div className="space-y-3">
                {predictiveScore.factors.map((factor, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[var(--color-text-secondary)]">{factor.name}</span>
                      <span style={{
                        color: factor.impact === 'positive' ? 'var(--color-success)' :
                          factor.impact === 'negative' ? 'var(--color-error)' :
                          'var(--color-text-secondary)'
                      }}>{factor.value}/100</span>
                    </div>
                    <div className="w-full bg-[var(--color-bg-elevated)] rounded-full h-2">
                      <div
                        style={{
                          width: `${factor.value}%`,
                          backgroundColor: factor.impact === 'positive' ? 'var(--color-success)' :
                            factor.impact === 'negative' ? 'var(--color-error)' :
                            'var(--color-border-light)'
                        }}
                        className="h-2 rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-[var(--color-bg-paper)] rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button
                onClick={() => {
                  const companyName = getCompanyName();
                  const firstName = lead.firstName ?? lead.name?.split(' ')[0] ?? '';
                  const emailAddress = getEmailValue();

                  if (!emailAddress) {
                    setNotification({ message: 'No email address available for this lead', type: 'error' });
                    return;
                  }

                  const subject = `Following up - ${companyName}`;
                  const body = `Hi ${firstName},\n\n`;
                  window.location.href = `mailto:${emailAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                }}
                className="w-full px-4 py-2 bg-[var(--color-primary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-primary-dark)] text-left"
              >
                ✉️ Send Email
              </button>
              <button
                onClick={() => {
                  const phoneNumber = getPhoneNumber();
                  if (!phoneNumber) {
                    setNotification({ message: 'No phone number available for this lead', type: 'error' });
                    return;
                  }
                  router.push(`/calls/make?phone=${encodeURIComponent(phoneNumber)}&contactId=${leadId}`);
                }}
                className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] rounded-lg hover:bg-[var(--color-border-light)] text-left"
              >
                📞 Make Call
              </button>
              <button
                onClick={() => router.push(`/outbound/sequences?enrollLead=${leadId}`)}
                className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] rounded-lg hover:bg-[var(--color-border-light)] text-left"
              >
                ➕ Add to Sequence
              </button>
              <button
                onClick={() => {
                  setConfirmDialog({
                    message: 'Convert this lead to a deal?',
                    onConfirm: () => {
                      void (async () => {
                        try {
                          const dealId = `deal-${Date.now()}`;
                          const companyName = getCompanyName();
                          const displayName = getDisplayName();

                          await FirestoreService.set(
                            `${getSubCollection('workspaces')}/default/entities/deals/records`,
                            dealId,
                            {
                              id: dealId,
                              name: `Deal - ${companyName}`,
                              company: companyName,
                              contactName: displayName,
                              value: 0,
                              stage: 'qualification',
                              probability: 50,
                              sourceLeadId: leadId,
                              createdAt: Timestamp.now(),
                            },
                            false
                          );
                          setConfirmDialog(null);
                          setNotification({ message: 'Lead converted to deal!', type: 'success' });
                          setTimeout(() => router.push(`/deals/${dealId}`), 1500);
                        } catch (error: unknown) {
                          logger.error('Error converting lead:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
                          setConfirmDialog(null);
                          setNotification({ message: 'Failed to convert lead', type: 'error' });
                        }
                      })();
                    },
                  });
                }}
                className="w-full px-4 py-2 bg-[var(--color-success)] text-[var(--color-text-primary)] rounded-lg hover:opacity-90 text-left font-medium"
              >
                🔄 Convert to Deal
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[var(--color-bg-paper)] rounded-xl p-6 max-w-md mx-4 border border-[var(--color-border-light)] shadow-xl">
            <p className="text-[var(--color-text-primary)] mb-4">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]">Cancel</button>
              <button onClick={confirmDialog.onConfirm} className="px-4 py-2 rounded-lg bg-[var(--color-success)] text-[var(--color-text-primary)] hover:opacity-90">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

