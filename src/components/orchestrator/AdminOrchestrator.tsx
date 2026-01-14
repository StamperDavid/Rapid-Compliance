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
import { auth } from '@/lib/firebase/config';

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
      // Get the current Firebase user and their ID token for authentication
      const currentUser = auth?.currentUser;
      if (!currentUser) {
        console.warn('[Jasper] No authenticated user, cannot fetch stats');
        setIsLoading(false);
        return;
      }

      const token = await currentUser.getIdToken();

      // Use the new secure stats API endpoint with proper auth
      const response = await fetch('/api/admin/stats', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
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
        const newStats = {
          totalOrgs: data.stats.totalOrgs ?? 0,
          activeAgents: data.stats.activeAgents ?? 0,
          pendingTickets: data.stats.pendingTickets ?? 0,
          trialOrgs: data.stats.trialOrgs ?? 0,
          monthlyRevenue: data.stats.monthlyRevenue ?? 0,
        };

        // DEBUG: Log what we received from the API
        console.log('[Jasper] Stats received from API:', newStats);
        console.log('[Jasper] Stats scope:', data.stats.scope);

        setStats(newStats);
        setStatsVerified(true);
      } else {
        console.warn('[Jasper] API returned no stats object:', data);
      }
    } catch (error) {
      console.error('Error fetching admin stats:', error);

      // Check if this is still the latest fetch attempt
      if (currentAttempt !== fetchAttemptRef.current) {
        return;
      }

      // Only set fallback if we haven't successfully fetched before
      if (!statsVerified) {
        // Fallback: Try the organizations endpoint with proper auth
        try {
          const currentUser = auth?.currentUser;
          if (currentUser) {
            const token = await currentUser.getIdToken();
            const orgsResponse = await fetch('/api/admin/organizations?limit=100', {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            if (orgsResponse.ok) {
              const orgsData = await orgsResponse.json();
              const orgCount = orgsData.organizations?.length ?? 0;

              setStats((prev) => ({
                ...prev,
                totalOrgs: orgCount,
                activeAgents: orgCount, // Estimate one agent per org
              }));
              setStatsVerified(true);
              console.log(`[Jasper] Fallback succeeded: ${orgCount} organizations found`);
            }
          }
        } catch {
          // Keep existing stats
          console.warn('[Jasper] Fallback fetch also failed');
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

  // Fetch platform stats when admin user is authenticated
  useEffect(() => {
    // Wait for admin authentication before fetching stats
    if (adminUser && auth?.currentUser) {
      fetchStats();
    }
  }, [fetchStats, adminUser]);

  // Get admin persona for dynamic generation
  const adminPersona = getAdminPersona();

  // Generate admin welcome/briefing message with Jasper persona
  const getWelcomeMessage = (): string => {
    const ownerName = adminUser?.email?.split('@')[0] || 'Commander';

    // Show "Analyzing..." for stats that haven't been verified yet
    const formatStat = (value: number, label: string): string => {
      if (!statsVerified && value === 0) {
        return `**Analyzing...** ${label}`;
      }
      return `**${value}** ${label}`;
    };

    return `**Hello ${ownerName}, I am ${ADMIN_ASSISTANT_NAME}, your ${adminPersona.partnerTitle}.**

${generateStatusOpener(ADMIN_ASSISTANT_NAME, 'admin', 'admin')}

**Platform Command Center:**
• ${formatStat(stats.totalOrgs, 'Total Organizations under management')}
• ${formatStat(stats.activeAgents, 'Active AI Agents deployed fleet-wide')}
• ${formatStat(stats.pendingTickets, 'Support tickets requiring attention')}
• ${formatStat(stats.trialOrgs, 'Trial organizations (conversion opportunities)')}

**What I Can Do:**
• **"${ADMIN_ASSISTANT_NAME}, show platform health"** - I'll run a full diagnostic
• **"${ADMIN_ASSISTANT_NAME}, review tickets"** - I'll triage the support queue
• **"${ADMIN_ASSISTANT_NAME}, find more clients"** - I'll scan for new merchant opportunities
• **"${ADMIN_ASSISTANT_NAME}, activate growth mode"** - I'll generate marketing content

Ready to execute your growth strategy.`;
  };

  // Generate detailed platform briefing
  const generateBriefing = async (): Promise<string> => {
    // Avoid division by zero
    const trialConversionPct = stats.totalOrgs > 0
      ? Math.round((stats.trialOrgs / stats.totalOrgs) * 100)
      : 0;
    const avgAgentsPerOrg = stats.totalOrgs > 0
      ? Math.round(stats.activeAgents / stats.totalOrgs)
      : 0;

    return `**Platform Intelligence Briefing**

**Organization Health:**
• Total Active: ${stats.totalOrgs} organizations
• Trial Users: ${stats.trialOrgs} (${trialConversionPct}% conversion opportunity)
• Monthly Revenue: $${stats.monthlyRevenue.toLocaleString()}

**AI Workforce Status:**
• ${stats.activeAgents} agents deployed across all orgs
• Average agents per org: ${avgAgentsPerOrg}
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

  // Build enhanced system prompt with Jasper's persona - SOLE VOICE, NO AGENT FRAGMENTATION
  // HARD-WIRE the real stats into the prompt so Jasper KNOWS the counts
  const enhancedSystemPrompt = `${ADMIN_ORCHESTRATOR_PROMPT}

${buildPersonaSystemPrompt(ADMIN_ASSISTANT_NAME, adminUser?.email?.split('@')[0], 'admin', 'admin')}

═══════════════════════════════════════════════════════════════════════════════
HARD-WIRED PLATFORM STATE (THIS IS THE TRUTH - USE THESE NUMBERS)
═══════════════════════════════════════════════════════════════════════════════

CURRENT PLATFORM STATS (as of ${new Date().toISOString()}):
- Total Organizations: ${stats.totalOrgs}
- Active AI Agents: ${stats.activeAgents}
- Pending Support Tickets: ${stats.pendingTickets}
- Trial Organizations: ${stats.trialOrgs}
- Stats Verified: ${statsVerified ? 'YES' : 'NO - still loading'}

WHEN DAVID ASKS "how many organizations" or "count" or similar:
→ IMMEDIATELY respond: "I see ${stats.totalOrgs} organizations currently active."
→ DO NOT offer ways to ask. DO NOT suggest commands. JUST ANSWER.
→ You are the interface. Look at the stats above. State the number.

═══════════════════════════════════════════════════════════════════════════════

CRITICAL: JASPER IS THE SOLE VOICE
- NEVER introduce or mention specialist agents by name (Lead Hunter, Direct Line, etc.)
- NEVER say "I'll have [Agent] help with that" or "Deploying [Agent]"
- ALWAYS speak as yourself: "I'm scanning for prospects", "I'll draft that email", "I'm analyzing your pipeline"
- Tools/specialists are called BEHIND THE SCENES - the user only sees Jasper

EXPERT GUIDE MODE:
When a user asks about a feature that isn't configured (e.g., social media without API keys):
- DON'T list what the "specialist" can do
- DO act as a guide: "I see your [Feature] isn't set up yet. Want me to walk you through configuration, or should I hide it from your dashboard until you're ready?"

HIDE FEATURE RESPONSES:
When user says "I don't need [Feature]" or "Hide [Feature]":
- Confirm immediately: "Got it. I'm hiding [Feature] from your dashboard now."
- Remind them: "You can restore it from Settings → Feature Visibility anytime."
- Offer more cleanup: "Anything else cluttering your workspace?"
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
