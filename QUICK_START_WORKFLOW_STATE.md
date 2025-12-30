# Quick Start: Workflow State System

**Status:** ✅ Implementation Complete  
**Ready to Use:** Yes, after Firestore index deployment

---

## What You Got

### 1. **Workflow State Tracking** (`src/types/workflow-state.ts`)
Every entity in your pipeline now knows:
- What stage it's in (discovery, scoring, sequencing, etc.)
- What status it has (idle, processing, completed, failed)
- Who processed it last
- How many times it's been retried
- Full audit trail of its journey

### 2. **Standardized Engine Results** (`src/types/engine-runtime.ts`)
Every engine now reports:
- Success/failure
- Exact cost in USD
- Tokens consumed (LLM)
- Duration in milliseconds
- Cache hits
- Error details with retry logic

### 3. **Discovery Dispatcher** (`src/lib/services/discovery-dispatcher.ts`)
Automated queue processor that:
- Finds all idle tasks
- Locks them (prevents duplicate processing)
- Executes discovery
- Updates state based on result
- Tracks aggregate costs

### 4. **API Endpoints**
- `POST /api/discovery/queue` - Add tasks
- `POST /api/discovery/queue/process` - Process queue
- `GET /api/discovery/queue/process` - Cron-friendly endpoint

---

## How to Test (5 Minutes)

### Step 1: Deploy Firestore Indexes
```bash
firebase deploy --only firestore:indexes
```
Wait 2-3 minutes for indexes to build.

### Step 2: Queue a Test Task
```bash
curl -X POST http://localhost:3000/api/discovery/queue \
  -H "Content-Type: application/json" \
  -d '{
    "type": "company",
    "target": "stripe.com",
    "organizationId": "test_org",
    "workspaceId": "test_workspace",
    "priority": 10
  }'
```

Expected response:
```json
{
  "success": true,
  "taskId": "abc123...",
  "message": "Discovery task queued for company: stripe.com"
}
```

### Step 3: Process the Queue
```bash
curl -X POST http://localhost:3000/api/discovery/queue/process \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 1}'
```

Expected response:
```json
{
  "success": true,
  "stats": {
    "total": 1,
    "succeeded": 1,
    "failed": 0,
    "successRate": 1
  },
  "usage": {
    "totalCost": 0.006,
    "totalTokens": 2500,
    "durationMs": 8432
  }
}
```

### Step 4: Verify in Firestore
Check `discoveryQueue` collection:
- Task should now have `workflow.stage = "scoring"`
- Status should be `"idle"` (ready for next stage)
- `workflow.lastEngine = "discovery-engine"`

---

## How to Use in Production

### Option A: Manual Trigger (Testing)
```typescript
import { processDiscoveryQueue } from '@/lib/services/discovery-dispatcher';

// In your admin panel or script
const result = await processDiscoveryQueue({
  batchSize: 50,
  concurrency: 5,
  organizationId: 'org_123' // Optional filter
});

console.log(`Processed ${result.stats.total} tasks`);
console.log(`Cost: $${result.totalUsage.cost}`);
```

### Option B: Automated Cron (Production)

1. **Add to `vercel.json`:**
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

2. **Set environment variable:**
```bash
CRON_SECRET=your-secret-here
```

3. **Deploy:**
```bash
vercel --prod
```

Now it runs automatically every 10 minutes.

### Option C: On-Demand from UI

Add a button in your admin panel:

```typescript
async function runDiscovery() {
  const response = await fetch('/api/discovery/queue/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      batchSize: 20,
      concurrency: 5
    })
  });
  
  const result = await response.json();
  alert(`Processed ${result.stats.total} tasks. Cost: $${result.usage.totalCost}`);
}
```

---

## Common Use Cases

### 1. Lead Import Flow
```typescript
// When user imports 100 leads
async function importLeads(leads: Lead[]) {
  // Queue all for discovery
  for (const lead of leads) {
    await queueDiscoveryTask(
      'company',
      lead.domain,
      organizationId,
      workspaceId,
      priority: lead.priority || 0
    );
  }
  
  // Optionally: process immediately
  await processDiscoveryQueue({ batchSize: 100 });
}
```

### 2. Batch Discovery from CSV
```typescript
import { queueDiscoveryTask } from '@/lib/services/discovery-dispatcher';

// User uploads CSV with domains
const domains = parseCSV(file);

// Queue all
const promises = domains.map(domain =>
  queueDiscoveryTask('company', domain, orgId, wsId)
);

await Promise.all(promises);

console.log(`Queued ${domains.length} companies for discovery`);
```

