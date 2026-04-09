'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import {
  Link2,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Plus,
  Trash2,
  RefreshCw,
  Copy,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface CustomDomain {
  id: string;
  verified: boolean;
  verificationMethod: 'cname' | 'a-record' | 'txt';
  verificationValue: string;
  verifiedAt?: string;
  sslEnabled: boolean;
  sslStatus: 'pending' | 'active' | 'failed';
  sslIssuedAt?: string;
  sslExpiresAt?: string;
  dnsRecords: Array<{
    type: string;
    name: string;
    value: string;
    status: string;
  }>;
  status: 'pending' | 'active' | 'failed' | 'suspended';
  createdAt: string;
  lastCheckedAt: string;
}

interface DomainsResponse {
  domains: CustomDomain[];
}

interface AddDomainResponse {
  domain: CustomDomain;
  error?: string;
}

interface VerifyDomainResponse {
  verified: boolean;
  error?: string;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: typeof CheckCircle; label: string }> = {
  active: { color: 'text-success', bg: 'bg-success/10', icon: CheckCircle, label: 'Active' },
  pending: { color: 'text-warning', bg: 'bg-warning/10', icon: Clock, label: 'Pending Verification' },
  failed: { color: 'text-error', bg: 'bg-error/10', icon: XCircle, label: 'Failed' },
  suspended: { color: 'text-muted-foreground', bg: 'bg-surface-elevated', icon: AlertCircle, label: 'Suspended' },
};

const SSL_CONFIG: Record<string, { color: string; label: string }> = {
  active: { color: 'text-success', label: 'SSL Active' },
  pending: { color: 'text-warning', label: 'SSL Pending' },
  failed: { color: 'text-error', label: 'SSL Failed' },
};

