/**
 * Content Safety & Filtering
 * Enterprise-grade safety guardrails
 */

import type { ChatRequest } from '@/types/ai-models';
import { sendChatRequest } from '../model-provider';

export interface SafetyCheckResult {
  isSafe: boolean;
  confidence: number; // 0-100
  
  flags: Array<{
    category: 'profanity' | 'hate_speech' | 'sexual' | 'violence' | 'pii' | 'prompt_injection' | 'bias' | 'misinformation';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
  }>;
  
  sanitizedContent?: string; // Content with PII masked
  shouldBlock: boolean;
  shouldWarn: boolean;
}

/**
 * Check content safety
 */
export async function checkContentSafety(
  content: string,
  direction: 'input' | 'output',
  model: string = 'gpt-4-turbo'
): Promise<SafetyCheckResult> {
  const checks = await Promise.all([
    checkForProfanity(content),
    checkForHateSpeech(content, model),
    checkForPII(content),
    direction === 'input' ? checkForPromptInjection(content, model) : Promise.resolve(null),
  ]);
  
  const flags: SafetyCheckResult['flags'] = [];
  
  // Aggregate results
  checks.forEach(check => {
    if (check && check.flags.length > 0) {
      flags.push(...check.flags);
    }
  });
  
  // Determine if should block
  const hasCritical = flags.some(f => f.severity === 'critical');
  const hasHigh = flags.some(f => f.severity === 'high');
  
  // Check for PII and sanitize
  const piiCheck = await checkForPII(content);
  const sanitizedContent = piiCheck.sanitizedContent || content;
  
  return {
    isSafe: !hasCritical && !hasHigh,
    confidence: flags.length === 0 ? 100 : 100 - (flags.length * 10),
    flags,
    sanitizedContent,
    shouldBlock: hasCritical,
    shouldWarn: hasHigh && !hasCritical,
  };
}

/**
 * Check for profanity
 */
async function checkForProfanity(content: string): Promise<SafetyCheckResult> {
  const profanityList = [
    // Common profanity patterns
    /\b(fuck|shit|damn|bitch|ass|bastard|crap)\b/i,
    /\b(hell|piss|cunt|dick|cock|pussy)\b/i,
  ];
  
  const flags: SafetyCheckResult['flags'] = [];
  
  for (const pattern of profanityList) {
    if (pattern.test(content)) {
      flags.push({
        category: 'profanity',
        severity: 'medium',
        description: 'Profanity detected',
      });
      break; // One flag is enough
    }
  }
  
  return {
    isSafe: flags.length === 0,
    confidence: flags.length === 0 ? 100 : 70,
    flags,
    shouldBlock: false, // Profanity is not critical
    shouldWarn: flags.length > 0,
  };
}

/**
 * Check for hate speech using AI
 */
async function checkForHateSpeech(
  content: string,
  model: string
): Promise<SafetyCheckResult> {
  try {
    const request: ChatRequest = {
      model: model as any,
      messages: [
        {
          role: 'system',
          content: `You are a content moderation system. Analyze text for hate speech, discrimination, or harmful content.
          
Return JSON:
{
  "isSafe": true/false,
  "confidence": 0-100,
  "flags": [{"category": "hate_speech|discrimination|violence", "severity": "low|medium|high|critical", "description": "..."}]
}`,
        },
        {
          role: 'user',
          content: `Analyze this content:\n\n${content}`,
        },
      ],
      temperature: 0.1,
      maxTokens: 300,
    };
    
    const response = await sendChatRequest(request);
    
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        ...result,
        shouldBlock: result.flags.some((f: any) => f.severity === 'critical'),
        shouldWarn: result.flags.some((f: any) => f.severity === 'high'),
      };
    }
  } catch (error) {
    console.error('[Safety] Hate speech check error:', error);
  }
  
  return {
    isSafe: true,
    confidence: 50,
    flags: [],
    shouldBlock: false,
    shouldWarn: false,
  };
}

/**
 * Check for PII (Personally Identifiable Information)
 */
