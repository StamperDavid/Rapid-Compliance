"use client";

import React from "react";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { Mail, Send, Users, TrendingUp } from "lucide-react";

/**
 * Email Marketing Page
 * Displays email campaign management and analytics
 */
export default function EmailMarketingPage(): React.ReactElement {
  const { user, permissions } = useUnifiedAuth();

  const canManageEmailCampaigns = permissions?.canManageEmailCampaigns ?? false;

  if (!canManageEmailCampaigns) {
    return (
      <div className="text-center py-12">
        <Mail className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-disabled)]" />
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
          Access Restricted
        </h2>
        <p className="text-[var(--color-text-secondary)]">
          You don&apos;t have permission to access email campaign management.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Email Campaigns
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            Create and manage your email marketing campaigns
          </p>
        </div>
        <button
          type="button"
          className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          New Campaign
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
              <Send className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Sent</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">1.2K</p>
            </div>
          </div>
        </div>
        <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-success)]/10 flex items-center justify-center">
              <Mail className="w-5 h-5 text-[var(--color-success)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Open Rate</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">32%</p>
            </div>
          </div>
        </div>
        <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-info)]/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-[var(--color-info)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Click Rate</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">8.4%</p>
            </div>
          </div>
        </div>
        <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-warning)]/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[var(--color-warning)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Conversions</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">24</p>
            </div>
          </div>
        </div>
      </div>

      {/* Placeholder Content */}
      <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-8 text-center">
        <Mail className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-disabled)]" />
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          Email Campaign Manager
        </h3>
        <p className="text-[var(--color-text-secondary)] mb-4">
          This page will display your email campaigns with templates and automation.
        </p>
        <div className="text-sm text-[var(--color-text-disabled)]">
          <p>Role: {user?.role}</p>
          <p>Tenant: {user?.tenantId ?? "Platform"}</p>
        </div>
      </div>
    </div>
  );
}
