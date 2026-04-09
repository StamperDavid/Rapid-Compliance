'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { getSubCollection } from '@/lib/firebase/collections';
import { FirestoreService } from '@/lib/db/firestore-service';
import { orderBy } from 'firebase/firestore';

interface ProposalTemplateDoc {
  id: string;
  name: string;
  type: 'proposal' | 'quote' | 'contract' | 'invoice';
  sections: { id: string; type: string; content: string; order: number }[];
  createdAt: Date | string;
  updatedAt?: Date | string;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  proposal: { label: 'Proposal', color: '#2563eb', icon: '📋' },
  quote: { label: 'Quote', color: '#059669', icon: '💰' },
  contract: { label: 'Contract', color: '#7c3aed', icon: '📜' },
  invoice: { label: 'Invoice', color: '#d97706', icon: '🧾' },
};

const proposalTemplatesPath = getSubCollection('proposalTemplates');

export default function ProposalsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [templates, setTemplates] = useState<ProposalTemplateDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await FirestoreService.getAll<ProposalTemplateDoc>(
        proposalTemplatesPath,
        [orderBy('createdAt', 'desc')]
      );
      setTemplates(data);
    } catch {
      toast.error('Failed to load proposal templates');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user) {
      void loadTemplates();
    }
  }, [user, loadTemplates]);

  const handleDelete = async (templateId: string) => {
    setDeletingId(templateId);
    try {
      await FirestoreService.delete(proposalTemplatesPath, templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      toast.success('Template deleted');
    } catch {
      toast.error('Failed to delete template');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (date: Date | string | undefined): string => {
    if (!date) { return '—'; }
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString();
    } catch {
      return '—';
    }
  };

  return (
    <div className="p-8 space-y-6 text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-border">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Proposals &amp; Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage proposal templates, quotes, contracts, and invoices
          </p>
        </div>
        <Link
          href="/proposals/builder"
          className="px-5 py-2 bg-primary text-white rounded-md no-underline text-sm font-medium"
        >
          + New Template
        </Link>
      </div>

      <div className="max-w-4xl mx-auto">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading templates...
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center px-8 py-16 bg-card border-2 border-dashed border-border rounded-xl">
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-xl font-semibold mb-1">No Templates Yet</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              Create your first proposal, quote, contract, or invoice template
            </p>
            <Link
              href="/proposals/builder"
              className="px-6 py-2.5 bg-primary text-white rounded-md no-underline text-sm font-medium"
            >
              Create Your First Template
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {templates.map((tmpl) => {
              const typeConfig = TYPE_CONFIG[tmpl.type] ?? TYPE_CONFIG.proposal;
              const isDeleting = deletingId === tmpl.id;

              return (
                <div
                  key={tmpl.id}
                  className="bg-card border border-border rounded-xl px-6 py-5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                      style={{ backgroundColor: `${typeConfig.color}20` }}
                    >
                      {typeConfig.icon}
                    </div>
                    <div>
                      <div className="font-semibold text-[0.9375rem]">{tmpl.name}</div>
                      <div className="flex items-center gap-3 mt-1">
                        <span
                          className="px-2 py-0.5 rounded-full text-[0.7rem] font-semibold"
                          style={{ backgroundColor: `${typeConfig.color}20`, color: typeConfig.color }}
                        >
                          {typeConfig.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {tmpl.sections.length} section{tmpl.sections.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Created {formatDate(tmpl.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => void handleDelete(tmpl.id)}
                      disabled={isDeleting}
                      className="px-3 py-1.5 bg-transparent border border-border text-destructive rounded-md disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer text-[0.8125rem]"
                    >
                      {isDeleting ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
