'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import { type Contact } from '@/types/contact';
import { PageTitle, SectionTitle } from '@/components/ui/typography';
import { RecordActivityTimeline } from '@/components/crm/RecordActivityTimeline';
import ContactNextBestAction from '@/components/crm/ContactNextBestAction';
import { ContactActivitySummary } from '@/components/crm/ContactActivitySummary';
import { ContactDraftEmail } from '@/components/crm/ContactDraftEmail';
import { EntitySearchSelect } from '@/components/crm/EntitySearchSelect';

interface LinkedDeal {
  id: string;
  name?: string;
  value?: number;
  stage?: string;
}

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const authFetch = useAuthFetch();
  const contactId = params.id as string;
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<LinkedDeal[] | null>(null);

  const loadContact = useCallback(async () => {
    try {
      const res = await authFetch(`/api/contacts/${contactId}`);
      const json = (await res.json()) as { success?: boolean; contact?: Contact };
      if (json.success && json.contact) {
        setContact(json.contact);
      }
    } catch (error: unknown) {
      logger.error('Error loading contact:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [authFetch, contactId]);

  const loadDeals = useCallback(async () => {
    try {
      const res = await authFetch(`/api/contacts/${contactId}/deals`);
      const json = (await res.json()) as { success?: boolean; data?: LinkedDeal[] };
      setDeals(json.data ?? []);
    } catch (error: unknown) {
      logger.error('Error loading contact deals:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      setDeals([]);
    }
  }, [authFetch, contactId]);

  const handleSetCompany = useCallback(
    async (companyId: string, companyLabel: string) => {
      try {
        const res = await authFetch(`/api/contacts/${contactId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, company: companyLabel }),
        });
        const json = (await res.json()) as { success?: boolean; contact?: Contact };
        if (json.success && json.contact) {
          setContact(json.contact);
        }
      } catch (error: unknown) {
        logger.error('Error linking company:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      }
    },
    [authFetch, contactId]
  );

  useEffect(() => {
    void loadContact();
    void loadDeals();
  }, [loadContact, loadDeals]);

  if (loading || !contact) {return <div className="p-8">Loading...</div>;}

  const displayName = (contact.name ?? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim()) || 'Unknown';
  const displayInitial = (contact.name ?? contact.firstName ?? 'U').charAt(0).toUpperCase();
  const displayPhone = contact.phone ?? contact.phoneNumber ?? '';

  return (
    <div className="p-8 space-y-6">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-primary hover:opacity-80 mb-4">← Back to Contacts</button>
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-3xl font-bold">{displayInitial}</div>
          <div className="flex-1">
            <PageTitle className="mb-2">{displayName}</PageTitle>
            {contact.title && <p className="text-lg text-muted-foreground mb-1">{contact.title}</p>}
            {contact.company && <p className="text-muted-foreground">{contact.company}</p>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-card rounded-lg p-6">
            <SectionTitle className="mb-4">Contact Details</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <div><div className="text-sm text-muted-foreground mb-1">Email</div><div>{contact.email ?? '-'}</div></div>
              <div><div className="text-sm text-muted-foreground mb-1">Phone</div><div>{displayPhone || '-'}</div></div>
              <div><div className="text-sm text-muted-foreground mb-1">Mobile</div><div>{contact.mobile ?? '-'}</div></div>
              <div><div className="text-sm text-muted-foreground mb-1">LinkedIn</div><div>{contact.linkedIn ? <a href={contact.linkedIn} className="text-primary hover:opacity-80">View Profile</a> : '-'}</div></div>
            </div>
          </div>
          <RecordActivityTimeline
            entityType="contact"
            entityId={contactId}
            entityName={displayName}
            topSlot={<ContactActivitySummary contactId={contactId} />}
          />
        </div>
        <div className="space-y-6">
          <ContactNextBestAction contactId={contactId} />

          <div className="bg-card rounded-lg p-6">
            <SectionTitle className="mb-4">Relationships</SectionTitle>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Company</div>
                {contact.companyId && contact.company ? (
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => router.push(`/companies/${contact.companyId ?? ''}`)}
                      className="text-primary hover:opacity-80 text-left"
                    >
                      {contact.company}
                    </button>
                    <button
                      onClick={() => setContact((prev) => (prev ? { ...prev, companyId: undefined } : prev))}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <EntitySearchSelect
                    entityType="company"
                    placeholder="Link a company…"
                    onSelect={(id, label) => void handleSetCompany(id, label)}
                  />
                )}
                {!contact.companyId && contact.company && (
                  <div className="text-xs text-muted-foreground mt-1">Currently shown as “{contact.company}” (not yet linked).</div>
                )}
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-1">Deals</div>
                {deals === null ? (
                  <div className="text-sm text-muted-foreground">Loading…</div>
                ) : deals.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No deals linked to this contact.</div>
                ) : (
                  <div className="divide-y divide-border-light">
                    {deals.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => router.push(`/deals/${d.id}`)}
                        className="flex w-full items-center justify-between py-2 text-left hover:opacity-80"
                      >
                        <span className="text-sm font-medium text-foreground">{d.name ?? 'Untitled deal'}</span>
                        <span className="text-xs text-muted-foreground">${(d.value ?? 0).toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg p-6">
            <SectionTitle className="mb-4">Actions</SectionTitle>
            <div className="space-y-2">
              <ContactDraftEmail contactId={contactId} contactEmail={contact.email} contactName={displayName} />
              <button
                onClick={() => {
                  const subject = `Getting in touch`;
                  window.location.href = `mailto:${contact.email ?? ''}?subject=${encodeURIComponent(subject)}`;
                }}
                className="w-full px-4 py-2 bg-surface-elevated text-muted-foreground rounded-lg hover:bg-border-light text-left"
              >
                ✉️ Send Email
              </button>
              <button
                onClick={() => router.push(`/calls/make?phone=${encodeURIComponent(displayPhone)}&contactId=${contactId}`)}
                className="w-full px-4 py-2 bg-surface-elevated text-muted-foreground rounded-lg hover:bg-border-light text-left"
              >
                📞 Make Call
              </button>
              <button
                onClick={() => router.push(`/contacts/${contactId}/edit`)}
                className="w-full px-4 py-2 bg-surface-elevated text-muted-foreground rounded-lg hover:bg-border-light text-left"
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
