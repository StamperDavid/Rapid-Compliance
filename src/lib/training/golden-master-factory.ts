/**
 * Golden Master Factory
 *
 * Creates initial Golden Masters for each agent type.
 * Handles migration from legacy formats (voice toolTraining, SEO toolTraining,
 * GoldenPlaybook for social) into the unified GM structure.
 *
 * @module training/golden-master-factory
 */

import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import type { GoldenMaster, GoldenPlaybook, AgentPersona, BehaviorConfig, OnboardingData, KnowledgeBase } from '@/types/agent-memory';
import type { AgentDomain } from '@/types/training';

// ============================================================================
// DEFAULT CONFIGURATIONS PER AGENT TYPE
// ============================================================================

function getDefaultPersonaForType(agentType: AgentDomain): AgentPersona {
  const base: AgentPersona = {
    tone: 'professional',
    greeting: 'Hello! How can I help you today?',
    closingMessage: 'Thank you for your time!',
    objectives: [],
    can_negotiate: false,
    escalationRules: ['Escalate when customer requests a human agent'],
  };

  switch (agentType) {
    case 'chat':
      return {
        ...base,
        name: 'Sales Chat Agent',
        tone: 'friendly and professional',
        objectives: [
          'Engage website visitors and convert them to leads',
          'Answer product and pricing questions accurately',
          'Handle objections and guide toward purchase decisions',
        ],
      };
    case 'voice':
      return {
        ...base,
        name: 'Voice Agent',
        tone: 'warm and confident',
        greeting: 'Hi there! Thanks for calling.',
        objectives: [
          'Handle inbound and outbound calls professionally',
          'Qualify leads through structured discovery questions',
          'Schedule appointments and demos when appropriate',
        ],
        communicationStyle: {
          responseLength: 'concise',
          formalityLevel: 6,
        },
      };
    case 'email':
      return {
        ...base,
        name: 'Email Agent',
        tone: 'professional and personalized',
        objectives: [
          'Compose personalized outreach emails that drive responses',
          'Follow up at appropriate intervals without being pushy',
          'Craft compelling subject lines and CTAs',
        ],
      };
    case 'content':
      return {
        ...base,
        name: 'Content Creator Agent',
        tone: 'clear, authoritative, and brand-aligned',
        objectives: [
          'Produce blog posts, landing page copy, and website content packages that reflect the client\'s brand voice',
          'Write product descriptions and case studies that are accurate, compelling, and conversion-focused',
          'Structure content for readability with logical headings, clear CTAs, and appropriate length',
        ],
      };
    case 'social':
      return {
        ...base,
        name: 'Social Media Agent',
        tone: 'engaging and on-brand',
        objectives: [
          'Create platform-appropriate content that drives engagement',
          'Maintain consistent brand voice across all platforms',
          'Balance educational, promotional, and community content',
        ],
      };
    case 'seo':
      return {
        ...base,
        name: 'SEO Content Agent',
        tone: 'authoritative and reader-friendly',
        objectives: [
          'Create search-optimized content that ranks for target keywords',
          'Match content to user search intent',
          'Produce comprehensive, well-structured content',
        ],
      };
    case 'video':
      return {
        ...base,
        name: 'Video Screenwriter Agent',
        tone: 'cinematic and descriptive',
        objectives: [
          'Generate storyboards that match user intent exactly — correct character, scene count, tone',
          'Maintain character consistency across all scenes with explicit same-character references',
          'Write narration as voiceover, never as character dialogue or lip-sync',
          'Produce rich visual descriptions optimized for Hedra video generation',
        ],
      };
    case 'orchestrator':
      return {
        ...base,
        name: 'Jasper',
        tone: 'direct, strategic, and confident — like a trusted senior business partner',
        greeting: 'Hey! What are we working on?',
        objectives: [
          'Delegate ALL work to specialized agent teams — never do work directly',
          'Call tools immediately — zero narration before execution',
          'Follow user prompts faithfully — correct scope, no missed items, no extras',
          'Use prior conversation context and system state for informed decisions',
          'Report errors transparently — never mask failures or invent results',
        ],
        communicationStyle: {
          responseLength: 'balanced',
          formalityLevel: 3,
        },
      };
    case 'sales_chat':
      return {
        ...base,
        name: 'Alex',
        tone: 'approachable, knowledgeable, and solution-focused — like a helpful colleague',
        greeting: 'Hey! I\'m Alex from SalesVelocity. What can I help you with?',
        objectives: [
          'Answer questions about SalesVelocity.ai features, pricing, and capabilities accurately',
          'Qualify prospects by understanding their needs and business context',
          'Guide interested prospects toward starting a free trial',
          'Handle objections about price, competitors, and complexity with evidence',
          'Stay with new users through onboarding to answer setup questions',
        ],
        communicationStyle: {
          responseLength: 'concise',
          formalityLevel: 3,
        },
      };
  }
}

