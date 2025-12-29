# Firestore TTL (Time-To-Live) Setup

## Overview

This document explains how to set up automatic deletion of temporary scrapes using Firestore's TTL (Time-To-Live) feature.

**Purpose:** Automatically delete raw HTML scrapes after 7 days to prevent storage cost explosion.

**Cost Savings:** 95%+ reduction in storage costs vs storing raw HTML forever.

---

## Option 1: Firestore Native TTL (Recommended)

Firestore supports automatic deletion based on a TTL field. This is the recommended approach.

### Prerequisites

- Firebase Project with Firestore enabled
- Firebase CLI installed (`npm install -g firebase-tools`)
- Firestore in **Native Mode** (not Datastore mode)

### Setup Steps

#### 1. Enable TTL Policy via Firebase Console

1. **Navigate to Firestore Database:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project
   - Click "Firestore Database" in left menu

2. **Create TTL Policy:**
   - Click the "TTL" tab at the top
   - Click "Create TTL Policy"
   - Fill in the form:
     - **Collection ID:** `temporary_scrapes`
     - **TTL Field:** `expiresAt`
   - Click "Create"

3. **Verify Creation:**
   - You should see the policy listed in the TTL tab
   - Status will show "Active"

#### 2. Enable TTL Policy via gcloud CLI (Alternative)

```bash
# Authenticate
gcloud auth login

# Set project
gcloud config set project YOUR_PROJECT_ID

# Create TTL policy
gcloud firestore fields ttls create expiresAt \
  --collection-group=temporary_scrapes \
  --database='(default)'
```

#### 3. Verify TTL Policy

```bash
# List all TTL policies
gcloud firestore fields ttls list --database='(default)'
```

Expected output:
```
COLLECTION_GROUP     FIELD      
temporary_scrapes    expiresAt
```

### How It Works

1. **Document Creation:**
   - When a scrape is saved, `expiresAt` is set to `NOW + 7 days`
   - Example: Created on Jan 1, expires on Jan 8

2. **Automatic Deletion:**
   - Firestore checks `expiresAt` field
   - Documents are deleted within **72 hours** after expiration
   - No manual intervention required

3. **Guarantees:**
   - Documents will **NOT** be deleted before `expiresAt`
   - Documents **WILL** be deleted within 72 hours after `expiresAt`
   - Deletion is free (no read/write charges)

### Monitoring

#### Check TTL Status

```bash
# View TTL policy details
gcloud firestore fields ttls describe expiresAt \
  --collection-group=temporary_scrapes \
  --database='(default)'
```

#### Monitor Storage Usage

1. Go to Firebase Console → Firestore Database → Usage
2. Check "Storage" chart
3. Should see decreasing trend over time (if scraping rate is constant)

#### Set Up Alerts

Create a Cloud Monitoring alert for unexpected storage growth:

```bash
# Create alert policy for Firestore storage
gcloud alpha monitoring policies create \
  --notification-channels=YOUR_CHANNEL_ID \
  --display-name="Firestore Storage Alert" \
  --condition-threshold-value=10 \
  --condition-threshold-duration=3600s \
  --condition-display-name="Storage > 10GB" \
  --metric-type="firestore.googleapis.com/document/count"
```

---

## Option 2: Cloud Function Cleanup (Fallback)

If Firestore TTL is not available in your region, use a Cloud Function to delete expired scrapes.

### Prerequisites

- Firebase Functions enabled
- Node.js 18+ installed

### Setup Steps

#### 1. Create Cloud Function

Create `functions/src/cleanupExpiredScrapes.ts`:

```typescript
import * as functions from 'firebase-functions';
import { db } from './firebase-admin'; // Your Firebase Admin initialization

/**
 * Cleanup expired temporary scrapes
 * Runs daily at 2 AM UTC
 */
export const cleanupExpiredScrapes = functions.pubsub
  .schedule('0 2 * * *') // Cron: Every day at 2 AM UTC
  .timeZone('UTC')
  .onRun(async (context) => {
    const now = new Date();
    
    console.log(`Starting cleanup job at ${now.toISOString()}`);
    
    let totalDeleted = 0;
    let hasMore = true;
    
    // Process in batches (Firestore limit: 500 operations per batch)
    while (hasMore) {
      const expired = await db
        .collection('temporary_scrapes')
        .where('expiresAt', '<=', now)
        .limit(500)
        .get();
      
      if (expired.empty) {
        hasMore = false;
        break;
      }
      
      // Delete in batch
      const batch = db.batch();
      expired.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      
      totalDeleted += expired.size;
      
      console.log(`Deleted batch of ${expired.size} expired scrapes`);
      
      // If we got fewer than 500, we're done
      if (expired.size < 500) {
        hasMore = false;
      }
    }
    
    console.log(`Cleanup complete. Total deleted: ${totalDeleted}`);
    
    return { totalDeleted };
  });
```

#### 2. Deploy Cloud Function

```bash
# Install dependencies
cd functions
npm install

# Deploy function
firebase deploy --only functions:cleanupExpiredScrapes
```

#### 3. Verify Deployment

```bash
# List deployed functions
firebase functions:list

# Check logs
firebase functions:log --only cleanupExpiredScrapes
```

