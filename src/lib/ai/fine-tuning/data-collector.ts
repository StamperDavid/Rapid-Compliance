/**
 * Training Data Collector
 * Collects high-quality examples for fine-tuning
 */

import type { TrainingExample } from '@/types/fine-tuning';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

/**
 * Collect training example from a conversation
 */
export async function collectTrainingExample(params: {
  organizationId: string;
  conversationId: string;
  messages: Array<{ role: string; content: string }>;
  confidence: number;
  userRating?: number;
  didConvert?: boolean;
  userFeedback?: string;
}): Promise<TrainingExample> {
  const {
    organizationId,
    conversationId,
    messages,
    confidence,
    userRating,
    didConvert,
    userFeedback,
  } = params;
  
  // Determine if this should be collected
  const shouldCollect = evaluateQuality({
    confidence,
    userRating,
    didConvert,
  });
  
  if (!shouldCollect) {
    console.log('[Data Collector] Example does not meet quality criteria');
    return null as any;
  }
  
  // Create training example
  const example: TrainingExample = {
    id: `example_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    organizationId,
    conversationId,
    messages: messages.map(m => ({
      role: m.role as any,
      content: m.content,
    })),
    confidence,
    userRating,
    didConvert,
    userFeedback,
    source: 'real_conversation',
    status: 'pending', // Requires approval
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  // Save to Firestore
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/trainingExamples`,
    example.id,
    example,
    false
  );
  
  console.log(`[Data Collector] Collected example: ${example.id}`);
  
  return example;
}

/**
 * Collect from training scenario
 */
export async function collectFromTrainingScenario(params: {
  organizationId: string;
  scenario: {
    userMessage: string;
    expectedResponse: string;
    systemPrompt: string;
  };
}): Promise<TrainingExample> {
  const { organizationId, scenario } = params;
  
  const example: TrainingExample = {
    id: `example_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    organizationId,
    messages: [
      { role: 'system', content: scenario.systemPrompt },
      { role: 'user', content: scenario.userMessage },
      { role: 'assistant', content: scenario.expectedResponse },
    ],
    confidence: 100, // Training scenarios are always high quality
    source: 'training_scenario',
    status: 'approved', // Auto-approved
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/trainingExamples`,
    example.id,
    example,
    false
  );
  
  return example;
}

/**
 * Collect from human correction
 */
export async function collectFromHumanCorrection(params: {
  organizationId: string;
  conversationId: string;
  originalResponse: string;
  correctedResponse: string;
  systemPrompt: string;
  userMessage: string;
}): Promise<TrainingExample> {
  const {
    organizationId,
    conversationId,
    originalResponse,
    correctedResponse,
    systemPrompt,
    userMessage,
  } = params;
  
  const example: TrainingExample = {
    id: `example_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    organizationId,
    conversationId,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
      { role: 'assistant', content: correctedResponse }, // Use corrected version
    ],
    confidence: 100, // Human corrections are always high quality
    humanCorrection: correctedResponse,
    source: 'human_correction',
    status: 'approved', // Auto-approved
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/trainingExamples`,
    example.id,
    example,
    false
  );
  
  console.log(`[Data Collector] Collected human correction: ${example.id}`);
  
  return example;
}

/**
 * Evaluate if example meets quality criteria
 */
function evaluateQuality(params: {
  confidence: number;
  userRating?: number;
  didConvert?: boolean;
}): boolean {
  const { confidence, userRating, didConvert } = params;
  
  // High confidence conversations
  if (confidence >= 85) return true;
  
  // High user rating
  if (userRating && userRating >= 4) return true;
  
  // Converted to sale
  if (didConvert) return true;
  
  // Medium confidence + medium rating
  if (confidence >= 70 && userRating && userRating >= 3) return true;
  
  return false;
}

/**
 * Get training examples for an organization
 */
export async function getTrainingExamples(
  organizationId: string,
  status?: TrainingExample['status']
): Promise<TrainingExample[]> {
  const filters = status
    ? [{ field: 'status', operator: '==', value: status }]
    : [];
  
  const examples = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/trainingExamples`,
    filters as any
  );
  
  return examples as TrainingExample[];
}

/**
 * Approve training example
 */
export async function approveTrainingExample(
  organizationId: string,
  exampleId: string,
  approvedBy: string
): Promise<void> {
  await FirestoreService.update(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/trainingExamples`,
    exampleId,
    {
      status: 'approved',
      approvedBy,
      updatedAt: new Date().toISOString(),
    }
  );
  
  console.log(`[Data Collector] Approved example: ${exampleId}`);
}

/**
 * Reject training example
 */
export async function rejectTrainingExample(
  organizationId: string,
  exampleId: string
): Promise<void> {
  await FirestoreService.update(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/trainingExamples`,
    exampleId,
    {
      status: 'rejected',
      updatedAt: new Date().toISOString(),
    }
  );
}

/**
 * Get statistics for training examples
 */
export async function getTrainingDataStats(
  organizationId: string
): Promise<{
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  avgConfidence: number;
  avgRating: number;
  conversionRate: number;
}> {
  const examples = await getTrainingExamples(organizationId);
  
  const approved = examples.filter(e => e.status === 'approved');
  const pending = examples.filter(e => e.status === 'pending');
  const rejected = examples.filter(e => e.status === 'rejected');
  
  const avgConfidence =
    examples.length > 0
      ? examples.reduce((sum, e) => sum + e.confidence, 0) / examples.length
      : 0;
  
  const ratedExamples = examples.filter(e => e.userRating);
  const avgRating =
    ratedExamples.length > 0
      ? ratedExamples.reduce((sum, e) => sum + (e.userRating || 0), 0) / ratedExamples.length
      : 0;
  
  const convertedExamples = examples.filter(e => e.didConvert);
  const conversionRate =
    examples.length > 0 ? (convertedExamples.length / examples.length) * 100 : 0;
  
  return {
    total: examples.length,
    approved: approved.length,
    pending: pending.length,
    rejected: rejected.length,
    avgConfidence,
    avgRating,
    conversionRate,
  };
}


















