/**
 * Form Database Service
 * Optimized Firestore operations for the Form Builder
 *
 * COLLECTION STRUCTURE:
 * organizations/{orgId}/workspaces/{workspaceId}/forms/{formId}
 * organizations/{orgId}/workspaces/{workspaceId}/forms/{formId}/fields/{fieldId}
 * organizations/{orgId}/workspaces/{workspaceId}/forms/{formId}/submissions/{submissionId}
 * organizations/{orgId}/workspaces/{workspaceId}/forms/{formId}/analytics/{date}
 * organizations/{orgId}/workspaces/{workspaceId}/forms/{formId}/fieldAnalytics/{fieldId_date}
 * organizations/{orgId}/workspaces/{workspaceId}/forms/{formId}/views/{viewId}
 * organizations/{orgId}/workspaces/{workspaceId}/formTemplates/{templateId}
 *
 * OPTIMIZATION STRATEGIES:
 * 1. Fields in subcollection - avoid document size limits, parallel loading
 * 2. Denormalized counters - avoid count queries
 * 3. Indexed fields in submissions - enable queries without full document load
 * 4. Daily analytics aggregation - avoid expensive real-time calculations
 * 5. View events with TTL - automatic cleanup of raw event data
 *
 * @module forms/form-db-service
 * @version 1.0.0
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  increment,
  Timestamp,
  writeBatch,
  runTransaction,
  QueryDocumentSnapshot,
  DocumentReference,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { logger } from '@/lib/logger/logger';
import type {
  FormDefinition,
  FormFieldConfig,
  FormSubmission,
  FormView,
  FormAnalyticsSummary,
  FormFieldAnalytics,
  FormTemplate,
  FormStatus,
  SubmissionStatus,
  FormFilters,
  SubmissionFilters,
  PaginationOptions,
  PaginatedResult,
  FormWithFields,
  FieldResponse,
  SubmissionMetadata,
  CRMFieldMapping,
} from './types';

// ============================================================================
// COLLECTION PATH HELPERS
// ============================================================================

const PATHS = {
  forms: (orgId: string, workspaceId: string) =>
    `organizations/${orgId}/workspaces/${workspaceId}/forms`,

  form: (orgId: string, workspaceId: string, formId: string) =>
    `organizations/${orgId}/workspaces/${workspaceId}/forms/${formId}`,

  fields: (orgId: string, workspaceId: string, formId: string) =>
    `organizations/${orgId}/workspaces/${workspaceId}/forms/${formId}/fields`,

  field: (orgId: string, workspaceId: string, formId: string, fieldId: string) =>
    `organizations/${orgId}/workspaces/${workspaceId}/forms/${formId}/fields/${fieldId}`,

  submissions: (orgId: string, workspaceId: string, formId: string) =>
    `organizations/${orgId}/workspaces/${workspaceId}/forms/${formId}/submissions`,

  submission: (orgId: string, workspaceId: string, formId: string, submissionId: string) =>
    `organizations/${orgId}/workspaces/${workspaceId}/forms/${formId}/submissions/${submissionId}`,

  analytics: (orgId: string, workspaceId: string, formId: string) =>
    `organizations/${orgId}/workspaces/${workspaceId}/forms/${formId}/analytics`,

  fieldAnalytics: (orgId: string, workspaceId: string, formId: string) =>
    `organizations/${orgId}/workspaces/${workspaceId}/forms/${formId}/fieldAnalytics`,

  views: (orgId: string, workspaceId: string, formId: string) =>
    `organizations/${orgId}/workspaces/${workspaceId}/forms/${formId}/views`,

  templates: (orgId: string, workspaceId: string) =>
    `organizations/${orgId}/workspaces/${workspaceId}/formTemplates`,
};

// ============================================================================
// FORM DEFINITION OPERATIONS
// ============================================================================

/**
 * Create a new form definition
 * Fields should be added separately via addFormField()
 */
