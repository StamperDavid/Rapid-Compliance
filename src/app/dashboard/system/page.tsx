"use client";

import React from "react";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { usePlatformOrganizations } from "@/hooks/useUnifiedData";
import {
  Activity,
  Building2,
  Users,
  Flag,
  FileCode,
  Settings,
  Zap,
  AlertTriangle,
} from "lucide-react";

/**
 * System Administration Page
 * Platform admin only - displays system health and administration
 */
export default function SystemPage(): React.ReactElement {
  const { user, isPlatformAdmin } = useUnifiedAuth();
  const { data: organizations, loading } = usePlatformOrganizations();

  // Access control - platform admin only
  if (!isPlatformAdmin()) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-[var(--color-error)]" />
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
          Access Denied
        </h2>
        <p className="text-[var(--color-text-secondary)]">
          This page is only accessible to platform administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          System Administration
        </h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          Platform-wide system health and administration
        </p>
      </div>

      {/* System Health Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-success)]/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-[var(--color-success)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">System Health</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">99.9%</p>
            </div>
          </div>
        </div>
        <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Organizations</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                {loading ? "..." : organizations.length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-info)]/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-[var(--color-info)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Total Users</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                {loading
                  ? "..."
                  : organizations.reduce(
                      (sum, org) => sum + (typeof org.userCount === "number" ? org.userCount : 0),
                      0
                    )}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-warning)]/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-[var(--color-warning)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">API Requests</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">12.4K</p>
            </div>
          </div>
        </div>
      </div>

      {/* System Tools */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          System Tools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SystemToolCard
            icon={<Building2 className="w-6 h-6" />}
            title="Organizations"
            description="Manage all organizations"
            href="/admin/organizations"
          />
          <SystemToolCard
            icon={<Users className="w-6 h-6" />}
            title="All Users"
            description="View all platform users"
            href="/admin/users"
          />
          <SystemToolCard
            icon={<Flag className="w-6 h-6" />}
            title="Feature Flags"
            description="Toggle platform features"
            href="/admin/system/flags"
          />
          <SystemToolCard
            icon={<FileCode className="w-6 h-6" />}
            title="Audit Logs"
            description="View system audit logs"
            href="/admin/system/logs"
          />
          <SystemToolCard
            icon={<Settings className="w-6 h-6" />}
            title="System Settings"
            description="Configure platform settings"
            href="/admin/system/settings"
          />
          <SystemToolCard
            icon={<Activity className="w-6 h-6" />}
            title="System Health"
            description="Monitor system health"
            href="/admin/system/health"
          />
        </div>
      </div>

      {/* Placeholder Content */}
      <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-8 text-center">
        <Activity className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-disabled)]" />
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          Platform Administration
        </h3>
        <p className="text-[var(--color-text-secondary)] mb-4">
          This page will display comprehensive platform administration tools.
        </p>
        <div className="text-sm text-[var(--color-text-disabled)]">
          <p>Role: {user?.role}</p>
          <p>Platform Admin View</p>
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
