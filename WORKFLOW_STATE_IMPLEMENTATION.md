# Workflow State Implementation - Complete

**Date:** December 29, 2025  
**Status:** ✅ Implemented  
**Purpose:** Enable automated processing and state tracking for all worker engines

---

## What Was Implemented

We implemented the 3-part plan to make your worker engines "AI-ready" by adding standardized state tracking and automation capabilities.

---

## Part 1: Workflow State Types ✅

### Created Files:
- `src/types/workflow-state.ts` - Core workflow state types

### What It Does:
Adds a standardized `workflow` object to all entities that go through the automation pipeline.

```typescript
{
  workflow: {
    stage: 'discovery',        // Current pipeline stage
    status: 'completed',       // Processing status
    lastEngine: 'discovery-engine',
    updatedAt: Date,
    retryCount: 0,
    error?: { ... }
  }
}
```

### Stages:
1. **discovery** - Data collection from web scraping
2. **scoring** - Lead quality assessment
3. **sequencing** - Outbound campaign enrollment
4. **engagement** - Active conversation
5. **converted** - Deal closed
6. **disqualified** - Removed from pipeline

### Statuses:
- **idle** - Ready to process
- **processing** - Currently being processed
- **completed** - Stage complete, ready for next
- **failed** - Processing failed
- **paused** - Manually paused
- **blocked** - Blocked by dependency

### Updated Types:
- `DiscoveredCompany` (in `discovery-engine.ts`)
- `DiscoveredPerson` (in `discovery-engine.ts`)
- `EntityMetadata` (in `src/types/entity.ts`)

---

## Part 2: Engine Runtime Types ✅

### Created Files:
- `src/types/engine-runtime.ts` - Standardized engine results

### What It Does:
Every engine now returns a consistent result format with cost/token tracking:

```typescript
interface EngineResult<T> {
  success: boolean;
  data?: T;
  error?: EngineError;
  usage: {
    tokens: number;
    tokensIn?: number;
    tokensOut?: number;
    cost: number;
    costBreakdown?: {
      llm?: number;
      proxy?: number;
      storage?: number;
    };
    durationMs: number;
    cacheHit?: boolean;
  };
  metadata?: {
    engine: string;
    version?: string;
    startedAt: Date;
    completedAt: Date;
    model?: string;
    organizationId?: string;
  };
}
```

### Key Features:
- **Cost Tracking** - Track exact $ spent per operation
- **Token Usage** - Monitor LLM token consumption
- **Performance Metrics** - Duration, cache hits, API calls
- **Error Handling** - Structured errors with retry logic
- **Batch Operations** - Aggregate stats for multiple operations

### Helper Functions:
- `createSuccessResult()` - Create success result
- `createFailureResult()` - Create error result
- `calculateLLMCost()` - Calculate cost from tokens
- `calculateScrapingCost()` - Estimate proxy costs
- `createBatchResult()` - Aggregate batch results

---

## Part 3: Discovery Dispatcher ✅

### Created Files:
- `src/lib/services/discovery-dispatcher.ts` - Queue manager
- `src/app/api/discovery/queue/process/route.ts` - HTTP trigger

### What It Does:
The "gearbox" that automates discovery processing:

1. **Query** - Find tasks where `workflow.status === 'idle'`
2. **Lock** - Set `workflow.status = 'processing'`
3. **Execute** - Call Discovery Engine
4. **Update** - Set `workflow.status = 'completed'` and `workflow.stage = 'scoring'`

### Key Functions:

#### `processDiscoveryQueue(config)`
Process all idle discovery tasks in batch.

```typescript
const result = await processDiscoveryQueue({
  batchSize: 10,        // Max tasks per batch
  concurrency: 3,       // Parallel executions
  maxRetries: 3,        // Max retry attempts
  delayMs: 2000,        // Delay between batches
  organizationId: '...' // Optional filter
});

console.log(`Processed ${result.stats.total} tasks`);
console.log(`Success: ${result.stats.succeeded}, Failed: ${result.stats.failed}`);
console.log(`Total cost: $${result.totalUsage.cost}`);
```

