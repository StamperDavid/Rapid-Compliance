# Phase 8: Jasper Command Authority - Usage Guide

## Overview

Phase 8 upgrades Jasper from a task submitter to a command authority with three major capabilities:

1. **8a. Briefing System** — Executive "while you were away" summaries
2. **8b. Approval Gateway** — Queue high-impact actions for human review
3. **8c. Command Authority** — Issue orders to any Manager, override decisions, set objectives

## Installation

The module is already integrated into the orchestrator system:

```typescript
import {
  getJasperCommandAuthority,
  type ExecutiveBriefing,
  type PendingApproval,
  type CommandResult,
} from '@/lib/orchestrator';
```

## 8a. Briefing System

### Generate Executive Briefing

When a user logs in, generate a briefing of system activity:

```typescript
import { getJasperCommandAuthority } from '@/lib/orchestrator';

const authority = getJasperCommandAuthority();
const briefing = await authority.generateExecutiveBriefing();

console.log(briefing.summary);
// "While you were away, the system processed 3 operational cycles.
//  12 inbound replies processed — 3 interested leads advanced to outreach.
//  5 pieces of content produced. 2 reviews responded to. Overall success rate: 92%."

// Department summaries
briefing.departmentSummaries.forEach(dept => {
  console.log(`${dept.department}: ${dept.status}`);
  console.log(`  Actions: ${dept.actionsCompleted} completed, ${dept.actionsPending} pending`);
  console.log(`  ${dept.keyMetric}: ${dept.keyMetricValue}`);
});

// Highlights
briefing.highlights.forEach(highlight => {
  console.log(`[${highlight.type}] ${highlight.title}`);
  console.log(`  ${highlight.description}`);
});
```

### Briefing Structure

```typescript
interface ExecutiveBriefing {
  briefingId: string;
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  summary: string; // Natural language summary
  highlights: BriefingHighlight[]; // Key events
  pendingApprovals: PendingApproval[]; // Actions awaiting approval
  departmentSummaries: DepartmentSummary[]; // Per-manager status
  metrics: BriefingMetrics; // Platform-wide stats
}
```

## 8b. Approval Gateway

### Queue Actions for Approval

Agents can request approval for high-impact actions:

```typescript
import { getJasperCommandAuthority, AGENT_IDS } from '@/lib/orchestrator';

const authority = getJasperCommandAuthority();

// Queue a review response for approval
const approvalId = authority.queueForApproval({
  requestedBy: AGENT_IDS.REPUTATION_MANAGER,
  type: 'REVIEW_RESPONSE',
  description: 'Respond to 1-star review from dissatisfied customer',
  urgency: 'HIGH',
  context: {
    reviewId: 'rev_123',
    rating: 1,
    customerName: 'John Doe',
    proposedResponse: 'We sincerely apologize...',
  },
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
});

console.log(`Approval queued: ${approvalId}`);
```

### Check if Approval is Required

Before executing an action, check if approval is needed:

```typescript
const needsApproval = authority.shouldRequireApproval({
  type: 'email_campaign',
  confidence: 85,
  recipientCount: 150,
});

if (needsApproval) {
  // Queue for approval
  authority.queueForApproval({
    requestedBy: 'MARKETING_MANAGER',
    type: 'LARGE_CAMPAIGN',
    description: 'Launch email campaign to 150 recipients',
    urgency: 'NORMAL',
    context: { campaignId: 'camp_456', recipientCount: 150 },
  });
} else {
  // Execute immediately
  await executeCampaign();
}
```

### Process Approvals

When a human reviews and decides on an approval:

```typescript
const result = await authority.processApproval(approvalId, 'APPROVED', 'Looks good');

if (result.status === 'EXECUTED') {
  console.log('Approval granted. Agent will receive signal.');
}
```

### View Pending Approvals

```typescript
const pending = authority.getPendingApprovals();

pending.forEach(approval => {
  console.log(`[${approval.urgency}] ${approval.description}`);
  console.log(`  Requested by: ${approval.requestedBy}`);
  console.log(`  Created: ${approval.createdAt.toISOString()}`);
});
```

## 8c. Command Authority

### Issue Commands to Managers

Jasper can issue direct commands to any manager:

```typescript
import { getJasperCommandAuthority, AGENT_IDS } from '@/lib/orchestrator';

const authority = getJasperCommandAuthority();

// Command the Outreach Manager to process inbound replies
const result = await authority.issueCommand(
  AGENT_IDS.OUTREACH_MANAGER,
  'PROCESS_INBOUND_REPLIES',
  {
    batchSize: 10,
    priority: 'HIGH',
  },
  'HIGH' // Command priority
);

console.log(`Command ${result.commandId}: ${result.status}`);
if (result.response) {
  console.log('Response:', result.response);
}
```

### Override Autonomous Decisions

Override a manager's decision with human judgment:

```typescript
// Override a review response
const result = await authority.overrideAutonomousDecision(
  AGENT_IDS.REPUTATION_MANAGER,
  'REVIEW_RESPONSE_OVERRIDE',
  {
    reviewId: 'rev_789',
    originalResponse: 'Standard template response',
    newResponse: 'Personalized apology with specific action plan',
    reason: 'This customer is high-value and deserves personalized attention',
  }
);

console.log(`Override ${result.commandId}: ${result.status}`);
```

### Set Strategic Objectives

Define quarterly goals for managers:

