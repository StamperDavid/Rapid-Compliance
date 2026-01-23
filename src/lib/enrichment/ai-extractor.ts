/**
 * AI-Powered Data Extraction
 * Uses LLMs with structured outputs to extract company data from scraped content
 * Layer 3: Schema-First Extraction
 */

import type { CompanyEnrichmentData, ScrapedContent } from './types'
import { logger } from '../logger/logger';

/**
 * Extract structured company data from scraped content using AI
 * This uses OpenAI's structured outputs to guarantee the format
 * 
 * @param scrapedContent - Scraped website content
 * @param companyName - Company name for context
 * @param industryTemplateId - Optional industry template ID for better extraction
 */
export async function extractCompanyData(
  scrapedContent: ScrapedContent,
  companyName: string,
  industryTemplateId?: string
): Promise<Partial<CompanyEnrichmentData>> {
  logger.info('AI Extractor Extracting data for: companyName}', { 
    file: 'ai-extractor.ts',
    industry: industryTemplateId 
  });
  
  try {
    // Get OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      logger.warn('[AI Extractor] OPENAI_API_KEY not configured, using fallback extraction', { file: 'ai-extractor.ts' });
      return fallbackExtraction(scrapedContent, companyName);
    }
    
    // Prepare the prompt (industry-aware if template provided)
    const prompt = buildExtractionPrompt(scrapedContent, companyName, industryTemplateId);
    
    // Call OpenAI with structured output
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Cheap and fast
        messages: [
          {
            role: 'system',
            content: 'You are a company data extraction specialist. Extract accurate, factual information from website content. If information is not found, use null.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'company_data',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                industry: { type: 'string' },
                size: { 
                  type: 'string',
                  enum: ['startup', 'small', 'medium', 'enterprise', 'unknown']
                },
                employeeCount: { type: ['number', 'null'] },
                employeeRange: { type: ['string', 'null'] },
                headquarters: {
                  type: 'object',
                  properties: {
                    city: { type: ['string', 'null'] },
                    state: { type: ['string', 'null'] },
                    country: { type: ['string', 'null'] },
                  },
                  required: ['city', 'state', 'country'],
                  additionalProperties: false,
                },
                foundedYear: { type: ['number', 'null'] },
                revenue: { type: ['string', 'null'] },
                fundingStage: { type: ['string', 'null'] },
                contactEmail: { type: ['string', 'null'] },
                contactPhone: { type: ['string', 'null'] },
              },
              required: [
                'name',
                'description',
                'industry',
                'size',
                'employeeCount',
                'employeeRange',
                'headquarters',
                'foundedYear',
                'revenue',
                'fundingStage',
                'contactEmail',
                'contactPhone',
              ],
              additionalProperties: false,
            },
          },
        },
        temperature: 0.1, // Low temperature for factual extraction
        max_tokens: 500,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      const apiError = new Error(`OpenAI API error: ${errorText}`);
      logger.error('[AI Extractor] OpenAI API error:', apiError, { file: 'ai-extractor.ts' });
      return fallbackExtraction(scrapedContent, companyName);
    }
    
    interface OpenAIResponse {
      choices: Array<{
        message: {
          content: string;
        };
      }>;
    }

    interface ExtractedCompanyData {
      name: string;
      description: string;
      industry: string;
      size: 'startup' | 'small' | 'medium' | 'enterprise' | 'unknown';
      employeeCount: number | null;
      employeeRange: string | null;
      headquarters: {
        city: string | null;
        state: string | null;
        country: string | null;
      };
      foundedYear: number | null;
      revenue: string | null;
      fundingStage: string | null;
      contactEmail: string | null;
      contactPhone: string | null;
    }

    const data = await response.json() as OpenAIResponse;
    const extracted = JSON.parse(data.choices[0].message.content) as ExtractedCompanyData;

    logger.info('[AI Extractor] Successfully extracted data', { file: 'ai-extractor.ts' });

    return {
      name:extracted.name ?? companyName,
      description:extracted.description ?? scrapedContent.description,
      industry:(extracted.industry !== '' && extracted.industry != null) ? extracted.industry : 'Unknown',
      size: extracted.size ?? 'unknown',
      employeeCount: extracted.employeeCount ?? undefined,
      employeeRange: extracted.employeeRange ?? undefined,
      headquarters: extracted.headquarters.city ? {
        city: extracted.headquarters.city ?? undefined,
        state: extracted.headquarters.state ?? undefined,
        country: extracted.headquarters.country ?? undefined,
      } : undefined,
      foundedYear: extracted.foundedYear ?? undefined,
      revenue: extracted.revenue ?? undefined,
      fundingStage: extracted.fundingStage ?? undefined,
      contactEmail: extracted.contactEmail ?? undefined,
      contactPhone: extracted.contactPhone ?? undefined,
    };
  } catch (error: unknown) {
    const extractorError = error instanceof Error ? error : new Error(String(error));
    logger.error('[AI Extractor] Error', extractorError, { file: 'ai-extractor.ts' });
    return fallbackExtraction(scrapedContent, companyName);
  }
}

/**
 * Build extraction prompt
 * 
 * @param content - Scraped content
 * @param companyName - Company name
 * @param industryTemplateId - Optional industry for better context
 */
