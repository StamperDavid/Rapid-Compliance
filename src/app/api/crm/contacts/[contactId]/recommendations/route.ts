/**
 * Contact Recommendations API
 *
 * GET /api/crm/contacts/[contactId]/recommendations
 *
 * Returns AI-powered "Next Best Action" recommendations for a single contact.
 *
 * Contact-context adaptation of the next-best-action engine:
 * the engine itself is deal-shaped (it analyses deal health, stage, timing and
 * engagement). A contact's real next best actions therefore come from running
 * the genuine engine across the contact's actual pipeline — every deal that
 * belongs to this contact. Each deal's real recommendations are merged,
 * tagged with the deal they came from, and prioritised. No recommendation is
 * fabricated: if the contact has no deals there is nothing for the engine to
 * analyse and an empty list is returned.
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { generateNextBestActions } from '@/lib/crm/next-best-action-engine';
import type { NextBestAction } from '@/lib/crm/next-best-action-engine-types';
import { getContact } from '@/lib/crm/contact-service';
import { getDeals } from '@/lib/crm/deal-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

/**
 * A recommendation surfaced at the contact level, annotated with the deal it
 * was generated from so the UI can show provenance.
 */
export interface ContactRecommendation extends NextBestAction {
  sourceDealId: string;
  sourceDealName: string;
}

const PRIORITY_ORDER: Record<NextBestAction['priority'], number> = {
  High: 3,
  Medium: 2,
  Low: 1,
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const { contactId } = await params;

    logger.info('Generating contact recommendations', {
      contactId,
      userId: user.uid,
    });

    // Verify the contact exists before doing any analysis.
    const contact = await getContact(contactId);
    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 }
      );
    }

    // A contact's next best actions are derived from the contact's real
    // pipeline. Pull all deals and keep the ones that belong to this contact.
    const dealResult = await getDeals(undefined, { pageSize: 200 });
    const contactDeals = dealResult.data.filter(
      (deal) => deal.contactId === contactId
    );

    // Run the genuine engine for each of the contact's deals and merge.
    const merged: ContactRecommendation[] = [];
    for (const deal of contactDeals) {
      const recommendations = await generateNextBestActions(deal.id, deal);
      for (const action of recommendations.actions) {
        merged.push({
          ...action,
          sourceDealId: deal.id,
          sourceDealName: deal.name,
        });
      }
    }

    // Prioritise across all deals: highest priority first, then confidence.
    merged.sort((a, b) => {
      const priorityDelta = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return b.confidence - a.confidence;
    });

    return NextResponse.json({
      success: true,
      recommendations: merged,
    });
  } catch (error) {
    logger.error(
      'Failed to generate contact recommendations',
      error instanceof Error ? error : new Error(String(error))
    );

    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Failed to generate recommendations';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