```typescript
// Set Q2 objective for Revenue Director
const result = await authority.setObjective(
  AGENT_IDS.REVENUE_DIRECTOR,
  'Increase qualified leads by 25%',
  'Q2 2026',
  '125 qualified leads'
);

console.log(`Objective set: ${result.commandId}`);
```

### View Command History

```typescript
const history = authority.getCommandHistory(10); // Last 10 commands

history.forEach(cmd => {
  console.log(`[${cmd.issuedAt.toISOString()}] ${cmd.command}`);
  console.log(`  Target: ${cmd.targetManager}`);
  console.log(`  Priority: ${cmd.priority}`);
});
```

## Integration with Operational Cycles

### Autonomous Cycle with Approval Gateway

```typescript
// In the operational cycle (cron job)
async function executeOperationalCycle() {
  const authority = getJasperCommandAuthority();

  // Step 1: Process inbound replies
  const replies = await getInboundReplies();

  for (const reply of replies) {
    const confidence = analyzeReplyConfidence(reply);

    if (authority.shouldRequireApproval({ type: 'reply', confidence })) {
      // Low confidence → queue for approval
      authority.queueForApproval({
        requestedBy: AGENT_IDS.OUTREACH_MANAGER,
        type: 'LOW_CONFIDENCE_ACTION',
        description: `Reply from ${reply.sender} requires review`,
        urgency: confidence < 50 ? 'HIGH' : 'NORMAL',
        context: { replyId: reply.id, confidence },
      });
    } else {
      // High confidence → process autonomously
      await processReplyAutonomously(reply);
    }
  }

  // Step 2: Generate briefing for next user login
  await authority.generateExecutiveBriefing();
}
```

## API Route Example

```typescript
// app/api/jasper/briefing/route.ts
import { NextResponse } from 'next/server';
import { getJasperCommandAuthority } from '@/lib/orchestrator';

export async function GET() {
  try {
    const authority = getJasperCommandAuthority();
    const briefing = await authority.generateExecutiveBriefing();

    return NextResponse.json({
      success: true,
      briefing,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to generate briefing' },
      { status: 500 }
    );
  }
}

// app/api/jasper/approvals/route.ts
export async function GET() {
  const authority = getJasperCommandAuthority();
  const pending = authority.getPendingApprovals();

  return NextResponse.json({ success: true, approvals: pending });
}

export async function POST(request: Request) {
  const { approvalId, decision, reason } = await request.json();
  const authority = getJasperCommandAuthority();

  const result = await authority.processApproval(approvalId, decision, reason);

  return NextResponse.json({ success: true, result });
}
```

## Dashboard Integration

```typescript
// components/ExecutiveDashboard.tsx
'use client';

import { useEffect, useState } from 'react';
import type { ExecutiveBriefing } from '@/lib/orchestrator';

export function ExecutiveDashboard() {
  const [briefing, setBriefing] = useState<ExecutiveBriefing | null>(null);

  useEffect(() => {
    fetch('/api/jasper/briefing')
      .then(res => res.json())
      .then(data => setBriefing(data.briefing));
  }, []);

  if (!briefing) return <div>Loading briefing...</div>;

  return (
    <div className="dashboard">
      <h1>Executive Briefing</h1>
      <p className="summary">{briefing.summary}</p>

      <section className="highlights">
        <h2>Key Highlights</h2>
        {briefing.highlights.map((h, i) => (
          <div key={i} className={`highlight ${h.type.toLowerCase()}`}>
            <strong>{h.title}</strong>
            <p>{h.description}</p>
          </div>
        ))}
      </section>

      <section className="departments">
        <h2>Department Status</h2>
        {briefing.departmentSummaries.map((dept, i) => (
          <div key={i} className={`department ${dept.status.toLowerCase()}`}>
            <h3>{dept.department}</h3>
            <p>{dept.keyMetric}: {dept.keyMetricValue}</p>
            <p>{dept.actionsCompleted} completed, {dept.actionsPending} pending</p>
          </div>
        ))}
      </section>

      <section className="approvals">
        <h2>Pending Approvals ({briefing.pendingApprovals.length})</h2>
        {briefing.pendingApprovals.map((approval, i) => (
          <div key={i} className="approval">
            <strong>{approval.description}</strong>
            <button onClick={() => handleApproval(approval.approvalId, 'APPROVED')}>
              Approve
            </button>
            <button onClick={() => handleApproval(approval.approvalId, 'REJECTED')}>
              Reject
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
```

## Best Practices

1. **Generate briefings after each operational cycle** — Store them in MemoryVault for historical access
2. **Set approval thresholds strategically** — Balance autonomy with control
3. **Use command authority sparingly** — Let managers operate autonomously when possible
4. **Monitor command history** — Track patterns of overrides and interventions
5. **Expire approvals** — Set expiration times to prevent stale approval queues

## Next Steps

Phase 8 is now complete. Future enhancements could include:

- **9. Learning System** — Jasper learns from approval patterns and adjusts thresholds
- **10. Multi-User Approval Workflows** — Route approvals to appropriate stakeholders
- **11. Approval Analytics** — Dashboard showing approval patterns and bottlenecks
- **12. Command Templates** — Pre-defined command sequences for common scenarios

---

**Status:** Phase 8 Implemented ✓
**Module:** `src/lib/orchestrator/jasper-command-authority.ts`
**Tests:** `src/lib/orchestrator/jasper-command-authority.test.ts`
**Last Updated:** February 7, 2026
