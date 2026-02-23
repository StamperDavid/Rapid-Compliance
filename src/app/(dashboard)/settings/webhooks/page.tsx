'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useAuthFetch } from '@/hooks/useAuthFetch';

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  secret?: string;
  lastTriggered?: string;
  lastStatus?: number;
  createdAt: string;
}

interface WebhooksResponse {
  success: boolean;
  webhooks?: Webhook[];
  error?: string;
}

interface WebhookMutationResponse {
  success: boolean;
  error?: string;
}

const AVAILABLE_EVENTS = [
  { group: 'Contacts', events: ['contact.created', 'contact.updated', 'contact.deleted'] },
  { group: 'Deals', events: ['deal.created', 'deal.updated', 'deal.stage_changed', 'deal.won', 'deal.lost'] },
  { group: 'Leads', events: ['lead.created', 'lead.updated', 'lead.status_changed', 'lead.scored'] },
  { group: 'Tasks', events: ['task.created', 'task.completed', 'task.assigned'] },
  { group: 'Orders', events: ['order.created', 'order.updated', 'order.fulfilled'] },
];

export default function WebhooksPage() {
  const { user } = useAuth();
  const toast = useToast();
  const authFetch = useAuthFetch();

  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [formSecret, setFormSecret] = useState('');

  const loadWebhooks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/settings/webhooks');
      if (res.ok) {
        const data = (await res.json()) as WebhooksResponse;
        if (data.success && data.webhooks) {
          setWebhooks(data.webhooks);
        }
      }
    } catch {
      toast.error('Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }, [toast, authFetch]);

  useEffect(() => {
    if (user) {
      void loadWebhooks();
    }
  }, [user, loadWebhooks]);

  const resetForm = () => {
    setFormName('');
    setFormUrl('');
    setFormEvents([]);
    setFormSecret('');
  };

  const openCreateModal = () => {
    resetForm();
    setEditingWebhook(null);
    setShowCreateModal(true);
  };

  const openEditModal = (webhook: Webhook) => {
    setFormName(webhook.name);
    setFormUrl(webhook.url);
    setFormEvents([...webhook.events]);
    setFormSecret(webhook.secret ?? '');
    setEditingWebhook(webhook);
    setShowCreateModal(true);
  };

  const toggleEvent = (event: string) => {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const handleSave = async () => {
    if (!formName.trim() || !formUrl.trim() || formEvents.length === 0) {
      toast.error('Name, URL, and at least one event are required');
      return;
    }

    try {
      if (editingWebhook) {
        const res = await authFetch('/api/settings/webhooks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webhookId: editingWebhook.id,
            name: formName,
            url: formUrl,
            events: formEvents,
            secret: formSecret || undefined,
          }),
        });
        const data = (await res.json()) as WebhookMutationResponse;
        if (data.success) {
          toast.success('Webhook updated');
        } else {
          toast.error(data.error ?? 'Failed to update');
          return;
        }
      } else {
        const res = await authFetch('/api/settings/webhooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            url: formUrl,
            events: formEvents,
            secret: formSecret || undefined,
          }),
        });
        const data = (await res.json()) as WebhookMutationResponse;
        if (data.success) {
          toast.success('Webhook created');
        } else {
          toast.error(data.error ?? 'Failed to create');
          return;
        }
      }

      setShowCreateModal(false);
      resetForm();
      await loadWebhooks();
    } catch {
      toast.error('Failed to save webhook');
    }
  };

  const handleDelete = async (webhookId: string) => {
    try {
      const res = await authFetch(`/api/settings/webhooks?webhookId=${webhookId}`, {
        method: 'DELETE',
      });
      const data = (await res.json()) as WebhookMutationResponse;
      if (data.success) {
        toast.success('Webhook deleted');
        setDeleteConfirm(null);
        await loadWebhooks();
      } else {
        toast.error(data.error ?? 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete webhook');
    }
  };

  const handleToggleActive = async (webhook: Webhook) => {
    try {
      await authFetch('/api/settings/webhooks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookId: webhook.id,
          active: !webhook.active,
        }),
      });
      await loadWebhooks();
    } catch {
      toast.error('Failed to toggle webhook');
    }
  };

  const handleTest = async (webhook: Webhook) => {
    setTestingId(webhook.id);
    try {
      // Send a test payload to the webhook URL
      await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'webhook.test',
          timestamp: new Date().toISOString(),
          data: { message: 'This is a test webhook from SalesVelocity.ai' },
        }),
        mode: 'no-cors',
      });
      toast.success('Test webhook sent');
    } catch {
      toast.error('Test failed - endpoint may be unreachable');
    } finally {
      setTestingId(null);
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) {
      return 'Never';
    }
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours < 1) {
        return 'Just now';
      }
      if (diffHours < 24) {
        return `${diffHours}h ago`;
      }
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) {
        return `${diffDays}d ago`;
      }
      return d.toLocaleDateString();
    } catch {
      return 'Never';
    }
  };

  return (
    <div className="min-h-screen bg-surface-main p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/settings"
            className="inline-flex items-center gap-1 text-primary text-sm font-medium mb-4 hover:underline"
          >
            &larr; Back to Settings
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">Webhooks</h1>
              <p className="text-[var(--color-text-secondary)] text-sm">
                Configure webhooks for real-time event notifications
              </p>
            </div>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-primary text-white font-semibold rounded-xl hover:bg-primary-light transition-all text-sm"
            >
              + Create Webhook
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="rounded-2xl bg-surface-paper border border-primary/30 p-5 mb-6">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
            <span>🔗</span> What are Webhooks?
          </h3>
          <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
            Webhooks send real-time HTTP POST notifications to external systems when events occur in your CRM.
            For example, notify Slack when a deal is won, or sync new contacts to your email platform.
          </p>
        </div>

        {/* Webhooks List */}
        {loading ? (
          <div className="text-center py-12 text-[var(--color-text-secondary)]">Loading webhooks...</div>
        ) : webhooks.length === 0 ? (
          <div className="rounded-2xl bg-surface-paper border border-border-light p-12 text-center">
            <div className="text-4xl mb-3">🔗</div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">No Webhooks Configured</h3>
            <p className="text-[var(--color-text-secondary)] text-sm mb-4">
              Create your first webhook to start receiving real-time event notifications.
            </p>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-primary text-white font-semibold rounded-xl hover:bg-primary-light transition-all text-sm"
            >
              + Create Webhook
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className="rounded-2xl bg-surface-paper border border-border-light p-5"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-bold text-[var(--color-text-primary)] truncate">{webhook.name}</h3>
                      <button
                        onClick={() => void handleToggleActive(webhook)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                          webhook.active
                            ? 'bg-success/20 text-success border border-success/30 hover:bg-success/30'
                            : 'bg-surface-elevated text-[var(--color-text-disabled)] border border-border-light hover:bg-surface-main'
                        }`}
                      >
                        {webhook.active ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                    <code className="text-xs text-[var(--color-text-secondary)] font-mono block truncate">{webhook.url}</code>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    <button
                      onClick={() => void handleTest(webhook)}
                      disabled={testingId === webhook.id}
                      className="px-2.5 py-1 text-xs bg-surface-elevated border border-border-light rounded-lg hover:bg-surface-main transition-all disabled:opacity-50"
                    >
                      {testingId === webhook.id ? 'Sending...' : 'Test'}
                    </button>
                    <button
                      onClick={() => openEditModal(webhook)}
                      className="px-2.5 py-1 text-xs bg-surface-elevated border border-border-light rounded-lg hover:bg-surface-main transition-all"
                    >
                      Edit
                    </button>
                    {deleteConfirm === webhook.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => void handleDelete(webhook.id)}
                          className="px-2 py-1 text-[10px] font-semibold bg-error text-white rounded"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-2 py-1 text-[10px] text-[var(--color-text-secondary)]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(webhook.id)}
                        className="px-2.5 py-1 text-xs bg-error/10 text-error border border-error/20 rounded-lg hover:bg-error/20 transition-all"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {webhook.events.map((event) => (
                    <span
                      key={event}
                      className="px-2 py-0.5 bg-surface-elevated border border-border-light rounded text-[10px] font-mono text-[var(--color-text-secondary)]"
                    >
                      {event}
                    </span>
                  ))}
                </div>
                <div className="text-[10px] text-[var(--color-text-disabled)]">
                  Last triggered: {formatDate(webhook.lastTriggered)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Available Events Reference */}
        <div className="rounded-2xl bg-surface-paper border border-border-light p-6 mt-6">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">Available Events</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {AVAILABLE_EVENTS.map((group) => (
              <div key={group.group}>
                <h3 className="text-xs font-semibold text-[var(--color-text-primary)] mb-2">{group.group}</h3>
                <div className="space-y-1">
                  {group.events.map((event) => (
                    <code key={event} className="block text-[10px] text-[var(--color-text-secondary)] font-mono px-2 py-1 bg-surface-elevated rounded">
                      {event}
                    </code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface-paper border border-border-light rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
              {editingWebhook ? 'Edit Webhook' : 'Create Webhook'}
            </h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Name</label>
                <input
                  type="text"
                  placeholder="My Webhook"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Endpoint URL</label>
                <input
                  type="url"
                  placeholder="https://your-api.com/webhook"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Secret (optional)</label>
                <input
                  type="text"
                  placeholder="Signing secret for payload verification"
                  value={formSecret}
                  onChange={(e) => setFormSecret(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Events</label>
                <div className="bg-surface-elevated border border-border-light rounded-lg p-3 max-h-48 overflow-y-auto">
                  {AVAILABLE_EVENTS.map((group) => (
                    <div key={group.group} className="mb-3 last:mb-0">
                      <div className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">{group.group}</div>
                      {group.events.map((event) => (
                        <label key={event} className="flex items-center gap-2 py-1 cursor-pointer text-sm text-[var(--color-text-primary)]">
                          <input
                            type="checkbox"
                            checked={formEvents.includes(event)}
                            onChange={() => toggleEvent(event)}
                            className="cursor-pointer"
                          />
                          <code className="text-xs font-mono">{event}</code>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={!formName.trim() || !formUrl.trim() || formEvents.length === 0}
                className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-light transition-all disabled:opacity-50"
              >
                {editingWebhook ? 'Save Changes' : 'Create Webhook'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
