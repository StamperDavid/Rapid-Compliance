'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { usePagination } from '@/hooks/usePagination';
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  Building,
  Star,
  Eye,
  ChevronDown,
  Loader2,
  AlertCircle,
  UserPlus
} from 'lucide-react';

interface Contact {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  companyName?: string;
  title?: string;
  isVIP?: boolean;
}

export default function ContactsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const [searchQuery, setSearchQuery] = useState('');

  const fetchContacts = useCallback(async (lastDoc?: unknown) => {
    const searchParams = new URLSearchParams({
      workspaceId: 'default',
      pageSize: '50'
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
    if (contact.name) {
      return contact.name;
    }
    if (contact.firstName ?? contact.lastName) {
      return `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim();
    }
    return 'Unknown';
  };

  const getInitial = (contact: Contact) => {
    const name = getContactName(contact);
    return name.charAt(0).toUpperCase();
  };

  const filteredContacts = contacts.filter(c =>
    !searchQuery ||
    getContactName(c).toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
    (c.company?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  return (
    <div className="min-h-screen bg-black p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Contacts</h1>
            <p className="text-gray-400 text-sm">{contacts.length} total contacts</p>
          </div>
        </div>

        <button
          onClick={() => router.push(`/workspace/${orgId}/contacts/new`)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/25"
        >
          <Plus className="w-5 h-5" />
          Add Contact
        </button>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative max-w-md mb-6"
      >
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search contacts..."
          className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
        />
      </motion.div>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-red-300">{error}</span>
        </motion.div>
      )}

      {/* Empty State */}
      {filteredContacts.length === 0 && !loading ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-12 text-center"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
              <UserPlus className="w-8 h-8 text-gray-500" />
            </div>
            <div>
              <p className="text-gray-400 mb-1">No contacts found</p>
              <p className="text-gray-500 text-sm">
                {searchQuery ? 'Try a different search term.' : 'Click "Add Contact" to create your first contact.'}
              </p>
            </div>
            {!searchQuery && (
              <button
                onClick={() => router.push(`/workspace/${orgId}/contacts/new`)}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Contact
              </button>
            )}
          </div>
        </motion.div>
      ) : (
        <>
          {/* Contact Cards Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredContacts.map((contact, idx) => (
              <motion.div
                key={contact.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => router.push(`/workspace/${orgId}/contacts/${contact.id}`)}
                className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 hover:bg-white/5 hover:border-blue-500/30 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-blue-500/25">
                    {getInitial(contact)}
                  </div>
                  {contact.isVIP && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 text-yellow-300">
                      <Star className="w-3 h-3" />
                      VIP
                    </span>
                  )}
                </div>

                <h3 className="font-semibold text-lg text-white mb-1 group-hover:text-blue-300 transition-colors">
                  {getContactName(contact)}
                </h3>

                {contact.title && (
                  <p className="text-sm text-gray-400 mb-1">{contact.title}</p>
                )}

                {(contact.company ?? contact.companyName) && (
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
                    <Building className="w-4 h-4 text-gray-500" />
                    <span>{contact.company ?? contact.companyName}</span>
                  </div>
                )}

                <div className="space-y-2 pt-4 border-t border-white/10">
                  {contact.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Phone className="w-4 h-4 text-gray-500" />
                      <span>{contact.phone}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-white/10 flex justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/workspace/${orgId}/contacts/${contact.id}`);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/50 text-gray-400 hover:text-white rounded-lg transition-all text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Pagination */}
          {(hasMore || loading) && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => void loadMore()}
                disabled={loading || !hasMore}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : hasMore ? (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Load More ({contacts.length} shown)
                  </>
                ) : (
                  'All contacts loaded'
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
