"use client";

/**
 * AI Specialists Admin Page
 *
 * Displays the complete registry of all 27 AI specialists across 9 categories.
 * Provides filtering, search, and detailed specialist views.
 *
 * Features:
 * - Complete specialist registry (27 specialists)
 * - Category-based filtering (9 categories)
 * - Status filtering (GHOST, UNBUILT, SHELL, FUNCTIONAL, TESTED)
 * - Real-time search across names, descriptions, and capabilities
 * - Responsive grid layout with category grouping
 *
 * Route: /admin/specialists
 */

import { useState, useEffect } from "react";
import SpecialistRegistry from "@/components/admin/SpecialistRegistry";

export default function SpecialistsPage() {
  const [organizationId, setOrganizationId] = useState<string>("platform_admin");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize page and set organization context
    const initializePage = () => {
      try {
        // For now, using platform_admin as default
        // TODO: Fetch organization ID from user session/auth context
        setOrganizationId("platform_admin");
      } catch (error) {
        console.error("Error initializing Specialists page:", error);
      } finally {
        setLoading(false);
      }
    };

    initializePage();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-primary,#ffffff)]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[var(--color-primary,#3b82f6)] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-[var(--color-text-secondary,#6b7280)]">
            Loading AI Specialists...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary,#ffffff)]">
      {/* Page Header */}
      <header className="border-b border-[var(--color-border,#e5e7eb)] bg-[var(--color-bg-secondary,#f9fafb)]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-text-primary,#111827)]">
                AI Specialists
              </h1>
              <p className="mt-2 text-base text-[var(--color-text-secondary,#6b7280)]">
                Complete registry of all 27 AI specialists across 9 categories
              </p>
            </div>
            <div className="hidden rounded-lg bg-[var(--color-bg-info,#eff6ff)] px-4 py-2 sm:block">
              <p className="text-sm font-medium text-[var(--color-text-primary,#111827)]">
                Organization
              </p>
              <p className="font-mono text-xs text-[var(--color-primary,#3b82f6)]">
                {organizationId}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <SpecialistRegistry organizationId={organizationId} />
      </main>
    </div>
  );
}
