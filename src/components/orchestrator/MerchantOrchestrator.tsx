'use client';

/**
 * Merchant Orchestrator - The Client Manager
 *
 * AI Assistant for merchants that serves as their primary interface.
 * Features dynamic assistant naming and industry-tailored personas.
 * Fetches industry, niche, and assistant config from Firestore profile.
 */

import { useEffect, useState, useCallback } from 'react';
import { OrchestratorBase, type OrchestratorConfig } from './OrchestratorBase';
import { FeedbackModal } from './FeedbackModal';
import { useOrchestratorStore } from '@/lib/stores/orchestrator-store';
import { MERCHANT_ORCHESTRATOR_PROMPT } from '@/lib/orchestrator/feature-manifest';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import {
  getIndustryPersona,
  generateIntroduction,
  generateStatusOpener,
  buildPersonaSystemPrompt,
  type IndustryPersona,
} from '@/lib/ai/persona-mapper';
import type { IndustryType } from '@/types/organization';
import { ImplementationGuide, type ImplementationContext } from '@/lib/orchestrator/implementation-guide';
import { SystemHealthService, type SystemHealthReport } from '@/lib/orchestrator/system-health-service';

interface MerchantOrchestratorProps {
  orgId: string;
}

interface MerchantProfile {
  industry?: string;
  industryName?: string;
  nicheDescription?: string;
  name?: string;
  assistantName?: string; // Custom AI assistant name
  ownerName?: string; // Business owner's name
  hasSeenWelcome?: boolean;
}