export default function CustomDomainsPage() {
  const authFetch = useAuthFetch();
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadDomains = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authFetch('/api/website/domains');
      if (!response.ok) { throw new Error('Failed to load domains'); }
      const data = await response.json() as DomainsResponse;
      setDomains(data.domains ?? []);
    } catch (err: unknown) {
      logger.error('[Domains] Error loading', err instanceof Error ? err : new Error(String(err)));
      setNotification({ message: err instanceof Error ? err.message : 'Failed to load domains', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadDomains();
  }, [loadDomains]);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) { return; }

    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    if (!domainRegex.test(newDomain)) {
      setNotification({ message: 'Please enter a valid domain (e.g., example.com)', type: 'error' });
      return;
    }

    try {
      setAdding(true);
      const response = await authFetch('/api/website/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain.toLowerCase().trim() }),
      });

      if (!response.ok) {
        const data = await response.json() as AddDomainResponse;
        throw new Error((data.error !== '' && data.error != null) ? data.error : 'Failed to add domain');
      }

      setNewDomain('');
      setShowAddModal(false);
      setNotification({ message: 'Domain added! Configure DNS records below.', type: 'success' });
      void loadDomains();
    } catch (err: unknown) {
      logger.error('[Domains] Error adding', err instanceof Error ? err : new Error(String(err)));
      setNotification({ message: err instanceof Error ? err.message : 'Failed to add domain', type: 'error' });
    } finally {
      setAdding(false);
    }
  };

  const handleVerify = async (domainId: string) => {
    try {
      const response = await authFetch(`/api/website/domains/${domainId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json() as VerifyDomainResponse;
        throw new Error((data.error !== '' && data.error != null) ? data.error : 'Verification failed');
      }

      const data = await response.json() as VerifyDomainResponse;
      if (data.verified) {
        setNotification({ message: 'Domain verified!', type: 'success' });
      } else {
        setNotification({ message: 'Not yet verified — check DNS records and try again', type: 'error' });
      }
      void loadDomains();
    } catch (err: unknown) {
      logger.error('[Domains] Error verifying', err instanceof Error ? err : new Error(String(err)));
      setNotification({ message: err instanceof Error ? err.message : 'Verification failed', type: 'error' });
    }
  };

  const handleRemove = async (domainId: string) => {
    try {
      const response = await authFetch(`/api/website/domains/${domainId}`, { method: 'DELETE' });
      if (!response.ok) { throw new Error('Failed to remove domain'); }
      setDomains(prev => prev.filter(d => d.id !== domainId));
      setNotification({ message: 'Domain removed', type: 'success' });
    } catch (err: unknown) {
      logger.error('[Domains] Error removing', err instanceof Error ? err : new Error(String(err)));
      setNotification({ message: err instanceof Error ? err.message : 'Failed to remove domain', type: 'error' });
    }
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    setNotification({ message: 'Copied to clipboard', type: 'success' });
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-surface-elevated rounded" />
          <div className="h-4 w-72 bg-surface-elevated rounded" />
          <div className="space-y-4 mt-6">
            {[1, 2].map(i => <div key={i} className="h-40 bg-surface-elevated rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <PageTitle>Custom Domains</PageTitle>
          <SectionDescription className="mt-1">Connect your own domain to your website</SectionDescription>
        </div>
        <Button onClick={() => setShowAddModal(true)} variant="default">
          <Plus size={16} className="mr-1" /> Add Domain
        </Button>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`p-3 rounded-lg text-sm border flex items-center justify-between ${
          notification.type === 'success' ? 'bg-success/10 border-success/30 text-success' : 'bg-error/10 border-error/30 text-error'
        }`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2 opacity-60 hover:opacity-100">&times;</button>
        </div>
      )}

      {/* Empty State */}
      {domains.length === 0 && (
        <div className="text-center py-16 bg-card border border-border-strong rounded-2xl">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Link2 size={32} className="text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No custom domains yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Add a custom domain to use your own branded URL</p>
          <Button onClick={() => setShowAddModal(true)} variant="default">
            <Plus size={16} className="mr-1" /> Add Your First Domain
          </Button>
        </div>
      )}

      {/* Domain Cards */}
      <div className="space-y-4">
        {domains.map(domain => (
          <DomainCard
            key={domain.id}
            domain={domain}
            onVerify={(id) => void handleVerify(id)}
            onRemove={(id) => setConfirmDelete(id)}
            onCopy={copyToClipboard}
          />
        ))}
      </div>

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border-strong rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-semibold text-foreground mb-2">Remove Domain</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Remove &ldquo;{confirmDelete}&rdquo;? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setConfirmDelete(null)} variant="ghost">Cancel</Button>
              <Button
                onClick={() => { void handleRemove(confirmDelete); setConfirmDelete(null); }}
                variant="destructive"
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Domain Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border-strong rounded-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Add Custom Domain</h2>
              <button onClick={() => { setShowAddModal(false); setNewDomain(''); }} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={(e) => void handleAddDomain(e)}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-1">Domain Name</label>
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="example.com or www.example.com"
                  className="w-full px-3 py-2 bg-background border border-border-strong rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  disabled={adding}
                />
                <p className="text-xs text-muted-foreground mt-1">Enter the full domain including subdomain</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" onClick={() => { setShowAddModal(false); setNewDomain(''); }} variant="ghost" disabled={adding}>
                  Cancel
                </Button>
                <Button type="submit" disabled={adding || !newDomain.trim()} variant="default">
                  {adding ? 'Adding...' : 'Add Domain'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function DomainCard({ domain, onVerify, onRemove, onCopy }: {
  domain: CustomDomain;
  onVerify: (id: string) => void;
  onRemove: (id: string) => void;
  onCopy: (text: string) => void;
}) {
  const [showDNS, setShowDNS] = useState(!domain.verified);

  const statusCfg = STATUS_CONFIG[domain.verified ? 'active' : domain.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;
  const sslCfg = SSL_CONFIG[domain.sslStatus] ?? SSL_CONFIG.pending;

  return (
    <div className="bg-card border border-border-strong rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Link2 size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{domain.id}</h3>
            <div className="flex items-center gap-3 mt-0.5">
              <span className={`text-xs flex items-center gap-1 px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
                <StatusIcon size={12} /> {statusCfg.label}
              </span>
              {domain.verified && (
                <span className={`text-xs flex items-center gap-1 ${sslCfg.color}`}>
                  <Shield size={12} /> {sslCfg.label}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!domain.verified && (
            <Button onClick={() => onVerify(domain.id)} variant="default" size="sm">
              <RefreshCw size={14} className="mr-1" /> Verify DNS
            </Button>
          )}
          <Button onClick={() => setShowDNS(prev => !prev)} variant="outline" size="sm">
            {showDNS ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span className="ml-1">{showDNS ? 'Hide' : 'Show'} DNS</span>
          </Button>
          <Button onClick={() => onRemove(domain.id)} variant="destructive" size="sm">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* SSL Details */}
      {domain.verified && (domain.sslIssuedAt ?? domain.sslExpiresAt) && (
        <div className="flex gap-6 mb-4 text-xs text-muted-foreground">
          {domain.sslIssuedAt && <span>SSL Issued: {new Date(domain.sslIssuedAt).toLocaleDateString()}</span>}
          {domain.sslExpiresAt && <span>SSL Expires: {new Date(domain.sslExpiresAt).toLocaleDateString()}</span>}
        </div>
      )}

      {/* DNS Records */}
      {showDNS && domain.dnsRecords.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            Add these records to your DNS provider
          </p>
          <div className="space-y-2">
            {domain.dnsRecords.map((record, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-surface-elevated rounded-lg p-3 text-sm">
                <span className="text-xs font-mono bg-background px-2 py-0.5 rounded text-muted-foreground min-w-[50px] text-center">
                  {record.type}
                </span>
                <span className="text-foreground font-mono text-xs flex-1 truncate">{record.name}</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-foreground font-mono text-xs flex-1 truncate">{record.value}</span>
                <button
                  onClick={() => onCopy(record.value)}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <Copy size={14} />
                </button>
                <span className={`text-xs shrink-0 ${
                  record.status === 'verified' ? 'text-success' : record.status === 'failed' ? 'text-error' : 'text-warning'
                }`}>
                  {record.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
