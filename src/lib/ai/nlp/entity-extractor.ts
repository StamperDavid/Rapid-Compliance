/**
 * Entity Extraction
 * Extract and track entities from conversations
 */

import type { ChatRequest } from '@/types/ai-models';
import { sendChatRequest } from '../model-provider';

export interface ExtractedEntity {
  type: 'person' | 'company' | 'product' | 'email' | 'phone' | 'date' | 'money' | 'location' | 'custom';
  value: string;
  confidence: number; // 0-100
  context: string; // The sentence it was found in
}

export interface ConversationEntities {
  conversationId: string;
  entities: Record<string, ExtractedEntity[]>; // Keyed by entity type
  
  // Structured data
  customer: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    industry?: string;
    location?: string;
  };
  
  intent: {
    primary: string;
    confidence: number;
    subIntents: string[];
  };
  
  products: string[];
  budget?: {
    amount: number;
    currency: string;
  };
  timeline?: string;
  painPoints: string[];
  objections: string[];
  
  updatedAt: string;
}

/**
 * Extract entities from a message
 */
export async function extractEntities(
  message: string,
  model: string = 'gpt-4-turbo'
): Promise<ExtractedEntity[]> {
  try {
    const request: ChatRequest = {
      model: model as any,
      messages: [
        {
          role: 'system',
          content: `You are an entity extraction system. Extract all relevant entities from the user's message.
          
Return a JSON array of entities with this format:
[
  {"type": "person|company|product|email|phone|date|money|location|custom", "value": "...", "confidence": 0-100, "context": "sentence it was found in"}
]

Be precise and only extract entities you're confident about.`,
        },
        {
          role: 'user',
          content: message,
        },
      ],
      temperature: 0.1, // Low temperature for extraction
      maxTokens: 1000,
    };
    
    const response = await sendChatRequest(request);
    
    // Parse JSON from response
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const entities = JSON.parse(jsonMatch[0]);
      return entities;
    }
    
    return [];
  } catch (error: any) {
    console.error('[Entity Extractor] Error:', error);
    return [];
  }
}

/**
 * Update conversation entities
 */
export async function updateConversationEntities(
  conversationId: string,
  newMessage: string,
  currentEntities: ConversationEntities
): Promise<ConversationEntities> {
  // Extract entities from new message
  const extractedEntities = await extractEntities(newMessage);
  
  // Merge with existing entities
  const updated = { ...currentEntities };
  
  for (const entity of extractedEntities) {
    if (!updated.entities[entity.type]) {
      updated.entities[entity.type] = [];
    }
    
    // Check if entity already exists
    const exists = updated.entities[entity.type].some(
      e => e.value.toLowerCase() === entity.value.toLowerCase()
    );
    
    if (!exists) {
      updated.entities[entity.type].push(entity);
    }
    
    // Update structured data
    updateStructuredData(updated, entity);
  }
  
  updated.updatedAt = new Date().toISOString();
  
  return updated;
}

/**
 * Update structured data from entity
 */
function updateStructuredData(
  entities: ConversationEntities,
  entity: ExtractedEntity
): void {
  switch (entity.type) {
    case 'person':
      if (!entities.customer.name) {
        entities.customer.name = entity.value;
      }
      break;
    
    case 'company':
      if (!entities.customer.company) {
        entities.customer.company = entity.value;
      }
      break;
    
    case 'email':
      if (!entities.customer.email) {
        entities.customer.email = entity.value;
      }
      break;
    
    case 'phone':
      if (!entities.customer.phone) {
        entities.customer.phone = entity.value;
      }
      break;
    
    case 'location':
      if (!entities.customer.location) {
        entities.customer.location = entity.value;
      }
      break;
    
    case 'product':
      if (!entities.products.includes(entity.value)) {
        entities.products.push(entity.value);
      }
      break;
    
    case 'money':
      if (!entities.budget) {
        // Parse money value
        const match = entity.value.match(/\$?([\d,]+)/);
        if (match) {
          entities.budget = {
            amount: parseFloat(match[1].replace(/,/g, '')),
            currency: 'USD',
          };
        }
      }
      break;
  }
}

/**
 * Extract intent from message
 */
export async function extractIntent(
  message: string,
  model: string = 'gpt-4-turbo'
): Promise<{
  primary: string;
  confidence: number;
  subIntents: string[];
}> {
  try {
    const request: ChatRequest = {
      model: model as any,
      messages: [
        {
          role: 'system',
          content: `Classify the user's intent. Return JSON:
{
  "primary": "information_seeking|purchase_intent|support_request|scheduling|objection|comparison|pricing_inquiry|general_chat",
  "confidence": 0-100,
  "subIntents": ["array", "of", "sub-intents"]
}`,
        },
        {
          role: 'user',
          content: message,
        },
      ],
      temperature: 0.1,
      maxTokens: 200,
    };
    
    const response = await sendChatRequest(request);
    
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return {
      primary: 'general_chat',
      confidence: 50,
      subIntents: [],
    };
  } catch (error: any) {
    console.error('[Intent Extractor] Error:', error);
    return {
      primary: 'general_chat',
      confidence: 50,
      subIntents: [],
    };
  }
}

/**
 * Track pain points and objections
 */
export async function extractPainPointsAndObjections(
  message: string,
  model: string = 'gpt-4-turbo'
): Promise<{
  painPoints: string[];
  objections: string[];
}> {
  try {
    const request: ChatRequest = {
      model: model as any,
      messages: [
        {
          role: 'system',
          content: `Identify pain points and objections in the user's message. Return JSON:
{
  "painPoints": ["array of pain points or problems mentioned"],
  "objections": ["array of objections or concerns"]
}`,
        },
        {
          role: 'user',
          content: message,
        },
      ],
      temperature: 0.1,
      maxTokens: 300,
    };
    
    const response = await sendChatRequest(request);
    
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return { painPoints: [], objections: [] };
  } catch (error: any) {
    console.error('[Pain Points Extractor] Error:', error);
    return { painPoints: [], objections: [] };
  }
}













