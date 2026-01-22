"use client";

import React from "react";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { Settings, Building2, Users, Key, Zap, DollarSign } from "lucide-react";

/**
 * Settings Page
 * Displays organization and system settings
 */
export default function SettingsPage(): React.ReactElement {
  const { user, permissions } = useUnifiedAuth();

  const canAccessSettings = permissions?.canAccessSettings ?? false;

  if (!canAccessSettings) {
    return (
      <div className="text-center py-12">
        <Settings className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-disabled)]" />
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
          Access Restricted
        </h2>
        <p className="text-[var(--color-text-secondary)]">
          You don&apos;t have permission to access settings.
        </p>
        <p className="text-sm text-[var(--color-text-disabled)] mt-2">
          This feature is only available to Owner and Admin roles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Settings
        </h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          Manage your organization settings and preferences
        </p>
      </div>

      {/* Settings Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SettingCard
          icon={<Building2 className="w-6 h-6" />}
          title="Organization"
          description="Manage organization details and branding"
          enabled={permissions?.canManageOrganization ?? false}
        />
        <SettingCard
          icon={<Users className="w-6 h-6" />}
          title="Team"
          description="Manage team members and roles"
          enabled={permissions?.canInviteUsers ?? false}
        />
        <SettingCard
          icon={<Key className="w-6 h-6" />}
          title="API Keys"
          description="Manage API keys and integrations"
          enabled={permissions?.canManageAPIKeys ?? false}
        />
        <SettingCard
          icon={<Zap className="w-6 h-6" />}
          title="Integrations"
          description="Connect third-party services"
          enabled={permissions?.canManageIntegrations ?? false}
        />
        <SettingCard
          icon={<DollarSign className="w-6 h-6" />}
          title="Billing"
          description="Manage subscription and billing"
          enabled={permissions?.canManageBilling ?? false}
        />
        <SettingCard
          icon={<Settings className="w-6 h-6" />}
          title="General"
          description="General application preferences"
          enabled={true}
        />
      </div>

      {/* Placeholder Content */}
      <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-8 text-center">
        <Settings className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-disabled)]" />
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          Settings Dashboard
        </h3>
        <p className="text-[var(--color-text-secondary)] mb-4">
          This page will display comprehensive organization and user settings.
        </p>
        <div className="text-sm text-[var(--color-text-disabled)]">
          <p>Role: {user?.role}</p>
          <p>Tenant: {user?.tenantId ?? "Platform"}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Setting Card Component
 */
function SettingCard({
  icon,
  title,
  description,
  enabled,
}: {
  icon: React.ReactElement;
  title: string;
  description: string;
  enabled: boolean;
}): React.ReactElement {
  return (
    <button
      type="button"
      disabled={!enabled}
      className={`flex items-start gap-4 p-4 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] text-left transition-colors ${
        enabled
          ? "hover:border-[var(--color-primary)] cursor-pointer"
          : "opacity-50 cursor-not-allowed"
      }`}
    >
      <div className="w-12 h-12 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0 text-[var(--color-primary)]">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">
          {title}
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>
        {!enabled && (
          <p className="text-xs text-[var(--color-error)] mt-1">No permission</p>
        )}
      </div>
    </button>
  );
}
