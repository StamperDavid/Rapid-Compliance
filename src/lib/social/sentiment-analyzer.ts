/**
 * Sentiment Analyzer
 * AI-powered sentiment classification for social mentions.
 * Uses Gemini for structured sentiment analysis with keyword-based fallback.
 */

import { logger } from '@/lib/logger/logger';
import { DEFAULT_AGENT_SETTINGS } from '@/lib/social/agent-config-service';
import type { MentionSentiment } from '@/types/social';

interface SentimentResult {
  sentiment: MentionSentiment;
  confidence: number;
  keyPhrases: string[];
}

/**
 * Analyze sentiment of a single text using AI, with keyword fallback
 */
export async function analyzeSentiment(text: string): Promise<SentimentResult> {
  // Try AI-powered analysis first
  try {
    const result = await analyzeWithAI(text);
    if (result) {return result;}
  } catch (error) {
    logger.warn('SentimentAnalyzer: AI analysis failed, falling back to keywords', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }

  // Fallback to keyword-based detection
  return analyzeWithKeywords(text);
}

/**
 * Batch analyze multiple texts (up to 10 per call to minimize cost)
 */
export async function analyzeSentimentBatch(
  texts: Array<{ id: string; content: string }>
): Promise<Map<string, SentimentResult>> {
  const results = new Map<string, SentimentResult>();

  // Process in batches of 10
  for (let i = 0; i < texts.length; i += 10) {
    const batch = texts.slice(i, i + 10);

    try {
      const batchResult = await analyzeWithAIBatch(batch);
      if (batchResult) {
        for (const [id, result] of batchResult.entries()) {
          results.set(id, result);
        }
        continue;
      }
    } catch (error) {
      logger.warn('SentimentAnalyzer: Batch AI analysis failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }

    // Fallback: analyze individually with keywords
    for (const item of batch) {
      results.set(item.id, analyzeWithKeywords(item.content));
    }
  }

  return results;
}

/**
 * AI-powered sentiment analysis using Gemini
 */
async function analyzeWithAI(text: string): Promise<SentimentResult | null> {
  try {
    const { generateText } = await import('@/lib/ai/gemini-service');

    const prompt = `Classify the sentiment of the following social media text. Return ONLY a JSON object with:
- sentiment: "positive" | "neutral" | "negative"
- confidence: number between 0 and 1
- key_phrases: array of 1-3 key phrases that informed the classification

Text: "${text.substring(0, 500)}"

Return ONLY valid JSON, nothing else.`;

    const response = await generateText(prompt, undefined);
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        sentiment?: string;
        confidence?: number;
        key_phrases?: string[];
      };

      const sentiment = parsed.sentiment as MentionSentiment;
      if (!['positive', 'neutral', 'negative'].includes(sentiment)) {
        return null;
      }

      return {
        sentiment,
        confidence: Math.min(Math.max(parsed.confidence ?? 0.5, 0), 1),
        keyPhrases: parsed.key_phrases ?? [],
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * AI batch sentiment analysis
 */
async function analyzeWithAIBatch(
  items: Array<{ id: string; content: string }>
): Promise<Map<string, SentimentResult> | null> {
  try {
    const { generateText } = await import('@/lib/ai/gemini-service');

    const textEntries = items
      .map((item, i) => `${i + 1}. [ID: ${item.id}] "${item.content.substring(0, 200)}"`)
      .join('\n');

    const prompt = `Classify the sentiment of each of these social media texts. Return ONLY a JSON array where each element has:
- id: the ID from the input
- sentiment: "positive" | "neutral" | "negative"
- confidence: number between 0 and 1
- key_phrases: array of 1-3 key phrases

Texts:
${textEntries}

Return ONLY valid JSON array, nothing else.`;

    const response = await generateText(prompt, undefined);
    const jsonMatch = response.text.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        id: string;
        sentiment: string;
        confidence: number;
        key_phrases: string[];
      }>;

      const results = new Map<string, SentimentResult>();
      for (const item of parsed) {
        if (['positive', 'neutral', 'negative'].includes(item.sentiment)) {
          results.set(item.id, {
            sentiment: item.sentiment as MentionSentiment,
            confidence: Math.min(Math.max(item.confidence ?? 0.5, 0), 1),
            keyPhrases: item.key_phrases ?? [],
          });
        }
      }
      return results;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Keyword-based sentiment analysis (fallback)
 */
function analyzeWithKeywords(text: string): SentimentResult {
  const lower = text.toLowerCase();

  // Use the hostile keywords from agent config defaults
  const negativeKeywords = DEFAULT_AGENT_SETTINGS.sentimentBlockKeywords;

  const positiveKeywords = [
    'love', 'great', 'awesome', 'excellent', 'amazing', 'fantastic',
    'wonderful', 'brilliant', 'outstanding', 'perfect', 'recommend',
    'thank', 'thanks', 'grateful', 'appreciate', 'best', 'helpful',
    'impressive', 'incredible', 'superb', 'happy', 'pleased',
  ];

  let positiveCount = 0;
  let negativeCount = 0;
  const keyPhrases: string[] = [];

  for (const kw of positiveKeywords) {
    if (lower.includes(kw)) {
      positiveCount++;
      if (keyPhrases.length < 3) {keyPhrases.push(kw);}
    }
  }

  for (const kw of negativeKeywords) {
    if (lower.includes(kw)) {
      negativeCount++;
      if (keyPhrases.length < 3) {keyPhrases.push(kw);}
    }
  }

  if (negativeCount > positiveCount) {
    return { sentiment: 'negative', confidence: Math.min(negativeCount * 0.2, 0.9), keyPhrases };
  }
  if (positiveCount > negativeCount) {
    return { sentiment: 'positive', confidence: Math.min(positiveCount * 0.2, 0.9), keyPhrases };
  }

  return { sentiment: 'neutral', confidence: 0.5, keyPhrases };
}
