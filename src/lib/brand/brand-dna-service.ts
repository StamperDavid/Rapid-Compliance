/**
 * Brand DNA Service
 * Manages global brand identity and syncs to all AI tools
 */

import { logger } from '@/lib/logger/logger';
import type { BrandDNA, ToolTrainingContext } from '@/types/organization';

const FILE = 'brand-dna-service.ts';

/**
 * Get Brand DNA for an organization
 */
export async function getBrandDNA(orgId: string): Promise<BrandDNA | null> {
  try {
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

    const org = await FirestoreService.get(COLLECTIONS.ORGANIZATIONS, orgId);

    if (!org?.brandDNA) {
      logger.info('[BrandDNA] No brand DNA found for org', { orgId, file: FILE });
      return null;
    }

    return org.brandDNA as BrandDNA;
  } catch (error) {
    logger.error('[BrandDNA] Failed to get brand DNA', error, { orgId, file: FILE });
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
    await syncBrandDNA(orgId);

    return true;
  } catch (error) {
    logger.error('[BrandDNA] Failed to update brand DNA', error, { orgId, file: FILE });
    return false;
  }
}

/**
 * Sync Brand DNA to all tool training contexts
 * This ensures that Voice, Social, and SEO tools inherit updated brand settings
 */
export async function syncBrandDNA(orgId: string): Promise<void> {
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');

    const brandDNA = await getBrandDNA(orgId);

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
    logger.error('[BrandDNA] Sync failed', error, { orgId, file: FILE });
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

    // If tool inherits from brand DNA, merge the values
    if (toolDoc.inheritFromBrandDNA !== false) {
      const brandDNA = await getBrandDNA(orgId);

      if (brandDNA) {
        // Merge brand DNA with any tool-specific overrides
        const mergedContext: ToolTrainingContext = {
          ...toolDoc,
          toolType,
          orgId,
          inheritFromBrandDNA: true,
          // Apply overrides on top of brand DNA
          overrides: toolDoc.overrides || {},
        } as ToolTrainingContext;

        return mergedContext;
      }
    }

    return toolDoc as ToolTrainingContext;
  } catch (error) {
    logger.error('[BrandDNA] Failed to get tool context', error, { orgId, toolType, file: FILE });
    return null;
  }
}

/**
 * Build system prompt for a tool incorporating Brand DNA
 */
export async function buildToolSystemPrompt(
  orgId: string,
  toolType: 'voice' | 'social' | 'seo'
): Promise<string> {
  const brandDNA = await getBrandDNA(orgId);
  const toolContext = await getToolTrainingContext(orgId, toolType);

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
      const voiceSettings = settings as any;
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
      const socialSettings = settings as any;
      if (socialSettings.emojiUsage) {
        systemPrompt += `Emoji Usage: ${socialSettings.emojiUsage}\n`;
      }
      if (socialSettings.ctaStyle) {
        systemPrompt += `CTA Style: ${socialSettings.ctaStyle}\n`;
      }
      if (socialSettings.contentThemes?.length > 0) {
        systemPrompt += `Content Themes: ${socialSettings.contentThemes.join(', ')}\n`;
      }
      if (socialSettings.postingPersonality) {
        systemPrompt += `Posting Personality: ${socialSettings.postingPersonality}\n`;
      }
    }

    if (toolType === 'seo' && settings) {
      const seoSettings = settings as any;
      if (seoSettings.writingStyle) {
        systemPrompt += `Writing Style: ${seoSettings.writingStyle}\n`;
      }
      if (seoSettings.targetSearchIntent) {
        systemPrompt += `Target Intent: ${seoSettings.targetSearchIntent}\n`;
      }
      if (seoSettings.targetKeywords?.length > 0) {
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
  orgId: string,
  toolType: 'voice' | 'social' | 'seo'
): Promise<Partial<BrandDNA>> {
  const brandDNA = await getBrandDNA(orgId);
  const toolContext = await getToolTrainingContext(orgId, toolType);

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
      uniqueValue: onboardingData.uniqueValue || '',
      targetAudience: onboardingData.targetAudience || '',
      toneOfVoice: 'professional',
      communicationStyle: 'Helpful and informative',
      industry: onboardingData.industry,
      keyPhrases: [],
      avoidPhrases: [],
      competitors: [],
    };

    return await updateBrandDNA(orgId, brandDNA, userId);
  } catch (error) {
    logger.error('[BrandDNA] Failed to initialize from onboarding', error, { orgId, file: FILE });
    return false;
  }
}
