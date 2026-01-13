'use client';

/**
 * Forms Management Page
 *
 * Lists all forms for the organization with status, analytics,
 * and quick actions. Includes create form modal with templates.
 *
 * @route /workspace/[orgId]/forms
 * @version 1.0.0
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { FormDefinition, FormStatus } from '@/lib/forms/types';

// ============================================================================
// TYPES
// ============================================================================

interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
}

// ============================================================================
// MOCK TEMPLATES
// ============================================================================

const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Form',
    description: 'Start from scratch with a blank form',
    category: 'Basic',
    icon: '📝',
  },
  {
    id: 'contact',
    name: 'Contact Form',
    description: 'Simple contact form with name, email, and message',
    category: 'Basic',
    icon: '✉️',
  },
  {
    id: 'lead-capture',
    name: 'Lead Capture',
    description: 'Capture leads with company and qualification fields',
    category: 'Sales',
    icon: '🎯',
  },
  {
    id: 'survey',
    name: 'Customer Survey',
    description: 'Multi-step survey with rating and feedback',
    category: 'Feedback',
    icon: '📊',
  },
  {
    id: 'registration',
    name: 'Event Registration',
    description: 'Event signup with attendee details',
    category: 'Events',
    icon: '🎟️',
  },
  {
    id: 'application',
    name: 'Job Application',
    description: 'Application form with file uploads',
    category: 'HR',
    icon: '💼',
  },
];

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: {
    padding: '2rem',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#fff',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#666',
    marginTop: '0.25rem',
  },
  createButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    backgroundColor: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  tabs: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1.5rem',
    borderBottom: '1px solid #1a1a1a',
    paddingBottom: '1rem',
  },
  tab: {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#666',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  tabActive: {
    color: '#fff',
    backgroundColor: '#1a1a1a',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '1.5rem',
  },
  card: {
    backgroundColor: '#0a0a0a',
    border: '1px solid #1a1a1a',
    borderRadius: '0.75rem',
    overflow: 'hidden',
    transition: 'all 0.2s',
    cursor: 'pointer',
  },
  cardHover: {
    borderColor: '#333',
    transform: 'translateY(-2px)',
  },
  cardHeader: {
    padding: '1.25rem',
    borderBottom: '1px solid #1a1a1a',
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#fff',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  cardDescription: {
    fontSize: '0.875rem',
    color: '#666',
    marginTop: '0.25rem',
    lineHeight: '1.4',
  },
  cardBody: {
    padding: '1.25rem',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1rem',
  },
  stat: {
    textAlign: 'center' as const,
  },
  statValue: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#fff',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#666',
    marginTop: '0.125rem',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.25rem',
    borderTop: '1px solid #1a1a1a',
    backgroundColor: '#050505',
  },
  statusBadge: {
    padding: '0.25rem 0.75rem',
    fontSize: '0.75rem',
    fontWeight: '600',
    borderRadius: '9999px',
  },
  statusDraft: {
    backgroundColor: '#1a1a1a',
    color: '#999',
  },
  statusPublished: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    color: '#22c55e',
  },
  statusArchived: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    color: '#eab308',
  },
  actions: {
    display: 'flex',
    gap: '0.5rem',
  },
  actionButton: {
    padding: '0.375rem 0.75rem',
    fontSize: '0.75rem',
    color: '#999',
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    textDecoration: 'none',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '4rem 2rem',
    backgroundColor: '#0a0a0a',
    border: '1px solid #1a1a1a',
    borderRadius: '0.75rem',
  },
  emptyIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '0.5rem',
  },
  emptyText: {
    fontSize: '0.875rem',
    color: '#666',
    marginBottom: '1.5rem',
  },
  // Modal styles
  modal: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '2rem',
  },
  modalContent: {
    backgroundColor: '#0a0a0a',
    border: '1px solid #1a1a1a',
    borderRadius: '1rem',
    width: '100%',
    maxWidth: '700px',
    maxHeight: '90vh',
    overflow: 'auto',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.5rem',
    borderBottom: '1px solid #1a1a1a',
  },
  modalTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#fff',
    margin: 0,
  },
  modalClose: {
    padding: '0.5rem',
    fontSize: '1.25rem',
    color: '#666',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },
  modalBody: {
    padding: '1.5rem',
  },
  formGroup: {
    marginBottom: '1.5rem',
  },
  label: {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#ccc',
    marginBottom: '0.5rem',
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '0.5rem',
    color: '#fff',
  },
  templateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1rem',
    marginTop: '1rem',
  },
  templateCard: {
    padding: '1rem',
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  templateCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#1e1e2f',
  },
  templateIcon: {
    fontSize: '1.5rem',
    marginBottom: '0.5rem',
  },
  templateName: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#fff',
  },
  templateDescription: {
    fontSize: '0.75rem',
    color: '#666',
    marginTop: '0.25rem',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    padding: '1.5rem',
    borderTop: '1px solid #1a1a1a',
  },
  cancelButton: {
    padding: '0.75rem 1.5rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#999',
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '0.5rem',
    cursor: 'pointer',
  },
  submitButton: {
    padding: '0.75rem 1.5rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#fff',
    backgroundColor: '#6366f1',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
  },
  loadingSpinner: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '4rem',
  },
};

// ============================================================================
// SKELETON LOADER
// ============================================================================

function FormCardSkeleton() {
  return (
    <div style={{ ...styles.card, opacity: 0.7 }}>
      <div style={styles.cardHeader}>
        <div style={{ height: '24px', width: '60%', backgroundColor: '#1a1a1a', borderRadius: '4px' }} />
        <div style={{ height: '16px', width: '80%', backgroundColor: '#1a1a1a', borderRadius: '4px', marginTop: '8px' }} />
      </div>
      <div style={styles.cardBody}>
        <div style={styles.statsGrid}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={styles.stat}>
              <div style={{ height: '28px', width: '40px', backgroundColor: '#1a1a1a', borderRadius: '4px', margin: '0 auto' }} />
              <div style={{ height: '12px', width: '60px', backgroundColor: '#1a1a1a', borderRadius: '4px', margin: '4px auto 0' }} />
            </div>
          ))}
        </div>
      </div>
      <div style={styles.cardFooter}>
        <div style={{ height: '24px', width: '80px', backgroundColor: '#1a1a1a', borderRadius: '9999px' }} />
        <div style={{ height: '28px', width: '100px', backgroundColor: '#1a1a1a', borderRadius: '4px' }} />
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function FormsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  const [forms, setForms] = useState<FormDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | FormStatus>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFormName, setNewFormName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('blank');
  const [creating, setCreating] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  // Fetch forms
  const fetchForms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/workspace/${orgId}/forms?workspaceId=default`);

      if (!response.ok) {
        throw new Error('Failed to fetch forms');
      }

      const data = await response.json();
      setForms(data.forms || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forms');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  // Filter forms
  const filteredForms = forms.filter((form) => {
    if (activeFilter === 'all') return true;
    return form.status === activeFilter;
  });

  // Handle create form
  const handleCreateForm = async () => {
    if (!newFormName.trim()) return;

    try {
      setCreating(true);

      const response = await fetch(`/api/workspace/${orgId}/forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'default',
          name: newFormName,
          templateId: selectedTemplate,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create form');
      }

      const data = await response.json();
      router.push(`/workspace/${orgId}/forms/${data.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create form');
      setCreating(false);
    }
  };

  // Get status badge style
  const getStatusBadgeStyle = (status: FormStatus) => {
    switch (status) {
      case 'published':
        return { ...styles.statusBadge, ...styles.statusPublished };
      case 'archived':
        return { ...styles.statusBadge, ...styles.statusArchived };
      default:
        return { ...styles.statusBadge, ...styles.statusDraft };
    }
  };

  // Format date
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Forms</h1>
          <p style={styles.subtitle}>
            Create and manage forms to capture leads and collect data
          </p>
        </div>
        <button
          style={styles.createButton}
          onClick={() => setShowCreateModal(true)}
        >
          <span>+</span>
          <span>Create New Form</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={styles.tabs}>
        {(['all', 'draft', 'published', 'archived'] as const).map((filter) => (
          <button
            key={filter}
            style={{
              ...styles.tab,
              ...(activeFilter === filter ? styles.tabActive : {}),
            }}
            onClick={() => setActiveFilter(filter)}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
            {filter === 'all' && ` (${forms.length})`}
            {filter !== 'all' && ` (${forms.filter((f) => f.status === filter).length})`}
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '0.5rem',
            color: '#ef4444',
            marginBottom: '1.5rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={styles.grid}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <FormCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredForms.length === 0 && (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📝</div>
          <div style={styles.emptyTitle}>
            {activeFilter === 'all' ? 'No forms yet' : `No ${activeFilter} forms`}
          </div>
          <div style={styles.emptyText}>
            {activeFilter === 'all'
              ? 'Create your first form to start capturing leads and collecting data.'
              : `You don't have any ${activeFilter} forms.`}
          </div>
          {activeFilter === 'all' && (
            <button
              style={styles.createButton}
              onClick={() => setShowCreateModal(true)}
            >
              + Create New Form
            </button>
          )}
        </div>
      )}

      {/* Forms Grid */}
      {!loading && filteredForms.length > 0 && (
        <div style={styles.grid}>
          {filteredForms.map((form) => (
            <div
              key={form.id}
              style={{
                ...styles.card,
                ...(hoveredCard === form.id ? styles.cardHover : {}),
              }}
              onMouseEnter={() => setHoveredCard(form.id)}
              onMouseLeave={() => setHoveredCard(null)}
              onClick={() => router.push(`/workspace/${orgId}/forms/${form.id}/edit`)}
            >
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>
                  <span>📋</span>
                  {form.name}
                </h3>
                <p style={styles.cardDescription}>
                  {form.description || 'No description'}
                </p>
              </div>

              <div style={styles.cardBody}>
                <div style={styles.statsGrid}>
                  <div style={styles.stat}>
                    <div style={styles.statValue}>{form.submissionCount || 0}</div>
                    <div style={styles.statLabel}>Submissions</div>
                  </div>
                  <div style={styles.stat}>
                    <div style={styles.statValue}>{form.viewCount || 0}</div>
                    <div style={styles.statLabel}>Views</div>
                  </div>
                  <div style={styles.stat}>
                    <div style={styles.statValue}>
                      {form.viewCount > 0
                        ? `${Math.round((form.submissionCount / form.viewCount) * 100)}%`
                        : '0%'}
                    </div>
                    <div style={styles.statLabel}>Conversion</div>
                  </div>
                </div>
              </div>

              <div style={styles.cardFooter}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={getStatusBadgeStyle(form.status)}>
                    {form.status.charAt(0).toUpperCase() + form.status.slice(1)}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#666' }}>
                    Updated {formatDate(form.updatedAt)}
                  </span>
                </div>
                <div style={styles.actions}>
                  <Link
                    href={`/workspace/${orgId}/forms/${form.id}/edit`}
                    style={styles.actionButton}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Edit
                  </Link>
                  {form.status === 'published' && (
                    <Link
                      href={`/forms/${form.id}`}
                      target="_blank"
                      style={styles.actionButton}
                      onClick={(e) => e.stopPropagation()}
                    >
                      View
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Form Modal */}
      {showCreateModal && (
        <div style={styles.modal} onClick={() => setShowCreateModal(false)}>
          <div
            style={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Create New Form</h2>
              <button
                style={styles.modalClose}
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              {/* Form Name */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Form Name</label>
                <input
                  type="text"
                  value={newFormName}
                  onChange={(e) => setNewFormName(e.target.value)}
                  placeholder="Enter form name..."
                  style={styles.input}
                  autoFocus
                />
              </div>

              {/* Template Selection */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Choose a Template</label>
                <div style={styles.templateGrid}>
                  {FORM_TEMPLATES.map((template) => (
                    <div
                      key={template.id}
                      style={{
                        ...styles.templateCard,
                        ...(selectedTemplate === template.id
                          ? styles.templateCardSelected
                          : {}),
                      }}
                      onClick={() => setSelectedTemplate(template.id)}
                    >
                      <div style={styles.templateIcon}>{template.icon}</div>
                      <div style={styles.templateName}>{template.name}</div>
                      <div style={styles.templateDescription}>
                        {template.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                style={styles.cancelButton}
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button
                style={{
                  ...styles.submitButton,
                  opacity: !newFormName.trim() || creating ? 0.5 : 1,
                  cursor: !newFormName.trim() || creating ? 'not-allowed' : 'pointer',
                }}
                onClick={handleCreateForm}
                disabled={!newFormName.trim() || creating}
              >
                {creating ? 'Creating...' : 'Create Form'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