#### `queueDiscoveryTask(type, target, orgId, workspaceId)`
Add a new task to the queue.

```typescript
// Queue company discovery
await queueDiscoveryTask(
  'company',
  'stripe.com',
  'org_123',
  'workspace_456',
  priority: 10
);

// Queue person discovery
await queueDiscoveryTask(
  'person',
  'john@example.com',
  'org_123',
  'workspace_456'
);
```

---

## How to Use

### 1. Add Tasks to Queue

```typescript
import { queueDiscoveryTask } from '@/lib/services/discovery-dispatcher';

// When user imports leads, queue them for discovery
for (const lead of importedLeads) {
  await queueDiscoveryTask(
    'company',
    lead.domain,
    organizationId,
    workspaceId
  );
}
```

### 2. Process Queue (Manual)

```bash
# Via API
curl -X POST http://localhost:3000/api/discovery/queue/process \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 20, "concurrency": 5}'
```

### 3. Process Queue (Automated - Vercel Cron)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/discovery/queue/process",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

This runs every 10 minutes automatically.

### 4. Check Task Status

```typescript
import { db } from '@/lib/firebase-admin';

// Find all idle tasks ready for scoring
const tasksReadyForScoring = await db
  .collection('discoveryQueue')
  .where('workflow.stage', '==', 'scoring')
  .where('workflow.status', '==', 'idle')
  .get();

console.log(`${tasksReadyForScoring.size} tasks ready for scoring`);
```

---

## Database Schema

### New Collection: `discoveryQueue`

```typescript
{
  // Document ID = auto-generated
  
  type: 'company' | 'person',
  target: 'stripe.com' | 'john@example.com',
  organizationId: 'org_123',
  workspaceId: 'workspace_456',
  priority: 10,
  createdAt: Timestamp,
  
  workflow: {
    stage: 'discovery',
    status: 'idle',
    lastEngine: 'system',
    updatedAt: Timestamp,
    retryCount: 0,
    error?: {
      code: 'DISCOVERY_FAILED',
      message: 'Rate limit exceeded',
      occurredAt: Timestamp
    },
    history: [
      {
        stage: 'discovery',
        status: 'processing',
        engine: 'discovery-dispatcher',
        timestamp: Timestamp
      }
    ]
  }
}
```

---

## Next Steps

### Immediate (This Week):
1. **Create Firestore Indexes**
   ```bash
   # Add to firestore.indexes.json
   {
     "collectionGroup": "discoveryQueue",
     "queryScope": "COLLECTION",
     "fields": [
       { "fieldPath": "workflow.stage", "order": "ASCENDING" },
       { "fieldPath": "workflow.status", "order": "ASCENDING" },
       { "fieldPath": "priority", "order": "DESCENDING" },
       { "fieldPath": "createdAt", "order": "ASCENDING" }
     ]
   }
   ```

2. **Set Up Vercel Cron**
   - Add cron secret: `CRON_SECRET=your_secret_here`
   - Deploy to Vercel
   - Verify cron runs every 10 minutes

3. **Test the Flow**
   ```typescript
   // 1. Queue a task
   const taskId = await queueDiscoveryTask('company', 'stripe.com', orgId, wsId);
   
   // 2. Process queue
   const result = await processDiscoveryQueue({ batchSize: 1 });
   
   // 3. Verify task moved to 'scoring' stage
   const task = await db.collection('discoveryQueue').doc(taskId).get();
   console.log(task.data().workflow.stage); // Should be 'scoring'
   ```

### This Month:
4. **Create Scoring Dispatcher** (copy pattern from discovery-dispatcher)
   - File: `src/lib/services/scoring-dispatcher.ts`
   - Queries: `workflow.stage === 'scoring' && workflow.status === 'idle'`
   - Calls: Lead Scoring Engine
   - Updates: `workflow.stage = 'sequencing'`

