# Distillation Engine Guide

## Overview

The Distillation Engine implements the "ore → refined metal" architecture for cost-effective web scraping intelligence. It extracts high-value signals from raw scrapes while minimizing storage costs.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    RAW SCRAPE (500KB)                       │
│  • Full HTML                                                │
│  • All content (including fluff)                            │
│  • Stored temporarily (7-day TTL)                           │
│  • Auto-deleted after expiration                            │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              DISTILLATION ENGINE                            │
│  1. Remove fluff patterns                                   │
│  2. Detect high-value signals                               │
│  3. Calculate confidence scores                             │
│  4. Extract snippets (500 chars max)                        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              EXTRACTED SIGNALS (2KB)                        │
│  • Only high-value signals                                  │
│  • Confidence scores                                        │
│  • Source snippets                                          │
│  • Stored permanently in CRM                                │
└─────────────────────────────────────────────────────────────┘

RESULT: 95%+ storage reduction
```

## Key Components

### 1. Distillation Engine (`distillation-engine.ts`)

**Purpose:** Extract high-value signals from raw scrapes

**Key Functions:**

- `distillScrape()` - Main distillation function
- `detectHighValueSignals()` - Signal detection with keywords/regex
- `removeFluffPatterns()` - Filter boilerplate/noise
- `calculateLeadScore()` - Score leads from signals
- `distillBatch()` - Batch processing

### 2. Temporary Scrapes Service (`temporary-scrapes-service.ts`)

**Purpose:** Manage temporary scrape storage with TTL

**Key Functions:**

- `saveTemporaryScrape()` - Save with duplicate detection
- `getTemporaryScrape()` - Retrieve by ID
- `flagScrapeForDeletion()` - Mark for immediate deletion
- `deleteExpiredScrapes()` - Manual cleanup
- `deleteFlaggedScrapes()` - Delete verified scrapes
- `calculateStorageCost()` - Cost tracking

### 3. TTL Cleanup (`ttl-cleanup-function.ts`)

**Purpose:** Automatic cleanup of expired scrapes

**Cloud Functions:**

- `cleanupExpiredScrapesDaily` - Scheduled daily at 3 AM UTC
- `cleanupExpiredScrapesManual` - On-demand cleanup (admin only)
- `monitorStorageUsage` - Alert on anomalies (every 6 hours)

## Usage Examples

### Basic Distillation

```typescript
import { distillScrape } from '@/lib/scraper-intelligence/distillation-engine';
import { hvacResearch } from '@/lib/persona/industry-templates';

const result = await distillScrape({
  organizationId: 'org_123',
  url: 'https://company.com',
  rawHtml: '<html>...</html>',
  cleanedContent: 'Company content...',
  metadata: {
    title: 'Company Name',
    description: 'Company description',
  },
  research: hvacResearch,
  platform: 'website',
});

// Result
console.log(`Detected ${result.signals.length} signals`);
console.log(`Storage reduction: ${result.storageReduction.reductionPercent}%`);
console.log(`Temporary scrape ID: ${result.tempScrapeId}`);

// Save signals to permanent CRM record
await saveSignalsToCRM(leadId, result.signals);

// Raw scrape will auto-delete after 7 days
```

### Batch Distillation

```typescript
import { distillBatch } from '@/lib/scraper-intelligence/distillation-engine';

const scrapes = [
  {
    organizationId: 'org_123',
    url: 'https://company1.com',
    rawHtml: '...',
    cleanedContent: '...',
    metadata: { title: 'Company 1' },
    platform: 'website',
  },
  // ... more scrapes
];

const results = await distillBatch(scrapes, hvacResearch);

// Process results
for (const result of results) {
  console.log(`${result.signals.length} signals from ${result.tempScrapeId}`);
}
```

### Manual Cleanup

```typescript
import { 
  deleteExpiredScrapes,
  deleteFlaggedScrapes 
} from '@/lib/scraper-intelligence/temporary-scrapes-service';

// Delete expired scrapes
const expiredCount = await deleteExpiredScrapes('org_123');
console.log(`Deleted ${expiredCount} expired scrapes`);

// Delete flagged scrapes (verified by user)
const flaggedCount = await deleteFlaggedScrapes('org_123');
console.log(`Deleted ${flaggedCount} flagged scrapes`);
```

### Storage Analytics

```typescript
import { 
  calculateStorageCost,
  getStorageStats 
} from '@/lib/scraper-intelligence/temporary-scrapes-service';

// Get cost estimate
const cost = await calculateStorageCost('org_123');
console.log(`Current storage: ${cost.totalBytes / 1024 / 1024} MB`);
console.log(`Monthly cost: $${cost.estimatedMonthlyCostUSD}`);
console.log(`Savings with TTL: $${cost.projectedSavingsWithTTL}`);

