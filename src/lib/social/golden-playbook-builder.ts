/**
 * Golden Playbook Builder Service
 * Creates Golden Playbook from current agent config for generative agents
 * Golden Playbook is a versioned snapshot that user manually saves when satisfied
 */

import type {
  GoldenPlaybook,
  PlaybookPlatformRules,
} from '@/types/agent-memory';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { AgentConfigService } from '@/lib/social/agent-config-service';

export interface CreatePlaybookOptions {
  userId: string;
  notes?: string;
}

/**
 * Create a new Golden Playbook from current agent config
 */
export async function createPlaybook(
  options: CreatePlaybookOptions
): Promise<GoldenPlaybook> {
  const { userId, notes } = options;

  logger.info('[Golden Playbook Builder] Creating Golden Playbook from current config', {
    file: 'golden-playbook-builder.ts'
  });

  // Get current agent config
  const config = await AgentConfigService.getConfig();

  // Get next version number
  const nextVersion = await getNextPlaybookVersion();

  logger.info('[Golden Playbook Builder] Next version', {
    version: nextVersion,
    file: 'golden-playbook-builder.ts'
  });

  // Get previous version for changelog
  const { orderBy, limit } = await import('firebase/firestore');
  const previousPlaybooks = await FirestoreService.getAll<GoldenPlaybook>(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.GOLDEN_PLAYBOOKS}`,
    [orderBy('createdAt', 'desc'), limit(1)]
  );
  const previousVersion = previousPlaybooks.length > 0 ? previousPlaybooks[0].version : undefined;

  // Build brand voice DNA (defaults — enriched from Training Lab over time)
  const brandVoiceDNA = {
    tone: 'professional',
    keyMessages: [] as string[],
    commonPhrases: [] as string[],
    vocabulary: [] as string[],
    avoidWords: config.sentimentBlockKeywords ?? [],
  };

  // Convert TimeSlot[] to postingWindows format
  const postingWindows = (config.preferredPostingTimes ?? []).map(slot => ({
    dayOfWeek: slot.dayOfWeek,
    startHour: slot.hour,
    endHour: slot.hour + 1, // 1-hour window from the preferred time
  }));

  // Build platform rules from config
  const platformRules: PlaybookPlatformRules[] = [
    {
      platform: 'twitter',
      maxLength: 280,
      tone: brandVoiceDNA.tone,
      hashtagPolicy: 'sparingly',
      emojiPolicy: 'minimal',
      ctaStyle: 'subtle',
      postingWindows,
      customInstructions: [],
    },
    {
      platform: 'linkedin',
      maxLength: 3000,
      tone: 'professional',
      hashtagPolicy: 'sparingly',
      emojiPolicy: 'minimal',
      ctaStyle: 'consultative',
      postingWindows,
      customInstructions: [],
    },
    {
      platform: 'facebook',
      maxLength: 5000,
      tone: brandVoiceDNA.tone,
      hashtagPolicy: 'sparingly',
      emojiPolicy: 'liberal',
      ctaStyle: 'conversational',
      postingWindows,
      customInstructions: [],
    },
    {
      platform: 'instagram',
      maxLength: 2200,
      tone: brandVoiceDNA.tone,
      hashtagPolicy: 'always',
      emojiPolicy: 'liberal',
      ctaStyle: 'engaging',
      postingWindows,
      customInstructions: [],
    },
  ];

  // Build explicit rules from sentiment block and escalation trigger keywords
  const explicitRules = {
    neverPostAbout: config.sentimentBlockKeywords ?? [],
    alwaysRequireApproval: config.escalationTriggerKeywords ?? [],
    topicRestrictions: [],
    customConstraints: []
  };

  // Correction history and performance patterns start empty

  // Create Golden Playbook
  const playbook: GoldenPlaybook = {
    id: `gp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    version: nextVersion,
    agentType: 'social',

    // Brand voice DNA
    brandVoiceDNA,

    // Platform rules
    platformRules,

    // Learned corrections (empty for new playbook)
    correctionHistory: [],

    // Content performance patterns (empty for new playbook)
    performancePatterns: [],

    // Explicit user-defined rules
    explicitRules,

    // Compiled prompt — will be compiled from all sections
    compiledPrompt: '',

    // Training results
    trainedScenarios: [],
    trainingScore: 0,

    // Not deployed yet - client must explicitly deploy
    isActive: false,

    // Metadata
    createdBy: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    // Versioning
    previousVersion,
    changesSummary: notes ?? `Golden Playbook ${nextVersion} created from current config`,
  };

  // Compile the prompt from all sections
  playbook.compiledPrompt = compilePlaybookPrompt(playbook);

  logger.info('[Golden Playbook Builder] Golden Playbook created', {
    id: playbook.id,
    version: playbook.version,
    file: 'golden-playbook-builder.ts'
  });

  return playbook;
}

