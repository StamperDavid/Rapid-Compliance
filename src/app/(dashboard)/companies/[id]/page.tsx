'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import type { Company } from '@/types/company';
import { PageTitle, SectionTitle } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { RecordActivityTimeline } from '@/components/crm/RecordActivityTimeline';

/** Company GET returns the company merged with rollup counts; we read both defensively. */
interface CompanyWithRollup extends Company {
  contactCount?: number;
  dealCount?: number;
  totalDealValue?: number;
  wonDealValue?: number;
}

interface LinkedContact {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  title?: string;
}

interface LinkedDeal {
  id: string;
  name?: string;
  value?: number;
  stage?: string;
}

/** Best available display name for a linked contact, without chaining `||`. */
function contactDisplayName(c: LinkedContact): string {
  const composed = (c.name ?? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim());
  if (composed) { return composed; }
  if (c.email) { return c.email; }
  return 'Unnamed contact';
}

export default function CompanyDetailPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const authFetch = useAuthFetch();
  const companyId = params.id as string;
  const [company, setCompany] = useState<CompanyWithRollup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<LinkedContact[] | null>(null);
  const [deals, setDeals] = useState<LinkedDeal[] | null>(null);
  const [relError, setRelError] = useState<string | null>(null);

  const loadRelationships = useCallback(async () => {
    setRelError(null);
    try {
      const [contactsRes, dealsRes] = await Promise.all([
        authFetch(`/api/crm/companies/${companyId}/contacts`),
        authFetch(`/api/crm/companies/${companyId}/deals`),
      ]);
      const contactsJson = (await contactsRes.json()) as { success?: boolean; data?: LinkedContact[] };
      const dealsJson = (await dealsRes.json()) as { success?: boolean; data?: LinkedDeal[] };
      setContacts(contactsJson.data ?? []);
      setDeals(dealsJson.data ?? []);
    } catch (e) {
      logger.error('Error loading company relationships:', e instanceof Error ? e : new Error(String(e)), { file: 'page.tsx' });
      setRelError("We couldn't load this company's contacts and deals.");
    }
  }, [authFetch, companyId]);

  const loadCompany = useCallback(async () => {
    setError(null);
    try {
      const res = await authFetch(`/api/crm/companies/${companyId}`);
      const json = (await res.json()) as { success?: boolean; data?: CompanyWithRollup; error?: string };
      if (json.success && json.data) {
        setCompany(json.data);
      } else {
        throw new Error(json.error ?? 'Company not found.');
      }
    } catch (e) {
      logger.error('Error loading company:', e instanceof Error ? e : new Error(String(e)), { file: 'page.tsx' });
      setError("We couldn't load this company. Please go back and try again.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, companyId]);

  useEffect(() => {
    void loadCompany();
    void loadRelationships();
  }, [loadCompany, loadRelationships]);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (error || !company) {
    return (
      <div className="p-8 space-y-4">
        <button onClick={() => router.back()} className="text-primary hover:opacity-80">← Back to Companies</button>
        <div className="text-destructive text-sm">{error ?? 'Company not found.'}</div>
      </div>
    );
  }

  const displayInitial = (company.name ?? 'C').charAt(0).toUpperCase();

  return (
    <div className="p-8 space-y-6">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-primary hover:opacity-80 mb-4">← Back to Companies</button>
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center text-3xl font-bold text-white">{displayInitial}</div>
          <div className="flex-1">
            <PageTitle className="mb-2">{company.name}</PageTitle>
            {company.industry && <p className="text-lg text-muted-foreground mb-1">{company.industry}</p>}
            {company.website && (
              <a href={company.website} className="text-primary hover:opacity-80">{company.website}</a>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card rounded-lg p-6">
            <SectionTitle className="mb-4">Company Details</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><div className="text-sm text-muted-foreground mb-1">Status</div><div className="capitalize">{company.status}</div></div>
              <div><div className="text-sm text-muted-foreground mb-1">Phone</div><div>{company.phone ?? '-'}</div></div>
              <div><div className="text-sm text-muted-foreground mb-1">Email</div><div>{company.email ?? '-'}</div></div>
              <div><div className="text-sm text-muted-foreground mb-1">Size</div><div className="capitalize">{company.size ?? '-'}</div></div>
              <div><div className="text-sm text-muted-foreground mb-1">Contacts</div><div>{company.contactCount ?? 0}</div></div>
              <div><div className="text-sm text-muted-foreground mb-1">Deals</div><div>{company.dealCount ?? 0}</div></div>
            </div>
            {company.description && (
              <div className="mt-4">
                <div className="text-sm text-muted-foreground mb-1">Description</div>
                <div className="text-sm whitespace-pre-wrap">{company.description}</div>
              </div>
            )}
          </div>

          {relError && <div className="text-destructive text-sm">{relError}</div>}

          <div className="bg-card rounded-lg p-6">
            <SectionTitle className="mb-4">Contacts ({contacts?.length ?? company.contactCount ?? 0})</SectionTitle>
            {contacts === null ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : contacts.length === 0 ? (
              <div className="text-sm text-muted-foreground">No contacts linked to this company yet.</div>
            ) : (
              <div className="divide-y divide-border-light">
                {contacts.map((c) => {
                  const name = contactDisplayName(c);
                  return (
                    <button
                      key={c.id}
                      onClick={() => router.push(`/contacts/${c.id}`)}
                      className="flex w-full items-center justify-between py-2 text-left hover:opacity-80"
                    >
                      <span className="text-sm font-medium text-foreground">{name}</span>
                      <span className="text-xs text-muted-foreground">{c.title ?? c.email ?? ''}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-card rounded-lg p-6">
            <SectionTitle className="mb-4">Deals ({deals?.length ?? company.dealCount ?? 0})</SectionTitle>
            {deals === null ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : deals.length === 0 ? (
              <div className="text-sm text-muted-foreground">No deals linked to this company yet.</div>
            ) : (
              <div className="divide-y divide-border-light">
                {deals.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => router.push(`/deals/${d.id}`)}
                    className="flex w-full items-center justify-between py-2 text-left hover:opacity-80"
                  >
                    <span className="text-sm font-medium text-foreground">{d.name ?? 'Untitled deal'}</span>
                    <span className="text-xs text-muted-foreground">
                      {d.stage ? `${d.stage.replace('_', ' ')} · ` : ''}${(d.value ?? 0).toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <RecordActivityTimeline entityType="company" entityId={companyId} entityName={company.name} />
        </div>

        <div className="space-y-6">
          <div className="bg-card rounded-lg p-6">
            <SectionTitle className="mb-4">Actions</SectionTitle>
            <div className="space-y-2">
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => router.push(`/companies?edit=${companyId}`)}
              >
                Edit Company
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
