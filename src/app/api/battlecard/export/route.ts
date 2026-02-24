/**
 * POST /api/battlecard/export
 *
 * Generates a downloadable HTML file from a battlecard object.
 * Client-side window.print() converts to PDF.
 * Auth-gated.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { logger } from '@/lib/logger/logger';

// ---------------------------------------------------------------------------
// Zod Schema — mirrors the Battlecard interface loosely for transport
// ---------------------------------------------------------------------------

const FeatureSchema = z.object({
  featureName: z.string(),
  us: z.enum(['yes', 'no', 'partial', 'unknown']),
  them: z.enum(['yes', 'no', 'partial', 'unknown']),
  advantage: z.enum(['us', 'them', 'neutral']),
  notes: z.string().optional(),
});

const BattlecardSchema = z.object({
  id: z.string(),
  ourProduct: z.string(),
  competitorId: z.string(),
  competitorName: z.string(),
  competitorDomain: z.string(),
  featureComparison: z.array(
    z.object({
      category: z.string(),
      features: z.array(FeatureSchema),
    })
  ),
  pricingComparison: z.object({
    ourPositioning: z.string(),
    theirPositioning: z.string(),
    advantage: z.enum(['us', 'them', 'neutral']),
    keyDifferences: z.array(z.string()),
    valueJustification: z.array(z.string()),
  }),
  tactics: z.object({
    idealSituations: z.array(
      z.object({ situation: z.string(), reasoning: z.string(), talkTrack: z.string() })
    ),
    challengingSituations: z.array(
      z.object({ situation: z.string(), reasoning: z.string(), mitigation: z.string() })
    ),
    objectionHandling: z.array(
      z.object({ objection: z.string(), response: z.string(), proofPoints: z.array(z.string()) })
    ),
    competitiveTraps: z.array(
      z.object({ trap: z.string(), setup: z.string(), delivery: z.string() })
    ),
  }),
  discoveryQuestions: z.object({
    qualifyingQuestions: z.array(z.string()),
    landmineQuestions: z.array(z.string()),
  }),
  keyMessages: z.object({
    elevator: z.string(),
    executiveSummary: z.string(),
    riskMitigation: z.array(z.string()),
  }),
  metadata: z.object({
    generatedAt: z.union([z.string(), z.date()]),
    expiresAt: z.union([z.string(), z.date()]),
    confidence: z.number(),
    source: z.literal('battlecard-engine'),
    version: z.number(),
  }),
});

const ExportSchema = z.object({
  battlecard: BattlecardSchema,
});

// ---------------------------------------------------------------------------
// HTML Builder
// ---------------------------------------------------------------------------

function advantageBadge(adv: 'us' | 'them' | 'neutral'): string {
  const colors: Record<string, string> = {
    us: 'background:#dcfce7;color:#166534',
    them: 'background:#fee2e2;color:#991b1b',
    neutral: 'background:#f3f4f6;color:#374151',
  };
  return `<span style="padding:2px 8px;border-radius:4px;font-size:12px;${colors[adv]}">${adv.toUpperCase()}</span>`;
}

function capabilityIcon(val: 'yes' | 'no' | 'partial' | 'unknown'): string {
  const map: Record<string, string> = { yes: '&#10003;', no: '&#10007;', partial: '~', unknown: '?' };
  return map[val] ?? '?';
}

function buildHtml(bc: z.infer<typeof BattlecardSchema>): string {
  const genDate = typeof bc.metadata.generatedAt === 'string'
    ? bc.metadata.generatedAt
    : new Date(bc.metadata.generatedAt).toISOString();

  // Feature comparison rows
  const featureRows = bc.featureComparison
    .flatMap((cat) =>
      cat.features.map(
        (f) =>
          `<tr>
            <td>${cat.category}</td>
            <td>${f.featureName}</td>
            <td style="text-align:center">${capabilityIcon(f.us)}</td>
            <td style="text-align:center">${capabilityIcon(f.them)}</td>
            <td style="text-align:center">${advantageBadge(f.advantage)}</td>
          </tr>`
      )
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Battlecard: ${bc.ourProduct} vs ${bc.competitorName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;padding:40px;max-width:900px;margin:auto}
  h1{font-size:24px;margin-bottom:4px}
  h2{font-size:18px;margin:24px 0 12px;padding-bottom:6px;border-bottom:2px solid #e5e7eb}
  h3{font-size:15px;margin:16px 0 8px}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  th,td{border:1px solid #e5e7eb;padding:8px 12px;text-align:left;font-size:13px}
  th{background:#f9fafb;font-weight:600}
  .meta{font-size:12px;color:#6b7280;margin-bottom:24px}
  .card{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:12px}
  .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:500}
  ul,ol{margin-left:20px;font-size:13px;line-height:1.6}
  @media print{body{padding:20px}}
</style>
</head>
<body>
<h1>${bc.ourProduct} vs ${bc.competitorName}</h1>
<div class="meta">Generated: ${genDate} &middot; Confidence: ${bc.metadata.confidence}% &middot; ${bc.competitorDomain}</div>

<!-- Key Messages -->
<h2>Key Messages</h2>
<div class="card">
  <h3>Elevator Pitch</h3>
  <p style="font-size:14px;margin-bottom:12px">${bc.keyMessages.elevator}</p>
  <h3>Executive Summary</h3>
  <p style="font-size:14px;margin-bottom:12px">${bc.keyMessages.executiveSummary}</p>
  <h3>Risk Mitigation</h3>
  <ul>${bc.keyMessages.riskMitigation.map((r) => `<li>${r}</li>`).join('')}</ul>
</div>

<!-- Feature Comparison -->
<h2>Feature Comparison</h2>
<table>
  <thead><tr><th>Category</th><th>Feature</th><th>${bc.ourProduct}</th><th>${bc.competitorName}</th><th>Advantage</th></tr></thead>
  <tbody>${featureRows}</tbody>
</table>

<!-- Pricing -->
<h2>Pricing Comparison</h2>
<div class="card">
  <p><strong>Our Positioning:</strong> ${bc.pricingComparison.ourPositioning}</p>
  <p><strong>Their Positioning:</strong> ${bc.pricingComparison.theirPositioning}</p>
  <p><strong>Advantage:</strong> ${advantageBadge(bc.pricingComparison.advantage)}</p>
  <h3>Key Differences</h3>
  <ul>${bc.pricingComparison.keyDifferences.map((d) => `<li>${d}</li>`).join('')}</ul>
  <h3>Value Justification</h3>
  <ul>${bc.pricingComparison.valueJustification.map((v) => `<li>${v}</li>`).join('')}</ul>
</div>

<!-- Tactics: Ideal Situations -->
<h2>When We Win</h2>
${bc.tactics.idealSituations
  .map(
    (s) => `<div class="card"><h3>${s.situation}</h3><p style="font-size:13px"><em>${s.reasoning}</em></p><p style="font-size:13px;margin-top:6px"><strong>Talk Track:</strong> ${s.talkTrack}</p></div>`
  )
  .join('')}

<!-- Tactics: Challenging Situations -->
<h2>When They Might Win</h2>
${bc.tactics.challengingSituations
  .map(
    (s) => `<div class="card"><h3>${s.situation}</h3><p style="font-size:13px"><em>${s.reasoning}</em></p><p style="font-size:13px;margin-top:6px"><strong>Mitigation:</strong> ${s.mitigation}</p></div>`
  )
  .join('')}

<!-- Objection Handling -->
<h2>Objection Handling</h2>
${bc.tactics.objectionHandling
  .map(
    (o) => `<div class="card"><h3>${o.objection}</h3><p style="font-size:13px">${o.response}</p><h3 style="margin-top:8px">Proof Points</h3><ul>${o.proofPoints.map((p) => `<li>${p}</li>`).join('')}</ul></div>`
  )
  .join('')}

<!-- Competitive Traps -->
<h2>Competitive Traps</h2>
${bc.tactics.competitiveTraps
  .map(
    (t) => `<div class="card"><h3>${t.trap}</h3><p style="font-size:13px"><strong>Setup:</strong> ${t.setup}</p><p style="font-size:13px"><strong>Delivery:</strong> ${t.delivery}</p></div>`
  )
  .join('')}

<!-- Discovery Questions -->
<h2>Discovery Questions</h2>
<div class="card">
  <h3>Qualifying Questions</h3>
  <ol>${bc.discoveryQuestions.qualifyingQuestions.map((q) => `<li>${q}</li>`).join('')}</ol>
  <h3 style="margin-top:12px">Landmine Questions</h3>
  <ol>${bc.discoveryQuestions.landmineQuestions.map((q) => `<li>${q}</li>`).join('')}</ol>
</div>

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// POST Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body: unknown = await request.json();
    const parsed = ExportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid battlecard data' },
        { status: 400 }
      );
    }

    const html = buildHtml(parsed.data.battlecard);
    const filename = `battlecard-${parsed.data.battlecard.competitorName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.html`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    logger.error('Battlecard export error', err instanceof Error ? err : new Error(String(err)));
    return errors.internal(
      'Failed to export battlecard',
      err instanceof Error ? err : undefined
    );
  }
}
