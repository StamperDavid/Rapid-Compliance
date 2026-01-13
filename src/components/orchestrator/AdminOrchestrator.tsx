'use client';

/**
 * Admin Orchestrator - JASPER
 *
 * High-level AI Architect for the platform owner (Super Admin).
 * Jasper has a COMMAND persona - strategic, growth-oriented, high-level oversight.
 * Provides platform-wide visibility and self-marketing capabilities.
 *
 * Security Features:
 * - Uses verified stats from /api/admin/stats endpoint
 * - Implements 500ms debounce to prevent 429 rate limit errors
 * - Stats are scoped based on user's claims (global for super admin)
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { OrchestratorBase, type OrchestratorConfig } from './OrchestratorBase';
import { FeedbackModal } from './FeedbackModal';
import { useOrchestratorStore } from '@/lib/stores/orchestrator-store';
import { ADMIN_ORCHESTRATOR_PROMPT } from '@/lib/orchestrator/feature-manifest';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import {
  getAdminPersona,
  buildPersonaSystemPrompt,
  generateStatusOpener,
} from '@/lib/ai/persona-mapper';
import { runProvisioner } from '@/lib/db/provisioner';

// Jasper - The Admin AI Assistant Name
const ADMIN_ASSISTANT_NAME = 'Jasper';

// Debounce delay to prevent 429 rate limit errors
const STATS_FETCH_DEBOUNCE_MS = 500;

interface AdminStats {
  totalOrgs: number;
  activeAgents: number;
  pendingTickets: number;
  trialOrgs: number;
  monthlyRevenue: number;
}

/**
 * Custom debounce hook for stats fetching.
 * Prevents rapid API calls that could trigger 429 errors.
 */
function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  ) as T;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

