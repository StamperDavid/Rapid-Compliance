# Form Builder Database Schema

## Overview

This document describes the Firestore database schema for the Form Builder module. The design is optimized for:

1. **Read-heavy workloads** - Form rendering needs to be fast
2. **Organization isolation** - Each organization's data is completely separate
3. **Efficient querying** - Common queries are supported with composite indexes
4. **Scalability** - Subcollections prevent document size limits

## Collection Structure

```
organizations/{orgId}/workspaces/{workspaceId}/
├── forms/{formId}                              # Form definitions
│   ├── fields/{fieldId}                        # Form fields (subcollection)
│   ├── submissions/{submissionId}              # Form submissions (subcollection)
│   ├── analytics/{YYYY-MM-DD}                  # Daily analytics aggregates
│   ├── fieldAnalytics/{fieldId_YYYY-MM-DD}     # Field-level analytics
│   └── views/{viewId}                          # Raw view events (TTL: 30 days)
└── formTemplates/{templateId}                  # Reusable form templates
```

## Document Schemas

### FormDefinition

```typescript
// Path: organizations/{orgId}/workspaces/{workspaceId}/forms/{formId}
{
  id: string;
  organizationId: string;
  workspaceId: string;

  // Basic info
  name: string;                    // Indexed for search
  description?: string;
  status: 'draft' | 'published' | 'archived' | 'scheduled';  // Indexed
  version: number;                 // Increments on publish
  category?: string;

  // Structure
  pages: FormPage[];               // Embedded (small array)

  // Settings & Behavior
  settings: FormSettings;          // Embedded object
  behavior: FormBehavior;          // Embedded object

  // CRM integration
  crmMapping: CRMFieldMapping;     // Embedded object

  // Workflow triggers
  workflowTriggers?: string[];     // Array of workflow IDs

  // Analytics tracking
  trackingEnabled: boolean;

  // Access control
  publicAccess: boolean;
  embedAllowedDomains?: string[];
  shareableLink?: string;

  // Ownership
  createdBy: string;               // Indexed
  lastModifiedBy: string;

  // Timestamps
  createdAt: Timestamp;            // Indexed
  updatedAt: Timestamp;            // Indexed
  publishedAt?: Timestamp;

  // Denormalized counters
  fieldCount: number;
  submissionCount: number;
  viewCount: number;
}
```

### FormFieldConfig