function getDefaultBehaviorConfig(agentType: AgentDomain): BehaviorConfig {
  switch (agentType) {
    case 'chat':
      return {
        closingAggressiveness: 5,
        questionFrequency: 3,
        responseLength: 'balanced',
        proactiveLevel: 6,
        idleTimeoutMinutes: 30,
      };
    case 'content':
      return {
        closingAggressiveness: 1,
        questionFrequency: 0,
        responseLength: 'detailed',
        proactiveLevel: 4,
        idleTimeoutMinutes: 120,
      };
    case 'voice':
      return {
        closingAggressiveness: 4,
        questionFrequency: 4,
        responseLength: 'concise',
        proactiveLevel: 5,
        idleTimeoutMinutes: 15,
      };
    case 'email':
      return {
        closingAggressiveness: 3,
        questionFrequency: 2,
        responseLength: 'detailed',
        proactiveLevel: 7,
        idleTimeoutMinutes: 60,
      };
    case 'social':
      return {
        closingAggressiveness: 2,
        questionFrequency: 1,
        responseLength: 'concise',
        proactiveLevel: 8,
        idleTimeoutMinutes: 60,
      };
    case 'seo':
      return {
        closingAggressiveness: 1,
        questionFrequency: 0,
        responseLength: 'detailed',
        proactiveLevel: 3,
        idleTimeoutMinutes: 120,
      };
    case 'video':
      return {
        closingAggressiveness: 0,
        questionFrequency: 0,
        responseLength: 'detailed',
        proactiveLevel: 5,
        idleTimeoutMinutes: 60,
      };
    case 'orchestrator':
      return {
        closingAggressiveness: 0,
        questionFrequency: 2,
        responseLength: 'balanced',
        proactiveLevel: 9,
        idleTimeoutMinutes: 60,
      };
    case 'sales_chat':
      return {
        closingAggressiveness: 3,
        questionFrequency: 3,
        responseLength: 'concise',
        proactiveLevel: 6,
        idleTimeoutMinutes: 30,
      };
  }
}

function getDefaultOnboardingData(): OnboardingData {
  return {
    businessName: 'SalesVelocity.ai',
    industry: 'Technology',
    problemSolved: 'AI-powered sales acceleration',
    uniqueValue: 'Unified AI agent platform for sales teams',
    targetCustomer: 'Sales teams and businesses',
    topProducts: 'AI Sales Platform',
  };
}

