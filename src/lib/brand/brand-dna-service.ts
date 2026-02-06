/**
 * Brand DNA Service
 * Manages global brand identity and syncs to all AI tools
 */

import { logger } from '@/lib/logger/logger';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

const FILE = 'brand-dna-service.ts';

// Type definitions for Brand DNA and tool training
export interface BrandDNA {
  companyDescription: string;
  uniqueValue: string;
  targetAudience: string;
  toneOfVoice: string;
  communicationStyle: string;
  keyPhrases: string[];
  avoidPhrases: string[];
  industry: string;
  competitors: string[];
  updatedAt?: unknown;
  updatedBy?: string;
}

export interface ToolTrainingContext {
  toolType: 'voice' | 'social' | 'seo';
  orgId: string;
  inheritFromBrandDNA?: boolean;
  inheritedBrandDNA?: BrandDNA;
  overrides?: Partial<BrandDNA>;
  customInstructions?: string;
  toolSettings?: VoiceTrainingSettings | SocialTrainingSettings | SEOTrainingSettings;
  lastSyncedAt?: string;
}

export interface VoiceTrainingSettings {
  greetingScript?: string;
  toneOfVoice?: string;
  callHandoffInstructions?: string;
  [key: string]: unknown;
}

export interface SocialTrainingSettings {
  emojiUsage?: string;
  ctaStyle?: string;
  contentThemes?: string[];
  postingPersonality?: string;
  [key: string]: unknown;
}

export interface SEOTrainingSettings {
  writingStyle?: string;
  targetSearchIntent?: string;
  targetKeywords?: string[];
  audienceExpertiseLevel?: string;
  [key: string]: unknown;
}

/**
 * Get Brand DNA for an organization
 */
export async function getBrandDNA(): Promise<BrandDNA | null> {
  const orgId = DEFAULT_ORG_ID;
  try {
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

    const org = await FirestoreService.get(COLLECTIONS.ORGANIZATIONS, orgId);

    if (!org?.brandDNA) {
      logger.info('[BrandDNA] No brand DNA found for org', { orgId, file: FILE });
      return null;
    }

    return org.brandDNA as BrandDNA;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[BrandDNA] Failed to get brand DNA', err, { orgId, file: FILE });
    return null;
  }
}

/**
 * Update Brand DNA for an organization
 */
export async function updateBrandDNA(
  orgId: string,
  brandDNA: Partial<BrandDNA>,
  userId: string
): Promise<boolean> {
  try {
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
    const { serverTimestamp } = await import('firebase/firestore');

    const updatedBrandDNA = {
      ...brandDNA,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    };

    await FirestoreService.update(COLLECTIONS.ORGANIZATIONS, orgId, {
      brandDNA: updatedBrandDNA,
    });

    logger.info('[BrandDNA] Brand DNA updated', { orgId, userId, file: FILE });

    // Sync to all tools that inherit from brand DNA
    await syncBrandDNA();

    return true;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[BrandDNA] Failed to update brand DNA', err, { orgId, file: FILE });
    return false;
  }
}

/**
 * Sync Brand DNA to all tool training contexts
 * This ensures that Voice, Social, and SEO tools inherit updated brand settings
 */
export async function syncBrandDNA(): Promise<void> {
  const orgId = DEFAULT_ORG_ID;
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');

    const brandDNA = await getBrandDNA();

    if (!brandDNA) {
      logger.warn('[BrandDNA] No brand DNA to sync', { orgId, file: FILE });
      return;
    }

    const tools: Array<'voice' | 'social' | 'seo'> = ['voice', 'social', 'seo'];

    for (const toolType of tools) {
      const toolPath = `organizations/${orgId}/toolTraining`;
      const toolDoc = await FirestoreService.get(toolPath, toolType);

      // Only sync if tool inherits from brand DNA (not overridden)
      if (toolDoc && toolDoc.inheritFromBrandDNA !== false) {
        // Update the inherited brand DNA values in the tool context
        await FirestoreService.update(toolPath, toolType, {
          inheritedBrandDNA: brandDNA,
          lastSyncedAt: new Date().toISOString(),
        });

        logger.info(`[BrandDNA] Synced to ${toolType} training`, { orgId, file: FILE });
      }
    }

    logger.info('[BrandDNA] Sync complete', { orgId, tools, file: FILE });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[BrandDNA] Sync failed', err, { orgId, file: FILE });
  }
}

/**
 * Get tool training context with inherited Brand DNA
 */
export async function getToolTrainingContext(
  orgId: string,
  toolType: 'voice' | 'social' | 'seo'
): Promise<ToolTrainingContext | null> {
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');

    const toolPath = `organizations/${orgId}/toolTraining`;
    const toolDoc = await FirestoreService.get(toolPath, toolType);

    if (!toolDoc) {
      return null;
    }

    // Cast to ToolTrainingContext for type safety
    const typedToolDoc = toolDoc as ToolTrainingContext;

    // If tool inherits from brand DNA, merge the values
    if (typedToolDoc.inheritFromBrandDNA !== false) {
      const brandDNA = await getBrandDNA();

      if (brandDNA) {
        // Merge brand DNA with any tool-specific overrides
        const mergedContext: ToolTrainingContext = {
          ...typedToolDoc,
          toolType,
          orgId,
          inheritFromBrandDNA: true,
          // Apply overrides on top of brand DNA
          overrides: typedToolDoc.overrides ?? {},
        };

        return mergedContext;
      }
    }

    return typedToolDoc;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[BrandDNA] Failed to get tool context', err, { orgId, toolType, file: FILE });
    return null;
  }
}

