'use client';

/**
 * Contacts — the bespoke CRM list (Vertical #2, Option 1: bespoke pages, retire the generic
 * /entities redirect). Mirrors companies/page.tsx (same DataTable: search + bulk-delete + CSV
 * export) so the CRM is consistent. Rows open the real contact detail at /contacts/[id]
 * (which carries the activity timeline + Log Activity). "New Contact" reuses /contacts/new
 * rather than duplicating a create form.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { DataTable, type ColumnDef, type BulkAction } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import { Users, Plus, Eye, Loader2, AlertCircle, Trash2, Mail, Phone, ChevronDown, GitMerge, CheckCircle } from 'lucide-react';
import { type Contact } from '@/types/contact';
import { MergeRecordsDialog } from '@/components/crm/MergeRecordsDialog';

function contactName(c: Contact): string {
  return (c.name ?? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()) || 'Unknown';
}

export default function ContactsPage() {
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mergePair, setMergePair] = useState<[Contact, Contact] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authFetch(`/api/contacts?pageSize=${limit}`);
      if (!response.ok) { throw new Error('Failed to fetch contacts'); }
      const result = await response.json() as { data: Contact[]; total?: number };
      setContacts(Array.isArray(result.data) ? result.data : []);
      setTotal(typeof result.total === 'number' ? result.total : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [authFetch, limit]);

  useEffect(() => {
    if (authLoading) { return; }
    void fetchContacts();
  }, [fetchContacts, authLoading]);

  const handleBulkDelete = (_ids: string[], rows: Contact[]) => {
    setDeleteIds(rows.map((r) => r.id));
    setDeleteDialogOpen(true);
  };

  const handleBulkMerge = (_ids: string[], rows: Contact[]) => {
    if (rows.length !== 2) {
      setNotice(null);
      setError('Select exactly two contacts to merge.');
      return;
    }
    setError(null);
    setMergePair([rows[0], rows[1]]);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      for (const id of deleteIds) {
        await authFetch(`/api/contacts/${id}`, { method: 'DELETE' });
      }
      setContacts((prev) => prev.filter((c) => !deleteIds.includes(c.id)));
      setDeleteDialogOpen(false);
      setDeleteIds([]);
      void fetchContacts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const columns: ColumnDef<Contact>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (c) => contactName(c),
      render: (c) => (
        <div>
          <span className="font-medium text-foreground">{contactName(c)}</span>
          {c.title && <span className="block text-xs text-muted-foreground">{c.title}</span>}
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      accessor: (c) => c.email ?? '',
      render: (c) => (c.email
        ? <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Mail className="w-4 h-4" />{c.email}</span>
        : <span className="text-muted-foreground text-xs">-</span>),
    },
    {
      key: 'phone',
      header: 'Phone',
      accessor: (c) => c.phone ?? c.phoneNumber ?? '',
      render: (c) => {
        const p = c.phone ?? c.phoneNumber ?? '';
        return p
          ? <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Phone className="w-4 h-4" />{p}</span>
          : <span className="text-muted-foreground text-xs">-</span>;
      },
    },
    {
      key: 'company',
      header: 'Company',
      accessor: (c) => c.company ?? '',
      render: (c) => (c.company
        ? <span className="text-muted-foreground">{c.company}</span>
        : <span className="text-muted-foreground text-xs">-</span>),
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      exportable: false,
      render: (c) => (
        <button
          onClick={() => router.push(`/contacts/${c.id}`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-elevated hover:bg-surface-elevated border border-border-light hover:border-primary text-muted-foreground hover:text-foreground rounded-lg transition-all text-sm"
        >
          <Eye className="w-4 h-4" />
          View
        </button>
      ),
    },
  ], [router]);

  const bulkActions: BulkAction<Contact>[] = useMemo(() => [
    {
      key: 'merge',
      label: 'Merge',
      icon: <GitMerge className="w-4 h-4" />,
      variant: 'default',
      onAction: handleBulkMerge,
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: <Trash2 className="w-4 h-4" />,
      variant: 'destructive',
      onAction: handleBulkDelete,
    },
  ], []);

  if (loading && contacts.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading contacts...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary to-primary flex items-center justify-center shadow-lg shadow-secondary/25">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <PageTitle>Contacts</PageTitle>
            <SectionDescription>
              {total !== null ? `${contacts.length} of ${total} contacts in your CRM` : `${contacts.length} contacts in your CRM`}
            </SectionDescription>
          </div>
        </div>

        <Button onClick={() => router.push('/contacts/new')}>
          <Plus className="w-5 h-5 mr-2" />
          New Contact
        </Button>
      </motion.div>

      {error && (
        <div className="p-4 rounded-xl border border-error/20 flex items-center gap-3" style={{ backgroundColor: 'rgba(var(--color-error-rgb), 0.1)' }}>
          <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
          <span className="text-error-light">{error}</span>
        </div>
      )}

      {notice && (
        <div className="p-4 rounded-xl border border-success/20 flex items-center gap-3" style={{ backgroundColor: 'rgba(var(--color-success-rgb), 0.1)' }}>
          <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
          <span className="text-success">{notice}</span>
        </div>
      )}

      <DataTable
        columns={columns}
        data={contacts}
        loading={loading}
        searchPlaceholder="Search contacts..."
        searchFilter={(c, q) => {
          const name = contactName(c).toLowerCase();
          const email = (c.email ?? '').toLowerCase();
          const company = (c.company ?? '').toLowerCase();
          return name.includes(q) || email.includes(q) || company.includes(q);
        }}
        bulkActions={bulkActions}
        enableCsvExport
        csvFilename="contacts"
        emptyMessage="No contacts found"
        emptyIcon={<Users className="w-8 h-8 text-muted-foreground" />}
        accentColor="blue"
      />

      {total !== null && contacts.length < total && (
        <div className="flex justify-center">
          <button
            onClick={() => setLimit((l) => l + 100)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-surface-elevated hover:bg-surface-elevated border border-border-light text-muted-foreground hover:text-foreground rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Load More ({contacts.length} of {total})
              </>
            )}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setDeleteIds([]); }}
        onConfirm={() => void confirmDelete()}
        title="Delete Contacts"
        description={`Are you sure you want to delete ${deleteIds.length} contact${deleteIds.length === 1 ? '' : 's'}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
      />

      {mergePair && (
        <MergeRecordsDialog
          open
          onClose={() => setMergePair(null)}
          entityType="contact"
          recordA={{ id: mergePair[0].id, label: contactName(mergePair[0]), sublabel: mergePair[0].email ?? mergePair[0].company ?? undefined }}
          recordB={{ id: mergePair[1].id, label: contactName(mergePair[1]), sublabel: mergePair[1].email ?? mergePair[1].company ?? undefined }}
          onMerged={(msg) => { setMergePair(null); setNotice(msg); void fetchContacts(); }}
        />
      )}
    </div>
  );
}
