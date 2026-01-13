'use client';

/**
 * Merchant Orchestrator - The Client Manager
 *
 * AI Assistant for merchants that serves as their primary interface.
 * Fetches industry and niche from Firestore profile for personalized interactions.
 */

import { useEffect, useState } from 'react';
import { OrchestratorBase, type OrchestratorConfig } from './OrchestratorBase';
import { FeedbackModal } from './FeedbackModal';
import { useOrchestratorStore } from '@/lib/stores/orchestrator-store';
import { MERCHANT_ORCHESTRATOR_PROMPT } from '@/lib/orchestrator/feature-manifest';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/hooks/useAuth';

interface MerchantOrchestratorProps {
  orgId: string;
}

interface MerchantProfile {
  industry?: string;
  industryName?: string;
  nicheDescription?: string;
  name?: string;
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

  // Generate personalized welcome message
  const getWelcomeMessage = (): string => {
    if (hasSeenWelcome) {
      // Return briefing for returning users
      return `Welcome back${profile?.name ? ` to ${profile.name}` : ''}! 👋

Here's your quick status update:
• Your AI workforce is ready to deploy
• ${profile?.industryName ? `Industry: ${profile.industryName}` : 'Industry templates available'}
${profile?.nicheDescription ? `• Niche: ${profile.nicheDescription}` : ''}

How can I help you today? You can:
• Ask me to invoke any specialist
• Check on your leads and campaigns
• Get help with any feature

Just type your request or click a quick action below!`;
    }

    // First contact onboarding walkthrough
    return `🎉 **Welcome to SalesVelocity!**

I'm your AI Sales Assistant, here to help you build and manage your automated sales workforce.

**Let me give you a quick tour:**

1. **Your 11 Specialists** - I can deploy AI agents for YouTube, TikTok, Instagram, LinkedIn, and more. Just ask!

2. **Lead Hunter** 🎯 - Start finding qualified leads immediately. Say "Start a lead scan"

3. **Content Factory** 📝 - Generate posts, emails, and videos for any platform.

${profile?.industryName ? `\nI see you're in **${profile.industryName}** - I've pre-loaded industry-specific strategies for you!` : ''}

**Ready to get started?** Try saying:
• "Show me my specialists"
• "Help me find leads"
• "Create a LinkedIn post"

What would you like to do first?`;
  };

  // Generate briefing for returning users
  const generateBriefing = async (): Promise<string> => {
    // In production, this would fetch actual stats from Firestore
    return `📊 **Dashboard Briefing**

**Today's Highlights:**
• 12 new leads captured
• 3 deals advancing in pipeline
• Email campaign at 24% open rate

**Specialist Status:**
• 🎯 Lead Hunter: Active - 47 leads enriched
• 💼 LinkedIn Networker: Hibernated - Connect to activate
• 📧 Newsletter: Ready for deployment

Would you like me to dive deeper into any of these areas?`;
  };

  if (isLoading) {
    return null; // Don't render until we have the profile
  }

  const config: OrchestratorConfig = {
    context: 'merchant',
    systemPrompt: MERCHANT_ORCHESTRATOR_PROMPT,
    welcomeMessage: getWelcomeMessage(),
    briefingGenerator: generateBriefing,
    merchantInfo: {
      industry: profile?.industry,
      niche: profile?.nicheDescription,
      companyName: profile?.name,
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