#### 4. Monitor Function

1. Go to Firebase Console → Functions
2. Click on `cleanupExpiredScrapes`
3. View logs and execution history

### Manual Trigger (for testing)

```bash
# Trigger function manually
gcloud functions call cleanupExpiredScrapes \
  --region=us-central1
```

---

## Cost Analysis

### Without TTL Architecture

**Scenario:** 1,000 clients, 100 scrapes/day, 500KB per scrape

- **Daily Storage:** 1,000 × 100 × 500KB = 50GB/day
- **Monthly Storage (cumulative):** 50GB × 30 days = 1,500GB
- **Monthly Cost:** 1,500GB × $0.18/GB = **$270/month**
- **Annual Cost:** $270 × 12 = **$3,240/year**

### With TTL Architecture

**Scenario:** Same as above, but auto-delete after 7 days

- **Daily Storage:** 50GB/day
- **Steady-State Storage:** 50GB × 7 days = 350GB (max)
- **Monthly Cost:** 350GB × $0.18/GB = **$63/month**
- **Annual Cost:** $63 × 12 = **$756/year**

**Savings:** $3,240 - $756 = **$2,484/year (76.7% reduction)**

### Additional Savings

1. **No duplicate storage:** Content hashing prevents storing same content twice
2. **Compressed signals:** Only 2KB signals saved permanently vs 500KB raw HTML
3. **No read charges:** Firestore TTL deletion is free

---

## Troubleshooting

### TTL Not Working

**Symptom:** Documents not being deleted after `expiresAt`

**Possible Causes:**
1. TTL policy not created
2. Wrong field name (must be exactly `expiresAt`)
3. Field is not a `Date` type
4. Less than 72 hours have passed since expiration

**Solutions:**
```bash
# Verify policy exists
gcloud firestore fields ttls list --database='(default)'

# Check field type in a document
# Should be: Timestamp, not String
```

### Storage Not Decreasing

**Symptom:** Storage usage keeps growing despite TTL

**Possible Causes:**
1. Scraping rate > deletion rate
2. Duplicate detection not working (content hashing issue)
3. `expiresAt` date set too far in future

**Solutions:**
```typescript
// Check storage stats
import { getStorageStats } from '@/lib/scraper-intelligence/temporary-scrapes-service';

const stats = await getStorageStats('org_123');
console.log(stats);
// Should show reasonable numbers

// Verify expiresAt calculation
import { calculateExpirationDate } from '@/lib/scraper-intelligence/temporary-scrapes-service';

const expires = calculateExpirationDate();
const daysFromNow = (expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
console.log(`Expires in ${daysFromNow} days`); // Should be ~7
```

### Cloud Function Timing Out

**Symptom:** Cloud Function exceeds 540s timeout

**Cause:** Too many expired scrapes to delete in one run

**Solution:** Increase batch processing or run more frequently

```typescript
// Reduce batch size
.limit(100) // Instead of 500

// Or run more frequently
.schedule('0 */6 * * *') // Every 6 hours instead of daily
```

---

## Migration Guide

### Existing Scrapes (Before TTL)

If you have existing scrapes without `expiresAt` field:

```typescript
// One-time migration script
import { db } from '@/lib/firebase-admin';

async function migrateExistingScrapes() {
  const scrapes = await db.collection('temporary_scrapes').get();
  
  const batch = db.batch();
  let count = 0;
  
  for (const doc of scrapes.docs) {
    const data = doc.data();
    
    // Add expiresAt if missing
    if (!data.expiresAt) {
      const expiresAt = new Date(data.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      batch.update(doc.ref, { expiresAt });
      count++;
    }
    
    // Commit in batches of 500
    if (count % 500 === 0) {
      await batch.commit();
    }
  }
  
  await batch.commit();
  console.log(`Migrated ${count} scrapes`);
}
```

---

## Testing

### Verify TTL in Development

```typescript
// Create test scrape that expires in 1 minute
import { db } from '@/lib/firebase-admin';

async function testTTL() {
  const testScrape = {
    id: 'test_ttl',
    organizationId: 'test_org',
    url: 'https://example.com',
    rawHtml: '<html>test</html>',
    cleanedContent: 'test',
    contentHash: 'abc123',
    createdAt: new Date(),
    lastSeen: new Date(),
    expiresAt: new Date(Date.now() + 60 * 1000), // Expires in 1 minute
    scrapeCount: 1,
    metadata: {},
    sizeBytes: 100,
    verified: false,
    flaggedForDeletion: false,
  };
  
  await db.collection('temporary_scrapes').doc('test_ttl').set(testScrape);
  
  console.log('Test scrape created. Check back in 73 hours to verify deletion.');
}
```

**Note:** Firestore TTL has a delay of up to 72 hours. For faster testing, use Cloud Function approach.

---

## References

- [Firestore TTL Documentation](https://firebase.google.com/docs/firestore/ttl)
- [Cloud Functions Scheduled Triggers](https://firebase.google.com/docs/functions/schedule-functions)
- [Firestore Pricing](https://firebase.google.com/pricing#firestore-pricing)

---

## Support

For issues or questions:
1. Check Firestore logs in Firebase Console
2. Review Cloud Function logs
3. Contact your Firebase support channel
