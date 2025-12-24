'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { Timestamp } from 'firebase/firestore'
import { logger } from '@/lib/logger/logger';;

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const leadId = params.id as string;
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLead();
  }, []);

  const loadLead = async () => {
    try {
      const data = await FirestoreService.get(`organizations/${orgId}/workspaces/default/entities/leads/records`, leadId);
      setLead(data);
    } catch (error) {
      logger.error('Error loading lead:', error, { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !lead) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-blue-400 hover:text-blue-300 mb-4">← Back to Leads</button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{lead.name || `${lead.firstName} ${lead.lastName}`}</h1>
            <p className="text-gray-400">{lead.company || lead.companyName}</p>
          </div>
          <span className={`px-3 py-1 rounded text-sm font-medium ${(lead.score || 0) >= 80 ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>Score: {lead.score || 50}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><div className="text-sm text-gray-400 mb-1">Email</div><div>{lead.email || '-'}</div></div>
              <div><div className="text-sm text-gray-400 mb-1">Phone</div><div>{lead.phone || lead.phoneNumber || '-'}</div></div>
              <div><div className="text-sm text-gray-400 mb-1">Company</div><div>{lead.company || lead.companyName || '-'}</div></div>
              <div><div className="text-sm text-gray-400 mb-1">Title</div><div>{lead.title || '-'}</div></div>
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Additional Details</h2>
            <div className="space-y-2 text-sm">
              <div><span className="text-gray-400">Source:</span> {lead.source || 'Unknown'}</div>
              <div><span className="text-gray-400">Created:</span> {lead.createdAt ? new Date(lead.createdAt.toDate ? lead.createdAt.toDate() : lead.createdAt).toLocaleDateString() : '-'}</div>
              {lead.notes && <div className="mt-4"><div className="text-gray-400 mb-2">Notes:</div><div className="bg-gray-800 rounded p-3">{lead.notes}</div></div>}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button 
                onClick={() => {
                  const subject = `Following up - ${lead.company || lead.companyName}`;
                  const body = `Hi ${lead.firstName || lead.name?.split(' ')[0]},\n\n`;
                  window.location.href = `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-left"
              >
                ✉️ Send Email
              </button>
              <button 
                onClick={() => router.push(`/workspace/${orgId}/calls/make?phone=${encodeURIComponent(lead.phone || lead.phoneNumber)}&contactId=${leadId}`)}
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
                  if (!confirm('Convert this lead to a deal?')) return;
                  try {
                    const dealId = `deal-${Date.now()}`;
                    await FirestoreService.set(
                      `organizations/${orgId}/workspaces/default/entities/deals/records`,
                      dealId,
                      {
                        id: dealId,
                        name: `Deal - ${lead.company || lead.companyName}`,
                        company: lead.company || lead.companyName,
                        contactName: lead.name || `${lead.firstName} ${lead.lastName}`,
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
                  } catch (error) {
                    logger.error('Error converting lead:', error, { file: 'page.tsx' });
                    alert('Failed to convert lead');
                  }
                }}
                className="w-full px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 text-left"
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

