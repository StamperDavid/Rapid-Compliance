/**
 * Training Data Formatter
 * Format training examples for different providers
 */

import type { TrainingExample, FineTuningDataset } from '@/types/fine-tuning';

/**
 * Format for OpenAI fine-tuning
 */
export function formatForOpenAI(examples: TrainingExample[]): string {
  // OpenAI uses JSONL format (one JSON object per line)
  const lines = examples.map(example => {
    return JSON.stringify({
      messages: example.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });
  });
  
  return lines.join('\n');
}

/**
 * Format for Vertex AI (Gemini) fine-tuning
 */
export function formatForVertexAI(examples: TrainingExample[]): string {
  // Vertex AI uses JSONL format with specific structure
  const lines = examples.map(example => {
    // Extract system, user, and assistant messages
    const systemMsg = example.messages.find(m => m.role === 'system');
    const userMsg = example.messages.find(m => m.role === 'user');
    const assistantMsg = example.messages.find(m => m.role === 'assistant');
    
    return JSON.stringify({
      input_text: `${systemMsg?.content || ''}\n\nUser: ${userMsg?.content || ''}`,
      output_text: assistantMsg?.content || '',
    });
  });
  
  return lines.join('\n');
}

/**
 * Validate training data quality
 */
export function validateTrainingData(examples: TrainingExample[]): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Minimum examples
  if (examples.length < 10) {
    errors.push(`Too few examples: ${examples.length}. Minimum: 10. Recommended: 50+`);
  } else if (examples.length < 50) {
    warnings.push(`Low example count: ${examples.length}. Recommended: 50+ for best results`);
  }
  
  // Check for diversity
  const uniqueUserMessages = new Set(
    examples.map(e => e.messages.find(m => m.role === 'user')?.content || '')
  );
  
  if (uniqueUserMessages.size < examples.length * 0.8) {
    warnings.push('Low diversity: Many duplicate or similar examples');
  }
  
  // Check average confidence
  const avgConfidence =
    examples.reduce((sum, e) => sum + e.confidence, 0) / examples.length;
  
  if (avgConfidence < 70) {
    warnings.push(`Low average confidence: ${avgConfidence.toFixed(1)}%. Consider removing low-quality examples`);
  }
  
  // Check message structure
  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];
    
    if (example.messages.length < 2) {
      errors.push(`Example ${i + 1}: Too few messages. Need at least user + assistant`);
    }
    
    const hasUser = example.messages.some(m => m.role === 'user');
    const hasAssistant = example.messages.some(m => m.role === 'assistant');
    
    if (!hasUser) {
      errors.push(`Example ${i + 1}: Missing user message`);
    }
    
    if (!hasAssistant) {
      errors.push(`Example ${i + 1}: Missing assistant message`);
    }
    
    // Check message lengths
    for (const msg of example.messages) {
      if (msg.content.length < 10) {
        warnings.push(`Example ${i + 1}: Very short ${msg.role} message`);
      }
      
      if (msg.content.length > 4000) {
        warnings.push(`Example ${i + 1}: Very long ${msg.role} message (may be truncated)`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Split data into training and validation sets
 */
export function splitTrainValidation(
  examples: TrainingExample[],
  validationRatio = 0.1
): {
  training: TrainingExample[];
  validation: TrainingExample[];
} {
  // Shuffle examples
  const shuffled = [...examples].sort(() => Math.random() - 0.5);
  
  const validationSize = Math.floor(examples.length * validationRatio);
  
  return {
    validation: shuffled.slice(0, validationSize),
    training: shuffled.slice(validationSize),
  };
}

/**
 * Calculate dataset statistics
 */
export function calculateDatasetStats(examples: TrainingExample[]): {
  totalExamples: number;
  avgConfidence: number;
  avgRating: number;
  conversionRate: number;
  avgUserMessageLength: number;
  avgAssistantMessageLength: number;
  sourceBreakdown: Record<string, number>;
} {
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
  
  const userMessages = examples.map(
    e => e.messages.find(m => m.role === 'user')?.content || ''
  );
  const avgUserMessageLength =
    userMessages.length > 0
      ? userMessages.reduce((sum, msg) => sum + msg.length, 0) / userMessages.length
      : 0;
  
  const assistantMessages = examples.map(
    e => e.messages.find(m => m.role === 'assistant')?.content || ''
  );
  const avgAssistantMessageLength =
    assistantMessages.length > 0
      ? assistantMessages.reduce((sum, msg) => sum + msg.length, 0) / assistantMessages.length
      : 0;
  
  const sourceBreakdown: Record<string, number> = {};
  for (const example of examples) {
    sourceBreakdown[example.source] = (sourceBreakdown[example.source] || 0) + 1;
  }
  
  return {
    totalExamples: examples.length,
    avgConfidence,
    avgRating,
    conversionRate,
    avgUserMessageLength,
    avgAssistantMessageLength,
    sourceBreakdown,
  };
}






















