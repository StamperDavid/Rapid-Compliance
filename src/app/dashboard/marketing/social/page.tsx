"use client";

import React from "react";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { Share2, Calendar, TrendingUp } from "lucide-react";

/**
 * Social Media Marketing Page
 * Displays social media management and scheduling
 */
export default function SocialMediaPage(): React.ReactElement {
  const { user, permissions } = useUnifiedAuth();

  const canManageSocialMedia = permissions?.canManageSocialMedia ?? false;

  if (!canManageSocialMedia) {
    return (
      <div className="text-center py-12">
        <Share2 className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-disabled)]" />
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
          Access Restricted
        </h2>
        <p className="text-[var(--color-text-secondary)]">
          You don&apos;t have permission to access social media management.
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
            Social Media Management
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            Schedule and manage your social media content
          </p>
        </div>
        <button
          type="button"
          className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          Create Post
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Scheduled Posts</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">12</p>
            </div>
          </div>
        </div>
        <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-success)]/10 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-[var(--color-success)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Published</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">48</p>
            </div>
          </div>
        </div>
        <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-warning)]/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[var(--color-warning)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Engagement Rate</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">4.2%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Placeholder Content */}
      <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-8 text-center">
        <Share2 className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-disabled)]" />
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          Social Media Dashboard
        </h3>
        <p className="text-[var(--color-text-secondary)] mb-4">
          This page will display your social media calendar and analytics.
        </p>
        <div className="text-sm text-[var(--color-text-disabled)]">
          <p>Role: {user?.role}</p>
          <p>Tenant: {user?.tenantId ?? "Platform"}</p>
        </div>
      </div>
    </div>
  );
}