function getDefaultKnowledgeBase(): KnowledgeBase {
  return {
    documents: [],
    urls: [],
    faqs: [],
  };
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create an initial Golden Master for a given agent type.
 *
 * For voice/seo: if legacy Firestore config exists in `toolTraining/{type}`,
 * it will be migrated into the GM format.
 *
 * For social: if a GoldenPlaybook exists, it will be bridged into the GM format.
 */
export async function createInitialGoldenMaster(
  agentType: AgentDomain,
  userId: string
): Promise<GoldenMaster> {
  logger.info(`[GM Factory] Creating initial Golden Master for agent type: ${agentType}`);

  // Check for existing typed GM first
  const existing = await findExistingGoldenMaster(agentType);
  if (existing) {
    logger.info(`[GM Factory] Found existing GM for ${agentType}: ${existing.id}`);
    return existing;
  }

  // Build the GM based on agent type
  let goldenMaster: GoldenMaster;

  switch (agentType) {
    case 'voice':
      goldenMaster = await buildFromVoiceConfig(userId);
      break;
    case 'seo':
      goldenMaster = await buildFromSeoConfig(userId);
      break;
    case 'social':
      goldenMaster = await buildFromPlaybook(userId);
      break;
    default:
      goldenMaster = buildDefaultGoldenMaster(agentType, userId);
      break;
  }

  // Save to Firestore
  if (adminDb) {
    await adminDb
      .collection(getSubCollection('goldenMasters'))
      .doc(goldenMaster.id)
      .set(goldenMaster);
    logger.info(`[GM Factory] Saved GM ${goldenMaster.id} for ${agentType}`);
  }

  return goldenMaster;
}

/**
 * Check if a typed Golden Master already exists.
 */
async function findExistingGoldenMaster(agentType: AgentDomain): Promise<GoldenMaster | null> {
  if (!adminDb) { return null; }

  const snap = await adminDb
    .collection(getSubCollection('goldenMasters'))
    .where('agentType', '==', agentType)
    .limit(1)
    .get();

  if (snap.empty) { return null; }

  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as GoldenMaster;
}

/**
 * Build a default GM for agent types without legacy data.
 */
function buildDefaultGoldenMaster(agentType: AgentDomain, userId: string): GoldenMaster {
  return {
    id: `gm_${agentType}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    version: 'v1',
    baseModelId: `initial_${agentType}`,
    agentType,
    businessContext: getDefaultOnboardingData(),
    agentPersona: getDefaultPersonaForType(agentType),
    behaviorConfig: getDefaultBehaviorConfig(agentType),
    knowledgeBase: getDefaultKnowledgeBase(),
    systemPrompt: `You are an AI ${agentType} agent for SalesVelocity.ai. Configure this agent through the training lab.`,
    trainedScenarios: [],
    trainingCompletedAt: new Date().toISOString(),
    trainingScore: 0,
    isActive: false,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    notes: `Initial ${agentType} Golden Master — created by factory`,
  };
}

/**
 * Migrate voice agent config from `toolTraining/voice` → proper GM format.
 */
async function buildFromVoiceConfig(userId: string): Promise<GoldenMaster> {
  const gm = buildDefaultGoldenMaster('voice', userId);

  if (!adminDb) { return gm; }

  try {
    const voiceDoc = await adminDb
      .collection(getSubCollection('toolTraining'))
      .doc('voice')
      .get();

    if (voiceDoc.exists) {
      const voiceData = voiceDoc.data() as Record<string, unknown>;
      logger.info('[GM Factory] Migrating voice toolTraining config to GM format');

      // Merge voice-specific config into persona and behavior
      if (voiceData.systemPrompt && typeof voiceData.systemPrompt === 'string') {
        gm.systemPrompt = voiceData.systemPrompt;
      }
      if (voiceData.callHandlingRules && Array.isArray(voiceData.callHandlingRules)) {
        gm.agentPersona.escalationRules = [
          ...gm.agentPersona.escalationRules,
          ...(voiceData.callHandlingRules as string[]),
        ];
      }
      if (typeof voiceData.scriptAdherenceLevel === 'number') {
        gm.behaviorConfig.proactiveLevel = voiceData.scriptAdherenceLevel;
      }
      gm.notes = 'Migrated from toolTraining/voice configuration';
    }
  } catch (error) {
    logger.warn('[GM Factory] Failed to read voice toolTraining config, using defaults', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return gm;
}

/**
 * Migrate SEO agent config from `toolTraining/seo` → proper GM format.
 */
async function buildFromSeoConfig(userId: string): Promise<GoldenMaster> {
  const gm = buildDefaultGoldenMaster('seo', userId);

  if (!adminDb) { return gm; }

  try {
    const seoDoc = await adminDb
      .collection(getSubCollection('toolTraining'))
      .doc('seo')
      .get();

    if (seoDoc.exists) {
      const seoData = seoDoc.data() as Record<string, unknown>;
      logger.info('[GM Factory] Migrating SEO toolTraining config to GM format');

      if (seoData.systemPrompt && typeof seoData.systemPrompt === 'string') {
        gm.systemPrompt = seoData.systemPrompt;
      }
      if (seoData.targetKeywords && Array.isArray(seoData.targetKeywords)) {
        gm.agentPersona.objectives = [
          ...gm.agentPersona.objectives,
          `Target keywords: ${(seoData.targetKeywords as string[]).join(', ')}`,
        ];
      }
      gm.notes = 'Migrated from toolTraining/seo configuration';
    }
  } catch (error) {
    logger.warn('[GM Factory] Failed to read SEO toolTraining config, using defaults', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return gm;
}

/**
 * Bridge existing GoldenPlaybook data → proper GM format for social agents.
 */
async function buildFromPlaybook(userId: string): Promise<GoldenMaster> {
  const gm = buildDefaultGoldenMaster('social', userId);

  if (!adminDb) { return gm; }

  try {
    const playbookSnap = await adminDb
      .collection(getSubCollection('goldenPlaybooks'))
      .where('agentType', '==', 'social')
      .limit(1)
      .get();

    if (!playbookSnap.empty) {
      const playbook = playbookSnap.docs[0].data() as GoldenPlaybook;
      logger.info('[GM Factory] Bridging GoldenPlaybook to GM format for social agent');

      // Map brand voice DNA → persona
      if (playbook.brandVoiceDNA) {
        gm.agentPersona.tone = playbook.brandVoiceDNA.tone;
        gm.knowledgeBase.brandVoice = {
          tone: playbook.brandVoiceDNA.tone,
          keyMessages: playbook.brandVoiceDNA.keyMessages,
          commonPhrases: playbook.brandVoiceDNA.commonPhrases,
        };
      }

      // Map explicit rules → persona rules
      if (playbook.explicitRules) {
        gm.agentPersona.rules = {
          prohibitedBehaviors: playbook.explicitRules.neverPostAbout,
          behavioralBoundaries: playbook.explicitRules.topicRestrictions,
          neverMention: playbook.explicitRules.neverPostAbout,
        };
      }

      // Preserve compiled prompt if present
      if (playbook.compiledPrompt) {
        gm.systemPrompt = playbook.compiledPrompt;
      }

      // Carry training score and scenarios
      gm.trainingScore = playbook.trainingScore ?? 0;
      gm.trainedScenarios = playbook.trainedScenarios ?? [];

      gm.notes = `Bridged from GoldenPlaybook ${playbook.id} (${playbook.version})`;
    }
  } catch (error) {
    logger.warn('[GM Factory] Failed to read GoldenPlaybook, using defaults', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return gm;
}
