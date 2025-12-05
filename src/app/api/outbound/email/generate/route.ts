/**
 * AI Email Generation API Route
 * POST /api/outbound/email/generate
 * Generates personalized cold emails with feature gating and usage tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { requireFeatureWithLimit, incrementFeatureUsage } from '@/lib/subscription/middleware';
import { researchProspect, ProspectData } from '@/lib/outbound/prospect-research';
import { generateColdEmail, validateEmail, EmailTemplate, EmailTone } from '@/lib/outbound/email-writer';

export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json(
        { success: false, error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    if (!prospect || !prospect.name || !prospect.company) {
      return NextResponse.json(
        { success: false, error: 'Prospect name and company are required' },
        { status: 400 }
      );
    }

    // Check feature access and usage limits
    const gateCheck = await requireFeatureWithLimit(request, orgId, 'aiEmailWriter', 1);
    if (gateCheck) return gateCheck;

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
        console.log(`[Email API] Research completed for ${prospect.company}`);
      } catch (error) {
        console.warn('[Email API] Research failed, continuing without it:', error);
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
      console.warn('[Email API] Generated email failed validation:', validation.errors);
      // Still return it but flag the issues
    }

    // Increment usage counter (only on successful generation)
    await incrementFeatureUsage(orgId, 'aiEmailWriter', 1);

    console.log(`[Email API] Email generated in ${generationTime}ms for ${prospect.name}`);

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
    console.error('[Email API] Error generating email:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to generate email',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}





