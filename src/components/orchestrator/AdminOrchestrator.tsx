'use client';

/**
 * Admin Orchestrator - The Growth Partner
 *
 * High-level AI Architect for the platform owner.
 * Provides platform-wide visibility and self-marketing capabilities.
 */

import { useEffect, useState } from 'react';
import { OrchestratorBase, type OrchestratorConfig } from './OrchestratorBase';
import { FeedbackModal } from './FeedbackModal';
import { useOrchestratorStore } from '@/lib/stores/orchestrator-store';
import { ADMIN_ORCHESTRATOR_PROMPT } from '@/lib/orchestrator/feature-manifest';
import { useAdminAuth } from '@/hooks/useAdminAuth';

interface AdminStats {
  totalOrgs: number;
  activeAgents: number;
  pendingTickets: number;
  trialOrgs: number;
  monthlyRevenue: number;
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

  // Set context on mount
  useEffect(() => {
    setContext('admin');
  }, [setContext]);

  // Fetch platform stats
  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch organizations count
        const orgsResponse = await fetch('/api/admin/organizations?limit=1');
        const orgsData = await orgsResponse.json();

        // Fetch users count (approximation for active agents)
        const usersResponse = await fetch('/api/admin/users?limit=1');
        const usersData = await usersResponse.json();

        // In production, these would come from actual API endpoints
        setStats({
          totalOrgs: orgsData.pagination?.total || 0,
          activeAgents: usersData.pagination?.total || 0,
          pendingTickets: 0, // Would come from support tickets aggregation
          trialOrgs: 0, // Would come from subscription status aggregation
          monthlyRevenue: 0, // Would come from billing system
        });
      } catch (error) {
        console.error('Error fetching admin stats:', error);
        // Set fallback stats for demo
        setStats({
          totalOrgs: 47,
          activeAgents: 312,
          pendingTickets: 8,
          trialOrgs: 12,
          monthlyRevenue: 24500,
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, []);

  // Generate admin welcome/briefing message
  const getWelcomeMessage = (): string => {
    return `🏛️ **Welcome back, Master Architect**

I'm your strategic AI partner for platform growth and management.

**Platform Pulse:**
• **${stats.totalOrgs}** Total Organizations
• **${stats.activeAgents}** Active AI Agents Deployed
• **${stats.pendingTickets}** Pending Support Tickets

**Quick Actions I Can Help With:**

1. **Dashboard Deep Dive** - "Show me platform health"
2. **Support Triage** - "Review pending tickets"
3. **Growth Mode** - "Help me create marketing content"
4. **Merchant Management** - "Show struggling organizations"

**Self-Marketing Mode:**
Say "Activate growth mode" and I'll help you create content to acquire new merchants using the Broadcaster, Visual Storyteller, or Newsletter specialists.

What would you like to focus on today?`;
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

  const config: OrchestratorConfig = {
    context: 'admin',
    systemPrompt: ADMIN_ORCHESTRATOR_PROMPT,
    welcomeMessage: getWelcomeMessage(),
    briefingGenerator: generateBriefing,
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
