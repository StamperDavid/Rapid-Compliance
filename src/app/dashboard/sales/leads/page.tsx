"use client";

import React from "react";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { Target, Users, TrendingUp, Filter } from "lucide-react";

/**
 * Sales Leads Page
 * Displays and manages sales leads with role-based filtering
 */
export default function LeadsPage(): React.ReactElement {
  const { user, permissions } = useUnifiedAuth();

  const canManageLeads = permissions?.canManageLeads ?? false;
  const canViewAllRecords = permissions?.canViewAllRecords ?? false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Sales Leads
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            {canViewAllRecords
              ? "Manage all team leads"
              : "View and manage your assigned leads"}
          </p>
        </div>
        {canManageLeads && (
          <button
            type="button"
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            Add Lead
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Total Leads</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">42</p>
            </div>
          </div>
        </div>
        <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-success)]/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-[var(--color-success)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Qualified</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">18</p>
            </div>
          </div>
        </div>
        <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-warning)]/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[var(--color-warning)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Conversion Rate</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">24%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg hover:bg-[var(--color-bg-paper)] transition-colors flex items-center gap-2"
        >
          <Filter className="w-4 h-4" />
          Filter
        </button>
      </div>

      {/* Placeholder Content */}
      <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-8 text-center">
        <Target className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-disabled)]" />
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          Leads Management
        </h3>
        <p className="text-[var(--color-text-secondary)] mb-4">
          This page will display your sales leads with full CRM integration.
        </p>
        <div className="text-sm text-[var(--color-text-disabled)]">
          <p>Role: {user?.role}</p>
          <p>Tenant: {user?.tenantId ?? "Platform"}</p>
          <p>Permissions: {canManageLeads ? "Can manage leads" : "Read-only"}</p>
        </div>
      </div>
    </div>
  );
}
