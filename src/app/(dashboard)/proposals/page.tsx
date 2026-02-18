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
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-primary)' }}>
      {/* Header */}
      <div style={{
        padding: '1.5rem 2rem',
        borderBottom: '1px solid var(--color-bg-elevated)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Proposals & Documents</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Create and manage proposal templates, quotes, contracts, and invoices
          </p>
        </div>
        <Link
          href="/proposals/builder"
          style={{
            padding: '0.5rem 1.25rem',
            backgroundColor: 'var(--color-primary)',
            color: '#fff',
            borderRadius: '0.375rem',
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          + New Template
        </Link>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
            Loading templates...
          </div>
        ) : templates.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            backgroundColor: 'var(--color-bg-card)',
            border: '2px dashed var(--color-bg-elevated)',
            borderRadius: '0.75rem',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>No Templates Yet</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              Create your first proposal, quote, contract, or invoice template
            </p>
            <Link
              href="/proposals/builder"
              style={{
                padding: '0.625rem 1.5rem',
                backgroundColor: 'var(--color-primary)',
                color: '#fff',
                borderRadius: '0.375rem',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              Create Your First Template
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {templates.map((tmpl) => {
              const typeConfig = TYPE_CONFIG[tmpl.type] ?? TYPE_CONFIG.proposal;
              const isDeleting = deletingId === tmpl.id;

              return (
                <div
                  key={tmpl.id}
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    border: '1px solid var(--color-bg-elevated)',
                    borderRadius: '0.75rem',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '0.5rem',
                      backgroundColor: `${typeConfig.color}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                    }}>
                      {typeConfig.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{tmpl.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                        <span style={{
                          padding: '0.125rem 0.5rem',
                          borderRadius: '9999px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          backgroundColor: `${typeConfig.color}20`,
                          color: typeConfig.color,
                        }}>
                          {typeConfig.label}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {tmpl.sections.length} section{tmpl.sections.length !== 1 ? 's' : ''}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          Created {formatDate(tmpl.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => void handleDelete(tmpl.id)}
                      disabled={isDeleting}
                      style={{
                        padding: '0.375rem 0.75rem',
                        backgroundColor: 'transparent',
                        border: '1px solid var(--color-bg-elevated)',
                        color: 'var(--color-error)',
                        borderRadius: '0.375rem',
                        cursor: isDeleting ? 'not-allowed' : 'pointer',
                        fontSize: '0.8125rem',
                        opacity: isDeleting ? 0.5 : 1,
                      }}
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