// Get detailed stats
const stats = await getStorageStats('org_123');
console.log(`Total scrapes: ${stats.totalScrapes}`);
console.log(`Verified: ${stats.verifiedScrapes}`);
console.log(`Average size: ${stats.averageSizeBytes / 1024} KB`);
console.log(`Oldest scrape: ${stats.oldestScrape}`);
```

## Signal Detection

### Keyword Matching

Signals are detected using case-insensitive keyword matching:

```typescript
const signal: HighValueSignal = {
  id: 'hiring',
  label: 'Hiring',
  keywords: ['hiring', "we're hiring", 'open positions', 'careers'],
  priority: 'HIGH',
  scoreBoost: 25,
  // ...
};

// Matches:
// "We're Hiring!" ✓
// "Check out our open positions" ✓
// "Join our careers page" ✓
```

### Regex Patterns

For complex patterns, use regex:

```typescript
const signal: HighValueSignal = {
  id: 'expansion',
  label: 'Expansion',
  keywords: ['new location', 'expansion'],
  regexPattern: 'opening.{0,20}(new|location|office)',
  // Matches: "opening a new office", "opening new location", etc.
  // ...
};
```

### Confidence Scoring

Confidence is based on:

1. **Priority level:**
   - CRITICAL: 90 base
   - HIGH: 75 base
   - MEDIUM: 60 base
   - LOW: 45 base

2. **Keyword frequency:**
   - 1 occurrence: +0
   - 2-3 occurrences: +5
   - 4+ occurrences: +10

3. **Capped at 100**

Example:
```typescript
// "24/7 emergency service available"
// Signal: emergency-service (CRITICAL priority)
// Occurrences: 1
// Confidence: 90 + 0 = 90%

// "hiring hiring hiring hiring"
// Signal: hiring (HIGH priority)
// Occurrences: 4
// Confidence: 75 + 10 = 85%
```

## Fluff Filtering

Remove boilerplate/noise before signal detection:

```typescript
const research: ResearchIntelligence = {
  // ...
  fluffPatterns: [
    {
      id: 'copyright',
      pattern: '©.*All rights reserved',
      description: 'Copyright notice',
    },
    {
      id: 'cookies',
      pattern: 'This website uses cookies',
      description: 'Cookie banner',
    },
    {
      id: 'social',
      pattern: 'Follow us on (Facebook|Twitter|LinkedIn)',
      description: 'Social media links',
    },
  ],
};

// Before: "© 2025 Company. All rights reserved. About us..."
// After:  "About us..."
```

## Lead Scoring

Calculate total lead score from detected signals:

```typescript
import { calculateLeadScore } from '@/lib/scraper-intelligence/distillation-engine';

const score = calculateLeadScore(
  signals,
  research,
  {
    careersPageExists: true,
    hiringCount: 5,
  }
);

// Score breakdown:
// - Emergency signal (30 boost × 90% confidence) = 27
// - Hiring signal (25 boost × 80% confidence) = 20
// - Careers page rule (+10) = 10
// - Multiple hirings rule (+25) = 25
// Total: 82
```

## TTL Architecture

### Native Firestore TTL (Recommended)

1. **Enable in Firebase Console:**
   - Go to Firestore → TTL
   - Collection: `temporary_scrapes`
   - Field: `expiresAt`

2. **Behavior:**
   - Automatic deletion within 72 hours of expiration
   - No read/write charges for deletion
   - Zero maintenance required

### Cloud Function Fallback

If native TTL is unavailable, deploy cleanup function:

```bash
firebase deploy --only functions:cleanupExpiredScrapesDaily
firebase deploy --only functions:monitorStorageUsage
```

**Schedule:**
- Cleanup: Daily at 3 AM UTC
- Monitoring: Every 6 hours

**Manual Trigger:**
```typescript
import { cleanupExpiredScrapesManual } from '@/lib/scraper-intelligence/ttl-cleanup-function';

// Admin authentication required
const result = await cleanupExpiredScrapesManual({
  organizationId: 'org_123', // or omit for all orgs
});
```

## Storage Cost Optimization

### Cost Comparison

**Without Distillation:**
- 100 scrapes/day × 500KB = 50MB/day
- 30 days = 1.5GB/month
- Cost: $0.27/month per org
- 1,000 orgs = $270/month = **$3,240/year**

**With Distillation:**
- 100 scrapes/day × 2KB signals = 200KB/day (permanent)
- 7 days × 50MB = 350MB (temporary, auto-deleted)
- Cost: $0.06/month per org
- 1,000 orgs = $60/month = **$720/year**

**Savings: $2,520/year (78% reduction)**

### Monitoring

Track storage costs in real-time:

```typescript
import { getDistillationStats } from '@/lib/scraper-intelligence/distillation-engine';

const stats = getDistillationStats(allSignals);

console.log(`Total signals: ${stats.totalSignals}`);
console.log(`Average confidence: ${stats.averageConfidence}%`);
console.log(`Top signals: ${JSON.stringify(stats.topSignals)}`);
```

## Best Practices

### 1. Define High-Value Signals Carefully

❌ **Too many signals:**
```typescript
// 50+ signals = noise
highValueSignals: [
  { keywords: ['about'] }, // Too generic
  { keywords: ['contact'] }, // Too generic
  // ... 48 more
]
```

✅ **Focus on business value:**
```typescript
// 10-25 signals = actionable insights
highValueSignals: [
  { id: 'emergency-service', keywords: ['24/7', 'emergency'] },
  { id: 'hiring', keywords: ['hiring', 'careers'] },
  { id: 'expansion', keywords: ['new location', 'opening'] },
]
```

### 2. Test Fluff Patterns Against Real Sites

```typescript
// Test against 5+ real industry websites
const testUrls = [
  'https://company1.com',
  'https://company2.com',
  'https://company3.com',
  'https://company4.com',
  'https://company5.com',
];