function buildExtractionPrompt(
  content: ScrapedContent, 
  companyName: string,
  industryTemplateId?: string
): string {
  // Industry-specific hints for better extraction
  const industryContext = getIndustryContext(industryTemplateId);
  
  return `Extract company information from the following website content for "${companyName}".

Website: ${content.url}
Title: ${content.title}
Meta Description: ${content.description}${industryContext ? `\n\nIndustry Context: ${industryContext}` : ''}

Content (first 3000 characters):
${content.cleanedText.substring(0, 3000)}

Extract the following information:
- Company name (official name)
- Description (1-2 sentence summary of what the company does)
- Industry (e.g., SaaS, E-commerce, Manufacturing, Consulting${industryContext ? `, or ${industryContext}` : ''})
- Company size (startup: <50, small: 50-200, medium: 200-1000, enterprise: 1000+)
- Employee count (if mentioned)
- Employee range (if mentioned, e.g., "50-200")
- Headquarters location (city, state, country)
- Founded year
- Revenue (if mentioned)
- Funding stage (if mentioned: seed, series A, series B, etc.)
- Contact email
- Contact phone

Be factual and precise. If information is not available, use null.`;
}

/**
 * Get industry-specific context for better AI extraction
 */
function getIndustryContext(industryTemplateId?: string): string | null {
  if (!industryTemplateId) {return null;}
  
  const industryContextMap: Record<string, string> = {
    'hvac': 'HVAC/Heating & Cooling services company',
    'saas-software': 'Software-as-a-Service (SaaS) technology company',
    'residential-real-estate': 'Residential real estate agency or agent',
    'gyms-crossfit': 'Fitness gym or CrossFit facility',
    'dental-practices': 'Dental practice or dentistry clinic',
    'ecommerce-d2c': 'Direct-to-consumer e-commerce brand',
    'law-personal-injury': 'Personal injury law firm',
    'roofing': 'Roofing contractor or services company',
    'mexican-restaurant': 'Mexican restaurant',
    'digital-marketing': 'Digital marketing agency',
  };
  
  return industryContextMap[industryTemplateId] || null;
}

/**
 * Fallback extraction without AI
 * Uses simple regex and keyword matching
 */
function fallbackExtraction(
  content: ScrapedContent,
  companyName: string
): Partial<CompanyEnrichmentData> {
  const text = content.cleanedText.toLowerCase();
  
  // Try to determine industry from keywords
  let industry = 'Unknown';
  if (text.includes('software') || text.includes('saas') || text.includes('platform')) {
    industry = 'Software/SaaS';
  } else if (text.includes('ecommerce') || text.includes('online store') || text.includes('shop')) {
    industry = 'E-commerce';
  } else if (text.includes('marketing') || text.includes('advertising')) {
    industry = 'Marketing';
  } else if (text.includes('consulting') || text.includes('advisory')) {
    industry = 'Consulting';
  } else if (text.includes('finance') || text.includes('fintech')) {
    industry = 'Finance';
  }
  
  // Try to determine size
  let size: 'startup' | 'small' | 'medium' | 'enterprise' | 'unknown' = 'unknown';
  const employeeMatch = text.match(/(\d+)\s*(employees|team members|people)/);
  if (employeeMatch) {
    const count = parseInt(employeeMatch[1]);
    if (count < 50) {size = 'startup';}
    else if (count < 200) {size = 'small';}
    else if (count < 1000) {size = 'medium';}
    else {size = 'enterprise';}
  }
  
  // Try to find founded year
  const yearMatch =text.match(/founded\s*in\s*(\d{4})/i) ?? text.match(/since\s*(\d{4})/i);
  const foundedYear = yearMatch ? parseInt(yearMatch[1]) : undefined;
  
  return {
    name: companyName,
    description: content.description || `Company website: ${content.url}`,
    industry,
    size,
    foundedYear,
  };
}

/**
 * Extract hiring signals from content
 */
export function extractHiringSignals(content: ScrapedContent): {
  isHiring: boolean;
  signals: string[];
} {
  const text = content.cleanedText.toLowerCase();
  const signals: string[] = [];
  
  if (text.includes("we're hiring") || text.includes('now hiring')) {
    signals.push("Actively hiring");
  }
  
  if (text.includes('open positions') || text.includes('job openings')) {
    signals.push('Has open positions');
  }
  
  if (text.includes('join our team') || text.includes('careers')) {
    signals.push('Has careers page');
  }
  
  const isHiring = signals.length > 0;
  
  return { isHiring, signals };
}

/**
 * Calculate confidence score based on data completeness
 */
export function calculateConfidence(data: Partial<CompanyEnrichmentData>): number {
  let score = 0;
  const weights = {
    name: 10,
    description: 15,
    industry: 10,
    website: 10,
    domain: 5,
    employeeCount: 8,
    headquarters: 10,
    foundedYear: 7,
    techStack: 8,
    socialMedia: 7,
    contactEmail: 5,
    contactPhone: 5,
  };
  
  if (data.name) {score += weights.name;}
  if (data.description && data.description.length > 50) {score += weights.description;}
  if (data.industry && data.industry !== 'Unknown') {score += weights.industry;}
  if (data.website) {score += weights.website;}
  if (data.domain) {score += weights.domain;}
  if (data.employeeCount) {score += weights.employeeCount;}
  if (data.headquarters?.city) {score += weights.headquarters;}
  if (data.foundedYear) {score += weights.foundedYear;}
  if (data.techStack && data.techStack.length > 0) {score += weights.techStack;}
  if (data.socialMedia?.linkedin) {score += weights.socialMedia;}
  if (data.contactEmail) {score += weights.contactEmail;}
  if (data.contactPhone) {score += weights.contactPhone;}
  
  return Math.min(100, score);
}


