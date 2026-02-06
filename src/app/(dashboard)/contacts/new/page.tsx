'use client';

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { Timestamp } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { showErrorToast } from '@/components/ErrorToast';
import type { NewContactFormData } from '@/types/contact';

export default function NewContactPage() {
  const router = useRouter();
  const [contact, setContact] = useState<NewContactFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    title: '',
    linkedIn: ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const contactId = `contact-${Date.now()}`;
      await FirestoreService.set(`organizations/${DEFAULT_ORG_ID}/workspaces/default/entities/contacts/records`, contactId, { ...contact, id: contactId, createdAt: Timestamp.now() }, false);
      router.push(`/contacts`);
    } catch (error: unknown) {
      logger.error('Error creating contact:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      showErrorToast(error, 'Failed to create contact');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Add New Contact</h1>
        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <div className="bg-gray-900 rounded-lg p-6 mb-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">First Name *</label><input type="text" value={contact.firstName} onChange={(e) => setContact({...contact, firstName: e.target.value})} required className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-2">Last Name *</label><input type="text" value={contact.lastName} onChange={(e) => setContact({...contact, lastName: e.target.value})} required className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-2">Email *</label><input type="email" value={contact.email} onChange={(e) => setContact({...contact, email: e.target.value})} required className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
              <div><label className="block text-sm font-medium mb-2">Phone</label><input type="tel" value={contact.phone} onChange={(e) => setContact({...contact, phone: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">Company</label><input type="text" value={contact.company} onChange={(e) => setContact({...contact, company: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-2">Title</label><input type="text" value={contact.title} onChange={(e) => setContact({...contact, title: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-2">LinkedIn URL</label><input type="url" value={contact.linkedIn} onChange={(e) => setContact({...contact, linkedIn: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="px-6 py-3 bg-gray-800 rounded-lg hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{saving ? 'Creating...' : 'Create Contact'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}




