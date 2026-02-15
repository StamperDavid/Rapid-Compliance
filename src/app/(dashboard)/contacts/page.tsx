'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { usePagination } from '@/hooks/usePagination';
import { useOptimisticDelete } from '@/hooks/useOptimisticDelete';
import { DataTable, type ColumnDef, type BulkAction } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
  UserPlus,
  LayoutGrid,
  List,
  Trash2,
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

const getContactName = (contact: Contact) => {
  if (contact.name) { return contact.name; }
  if (contact.firstName ?? contact.lastName) {
    return `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim();
  }
  return 'Unknown';
};

const getInitial = (contact: Contact) => {
  const name = getContactName(contact);
  return name.charAt(0).toUpperCase();
};

const getContactCompany = (contact: Contact) => {
  return contact.company ?? contact.companyName ?? '-';
};

export default function ContactsPage() {
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'cards' | 'table'>('cards');

  const fetchContacts = useCallback(async (lastDoc?: unknown) => {
    const searchParams = new URLSearchParams({
      pageSize: '50'
    });

    if (lastDoc) {
      searchParams.set('lastDoc', String(lastDoc));
    }

    const response = await fetch(`/api/contacts?${searchParams}`);

    if (!response.ok) {
      throw new Error('Failed to fetch contacts');
    }

    return response.json() as Promise<{ data: Contact[]; lastDoc: unknown; hasMore: boolean }>;
  }, []);

  const {
    data: contacts,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    setData: setContacts,
  } = usePagination<Contact>({ fetchFn: fetchContacts });

  const {
    deleteIds,
    deleteDialogOpen,
    deleting,
    requestDelete: handleBulkDelete,
    cancelDelete,
    confirmDelete,
  } = useOptimisticDelete({
    data: contacts,
    setData: setContacts,
    endpoint: '/api/contacts',
    entityName: 'contacts',
  });

  useEffect(() => {
    // Wait for Firebase auth to restore session before making API calls
    if (authLoading) { return; }
    void refresh();
  }, [refresh, authLoading]);

  const filteredContacts = contacts.filter(c =>
    !searchQuery ||
    getContactName(c).toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
    (c.company?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  // DataTable columns
  const columns: ColumnDef<Contact>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (c) => getContactName(c),
      render: (c) => <span className="font-medium text-[var(--color-text-primary)]">{getContactName(c)}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      accessor: (c) => c.email ?? '',
      render: (c) => <span className="text-[var(--color-text-secondary)]">{c.email ?? '-'}</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      accessor: (c) => c.phone ?? '',
      render: (c) => <span className="text-[var(--color-text-secondary)]">{c.phone ?? '-'}</span>,
    },
    {
      key: 'company',
      header: 'Company',
      accessor: (c) => getContactCompany(c),
      render: (c) => <span className="text-[var(--color-text-secondary)]">{getContactCompany(c)}</span>,
    },
    {
      key: 'title',
      header: 'Title',
      accessor: (c) => c.title ?? '',
      render: (c) => <span className="text-[var(--color-text-secondary)]">{c.title ?? '-'}</span>,
    },
    {
      key: 'vip',
      header: 'VIP',
      accessor: (c) => c.isVIP ? 'Yes' : 'No',
      render: (c) => c.isVIP ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 text-yellow-300">
          <Star className="w-3 h-3" />
          VIP
        </span>
      ) : (
        <span className="text-[var(--color-text-disabled)]">-</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      exportable: false,
      render: (c) => (
        <button
          onClick={() => router.push(`/contacts/${c.id}`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-elevated hover:bg-surface-elevated border border-border-light hover:border-primary text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-lg transition-all text-sm"
        >
          <Eye className="w-4 h-4" />
          View
        </button>
      ),
    },
  ], [router]);

  const bulkActions: BulkAction<Contact>[] = useMemo(() => [
    {
      key: 'delete',
      label: 'Delete',
      icon: <Trash2 className="w-4 h-4" />,
      variant: 'destructive',
      onAction: handleBulkDelete,
    },
  ], [handleBulkDelete]);

  return (
    <div className="min-h-screen bg-surface-main p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/25">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Contacts</h1>
            <p className="text-[var(--color-text-secondary)] text-sm">{contacts.length} total contacts</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex gap-1 p-1 bg-surface-elevated border border-border-light rounded-xl" role="group" aria-label="View options">
            <button
              onClick={() => setView('cards')}
              aria-pressed={view === 'cards'}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'cards'
                  ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/25'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-surface-elevated'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Cards
            </button>
            <button
              onClick={() => setView('table')}
              aria-pressed={view === 'table'}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'table'
                  ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/25'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-surface-elevated'
              }`}
            >
              <List className="w-4 h-4" />
              Table
            </button>
          </div>

          <button
            onClick={() => router.push(`/contacts/new`)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-secondary hover:from-primary-light hover:to-secondary-light text-white font-semibold rounded-xl transition-all shadow-lg shadow-primary/25"
          >
            <Plus className="w-5 h-5" />
            Add Contact
          </button>
        </div>
      </motion.div>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ backgroundColor: 'rgba(var(--color-error-rgb), 0.1)' }}
          className="mb-6 p-4 rounded-xl border-error/20 border flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
          <span className="text-error-light">{error}</span>
        </motion.div>
      )}

      {view === 'table' ? (
        /* Table View — DataTable */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <DataTable
            columns={columns}
            data={contacts}
            loading={loading}
            searchPlaceholder="Search contacts..."
            searchFilter={(c, query) => {
              const name = getContactName(c).toLowerCase();
              const email = (c.email ?? '').toLowerCase();
              const company = getContactCompany(c).toLowerCase();
              return name.includes(query) || email.includes(query) || company.includes(query);
            }}
            bulkActions={bulkActions}
            enableCsvExport
            csvFilename="contacts"
            hasMore={hasMore}
            onLoadMore={() => void loadMore()}
            itemCountLabel={`${contacts.length} shown`}
            emptyMessage="No contacts found"
            emptyIcon={<UserPlus className="w-8 h-8 text-[var(--color-text-disabled)]" />}
            accentColor="blue"
          />
        </motion.div>
      ) : (
        <>
          {/* Search (cards view only) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative max-w-md mb-6"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-disabled)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts..."
              className="w-full pl-12 pr-4 py-3 bg-surface-elevated border border-border-light rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
            />
          </motion.div>

          {/* Empty State */}
          {filteredContacts.length === 0 && !loading ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-12 text-center"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-surface-elevated flex items-center justify-center">
                  <UserPlus className="w-8 h-8 text-[var(--color-text-disabled)]" />
                </div>
                <div>
                  <p className="text-[var(--color-text-secondary)] mb-1">No contacts found</p>
                  <p className="text-[var(--color-text-disabled)] text-sm">
                    {searchQuery ? 'Try a different search term.' : 'Click "Add Contact" to create your first contact.'}
                  </p>
                </div>
                {!searchQuery && (
                  <button
                    onClick={() => router.push(`/contacts/new`)}
                    className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-secondary hover:from-primary-light hover:to-secondary-light text-white font-medium rounded-xl transition-all text-sm"
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
                    onClick={() => router.push(`/contacts/${contact.id}`)}
                    className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6 hover:bg-surface-elevated hover:border-primary transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-primary/25">
                        {getInitial(contact)}
                      </div>
                      {contact.isVIP && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 text-yellow-300">
                          <Star className="w-3 h-3" />
                          VIP
                        </span>
                      )}
                    </div>

                    <h3 className="font-semibold text-lg text-[var(--color-text-primary)] mb-1 group-hover:text-primary-light transition-colors">
                      {getContactName(contact)}
                    </h3>

                    {contact.title && (
                      <p className="text-sm text-[var(--color-text-secondary)] mb-1">{contact.title}</p>
                    )}

                    {(contact.company ?? contact.companyName) && (
                      <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-4">
                        <Building className="w-4 h-4 text-[var(--color-text-disabled)]" />
                        <span>{contact.company ?? contact.companyName}</span>
                      </div>
                    )}

                    <div className="space-y-2 pt-4 border-t border-border-light">
                      {contact.email && (
                        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                          <Mail className="w-4 h-4 text-[var(--color-text-disabled)]" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                          <Phone className="w-4 h-4 text-[var(--color-text-disabled)]" />
                          <span>{contact.phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-border-light flex justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/contacts/${contact.id}`);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-elevated hover:bg-surface-elevated border border-border-light hover:border-primary text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-lg transition-all text-sm"
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
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-surface-elevated hover:bg-surface-elevated border border-border-light text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Contacts"
        description={`Are you sure you want to delete ${deleteIds.length} contact${deleteIds.length === 1 ? '' : 's'}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
      />
    </div>
  );
}
