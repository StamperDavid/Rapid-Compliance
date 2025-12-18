import { NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

/**
 * Create platform-admin organization
 * Call this once to set up the organization for the landing page
 */
export async function POST() {
  try {
    const orgId = 'platform-admin';
    const now = new Date();

    // Create organization document
    await FirestoreService.set(
      COLLECTIONS.ORGANIZATIONS,
      orgId,
      {
        id: orgId,
        name: 'Platform Admin - Sales Agent',
        industry: 'AI Sales Automation',
        plan: 'enterprise',
        status: 'active',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        settings: {
          timezone: 'America/New_York',
          currency: 'USD'
        }
      },
      true // merge: don't overwrite if exists
    );

    // Enable chat widget
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/settings`,
      'chatWidget',
      {
        enabled: true,
        welcomeMessage: "Hi! I'm Jasper. How can I help you today?",
        primaryColor: '#6366f1',
        position: 'bottom-right',
        updatedAt: now.toISOString()
      },
      true
    );

    // Set default agent config
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/agentConfig`,
      'default',
      {
        selectedModel: 'openrouter/anthropic/claude-3.5-sonnet',
        modelConfig: {
          temperature: 0.7,
          maxTokens: 800,
          topP: 0.9
        },
        updatedAt: now.toISOString()
      },
      true
    );

    return NextResponse.json({
      success: true,
      message: 'Platform-admin organization created successfully!',
      orgId
    });

  } catch (error: any) {
    console.error('[Setup] Error creating platform-admin org:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create organization'
      },
      { status: 500 }
    );
  }
}