async function checkForPII(content: string): Promise<SafetyCheckResult & { sanitizedContent: string }> {
  const flags: SafetyCheckResult['flags'] = [];
  let sanitized = content;
  
  // Email detection
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = content.match(emailPattern);
  if (emails) {
    flags.push({
      category: 'pii',
      severity: 'low',
      description: `Email addresses detected: ${emails.length}`,
    });
    sanitized = sanitized.replace(emailPattern, '[EMAIL_REDACTED]');
  }
  
  // Phone number detection (US format)
  const phonePattern = /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
  const phones = content.match(phonePattern);
  if (phones) {
    flags.push({
      category: 'pii',
      severity: 'low',
      description: `Phone numbers detected: ${phones.length}`,
    });
    sanitized = sanitized.replace(phonePattern, '[PHONE_REDACTED]');
  }
  
  // SSN detection (US format)
  const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/g;
  const ssns = content.match(ssnPattern);
  if (ssns) {
    flags.push({
      category: 'pii',
      severity: 'high',
      description: 'Social Security Number detected',
    });
    sanitized = sanitized.replace(ssnPattern, '[SSN_REDACTED]');
  }
  
  // Credit card detection
  const ccPattern = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g;
  const ccs = content.match(ccPattern);
  if (ccs) {
    flags.push({
      category: 'pii',
      severity: 'critical',
      description: 'Credit card number detected',
    });
    sanitized = sanitized.replace(ccPattern, '[CARD_REDACTED]');
  }
  
  return {
    isSafe: !flags.some(f => f.severity === 'critical'),
    confidence: flags.length === 0 ? 100 : 80,
    flags,
    sanitizedContent: sanitized,
    shouldBlock: flags.some(f => f.severity === 'critical'),
    shouldWarn: flags.some(f => f.severity === 'high'),
  };
}

/**
 * Check for prompt injection attempts
 */
async function checkForPromptInjection(
  content: string,
  model: string
): Promise<SafetyCheckResult> {
  // Pattern-based detection
  const injectionPatterns = [
    /ignore (previous|above|all) instructions/i,
    /you are now/i,
    /new instructions:/i,
    /system prompt:/i,
    /\/reset/i,
    /disregard/i,
  ];
  
  const flags: SafetyCheckResult['flags'] = [];
  
  for (const pattern of injectionPatterns) {
    if (pattern.test(content)) {
      flags.push({
        category: 'prompt_injection',
        severity: 'critical',
        description: 'Potential prompt injection detected',
      });
      break;
    }
  }
  
  return {
    isSafe: flags.length === 0,
    confidence: flags.length === 0 ? 95 : 20,
    flags,
    shouldBlock: flags.length > 0,
    shouldWarn: false,
  };
}

/**
 * Check for bias in AI output
 */
export async function checkForBias(
  content: string,
  model: string = 'gpt-4-turbo'
): Promise<SafetyCheckResult> {
  try {
    const request: ChatRequest = {
      model: model as any,
      messages: [
        {
          role: 'system',
          content: `Analyze this content for bias (gender, race, age, etc.). Return JSON:
{
  "isSafe": true/false,
  "confidence": 0-100,
  "flags": [{"category": "bias", "severity": "low|medium|high", "description": "type of bias detected"}]
}`,
        },
        {
          role: 'user',
          content,
        },
      ],
      temperature: 0.1,
      maxTokens: 300,
    };
    
    const response = await sendChatRequest(request);
    
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        ...result,
        shouldBlock: false, // Bias is a warning, not a block
        shouldWarn: result.flags.length > 0,
      };
    }
  } catch (error) {
    console.error('[Safety] Bias check error:', error);
  }
  
  return {
    isSafe: true,
    confidence: 50,
    flags: [],
    shouldBlock: false,
    shouldWarn: false,
  };
}

/**
 * Create safe response
 */
export function createSafeErrorResponse(safetyResult: SafetyCheckResult): string {
  const criticalFlags = safetyResult.flags.filter(f => f.severity === 'critical');
  
  if (criticalFlags.length > 0) {
    return "I'm sorry, but I can't process that request due to safety concerns. Please rephrase your message or contact support if you believe this is an error.";
  }
  
  return "I'm sorry, but I detected some potentially sensitive content in your message. Could you please rephrase that?";
}



















