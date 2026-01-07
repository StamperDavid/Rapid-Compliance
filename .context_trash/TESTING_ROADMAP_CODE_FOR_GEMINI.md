# Testing Roadmap - Code Reference for Gemini

This document contains all the code needed to build an exhaustive testing roadmap for the AI Sales Platform.

---

## PART 1: ONBOARDING LOGIC

### 1.1 Onboarding API Route
**File:** `src/app/api/agent/process-onboarding/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { processOnboarding } from '@/lib/agent/onboarding-processor';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { validateInput } from '@/lib/validation/schemas';
import { z } from 'zod';
import { OnboardingData } from '@/types/agent-memory';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

// Schema for onboarding request validation
const processOnboardingSchema = z.object({
  organizationId: z.string(),
  onboardingData: z.record(z.any()),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/agent/process-onboarding');
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication - just require auth, not organization membership
    // (user is setting up their organization via onboarding)
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse and validate input
    const body = await request.json();
    const validation = validateInput(processOnboardingSchema, body);

    if (!validation.success) {
      // Type assertion: when success is false, we have the error structure
      const validationError = validation as { success: false; errors: any };
      const errorDetails = validationError.errors?.errors?.map((e: any) => ({
        path: e.path?.join('.') || 'unknown',
        message: e.message || 'Validation error',
      })) || [];
      
      return errors.validation('Validation failed', errorDetails);
    }

    const { organizationId, onboardingData } = validation.data;

    // Import Admin SDK services for multi-tenant security check
    const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
    const { COLLECTIONS } = await import('@/lib/db/firestore-service');
    
    try {
      const org = await AdminFirestoreService.get(COLLECTIONS.ORGANIZATIONS, organizationId);
      
      if (org) {
        // Organization exists - verify user is owner or member
        const isOwner = org.ownerId === user.uid;
        const isMember = org.members?.includes(user.uid);
        const isAdmin = user.role === 'admin' || user.role === 'super_admin';
        
        if (!isOwner && !isMember && !isAdmin) {
          return NextResponse.json(
            { success: false, error: 'You do not have permission to configure this organization' },
            { status: 403 }
          );
        }
      } else {
        // Organization doesn't exist yet - user is creating it during onboarding
        // This is allowed, but we'll set them as the owner
        logger.debug('Creating new organization during onboarding', { organizationId, userId: user.uid, route: '/api/agent/process-onboarding' });
      }
    } catch (error) {
      logger.error('Error checking organization access', error, { route: '/api/agent/process-onboarding' });
      // If we can't verify, allow it (onboarding scenario)
    }

    // Save onboarding data first (using Admin SDK)
    await AdminFirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/onboarding`,
      'current',
      {
        ...onboardingData,
        completedAt: new Date().toISOString(),
        organizationId,
      },
      false
    );
    
    // Process onboarding
    const result = await processOnboarding({
      onboardingData: onboardingData as OnboardingData,
      organizationId,
      userId: user.uid,
    });

    if (result.success) {
      // Update user's organizationId if not already set
      if (!user.organizationId) {
        try {
          await AdminFirestoreService.update('users', user.uid, {
            organizationId,
            currentOrganizationId: organizationId,
            updatedAt: new Date().toISOString(),
          });
        } catch (error) {
          logger.warn('Failed to update user organizationId', { route: '/api/agent/process-onboarding', error });
          // Continue anyway - onboarding succeeded
        }
      }
      
      return NextResponse.json({
        success: true,
        persona: result.persona,
        knowledgeBase: result.knowledgeBase,
        baseModel: result.baseModel, // Returns editable Base Model, not Golden Master
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error: any) {
    logger.error('Onboarding processing error', error, { route: '/api/agent/process-onboarding' });
    return errors.internal('Failed to process onboarding', error);
  }
}
```

### 1.2 Onboarding Processor
**File:** `src/lib/agent/onboarding-processor.ts`

This shows how onboarding data is processed and saved to Firestore.

```typescript
export async function processOnboarding(
  options: OnboardingProcessorOptions
): Promise<OnboardingProcessResult> {
  try {
    const { onboardingData, organizationId, userId, workspaceId } = options;
    
    // Step 1: Build persona from onboarding data
    const persona = buildPersonaFromOnboarding(onboardingData);
    
    // Step 2: Process knowledge base
    const knowledgeOptions: KnowledgeProcessorOptions = {
      organizationId,
      uploadedFiles: onboardingData.uploadedDocs || [],
      urls: onboardingData.urls || [],
      faqPageUrl: onboardingData.faqPageUrl,
      socialMediaUrls: onboardingData.socialMediaUrls || [],
      faqs: onboardingData.faqs,
      websiteUrl: onboardingData.website,
    };
    
    const knowledgeBase = await processKnowledgeBase(knowledgeOptions);
    
    // Step 3: Build Base Model (NOT Golden Master yet!)
    const baseModel = await buildBaseModel({
      onboardingData,
      knowledgeBase,
      organizationId,
      userId,
      workspaceId,
    });
    
    // Step 4: Save everything to Firestore using Admin SDK (bypasses security rules)
    const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
    
    // Save persona
    await AdminFirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/agentPersona`,
      'current',
      {
        ...persona,
        organizationId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      false
    );
    
    // Save knowledge base
    await AdminFirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/knowledgeBase`,
      'current',
      {
        ...knowledgeBase,
        organizationId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      false
    );
    
    // Save Base Model (NOT Golden Master - that comes after training!)
    await saveBaseModel(baseModel);
    
    return {
      success: true,
      persona,
      knowledgeBase,
      baseModel,
    };
  } catch (error: any) {
    logger.error('[Onboarding Processor] Error:', error, { file: 'onboarding-processor.ts' });
    return {
      success: false,
      error: error.message || 'Failed to process onboarding',
    };
  }
}
```

### 1.3 Complete OnboardingData Type Definition
**File:** `src/types/agent-memory.ts`

**THIS IS THE CRITICAL PART - ALL ~40 ONBOARDING QUESTIONS MAP TO THESE FIRESTORE KEYS:**

```typescript
export interface OnboardingData {
  // ===== BUSINESS BASICS (Step 1-3) =====
  businessName: string;                    // Firestore: businessName
  industry: string;                        // Firestore: industry
  website?: string;                        // Firestore: website
  
  // ===== VALUE PROPOSITION (Step 4-5) =====
  problemSolved: string;                   // Firestore: problemSolved
  uniqueValue: string;                     // Firestore: uniqueValue
  targetCustomer: string;                  // Firestore: targetCustomer
  
  // ===== PRODUCTS & SERVICES (Step 6) =====
  topProducts: string;                     // Firestore: topProducts
  
  // ===== PRICING (Step 7) =====
  priceRange?: string;                     // Firestore: priceRange
  discountPolicy?: string;                 // Firestore: discountPolicy
  
  // ===== SALES PROCESS (Step 8) =====
  typicalSalesFlow?: string;               // Firestore: typicalSalesFlow
  
  // ===== DISCOVERY (Step 9) =====
  discoveryQuestions?: string;             // Firestore: discoveryQuestions
  
  // ===== OBJECTIONS (Step 10) =====
  commonObjections?: string;               // Firestore: commonObjections
  priceObjections?: string;                // Firestore: priceObjections
  
  // ===== POLICIES (Step 11-12) =====
  returnPolicy?: string;                   // Firestore: returnPolicy
  warrantyTerms?: string;                  // Firestore: warrantyTerms
  satisfactionGuarantee?: string;          // Firestore: satisfactionGuarantee
  
  // ===== COMPLIANCE (Step 13) =====
  requiredDisclosures?: string;            // Firestore: requiredDisclosures
  prohibitedTopics?: string;               // Firestore: prohibitedTopics
  
  // ===== COMPETITORS (Step 14) =====
  competitors?: string[];                  // Firestore: competitors (array)
  competitiveAdvantages?: string;          // Firestore: competitiveAdvantages
  
  // ===== KNOWLEDGE BASE (Step 15) =====
  websiteUrls?: string[];                  // Firestore: websiteUrls (array)
  faqUrl?: string;                         // Firestore: faqUrl
  
  // ===== AGENT IDENTITY (Step 16) =====
  agentName?: string;                      // Firestore: agentName
  communicationStyle?: string;             // Firestore: communicationStyle
  greetingMessage?: string;                // Firestore: greetingMessage
  closingMessage?: string;                 // Firestore: closingMessage
  personalityTraits?: string[];            // Firestore: personalityTraits (array)
  
  // ===== BEHAVIOR (Step 17) =====
  closingStyle?: number;                   // Firestore: closingStyle (1-10)
  discoveryDepth?: number;                 // Firestore: discoveryDepth (1-7)
  responseLength?: 'concise' | 'balanced' | 'detailed';  // Firestore: responseLength
  proactivityLevel?: number;               // Firestore: proactivityLevel (1-10)
  maxDiscount?: number;                    // Firestore: maxDiscount
  idleTimeoutMinutes?: number;             // Firestore: idleTimeoutMinutes
  
  // ===== ESCALATION (Step 18) =====
  escalationRules?: string[];              // Firestore: escalationRules (array)
  
  // ===== OBJECTION HANDLING STRATEGIES (Step 19) =====
  objectionHandling?: {
    priceObjectionStrategy?: string;       // Firestore: objectionHandling.priceObjectionStrategy
    competitorObjectionStrategy?: string;  // Firestore: objectionHandling.competitorObjectionStrategy
    timingObjectionStrategy?: string;      // Firestore: objectionHandling.timingObjectionStrategy
    authorityObjectionStrategy?: string;   // Firestore: objectionHandling.authorityObjectionStrategy
    needObjectionStrategy?: string;        // Firestore: objectionHandling.needObjectionStrategy
  };
  
  // ===== CUSTOMER SENTIMENT ANALYSIS (Step 20) =====
  customerSentimentHandling?: {
    angryCustomerApproach?: string;        // Firestore: customerSentimentHandling.angryCustomerApproach
    confusedCustomerApproach?: string;     // Firestore: customerSentimentHandling.confusedCustomerApproach
    readyToBuySignals?: string[];          // Firestore: customerSentimentHandling.readyToBuySignals
    disengagementSignals?: string[];       // Firestore: customerSentimentHandling.disengagementSignals
    frustratedCustomerApproach?: string;   // Firestore: customerSentimentHandling.frustratedCustomerApproach
  };
  
  // ===== DISCOVERY QUESTION FRAMEWORKS (Step 21) =====
  discoveryFrameworks?: {
    budgetQualificationQuestions?: string[];    // Firestore: discoveryFrameworks.budgetQualificationQuestions
    timelineQuestions?: string[];               // Firestore: discoveryFrameworks.timelineQuestions
    authorityQuestions?: string[];              // Firestore: discoveryFrameworks.authorityQuestions
    needIdentificationQuestions?: string[];     // Firestore: discoveryFrameworks.needIdentificationQuestions
    painPointQuestions?: string[];              // Firestore: discoveryFrameworks.painPointQuestions
  };
  
  // ===== CLOSING TECHNIQUES (Step 22) =====
  closingTechniques?: {
    assumptiveCloseConditions?: string[];       // Firestore: closingTechniques.assumptiveCloseConditions
    urgencyCreationTactics?: string[];          // Firestore: closingTechniques.urgencyCreationTactics
    trialCloseTriggers?: string[];              // Firestore: closingTechniques.trialCloseTriggers
    softCloseApproaches?: string[];             // Firestore: closingTechniques.softCloseApproaches
  };
  
  // ===== RULES & RESTRICTIONS (Step 23) =====
  agentRules?: {
    prohibitedBehaviors?: string[];             // Firestore: agentRules.prohibitedBehaviors
    behavioralBoundaries?: string[];            // Firestore: agentRules.behavioralBoundaries
    mustAlwaysMention?: string[];               // Firestore: agentRules.mustAlwaysMention
    neverMention?: string[];                    // Firestore: agentRules.neverMention
  };
  
  // ===== TRAINING METRICS SELECTION (Step 24) =====
  selectedTrainingMetrics?: string[];           // Firestore: selectedTrainingMetrics
  
  // ===== SALES MATERIALS UPLOAD (Step 25) =====
  uploadedSalesMaterials?: {
    id: string;
    filename: string;
    type: 'pdf' | 'document';
    uploadedAt: string;
    extractedMethodology?: SalesMethodology;
  }[];                                          // Firestore: uploadedSalesMaterials
  
  // ===== METADATA =====
  completedAt?: string;                         // Firestore: completedAt
  completedBy?: string;                         // Firestore: completedBy
  version?: string;                             // Firestore: version
  
  // Allow additional properties from form data
  [key: string]: any;
}
```

**FIRESTORE STORAGE LOCATIONS AFTER ONBOARDING:**

```
/organizations/{organizationId}/onboarding/current
  → Contains ALL the OnboardingData fields above

/organizations/{organizationId}/agentPersona/current
  → Built from OnboardingData

/organizations/{organizationId}/knowledgeBase/current
  → Built from OnboardingData (urls, uploadedDocs, etc.)

/baseModels/{baseModelId}
  → Built from OnboardingData + persona + knowledge
  → Contains businessContext field with full OnboardingData
```

---

## PART 2: SCHEMA ENGINE

### 2.1 Schema API Route (GET & POST)
**File:** `src/app/api/schemas/route.ts`

**THIS IS HOW THE CRM IS "PHYSICALLY TRANSFORMED" BASED ON INDUSTRY:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger/logger';

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function buildSchemaId(name: string) {
  const slug = slugify(name);
  return slug || `schema_${Date.now()}`;
}

function buildFieldId(key: string) {
  const slug = slugify(key || '');
  return slug ? `field_${slug}` : `field_${Date.now()}`;
}

export async function GET(request: NextRequest) {
  try {
    if (!adminDal) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const workspaceId = searchParams.get('workspaceId');

    if (!organizationId || !workspaceId) {
      return NextResponse.json(
        { error: 'organizationId and workspaceId are required' },
        { status: 400 }
      );
    }

    const snapshot = await adminDal.safeQuery('ORGANIZATIONS', (ref) => {
      return adminDal.getWorkspaceCollection(organizationId, workspaceId, 'schemas')
        .where('status', '==', 'active');
    });

    const schemas = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ success: true, schemas });
  } catch (error: any) {
    logger.error('[Schemas API][GET] Failed to list schemas', error, { route: '/api/schemas' });
    return NextResponse.json(
      { error: 'Failed to fetch schemas', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!adminDal) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    const body = await request.json();
    const { organizationId, workspaceId, schema, userId } = body || {};

    if (!organizationId || !workspaceId || !schema?.name) {
      return NextResponse.json(
        { error: 'organizationId, workspaceId, and schema.name are required' },
        { status: 400 }
      );
    }

    const now = FieldValue.serverTimestamp();
    const schemaId = schema.id || buildSchemaId(schema.name);

    const fields = (schema.fields || []).map((field: any) => ({
      id: field.id || buildFieldId(field.key || field.label || 'field'),
      key: field.key || slugify(field.label || 'field'),
      label: field.label || field.key || 'Field',
      type: field.type || 'text',
      required: !!field.required,
      createdAt: now,
      updatedAt: now,
    }));

    const primaryFieldId = fields[0]?.id || 'field_name';

    const newSchema = {
      id: schemaId,
      organizationId,
      workspaceId,
      name: schema.name,
      pluralName: schema.pluralName || `${schema.name}s`,
      singularName: schema.singularName || schema.name,
      description: schema.description || '',
      icon: schema.icon || '📋',
      color: schema.color || '#3B82F6',
      fields: fields.length
        ? fields
        : [
            {
              id: 'field_name',
              key: 'name',
              label: 'Name',
              type: 'text',
              required: true,
              createdAt: now,
              updatedAt: now,
            },
          ],
      primaryFieldId,
      relations: [],
      permissions: schema.permissions || {
        create: ['admin', 'editor'],
        read: ['admin', 'editor', 'viewer'],
        update: ['admin', 'editor'],
        delete: ['admin'],
      },
      settings: schema.settings || {
        allowAttachments: true,
        allowComments: true,
        allowActivityLog: true,
        enableVersioning: false,
      },
      createdAt: now,
      updatedAt: now,
      createdBy: userId || 'system',
      status: 'active',
      version: 1,
    };

    const schemasCollection = adminDal.getWorkspaceCollection(organizationId, workspaceId, 'schemas');
    await schemasCollection.doc(schemaId).set(newSchema);

    // Initialize entity collection metadata
    const entitiesCollection = adminDal.getWorkspaceCollection(organizationId, workspaceId, 'entities');
    const metadataRef = entitiesCollection.doc(schemaId).collection('_metadata').doc('info');

    await metadataRef.set({
      schemaId,
      createdAt: now,
      recordCount: 0,
    });

    return NextResponse.json({ success: true, schema: newSchema });
  } catch (error: any) {
    logger.error('[Schemas API][POST] Failed to create schema', error, { route: '/api/schemas' });
    return NextResponse.json(
      { error: 'Failed to create schema', details: error.message },
      { status: 500 }
    );
  }
}
```

### 2.2 Standard CRM Schemas (10 Default Objects)
**File:** `src/lib/schema/standard-schemas.ts`

**THESE ARE THE 10 CORE CRM OBJECTS THAT GET CUSTOMIZED PER INDUSTRY:**

```typescript
export const STANDARD_SCHEMAS = {
  leads: {
    id: 'leads',
    name: 'Lead',
    pluralName: 'Leads',
    singularName: 'Lead',
    icon: '🎯',
    fields: [
      { id: 'f1', key: 'first_name', label: 'First Name', type: 'text', required: true },
      { id: 'f2', key: 'last_name', label: 'Last Name', type: 'text', required: true },
      { id: 'f3', key: 'email', label: 'Email', type: 'email', required: true },
      { id: 'f4', key: 'phone', label: 'Phone', type: 'phoneNumber', required: false },
      { id: 'f5', key: 'company', label: 'Company', type: 'text', required: false },
      { id: 'f6', key: 'title', label: 'Job Title', type: 'text', required: false },
      { id: 'f7', key: 'lead_source', label: 'Lead Source', type: 'singleSelect', required: false },
      { id: 'f8', key: 'lead_status', label: 'Status', type: 'singleSelect', required: true },
      { id: 'f9', key: 'rating', label: 'Rating', type: 'singleSelect', required: false },
      { id: 'f10', key: 'estimated_value', label: 'Estimated Value', type: 'currency', required: false },
      { id: 'f11', key: 'notes', label: 'Notes', type: 'longText', required: false }
    ]
  },

  companies: {
    id: 'companies',
    name: 'Company',
    pluralName: 'Companies',
    singularName: 'Company',
    icon: '🏢',
    fields: [
      { id: 'f1', key: 'name', label: 'Company Name', type: 'text', required: true },
      { id: 'f2', key: 'website', label: 'Website', type: 'url', required: false },
      { id: 'f3', key: 'phone', label: 'Phone', type: 'phoneNumber', required: false },
      { id: 'f4', key: 'email', label: 'Email', type: 'email', required: false },
      { id: 'f5', key: 'industry', label: 'Industry', type: 'singleSelect', required: false },
      { id: 'f6', key: 'employee_count', label: 'Employee Count', type: 'number', required: false },
      { id: 'f7', key: 'annual_revenue', label: 'Annual Revenue', type: 'currency', required: false },
      { id: 'f8', key: 'address', label: 'Address', type: 'longText', required: false },
      { id: 'f9', key: 'city', label: 'City', type: 'text', required: false },
      { id: 'f10', key: 'state', label: 'State', type: 'text', required: false },
      { id: 'f11', key: 'country', label: 'Country', type: 'text', required: false },
      { id: 'f12', key: 'zip', label: 'ZIP Code', type: 'text', required: false },
      { id: 'f13', key: 'status', label: 'Status', type: 'singleSelect', required: true }
    ]
  },

  contacts: {
    id: 'contacts',
    name: 'Contact',
    pluralName: 'Contacts',
    singularName: 'Contact',
    icon: '👤',
    fields: [
      { id: 'f1', key: 'first_name', label: 'First Name', type: 'text', required: true },
      { id: 'f2', key: 'last_name', label: 'Last Name', type: 'text', required: true },
      { id: 'f3', key: 'email', label: 'Email', type: 'email', required: true },
      { id: 'f4', key: 'phone', label: 'Phone', type: 'phoneNumber', required: false },
      { id: 'f5', key: 'mobile', label: 'Mobile', type: 'phoneNumber', required: false },
      { id: 'f6', key: 'title', label: 'Job Title', type: 'text', required: false },
      { id: 'f7', key: 'company_id', label: 'Company', type: 'lookup', required: false },
      { id: 'f8', key: 'linkedin', label: 'LinkedIn', type: 'url', required: false },
      { id: 'f9', key: 'status', label: 'Status', type: 'singleSelect', required: true }
    ]
  },

  deals: {
    id: 'deals',
    name: 'Deal',
    pluralName: 'Deals',
    singularName: 'Deal',
    icon: '💼',
    fields: [
      { id: 'f1', key: 'name', label: 'Deal Name', type: 'text', required: true },
      { id: 'f2', key: 'company_id', label: 'Company', type: 'lookup', required: true },
      { id: 'f3', key: 'contact_id', label: 'Primary Contact', type: 'lookup', required: false },
      { id: 'f4', key: 'amount', label: 'Amount', type: 'currency', required: true },
      { id: 'f5', key: 'stage', label: 'Stage', type: 'singleSelect', required: true },
      { id: 'f6', key: 'probability', label: 'Probability', type: 'percent', required: false },
      { id: 'f7', key: 'expected_close_date', label: 'Expected Close Date', type: 'date', required: true },
      { id: 'f8', key: 'actual_close_date', label: 'Actual Close Date', type: 'date', required: false },
      { id: 'f9', key: 'description', label: 'Description', type: 'longText', required: false },
      { id: 'f10', key: 'next_step', label: 'Next Step', type: 'text', required: false },
      { id: 'f11', key: 'lost_reason', label: 'Lost Reason', type: 'text', required: false }
    ]
  },

  products: {
    id: 'products',
    name: 'Product',
    pluralName: 'Products',
    singularName: 'Product',
    icon: '📦',
    fields: [
      { id: 'f1', key: 'name', label: 'Product Name', type: 'text', required: true },
      { id: 'f2', key: 'sku', label: 'SKU', type: 'text', required: true },
      { id: 'f3', key: 'description', label: 'Description', type: 'longText', required: false },
      { id: 'f4', key: 'price', label: 'Price', type: 'currency', required: true },
      { id: 'f5', key: 'cost', label: 'Cost', type: 'currency', required: false },
      { id: 'f6', key: 'category', label: 'Category', type: 'singleSelect', required: false },
      { id: 'f7', key: 'active', label: 'Active', type: 'checkbox', required: true },
      { id: 'f8', key: 'stock_quantity', label: 'Stock Quantity', type: 'number', required: false },
      { id: 'f9', key: 'unit', label: 'Unit', type: 'text', required: false }
    ]
  },

  quotes: {
    id: 'quotes',
    name: 'Quote',
    pluralName: 'Quotes',
    singularName: 'Quote',
    icon: '📄',
    fields: [
      { id: 'f1', key: 'quote_number', label: 'Quote Number', type: 'text', required: true },
      { id: 'f2', key: 'company_id', label: 'Company', type: 'lookup', required: true },
      { id: 'f3', key: 'contact_id', label: 'Contact', type: 'lookup', required: false },
      { id: 'f4', key: 'deal_id', label: 'Related Deal', type: 'lookup', required: false },
      { id: 'f5', key: 'quote_date', label: 'Quote Date', type: 'date', required: true },
      { id: 'f6', key: 'expiry_date', label: 'Expiry Date', type: 'date', required: true },
      { id: 'f7', key: 'subtotal', label: 'Subtotal', type: 'currency', required: true },
      { id: 'f8', key: 'tax', label: 'Tax', type: 'currency', required: false },
      { id: 'f9', key: 'discount', label: 'Discount', type: 'currency', required: false },
      { id: 'f10', key: 'total', label: 'Total', type: 'currency', required: true },
      { id: 'f11', key: 'status', label: 'Status', type: 'singleSelect', required: true },
      { id: 'f12', key: 'notes', label: 'Notes', type: 'longText', required: false }
    ]
  },

  invoices: {
    id: 'invoices',
    name: 'Invoice',
    pluralName: 'Invoices',
    singularName: 'Invoice',
    icon: '🧾',
    fields: [
      { id: 'f1', key: 'invoice_number', label: 'Invoice Number', type: 'text', required: true },
      { id: 'f2', key: 'company_id', label: 'Company', type: 'lookup', required: true },
      { id: 'f3', key: 'contact_id', label: 'Contact', type: 'lookup', required: false },
      { id: 'f4', key: 'deal_id', label: 'Related Deal', type: 'lookup', required: false },
      { id: 'f5', key: 'quote_id', label: 'Related Quote', type: 'lookup', required: false },
      { id: 'f6', key: 'invoice_date', label: 'Invoice Date', type: 'date', required: true },
      { id: 'f7', key: 'due_date', label: 'Due Date', type: 'date', required: true },
      { id: 'f8', key: 'subtotal', label: 'Subtotal', type: 'currency', required: true },
      { id: 'f9', key: 'tax', label: 'Tax', type: 'currency', required: false },
      { id: 'f10', key: 'total', label: 'Total', type: 'currency', required: true },
      { id: 'f11', key: 'paid_amount', label: 'Paid Amount', type: 'currency', required: false },
      { id: 'f12', key: 'balance', label: 'Balance', type: 'currency', required: false },
      { id: 'f13', key: 'status', label: 'Status', type: 'singleSelect', required: true },
      { id: 'f14', key: 'payment_terms', label: 'Payment Terms', type: 'text', required: false },
      { id: 'f15', key: 'notes', label: 'Notes', type: 'longText', required: false }
    ]
  },

  payments: {
    id: 'payments',
    name: 'Payment',
    pluralName: 'Payments',
    singularName: 'Payment',
    icon: '💳',
    fields: [
      { id: 'f1', key: 'payment_number', label: 'Payment Number', type: 'text', required: true },
      { id: 'f2', key: 'invoice_id', label: 'Invoice', type: 'lookup', required: true },
      { id: 'f3', key: 'payment_date', label: 'Payment Date', type: 'date', required: true },
      { id: 'f4', key: 'amount', label: 'Amount', type: 'currency', required: true },
      { id: 'f5', key: 'payment_method', label: 'Payment Method', type: 'singleSelect', required: true },
      { id: 'f6', key: 'transaction_id', label: 'Transaction ID', type: 'text', required: false },
      { id: 'f7', key: 'notes', label: 'Notes', type: 'longText', required: false },
      { id: 'f8', key: 'status', label: 'Status', type: 'singleSelect', required: true }
    ]
  },

  orders: {
    id: 'orders',
    name: 'Order',
    pluralName: 'Orders',
    singularName: 'Order',
    icon: '📋',
    fields: [
      { id: 'f1', key: 'order_number', label: 'Order Number', type: 'text', required: true },
      { id: 'f2', key: 'company_id', label: 'Company', type: 'lookup', required: true },
      { id: 'f3', key: 'contact_id', label: 'Contact', type: 'lookup', required: false },
      { id: 'f4', key: 'quote_id', label: 'Related Quote', type: 'lookup', required: false },
      { id: 'f5', key: 'order_date', label: 'Order Date', type: 'date', required: true },
      { id: 'f6', key: 'expected_delivery', label: 'Expected Delivery', type: 'date', required: false },
      { id: 'f7', key: 'subtotal', label: 'Subtotal', type: 'currency', required: true },
      { id: 'f8', key: 'tax', label: 'Tax', type: 'currency', required: false },
      { id: 'f9', key: 'shipping', label: 'Shipping', type: 'currency', required: false },
      { id: 'f10', key: 'total', label: 'Total', type: 'currency', required: true },
      { id: 'f11', key: 'status', label: 'Status', type: 'singleSelect', required: true },
      { id: 'f12', key: 'shipping_address', label: 'Shipping Address', type: 'longText', required: false },
      { id: 'f13', key: 'notes', label: 'Notes', type: 'longText', required: false }
    ]
  },

  tasks: {
    id: 'tasks',
    name: 'Task',
    pluralName: 'Tasks',
    singularName: 'Task',
    icon: '✅',
    fields: [
      { id: 'f1', key: 'subject', label: 'Subject', type: 'text', required: true },
      { id: 'f2', key: 'description', label: 'Description', type: 'longText', required: false },
      { id: 'f3', key: 'due_date', label: 'Due Date', type: 'date', required: true },
      { id: 'f4', key: 'priority', label: 'Priority', type: 'singleSelect', required: true },
      { id: 'f5', key: 'status', label: 'Status', type: 'singleSelect', required: true },
      { id: 'f6', key: 'related_to_type', label: 'Related To Type', type: 'singleSelect', required: false },
      { id: 'f7', key: 'related_to_id', label: 'Related To ID', type: 'text', required: false },
      { id: 'f8', key: 'completed_date', label: 'Completed Date', type: 'date', required: false }
    ]
  }
};
```

### 2.3 Industry Template Example (HVAC)
**File:** `src/lib/persona/templates/home-services-1.ts` (excerpt)

**THIS SHOWS HOW A RESTAURANT DIFFERS FROM LAWN MOWING - CUSTOM FIELDS PER INDUSTRY:**

```typescript
'hvac': {
  id: 'hvac',
  name: 'HVAC (Heating, Ventilation, Air Conditioning)',
  description: 'For HVAC companies - comfort and efficiency',
  category: 'Home Services',
  
  // ... cognitive logic and personality ...
  
  // THESE ARE THE CUSTOM FIELDS THAT GET ADDED TO THE CRM FOR HVAC COMPANIES:
  research: {
    customFields: [
      {
        key: 'emergency_service_24_7',
        label: '24/7 Emergency Service',
        type: 'boolean',
        description: 'Offers emergency HVAC services',
        extractionHints: ['24/7', 'emergency service'],
        required: false,
        defaultValue: false
      },
      {
        key: 'service_area_coverage',
        label: 'Service Area',
        type: 'array',
        description: 'Geographic service coverage',
        extractionHints: ['serving', 'service area'],
        required: false,
        defaultValue: []
      },
      {
        key: 'certifications',
        label: 'Certifications',
        type: 'array',
        description: 'NATE, EPA, or manufacturer certifications',
        extractionHints: ['certified', 'licensed'],
        required: false,
        defaultValue: []
      },
      {
        key: 'maintenance_plans',
        label: 'Offers Maintenance Plans',
        type: 'boolean',
        description: 'Recurring maintenance programs available',
        extractionHints: ['maintenance plan', 'service agreement'],
        required: false,
        defaultValue: false
      },
      {
        key: 'financing_options',
        label: 'Financing Available',
        type: 'boolean',
        description: 'Offers financing for equipment',
        extractionHints: ['financing', 'payment plans'],
        required: false,
        defaultValue: false
      },
      {
        key: 'years_in_business',
        label: 'Years in Business',
        type: 'number',
        description: 'Company age',
        extractionHints: ['years', 'since', 'established'],
        required: false,
        defaultValue: 0
      },
      {
        key: 'commercial_services',
        label: 'Commercial Services',
        type: 'boolean',
        description: 'Serves commercial/industrial clients',
        extractionHints: ['commercial', 'industrial'],
        required: false,
        defaultValue: false
      }
    ]
  }
}
```

**For a Restaurant, the custom fields would be completely different:**
```typescript
// Example: Restaurant template would have fields like:
customFields: [
  { key: 'cuisine_type', label: 'Cuisine Type', type: 'singleSelect' },
  { key: 'seating_capacity', label: 'Seating Capacity', type: 'number' },
  { key: 'delivery_available', label: 'Delivery Available', type: 'boolean' },
  { key: 'reservation_system', label: 'Reservation System', type: 'text' },
  { key: 'price_range', label: 'Price Range', type: 'singleSelect' },
  { key: 'dietary_options', label: 'Dietary Options', type: 'multiSelect' },
  { key: 'liquor_license', label: 'Liquor License', type: 'boolean' }
]
```

**For Lawn Mowing, different again:**
```typescript
// Example: Lawn Care template would have fields like:
customFields: [
  { key: 'service_types', label: 'Service Types', type: 'multiSelect' }, // mowing, fertilizing, etc.
  { key: 'lot_size_specialization', label: 'Lot Size Specialization', type: 'singleSelect' },
  { key: 'equipment_type', label: 'Equipment Type', type: 'multiSelect' },
  { key: 'seasonal_services', label: 'Seasonal Services', type: 'multiSelect' },
  { key: 'commercial_properties', label: 'Commercial Properties', type: 'boolean' },
  { key: 'service_frequency', label: 'Service Frequency', type: 'singleSelect' }
]
```

---

## PART 3: HOW IT ALL CONNECTS

### The Complete Flow:

1. **User completes 40-question onboarding** → All answers stored in `OnboardingData` interface
   
2. **OnboardingData saved to Firestore:**
   ```
   /organizations/{orgId}/onboarding/current
   ```

3. **Industry template selected** (e.g., "hvac", "restaurant", "lawn-care")

4. **Base Model Builder** (`base-model-builder.ts`) combines:
   - OnboardingData (all 40 questions)
   - Industry Template (cognitive logic + custom fields)
   - Results in a mutated, industry-specific AI agent

5. **Schema Engine** creates CRM schemas with:
   - Standard 10 schemas (Leads, Companies, Contacts, etc.)
   - PLUS custom fields from industry template
   - Stored at: `/organizations/{orgId}/workspaces/{workspaceId}/schemas/{schemaId}`

6. **Result**: CRM is now customized for that specific industry!

---

## TESTING CHECKLIST FOR GEMINI

### After Onboarding Completion, Check:

**Firestore Locations:**
```
✅ /organizations/{orgId}/onboarding/current
   → Should contain all 40+ OnboardingData fields

✅ /organizations/{orgId}/agentPersona/current
   → Built from OnboardingData

✅ /organizations/{orgId}/knowledgeBase/current
   → Built from uploadedDocs, urls, faqs

✅ /baseModels/{baseModelId}
   → Contains businessContext with full OnboardingData
   → Contains sourceTemplateId (e.g., "hvac")

✅ /organizations/{orgId}/workspaces/default/schemas/*
   → Should have 10+ schemas
   → Industry-specific schemas should have custom fields
```

**For Restaurant vs. Lawn Mowing Comparison:**

| Schema Object | Restaurant Should Have | Lawn Mowing Should Have |
|--------------|------------------------|-------------------------|
| Companies    | cuisine_type, seating_capacity | service_types, lot_size |
| Leads        | dietary_restrictions | property_size |
| Deals        | reservation_date | service_frequency |
| Products     | menu_items | service_packages |

---

## FIELD TYPE REFERENCE

Available field types for CRM schemas:
- `text` - Short text
- `longText` - Multi-line text
- `number` - Numeric value
- `email` - Email address
- `url` - Website URL
- `date` - Date picker
- `checkbox` - Boolean yes/no
- `singleSelect` - Dropdown (one choice)
- `multiSelect` - Multi-choice dropdown
- `currency` - Money amount
- `phoneNumber` - Phone number
- `percent` - Percentage
- `lookup` - Reference to another schema

---

## END OF TESTING ROADMAP CODE

**Gemini: Use this to build your exhaustive test plan!**

**Key Testing Scenarios:**
1. Complete onboarding for HVAC company → verify all 40 fields in Firestore
2. Complete onboarding for Restaurant → verify different custom fields in schemas
3. Complete onboarding for Lawn Care → verify different custom fields again
4. Compare schema differences between industries
5. Verify Base Model includes correct industry template
6. Verify AI agent system prompt reflects onboarding answers
