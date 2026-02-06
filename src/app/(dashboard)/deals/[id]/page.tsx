'use client';

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { Timestamp } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import ActivityTimeline from '@/components/ActivityTimeline';
import type { DealHealthScore } from '@/lib/crm/deal-health';
import type { Deal, FirestoreDate } from '@/types/crm-entities';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert FirestoreDate to JavaScript Date
 */
function convertToDate(firestoreDate: FirestoreDate): Date | null {
  if (!firestoreDate) {
    return null;
  }
  if (firestoreDate instanceof Date) {
    return firestoreDate;
  }
  if (typeof firestoreDate === 'string') {
    return new Date(firestoreDate);
  }
  if ('toDate' in firestoreDate && typeof firestoreDate.toDate === 'function') {
    return firestoreDate.toDate();
  }
  return null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function DealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const dealId = params.id as string;
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthScore, setHealthScore] = useState<DealHealthScore | null>(null);
  const [_loadingHealth, setLoadingHealth] = useState(false);

  // State for inline modals
  const [showLostModal, setShowLostModal] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [showWonConfirm, setShowWonConfirm] = useState(false);

  const loadDealHealth = useCallback(async () => {
    setLoadingHealth(true);
    try {
      const { calculateDealHealth } = await import('@/lib/crm/deal-health');
      const health = await calculateDealHealth(DEFAULT_ORG_ID, 'default', dealId);
      setHealthScore(health);
    } catch (error: unknown) {
      logger.error('Error loading deal health:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoadingHealth(false);
    }
  }, [dealId]);

  const loadDeal = useCallback(async () => {
    try {
      const data = await FirestoreService.get<Deal>(`organizations/${DEFAULT_ORG_ID}/workspaces/default/entities/deals/records`, dealId);
      setDeal(data);
      void loadDealHealth();
    } catch (error: unknown) {
      logger.error('Error loading deal:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [dealId, loadDealHealth]);

  useEffect(() => {
    void loadDeal();
  }, [loadDeal]);

  const handleMarkWon = useCallback(async () => {
    try {
      await FirestoreService.update(
        `organizations/${DEFAULT_ORG_ID}/workspaces/default/entities/deals/records`,
        dealId,
        { stage: 'closed_won', closedAt: Timestamp.now(), actualCloseDate: Timestamp.now(), status: 'won' }
      );
      await loadDeal();
      toast.success('Deal marked as won!');
      setShowWonConfirm(false);
    } catch (error: unknown) {
      logger.error('Error updating deal:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to update deal');
    }
  }, [dealId, loadDeal, toast]);

  const handleMarkLost = useCallback(async () => {
    if (!lostReason.trim()) {
      toast.warning('Please provide a reason for loss');
      return;
    }
    try {
      await FirestoreService.update(
        `organizations/${DEFAULT_ORG_ID}/workspaces/default/entities/deals/records`,
        dealId,
        { stage: 'closed_lost', closedAt: Timestamp.now(), actualCloseDate: Timestamp.now(), status: 'lost', lostReason }
      );
      await loadDeal();
      toast.success('Deal marked as lost');
      setShowLostModal(false);
      setLostReason('');
    } catch (error: unknown) {
      logger.error('Error updating deal:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to update deal');
    }
  }, [dealId, lostReason, loadDeal, toast]);

  if (loading || !deal) {
    return <div className="p-8">Loading...</div>;
  }

  const healthColor = healthScore?.status === 'healthy' ? 'bg-green-900/20 border-green-600' :
                      healthScore?.status === 'at-risk' ? 'bg-yellow-900/20 border-yellow-600' :
                      'bg-red-900/20 border-red-600';

  // Safely get display values
  const displayName = deal.name ?? 'Untitled Deal';
  const displayCompany = deal.company ?? deal.companyName ?? '';
  const displayValue = deal.value ?? 0;
  const displayProbability = deal.probability ?? 0;
  const displayStage = deal.stage?.replace('_', ' ') ?? 'Unknown';
  const displaySource = deal.source ?? '-';
  const displayOwner = deal.ownerId ?? '-';
  const displayNotes = deal.notes ?? 'No notes yet.';
  const displayContactEmail = (deal as Deal & { contactEmail?: string }).contactEmail ?? '';

  const expectedCloseDate = convertToDate(deal.expectedCloseDate);
  const displayExpectedClose = expectedCloseDate ? expectedCloseDate.toLocaleDateString() : '-';

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-blue-400 hover:text-blue-300 mb-4">&larr; Back to Deals</button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{displayName}</h1>
            <p className="text-gray-400">{displayCompany}</p>
          </div>
          <div className="text-right flex items-start gap-4">
            {healthScore && (
              <div className={`px-4 py-2 rounded-lg border-2 ${healthColor}`}>
                <div className="text-sm font-medium uppercase mb-1">
                  {healthScore.status === 'healthy' ? 'Healthy' :
                   healthScore.status === 'at-risk' ? 'At Risk' :
                   'Critical'}
                </div>
                <div className="text-2xl font-bold">{healthScore.overall}/100</div>
              </div>
            )}
            <div>
              <div className="text-3xl font-bold text-green-400">${displayValue.toLocaleString()}</div>
              <div className="text-sm text-gray-400">{displayProbability}% probability</div>
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
                {healthScore.status === 'critical' ? 'Critical Issues' :
                 healthScore.status === 'at-risk' ? 'Attention Needed' :
                 'Deal on Track'}
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
                        <span>*</span>
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
                <div className="capitalize font-medium">{displayStage}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Expected Close</div>
                <div>{displayExpectedClose}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Source</div>
                <div>{displaySource}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Owner</div>
                <div>{displayOwner}</div>
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
            <div className="bg-gray-800 rounded p-4 text-gray-300">{displayNotes}</div>
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
                onClick={() => router.push(`/deals/${dealId}/edit`)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-left"
              >
                Edit Deal
              </button>
              <button
                onClick={() => {
                  const subject = `Regarding: ${displayName}`;
                  window.location.href = `mailto:${displayContactEmail}?subject=${encodeURIComponent(subject)}`;
                }}
                className="w-full px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 text-left"
              >
                Send Email
              </button>
              <button
                onClick={() => router.push(`/outbound/meetings/schedule?dealId=${dealId}`)}
                className="w-full px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 text-left"
              >
                Schedule Meeting
              </button>
              <button
                onClick={() => setShowWonConfirm(true)}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-left font-medium"
              >
                Mark Won
              </button>
              <button
                onClick={() => setShowLostModal(true)}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-left"
              >
                Mark Lost
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Won Confirmation Modal */}
      {showWonConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Mark Deal as Won?</h3>
            <p className="text-gray-400 mb-6">Are you sure you want to mark this deal as won?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowWonConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleMarkWon()}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Yes, Mark Won
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lost Reason Modal */}
      {showLostModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Mark Deal as Lost</h3>
            <label className="block text-sm text-gray-400 mb-2">Reason for loss:</label>
            <input
              type="text"
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="Enter reason..."
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowLostModal(false);
                  setLostReason('');
                }}
                className="flex-1 px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleMarkLost()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Mark Lost
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
