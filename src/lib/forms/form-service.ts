/**
 * Form Service
 *
 * Core service for form CRUD operations, submission handling,
 * and integration with CRM and Orchestrator systems.
 *
 * @module forms/form-service
 * @version 1.0.0
 */

import {
  type QueryDocumentSnapshot,
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
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

// Helper to ensure db is available
function getDb() {
  if (!db) {
    throw new Error('Firebase is not initialized');
  }
  return db;
}
import type {
  FormDefinition,
  FormSubmission,
  FormStatus,
  FieldResponse,
  SubmissionMetadata,
  FormView,
} from './types';

// ============================================================================
// COLLECTION PATHS
// ============================================================================

const getFormsCollectionPath = (workspaceId: string) =>
  `organizations/${PLATFORM_ID}/workspaces/${workspaceId}/forms`;

const getSubmissionsCollectionPath = (workspaceId: string, formId: string) =>
  `organizations/${PLATFORM_ID}/workspaces/${workspaceId}/forms/${formId}/submissions`;

const getViewsCollectionPath = (workspaceId: string, formId: string) =>
  `organizations/${PLATFORM_ID}/workspaces/${workspaceId}/forms/${formId}/views`;

const _getAnalyticsCollectionPath = (workspaceId: string, formId: string) =>
  `organizations/${PLATFORM_ID}/workspaces/${workspaceId}/forms/${formId}/analytics`;

// ============================================================================
// FORM CRUD OPERATIONS
// ============================================================================

/**
 * Create a new form definition
 */
export async function createForm(
  workspaceId: string,
  formData: Omit<FormDefinition, 'id' | 'createdAt' | 'updatedAt' | 'submissionCount' | 'viewCount'>
): Promise<FormDefinition> {
  const formsRef = collection(getDb(), getFormsCollectionPath(workspaceId));
  const formDoc = doc(formsRef);
  const formId = formDoc.id;

  const form: FormDefinition = {
    ...formData,
    id: formId,
    workspaceId,
    // Cast required: serverTimestamp() returns FieldValue, resolved to Timestamp on write
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
    submissionCount: 0,
    viewCount: 0,
  };

  await setDoc(formDoc, form);

  logger.info('Form created', { workspaceId, formId, name: form.name });

  return { ...form, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
}

/**
 * Get a form by ID
 */
export async function getForm(
  workspaceId: string,
  formId: string
): Promise<FormDefinition | null> {
  const formRef = doc(getDb(), getFormsCollectionPath(workspaceId), formId);
  const formSnap = await getDoc(formRef);

  if (!formSnap.exists()) {
    return null;
  }

  return formSnap.data() as FormDefinition;
}

/**
 * Update a form definition
 */
export async function updateForm(
  workspaceId: string,
  formId: string,
  updates: Partial<FormDefinition>
): Promise<void> {
  const formRef = doc(getDb(), getFormsCollectionPath(workspaceId), formId);

  await updateDoc(formRef, {
    ...updates,
    updatedAt: serverTimestamp(),
    version: increment(1),
  });

  logger.info('Form updated', { workspaceId, formId });
}

/**
 * Delete a form
 */
export async function deleteForm(
  workspaceId: string,
  formId: string
): Promise<void> {
  const formRef = doc(getDb(), getFormsCollectionPath(workspaceId), formId);
  await deleteDoc(formRef);

  logger.info('Form deleted', { workspaceId, formId });
}

/**
 * List forms with pagination
 */
export async function listForms(
  workspaceId: string,
  options: {
    status?: FormStatus;
    category?: string;
    pageSize?: number;
    lastDoc?: QueryDocumentSnapshot;
    orderByField?: 'name' | 'createdAt' | 'updatedAt' | 'submissionCount';
    orderDirection?: 'asc' | 'desc';
  } = {}
): Promise<{
  forms: FormDefinition[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}> {
  const {
    status,
    category,
    pageSize = 20,
    lastDoc,
    orderByField = 'updatedAt',
    orderDirection = 'desc',
  } = options;

  const formsRef = collection(getDb(), getFormsCollectionPath(workspaceId));

  const constraints: ReturnType<typeof where | typeof orderBy | typeof limit | typeof startAfter>[] = [];

  if (status) {
    constraints.push(where('status', '==', status));
  }

  if (category) {
    constraints.push(where('category', '==', category));
  }

  constraints.push(orderBy(orderByField, orderDirection));
  constraints.push(limit(pageSize + 1));

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const q = query(formsRef, ...constraints);
  const snapshot = await getDocs(q);

  const forms = snapshot.docs.slice(0, pageSize).map((doc) => doc.data() as FormDefinition);
  const hasMore = snapshot.docs.length > pageSize;
  const newLastDoc = snapshot.docs.length > 0 ? snapshot.docs[Math.min(pageSize - 1, snapshot.docs.length - 1)] : null;

  return { forms, lastDoc: newLastDoc, hasMore };
}

/**
 * Publish a form
 */
export async function publishForm(
  workspaceId: string,
  formId: string
): Promise<void> {
  const formRef = doc(getDb(), getFormsCollectionPath(workspaceId), formId);

  await updateDoc(formRef, {
    status: 'published',
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  logger.info('Form published', { workspaceId, formId });
}

/**
 * Duplicate a form
 */
export async function duplicateForm(
  workspaceId: string,
  formId: string,
  newName?: string
): Promise<FormDefinition> {
  const originalForm = await getForm(workspaceId, formId);

  if (!originalForm) {
    throw new Error(`Form not found: ${formId}`);
  }

  const duplicatedForm = await createForm(workspaceId, {
    ...originalForm,
    name: newName ?? `${originalForm.name} (Copy)`,
    status: 'draft',
    version: 1,
    createdBy: originalForm.createdBy,
    lastModifiedBy: originalForm.lastModifiedBy,
    publishedAt: undefined,
  });

  logger.info('Form duplicated', { workspaceId, originalFormId: formId, newFormId: duplicatedForm.id });

  return duplicatedForm;
}

// ============================================================================
// FORM SUBMISSION OPERATIONS
// ============================================================================

/**
 * Create a form submission
 */
export async function createSubmission(
  workspaceId: string,
  formId: string,
  submissionData: {
    responses: FieldResponse[];
    metadata: SubmissionMetadata;
    isPartial?: boolean;
    resumeToken?: string;
  }
): Promise<FormSubmission> {
  const { responses, metadata, isPartial = false, resumeToken } = submissionData;

  // Get form to validate and get version
  const form = await getForm(workspaceId, formId);
  if (!form) {
    throw new Error(`Form not found: ${formId}`);
  }

  if (form.status !== 'published' && !isPartial) {
    throw new Error('Cannot submit to unpublished form');
  }

  // Check form limits
  if (form.behavior.maxSubmissions > 0 && form.submissionCount >= form.behavior.maxSubmissions) {
    throw new Error('Form has reached maximum submissions');
  }

  if (form.behavior.expiresAt && Timestamp.now().toMillis() > form.behavior.expiresAt.toMillis()) {
    throw new Error('Form has expired');
  }

  const submissionsRef = collection(getDb(), getSubmissionsCollectionPath(workspaceId, formId));
  const submissionDoc = doc(submissionsRef);
  const submissionId = submissionDoc.id;

  // Generate confirmation number
  const confirmationNumber = generateConfirmationNumber();

  const submission: FormSubmission = {
    id: submissionId,
    formId,
    formVersion: form.version,
    workspaceId,
    status: isPartial ? 'partial' : 'pending',
    responses,
    metadata,
    confirmationNumber,
    // Cast required: serverTimestamp() returns FieldValue, resolved to Timestamp on write
    submittedAt: serverTimestamp() as Timestamp,
    isPartial,
    resumeToken: isPartial ? (resumeToken ?? generateResumeToken()) : undefined,
  };

  // Batch write submission and update form count
  const batch = writeBatch(getDb());
  batch.set(submissionDoc, submission);

  if (!isPartial) {
    const formRef = doc(getDb(), getFormsCollectionPath(workspaceId), formId);
    batch.update(formRef, {
      submissionCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();

  logger.info('Submission created', {
    workspaceId,
    formId,
    submissionId,
    isPartial,
    confirmationNumber,
  });

  return { ...submission, submittedAt: Timestamp.now() };
}

/**
 * Get a submission by ID
 */
export async function getSubmission(
  workspaceId: string,
  formId: string,
  submissionId: string
): Promise<FormSubmission | null> {
  const submissionRef = doc(
    getDb(),
    getSubmissionsCollectionPath(workspaceId, formId),
    submissionId
  );
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
  workspaceId: string,
  formId: string,
  resumeToken: string
): Promise<FormSubmission | null> {
  const submissionsRef = collection(getDb(), getSubmissionsCollectionPath(workspaceId, formId));
  const q = query(
    submissionsRef,
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
 * Update a partial submission
 */
export async function updatePartialSubmission(
  workspaceId: string,
  formId: string,
  submissionId: string,
  updates: {
    responses: FieldResponse[];
    metadata?: Partial<SubmissionMetadata>;
    isPartial: boolean;
  }
): Promise<void> {
  const submissionRef = doc(
    getDb(),
    getSubmissionsCollectionPath(workspaceId, formId),
    submissionId
  );

  const updateData: Partial<FormSubmission> = {
    responses: updates.responses,
    isPartial: updates.isPartial,
    // Cast required: serverTimestamp() returns FieldValue, resolved to Timestamp on write
    lastSavedAt: serverTimestamp() as Timestamp,
  };

  if (updates.metadata) {
    updateData.metadata = updates.metadata as SubmissionMetadata;
  }

  if (!updates.isPartial) {
    updateData.status = 'pending';
    // Cast required: serverTimestamp() returns FieldValue, resolved to Timestamp on write
    updateData.submittedAt = serverTimestamp() as Timestamp;

    // Update form submission count
    const formRef = doc(getDb(), getFormsCollectionPath(workspaceId), formId);
    await updateDoc(formRef, {
      submissionCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  }

  await updateDoc(submissionRef, updateData);

  logger.info('Submission updated', {
    workspaceId,
    formId,
    submissionId,
    completed: !updates.isPartial,
  });
}

/**
 * List submissions with pagination
 */
export async function listSubmissions(
  workspaceId: string,
  formId: string,
  options: {
    status?: FormSubmission['status'];
    startDate?: Date;
    endDate?: Date;
    pageSize?: number;
    lastDoc?: QueryDocumentSnapshot;
  } = {}
): Promise<{
  submissions: FormSubmission[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}> {
  const { status, startDate, endDate, pageSize = 50, lastDoc } = options;

  const submissionsRef = collection(getDb(), getSubmissionsCollectionPath(workspaceId, formId));

  const constraints: ReturnType<typeof where | typeof orderBy | typeof limit | typeof startAfter>[] = [];

  if (status) {
    constraints.push(where('status', '==', status));
  }

  if (startDate) {
    constraints.push(where('submittedAt', '>=', Timestamp.fromDate(startDate)));
  }

  if (endDate) {
    constraints.push(where('submittedAt', '<=', Timestamp.fromDate(endDate)));
  }

  constraints.push(orderBy('submittedAt', 'desc'));
  constraints.push(limit(pageSize + 1));

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const q = query(submissionsRef, ...constraints);
  const snapshot = await getDocs(q);

  const submissions = snapshot.docs.slice(0, pageSize).map((doc) => doc.data() as FormSubmission);
  const hasMore = snapshot.docs.length > pageSize;
  const newLastDoc = snapshot.docs.length > 0 ? snapshot.docs[Math.min(pageSize - 1, snapshot.docs.length - 1)] : null;

  return { submissions, lastDoc: newLastDoc, hasMore };
}

/**
 * Delete a submission
 */
export async function deleteSubmission(
  workspaceId: string,
  formId: string,
  submissionId: string
): Promise<void> {
  const submissionRef = doc(
    getDb(),
    getSubmissionsCollectionPath(workspaceId, formId),
    submissionId
  );

  await deleteDoc(submissionRef);

  // Update form submission count
  const formRef = doc(getDb(), getFormsCollectionPath(workspaceId), formId);
  await updateDoc(formRef, {
    submissionCount: increment(-1),
    updatedAt: serverTimestamp(),
  });

  logger.info('Submission deleted', { workspaceId, formId, submissionId });
}

// ============================================================================
// FORM VIEW TRACKING
// ============================================================================

/**
 * Track a form view
 */
export async function trackFormView(
  workspaceId: string,
  formId: string,
  metadata: Partial<SubmissionMetadata>,
  sessionId: string
): Promise<string> {
  const viewsRef = collection(getDb(), getViewsCollectionPath(workspaceId, formId));
  const viewDoc = doc(viewsRef);
  const viewId = viewDoc.id;

  const view: FormView = {
    id: viewId,
    formId,
    // Cast required: serverTimestamp() returns FieldValue, resolved to Timestamp on write
    viewedAt: serverTimestamp() as Timestamp,
    sessionId,
    converted: false,
    metadata,
  };

  // Batch write view and update form count
  const batch = writeBatch(getDb());
  batch.set(viewDoc, view);

  const formRef = doc(getDb(), getFormsCollectionPath(workspaceId), formId);
  batch.update(formRef, {
    viewCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  return viewId;
}

/**
 * Mark a form view as converted
 */
export async function markViewAsConverted(
  workspaceId: string,
  formId: string,
  viewId: string,
  submissionId: string
): Promise<void> {
  const viewRef = doc(getDb(), getViewsCollectionPath(workspaceId, formId), viewId);

  await updateDoc(viewRef, {
    converted: true,
    submissionId,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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

/**
 * Get public form URL
 */
export function getPublicFormUrl(formId: string, baseUrl?: string): string {
  const base = baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/forms/${formId}`;
}

/**
 * Get embed code for form
 */
export function getFormEmbedCode(formId: string, options?: { width?: string; height?: string }): string {
  const { width = '100%', height = '600px' } = options ?? {};
  const url = getPublicFormUrl(formId);
  return `<iframe src="${url}" width="${width}" height="${height}" frameborder="0" allowfullscreen></iframe>`;
}

logger.info('Form service initialized');
