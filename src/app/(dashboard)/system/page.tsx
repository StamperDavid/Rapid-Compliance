"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Activity,
  Users,
  Flag,
  FileCode,
  Settings,
  Zap,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: Record<string, {
    status: string;
    latencyMs?: number;
    message?: string;
  }>;
}

/**
 * System Administration Page
 * Admin only - displays real system health and platform tools
 */
export default function SystemPage(): React.ReactElement {
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json() as HealthStatus;
        setHealth(data);
        setLastRefreshed(new Date());
      }
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHealth();
  }, [fetchHealth]);

  // Access control - admin only
  if (!user?.role || user.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-[var(--color-error)]" />
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
          Access Denied
        </h2>
        <p className="text-[var(--color-text-secondary)]">
          This page is only accessible to administrators.
        </p>
      </div>
    );
  }

  const healthyCount = health
    ? Object.values(health.services).filter((s) => s.status === 'healthy').length
    : 0;
  const totalServices = health ? Object.keys(health.services).length : 0;
  const healthPercent = totalServices > 0 ? Math.round((healthyCount / totalServices) * 100) : 0;

  const statusIcon = health?.status === 'healthy'
    ? <CheckCircle className="w-5 h-5 text-[var(--color-success)]" />
    : health?.status === 'degraded'
      ? <AlertCircle className="w-5 h-5 text-[var(--color-warning)]" />
      : <XCircle className="w-5 h-5 text-[var(--color-error)]" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            System Administration
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            Platform health and administration tools
          </p>
        </div>
        <button
          onClick={() => void fetchHealth()}
          disabled={healthLoading}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-[var(--color-border-light)] hover:bg-[var(--color-bg-elevated)] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${healthLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* System Health Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-success)]/10 flex items-center justify-center">
              {healthLoading ? <Activity className="w-5 h-5 text-[var(--color-text-disabled)] animate-pulse" /> : statusIcon}
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">System Health</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                {healthLoading ? '...' : `${healthPercent}%`}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Services</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                {healthLoading ? '...' : `${healthyCount}/${totalServices}`}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-info)]/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-[var(--color-info)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Status</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)] capitalize">
                {healthLoading ? '...' : (health?.status ?? 'unknown')}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-warning)]/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-[var(--color-warning)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Role</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)] capitalize">
                {user?.role ?? 'unknown'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Service Health Details */}
      {health && (
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Service Health
          </h2>
          <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] overflow-hidden">
            <div className="divide-y divide-[var(--color-border-light)]">
              {Object.entries(health.services).map(([name, svc]) => (
                <div key={name} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    {svc.status === 'healthy' ? (
                      <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                    ) : svc.status === 'degraded' ? (
                      <AlertCircle className="w-4 h-4 text-[var(--color-warning)]" />
                    ) : (
                      <XCircle className="w-4 h-4 text-[var(--color-error)]" />
                    )}
                    <span className="text-sm font-medium text-[var(--color-text-primary)] capitalize">
                      {name.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    {svc.latencyMs != null && (
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {svc.latencyMs}ms
                      </span>
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      svc.status === 'healthy'
                        ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                        : svc.status === 'degraded'
                          ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
                          : 'bg-[var(--color-error)]/10 text-[var(--color-error)]'
                    }`}>
                      {svc.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {lastRefreshed && (
            <p className="text-xs text-[var(--color-text-disabled)] mt-2">
              Last refreshed: {lastRefreshed.toLocaleTimeString()}
            </p>
          )}
        </div>
      )}

      {/* System Tools */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Administration Tools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SystemToolCard
            icon={<Settings className="w-6 h-6" />}
            title="Platform Settings"
            description="Configure platform preferences"
            href="/settings"
          />
          <SystemToolCard
            icon={<Users className="w-6 h-6" />}
            title="Team Management"
            description="Manage users and roles"
            href="/settings/team"
          />
          <SystemToolCard
            icon={<Zap className="w-6 h-6" />}
            title="API Keys"
            description="Manage service API keys"
            href="/settings/api-keys"
          />
          <SystemToolCard
            icon={<Flag className="w-6 h-6" />}
            title="Integrations"
            description="Connected services and OAuth"
            href="/settings/integrations"
          />
          <SystemToolCard
            icon={<FileCode className="w-6 h-6" />}
            title="Webhooks"
            description="Manage webhook endpoints"
            href="/settings/webhooks"
          />
          <SystemToolCard
            icon={<Activity className="w-6 h-6" />}
            title="AI Agents"
            description="Configure AI agent settings"
            href="/settings/ai-agents/training"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * System Tool Card Component
 */
function SystemToolCard({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactElement;
  title: string;
  description: string;
  href: string;
}): React.ReactElement {
  return (
    <a
      href={href}
      className="flex items-start gap-4 p-4 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] hover:border-[var(--color-primary)] transition-colors cursor-pointer"
    >
      <div className="w-12 h-12 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0 text-[var(--color-primary)]">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">
          {title}
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>
      </div>
    </a>
  );
}