export function MerchantOrchestrator({ orgId }: MerchantOrchestratorProps) {
  const { user } = useAuth();
  const { setContext, hasSeenWelcome } = useOrchestratorStore();
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [healthReport, setHealthReport] = useState<SystemHealthReport | null>(null);
  const [implContext, setImplContext] = useState<ImplementationContext | null>(null);

  // Set context on mount
  useEffect(() => {
    setContext('merchant');
  }, [setContext]);

  // Fetch system health report for Implementation Guide
  useEffect(() => {
    async function fetchSystemHealth() {
      if (!orgId) return;
      try {
        const report = await SystemHealthService.generateHealthReport(orgId);
        setHealthReport(report);
      } catch (error) {
        console.error('Error fetching system health:', error);
      }
    }
    fetchSystemHealth();
  }, [orgId]);

  // Build Implementation Context once we have profile and health report
  useEffect(() => {
    async function buildImplContext() {
      if (!orgId || !profile || !healthReport) return;
      try {
        const context = await ImplementationGuide.buildContext(
          orgId,
          profile.assistantName || 'Assistant',
          profile.ownerName,
          profile.industry
        );
        setImplContext(context);
      } catch (error) {
        console.error('Error building implementation context:', error);
      }
    }
    buildImplContext();
  }, [orgId, profile, healthReport]);

  // Fetch merchant profile from Firestore
  useEffect(() => {
    async function fetchProfile() {
      if (!orgId || !db) return;

      try {
        const orgDoc = await getDoc(doc(db, 'organizations', orgId));
        if (orgDoc.exists()) {
          const data = orgDoc.data();
          setProfile({
            industry: data.industry,
            industryName: data.industryName,
            nicheDescription: data.nicheDescription,
            name: data.name,
            assistantName: data.assistantName, // Custom AI assistant name
            ownerName: data.ownerName, // Business owner's name
            hasSeenWelcome: data.hasSeenWelcome,
          });
        }
      } catch (error) {
        console.error('Error fetching merchant profile:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, [orgId]);

  // Get industry persona for this merchant
  const industryPersona: IndustryPersona = getIndustryPersona((profile?.industry as IndustryType) || 'custom');
  const assistantName = profile?.assistantName || 'Assistant';
  const ownerName = profile?.ownerName;

  // Generate personalized welcome message with dynamic persona AND Implementation Guide awareness
  const getWelcomeMessage = (): string => {
    // Build the personalized introduction
    const intro = generateIntroduction(
      assistantName,
      ownerName,
      (profile?.industry as IndustryType) || 'custom',
      'client'
    );

    // Get Implementation Guide handshake if context available
    const guideHandshake = implContext
      ? ImplementationGuide.generateSpecialistHandshake(implContext)
      : null;

    if (hasSeenWelcome) {
      // Return briefing for returning users - lead with status update AND system awareness
      const statusOpener = generateStatusOpener(
        assistantName,
        (profile?.industry as IndustryType) || 'custom',
        'client'
      );

      // Include system health in returning user message
      let systemStatus = '';
      if (healthReport && healthReport.readinessLevel !== 'platform-ready') {
        const unconfigured = healthReport.features.filter(f => f.status === 'unconfigured');
        if (unconfigured.length > 0) {
          systemStatus = `\n**Platform Setup:** ${healthReport.readinessScore}% complete`;
          systemStatus += `\n• ${unconfigured.slice(0, 2).map(f => `${f.icon} ${f.featureName}: Not configured`).join('\n• ')}`;
          systemStatus += `\n\n*Say "hide [feature]" if you don't need it, or "set up [feature]" to configure.*`;
        }
      } else if (healthReport?.goldenMaster.hasGoldenMaster) {
        systemStatus = `\n**Golden Master:** Active (${healthReport.goldenMaster.activeVersion}) ✅`;
      }

      return `**${intro}**

${statusOpener}

**Your ${industryPersona.industryDisplayName} Dashboard:**
${profile?.name ? `• Business: ${profile.name}` : ''}
• Your AI workforce is standing by
${industryPersona.statusUpdates.slice(0, 2).map(s => `• ${s.template.replace('{count}', '0').replace('{percentage}', '--').replace('{amount}', '$--').replace('{status}', 'Ready')}`).join('\n')}
${systemStatus}

**Quick Commands:**
• "${assistantName}, show my leads"
• "${assistantName}, create content"
• "${assistantName}, check my pipeline"

What's your priority today?`;
    }

    // First contact - Use Implementation Guide's Specialist Handshake if available
    if (guideHandshake && implContext?.currentPhase !== 'operational') {
      const unconfiguredList = healthReport?.features
        .filter(f => f.status === 'unconfigured')
        .slice(0, 3)
        .map(f => `${f.icon} ${f.featureName}`) || [];

      return `**${guideHandshake.greeting}**

${guideHandshake.systemAwareness}

${unconfiguredList.length > 0 ? `**Features Ready to Configure:**
${unconfiguredList.map(f => `• ${f}`).join('\n')}

Should we set these up together, or would you like me to hide any you don't need to keep your dashboard clean?` : ''}

**Your ${industryPersona.partnerTitle} Capabilities:**
1. **Lead Intelligence** 🎯 - Say "${assistantName}, find leads"
2. **Content Engine** 📝 - 11 specialists at your command
3. **${industryPersona.communicationStyle.focusArea}** - My focus for ${industryPersona.industryDisplayName}

${profile?.nicheDescription ? `**Your Niche:** ${profile.nicheDescription}\n` : ''}

**Next Recommended Action:**
${guideHandshake.recommendation}

What would you like to tackle first?`;
    }

    // Fallback - standard first contact onboarding walkthrough
    return `**${intro}**

I'm specialized for **${industryPersona.industryDisplayName}** businesses and ready to accelerate your growth.

**Your ${industryPersona.partnerTitle} Capabilities:**

1. **Lead Intelligence** 🎯 - Say "${assistantName}, find leads" and I'll activate the Lead Hunter
2. **Content Engine** 📝 - I command 11 specialists for every platform
3. **${industryPersona.communicationStyle.focusArea}** - My primary focus for your industry

${profile?.nicheDescription ? `\n**Your Niche:** ${profile.nicheDescription}\nI've tailored my responses for this market segment.\n` : ''}

**Industry-Specific Actions:**
${industryPersona.specialistTriggers.slice(0, 3).map(t => `• "${assistantName}, ${t.triggers[0]}"`).join('\n')}

Let's start with what matters most - what's your top priority right now?`;
  };

  // Generate briefing for returning users with industry context AND implementation progress
  const generateBriefing = async (): Promise<string> => {
    // Get fresh health report for briefing
    let currentHealth = healthReport;
    if (!currentHealth) {
      try {
        currentHealth = await SystemHealthService.generateHealthReport(orgId);
      } catch (e) {
        console.error('Failed to fetch health report for briefing:', e);
      }
    }

    // Build implementation progress section
    let implProgress = '';
    if (currentHealth && implContext) {
      implProgress = `\n${ImplementationGuide.getProgressSummary(implContext)}`;
    }

    return `📊 **${industryPersona.industryDisplayName} Briefing from ${assistantName}**

**${industryPersona.communicationStyle.focusArea.charAt(0).toUpperCase() + industryPersona.communicationStyle.focusArea.slice(1)} Update:**
${industryPersona.statusUpdates.map(s => `• ${s.template.replace('{count}', '12').replace('{percentage}', '87').replace('{amount}', '$4,250').replace('{status}', 'Optimal').replace('{change}', '+15')}`).join('\n')}
${implProgress}

**Specialist Status:**
• 🎯 Lead Hunter: Active - scanning for ${industryPersona.industryDisplayName.toLowerCase()} prospects
• 📧 Newsletter: ${currentHealth?.integrations.find(i => i.id === 'email')?.connected ? 'Connected' : 'Not connected'}
• 💼 Professional Networker: Standing by

**Recommended Next Action:**
${currentHealth?.recommendations[0]?.title || `"${assistantName}, ${industryPersona.specialistTriggers[0]?.triggers[0] || 'find leads'}"`}

Should I execute this action or focus elsewhere?`;
  };

  if (isLoading) {
    return null; // Don't render until we have the profile
  }

  // Build enhanced system prompt with industry persona AND Implementation Guide awareness
  const buildSystemPromptWithContext = (): string => {
    let prompt = MERCHANT_ORCHESTRATOR_PROMPT;

    // Add industry persona
    prompt += `\n\n${buildPersonaSystemPrompt(assistantName, ownerName, (profile?.industry as IndustryType) || 'custom', 'client')}`;

    // Add Implementation Guide context if available
    if (implContext) {
      prompt += `\n\n${ImplementationGuide.generateSystemPrompt(implContext)}`;
    }

    // Add system health awareness
    if (healthReport) {
      const unconfigured = healthReport.features.filter(f => f.status === 'unconfigured');
      if (unconfigured.length > 0) {
        prompt += `\n\nSYSTEM HEALTH AWARENESS:
Platform Readiness: ${healthReport.readinessScore}% (${healthReport.readinessLevel})
Unconfigured Features: ${unconfigured.map(f => `${f.icon} ${f.featureName}`).join(', ')}
${healthReport.goldenMaster.hasGoldenMaster ? `Golden Master: Active (${healthReport.goldenMaster.activeVersion})` : 'Golden Master: Not yet deployed'}

PROACTIVE GUIDANCE:
When appropriate, mention unconfigured features proactively:
"I noticed your [Feature] isn't set up yet. Should we configure that together, or would you like me to hide it to keep your dashboard clean?"`;
      }
    }

    // Add agent invocation rules
    prompt += `\n\nAGENT INVOCATION:
When the user says "${assistantName}, [action]", invoke the appropriate specialist from the feature manifest.
Always respond in character as ${assistantName}, never as a generic assistant.

FEATURE TOGGLE CAPABILITY:
When the user says "I don't need [Feature]" or "Hide [Feature]":
1. Acknowledge their preference
2. Confirm the feature is being hidden
3. Remind them it can be restored from Settings

When hiding features, use this exact response format:
"Got it! I'm hiding [Feature] from your dashboard now. Your workspace will be cleaner. You can restore it anytime from Settings > Feature Visibility."`;

    return prompt;
  };

  const enhancedSystemPrompt = buildSystemPromptWithContext();

  const config: OrchestratorConfig = {
    context: 'merchant',
    systemPrompt: enhancedSystemPrompt,
    welcomeMessage: getWelcomeMessage(),
    briefingGenerator: generateBriefing,
    assistantName: assistantName,
    ownerName: ownerName,
    merchantInfo: {
      industry: profile?.industry,
      niche: profile?.nicheDescription,
      companyName: profile?.name,
      assistantName: assistantName,
      ownerName: ownerName,
    },
  };

  return (
    <>
      <OrchestratorBase config={config} />
      <FeedbackModal
        orgId={orgId}
        userId={user?.id}
        userEmail={user?.email || undefined}
      />
    </>
  );
}

export default MerchantOrchestrator;
