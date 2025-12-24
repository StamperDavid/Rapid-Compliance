'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { Timestamp } from 'firebase/firestore'
import { logger } from '@/lib/logger/logger';;

export default function DealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const dealId = params.id as string;
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDeal();
  }, []);

  const loadDeal = async () => {
    try {
      const data = await FirestoreService.get(`organizations/${orgId}/workspaces/default/entities/deals/records`, dealId);
      setDeal(data);
    } catch (error) {
      logger.error('Error loading deal:', error, { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !deal) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-blue-400 hover:text-blue-300 mb-4">← Back to Deals</button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{deal.name}</h1>
            <p className="text-gray-400">{deal.company || deal.companyName}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-green-400">${(deal.value || 0).toLocaleString()}</div>
            <div className="text-sm text-gray-400">{deal.probability || 0}% probability</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Deal Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><div className="text-sm text-gray-400 mb-1">Stage</div><div className="capitalize">{deal.stage?.replace('_', ' ') || 'Unknown'}</div></div>
              <div><div className="text-sm text-gray-400 mb-1">Expected Close</div><div>{deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : '-'}</div></div>
              <div><div className="text-sm text-gray-400 mb-1">Source</div><div>{deal.source || '-'}</div></div>
              <div><div className="text-sm text-gray-400 mb-1">Owner</div><div>{deal.owner || '-'}</div></div>
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Notes</h2>
            <div className="bg-gray-800 rounded p-4 text-gray-300">{deal.notes || 'No notes yet.'}</div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Actions</h2>
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
                  window.location.href = `mailto:${deal.contactEmail || ''}?subject=${encodeURIComponent(subject)}`;
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
                  if (!confirm('Mark this deal as won?')) return;
                  try {
                    await FirestoreService.update(
                      `organizations/${orgId}/workspaces/default/entities/deals/records`,
                      dealId,
                      { stage: 'closed_won', closedAt: Timestamp.now(), status: 'won' }
                    );
                    await loadDeal();
                    alert('Deal marked as won!');
                  } catch (error) {
                    logger.error('Error updating deal:', error, { file: 'page.tsx' });
                    alert('Failed to update deal');
                  }
                }}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-left"
              >
                ✅ Mark Won
              </button>
              <button 
                onClick={async () => {
                  const reason = prompt('Reason for loss:');
                  if (!reason) return;
                  try {
                    await FirestoreService.update(
                      `organizations/${orgId}/workspaces/default/entities/deals/records`,
                      dealId,
                      { stage: 'closed_lost', closedAt: Timestamp.now(), status: 'lost', lossReason: reason }
                    );
                    await loadDeal();
                    alert('Deal marked as lost');
                  } catch (error) {
                    logger.error('Error updating deal:', error, { file: 'page.tsx' });
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

