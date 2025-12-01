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
      // Return defaults if no config exists (single model - ensemble removed for MVP)
      return NextResponse.json({
        success: true,
        selectedModel: 'gpt-4-turbo',
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
    const { orgId, selectedModel, modelConfig } = body;

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID required' },
        { status: 400 }
      );
    }

    // Save agent configuration (single model - ensemble removed for MVP)
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/agentConfig`,
      'default',
      {
        selectedModel: selectedModel || 'gpt-4-turbo',
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

