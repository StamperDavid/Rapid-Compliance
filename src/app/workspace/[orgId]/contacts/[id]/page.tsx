'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service'
import { logger } from '@/lib/logger/logger';;

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const contactId = params.id as string;
  const [contact, setContact] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContact();
  }, []);

  const loadContact = async () => {
    try {
      const data = await FirestoreService.get(`organizations/${orgId}/workspaces/default/entities/contacts/records`, contactId);
      setContact(data);
    } catch (error: unknown) {
      logger.error('Error loading contact:', error instanceof Error ? error : undefined, { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !contact) {return <div className="p-8">Loading...</div>;}

  return (
    <div className="p-8">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-blue-400 hover:text-blue-300 mb-4">← Back to Contacts</button>
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-3xl font-bold">{((contact.name !== '' && contact.name != null) ? contact.name : ((contact.firstName !== '' && contact.firstName != null) ? contact.firstName : 'U')).charAt(0).toUpperCase()}</div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{(contact.name !== '' && contact.name != null) ? contact.name : `${contact.firstName} ${contact.lastName}`}</h1>
            {contact.title && <p className="text-lg text-gray-400 mb-1">{contact.title}</p>}
            {contact.company && <p className="text-gray-400">{contact.company}</p>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Contact Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><div className="text-sm text-gray-400 mb-1">Email</div><div>{(contact.email !== '' && contact.email != null) ? contact.email : '-'}</div></div>
              <div><div className="text-sm text-gray-400 mb-1">Phone</div><div>{(contact.phone !== '' && contact.phone != null) ? contact.phone : ((contact.phoneNumber !== '' && contact.phoneNumber != null) ? contact.phoneNumber : '-')}</div></div>
              <div><div className="text-sm text-gray-400 mb-1">Mobile</div><div>{(contact.mobile !== '' && contact.mobile != null) ? contact.mobile : '-'}</div></div>
              <div><div className="text-sm text-gray-400 mb-1">LinkedIn</div><div>{contact.linkedIn ? <a href={contact.linkedIn} className="text-blue-400 hover:text-blue-300">View Profile</a> : '-'}</div></div>
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Activity Timeline</h2>
            <div className="space-y-3">
              {contact.lastActivity ? (
                <div className="bg-gray-800 rounded p-3"><div className="text-sm text-gray-400">Last Activity: {new Date(contact.lastActivity).toLocaleString()}</div></div>
              ) : (
                <div className="text-gray-400 text-sm">No recent activity</div>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Actions</h2>
            <div className="space-y-2">
              <button 
                onClick={() => {
                  const subject = `Getting in touch`;
                  window.location.href = `mailto:${contact.email}?subject=${encodeURIComponent(subject)}`;
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-left"
              >
                ✉️ Send Email
              </button>
              <button 
                onClick={() => router.push(`/workspace/${orgId}/calls/make?phone=${encodeURIComponent((contact.phone !== '' && contact.phone != null) ? contact.phone : contact.phoneNumber)}&contactId=${contactId}`)}
                className="w-full px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 text-left"
              >
                📞 Make Call
              </button>
              <button 
                onClick={() => router.push(`/workspace/${orgId}/contacts/${contactId}/edit`)}
                className="w-full px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 text-left"
              >
                ✏️ Edit Contact
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

