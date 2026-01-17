'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { Timestamp } from 'firebase/firestore'
import { logger } from '@/lib/logger/logger';;

export default function EditContactPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const contactId = params.id as string;
  const [contact, setContact] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadContact();
  }, []);

  const loadContact = async () => {
    try {
      const data = await FirestoreService.get(`organizations/${orgId}/workspaces/default/entities/contacts/records`, contactId);
      setContact(data);
    } catch (error: unknown) {
      logger.error('Error loading contact:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await FirestoreService.update(`organizations/${orgId}/workspaces/default/entities/contacts/records`, contactId, { ...contact, updatedAt: Timestamp.now() });
      router.push(`/workspace/${orgId}/contacts/${contactId}`);
    } catch (error: unknown) {
      logger.error('Error updating contact:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      alert('Failed to update contact');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !contact) {return <div className="p-8">Loading...</div>;}

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Edit Contact</h1>
        <form onSubmit={handleSubmit}>
          <div className="bg-gray-900 rounded-lg p-6 mb-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">First Name</label><input type="text" value={contact.firstName ?? ''} onChange={(e) => setContact({...contact, firstName: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-2">Last Name</label><input type="text" value={contact.lastName ?? ''} onChange={(e) => setContact({...contact, lastName: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-2">Email</label><input type="email" value={contact.email ?? ''} onChange={(e) => setContact({...contact, email: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
              <div><label className="block text-sm font-medium mb-2">Phone</label><input type="tel" value={(contact.phone !== '' && contact.phone != null) ? contact.phone : (contact.phoneNumber ?? '')} onChange={(e) => setContact({...contact, phone: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">Company</label><input type="text" value={contact.company ?? ''} onChange={(e) => setContact({...contact, company: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-2">Title</label><input type="text" value={contact.title ?? ''} onChange={(e) => setContact({...contact, title: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="px-6 py-3 bg-gray-800 rounded-lg hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}




