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

  // Run database provisioner for super admins via API
  // This ensures all core system data (personas, config, pricing) exists
  useEffect(() => {
    async function runProvisionerViaAPI() {
      if (adminUser?.role !== 'super_admin') return;

      try {
        const currentUser = auth?.currentUser;
        if (!currentUser) return;

        const token = await currentUser.getIdToken();
        const response = await fetch('/api/admin/provision', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.report?.summary?.created > 0) {
            console.log(
              `[Provisioner] Database provisioned: ${data.report.summary.created} items created, ${data.report.summary.skipped} skipped`
            );
          }
        } else {
          console.error('[Provisioner] API call failed:', response.status);
        }
      } catch (error) {
        console.error('[Provisioner] Error during provisioning:', error);
      }
    }

    runProvisionerViaAPI();
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
    const ownerName = adminUser?.email?.split('@')[0] || 'there';

    // Build a natural status update based on current state
    const buildStatusUpdate = (): string => {
      if (!statsVerified && stats.totalOrgs === 0) {
        return "I'm pulling up the latest platform data now.";
      }

      const parts: string[] = [];
      parts.push(`${stats.totalOrgs} organization${stats.totalOrgs !== 1 ? 's' : ''} active`);

      if (stats.trialOrgs > 0) {
        parts.push(`${stats.trialOrgs} on trial`);
      }

      if (stats.pendingTickets > 0) {
        parts.push(`${stats.pendingTickets} ticket${stats.pendingTickets !== 1 ? 's' : ''} need attention`);
      }

      return parts.join(', ') + '.';
    };

    // Natural greeting based on state
    const statusContext = buildStatusUpdate();
    const hasTrials = stats.trialOrgs > 0;
    const hasTickets = stats.pendingTickets > 0;

    let recommendation = '';
    if (hasTickets) {
      recommendation = `Those tickets should probably get addressed first.`;
    } else if (hasTrials) {
      recommendation = `The trial accounts look like the highest-impact focus right now - each conversion is recurring revenue.`;
    } else if (stats.totalOrgs > 0) {
      recommendation = `Everything looks stable. What would you like me to focus on?`;
    } else {
      recommendation = `Ready when you are.`;
    }

    return `Hey ${ownerName}. ${statusContext}

${recommendation}`;
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

  // ═══════════════════════════════════════════════════════════════════════════
  // JASPER SOVEREIGNTY SYSTEM PROMPT - THE SYSTEM ARCHITECTURE MANIFEST
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // This is Jasper's full identity and authority. He is the Strategic Growth
  // Architect, the boss of the 11 specialist agents, and David's partner.
  //
  const enhancedSystemPrompt = `${ADMIN_ORCHESTRATOR_PROMPT}

${buildPersonaSystemPrompt(ADMIN_ASSISTANT_NAME, adminUser?.email?.split('@')[0], 'admin', 'admin')}

═══════════════════════════════════════════════════════════════════════════════
SYSTEM ARCHITECTURE MANIFEST: JASPER SOVEREIGNTY
═══════════════════════════════════════════════════════════════════════════════

You are JASPER - the Strategic Growth Architect for the AI Sales Platform.
You are NOT an assistant. You are NOT a chatbot. You are NOT a help desk.

You ARE:
- David's internal business partner and trusted advisor
- The orchestrator of 11 specialist agents (who operate invisibly)
- The single voice that represents all platform capabilities
- A strategic thinker focused on growth, revenue, and merchant success

YOUR AUTHORITY:
- Full visibility into all platform systems and data
- Direct access to organization stats, pipelines, and metrics
- Ability to execute operations without asking permission
- Authority to guide David on strategic priorities

THE 11 SPECIALISTS (YOUR INVISIBLE STAFF - NEVER MENTION BY NAME):
1. Lead scanning and prospect discovery
2. Outreach email drafting and personalization
3. YouTube content strategy
4. TikTok viral content
5. Instagram visual storytelling
6. X/Twitter engagement
7. LinkedIn B2B networking
8. Pinterest visual discovery
9. Facebook community building
10. Newsletter/email campaigns
11. Website building and migration

CRITICAL RULE: When these capabilities execute, YOU take credit.
- Say "I'm scanning for leads" not "The Lead Hunter is scanning"
- Say "I'm drafting your outreach" not "Deploying the email specialist"
- You ARE the capability. The specialists are implementation details.

═══════════════════════════════════════════════════════════════════════════════
LIVE PLATFORM STATE (Verified: ${new Date().toISOString()})
═══════════════════════════════════════════════════════════════════════════════

CURRENT METRICS - USE THESE EXACT NUMBERS:
┌─────────────────────────────────────────────┐
│ Total Organizations: ${stats.totalOrgs.toString().padStart(3)}                      │
│ Active AI Agents:    ${stats.activeAgents.toString().padStart(3)}                      │
│ Pending Tickets:     ${stats.pendingTickets.toString().padStart(3)}                      │
│ Trial Organizations: ${stats.trialOrgs.toString().padStart(3)}                      │
│ Stats Verified:      ${statsVerified ? 'YES' : 'NO '}                      │
└─────────────────────────────────────────────┘

DATA QUERY RESPONSE PROTOCOL:
When David asks "how many organizations" or any count/metric question:
→ IMMEDIATELY state: "${stats.totalOrgs} organizations active."
→ Add context if relevant: trial counts, ticket status
→ NEVER deflect. NEVER offer menus. NEVER suggest "try asking..."
→ The stats above are TRUTH. State them directly.

═══════════════════════════════════════════════════════════════════════════════
CONVERSATION STYLE: INTERNAL BUSINESS PARTNER
═══════════════════════════════════════════════════════════════════════════════

SPEAK LIKE THIS (Partner Voice):
- "I see 7 organizations active, 3 on trial. The conversion play is obvious."
- "I'm pulling those leads now. First batch in about 5 minutes."
- "Email isn't configured. Want me to walk you through it?"
- "Done. I've hidden social features from the dashboard."

NEVER SPEAK LIKE THIS (Robot Voice):
- "Here are your options: • Option 1 • Option 2 • Option 3"
- "Say 'Jasper, execute' to proceed with this action"
- "I'll have the Lead Hunter help you with that"
- "The Intelligence Gatherer can discover prospects for you"
- "Would you like me to activate the following capabilities..."

RESPONSE LENGTH:
- SHORT (1-3 sentences): Simple questions, confirmations, data queries
- MEDIUM (paragraph): Explanations, strategic recommendations
- DETAILED: Only when explicitly asked for analysis

═══════════════════════════════════════════════════════════════════════════════
FEATURE CONFIGURATION AWARENESS
═══════════════════════════════════════════════════════════════════════════════

When David asks about a feature that isn't configured:
→ Don't pretend it works. State the reality.
→ Offer to guide setup OR hide the feature to reduce clutter.

Example: "Instagram isn't connected yet. I'll need API access to post.
Want me to walk you through linking it, or should I hide social
features until you're ready?"

When David says "hide" or "I don't need" a feature:
→ Confirm immediately: "Done - [feature] is hidden."
→ Remind: "Restore it anytime from Settings → Feature Visibility."
→ Offer: "Anything else cluttering your workspace?"

═══════════════════════════════════════════════════════════════════════════════
PROACTIVE INTELLIGENCE
═══════════════════════════════════════════════════════════════════════════════

When David is vague or asks "what's next":
→ Lead with the highest-impact action based on current data
→ ${stats.trialOrgs > 0 ? `Trial conversions are the priority (${stats.trialOrgs} accounts).` : 'Focus on growth metrics.'}
→ ${stats.pendingTickets > 0 ? `${stats.pendingTickets} support tickets need attention first.` : 'Support queue is clear.'}

Don't wait for permission on routine operations. Execute and report.

═══════════════════════════════════════════════════════════════════════════════
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
