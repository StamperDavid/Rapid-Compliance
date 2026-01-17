'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { Timestamp } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import ActivityTimeline from '@/components/ActivityTimeline';
import type { DealHealthScore } from '@/lib/crm/deal-health';

export default function DealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const dealId = params.id as string;
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [healthScore, setHealthScore] = useState<DealHealthScore | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  useEffect(() => {
    loadDeal();
  }, []);

  const loadDeal = async () => {
    try {
      const data = await FirestoreService.get(`organizations/${orgId}/workspaces/default/entities/deals/records`, dealId);
      setDeal(data);
      loadDealHealth();
    } catch (error: unknown) {
      logger.error('Error loading deal:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  };

  const loadDealHealth = async () => {
    setLoadingHealth(true);
    try {
      const { calculateDealHealth } = await import('@/lib/crm/deal-health');
      const health = await calculateDealHealth(orgId, 'default', dealId);
      setHealthScore(health);
    } catch (error: unknown) {
      logger.error('Error loading deal health:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoadingHealth(false);
    }
  };

  if (loading || !deal) {return <div className="p-8">Loading...</div>;}

  const healthColor = healthScore?.status === 'healthy' ? 'bg-green-900/20 border-green-600' :
                      healthScore?.status === 'at-risk' ? 'bg-yellow-900/20 border-yellow-600' :
                      'bg-red-900/20 border-red-600';

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-blue-400 hover:text-blue-300 mb-4">← Back to Deals</button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{deal.name}</h1>
            <p className="text-gray-400">{(deal.company !== '' && deal.company != null) ? deal.company : deal.companyName}</p>
          </div>
          <div className="text-right flex items-start gap-4">
            {healthScore && (
              <div className={`px-4 py-2 rounded-lg border-2 ${healthColor}`}>
                <div className="text-sm font-medium uppercase mb-1">
                  {healthScore.status === 'healthy' ? '✅ Healthy' :
                   healthScore.status === 'at-risk' ? '⚠️ At Risk' :
                   '🚨 Critical'}
                </div>
                <div className="text-2xl font-bold">{healthScore.overall}/100</div>
              </div>
            )}
            <div>
              <div className="text-3xl font-bold text-green-400">${(deal.value ?? 0).toLocaleString()}</div>
              <div className="text-sm text-gray-400">{deal.probability ?? 0}% probability</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {/* Deal Health Warnings & Recommendations */}
          {healthScore && (healthScore.warnings.length > 0 || healthScore.recommendations.length > 0) && (
            <div className={`rounded-lg border-2 p-4 ${healthColor}`}>
              <h3 className="font-bold text-lg mb-3">
                {healthScore.status === 'critical' ? '🚨 Critical Issues' :
                 healthScore.status === 'at-risk' ? '⚠️ Attention Needed' :
                 '✅ Deal on Track'}
              </h3>
              
              {healthScore.warnings.length > 0 && (
                <div className="mb-3">
                  <div className="text-sm font-medium mb-2">Warnings:</div>
                  <div className="space-y-1">
                    {healthScore.warnings.map((warning, idx) => (
                      <div key={idx} className="text-sm flex items-start gap-2">
                        <span>•</span>
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {healthScore.recommendations.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Recommended Actions:</div>
                  <div className="space-y-1">
                    {healthScore.recommendations.map((rec, idx) => (
                      <div key={idx} className="text-sm flex items-start gap-2">
                        <span>💡</span>
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Deal Information */}
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Deal Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-400 mb-1">Stage</div>
                <div className="capitalize font-medium">{(deal.stage?.replace('_', ' ') !== '' && deal.stage?.replace('_', ' ') != null) ? deal.stage.replace('_', ' ') : 'Unknown'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Expected Close</div>
                <div>{deal.expectedCloseDate ? new Date(deal.expectedCloseDate.toDate ? deal.expectedCloseDate.toDate() : deal.expectedCloseDate).toLocaleDateString() : '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Source</div>
                <div>{(deal.source !== '' && deal.source != null) ? deal.source : '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Owner</div>
                <div>{(deal.owner !== '' && deal.owner != null) ? deal.owner : ((deal.ownerId !== '' && deal.ownerId != null) ? deal.ownerId : '-')}</div>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Activity Timeline</h2>
            <ActivityTimeline
              entityType="deal"
              entityId={dealId}
              workspaceId="default"
              showInsights={true}
              showNextAction={true}
              maxHeight="500px"
            />
          </div>

          {/* Notes */}
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Notes</h2>
            <div className="bg-gray-800 rounded p-4 text-gray-300">{(deal.notes !== '' && deal.notes != null) ? deal.notes : 'No notes yet.'}</div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Health Score Breakdown */}
          {healthScore && (
            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Health Score Breakdown</h2>
              <div className="space-y-3">
                {healthScore.factors.map((factor, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">{factor.name}</span>
                      <span className={
                        factor.impact === 'positive' ? 'text-green-400' :
                        factor.impact === 'negative' ? 'text-red-400' :
                        'text-gray-400'
                      }>{factor.score}/100</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          factor.impact === 'positive' ? 'bg-green-600' :
                          factor.impact === 'negative' ? 'bg-red-600' :
                          'bg-gray-600'
                        }`}
                        style={{ width: `${factor.score}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{factor.description}</div>
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
                onClick={() => router.push(`/workspace/${orgId}/deals/${dealId}/edit`)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-left"
              >
                ✏️ Edit Deal
              </button>
              <button 
                onClick={() => {
                  const subject = `Regarding: ${deal.name}`;
                  window.location.href = `mailto:${deal.contactEmail ?? ''}?subject=${encodeURIComponent(subject)}`;
                }}
                className="w-full px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 text-left"
              >
                ✉️ Send Email
              </button>
              <button 
                onClick={() => router.push(`/workspace/${orgId}/outbound/meetings/schedule?dealId=${dealId}`)}
                className="w-full px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 text-left"
              >
                📅 Schedule Meeting
              </button>
              <button 
                onClick={async () => {
                  if (!confirm('Mark this deal as won?')) {return;}
                  try {
                    await FirestoreService.update(
                      `organizations/${orgId}/workspaces/default/entities/deals/records`,
                      dealId,
                      { stage: 'closed_won', closedAt: Timestamp.now(), actualCloseDate: Timestamp.now(), status: 'won' }
                    );
                    await loadDeal();
                    alert('Deal marked as won! 🎉');
                  } catch (error: unknown) {
                    logger.error('Error updating deal:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
                    alert('Failed to update deal');
                  }
                }}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-left font-medium"
              >
                ✅ Mark Won
              </button>
              <button 
                onClick={async () => {
                  const reason = prompt('Reason for loss:');
                  if (!reason) {return;}
                  try {
                    await FirestoreService.update(
                      `organizations/${orgId}/workspaces/default/entities/deals/records`,
                      dealId,
                      { stage: 'closed_lost', closedAt: Timestamp.now(), actualCloseDate: Timestamp.now(), status: 'lost', lostReason: reason }
                    );
                    await loadDeal();
                    alert('Deal marked as lost');
                  } catch (error: unknown) {
                    logger.error('Error updating deal:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
                    alert('Failed to update deal');
                  }
                }}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-left"
              >
                ❌ Mark Lost
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
