'use client';

/**
 * Merchant Orchestrator - The Client Manager
 *
 * AI Assistant for merchants that serves as their primary interface.
 * Features dynamic assistant naming and industry-tailored personas.
 * Fetches industry, niche, and assistant config from Firestore profile.
 */

import { useEffect, useState } from 'react';
import { OrchestratorBase, type OrchestratorConfig } from './OrchestratorBase';
import { FeedbackModal } from './FeedbackModal';
import { useOrchestratorStore } from '@/lib/stores/orchestrator-store';
import { MERCHANT_ORCHESTRATOR_PROMPT } from '@/lib/orchestrator/feature-manifest';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import {
  getIndustryPersona,
  buildPersonaSystemPrompt,
  type IndustryPersona,
  type IndustryType,
} from '@/lib/ai/persona-mapper';
import { ImplementationGuide, type ImplementationContext } from '@/lib/orchestrator/implementation-guide';
import { SystemHealthService, type SystemHealthReport } from '@/lib/orchestrator/system-health-service';
import { PLATFORM_ID } from '@/lib/constants/platform';

interface MerchantProfile {
  industry?: string;
  industryName?: string;
  nicheDescription?: string;
  name?: string;
  assistantName?: string; // Custom AI assistant name
  ownerName?: string; // Business owner's name
  hasSeenWelcome?: boolean;
}

export function MerchantOrchestrator() {
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
      try {
        const report = await SystemHealthService.generateHealthReport();
        setHealthReport(report);
      } catch (error) {
        console.error('Error fetching system health:', error);
      }
    }
    void fetchSystemHealth();
  }, []);

  // Build Implementation Context once we have profile and health report
  useEffect(() => {
    async function buildImplContext() {
      if (!profile || !healthReport) {
        return;
      }
      try {
        const context = await ImplementationGuide.buildContext(
          profile.assistantName ?? 'Assistant',
          profile.ownerName,
          profile.industry
        );
        setImplContext(context);
      } catch (error) {
        console.error('Error building implementation context:', error);
      }
    }
    void buildImplContext();
  }, [profile, healthReport]);

  // Fetch merchant profile from Firestore
  useEffect(() => {
    async function fetchProfile() {
      if (!db) {
        return;
      }

      try {
        const orgDoc = await getDoc(doc(db, 'organizations', PLATFORM_ID));
        if (orgDoc.exists()) {
          const data = orgDoc.data() as MerchantProfile;
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

    void fetchProfile();
  }, []);

  // Get industry persona for this merchant
  const industryPersona: IndustryPersona = getIndustryPersona((profile?.industry as IndustryType) ?? 'custom');
  const assistantName = profile?.assistantName ?? 'Assistant';
  const ownerName = profile?.ownerName;

  // Generate personalized welcome message - natural dialogue, no menus
  const getWelcomeMessage = (): string => {
    const displayName = ownerName ?? 'there';
    const businessName = profile?.name ?? 'your business';
    const industryContext = industryPersona.industryDisplayName;

    // Build system status naturally
    const buildSystemContext = (): string => {
      if (!healthReport) {
        return '';
      }

      const unconfigured = healthReport.features.filter(f => f.status === 'unconfigured');
      if (unconfigured.length === 0) {
        return 'Everything is set up and running.';
      }

      const featureNames = unconfigured.slice(0, 2).map(f => f.featureName.toLowerCase()).join(' and ');
      return `I noticed ${featureNames} ${unconfigured.length === 1 ? "isn't" : "aren't"} configured yet. We can set ${unconfigured.length === 1 ? 'that' : 'those'} up whenever you're ready, or I can hide ${unconfigured.length === 1 ? 'it' : 'them'} to keep your dashboard clean.`;
    };

    // Returning user - brief status update
    if (hasSeenWelcome) {
      const systemContext = buildSystemContext();
      return `Hey ${displayName}. ${systemContext !== '' ? systemContext : `Ready to work on ${businessName}.`} What do you need?`;
    }

    // First contact - natural introduction
    const systemContext = buildSystemContext();
    const recommendation = implContext?.currentPhase === 'onboarding'
      ? `Since you're getting started, I'd recommend we set up lead generation first - that's usually the highest impact.`
      : `I'm ready to manage leads, content, and outreach for ${industryContext.toLowerCase()} businesses like yours.`;

    return `Hey ${displayName}, I'm ${assistantName}. I'll be managing the sales and marketing operations for ${businessName}.

${systemContext}

${recommendation} What would you like to focus on?`;
  };

  // Generate briefing for returning users - natural conversation style
  const generateBriefing = async (): Promise<string> => {
    // Get fresh health report for briefing
    let currentHealth = healthReport;
    if (!currentHealth) {
      try {
        currentHealth = await SystemHealthService.generateHealthReport();
      } catch (e) {
        console.error('Failed to fetch health report for briefing:', e);
      }
    }

    const businessName = profile?.name ?? 'your business';
    const emailConnected = currentHealth?.integrations.find(i => i.id === 'email')?.connected;
    const recommendation = currentHealth?.recommendations[0]?.title ?? 'setting up your lead pipeline';

    return `Here's where things stand for ${businessName}:

Lead scanning is active and I'm tracking prospects in the ${industryPersona.industryDisplayName.toLowerCase()} vertical. ${emailConnected ? 'Email is connected and ready for outreach.' : "Email isn't connected yet - we can set that up when you're ready to start outreach campaigns."}

Based on your setup, ${recommendation.toLowerCase()} looks like the next high-impact move. Want me to get started on that?`;
  };

  if (isLoading) {
    return null; // Don't render until we have the profile
  }

  // Build enhanced system prompt with industry persona AND Implementation Guide awareness
  const buildSystemPromptWithContext = (): string => {
    let prompt = MERCHANT_ORCHESTRATOR_PROMPT;

    // Add industry persona
    prompt += `\n\n${buildPersonaSystemPrompt(assistantName, ownerName, (profile?.industry as IndustryType) ?? 'custom', 'client')}`;

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
        userId={user?.id}
        userEmail={user?.email ?? undefined}
      />
    </>
  );
}

export default MerchantOrchestrator;