```typescript
// Path: organizations/{orgId}/workspaces/{workspaceId}/forms/{formId}/fields/{fieldId}
{
  id: string;
  formId: string;
  organizationId: string;
  workspaceId: string;

  // Field definition
  type: FormFieldType;
  label: string;
  name: string;                    // Machine name, indexed
  placeholder?: string;
  helpText?: string;
  defaultValue?: any;

  // Layout
  order: number;                   // Indexed (composite with pageIndex)
  pageIndex: number;               // Indexed (composite with order)
  width: 'full' | 'half' | 'third' | 'quarter';

  // Options (for select-type fields)
  options?: FormFieldOption[];

  // Validation
  validation?: FormFieldValidation;

  // Conditional logic
  conditionalLogic?: ConditionalLogic;

  // CRM mapping
  crmMapping?: { entityField: string; transform?: string };

  // Styling
  cssClass?: string;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### FormSubmission

```typescript
// Path: organizations/{orgId}/workspaces/{workspaceId}/forms/{formId}/submissions/{submissionId}
{
  id: string;
  formId: string;
  formVersion: number;             // Indexed
  organizationId: string;
  workspaceId: string;

  // Status
  status: 'partial' | 'pending' | 'processing' | 'completed' | 'failed';  // Indexed

  // Responses
  responses: FieldResponse[];      // Array of field responses

  // INDEXED FIELDS - Denormalized for efficient querying
  indexedEmail?: string;           // Indexed
  indexedPhone?: string;
  indexedName?: string;
  indexedCompany?: string;

  // Confirmation
  confirmationNumber: string;      // Indexed

  // Files and signatures
  files?: FileUploadReference[];
  signatures?: SignatureData[];

  // Multi-step progress
  pageProgress?: PageProgress[];
  currentPageIndex?: number;
  completionPercent?: number;

  // Partial submission support
  isPartial: boolean;              // Indexed
  resumeToken?: string;            // Indexed

  // CRM linking
  linkedLeadId?: string;           // Indexed
  linkedContactId?: string;        // Indexed
  linkedDealId?: string;
  linkedRecordId?: string;
  linkedEntityType?: string;
  crmSyncStatus?: 'pending' | 'synced' | 'failed';
  crmSyncError?: string;
  crmSyncedAt?: Timestamp;

  // Workflow processing
  workflowsTriggered?: string[];
  workflowStatus?: Record<string, string>;

  // Tracking metadata
  metadata: SubmissionMetadata;

  // Timestamps
  startedAt?: Timestamp;
  submittedAt: Timestamp;          // Indexed
  lastSavedAt?: Timestamp;
  completionTimeSeconds?: number;
}
```

### FormAnalyticsSummary

```typescript
// Path: organizations/{orgId}/workspaces/{workspaceId}/forms/{formId}/analytics/{YYYY-MM-DD}
{
  id: string;                      // Format: YYYY-MM-DD
  formId: string;
  organizationId: string;
  workspaceId: string;
  date: string;                    // Indexed - YYYY-MM-DD format

  // View metrics
  views: number;
  uniqueViews: number;

  // Submission metrics
  submissions: number;
  partialSubmissions: number;
  completedSubmissions: number;

  // Conversion
  conversionRate: number;
  completionRate: number;

  // Time metrics
  totalCompletionTime: number;
  averageCompletionTime: number;
  minCompletionTime: number;
  maxCompletionTime: number;

  // Breakdowns
  byDevice: { desktop: number; tablet: number; mobile: number };
  bySource: Record<string, number>;
  byReferrer: Record<string, number>;
  byCountry: Record<string, number>;
  byUtmSource: Record<string, number>;
  byUtmMedium: Record<string, number>;
  byUtmCampaign: Record<string, number>;

  // Multi-step drop-off
  pageDropOff?: Record<string, number>;

  lastUpdated: Timestamp;
}
```

## Index Strategy

### Required Composite Indexes

| Collection | Fields | Purpose |
|------------|--------|---------|
| forms | status ASC, updatedAt DESC | List published forms |
| forms | status ASC, createdAt DESC | List forms by status |
| forms | createdBy ASC, createdAt DESC | User's forms |
| forms | category ASC, name ASC | Browse by category |
| fields | pageIndex ASC, order ASC | Render form fields |
| submissions | status ASC, submittedAt DESC | Filter by status |
| submissions | formVersion ASC, submittedAt DESC | Version analysis |
| submissions | indexedEmail ASC, submittedAt DESC | Find by email |
| submissions | linkedLeadId ASC, submittedAt DESC | CRM lookup |
| submissions | linkedContactId ASC, submittedAt DESC | CRM lookup |
| submissions | isPartial ASC, submittedAt DESC | Partial submissions |
| views | sessionId ASC, viewedAt DESC | Session tracking |
| analytics | date ASC | Date range queries |
| formTemplates | category ASC, name ASC | Browse templates |

### Single-Field Indexes

- `submissions.resumeToken` - Resume partial submissions
- `submissions.confirmationNumber` - Lookup by confirmation
- `views.viewedAt` - TTL cleanup queries

## Optimization Strategies

### 1. Fields in Subcollection

**Why**: Form fields are stored in a subcollection instead of embedded in the form document.

- Avoids Firestore's 1MB document size limit
- Enables efficient field reordering without full document updates
- Allows parallel loading of form metadata + fields
- Supports forms with 100+ fields

### 2. Denormalized Counters

**Why**: `fieldCount`, `submissionCount`, and `viewCount` are denormalized in the form document.

- Avoids expensive count queries on subcollections
- Updated atomically with batch writes
- Enables fast list rendering

### 3. Indexed Fields in Submissions

**Why**: Common searchable fields are extracted and indexed separately.

- `indexedEmail`, `indexedPhone`, `indexedName`, `indexedCompany`
- Enables efficient queries without loading full responses array
- Avoids array-contains queries on large arrays

### 4. Daily Analytics Aggregation

**Why**: Raw view events are aggregated into daily summaries.

- View events have TTL (30 days) for automatic cleanup
- Daily aggregates enable efficient date range queries
- Reduces read costs for analytics dashboards

### 5. Confirmation Number

**Why**: Human-readable confirmation number instead of UUID.

- Easier for users to reference in support requests
- Indexed for efficient lookup
- Format: `{TIMESTAMP_BASE36}-{RANDOM_6_CHARS}`

## Query Patterns

### List Published Forms

```typescript
query(
  collection(db, 'organizations/{orgId}/workspaces/{workspaceId}/forms'),
  where('status', '==', 'published'),
  orderBy('updatedAt', 'desc'),
  limit(20)
)
```

### Get Form with Fields (Parallel Load)

```typescript
const [formSnap, fieldsSnap] = await Promise.all([
  getDoc(formRef),
  getDocs(query(fieldsRef, orderBy('pageIndex'), orderBy('order')))
]);
```

### Find Submissions by Email

```typescript
query(
  submissionsRef,
  where('indexedEmail', '==', email.toLowerCase()),
  orderBy('submittedAt', 'desc'),
  limit(50)
)
```

### Get Analytics for Date Range

```typescript
query(
  analyticsRef,
  where('date', '>=', startDate),
  where('date', '<=', endDate),
  orderBy('date', 'asc')
)
```

### Resume Partial Submission

```typescript
query(
  submissionsRef,
  where('resumeToken', '==', token),
  where('isPartial', '==', true),
  limit(1)
)
```

## Hot/Cold Data Separation

### Hot Data (Frequently Accessed)

- Form definitions (cached on render)
- Form fields (cached on render)
- Recent submissions (paginated)
- Today's analytics

### Cold Data (Infrequently Accessed)

- Historical analytics (archived after 90 days)
- Old submissions (archival after 1 year)
- Raw view events (TTL: 30 days)
- Deleted form backups

### Archival Strategy

1. View events: Auto-deleted after 30 days via TTL
2. Analytics older than 90 days: Move to `archivedAnalytics` collection
3. Submissions older than 1 year: Move to Cloud Storage as JSON

## Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /organizations/{orgId}/workspaces/{workspaceId}/forms/{formId} {
      allow read: if isOrgMember(orgId) || resource.data.publicAccess == true;
      allow write: if isOrgMember(orgId);

      match /fields/{fieldId} {
        allow read: if isOrgMember(orgId) || get(/databases/$(database)/documents/organizations/$(orgId)/workspaces/$(workspaceId)/forms/$(formId)).data.publicAccess == true;
        allow write: if isOrgMember(orgId);
      }

      match /submissions/{submissionId} {
        allow read: if isOrgMember(orgId);
        allow create: if true;  // Public submission
        allow update, delete: if isOrgMember(orgId);
      }

      match /views/{viewId} {
        allow read: if isOrgMember(orgId);
        allow create: if true;  // Public view tracking
        allow update: if isOrgMember(orgId);
      }

      match /analytics/{date} {
        allow read: if isOrgMember(orgId);
        allow write: if false;  // Server-only via Cloud Functions
      }
    }

    match /organizations/{orgId}/workspaces/{workspaceId}/formTemplates/{templateId} {
      allow read: if isOrgMember(orgId);
      allow write: if isOrgMember(orgId);
    }

    function isOrgMember(orgId) {
      return request.auth != null &&
        exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid));
    }
  }
}
```

## Migration Notes

If migrating from an existing form system:

1. Create forms with `status: 'draft'` during migration
2. Import fields in batches of 500 (Firestore batch limit)
3. Import submissions with `crmSyncStatus: 'synced'` if already linked
4. Backfill analytics from existing data
5. Switch to `status: 'published'` when ready

## Performance Benchmarks

| Operation | Expected Latency | Notes |
|-----------|------------------|-------|
| Get form | < 100ms | Single document read |
| Get form + fields | < 200ms | Parallel read |
| Create submission | < 300ms | Write + counter update |
| List submissions (50) | < 200ms | Indexed query |
| Get analytics (30 days) | < 150ms | 30 document reads |

## Limitations

1. **Full-text search**: Use Algolia/Typesense for form name search
2. **Complex aggregations**: Use BigQuery for advanced analytics
3. **Real-time collaboration**: Consider Firestore offline persistence
4. **File storage**: Store in Cloud Storage, reference in Firestore