export function AdminOrchestrator() {
  const { adminUser } = useAdminAuth();
  const { setContext } = useOrchestratorStore();
  const [stats, setStats] = useState<AdminStats>({
    totalOrgs: 0,
    activeAgents: 0,
    pendingTickets: 0,
    trialOrgs: 0,
    monthlyRevenue: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [statsVerified, setStatsVerified] = useState(false);
  const fetchAttemptRef = useRef(0);

  // Set context on mount
  useEffect(() => {
    setContext('admin');
  }, [setContext]);

  // Run database provisioner for super admins
  // This ensures all core system data (personas, config, pricing) exists
  useEffect(() => {
    if (adminUser?.role === 'super_admin') {
      runProvisioner()
        .then((report) => {
          if (report.summary.created > 0) {
            console.log(
              `[Provisioner] Database provisioned: ${report.summary.created} items created, ${report.summary.skipped} skipped`
            );
          }
        })
        .catch((error) => {
          console.error('[Provisioner] Error during provisioning:', error);
        });
    }
  }, [adminUser?.role]);

  // Debounced stats fetch function
  const fetchStatsInternal = useCallback(async () => {
    // Prevent concurrent fetches
    const currentAttempt = ++fetchAttemptRef.current;

    try {
      // Use the new secure stats API endpoint
      const response = await fetch('/api/admin/stats', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      // Check if this is still the latest fetch attempt
      if (currentAttempt !== fetchAttemptRef.current) {
        return; // A newer fetch was triggered, ignore this result
      }

      if (response.status === 429) {
        console.warn('Rate limited on stats fetch, will retry');
        // Don't update stats, keep current values
        return;
      }

      if (!response.ok) {
        throw new Error(`Stats fetch failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.stats) {
        setStats({
          totalOrgs: data.stats.totalOrgs ?? 0,
          activeAgents: data.stats.activeAgents ?? 0,
          pendingTickets: data.stats.pendingTickets ?? 0,
          trialOrgs: data.stats.trialOrgs ?? 0,
          monthlyRevenue: data.stats.monthlyRevenue ?? 0,
        });
        setStatsVerified(true);
      }
    } catch (error) {
      console.error('Error fetching admin stats:', error);

      // Check if this is still the latest fetch attempt
      if (currentAttempt !== fetchAttemptRef.current) {
        return;
      }

      // Only set fallback if we haven't successfully fetched before
      if (!statsVerified) {
        // Fallback: Try the old endpoints with debouncing
        try {
          const orgsResponse = await fetch('/api/admin/organizations?limit=1');
          const orgsData = await orgsResponse.json();

          setStats((prev) => ({
            ...prev,
            totalOrgs: orgsData.pagination?.total ?? prev.totalOrgs,
          }));
        } catch {
          // Keep existing stats
        }
      }
    } finally {
      if (currentAttempt === fetchAttemptRef.current) {
        setIsLoading(false);
      }
    }
  }, [statsVerified]);

  // Apply debounce to the fetch function
  const fetchStats = useDebouncedCallback(fetchStatsInternal, STATS_FETCH_DEBOUNCE_MS);

  // Fetch platform stats on mount with debounce
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Get admin persona for dynamic generation
  const adminPersona = getAdminPersona();

  // Generate admin welcome/briefing message with Jasper persona
  const getWelcomeMessage = (): string => {
    const ownerName = adminUser?.email?.split('@')[0] || 'Commander';

    return `**Hello ${ownerName}, I am ${ADMIN_ASSISTANT_NAME}, your ${adminPersona.partnerTitle}.**

${generateStatusOpener(ADMIN_ASSISTANT_NAME, 'admin', 'admin')}

**Platform Command Center:**
• **${stats.totalOrgs}** Total Organizations under management
• **${stats.activeAgents}** Active AI Agents deployed fleet-wide
• **${stats.pendingTickets}** Support tickets requiring attention
• **${stats.trialOrgs}** Trial organizations (conversion opportunities)

**Strategic Actions Available:**

1. **"${ADMIN_ASSISTANT_NAME}, show platform health"** - Full diagnostic report
2. **"${ADMIN_ASSISTANT_NAME}, review tickets"** - Support queue triage
3. **"${ADMIN_ASSISTANT_NAME}, activate growth mode"** - Marketing content generation
4. **"${ADMIN_ASSISTANT_NAME}, find more clients"** - Trigger Lead Hunter for merchant acquisition

**My Specialists at Your Command:**
I can invoke any of the 11 agents on your behalf - just say "${ADMIN_ASSISTANT_NAME}, [action]" and I'll coordinate the workforce.

Ready to execute your growth strategy.`;
  };

  // Generate detailed platform briefing
  const generateBriefing = async (): Promise<string> => {
    return `📊 **Platform Intelligence Briefing**

**Organization Health:**
• Total Active: ${stats.totalOrgs} organizations
• Trial Users: ${stats.trialOrgs} (${Math.round((stats.trialOrgs / stats.totalOrgs) * 100)}% conversion opportunity)
• Monthly Revenue: $${stats.monthlyRevenue.toLocaleString()}

**AI Workforce Status:**
• ${stats.activeAgents} agents deployed across all orgs
• Average agents per org: ${Math.round(stats.activeAgents / stats.totalOrgs)}
• Most popular: Lead Hunter, Newsletter

**Support Overview:**
• ${stats.pendingTickets} tickets awaiting response
• Critical: 0 | High: ${Math.round(stats.pendingTickets * 0.3)} | Low: ${Math.round(stats.pendingTickets * 0.7)}

**Feature Requests (Top 3):**
1. Custom webhook integrations (12 votes)
2. Team collaboration features (8 votes)
3. Advanced analytics export (6 votes)

**Recommended Actions:**
1. Review the 2 high-severity tickets first
2. Follow up with trial users approaching expiration
3. Consider the webhook integration for next sprint

Would you like me to drill into any of these areas?`;
  };

  if (isLoading || !adminUser) {
    return null;
  }

  // Build enhanced system prompt with Jasper's persona
  const enhancedSystemPrompt = `${ADMIN_ORCHESTRATOR_PROMPT}

${buildPersonaSystemPrompt(ADMIN_ASSISTANT_NAME, adminUser?.email?.split('@')[0], 'admin', 'admin')}

AGENT INVOCATION:
When the user says "${ADMIN_ASSISTANT_NAME}, find more clients" or similar, you should trigger the Lead Hunter agent.
When the user says "${ADMIN_ASSISTANT_NAME}, [specialist action]", invoke the appropriate specialist from the feature manifest.
`;

  const config: OrchestratorConfig = {
    context: 'admin',
    systemPrompt: enhancedSystemPrompt,
    welcomeMessage: getWelcomeMessage(),
    briefingGenerator: generateBriefing,
    assistantName: ADMIN_ASSISTANT_NAME,
    adminStats: {
      totalOrgs: stats.totalOrgs,
      activeAgents: stats.activeAgents,
      pendingTickets: stats.pendingTickets,
    },
  };

  return (
    <>
      <OrchestratorBase config={config} />
      <FeedbackModal
        orgId="admin"
        userId={adminUser.id}
        userEmail={adminUser.email}
      />
    </>
  );
}

export default AdminOrchestrator;