export async function createForm(
  orgId: string,
  workspaceId: string,
  data: Omit<FormDefinition, 'id' | 'organizationId' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'fieldCount' | 'submissionCount' | 'viewCount'>
): Promise<FormDefinition> {
  const formsRef = collection(db, PATHS.forms(orgId, workspaceId));
  const formDoc = doc(formsRef);
  const formId = formDoc.id;

  const form: FormDefinition = {
    ...data,
    id: formId,
    organizationId: orgId,
    workspaceId,
    version: 1,
    fieldCount: 0,
    submissionCount: 0,
    viewCount: 0,
    createdAt: serverTimestamp() as unknown as Timestamp,
    updatedAt: serverTimestamp() as unknown as Timestamp,
  };

  await setDoc(formDoc, form);

  logger.info('Form created', { orgId, workspaceId, formId, name: data.name });

  return { ...form, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
}

/**
 * Get form definition by ID
 */
export async function getForm(
  orgId: string,
  workspaceId: string,
  formId: string
): Promise<FormDefinition | null> {
  const formRef = doc(db, PATHS.form(orgId, workspaceId, formId));
  const formSnap = await getDoc(formRef);

  if (!formSnap.exists()) {
    return null;
  }

  return formSnap.data() as FormDefinition;
}

/**
 * Get form with all fields (parallel loading)
 * Optimized: loads form doc and fields subcollection in parallel
 */
export async function getFormWithFields(
  orgId: string,
  workspaceId: string,
  formId: string
): Promise<FormWithFields | null> {
  // Parallel fetch - form document + fields subcollection
  const [formSnap, fieldsSnap] = await Promise.all([
    getDoc(doc(db, PATHS.form(orgId, workspaceId, formId))),
    getDocs(
      query(
        collection(db, PATHS.fields(orgId, workspaceId, formId)),
        orderBy('pageIndex', 'asc'),
        orderBy('order', 'asc')
      )
    ),
  ]);

  if (!formSnap.exists()) {
    return null;
  }

  const form = formSnap.data() as FormDefinition;
  const fields = fieldsSnap.docs.map((doc) => doc.data() as FormFieldConfig);

  return { ...form, fields };
}

/**
 * Update form definition
 * Automatically increments version on status change to published
 */
export async function updateForm(
  orgId: string,
  workspaceId: string,
  formId: string,
  updates: Partial<Omit<FormDefinition, 'id' | 'organizationId' | 'workspaceId' | 'createdAt'>>
): Promise<void> {
  const formRef = doc(db, PATHS.form(orgId, workspaceId, formId));

  const updateData: Record<string, any> = {
    ...updates,
    updatedAt: serverTimestamp(),
  };

  // Increment version when publishing
  if (updates.status === 'published') {
    updateData.version = increment(1);
    updateData.publishedAt = serverTimestamp();
  }

  await updateDoc(formRef, updateData);

  logger.info('Form updated', { orgId, workspaceId, formId, updates: Object.keys(updates) });
}

/**
 * Delete form and all subcollections
 * Uses batch delete for efficiency
 */
export async function deleteForm(
  orgId: string,
  workspaceId: string,
  formId: string
): Promise<void> {
  const batch = writeBatch(db);

  // Delete fields subcollection
  const fieldsSnap = await getDocs(collection(db, PATHS.fields(orgId, workspaceId, formId)));
  fieldsSnap.docs.forEach((doc) => batch.delete(doc.ref));

  // Delete form document
  batch.delete(doc(db, PATHS.form(orgId, workspaceId, formId)));

  await batch.commit();

  // Note: Submissions and analytics should be handled separately
  // They may need to be retained for compliance/audit purposes

  logger.info('Form deleted', { orgId, workspaceId, formId });
}

/**
 * List forms with filtering and pagination
 *
 * QUERY PATTERNS:
 * - All forms: orderBy updatedAt DESC
 * - By status: where status == X, orderBy updatedAt DESC
 * - By creator: where createdBy == X, orderBy createdAt DESC
 * - Search: client-side filter on name (Firestore doesn't support full-text search)
 */
export async function listForms(
  orgId: string,
  workspaceId: string,
  filters: FormFilters = {},
  pagination: PaginationOptions = {}
): Promise<PaginatedResult<FormDefinition>> {
  const { status, createdBy, category, search, dateRange } = filters;
  const { pageSize = 20, cursor, orderBy: sortField = 'updatedAt', orderDirection = 'desc' } = pagination;

  const formsRef = collection(db, PATHS.forms(orgId, workspaceId));
  const constraints: QueryConstraint[] = [];

  // Apply filters
  if (status) {
    constraints.push(where('status', '==', status));
  }

  if (createdBy) {
    constraints.push(where('createdBy', '==', createdBy));
  }

  if (category) {
    constraints.push(where('category', '==', category));
  }

  if (dateRange) {
    constraints.push(where('createdAt', '>=', Timestamp.fromDate(dateRange.start)));
    constraints.push(where('createdAt', '<=', Timestamp.fromDate(dateRange.end)));
  }

  // Add ordering
  constraints.push(orderBy(sortField, orderDirection));

  // Pagination
  constraints.push(limit(pageSize + 1));

  if (cursor) {
    const cursorDoc = await getDoc(doc(db, PATHS.forms(orgId, workspaceId), cursor));
    if (cursorDoc.exists()) {
      constraints.push(startAfter(cursorDoc));
    }
  }

  const q = query(formsRef, ...constraints);
  const snapshot = await getDocs(q);

  let forms = snapshot.docs.slice(0, pageSize).map((doc) => doc.data() as FormDefinition);

  // Client-side search filter (Firestore limitation)
  if (search) {
    const searchLower = search.toLowerCase();
    forms = forms.filter(
      (form) =>
        form.name.toLowerCase().includes(searchLower) ||
        form.description?.toLowerCase().includes(searchLower)
    );
  }

  const hasMore = snapshot.docs.length > pageSize;
  const lastDoc = forms.length > 0 ? forms[forms.length - 1] : null;

  return {
    items: forms,
    nextCursor: hasMore && lastDoc ? lastDoc.id : null,
    hasMore,
  };
}

/**
 * Duplicate a form with all fields
 * Uses transaction for atomicity
 */
export async function duplicateForm(
  orgId: string,
  workspaceId: string,
  formId: string,
  newName?: string
): Promise<FormDefinition> {
  return runTransaction(db, async (transaction) => {
    // Get original form
    const formRef = doc(db, PATHS.form(orgId, workspaceId, formId));
    const formSnap = await transaction.get(formRef);

    if (!formSnap.exists()) {
      throw new Error(`Form not found: ${formId}`);
    }

    const originalForm = formSnap.data() as FormDefinition;

    // Get original fields
    const fieldsSnap = await getDocs(
      query(collection(db, PATHS.fields(orgId, workspaceId, formId)), orderBy('order', 'asc'))
    );
    const originalFields = fieldsSnap.docs.map((doc) => doc.data() as FormFieldConfig);

    // Create new form
    const newFormRef = doc(collection(db, PATHS.forms(orgId, workspaceId)));
    const newFormId = newFormRef.id;

    const newForm: FormDefinition = {
      ...originalForm,
      id: newFormId,
      name: newName || `${originalForm.name} (Copy)`,
      status: 'draft',
      version: 1,
      submissionCount: 0,
      viewCount: 0,
      publishedAt: undefined,
      createdAt: serverTimestamp() as unknown as Timestamp,
      updatedAt: serverTimestamp() as unknown as Timestamp,
    };

    transaction.set(newFormRef, newForm);

    // Copy fields with new IDs
    for (const field of originalFields) {
      const newFieldRef = doc(collection(db, PATHS.fields(orgId, workspaceId, newFormId)));
      const newField: FormFieldConfig = {
        ...field,
        id: newFieldRef.id,
        formId: newFormId,
        createdAt: serverTimestamp() as unknown as Timestamp,
        updatedAt: serverTimestamp() as unknown as Timestamp,
      };
      transaction.set(newFieldRef, newField);
    }

    logger.info('Form duplicated', { orgId, workspaceId, originalFormId: formId, newFormId });

    return { ...newForm, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
  });
}

// ============================================================================
// FORM FIELD OPERATIONS
// ============================================================================

/**
 * Add a field to a form
 * Updates form fieldCount
 */
export async function addFormField(
  orgId: string,
  workspaceId: string,
  formId: string,
  fieldData: Omit<FormFieldConfig, 'id' | 'formId' | 'organizationId' | 'workspaceId' | 'createdAt' | 'updatedAt'>
): Promise<FormFieldConfig> {
  const fieldsRef = collection(db, PATHS.fields(orgId, workspaceId, formId));
  const fieldDoc = doc(fieldsRef);
  const fieldId = fieldDoc.id;

  const field: FormFieldConfig = {
    ...fieldData,
    id: fieldId,
    formId,
    organizationId: orgId,
    workspaceId,
    createdAt: serverTimestamp() as unknown as Timestamp,
    updatedAt: serverTimestamp() as unknown as Timestamp,
  };

  // Batch: create field + increment form counter
  const batch = writeBatch(db);
  batch.set(fieldDoc, field);
  batch.update(doc(db, PATHS.form(orgId, workspaceId, formId)), {
    fieldCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  logger.info('Field added', { orgId, workspaceId, formId, fieldId, type: field.type });

  return { ...field, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
}

/**
 * Update a form field
 */
export async function updateFormField(
  orgId: string,
  workspaceId: string,
  formId: string,
  fieldId: string,
  updates: Partial<Omit<FormFieldConfig, 'id' | 'formId' | 'organizationId' | 'workspaceId' | 'createdAt'>>
): Promise<void> {
  const fieldRef = doc(db, PATHS.field(orgId, workspaceId, formId, fieldId));

  await updateDoc(fieldRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  // Also update form's updatedAt
  await updateDoc(doc(db, PATHS.form(orgId, workspaceId, formId)), {
    updatedAt: serverTimestamp(),
  });

  logger.info('Field updated', { orgId, workspaceId, formId, fieldId });
}

/**
 * Delete a form field
 */
export async function deleteFormField(
  orgId: string,
  workspaceId: string,
  formId: string,
  fieldId: string
): Promise<void> {
  const batch = writeBatch(db);

  batch.delete(doc(db, PATHS.field(orgId, workspaceId, formId, fieldId)));
  batch.update(doc(db, PATHS.form(orgId, workspaceId, formId)), {
    fieldCount: increment(-1),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  logger.info('Field deleted', { orgId, workspaceId, formId, fieldId });
}

/**
 * Get all fields for a form (ordered)
 */
export async function getFormFields(
  orgId: string,
  workspaceId: string,
  formId: string
): Promise<FormFieldConfig[]> {
  const q = query(
    collection(db, PATHS.fields(orgId, workspaceId, formId)),
    orderBy('pageIndex', 'asc'),
    orderBy('order', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as FormFieldConfig);
}

/**
 * Reorder fields within a form
 * Efficient batch update
 */
export async function reorderFormFields(
  orgId: string,
  workspaceId: string,
  formId: string,
  fieldOrders: Array<{ fieldId: string; pageIndex: number; order: number }>
): Promise<void> {
  const batch = writeBatch(db);

  for (const { fieldId, pageIndex, order } of fieldOrders) {
    batch.update(doc(db, PATHS.field(orgId, workspaceId, formId, fieldId)), {
      pageIndex,
      order,
      updatedAt: serverTimestamp(),
    });
  }

  batch.update(doc(db, PATHS.form(orgId, workspaceId, formId)), {
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  logger.info('Fields reordered', { orgId, workspaceId, formId, count: fieldOrders.length });
}

// ============================================================================
// FORM SUBMISSION OPERATIONS
// ============================================================================

/**
 * Create a form submission
 * Extracts indexed fields for efficient querying
 */
export async function createSubmission(
  orgId: string,
  workspaceId: string,
  formId: string,
  data: {
    responses: FieldResponse[];
    metadata: SubmissionMetadata;
    isPartial?: boolean;
    pageProgress?: FormSubmission['pageProgress'];
  }
): Promise<FormSubmission> {
  const { responses, metadata, isPartial = false, pageProgress } = data;

  // Get form for validation and version
  const form = await getForm(orgId, workspaceId, formId);
  if (!form) {
    throw new Error(`Form not found: ${formId}`);
  }

  // Validate form is published (unless partial)
  if (form.status !== 'published' && !isPartial) {
    throw new Error('Cannot submit to unpublished form');
  }

  // Check limits
  if (!isPartial && form.behavior.maxSubmissions > 0 && form.submissionCount >= form.behavior.maxSubmissions) {
    throw new Error('Form has reached maximum submissions');
  }

  const submissionsRef = collection(db, PATHS.submissions(orgId, workspaceId, formId));
  const submissionDoc = doc(submissionsRef);
  const submissionId = submissionDoc.id;

  // Extract indexed fields from responses
  const indexedFields = extractIndexedFields(responses);

  // Generate confirmation number
  const confirmationNumber = generateConfirmationNumber();

  // Generate resume token for partial submissions
  const resumeToken = isPartial ? generateResumeToken() : undefined;

  const submission: FormSubmission = {
    id: submissionId,
    formId,
    formVersion: form.version,
    organizationId: orgId,
    workspaceId,
    status: isPartial ? 'partial' : 'pending',
    responses,
    ...indexedFields,
    confirmationNumber,
    isPartial,
    resumeToken,
    pageProgress,
    metadata,
    submittedAt: serverTimestamp() as unknown as Timestamp,
    createdAt: serverTimestamp() as unknown as Timestamp,
    updatedAt: serverTimestamp() as unknown as Timestamp,
  };

  // Batch: create submission + update form counter (if not partial)
  const batch = writeBatch(db);
  batch.set(submissionDoc, submission);

  if (!isPartial) {
    batch.update(doc(db, PATHS.form(orgId, workspaceId, formId)), {
      submissionCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();

  logger.info('Submission created', {
    orgId,
    workspaceId,
    formId,
    submissionId,
    isPartial,
    confirmationNumber,
  });

  return { ...submission, submittedAt: Timestamp.now(), createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
}

/**
 * Get submission by ID
 */
export async function getSubmission(
  orgId: string,
  workspaceId: string,
  formId: string,
  submissionId: string
): Promise<FormSubmission | null> {
  const submissionRef = doc(db, PATHS.submission(orgId, workspaceId, formId, submissionId));
  const submissionSnap = await getDoc(submissionRef);

  if (!submissionSnap.exists()) {
    return null;
  }

  return submissionSnap.data() as FormSubmission;
}

/**
 * Get submission by resume token (for save and continue)
 */
export async function getSubmissionByResumeToken(
  orgId: string,
  workspaceId: string,
  formId: string,
  resumeToken: string
): Promise<FormSubmission | null> {
  const q = query(
    collection(db, PATHS.submissions(orgId, workspaceId, formId)),
    where('resumeToken', '==', resumeToken),
    where('isPartial', '==', true),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].data() as FormSubmission;
}

/**
 * Get submission by confirmation number
 */
export async function getSubmissionByConfirmation(
  orgId: string,
  workspaceId: string,
  formId: string,
  confirmationNumber: string
): Promise<FormSubmission | null> {
  const q = query(
    collection(db, PATHS.submissions(orgId, workspaceId, formId)),
    where('confirmationNumber', '==', confirmationNumber),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].data() as FormSubmission;
}

/**
 * Update submission (for partial -> complete, or CRM sync status)
 */
export async function updateSubmission(
  orgId: string,
  workspaceId: string,
  formId: string,
  submissionId: string,
  updates: Partial<FormSubmission>
): Promise<void> {
  const submissionRef = doc(db, PATHS.submission(orgId, workspaceId, formId, submissionId));

  // If completing a partial submission
  if (updates.isPartial === false) {
    updates.status = 'pending';
    updates.submittedAt = serverTimestamp() as unknown as Timestamp;

    // Update form counter
    await updateDoc(doc(db, PATHS.form(orgId, workspaceId, formId)), {
      submissionCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  }

  // Re-extract indexed fields if responses changed
  if (updates.responses) {
    const indexedFields = extractIndexedFields(updates.responses);
    Object.assign(updates, indexedFields);
  }

  await updateDoc(submissionRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  logger.info('Submission updated', { orgId, workspaceId, formId, submissionId });
}

/**
 * List submissions with filtering and pagination
 *
 * QUERY PATTERNS:
 * - All submissions: orderBy submittedAt DESC
 * - By status: where status == X, orderBy submittedAt DESC
 * - By date range: where submittedAt >= start, <= end
 * - By email: where indexedEmail == X, orderBy submittedAt DESC
 * - By CRM link: where linkedLeadId == X
 */
export async function listSubmissions(
  orgId: string,
  workspaceId: string,
  formId: string,
  filters: SubmissionFilters = {},
  pagination: PaginationOptions = {}
): Promise<PaginatedResult<FormSubmission>> {
  const { status, formVersion, dateRange, email, linkedLeadId, linkedContactId, isPartial } = filters;
  const { pageSize = 50, cursor, orderDirection = 'desc' } = pagination;

  const submissionsRef = collection(db, PATHS.submissions(orgId, workspaceId, formId));
  const constraints: QueryConstraint[] = [];

  // Apply filters
  if (status) {
    constraints.push(where('status', '==', status));
  }

  if (formVersion !== undefined) {
    constraints.push(where('formVersion', '==', formVersion));
  }

  if (dateRange) {
    constraints.push(where('submittedAt', '>=', Timestamp.fromDate(dateRange.start)));
    constraints.push(where('submittedAt', '<=', Timestamp.fromDate(dateRange.end)));
  }

  if (email) {
    constraints.push(where('indexedEmail', '==', email.toLowerCase()));
  }

  if (linkedLeadId) {
    constraints.push(where('linkedLeadId', '==', linkedLeadId));
  }

  if (linkedContactId) {
    constraints.push(where('linkedContactId', '==', linkedContactId));
  }

  if (isPartial !== undefined) {
    constraints.push(where('isPartial', '==', isPartial));
  }

  // Add ordering
  constraints.push(orderBy('submittedAt', orderDirection));
  constraints.push(limit(pageSize + 1));

  // Pagination cursor
  if (cursor) {
    const cursorDoc = await getDoc(doc(db, PATHS.submissions(orgId, workspaceId, formId), cursor));
    if (cursorDoc.exists()) {
      constraints.push(startAfter(cursorDoc));
    }
  }

  const q = query(submissionsRef, ...constraints);
  const snapshot = await getDocs(q);

  const submissions = snapshot.docs.slice(0, pageSize).map((doc) => doc.data() as FormSubmission);
  const hasMore = snapshot.docs.length > pageSize;
  const lastDoc = submissions.length > 0 ? submissions[submissions.length - 1] : null;

  return {
    items: submissions,
    nextCursor: hasMore && lastDoc ? lastDoc.id : null,
    hasMore,
  };
}

/**
 * Delete a submission
 */
export async function deleteSubmission(
  orgId: string,
  workspaceId: string,
  formId: string,
  submissionId: string
): Promise<void> {
  const submission = await getSubmission(orgId, workspaceId, formId, submissionId);
  if (!submission) {
    return;
  }

  const batch = writeBatch(db);

  batch.delete(doc(db, PATHS.submission(orgId, workspaceId, formId, submissionId)));

  // Decrement counter only if it was a complete submission
  if (!submission.isPartial) {
    batch.update(doc(db, PATHS.form(orgId, workspaceId, formId)), {
      submissionCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();

  logger.info('Submission deleted', { orgId, workspaceId, formId, submissionId });
}

// ============================================================================
// FORM VIEW & ANALYTICS OPERATIONS
// ============================================================================

/**
 * Track a form view
 */
export async function trackFormView(
  orgId: string,
  workspaceId: string,
  formId: string,
  metadata: Partial<SubmissionMetadata>,
  sessionId: string
): Promise<string> {
  const viewsRef = collection(db, PATHS.views(orgId, workspaceId, formId));
  const viewDoc = doc(viewsRef);
  const viewId = viewDoc.id;

  // Set expiry for 30 days (TTL cleanup)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const view: FormView = {
    id: viewId,
    formId,
    organizationId: orgId,
    viewedAt: serverTimestamp() as unknown as Timestamp,
    sessionId,
    converted: false,
    metadata,
    expiresAt: Timestamp.fromDate(expiresAt),
  };

  // Batch: create view + increment form counter
  const batch = writeBatch(db);
  batch.set(viewDoc, view);
  batch.update(doc(db, PATHS.form(orgId, workspaceId, formId)), {
    viewCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  // Update daily analytics (fire-and-forget for performance)
  updateDailyAnalytics(orgId, workspaceId, formId, 'view', metadata).catch((err) =>
    logger.warn('Failed to update daily analytics', err)
  );

  return viewId;
}

/**
 * Mark a view as converted
 */
export async function markViewAsConverted(
  orgId: string,
  workspaceId: string,
  formId: string,
  viewId: string,
  submissionId: string
): Promise<void> {
  const viewRef = doc(db, PATHS.views(orgId, workspaceId, formId), viewId);

  await updateDoc(viewRef, {
    converted: true,
    submissionId,
  });
}

/**
 * Update daily analytics aggregation
 * Called asynchronously on view/submission events
 */
export async function updateDailyAnalytics(
  orgId: string,
  workspaceId: string,
  formId: string,
  eventType: 'view' | 'submission' | 'partial',
  metadata?: Partial<SubmissionMetadata>,
  completionTime?: number
): Promise<void> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const analyticsRef = doc(db, PATHS.analytics(orgId, workspaceId, formId), today);

  // Try to update, create if doesn't exist
  try {
    await runTransaction(db, async (transaction) => {
      const analyticsSnap = await transaction.get(analyticsRef);

      if (!analyticsSnap.exists()) {
        // Create new analytics document
        const newAnalytics: FormAnalyticsSummary = {
          id: today,
          formId,
          organizationId: orgId,
          workspaceId,
          date: today,
          views: eventType === 'view' ? 1 : 0,
          uniqueViews: eventType === 'view' ? 1 : 0,
          submissions: eventType === 'submission' ? 1 : 0,
          partialSubmissions: eventType === 'partial' ? 1 : 0,
          completedSubmissions: eventType === 'submission' ? 1 : 0,
          conversionRate: 0,
          completionRate: 0,
          totalCompletionTime: completionTime || 0,
          averageCompletionTime: completionTime || 0,
          minCompletionTime: completionTime || 0,
          maxCompletionTime: completionTime || 0,
          byDevice: {
            desktop: metadata?.deviceType === 'desktop' ? 1 : 0,
            tablet: metadata?.deviceType === 'tablet' ? 1 : 0,
            mobile: metadata?.deviceType === 'mobile' ? 1 : 0,
          },
          bySource: metadata?.source ? { [metadata.source]: 1 } : {},
          byReferrer: metadata?.referrer ? { [metadata.referrer]: 1 } : {},
          byCountry: metadata?.country ? { [metadata.country]: 1 } : {},
          byUtmSource: metadata?.utmSource ? { [metadata.utmSource]: 1 } : {},
          byUtmMedium: metadata?.utmMedium ? { [metadata.utmMedium]: 1 } : {},
          byUtmCampaign: metadata?.utmCampaign ? { [metadata.utmCampaign]: 1 } : {},
          lastUpdated: serverTimestamp() as unknown as Timestamp,
        };

        transaction.set(analyticsRef, newAnalytics);
      } else {
        // Update existing analytics
        const updates: Record<string, any> = {
          lastUpdated: serverTimestamp(),
        };

        if (eventType === 'view') {
          updates.views = increment(1);
        } else if (eventType === 'submission') {
          updates.submissions = increment(1);
          updates.completedSubmissions = increment(1);
          if (completionTime) {
            updates.totalCompletionTime = increment(completionTime);
          }
        } else if (eventType === 'partial') {
          updates.partialSubmissions = increment(1);
        }

        // Update device breakdown
        if (metadata?.deviceType) {
          updates[`byDevice.${metadata.deviceType}`] = increment(1);
        }

        transaction.update(analyticsRef, updates);
      }
    });
  } catch (error) {
    logger.warn('Failed to update daily analytics', { error, formId, eventType });
  }
}

/**
 * Get analytics for a date range
 */
export async function getFormAnalytics(
  orgId: string,
  workspaceId: string,
  formId: string,
  startDate: Date,
  endDate: Date
): Promise<FormAnalyticsSummary[]> {
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  const q = query(
    collection(db, PATHS.analytics(orgId, workspaceId, formId)),
    where('date', '>=', startDateStr),
    where('date', '<=', endDateStr),
    orderBy('date', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as FormAnalyticsSummary);
}

/**
 * Get field-level analytics
 */
export async function getFieldAnalytics(
  orgId: string,
  workspaceId: string,
  formId: string,
  startDate: Date,
  endDate: Date
): Promise<FormFieldAnalytics[]> {
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  const q = query(
    collection(db, PATHS.fieldAnalytics(orgId, workspaceId, formId)),
    where('date', '>=', startDateStr),
    where('date', '<=', endDateStr),
    orderBy('date', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as FormFieldAnalytics);
}

// ============================================================================
// FORM TEMPLATE OPERATIONS
// ============================================================================

/**
 * Create a form template
 */
export async function createFormTemplate(
  orgId: string,
  workspaceId: string,
  data: Omit<FormTemplate, 'id' | 'organizationId' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'usageCount'>
): Promise<FormTemplate> {
  const templatesRef = collection(db, PATHS.templates(orgId, workspaceId));
  const templateDoc = doc(templatesRef);
  const templateId = templateDoc.id;

  const template: FormTemplate = {
    ...data,
    id: templateId,
    organizationId: orgId,
    workspaceId,
    usageCount: 0,
    createdAt: serverTimestamp() as unknown as Timestamp,
    updatedAt: serverTimestamp() as unknown as Timestamp,
  };

  await setDoc(templateDoc, template);

  logger.info('Form template created', { orgId, workspaceId, templateId, name: data.name });

  return { ...template, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
}

/**
 * Create form from template
 */
export async function createFormFromTemplate(
  orgId: string,
  workspaceId: string,
  templateId: string,
  formName: string,
  createdBy: string
): Promise<FormDefinition> {
  // Get template
  const templateRef = doc(db, PATHS.templates(orgId, workspaceId), templateId);
  const templateSnap = await getDoc(templateRef);

  if (!templateSnap.exists()) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const template = templateSnap.data() as FormTemplate;

  return runTransaction(db, async (transaction) => {
    // Create form
    const formsRef = collection(db, PATHS.forms(orgId, workspaceId));
    const formDoc = doc(formsRef);
    const formId = formDoc.id;

    const form: FormDefinition = {
      id: formId,
      organizationId: orgId,
      workspaceId,
      name: formName,
      description: template.description,
      status: 'draft',
      version: 1,
      category: template.category,
      pages: template.formData.pages,
      settings: {
        submitButtonText: 'Submit',
        showProgressBar: true,
        showPageNumbers: true,
        allowSaveDraft: false,
        confirmationType: 'message',
        confirmationMessage: 'Thank you for your submission!',
        sendEmailNotification: false,
        sendAutoReply: false,
        showBranding: true,
        enableCaptcha: false,
        requireLogin: false,
        ...template.formData.settings,
      },
      behavior: {
        maxSubmissions: 0,
        allowMultipleSubmissions: true,
        showThankYouPage: true,
        enableSaveAndContinue: false,
        ...template.formData.behavior,
      },
      crmMapping: {
        enabled: false,
        entityType: 'lead',
        fieldMappings: [],
        createNew: true,
        updateExisting: false,
        ...template.formData.crmMapping,
      },
      trackingEnabled: true,
      publicAccess: false,
      createdBy,
      lastModifiedBy: createdBy,
      fieldCount: template.fields.length,
      submissionCount: 0,
      viewCount: 0,
      createdAt: serverTimestamp() as unknown as Timestamp,
      updatedAt: serverTimestamp() as unknown as Timestamp,
    };

    transaction.set(formDoc, form);

    // Create fields from template
    for (const fieldData of template.fields) {
      const fieldRef = doc(collection(db, PATHS.fields(orgId, workspaceId, formId)));
      const field: FormFieldConfig = {
        ...fieldData,
        id: fieldRef.id,
        formId,
        organizationId: orgId,
        workspaceId,
        createdAt: serverTimestamp() as unknown as Timestamp,
        updatedAt: serverTimestamp() as unknown as Timestamp,
      };
      transaction.set(fieldRef, field);
    }

    // Increment template usage count
    transaction.update(templateRef, {
      usageCount: increment(1),
      updatedAt: serverTimestamp(),
    });

    logger.info('Form created from template', { orgId, workspaceId, templateId, formId });

    return { ...form, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
  });
}

/**
 * List form templates
 */
export async function listFormTemplates(
  orgId: string,
  workspaceId: string,
  category?: string
): Promise<FormTemplate[]> {
  const templatesRef = collection(db, PATHS.templates(orgId, workspaceId));

  const constraints: QueryConstraint[] = [];

  if (category) {
    constraints.push(where('category', '==', category));
  }

  constraints.push(orderBy('name', 'asc'));

  const q = query(templatesRef, ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => doc.data() as FormTemplate);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract indexed fields from responses for efficient querying
 */
function extractIndexedFields(responses: FieldResponse[]): {
  indexedEmail?: string;
  indexedPhone?: string;
  indexedName?: string;
  indexedCompany?: string;
} {
  const indexed: Record<string, string> = {};

  for (const response of responses) {
    const nameLower = response.fieldName.toLowerCase();

    // Email field
    if (
      response.fieldType === 'email' ||
      nameLower.includes('email')
    ) {
      if (typeof response.value === 'string' && response.value) {
        indexed.indexedEmail = response.value.toLowerCase();
      }
    }

    // Phone field
    if (
      response.fieldType === 'phone' ||
      nameLower.includes('phone') ||
      nameLower.includes('tel')
    ) {
      if (typeof response.value === 'string' && response.value) {
        indexed.indexedPhone = response.value.replace(/\D/g, ''); // Normalize
      }
    }

    // Name field
    if (
      response.fieldType === 'name' ||
      nameLower === 'name' ||
      nameLower === 'fullname' ||
      nameLower === 'full_name'
    ) {
      if (typeof response.value === 'string' && response.value) {
        indexed.indexedName = response.value;
      } else if (typeof response.value === 'object' && response.value) {
        // Composite name field
        const { firstName, lastName } = response.value;
        indexed.indexedName = `${firstName || ''} ${lastName || ''}`.trim();
      }
    }

    // Company field
    if (
      nameLower.includes('company') ||
      nameLower.includes('organization') ||
      nameLower.includes('business')
    ) {
      if (typeof response.value === 'string' && response.value) {
        indexed.indexedCompany = response.value;
      }
    }
  }

  return indexed;
}

/**
 * Generate confirmation number
 */
function generateConfirmationNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${timestamp}-${random}`;
}

/**
 * Generate resume token for save and continue
 */
function generateResumeToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Log service initialization
logger.info('Form database service initialized');
