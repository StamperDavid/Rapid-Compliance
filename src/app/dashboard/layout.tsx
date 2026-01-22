"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import UnifiedSidebar from "@/components/dashboard/UnifiedSidebar";
import { logger } from "@/lib/logger/logger";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * Unified Dashboard Layout
 * Replaces both /admin layout and /workspace/[orgId] layout
 * Uses UnifiedSidebar and role-based filtering
 */
export default function DashboardLayout({ children }: DashboardLayoutProps): React.ReactElement {
  const router = useRouter();
  const { user, loading, permissions } = useUnifiedAuth();

  // Loading state - show spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-base)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--color-text-secondary)]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!user) {
    logger.info("Unauthenticated user redirected to login", {
      file: "dashboard/layout.tsx",
    });
    router.push("/login");
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-base)]">
        <p className="text-[var(--color-text-secondary)]">Redirecting to login...</p>
      </div>
    );
  }

  // Suspended account
  if (user.status === "suspended") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-base)]">
        <div className="max-w-md p-8 bg-[var(--color-bg-paper)] rounded-lg border border-[var(--color-border-light)] text-center">
          <h1 className="text-2xl font-bold text-[var(--color-error)] mb-4">
            Account Suspended
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            Your account has been suspended. Please contact support for assistance.
          </p>
        </div>
      </div>
    );
  }

  // Get organization ID for context
  // Platform admin may have null tenantId (platform-level view)
  // All other roles must have a tenantId
  const organizationId = user.tenantId ?? undefined;

  logger.info("Dashboard layout rendered", {
    userId: user.id,
    role: user.role,
    tenantId: user.tenantId ?? "platform-level",
    file: "dashboard/layout.tsx",
  });

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)]">
      {/* Unified Sidebar - role determines visibility */}
      <UnifiedSidebar
        user={user}
        organizationId={organizationId}
        brandName="AI Sales Platform"
        primaryColor="#6366f1"
      />

      {/* Main Content Area */}
      <main className="md:ml-[280px] min-h-screen p-6">
        {/* Optional: Top bar with user context */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Dashboard
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {user.role === "platform_admin" && !user.tenantId
                ? "Platform Administration"
                : `${user.displayName} - ${user.role}`}
            </p>
          </div>

          {/* Optional: Quick stats or notifications */}
          <div className="flex items-center gap-4">
            {permissions?.canViewSystemHealth && (
              <div className="px-3 py-1 bg-[var(--color-success)]/10 text-[var(--color-success)] rounded-md text-sm font-medium">
                System Healthy
              </div>
            )}
          </div>
        </div>

        {/* Page Content */}
        <div className="bg-[var(--color-bg-paper)] rounded-lg border border-[var(--color-border-light)] p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
