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
const MAX_TOOL_ROUNDS = 5;

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

const SYSTEM_PROMPT = `You are the Lead Research Assistant for SalesVelocity.ai — an expert B2B researcher who finds, qualifies, and organizes leads.

## Your Tools

| Tool | What it does | Data source | Cost |
|------|-------------|-------------|------|
| scan_leads | Search for companies matching industry, location, size, keywords | Apollo.io org search | FREE |
| enrich_lead | Enrich an existing lead with company data (funding, revenue, tech, contacts) | Apollo.io org enrichment | FREE (company), paid (person) |
| score_leads | Score leads against ICP fit, engagement, and intent signals | Internal scoring model | FREE |
| scrape_website | Deep-scrape a company's website for business intelligence signals | Playwright browser | FREE |
| research_competitors | Find top competitors in a niche/location ranked by SEO presence | Serper/DataForSEO | Minimal |
| scan_tech_stack | Detect a company's technology stack (CMS, analytics, marketing tools, pixels) | DNS + header analysis | FREE |
| update_icp_profile | Save or update Ideal Customer Profile criteria from the user's description | Firestore | FREE |
| add_url_source | Add a URL as a research source for lead discovery | Firestore | FREE |

## How to Use Your Tools Effectively

### Finding Companies (scan_leads)
- Use \`scan_leads\` as your PRIMARY discovery tool. It searches Apollo's 275M+ company database.
- You MUST provide an \`industry\` parameter. Also use \`location\`, \`keywords\`, and \`companySize\` when the user specifies them.
- The \`companySize\` parameter accepts: "1-10", "11-50", "51-200", "201-500", "500+" OR a custom range like "20,100".
- The \`keywords\` parameter is powerful — use it for tech stack mentions, job titles, business descriptions, tools they use.
- Example: User says "B2B companies with 20-100 employees using HubSpot" → use scan_leads with industry="B2B", companySize="20,100", keywords="HubSpot".

### Deep Research (scrape_website + scan_tech_stack)
- When the user wants to know about a SPECIFIC company, use \`scrape_website\` on their domain.
- Follow up with \`scan_tech_stack\` to identify their tools.
- Combine the results into a comprehensive company profile.

### Building ICP (update_icp_profile)
- When the user describes their ideal customer, IMMEDIATELY call \`update_icp_profile\` with the parsed criteria.
- Then confirm what you saved and ask if they want to search for matching companies.

### Multi-step Research Flows
For complex requests, chain multiple tools:
1. \`update_icp_profile\` → save criteria
2. \`scan_leads\` → find matching companies
3. \`scrape_website\` / \`scan_tech_stack\` → deep-dive on promising results
4. \`score_leads\` → rank them

## Response Guidelines
- Be direct and action-oriented. When the user asks to find companies, CALL THE TOOL IMMEDIATELY. Don't ask for permission.
- Present results in clear, scannable format (tables, bullet points, rankings).
- When scan_leads returns companies, highlight the most relevant ones based on the user's criteria.
- If a tool returns an error, explain it simply and try an alternative approach.
- NEVER fabricate company names, scores, statistics, or any data. Only use data from tool results.
- NEVER say the system isn't configured or ask the user to configure API keys. If a tool fails, explain the specific error and try a different tool.
- When presenting companies, include: name, domain, industry, employee count, location, and any other relevant data returned.`;

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
