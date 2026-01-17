'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { Timestamp } from 'firebase/firestore'
import { logger } from '@/lib/logger/logger';
import ActivityTimeline from '@/components/ActivityTimeline';
import type { PredictiveScore } from '@/lib/crm/predictive-scoring';
import type { DataQualityScore } from '@/lib/crm/data-quality';

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const leadId = params.id as string;
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [predictiveScore, setPredictiveScore] = useState<PredictiveScore | null>(null);
  const [dataQuality, setDataQuality] = useState<DataQualityScore | null>(null);
  const [loadingIntelligence, setLoadingIntelligence] = useState(false);

  useEffect(() => {
    loadLead();
  }, []);

  const loadLead = async () => {
    try {
      const data = await FirestoreService.get(`organizations/${orgId}/workspaces/default/entities/leads/records`, leadId);
      setLead(data);
      
      // Load intelligence features
      loadIntelligence(data);
    } catch (error: unknown) {
      logger.error('Error loading lead:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  };

  const loadIntelligence = async (leadData: any) => {
    setLoadingIntelligence(true);
    try {
      // Calculate predictive score
      const { calculatePredictiveLeadScore } = await import('@/lib/crm/predictive-scoring');
      const score = await calculatePredictiveLeadScore(orgId, 'default', leadData);
      setPredictiveScore(score);

      // Calculate data quality
      const { calculateLeadDataQuality } = await import('@/lib/crm/data-quality');
      const quality = calculateLeadDataQuality(leadData);
      setDataQuality(quality);
    } catch (error: unknown) {
      logger.error('Error loading intelligence:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoadingIntelligence(false);
    }
  };

  if (loading || !lead) {return <div className="p-8">Loading...</div>;}

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-blue-400 hover:text-blue-300 mb-4">← Back to Leads</button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{(lead.name !== '' && lead.name != null) ? lead.name : `${lead.firstName} ${lead.lastName}`}</h1>
            <p className="text-gray-400">{(lead.company !== '' && lead.company != null) ? lead.company : lead.companyName}</p>
          </div>
          <div className="flex items-center gap-3">
            {predictiveScore && (
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                  predictiveScore.tier === 'hot' ? 'bg-red-600 text-white' :
                  predictiveScore.tier === 'warm' ? 'bg-orange-500 text-white' :
                  'bg-blue-500 text-white'
                }`}>
                  {predictiveScore.tier.toUpperCase()}
                </span>
                <span className="text-gray-400 text-sm">{predictiveScore.score}/100</span>
              </div>
            )}
            {dataQuality && (
              <span className={`px-3 py-1 rounded text-sm font-medium ${
                dataQuality.overall >= 80 ? 'bg-green-900 text-green-300' : 
                dataQuality.overall >= 60 ? 'bg-yellow-900 text-yellow-300' : 
                'bg-red-900 text-red-300'
              }`}>
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
            <div className={`rounded-lg border-2 p-4 ${
              predictiveScore.tier === 'hot' ? 'bg-red-900/20 border-red-600' :
              predictiveScore.tier === 'warm' ? 'bg-orange-900/20 border-orange-600' :
              'bg-blue-900/20 border-blue-600'
            }`}>
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
            <div className="bg-yellow-900/20 border-2 border-yellow-600 rounded-lg p-4">
              <h3 className="font-bold mb-3">⚠️ Data Quality Issues</h3>
              <div className="space-y-2">
                {dataQuality.issues.slice(0, 3).map((issue, idx) => (
                  <div key={idx} className="text-sm">
                    <span className="font-medium">{issue.field}:</span> {issue.issue}
                  </div>
                ))}
              </div>
              {dataQuality.suggestions.length > 0 && (
                <button className="mt-3 text-sm text-yellow-300 hover:text-yellow-200">
                  View {dataQuality.suggestions.length} suggestions →
                </button>
              )}
            </div>
          )}

          {/* Contact Information */}
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><div className="text-sm text-gray-400 mb-1">Email</div><div>{(lead.email !== '' && lead.email != null) ? lead.email : '-'}</div></div>
              <div><div className="text-sm text-gray-400 mb-1">Phone</div><div>{(lead.phone !== '' && lead.phone != null) ? lead.phone : ((lead.phoneNumber !== '' && lead.phoneNumber != null) ? lead.phoneNumber : '-')}</div></div>
              <div><div className="text-sm text-gray-400 mb-1">Company</div><div>{(lead.company !== '' && lead.company != null) ? lead.company : ((lead.companyName !== '' && lead.companyName != null) ? lead.companyName : '-')}</div></div>
              <div><div className="text-sm text-gray-400 mb-1">Title</div><div>{(lead.title !== '' && lead.title != null) ? lead.title : '-'}</div></div>
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
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Additional Details</h2>
            <div className="space-y-2 text-sm">
              <div><span className="text-gray-400">Source:</span> {(lead.source !== '' && lead.source != null) ? lead.source : 'Unknown'}</div>
              <div><span className="text-gray-400">Created:</span> {lead.createdAt ? new Date(lead.createdAt.toDate ? lead.createdAt.toDate() : lead.createdAt).toLocaleDateString() : '-'}</div>
              {lead.enrichmentData && (
                <div className="mt-4">
                  <div className="text-gray-400 mb-2">Enrichment Data:</div>
                  <div className="bg-gray-800 rounded p-3 space-y-1">
                    {lead.enrichmentData.companySize && <div>Company Size: {lead.enrichmentData.companySize} employees</div>}
                    {lead.enrichmentData.revenue && <div>Revenue: ${(lead.enrichmentData.revenue / 1000000).toFixed(1)}M</div>}
                    {lead.enrichmentData.industry && <div>Industry: {lead.enrichmentData.industry}</div>}
                  </div>
                </div>
              )}
              {lead.notes && <div className="mt-4"><div className="text-gray-400 mb-2">Notes:</div><div className="bg-gray-800 rounded p-3">{lead.notes}</div></div>}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Predictive Score Breakdown */}
          {predictiveScore && (
            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Lead Score Breakdown</h2>
              <div className="space-y-3">
                {predictiveScore.factors.map((factor, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">{factor.name}</span>
                      <span className={
                        factor.impact === 'positive' ? 'text-green-400' :
                        factor.impact === 'negative' ? 'text-red-400' :
                        'text-gray-400'
                      }>{factor.value}/100</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          factor.impact === 'positive' ? 'bg-green-600' :
                          factor.impact === 'negative' ? 'bg-red-600' :
                          'bg-gray-600'
                        }`}
                        style={{ width: `${factor.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button 
                onClick={() => {
                  const subject = `Following up - ${(lead.company !== '' && lead.company != null) ? lead.company : lead.companyName}`;
                  const body = `Hi ${(lead.firstName !== '' && lead.firstName != null) ? lead.firstName : lead.name?.split(' ')[0]},\n\n`;
                  window.location.href = `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-left"
              >
                ✉️ Send Email
              </button>
              <button 
                onClick={() => router.push(`/workspace/${orgId}/calls/make?phone=${encodeURIComponent((lead.phone !== '' && lead.phone != null) ? lead.phone : lead.phoneNumber)}&contactId=${leadId}`)}
                className="w-full px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 text-left"
              >
                📞 Make Call
              </button>
              <button 
                onClick={() => router.push(`/workspace/${orgId}/outbound/sequences?enrollLead=${leadId}`)}
                className="w-full px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 text-left"
              >
                ➕ Add to Sequence
              </button>
              <button 
                onClick={async () => {
                  if (!confirm('Convert this lead to a deal?')) {return;}
                  try {
                    const dealId = `deal-${Date.now()}`;
                    await FirestoreService.set(
                      `organizations/${orgId}/workspaces/default/entities/deals/records`,
                      dealId,
                      {
                        id: dealId,
                        name: `Deal - ${(lead.company !== '' && lead.company != null) ? lead.company : lead.companyName}`,
                        company: (lead.company !== '' && lead.company != null) ? lead.company : lead.companyName,
                        contactName: (lead.name !== '' && lead.name != null) ? lead.name : `${lead.firstName} ${lead.lastName}`,
                        value: 0,
                        stage: 'qualification',
                        probability: 50,
                        sourceLeadId: leadId,
                        createdAt: Timestamp.now(),
                      },
                      false
                    );
                    alert('Lead converted to deal!');
                    router.push(`/workspace/${orgId}/deals/${dealId}`);
                  } catch (error: unknown) {
                    logger.error('Error converting lead:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
                    alert('Failed to convert lead');
                  }
                }}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-left font-medium"
              >
                🔄 Convert to Deal
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

