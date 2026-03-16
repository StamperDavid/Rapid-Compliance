/**
 * Creative Studio — Validate Provider API Key
 * POST /api/studio/providers/validate — Test a provider API key
 *
 * Makes a minimal, low-cost request to the specified provider to verify
 * the API key is valid and the account has access.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { ProviderValidateSchema, type StudioProvider } from '@/types/creative-studio';
import { logger } from '@/lib/logger/logger';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * Run a lightweight validation request for each provider.
 * Returns { valid: true } or throws with a descriptive error.
 */
async function testProviderKey(
  provider: StudioProvider,
  apiKey: string,
): Promise<{ valid: boolean; message: string }> {
  switch (provider) {
    case 'fal': {
      // GET a known model endpoint — a 401 means bad key, anything else means the key works
      const response = await fetch('https://fal.run/fal-ai/flux/schnell', {
        method: 'POST',
        headers: {
          Authorization: `Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: 'test', num_images: 0 }),
      });
      // 401/403 = bad key; 422/400 = key works but bad request (which is fine — key is valid)
      if (response.status === 401 || response.status === 403) {
        return { valid: false, message: 'fal.ai API key is invalid or unauthorized' };
      }
      return { valid: true, message: 'fal.ai API key validated' };
    }

    case 'google': {
      // List models — only needs a valid key
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      );
      if (response.status === 401 || response.status === 403) {
        return { valid: false, message: 'Google AI Studio API key is invalid or unauthorized' };
      }
      if (!response.ok) {
        const text = await response.text();
        return { valid: false, message: `Google API returned ${response.status}: ${text}` };
      }
      return { valid: true, message: 'Google AI Studio API key validated' };
    }

    case 'kling': {
      // Use the access key to hit the generations list endpoint
      const response = await fetch('https://api.klingai.com/v1/images/generations', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.status === 401 || response.status === 403) {
        return { valid: false, message: 'Kling API key is invalid or unauthorized' };
      }
      return { valid: true, message: 'Kling API key validated' };
    }

    case 'openai': {
      // List models — minimal read-only request
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (response.status === 401 || response.status === 403) {
        return { valid: false, message: 'OpenAI API key is invalid or unauthorized' };
      }
      return { valid: true, message: 'OpenAI API key validated' };
    }

    case 'hedra': {
      // Public models endpoint with key header
      const response = await fetch('https://api.hedra.com/web-app/public/models', {
        headers: { 'x-api-key': apiKey },
      });
      if (response.status === 401 || response.status === 403) {
        return { valid: false, message: 'Hedra API key is invalid or unauthorized' };
      }
      return { valid: true, message: 'Hedra API key validated' };
    }

    default: {
      const _exhaustive: never = provider;
      return { valid: false, message: `Unknown provider: ${String(_exhaustive)}` };
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    // 2. Validate body
    const body: unknown = await request.json();
    const validated = ProviderValidateSchema.parse(body);

    logger.info('Studio providers validate: testing key', {
      provider: validated.provider,
    });

    // 3. Test the key against the provider
    const result = await testProviderKey(validated.provider, validated.apiKey);

    if (!result.valid) {
      return NextResponse.json(
        { success: false, provider: validated.provider, error: result.message },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      provider: validated.provider,
      message: result.message,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      'Studio providers validate: unexpected error',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
