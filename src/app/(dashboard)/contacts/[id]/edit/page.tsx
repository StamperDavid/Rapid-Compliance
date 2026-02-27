'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getContactsCollection } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { showErrorToast } from '@/components/ErrorToast';
import type { Contact } from '@/types/contact';

export default function EditContactPage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadContact = useCallback(async () => {
    try {
      const data = await FirestoreService.get(getContactsCollection(), contactId);
      setContact(data as Contact);
    } catch (error: unknown) {
      logger.error('Error loading contact:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    void loadContact();
  }, [loadContact]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact) {
      return;
    }

    try {
      setSaving(true);
      await FirestoreService.update(getContactsCollection(), contactId, { ...contact, updatedAt: Timestamp.now() });
      router.push(`/contacts/${contactId}`);
    } catch (error: unknown) {
      logger.error('Error updating contact:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      showErrorToast(error, 'Failed to update contact');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !contact) {return <div className="p-8">Loading...</div>;}

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Edit Contact</h1>
        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <div className="bg-[var(--color-bg-paper)] rounded-lg p-6 mb-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">First Name</label><input type="text" value={contact.firstName ?? ''} onChange={(e) => setContact({ ...contact, firstName: e.target.value })} className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-2">Last Name</label><input type="text" value={contact.lastName ?? ''} onChange={(e) => setContact({ ...contact, lastName: e.target.value })} className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-2">Email</label><input type="email" value={contact.email ?? ''} onChange={(e) => setContact({ ...contact, email: e.target.value })} className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg" /></div>
              <div><label className="block text-sm font-medium mb-2">Phone</label><input type="tel" value={contact.phone ?? contact.phoneNumber ?? ''} onChange={(e) => setContact({ ...contact, phone: e.target.value })} className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">Company</label><input type="text" value={contact.company ?? ''} onChange={(e) => setContact({ ...contact, company: e.target.value })} className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-2">Title</label><input type="text" value={contact.title ?? ''} onChange={(e) => setContact({ ...contact, title: e.target.value })} className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg" /></div>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="px-6 py-3 bg-[var(--color-bg-elevated)] rounded-lg hover:bg-[var(--color-border-light)]">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-6 py-3 bg-[var(--color-primary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-primary-dark)]">{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}