for (const url of testUrls) {
  const content = await scrape(url);
  const cleaned = removeFluffPatterns(content, research);
  
  // Verify important content NOT removed
  expect(cleaned).toContain('important info');
}
```

### 3. Monitor Signal Detection Rates

```typescript
// Alert if detection rate drops below threshold
const detectionRate = signalsDetected / totalScrapes;

if (detectionRate < 0.3) {
  // 30% threshold
  logger.warn('Low signal detection rate', {
    detectionRate,
    totalScrapes,
    signalsDetected,
  });
}
```

### 4. Use Batch Processing for Bulk Imports

```typescript
// Process in batches to avoid overwhelming Firestore
const batchSize = 50;

for (let i = 0; i < allScrapes.length; i += batchSize) {
  const batch = allScrapes.slice(i, i + batchSize);
  const results = await distillBatch(batch, research);
  
  // Add delay between batches
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```

## Troubleshooting

### Issue: TTL deletions not working

**Symptoms:**
- Scrapes older than 7 days still in database
- Storage usage growing indefinitely

**Solutions:**

1. Verify TTL policy enabled:
   ```bash
   gcloud firestore fields ttls list --database='(default)'
   ```

2. Check `expiresAt` field is set correctly:
   ```typescript
   const scrape = await getTemporaryScrape(scrapeId);
   console.log('Expires at:', scrape?.expiresAt);
   // Should be ~7 days after createdAt
   ```

3. Deploy cleanup function as fallback:
   ```bash
   firebase deploy --only functions:cleanupExpiredScrapesDaily
   ```

### Issue: Signals not detected

**Symptoms:**
- `signals.length === 0` for content with clear signals

**Solutions:**

1. Check keyword case sensitivity:
   ```typescript
   // Keywords are case-insensitive
   keywords: ['hiring', 'HIRING', 'Hiring'] // All match
   ```

2. Test regex patterns:
   ```typescript
   const pattern = /opening.{0,20}(new|location)/gi;
   const match = pattern.test(content);
   console.log('Regex match:', match);
   ```

3. Verify platform filtering:
   ```typescript
   // Signal with platform: 'linkedin-jobs'
   // Won't detect on platform: 'website'
   
   // Use platform: 'any' for cross-platform signals
   ```

### Issue: Storage reduction below 90%

**Symptoms:**
- `storageReduction.reductionPercent < 90`

**Causes:**

1. Too many signals detected (large signals array)
2. Long source text snippets (limit to 500 chars)
3. Small raw HTML (reduction less noticeable)

**Solutions:**

```typescript
// Reduce signal count (focus on high-value only)
highValueSignals: signals.slice(0, 25),

// Ensure sourceText limited
sourceText: text.substring(0, 500),

// For small HTML, reduction may be 80-90% (still good)
```

## Related Documentation

- [Firestore TTL Setup](./FIRESTORE_TTL_SETUP.md)
- [Scraper Intelligence Types](../src/types/scraper-intelligence.ts)
- [Industry Templates](../src/lib/persona/industry-templates.ts)
- [Deployment Guide](./SCRAPER_INTELLIGENCE_DEPLOYMENT.md)

## API Reference

### `distillScrape()`

```typescript
function distillScrape(params: {
  organizationId: string;
  workspaceId?: string;
  url: string;
  rawHtml: string;
  cleanedContent: string;
  metadata: TemporaryScrape['metadata'];
  research: ResearchIntelligence;
  platform: ScrapingPlatform;
  relatedRecordId?: string;
}): Promise<{
  signals: ExtractedSignal[];
  tempScrapeId: string;
  isNewScrape: boolean;
  storageReduction: {
    rawSizeBytes: number;
    signalsSizeBytes: number;
    reductionPercent: number;
  };
}>
```

### `detectHighValueSignals()`

```typescript
function detectHighValueSignals(
  content: string,
  research: ResearchIntelligence,
  platform: ScrapingPlatform
): ExtractedSignal[]
```

### `removeFluffPatterns()`

```typescript
function removeFluffPatterns(
  content: string,
  research: ResearchIntelligence
): string
```

### `calculateLeadScore()`

```typescript
function calculateLeadScore(
  signals: ExtractedSignal[],
  research: ResearchIntelligence,
  context: Record<string, any>
): number
```

## Support

For questions or issues:

1. Check [troubleshooting section](#troubleshooting)
2. Review [integration tests](../tests/integration/scraper-intelligence/)
3. Contact development team

---

**Last Updated:** 2025-12-28  
**Version:** 1.0.0  
**Status:** Production Ready
