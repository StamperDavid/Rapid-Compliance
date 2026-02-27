/**
 * AI Email Generation API Route
 * POST /api/outbound/email/generate
 * Generates personalized cold emails with feature gating and usage tracking
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { type ProspectData, researchProspect } from '@/lib/outbound/prospect-research';
import { type EmailTemplate, type EmailTone, generateColdEmail, validateEmail } from '@/lib/outbound/email-writer';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

const EmailTemplateEnum = z.enum(['AIDA', 'PAS', 'BAB', 'custom']);
const EmailToneEnum = z.enum(['professional', 'casual', 'friendly', 'direct']);

const EmailGenerateSchema = z.object({
  prospect: z.object({
    name: z.string().min(1),
    company: z.string().min(1),
    title: z.string().optional(),
    email: z.string().email().optional(),
    linkedin: z.string().url().optional(),
  }),
  template: EmailTemplateEnum.optional().default('AIDA'),
  tone: EmailToneEnum.optional().default('professional'),
  valueProposition: z.string().optional(),
  cta: z.string().optional(),
  skipResearch: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/outbound/email/generate');
    if (rateLimitResponse) { return rateLimitResponse; }

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parsed = EmailGenerateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      prospect,
      template,
      tone,
      valueProposition,
      cta,
      skipResearch,
    } = parsed.data;

    // Penthouse model: All features available

    const prospectData: ProspectData = {
      name: prospect.name,
      company: prospect.company,
      title: prospect.title,
      email: prospect.email,
      linkedin: prospect.linkedin,
    };

    // Research prospect (optional, can skip for faster generation)
    let research = undefined;
    if (!skipResearch) {
      try {
        research = await researchProspect(prospectData);
        logger.info('Prospect research completed', { route: '/api/outbound/email/generate', company: prospectData.company });
      } catch (researchError) {
        logger.warn('Prospect research failed, continuing without it', { route: '/api/outbound/email/generate', error: researchError instanceof Error ? researchError.message : String(researchError) });
        // Continue without research - won't fail the email generation
      }
    }

    // Template and tone are already validated and narrowed by Zod enums
    const validTemplate: EmailTemplate = template;
    const validTone: EmailTone = tone;

    // Generate email using AI
    const startTime = Date.now();
    const generatedEmail = await generateColdEmail({
      prospect: prospectData,
      research,
      template: validTemplate,
      tone: validTone,
      valueProposition,
      cta,
    });
    const generationTime = Date.now() - startTime;

    // Validate email
    const validation = validateEmail(generatedEmail);
    if (!validation.valid) {
      logger.warn('Generated email failed validation', { route: '/api/outbound/email/generate', errors: validation.errors });
      // Still return it but flag the issues
    }

    // Usage tracking removed - unlimited AI email generation in new pricing model
    // Previously tracked with: incrementFeatureUsage('aiEmailWriter', 1)

    logger.info('Email generated successfully', { route: '/api/outbound/email/generate', prospect: prospectData.name, generationTime });

    return NextResponse.json({
      success: true,
      email: {
        subject: generatedEmail.subject,
        body: generatedEmail.body,
        preview: generatedEmail.preview,
        subjectVariants: generatedEmail.subjectVariants,
        personalizationScore: generatedEmail.personalizationScore,
      },
      research: research ? {
        companyInfo: research.companyInfo,
        insights: research.insights,
        recentNews: research.recentNews.slice(0, 3), // First 3 news items
      } : null,
      validation: {
        valid: validation.valid,
        warnings: validation.errors,
      },
      metadata: {
        generationTime,
        template: validTemplate,
        tone: validTone,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Email generation error', error instanceof Error ? error : new Error(String(error)), { route: '/api/outbound/email/generate' });
    return errors.externalService('AI email generation', error instanceof Error ? error : new Error(String(error)));
  }
}
