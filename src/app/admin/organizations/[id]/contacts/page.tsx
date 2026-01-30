'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Shield,
  ArrowLeft,
  UserCircle,
  Search,
  Eye,
  Star,
  Loader2,
  AlertCircle,
  ChevronDown,
  Mail,
  Phone
} from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { usePagination } from '@/hooks/usePagination';
import { logger } from '@/lib/logger/logger';
import type { Organization } from '@/types/organization';

interface Contact {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  companyName?: string;
  isVip?: boolean;
  title?: string;
}

/**
 * Admin Support View: Organization Contacts
 * View and manage contacts for any tenant organization.
 */
export default function AdminOrgContactsPage() {
  const { hasPermission } = useAdminAuth();
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const canManageOrg = hasPermission('canEditOrganizations');

  const primaryColor = '#6366f1';
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  useEffect(() => {
    async function loadOrganization() {
      try {
        setOrgLoading(true);
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        const org = await FirestoreService.get<Organization>(COLLECTIONS.ORGANIZATIONS, orgId);
        setOrganization(org);
      } catch (error) {
        logger.error('Failed to load organization:', error instanceof Error ? error : new Error(String(error)), { file: 'admin/organizations/[id]/contacts/page.tsx' });
      } finally {
        setOrgLoading(false);
      }
    }
    void loadOrganization();
  }, [orgId]);

  const fetchContacts = useCallback(async (lastDoc?: unknown) => {
    const searchParams = new URLSearchParams({
      workspaceId: 'default',
      pageSize: '50',
    });

    if (lastDoc) {
      searchParams.set('lastDoc', String(lastDoc));
    }

    const response = await fetch(`/api/workspace/${orgId}/contacts?${searchParams}`);

    if (!response.ok) {
      throw new Error('Failed to fetch contacts');
    }

    return response.json() as Promise<{ data: Contact[]; lastDoc: unknown; hasMore: boolean }>;
  }, [orgId]);

  const {
    data: contacts,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  } = usePagination<Contact>({ fetchFn: fetchContacts });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const getContactName = (contact: Contact) => {
    if (contact.name) {return contact.name;}
    if (contact.firstName ?? contact.lastName) {
      return `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim();
    }
    return 'Unknown';
  };

  const getContactCompany = (contact: Contact) => contact.company ?? contact.companyName ?? '-';

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const filteredContacts = contacts.filter(contact => {
    if (!searchQuery) {return true;}
    const name = getContactName(contact).toLowerCase();
    const company = getContactCompany(contact).toLowerCase();
    const email = (contact.email ?? '').toLowerCase();
    return name.includes(searchQuery.toLowerCase()) ||
           company.includes(searchQuery.toLowerCase()) ||
           email.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#000' }}>
      <div className="max-w-7xl mx-auto">
        {/* Back Navigation */}
        <Link
          href={`/admin/organizations/${orgId}`}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Organization
        </Link>

        {/* God Mode Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            backgroundColor: '#1a1a2e',
            border: `1px solid ${primaryColor}40`,
            borderRadius: '0.75rem',
            padding: '1rem 1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '0.5rem',
              backgroundColor: `${primaryColor}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Shield className="w-5 h-5" style={{ color: primaryColor }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>
              Admin Support View
            </div>
            <div style={{ fontSize: '0.75rem', color: '#666' }}>
              Viewing contacts for: {orgLoading ? 'Loading...' : (organization?.name ?? orgId)}
            </div>
          </div>
          {canManageOrg && (
            <div className="px-3 py-1 bg-emerald-500/20 rounded-full text-xs text-emerald-400 font-semibold">
              Full Access
            </div>
          )}
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
              style={{ backgroundColor: primaryColor }}
            >
              <UserCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Contacts</h1>
              <p className="text-gray-400">
                {contacts.length} contacts in database
              </p>
            </div>
          </div>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts..."
              className="w-full pl-12 pr-4 py-3.5 rounded-xl text-white placeholder-gray-500 focus:outline-none transition-colors"
              style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}
            />
          </div>
        </motion.div>

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30"
          >
            <div className="flex items-center gap-2 text-red-300">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {loading && contacts.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        )}

        {/* Contacts Grid */}
        {contacts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredContacts.map((contact) => {
              const name = getContactName(contact);
              return (
                <div
                  key={contact.id}
                  onClick={() => router.push(`/workspace/${orgId}/contacts/${contact.id}`)}
                  className="p-5 rounded-xl cursor-pointer transition-all hover:scale-[1.02]"
                  style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-semibold"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {getInitials(name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-white truncate">{name}</div>
                        {contact.isVip && (
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        )}
                      </div>
                      {contact.title && (
                        <div className="text-sm text-gray-400 truncate">{contact.title}</div>
                      )}
                      <div className="text-sm text-gray-500 truncate">{getContactCompany(contact)}</div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/workspace/${orgId}/contacts/${contact.id}`);
                      }}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>

                  {/* Contact Info */}
                  <div className="mt-4 pt-4 border-t space-y-2" style={{ borderColor }}>
                    {contact.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Phone className="w-4 h-4" />
                        <span>{contact.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Load More */}
        {hasMore && contacts.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 text-center"
          >
            <button
              onClick={() => void loadMore()}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
              style={{ backgroundColor: '#ffffff10', border: '1px solid #ffffff20', color: '#fff' }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
              {loading ? 'Loading...' : 'Load More'}
            </button>
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && contacts.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <div
              className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${primaryColor}10`, border: '1px solid #ffffff10' }}
            >
              <UserCircle className="w-10 h-10 text-gray-500" />
            </div>
            <div className="text-xl font-semibold text-white mb-2">No contacts found</div>
            <div className="text-gray-400">This organization has no contacts yet.</div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
