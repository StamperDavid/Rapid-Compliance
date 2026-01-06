/**
 * AI Email Generation API Route
 * POST /api/outbound/email/generate
 * Generates personalized cold emails with feature gating and usage tracking
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { requireFeatureWithLimit, incrementFeatureUsage } from '@/lib/subscription/middleware';
import type { ProspectData } from '@/lib/outbound/prospect-research';
import { researchProspect } from '@/lib/outbound/prospect-research';
import type { EmailTemplate, EmailTone } from '@/lib/outbound/email-writer';
import { generateColdEmail, validateEmail } from '@/lib/outbound/email-writer';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/outbound/email/generate');
    if (rateLimitResponse) {return rateLimitResponse;}

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { 
      orgId, 
      prospect, 
      template = 'AIDA', 
      tone = 'professional',
      valueProposition,
      cta,
      skipResearch = false 
    } = body;

    // Validate required fields
    if (!orgId) {
      return errors.badRequest('Organization ID is required');
    }

    if (!prospect?.name || !prospect.company) {
      return errors.badRequest('Prospect name and company are required');
    }

    // NEW PRICING MODEL: All features available, no usage limits
    // Feature/usage check no longer needed - unlimited AI email generation!
    // const gateCheck = await requireFeatureWithLimit(request, orgId, 'aiEmailWriter', 1);
    // if (gateCheck) return gateCheck;

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
        logger.info('Prospect research completed', { route: '/api/outbound/email/generate', company: prospect.company });
      } catch (error) {
        logger.warn('Prospect research failed, continuing without it', { route: '/api/outbound/email/generate', error });
        // Continue without research - won't fail the email generation
      }
    }

    // Generate email using AI
    const startTime = Date.now();
    const generatedEmail = await generateColdEmail({
      prospect: prospectData,
      research,
      template: template as EmailTemplate,
      tone: tone as EmailTone,
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

    // Increment usage counter (only on successful generation)
    await incrementFeatureUsage(orgId, 'aiEmailWriter', 1);

    logger.info('Email generated successfully', { route: '/api/outbound/email/generate', prospect: prospect.name, generationTime });

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
        template,
        tone,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('Email generation error', error, { route: '/api/outbound/email/generate' });
    return errors.externalService('AI email generation', error);
  }
}



