/**
 * Compile all playbook sections into a single generation prompt
 */
export function compilePlaybookPrompt(playbook: GoldenPlaybook): string {
  const sections: string[] = [];

  // Brand voice section
  sections.push('=== BRAND VOICE DNA ===');
  sections.push(`Tone: ${playbook.brandVoiceDNA.tone}`);

  if (playbook.brandVoiceDNA.keyMessages.length > 0) {
    sections.push('\nKey Messages:');
    for (const message of playbook.brandVoiceDNA.keyMessages) {
      sections.push(`- ${message}`);
    }
  }

  if (playbook.brandVoiceDNA.commonPhrases.length > 0) {
    sections.push('\nCommon Phrases:');
    for (const phrase of playbook.brandVoiceDNA.commonPhrases) {
      sections.push(`- ${phrase}`);
    }
  }

  if (playbook.brandVoiceDNA.vocabulary.length > 0) {
    sections.push('\nPreferred Vocabulary:');
    sections.push(playbook.brandVoiceDNA.vocabulary.join(', '));
  }

  if (playbook.brandVoiceDNA.avoidWords.length > 0) {
    sections.push('\nAvoid Words:');
    sections.push(playbook.brandVoiceDNA.avoidWords.join(', '));
  }

  // Platform rules section
  sections.push('\n\n=== PLATFORM RULES ===');
  for (const rule of playbook.platformRules) {
    sections.push(`\n${rule.platform.toUpperCase()}:`);
    if (rule.maxLength) {
      sections.push(`Max Length: ${rule.maxLength} characters`);
    }
    if (rule.tone) {
      sections.push(`Tone: ${rule.tone}`);
    }
    if (rule.hashtagPolicy) {
      sections.push(`Hashtag Policy: ${rule.hashtagPolicy}`);
    }
    if (rule.emojiPolicy) {
      sections.push(`Emoji Policy: ${rule.emojiPolicy}`);
    }
    if (rule.ctaStyle) {
      sections.push(`CTA Style: ${rule.ctaStyle}`);
    }
    if (rule.customInstructions && rule.customInstructions.length > 0) {
      sections.push('Custom Instructions:');
      for (const instruction of rule.customInstructions) {
        sections.push(`- ${instruction}`);
      }
    }
  }

  // Correction learnings section
  if (playbook.correctionHistory.length > 0) {
    sections.push('\n\n=== LEARNED CORRECTIONS ===');
    sections.push('User has corrected the following patterns:');
    for (const correction of playbook.correctionHistory) {
      sections.push(`\n[${correction.platform}] ${correction.postType ?? 'post'}`);
      sections.push(`Original: ${correction.original}`);
      sections.push(`Corrected: ${correction.corrected}`);
      if (correction.context) {
        sections.push(`Context: ${correction.context}`);
      }
    }
  }

  // Performance patterns section
  if (playbook.performancePatterns.length > 0) {
    sections.push('\n\n=== PERFORMANCE PATTERNS ===');
    sections.push('The following patterns have been shown to perform well:');
    for (const pattern of playbook.performancePatterns) {
      sections.push(`\n- ${pattern.pattern}`);
      sections.push(`  Metric: ${pattern.metric} = ${pattern.value}`);
      sections.push(`  Confidence: ${Math.round(pattern.confidence * 100)}% (${pattern.sampleSize} samples)`);
    }
  }

  // Explicit rules section
  sections.push('\n\n=== EXPLICIT RULES ===');

  if (playbook.explicitRules.neverPostAbout.length > 0) {
    sections.push('\nNEVER post about:');
    for (const topic of playbook.explicitRules.neverPostAbout) {
      sections.push(`- ${topic}`);
    }
  }

  if (playbook.explicitRules.alwaysRequireApproval.length > 0) {
    sections.push('\nALWAYS require approval if content contains:');
    for (const keyword of playbook.explicitRules.alwaysRequireApproval) {
      sections.push(`- ${keyword}`);
    }
  }

  if (playbook.explicitRules.topicRestrictions.length > 0) {
    sections.push('\nTopic Restrictions:');
    for (const restriction of playbook.explicitRules.topicRestrictions) {
      sections.push(`- ${restriction}`);
    }
  }

  if (playbook.explicitRules.customConstraints.length > 0) {
    sections.push('\nCustom Constraints:');
    for (const constraint of playbook.explicitRules.customConstraints) {
      sections.push(`- ${constraint}`);
    }
  }

  return sections.join('\n');
}