5. **Create Sequence Enrollment Dispatcher**
   - File: `src/lib/services/sequence-dispatcher.ts`
   - Queries: `workflow.stage === 'sequencing' && workflow.status === 'idle'`
   - Logic: Enroll if score > threshold
   - Updates: `workflow.stage = 'engagement'`

### Future:
6. **Manager Agent Dashboard**
   - Real-time view of queue status
   - Cost per lead tracking
   - Stuck task alerts
   - Manual retry/skip buttons

7. **Cost Optimization**
   - Alert when daily budget exceeded
   - Pause processing if cost > threshold
   - Prioritize high-value leads

---

## Cost Tracking Example

```typescript
// After processing a batch
const result = await processDiscoveryQueue({ batchSize: 100 });

console.log(`
Batch Report:
-------------
Total Tasks: ${result.stats.total}
Succeeded: ${result.stats.succeeded}
Failed: ${result.stats.failed}
Success Rate: ${(result.stats.successRate * 100).toFixed(1)}%

Cost Breakdown:
---------------
LLM Costs: $${result.totalUsage.costBreakdown.llm}
Proxy Costs: $${result.totalUsage.costBreakdown.proxy}
Total Cost: $${result.totalUsage.cost}

Cost per Lead: $${(result.totalUsage.cost / result.stats.total).toFixed(4)}

Comparison:
-----------
ZoomInfo: $${result.stats.total * 1.50} (avg $1.50/contact)
Your Cost: $${result.totalUsage.cost}
Savings: $${(result.stats.total * 1.50) - result.totalUsage.cost} (${((1 - (result.totalUsage.cost / (result.stats.total * 1.50))) * 100).toFixed(1)}%)
`);
```

---

## Architecture Diagram

```
User Imports Leads
       ↓
queueDiscoveryTask() → discoveryQueue (Firestore)
       ↓
Vercel Cron (every 10 min) → /api/discovery/queue/process
       ↓
processDiscoveryQueue()
       ↓
  ┌──────────────────────────────┐
  │ 1. Find idle tasks           │
  │ 2. Lock (status=processing)  │
  │ 3. Execute Discovery Engine  │
  │ 4. Update (stage=scoring)    │
  └──────────────────────────────┘
       ↓
Ready for Scoring Dispatcher
```

---

## Testing

### Unit Tests Needed:
- [ ] `workflow-state.ts` - State transitions
- [ ] `engine-runtime.ts` - Cost calculations
- [ ] `discovery-dispatcher.ts` - Queue processing

### Integration Tests Needed:
- [ ] Full pipeline: queue → process → verify state
- [ ] Error handling and retry logic
- [ ] Concurrency limits
- [ ] Cost tracking accuracy

### Manual Testing:
```bash
# 1. Queue a task
curl -X POST http://localhost:3000/api/discovery/queue \
  -H "Content-Type: application/json" \
  -d '{
    "type": "company",
    "target": "stripe.com",
    "organizationId": "org_123",
    "workspaceId": "ws_456"
  }'

# 2. Process queue
curl -X POST http://localhost:3000/api/discovery/queue/process

# 3. Check Firestore
# Verify workflow.stage changed from 'discovery' to 'scoring'
```

---

## Success Criteria

✅ **Completed:**
- Workflow state types created
- Engine runtime types created
- Discovery dispatcher implemented
- API endpoint for triggering
- Documentation complete

🎯 **Ready For:**
- Adding tasks to queue
- Processing queue manually or via cron
- Tracking costs per operation
- Building scoring and sequence dispatchers using same pattern

🚀 **Enables:**
- Automated batch processing (no manual triggers)
- Cost tracking per lead
- Pipeline visibility (know what stage each lead is in)
- Error recovery (automatic retries)
- Foundation for Manager Agent
