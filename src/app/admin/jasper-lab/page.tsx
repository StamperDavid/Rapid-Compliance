'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import JasperTrainingLab from '@/components/admin/JasperTrainingLab';

/**
 * Jasper Training Lab Admin Page
 *
 * This page provides a comprehensive training and configuration interface
 * for Jasper, the AI orchestrator that coordinates the 27-specialist swarm.
 *
 * Features:
 * - Persona configuration (name, tone, system prompt)
 * - Specialist Instructions (27 specialists management)
 * - Training Examples (input/output pairs for fine-tuning)
 * - Knowledge Base upload and management
 * - Test Chat interface for conversation simulation
 *
 * Route: /admin/jasper-lab
 */

export default function JasperLabPage() {
  useAdminAuth();
  const [organizationId, setOrganizationId] = useState<string>('platform_admin');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize page and fetch organization context if needed
    const initializePage = () => {
      try {
        // TODO: Fetch current admin's organization context from backend
        // For now, using default platform_admin
        setOrganizationId('platform_admin');
      } catch (error) {
        console.error('Error initializing Jasper Lab page:', error);
      } finally {
        setLoading(false);
      }
    };

    initializePage();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[var(--color-primary)] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-[var(--color-text-muted)]">Loading Jasper Training Lab...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {/* Page Header */}
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--color-primary-bg)] text-2xl">
                🧪
              </div>
              <div>
                <h1 className="text-3xl font-bold text-[var(--color-text)]">
                  Jasper Training Lab
                </h1>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Advanced training and configuration for the AI orchestrator
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <h2 className="text-sm font-semibold text-[var(--color-text)] mb-2">
                About Jasper Training Lab
              </h2>
              <div className="text-xs text-[var(--color-text-muted)] space-y-1">
                <p>
                  Jasper is the L1 orchestrator that coordinates a swarm of 27 specialist AI agents
                  across Marketing, Intelligence, Builder, Commerce, Outreach, Content, Sales, Trust, and Architect domains.
                </p>
                <p className="mt-2">
                  <strong className="text-[var(--color-primary)]">This lab allows you to:</strong>
                </p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>Configure Jasper&apos;s core persona (name, tone, base system prompt)</li>
                  <li>Customize instructions for each of the 27 specialists in the swarm</li>
                  <li>Upload training examples (input/output pairs) for fine-tuning behavior</li>
                  <li>Manage knowledge base documents (product info, sales playbooks, policies)</li>
                  <li>Test Jasper&apos;s responses in a simulated chat environment</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <JasperTrainingLab organizationId={organizationId} />
      </main>

      {/* Footer Info */}
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)] mt-12">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <div>
              <p>Organization: <span className="font-mono text-[var(--color-primary)]">{organizationId}</span></p>
            </div>
            <div className="text-right">
              <p>All changes are saved automatically</p>
              <p className="mt-1">Changes apply to the AI orchestrator in real-time</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
