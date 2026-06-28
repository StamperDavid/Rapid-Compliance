'use client';

/**
 * Leads — the bespoke CRM list (Vertical #2, Option 1: bespoke pages, retire the generic
 * /entities redirect). Mirrors contacts/page.tsx and companies/page.tsx (same DataTable:
 * search + bulk-delete + CSV export) so the CRM is consistent. Rows open the real lead
 * detail at /leads/[id] (which carries the full lead view + edit). "New Lead" reuses
 * /leads/new rather than duplicating a create form.
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
import { Target, Plus, Eye, Loader2, AlertCircle, Trash2, Mail, Building2, Gauge } from 'lucide-react';
import { type Lead, type LeadStatus } from '@/types/crm-entities';

function leadName(l: Lead): string {
  return (l.name ?? `${l.firstName ?? ''} ${l.lastName ?? ''}`.trim()) || 'Unknown';
}

const STATUS_BADGES: Record<LeadStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  contacted: { label: 'Contacted', className: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  qualified: { label: 'Qualified', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  converted: { label: 'Converted', className: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
  lost: { label: 'Lost', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

export default function LeadsPage() {
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authFetch('/api/leads?pageSize=100');
      if (!response.ok) { throw new Error('Failed to fetch leads'); }
      const result = await response.json() as { data: Lead[] };
      setLeads(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (authLoading) { return; }
    void fetchLeads();
  }, [fetchLeads, authLoading]);

  const handleBulkDelete = (_ids: string[], rows: Lead[]) => {
    setDeleteIds(rows.map((r) => r.id));
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const response = await authFetch('/api/leads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: deleteIds }),
      });
      if (!response.ok) { throw new Error('Failed to delete leads'); }
      setLeads((prev) => prev.filter((l) => !deleteIds.includes(l.id)));
      setDeleteDialogOpen(false);
      setDeleteIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const columns: ColumnDef<Lead>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (l) => leadName(l),
      render: (l) => (
        <div>
          <span className="font-medium text-foreground">{leadName(l)}</span>
          {l.title && <span className="block text-xs text-muted-foreground">{l.title}</span>}
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      accessor: (l) => l.email ?? '',
      render: (l) => (l.email
        ? <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Mail className="w-4 h-4" />{l.email}</span>
        : <span className="text-muted-foreground text-xs">-</span>),
    },
    {
      key: 'company',
      header: 'Company',
      accessor: (l) => l.company ?? l.companyName ?? '',
      render: (l) => {
        const company = l.company ?? l.companyName ?? '';
        return company
          ? <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Building2 className="w-4 h-4" />{company}</span>
          : <span className="text-muted-foreground text-xs">-</span>;
      },
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (l) => l.status,
      render: (l) => {
        const badge = STATUS_BADGES[l.status] ?? STATUS_BADGES.new;
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${badge.className}`}>
            {badge.label}
          </span>
        );
      },
    },
    {
      key: 'source',
      header: 'Source',
      accessor: (l) => l.source ?? '',
      render: (l) => (l.source
        ? <span className="text-muted-foreground text-sm">{l.source}</span>
        : <span className="text-muted-foreground text-xs">-</span>),
    },
    {
      key: 'score',
      header: 'Score',
      accessor: (l) => l.score ?? 0,
      render: (l) => (typeof l.score === 'number'
        ? <span className="inline-flex items-center gap-1 text-primary font-semibold"><Gauge className="w-4 h-4" />{l.score}</span>
        : <span className="text-muted-foreground text-xs">-</span>),
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      exportable: false,
      render: (l) => (
        <button
          onClick={() => router.push(`/leads/${l.id}`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-elevated hover:bg-surface-elevated border border-border-light hover:border-primary text-muted-foreground hover:text-foreground rounded-lg transition-all text-sm"
        >
          <Eye className="w-4 h-4" />
          View
        </button>
      ),
    },
  ], [router]);

  const bulkActions: BulkAction<Lead>[] = useMemo(() => [
    {
      key: 'delete',
      label: 'Delete',
      icon: <Trash2 className="w-4 h-4" />,
      variant: 'destructive',
      onAction: handleBulkDelete,
    },
  ], []);

  if (loading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading leads...</span>
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
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <PageTitle>Leads</PageTitle>
            <SectionDescription>{leads.length} leads in your CRM</SectionDescription>
          </div>
        </div>

        <Button onClick={() => router.push('/leads/new')}>
          <Plus className="w-5 h-5 mr-2" />
          New Lead
        </Button>
      </motion.div>

      {error && (
        <div className="p-4 rounded-xl border border-error/20 flex items-center gap-3" style={{ backgroundColor: 'rgba(var(--color-error-rgb), 0.1)' }}>
          <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
          <span className="text-error-light">{error}</span>
        </div>
      )}

      <DataTable
        columns={columns}
        data={leads}
        loading={loading}
        searchPlaceholder="Search leads..."
        searchFilter={(l, q) => {
          const name = leadName(l).toLowerCase();
          const email = (l.email ?? '').toLowerCase();
          const company = (l.company ?? l.companyName ?? '').toLowerCase();
          const source = (l.source ?? '').toLowerCase();
          return name.includes(q) || email.includes(q) || company.includes(q) || source.includes(q);
        }}
        bulkActions={bulkActions}
        enableCsvExport
        csvFilename="leads"
        emptyMessage="No leads found"
        emptyIcon={<Target className="w-8 h-8 text-muted-foreground" />}
        accentColor="blue"
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setDeleteIds([]); }}
        onConfirm={() => void confirmDelete()}
        title="Delete Leads"
        description={`Are you sure you want to delete ${deleteIds.length} lead${deleteIds.length === 1 ? '' : 's'}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
      />
    </div>
  );
}
