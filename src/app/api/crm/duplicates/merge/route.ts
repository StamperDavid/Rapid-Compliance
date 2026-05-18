/**
 * Merge Duplicates API
 * POST /api/crm/duplicates/merge - Merge two duplicate records
 *
 * For contact merges: re-parents all FK-linked child records
 * (deals, quotes, invoices, payments, emails, activities) from the
 * merged contact to the kept contact before deletion.  Only then
 * is the merged contact document deleted.  Any failure during
 * repointing aborts before the delete so no data is lost.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger/logger';
import { requireRole } from '@/lib/auth/api-auth';
import { getSubCollection } from '@/lib/firebase/collections';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { findDealsByContactId } from '@/lib/crm/deal-service';
import { findQuotesByContactId } from '@/lib/crm/quote-service';
import { findInvoicesByContactId } from '@/lib/crm/invoice-service';
import { findPaymentsByContactId } from '@/lib/crm/payment-service';
import { findActivitiesByContactId } from '@/lib/crm/activity-service';
import { findEmailsByContactId } from '@/lib/crm/contact-service';

export const dynamic = 'force-dynamic';

// Maximum write operations per Firestore batch (hard limit is 500).
const BATCH_SIZE_LIMIT = 499;

// Zod schema for request validation
const MergeRequestSchema = z.object({
  entityType: z.enum(['lead', 'contact', 'company', 'deal', 'opportunity']),
  keepId: z.string().min(1, 'keepId is required'),
  mergeId: z.string().min(1, 'mergeId is required'),
});

// ---------------------------------------------------------------------------
// Repoint counts returned in the response body
// ---------------------------------------------------------------------------
interface RepointCounts {
  deals: number;
  quotes: number;
  invoices: number;
  payments: number;
  emails: number;
  activities: number;
}

// ---------------------------------------------------------------------------
// Batch-flush helper — commits the current batch and returns a fresh one
// when the operation count is about to exceed the Firestore limit.
// ---------------------------------------------------------------------------
interface BatchState {
  batch: FirebaseFirestore.WriteBatch;
  count: number;
}

async function flushIfFull(state: BatchState): Promise<BatchState> {
  if (state.count >= BATCH_SIZE_LIMIT) {
    await state.batch.commit();
    return { batch: AdminFirestoreService.batch(), count: 0 };
  }
  return state;
}

// ---------------------------------------------------------------------------
// Contact-specific repointing logic
// ---------------------------------------------------------------------------
async function repointContactChildren(
  mergeId: string,
  keepId: string
): Promise<RepointCounts> {
  const counts: RepointCounts = {
    deals: 0,
    quotes: 0,
    invoices: 0,
    payments: 0,
    emails: 0,
    activities: 0,
  };

  // Fetch all FK-linked records in parallel to minimise latency.
  const [deals, quotes, invoices, payments, emails, activityMatches] =
    await Promise.all([
      findDealsByContactId(mergeId),
      findQuotesByContactId(mergeId),
      findInvoicesByContactId(mergeId),
      findPaymentsByContactId(mergeId),
      findEmailsByContactId(mergeId),
      findActivitiesByContactId(mergeId),
    ]);

  let state: BatchState = { batch: AdminFirestoreService.batch(), count: 0 };

  // --- Deals ---
  for (const deal of deals) {
    state = await flushIfFull(state);
    state.batch.update(
      AdminFirestoreService.doc(getSubCollection('deals'), deal.id),
      { contactId: keepId, updatedAt: FieldValue.serverTimestamp() }
    );
    state.count++;
    counts.deals++;
  }

  // --- Quotes ---
  for (const quote of quotes) {
    state = await flushIfFull(state);
    state.batch.update(
      AdminFirestoreService.doc(getSubCollection('quotes'), quote.id),
      { contactId: keepId, updatedAt: FieldValue.serverTimestamp() }
    );
    state.count++;
    counts.quotes++;
  }

  // --- Invoices ---
  for (const invoice of invoices) {
    state = await flushIfFull(state);
    state.batch.update(
      AdminFirestoreService.doc(getSubCollection('invoices'), invoice.id),
      { contactId: keepId, updatedAt: FieldValue.serverTimestamp() }
    );
    state.count++;
    counts.invoices++;
  }

  // --- Payments ---
  for (const payment of payments) {
    state = await flushIfFull(state);
    state.batch.update(
      AdminFirestoreService.doc(getSubCollection('payments'), payment.id),
      { contactId: keepId, updatedAt: FieldValue.serverTimestamp() }
    );
    state.count++;
    counts.payments++;
  }

  // --- Synced Emails ---
  for (const email of emails) {
    state = await flushIfFull(state);
    state.batch.update(
      AdminFirestoreService.doc(getSubCollection('emails'), email.id),
      { contactId: keepId, updatedAt: FieldValue.serverTimestamp() }
    );
    state.count++;
    counts.emails++;
  }

  // --- Activities (relatedTo array element update) ---
  // The `relatedTo` field is an array of {entityType, entityId} objects.
  // Firestore batch does not support FieldValue.arrayRemove + arrayUnion in
  // the same update when the element is an object, so we overwrite the
  // entire relatedTo array with the patched version instead.
  for (const { activity, relatedToIndex } of activityMatches) {
    state = await flushIfFull(state);
    const patchedRelatedTo = activity.relatedTo.map((rel, idx) =>
      idx === relatedToIndex ? { ...rel, entityId: keepId } : rel
    );
    state.batch.update(
      AdminFirestoreService.doc(getSubCollection('activities'), activity.id),
      { relatedTo: patchedRelatedTo, updatedAt: FieldValue.serverTimestamp() }
    );
    state.count++;
    counts.activities++;
  }

  // Commit any remaining repoint writes BEFORE deleting the merged contact.
  if (state.count > 0) {
    await state.batch.commit();
  }

  return counts;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(request, ['owner', 'admin', 'manager']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Parse and validate request body
    const body: unknown = await request.json();
    const validation = MergeRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: validation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    const { entityType, keepId, mergeId } = validation.data;

    const collectionPath = getSubCollection(`${entityType}s`);

    // Fetch both records via Admin SDK (bypasses Firestore security rules on server)
    const keepRecord = await AdminFirestoreService.get<Record<string, unknown>>(collectionPath, keepId);
    const mergeRecord = await AdminFirestoreService.get<Record<string, unknown>>(collectionPath, mergeId);

    if (!keepRecord || !mergeRecord) {
      return NextResponse.json(
        { success: false, error: 'One or both records not found' },
        { status: 404 }
      );
    }

    // -----------------------------------------------------------------------
    // Merge data (keep record takes priority; fill gaps from merge record)
    // -----------------------------------------------------------------------
    const merged: Record<string, unknown> = { ...keepRecord };
    for (const key in mergeRecord) {
      if (['id', 'createdAt', 'updatedAt'].includes(key)) {
        continue;
      }
      const mergedValue = merged[key];
      const mergeValue = mergeRecord[key];
      if (!mergedValue && mergeValue) {
        merged[key] = mergeValue;
      }
      if (Array.isArray(mergedValue) && Array.isArray(mergeValue)) {
        merged[key] = Array.from(new Set([...(mergedValue as unknown[]), ...(mergeValue as unknown[])]));
      }
    }
    // Use server timestamp for the final updatedAt on the kept record.
    const mergedWithTimestamp: Record<string, unknown> = {
      ...merged,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // -----------------------------------------------------------------------
    // Re-parent child records BEFORE deleting the merged contact.
    // Only performed for contact merges (other entity types have no FK children
    // wired here yet).
    // -----------------------------------------------------------------------
    let repointCounts: RepointCounts | null = null;
    if (entityType === 'contact') {
      repointCounts = await repointContactChildren(mergeId, keepId);

      logger.info('Contact children repointed', {
        mergeId,
        keepId,
        ...repointCounts,
      });
    }

    // -----------------------------------------------------------------------
    // Atomic batch: update the kept record, then delete the merged record.
    // The repoint batches above have already committed successfully at this
    // point, so the merge contact has no surviving FK children.
    // -----------------------------------------------------------------------
    const finalBatch = AdminFirestoreService.batch();
    finalBatch.update(AdminFirestoreService.doc(collectionPath, keepId), mergedWithTimestamp);
    finalBatch.delete(AdminFirestoreService.doc(collectionPath, mergeId));
    await finalBatch.commit();

    // -----------------------------------------------------------------------
    // Build response message
    // -----------------------------------------------------------------------
    let message = 'Records merged successfully';
    if (repointCounts) {
      const repointed = Object.entries(repointCounts)
        .filter(([, n]) => n > 0)
        .map(([col, n]) => `${n} ${col}`)
        .join(', ');
      if (repointed) {
        message += `. Repointed ${repointed}.`;
      }
    }

    return NextResponse.json({
      success: true,
      data: { ...merged, updatedAt: new Date().toISOString() },
      message,
      ...(repointCounts ? { repointed: repointCounts } : {}),
    });

  } catch (error) {
    logger.error('Merge API failed', error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
