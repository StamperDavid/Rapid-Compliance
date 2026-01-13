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
  generateIntroduction,
  generateStatusOpener,
  buildPersonaSystemPrompt,
  type IndustryPersona,
} from '@/lib/ai/persona-mapper';
import type { IndustryType } from '@/types/organization';

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

  // Set context on mount
  useEffect(() => {
    setContext('merchant');
  }, [setContext]);

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

  // Generate personalized welcome message with dynamic persona
  const getWelcomeMessage = (): string => {
    // Build the personalized introduction
    const intro = generateIntroduction(
      assistantName,
      ownerName,
      (profile?.industry as IndustryType) || 'custom',
      'client'
    );

    if (hasSeenWelcome) {
      // Return briefing for returning users - lead with status update
      const statusOpener = generateStatusOpener(
        assistantName,
        (profile?.industry as IndustryType) || 'custom',
        'client'
      );

      return `**${intro}**

${statusOpener}

**Your ${industryPersona.industryDisplayName} Dashboard:**
${profile?.name ? `• Business: ${profile.name}` : ''}
• Your AI workforce is standing by
${industryPersona.statusUpdates.slice(0, 2).map(s => `• ${s.template.replace('{count}', '0').replace('{percentage}', '--').replace('{amount}', '$--').replace('{status}', 'Ready')}`).join('\n')}

**Quick Commands:**
• "${assistantName}, show my leads"
• "${assistantName}, create content"
• "${assistantName}, check my pipeline"

What's your priority today?`;
    }

    // First contact onboarding walkthrough - NO generic greetings
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

  // Generate briefing for returning users with industry context
  const generateBriefing = async (): Promise<string> => {
    // In production, this would fetch actual stats from Firestore
    return `📊 **${industryPersona.industryDisplayName} Briefing from ${assistantName}**

**${industryPersona.communicationStyle.focusArea.charAt(0).toUpperCase() + industryPersona.communicationStyle.focusArea.slice(1)} Update:**
${industryPersona.statusUpdates.map(s => `• ${s.template.replace('{count}', '12').replace('{percentage}', '87').replace('{amount}', '$4,250').replace('{status}', 'Optimal').replace('{change}', '+15')}`).join('\n')}

**Specialist Status:**
• 🎯 Lead Hunter: Active - scanning for ${industryPersona.industryDisplayName.toLowerCase()} prospects
• 📧 Newsletter: Ready for deployment
• 💼 Professional Networker: Standing by

**Recommended Next Action:**
"${assistantName}, ${industryPersona.specialistTriggers[0]?.triggers[0] || 'find leads'}"

Should I execute this action or focus elsewhere?`;
  };

  if (isLoading) {
    return null; // Don't render until we have the profile
  }

  // Build enhanced system prompt with industry persona
  const enhancedSystemPrompt = `${MERCHANT_ORCHESTRATOR_PROMPT}

${buildPersonaSystemPrompt(assistantName, ownerName, (profile?.industry as IndustryType) || 'custom', 'client')}

AGENT INVOCATION:
When the user says "${assistantName}, [action]", invoke the appropriate specialist from the feature manifest.
Always respond in character as ${assistantName}, never as a generic assistant.
`;

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