/**
 * Build system prompt for a tool incorporating Brand DNA
 */
export async function buildToolSystemPrompt(
  toolType: 'voice' | 'social' | 'seo'
): Promise<string> {
  const organizationId = DEFAULT_ORG_ID;
  const brandDNA = await getBrandDNA();
  const toolContext = await getToolTrainingContext(organizationId, toolType);

  let systemPrompt = '';

  // Add Brand DNA context
  if (brandDNA) {
    systemPrompt += `## BRAND IDENTITY\n`;
    systemPrompt += `Company: ${brandDNA.companyDescription}\n`;
    systemPrompt += `Unique Value: ${brandDNA.uniqueValue}\n`;
    systemPrompt += `Target Audience: ${brandDNA.targetAudience}\n`;
    systemPrompt += `Tone of Voice: ${brandDNA.toneOfVoice}\n`;
    systemPrompt += `Communication Style: ${brandDNA.communicationStyle}\n`;

    if (brandDNA.keyPhrases?.length > 0) {
      systemPrompt += `\nKey Phrases to Use: ${brandDNA.keyPhrases.join(', ')}\n`;
    }

    if (brandDNA.avoidPhrases?.length > 0) {
      systemPrompt += `Phrases to Avoid: ${brandDNA.avoidPhrases.join(', ')}\n`;
    }

    systemPrompt += `Industry: ${brandDNA.industry}\n`;

    if (brandDNA.competitors?.length > 0) {
      systemPrompt += `Competitors: ${brandDNA.competitors.join(', ')}\n`;
    }

    systemPrompt += '\n';
  }

  // Add tool-specific context
  if (toolContext) {
    systemPrompt += `## ${toolType.toUpperCase()} SPECIFIC INSTRUCTIONS\n`;

    if (toolContext.customInstructions) {
      systemPrompt += `${toolContext.customInstructions}\n\n`;
    }

    // Add tool settings based on type
    const settings = toolContext.toolSettings;

    if (toolType === 'voice' && settings) {
      const voiceSettings = settings as VoiceTrainingSettings;
      if (voiceSettings.greetingScript) {
        systemPrompt += `Greeting Script: "${voiceSettings.greetingScript}"\n`;
      }
      if (voiceSettings.toneOfVoice) {
        systemPrompt += `Voice Tone: ${voiceSettings.toneOfVoice}\n`;
      }
      if (voiceSettings.callHandoffInstructions) {
        systemPrompt += `Handoff Instructions: ${voiceSettings.callHandoffInstructions}\n`;
      }
    }

    if (toolType === 'social' && settings) {
      const socialSettings = settings as SocialTrainingSettings;
      if (socialSettings.emojiUsage) {
        systemPrompt += `Emoji Usage: ${socialSettings.emojiUsage}\n`;
      }
      if (socialSettings.ctaStyle) {
        systemPrompt += `CTA Style: ${socialSettings.ctaStyle}\n`;
      }
      if (socialSettings.contentThemes && socialSettings.contentThemes.length > 0) {
        systemPrompt += `Content Themes: ${socialSettings.contentThemes.join(', ')}\n`;
      }
      if (socialSettings.postingPersonality) {
        systemPrompt += `Posting Personality: ${socialSettings.postingPersonality}\n`;
      }
    }

    if (toolType === 'seo' && settings) {
      const seoSettings = settings as SEOTrainingSettings;
      if (seoSettings.writingStyle) {
        systemPrompt += `Writing Style: ${seoSettings.writingStyle}\n`;
      }
      if (seoSettings.targetSearchIntent) {
        systemPrompt += `Target Intent: ${seoSettings.targetSearchIntent}\n`;
      }
      if (seoSettings.targetKeywords && seoSettings.targetKeywords.length > 0) {
        systemPrompt += `Target Keywords: ${seoSettings.targetKeywords.join(', ')}\n`;
      }
      if (seoSettings.audienceExpertiseLevel) {
        systemPrompt += `Audience Level: ${seoSettings.audienceExpertiseLevel}\n`;
      }
    }
  }

  return systemPrompt;
}

/**
 * Get effective brand values for a tool (brand DNA + overrides)
 */
export async function getEffectiveBrandValues(
  toolType: 'voice' | 'social' | 'seo'
): Promise<Partial<BrandDNA>> {
  const organizationId = DEFAULT_ORG_ID;
  const brandDNA = await getBrandDNA();
  const toolContext = await getToolTrainingContext(organizationId, toolType);

  if (!brandDNA) {
    return {};
  }

  // If tool has overrides, merge them
  if (toolContext?.overrides) {
    return {
      ...brandDNA,
      ...toolContext.overrides,
    };
  }

  return brandDNA;
}

/**
 * Initialize default Brand DNA from onboarding data
 */
export async function initializeBrandDNAFromOnboarding(
  orgId: string,
  onboardingData: {
    businessName: string;
    businessDescription: string;
    industry: string;
    uniqueValue?: string;
    targetAudience?: string;
  },
  userId: string
): Promise<boolean> {
  try {
    const brandDNA: Partial<BrandDNA> = {
      companyDescription: onboardingData.businessDescription,
      uniqueValue: onboardingData.uniqueValue ?? '',
      targetAudience: onboardingData.targetAudience ?? '',
      toneOfVoice: 'professional',
      communicationStyle: 'Helpful and informative',
      industry: onboardingData.industry,
      keyPhrases: [],
      avoidPhrases: [],
      competitors: [],
    };

    return await updateBrandDNA(orgId, brandDNA, userId);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[BrandDNA] Failed to initialize from onboarding', err, { orgId, file: FILE });
    return false;
  }
}