### 3. Cost Monitoring
```typescript
// Track daily discovery costs
const result = await processDiscoveryQueue({ batchSize: 100 });

await db.collection('costTracking').add({
  date: new Date(),
  service: 'discovery',
  totalCost: result.totalUsage.cost,
  leadsProcessed: result.stats.total,
  costPerLead: result.totalUsage.cost / result.stats.total,
});

// Alert if over budget
if (result.totalUsage.cost > DAILY_BUDGET) {
  await sendAlert('Discovery budget exceeded!');
}
```

---

## Next Steps

### Immediate:
1. ✅ **Deploy Firestore indexes** (required for queries to work)
2. ✅ **Test with one task** (verify end-to-end flow)
3. ✅ **Set up Vercel Cron** (automate processing)

### This Week:
4. **Create Scoring Dispatcher** (same pattern)
   - File: `src/lib/services/scoring-dispatcher.ts`
   - Query: `workflow.stage === 'scoring'`
   - Execute: Lead Scoring Engine
   - Update: `workflow.stage = 'sequencing'`

5. **Create Sequence Dispatcher**
   - File: `src/lib/services/sequence-dispatcher.ts`
   - Query: `workflow.stage === 'sequencing'`
   - Logic: If score > 80, enroll in sequence
   - Update: `workflow.stage = 'engagement'`

### This Month:
6. **Dashboard**
   - Real-time queue status
   - Cost per stage chart
   - Stuck task alerts

7. **Cost Optimization**
   - Daily/weekly cost caps
   - Smart prioritization based on score
   - Batch similar tasks together

---

## Troubleshooting

### "Missing index" error
```
The query requires an index. You can create it here: https://...
```

**Solution:** Deploy indexes:
```bash
firebase deploy --only firestore:indexes
```

### Tasks stuck in "processing" state
If a process crashes mid-execution, tasks may be stuck.

**Solution:** Reset stuck tasks:
```typescript
const batch = db.batch();
const stuckTasks = await db.collection('discoveryQueue')
  .where('workflow.status', '==', 'processing')
  .where('workflow.updatedAt', '<', oneHourAgo)
  .get();

stuckTasks.forEach(doc => {
  batch.update(doc.ref, {
    'workflow.status': 'idle'
  });
});

await batch.commit();
```

### High costs
If costs are higher than expected:

1. **Check cache hit rate:**
   ```typescript
   const cacheHits = result.results.filter(r => r.usage.cacheHit).length;
   const hitRate = cacheHits / result.stats.total;
   console.log(`Cache hit rate: ${(hitRate * 100).toFixed(1)}%`);
   ```

2. **Prioritize by value:**
   Queue high-value leads with higher priority numbers.

3. **Reduce batch size:**
   Process fewer tasks at once to stay within budget.

---

## Files Created/Modified

### Created:
- ✅ `src/types/workflow-state.ts`
- ✅ `src/types/engine-runtime.ts`
- ✅ `src/lib/services/discovery-dispatcher.ts`
- ✅ `src/app/api/discovery/queue/route.ts`
- ✅ `src/app/api/discovery/queue/process/route.ts`
- ✅ `WORKFLOW_STATE_IMPLEMENTATION.md`
- ✅ `QUICK_START_WORKFLOW_STATE.md`

### Modified:
- ✅ `src/lib/services/discovery-engine.ts` (added workflow field)
- ✅ `src/types/entity.ts` (added workflow to EntityMetadata)
- ✅ `firestore.indexes.json` (added discoveryQueue indexes)

---

## Questions?

**Q: Do I need to update existing discovered companies?**  
A: No. The workflow field is optional on EntityMetadata. Existing data works fine.

**Q: What if I want to re-discover a company?**  
A: Set `workflow.status = 'idle'` and it will be picked up again.

**Q: Can I process only specific organizations?**  
A: Yes, pass `organizationId` to `processDiscoveryQueue()`.

**Q: How do I pause processing?**  
A: Set tasks to `workflow.status = 'paused'`. They won't be picked up.

**Q: How accurate is the cost tracking?**  
A: Token estimates are approximate. For exact costs, integrate with your LLM provider's usage API.

---

## Success! 🎉

You now have:
- ✅ Automated queue processing
- ✅ Cost tracking per operation
- ✅ Full pipeline visibility
- ✅ Error recovery with retries
- ✅ Foundation for Manager Agent

The system is ready to process discoveries automatically with full observability.
