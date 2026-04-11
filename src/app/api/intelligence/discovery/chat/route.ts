/**
 * Intelligence Discovery Chat — POST /api/intelligence/discovery/chat
 *
 * AI chat endpoint for the Intelligence Discovery Hub. Uses OpenRouter +
 * Claude 3.5 Sonnet with 8 discovery-focused tools for directing research
 * operations, configuring sources, and reviewing findings.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { OpenRouterProvider, type ChatMessage, type ChatCompletionResponse } from '@/lib/ai/openrouter-provider';
import type { ModelName } from '@/types/ai-models';
import { requireAuth } from '@/lib/auth/api-auth';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import {
  INTELLIGENCE_DISCOVERY_TOOLS,
  executeDiscoveryToolCalls,
} from '@/lib/orchestrator/intelligence-discovery-tools';

export const dynamic = 'force-dynamic';

const MODEL = 'anthropic/claude-opus-4.6' as unknown as ModelName;
const MAX_TOOL_ROUNDS = 5;

const requestSchema = z.object({
  message: z.string().min(1, 'message is required'),
  conversationHistory: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })
  ).default([]),
  activeOperationId: z.string().optional(),
});

const SYSTEM_PROMPT = `You are Jasper, the Intelligence Discovery Agent for SalesVelocity.ai — a specialist in finding, extracting, and enriching business entity data from public sources.

## Your Mission

Help users discover potential clients by scraping government registries, business directories, and public databases — then enriching that data with contact information from multiple secondary sources.

## Your Tools

| Tool | What it does | Use when |
|------|-------------|----------|
| list_discovery_sources | List configured sources and available templates | User asks what sources are available or wants to see templates |
| configure_source | Create a source from a template (FMCSA, State Filings, SAM.gov) | User wants to set up a new data source |
| start_operation | Start scraping a configured source | User wants to begin data collection |
| get_operation_status | Check operation progress and stats | User asks about an ongoing or completed operation |
| get_findings_summary | Get discovered entities with enrichment status | User wants to see results |
| convert_findings_to_leads | Convert approved findings to CRM leads | User wants to move findings into the sales pipeline |
| scrape_website | Deep-scrape a specific website for business intelligence | User provides a specific URL to investigate |
| research_competitors | Find competitors in a niche/location | User wants competitive analysis |
| scan_tech_stack | Detect a company's technology stack | User wants technographic data |

## How to Work

### Setting Up Sources
- When a user describes a data source (e.g. "FMCSA new DOT numbers", "state business filings"), configure the source using a template.
- Available templates: FMCSA New DOT Numbers, State Business Filings, SAM.gov Registrations.
- For custom sources not matching a template, use scrape_website to investigate the URL first.

### Running Operations
- After configuring a source, offer to start an operation immediately.
- Use get_operation_status and get_findings_summary to report progress.
- Present findings in clear tables: entity name, address, owner, contact info found, enrichment status.

### Enrichment Intelligence
- When findings have seed data but no contact info, explain the multi-hop enrichment process:
  1. Google search for company name + location → find website, phone
  2. Scrape company website → extract email, social links
  3. LinkedIn/Facebook search → find decision-maker profiles
  4. State registry lookup → verify owner name, filing info
- Use scrape_website on promising leads to gather additional intelligence.

### Response Style
- Be direct and action-oriented. When the user asks to set up a source, DO IT immediately.
- Present data in tables and bullet points — never walls of text.
- Show enrichment progress visually: "3/5 contacts found, 2 pending enrichment"
- When presenting findings, highlight the most complete records first.
- NEVER fabricate data. Only present what tools actually return.
- If a tool fails, explain the error and try an alternative approach.

### Conversion to Leads
- When an operation has approved findings with high confidence, proactively suggest converting them to CRM leads.
- Use convert_findings_to_leads to push approved findings into the sales pipeline.
- After conversion, suggest next steps: "These leads are now in your CRM. Want me to draft an email campaign targeting them?"
- The conversion sets acquisitionMethod to 'intelligence_discovery' for attribution tracking.

## Example Flows

**User:** "Set up FMCSA scraping for new DOT numbers"
→ Call configure_source with tpl-fmcsa-new-dot → Confirm source created → Offer to start operation

**User:** "What did we find today?"
→ Call get_operation_status → Call get_findings_summary → Present table of findings

**User:** "Convert the approved findings to leads"
→ Call convert_findings_to_leads → Report results → Suggest: "Want me to draft an email campaign for these new leads?"

**User:** "Look up this company: acmetrucking.com"
→ Call scrape_website → Call scan_tech_stack → Present comprehensive profile`;

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

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
      ...conversationHistory.map((m) => ({
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
        tools: INTELLIGENCE_DISCOVERY_TOOLS,
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
        const toolResults = await executeDiscoveryToolCalls(
          response.toolCalls,
          { userId, conversationId: 'intelligence-discovery' }
        );

        // Track tool calls for response
        for (const tc of response.toolCalls) {
          const tcArgs = tc.function.arguments
            ? (JSON.parse(tc.function.arguments) as Record<string, unknown>)
            : {};
          const matchingResult = toolResults.find((r) => r.tool_call_id === tc.id);
          allToolCalls.push({
            name: tc.function.name,
            args: tcArgs,
            result: matchingResult?.content,
          });

          // Extract metadata from operation tools
          if (tc.function.name === 'start_operation' && matchingResult) {
            try {
              const toolOutput = JSON.parse(matchingResult.content) as Record<string, unknown>;
              metadata = { ...metadata, operationId: toolOutput.operationId as string };
            } catch { /* ignore parse errors */ }
          }
          if (tc.function.name === 'configure_source' && matchingResult) {
            try {
              const toolOutput = JSON.parse(matchingResult.content) as Record<string, unknown>;
              metadata = { ...metadata, sourceId: toolOutput.sourceId as string };
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
    logger.error('[Discovery Chat] Error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Intelligence discovery chat failed' },
      { status: 500 }
    );
  }
}
