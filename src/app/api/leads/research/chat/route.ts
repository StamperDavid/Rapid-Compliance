/**
 * Lead Research Chat — POST /api/leads/research/chat
 *
 * AI chat endpoint for the Lead Research page. Uses OpenRouter + Claude 3.5 Sonnet
 * with a focused 8-tool subset for lead research operations.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { OpenRouterProvider, type ChatMessage, type ChatCompletionResponse } from '@/lib/ai/openrouter-provider';
import type { ModelName } from '@/types/ai-models';
import { requireAuth } from '@/lib/auth/api-auth';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import { LEAD_RESEARCH_TOOLS, executeLeadResearchToolCalls } from '@/lib/orchestrator/lead-research-tools';

export const dynamic = 'force-dynamic';

const MODEL = 'anthropic/claude-3.5-sonnet' as unknown as ModelName;
const MAX_TOOL_ROUNDS = 3;

const requestSchema = z.object({
  message: z.string().min(1, 'message is required'),
  conversationHistory: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })
  ).default([]),
  icpProfileId: z.string().optional(),
});

const SYSTEM_PROMPT = `You are the Lead Research Assistant for SalesVelocity.ai. Your job is to help users find, qualify, and organize potential leads.

You have access to these tools:
- scan_leads: Search for companies matching criteria
- enrich_lead: Get detailed company data
- score_leads: Score leads against engagement/fit/intent signals
- scrape_website: Extract business intelligence from a URL
- research_competitors: Find competitors in a niche
- scan_tech_stack: Identify a company's technology stack
- update_icp_profile: Create or update the Ideal Customer Profile based on user's criteria
- add_url_source: Add a URL as a research source

When the user describes their ideal customer (industry, company size, location, tech stack, etc.), use update_icp_profile to save those criteria. When they ask to find companies, use scan_leads or research_competitors. When they mention a specific URL, use scrape_website or add_url_source.

Be conversational and helpful. Summarize results clearly. Always explain what you're doing and what you found.

IMPORTANT: Only use data from tool results. Never fabricate company names, scores, or statistics.`;

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const body: unknown = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { message, conversationHistory } = parsed.data;
    const userId = authResult.user.uid;

    // Build message array
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory.map(m => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    const provider = new OpenRouterProvider(PLATFORM_ID);

    // Tool-calling loop (up to MAX_TOOL_ROUNDS)
    let finalContent = '';
    const allToolCalls: Array<{ name: string; args: Record<string, unknown>; result?: string }> = [];
    let metadata: Record<string, unknown> | undefined;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response: ChatCompletionResponse = await provider.chatWithTools({
        model: MODEL,
        messages,
        tools: LEAD_RESEARCH_TOOLS,
        toolChoice: 'auto',
        temperature: 0.3,
        maxTokens: 2000,
      });

      if (response.toolCalls && response.toolCalls.length > 0) {
        // Add the assistant's tool-calling message
        messages.push({
          role: 'assistant',
          content: response.content || '',
          tool_calls: response.toolCalls,
        });

        // Execute tools
        const toolResults = await executeLeadResearchToolCalls(
          response.toolCalls,
          { userId, conversationId: 'lead-research' }
        );

        // Track tool calls for response
        for (const tc of response.toolCalls) {
          const tcArgs = tc.function.arguments
            ? (JSON.parse(tc.function.arguments) as Record<string, unknown>)
            : {};
          const matchingResult = toolResults.find(r => r.tool_call_id === tc.id);
          allToolCalls.push({
            name: tc.function.name,
            args: tcArgs,
            result: matchingResult?.content,
          });

          // Extract metadata from ICP/discovery tool results
          if (tc.function.name === 'update_icp_profile' && matchingResult) {
            try {
              const toolOutput = JSON.parse(matchingResult.content) as Record<string, unknown>;
              metadata = { ...metadata, icpProfileId: toolOutput.profileId as string };
            } catch { /* ignore parse errors */ }
          }
        }

        // Add tool results to conversation
        for (const tr of toolResults) {
          messages.push({
            role: 'tool',
            content: tr.content,
            tool_call_id: tr.tool_call_id,
          });
        }

        // Continue loop for next round
        continue;
      }

      // No tool calls — final response
      finalContent = response.content;
      break;
    }

    // If we exhausted rounds without a final text response, get one more
    if (!finalContent) {
      const finalResponse = await provider.chatWithTools({
        model: MODEL,
        messages,
        temperature: 0.3,
        maxTokens: 2000,
      });
      finalContent = finalResponse.content;
    }

    return NextResponse.json({
      message: finalContent,
      toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
      metadata,
    });
  } catch (error: unknown) {
    logger.error('[Lead Research Chat] Error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Lead research chat failed' },
      { status: 500 }
    );
  }
}
