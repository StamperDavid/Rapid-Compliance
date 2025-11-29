import { NextRequest, NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { requireAuth } from '@/lib/auth/api-auth';

/**
 * GET: Load agent configuration
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID required' },
        { status: 400 }
      );
    }

    // Get agent configuration
    const agentConfig = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/agentConfig`,
      'default'
    );

    if (!agentConfig) {
      // Return defaults if no config exists
      return NextResponse.json({
        success: true,
        aiMode: 'ensemble',
        ensembleMode: 'best',
        useEnsemble: true,
        model: 'gemini-2.0-flash-exp',
        modelConfig: {
          temperature: 0.7,
          maxTokens: 2048,
          topP: 0.9,
        },
      });
    }

    return NextResponse.json({
      success: true,
      ...(agentConfig as any),
    });
  } catch (error: any) {
    console.error('Error loading agent config:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST: Save agent configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId, aiMode, ensembleMode, model, modelConfig, useEnsemble } = body;

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID required' },
        { status: 400 }
      );
    }

    // Save agent configuration
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/agentConfig`,
      'default',
      {
        aiMode: aiMode || 'ensemble',
        ensembleMode: ensembleMode || 'best',
        useEnsemble: useEnsemble !== false,
        model: model || 'gemini-2.0-flash-exp',
        modelConfig: modelConfig || {
          temperature: 0.7,
          maxTokens: 2048,
          topP: 0.9,
        },
        updatedAt: new Date().toISOString(),
      },
      false
    );

    return NextResponse.json({
      success: true,
      message: 'AI configuration saved successfully',
    });
  } catch (error: any) {
    console.error('Error saving agent config:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

