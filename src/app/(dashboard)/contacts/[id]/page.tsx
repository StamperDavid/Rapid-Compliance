'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getContactsCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { getLastActivityDate, type Contact } from '@/types/contact';

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading || !contact) {return <div className="p-8">Loading...</div>;}

  const displayName = (contact.name ?? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim()) || 'Unknown';
  const displayInitial = (contact.name ?? contact.firstName ?? 'U').charAt(0).toUpperCase();
  const displayPhone = contact.phone ?? contact.phoneNumber ?? '';
  const lastActivityDate = getLastActivityDate(contact);

  return (
    <div className="p-8">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-[var(--color-primary)] hover:opacity-80 mb-4">← Back to Contacts</button>
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-3xl font-bold">{displayInitial}</div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{displayName}</h1>
            {contact.title && <p className="text-lg text-[var(--color-text-secondary)] mb-1">{contact.title}</p>}
            {contact.company && <p className="text-[var(--color-text-secondary)]">{contact.company}</p>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-[var(--color-bg-paper)] rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Contact Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><div className="text-sm text-[var(--color-text-secondary)] mb-1">Email</div><div>{contact.email ?? '-'}</div></div>
              <div><div className="text-sm text-[var(--color-text-secondary)] mb-1">Phone</div><div>{displayPhone || '-'}</div></div>
              <div><div className="text-sm text-[var(--color-text-secondary)] mb-1">Mobile</div><div>{contact.mobile ?? '-'}</div></div>
              <div><div className="text-sm text-[var(--color-text-secondary)] mb-1">LinkedIn</div><div>{contact.linkedIn ? <a href={contact.linkedIn} className="text-[var(--color-primary)] hover:opacity-80">View Profile</a> : '-'}</div></div>
            </div>
          </div>
          <div className="bg-[var(--color-bg-paper)] rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Activity Timeline</h2>
            <div className="space-y-3">
              {lastActivityDate ? (
                <div className="bg-[var(--color-bg-elevated)] rounded p-3"><div className="text-sm text-[var(--color-text-secondary)]">Last Activity: {lastActivityDate.toLocaleString()}</div></div>
              ) : (
                <div className="text-[var(--color-text-secondary)] text-sm">No recent activity</div>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-[var(--color-bg-paper)] rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Actions</h2>
            <div className="space-y-2">
              <button
                onClick={() => {
                  const subject = `Getting in touch`;
                  window.location.href = `mailto:${contact.email ?? ''}?subject=${encodeURIComponent(subject)}`;
                }}
                className="w-full px-4 py-2 bg-[var(--color-primary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-primary-dark)] text-left"
              >
                ✉️ Send Email
              </button>
              <button
                onClick={() => router.push(`/calls/make?phone=${encodeURIComponent(displayPhone)}&contactId=${contactId}`)}
                className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] rounded-lg hover:bg-[var(--color-border-light)] text-left"
              >
                📞 Make Call
              </button>
              <button
                onClick={() => router.push(`/contacts/${contactId}/edit`)}
                className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] rounded-lg hover:bg-[var(--color-border-light)] text-left"
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

