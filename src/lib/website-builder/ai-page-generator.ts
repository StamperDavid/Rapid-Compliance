/**
 * AI Page Generator
 * Generates website pages from natural language prompts using AI
 */

import { sendUnifiedChatMessage } from '@/lib/ai/unified-ai-service';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { logger } from '@/lib/logger/logger';
import type { PageSection, PageSEO } from '@/types/website';

// ============================================================================
// Types
// ============================================================================

export interface PageGenerationOptions {
  pageType?: string;
  style?: {
    primaryColor?: string;
    tone?: string;
  };
  brandInfo?: {
    name?: string;
    tagline?: string;
    industry?: string;
  };
}

export interface GeneratedPage {
  title: string;
  slug: string;
  sections: PageSection[];
  seo: PageSEO;
}

interface AIPageResponse {
  title: string;
  slug: string;
  sections: PageSection[];
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string[];
  };
}

// ============================================================================
// Golden Master (Standing Rule #1)
// ============================================================================

/**
 * The page generator runs through a Golden Master whose `config.systemPrompt`
 * has the tenant's Brand DNA BAKED IN AT SEED TIME (Standing Rule #1). At
 * runtime we load that ONE doc and use its systemPrompt verbatim — there is NO
 * `getBrandDNA()` call and NO runtime Brand DNA merge here. The base charter
 * (page-builder craft) lives in `scripts/seed-website-page-generator-gm.js`;
 * reseed that script after any Brand DNA edit so the new voice gets baked in.
 */
const SPECIALIST_ID = 'WEBSITE_PAGE_GENERATOR';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';

interface PageGeneratorGM {
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

/**
 * Load the page generator's Golden Master and return its baked config.
 * Throws (no hardcoded fallback) when the GM is missing — a generic prompt
 * without Brand DNA is a Standing Rule #1 violation, so we fail loudly and
 * point the operator at the seed script instead of silently going off-brand.
 */
async function loadGM(industryKey: string): Promise<PageGeneratorGM> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Website Page Generator GM not found for industryKey=${industryKey}. ` +
      `Run "node scripts/seed-website-page-generator-gm.js" to seed it (Brand DNA is baked in at seed time).`,
    );
  }

  const config = gmRecord.config as Partial<PageGeneratorGM>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Website Page Generator GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  return {
    systemPrompt,
    model: config.model ?? 'gpt-4-turbo',
    temperature: config.temperature ?? 0.7,
    maxTokens: config.maxTokens ?? 4000,
  };
}

// ============================================================================
// Generator
// ============================================================================

/**
 * Generate a website page from a natural language prompt
 */
export async function generatePageFromPrompt(
  prompt: string,
  options: PageGenerationOptions = {}
): Promise<GeneratedPage> {
  const { pageType, style, brandInfo } = options;

  // Build user message with context
  const contextParts: string[] = [`Generate a website page for: ${prompt}`];

  if (pageType) {
    contextParts.push(`Page type: ${pageType}`);
  }
  if (brandInfo?.name) {
    contextParts.push(`Brand: ${brandInfo.name}`);
  }
  if (brandInfo?.tagline) {
    contextParts.push(`Tagline: ${brandInfo.tagline}`);
  }
  if (brandInfo?.industry) {
    contextParts.push(`Industry: ${brandInfo.industry}`);
  }
  if (style?.primaryColor) {
    contextParts.push(`Primary color: ${style.primaryColor}`);
  }
  if (style?.tone) {
    contextParts.push(`Tone: ${style.tone}`);
  }

  const userMessage = contextParts.join('\n');

  // Load the Golden Master — its systemPrompt has Brand DNA baked in at seed
  // time (Standing Rule #1). Used verbatim; no runtime Brand DNA merge here.
  const gm = await loadGM(DEFAULT_INDUSTRY_KEY);

  logger.info('AI page generation starting', {
    promptLength: prompt.length,
    pageType,
    model: gm.model,
    file: 'ai-page-generator.ts',
  });

  // Retry up to 2 times for JSON parse failures
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await sendUnifiedChatMessage({
        model: gm.model,
        messages: [{ role: 'user', content: userMessage }],
        systemInstruction: gm.systemPrompt,
        temperature: gm.temperature,
        maxTokens: gm.maxTokens,
      });

      // Parse AI response — strip any markdown code fences
      let jsonText = response.text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonText) as AIPageResponse;

      // Validate essential structure
      if (!parsed.title || !parsed.slug || !Array.isArray(parsed.sections)) {
        throw new Error('AI response missing required fields (title, slug, sections)');
      }

      // Ensure all sections have required fields
      const sections: PageSection[] = parsed.sections.map((section, sIdx) => ({
        id: section.id ?? `section_${sIdx + 1}`,
        type: 'section' as const,
        columns: (section.columns ?? []).map((col, cIdx) => ({
          id: col.id ?? `col_${sIdx + 1}_${cIdx + 1}`,
          width: col.width ?? 100,
          widgets: (col.widgets ?? []).map((widget, wIdx) => ({
            id: widget.id ?? `widget_${sIdx + 1}_${cIdx + 1}_${wIdx + 1}`,
            type: widget.type,
            data: widget.data ?? {},
          })),
        })),
        fullWidth: section.fullWidth ?? true,
      }));

      const result: GeneratedPage = {
        title: parsed.title,
        slug: parsed.slug,
        sections,
        seo: {
          metaTitle: parsed.seo?.metaTitle ?? parsed.title,
          metaDescription: parsed.seo?.metaDescription,
          metaKeywords: parsed.seo?.metaKeywords,
        },
      };

      logger.info('AI page generation completed', {
        title: result.title,
        sectionCount: result.sections.length,
        file: 'ai-page-generator.ts',
      });

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn('AI page generation attempt failed', {
        attempt: attempt + 1,
        error: lastError.message,
        file: 'ai-page-generator.ts',
      });

      if (attempt < 2) {
        // Brief delay before retry
        await new Promise<void>(resolve => { setTimeout(resolve, 1000); });
      }
    }
  }

  throw lastError ?? new Error('AI page generation failed after 3 attempts');
}