/**
 * Save Golden Playbook to Firestore
 */
export async function savePlaybook(playbook: GoldenPlaybook): Promise<void> {
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.GOLDEN_PLAYBOOKS}`,
    playbook.id,
    {
      ...playbook,
      // Convert dates to ISO strings for Firestore
      createdAt: playbook.createdAt,
      updatedAt: playbook.updatedAt,
      deployedAt: playbook.deployedAt,
    },
    false
  );
}

/**
 * Get active Golden Playbook for organization
 */
export async function getActivePlaybook(): Promise<GoldenPlaybook | null> {
  // Query for active Golden Playbook
  const { where } = await import('firebase/firestore');
  const playbooks = await FirestoreService.getAll<GoldenPlaybook>(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.GOLDEN_PLAYBOOKS}`,
    [where('isActive', '==', true)]
  );

  if (playbooks.length > 0) {
    return playbooks[0];
  }

  // If no active, get the latest one
  const { orderBy, limit } = await import('firebase/firestore');
  const latest = await FirestoreService.getAll<GoldenPlaybook>(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.GOLDEN_PLAYBOOKS}`,
    [orderBy('createdAt', 'desc'), limit(1)]
  );

  return latest.length > 0 ? latest[0] : null;
}

/**
 * Get all Golden Playbooks for organization
 */
export async function getAllPlaybooks(): Promise<GoldenPlaybook[]> {
  const { orderBy } = await import('firebase/firestore');

  const playbooks = await FirestoreService.getAll<GoldenPlaybook>(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.GOLDEN_PLAYBOOKS}`,
    [orderBy('createdAt', 'desc')]
  );

  return playbooks;
}

/**
 * Deploy Golden Playbook (make it active)
 */
export async function deployPlaybook(playbookId: string): Promise<void> {
  const { writeBatch, doc } = await import('firebase/firestore');
  const { db } = await import('@/lib/firebase/config');

  if (!db) {
    throw new Error('Firestore not initialized');
  }

  // Get all Golden Playbooks
  const allPlaybooks = await getAllPlaybooks();

  // Find the one to deploy
  const playbookToActivate = allPlaybooks.find(pb => pb.id === playbookId);

  if (!playbookToActivate) {
    throw new Error('Golden Playbook not found');
  }

  // Use batch to update all playbooks atomically
  const batch = writeBatch(db);

  // Deactivate all Golden Playbooks
  for (const pb of allPlaybooks) {
    const pbRef = doc(db, `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.GOLDEN_PLAYBOOKS}/${pb.id}`);
    batch.update(pbRef, { isActive: false });
  }

  // Activate the selected one
  const activePBRef = doc(db, `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.GOLDEN_PLAYBOOKS}/${playbookId}`);
  batch.update(activePBRef, {
    isActive: true,
    deployedAt: new Date().toISOString(),
  });

  // Commit batch
  await batch.commit();

  logger.info('[Golden Playbook Builder] Golden Playbook deployed', {
    playbookId,
    file: 'golden-playbook-builder.ts'
  });
}

/**
 * Get next Golden Playbook version number
 */
async function getNextPlaybookVersion(): Promise<string> {
  const { orderBy, limit } = await import('firebase/firestore');

  const playbooks = await FirestoreService.getAll<GoldenPlaybook>(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.GOLDEN_PLAYBOOKS}`,
    [orderBy('createdAt', 'desc'), limit(1)]
  );

  if (playbooks.length === 0) {
    return 'v1';
  }

  const lastVersion = playbooks[0].version;
  const versionNumber = parseInt(lastVersion.replace('v', ''));
  return `v${versionNumber + 1}`;
}
