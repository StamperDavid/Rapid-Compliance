/**
 * Subscription Management API
 * GET - Get current subscription
 * POST - Create subscription (with billing verification for paid tiers)
 * PUT - Update subscription (upgrade, downgrade, cancel, reactivate)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const SUBSCRIPTIONS_PATH = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/subscriptions`;
const PAID_TIERS = ['starter', 'professional', 'enterprise'] as const;
const TIER_RANK: Record<string, number> = {
  free: 0,
  starter: 1,
  professional: 2,
  enterprise: 3,
};

const createSubscriptionSchema = z.object({
  tier: z.enum(['free', 'starter', 'professional', 'enterprise']),
  billingPeriod: z.enum(['monthly', 'annual']).optional().default('monthly'),
  stripeSessionId: z.string().optional(),
  adminOverride: z.boolean().optional(),
  adminReason: z.string().optional(),
}).refine(
  (data) => {
    // Paid tiers require either stripeSessionId or adminOverride
    if (PAID_TIERS.includes(data.tier as typeof PAID_TIERS[number])) {
      return Boolean(data.stripeSessionId) || Boolean(data.adminOverride);
    }
    return true;
  },
  { message: 'Paid tiers require stripeSessionId or admin provisioning' }
).refine(
  (data) => {
    // adminOverride requires a reason
    if (data.adminOverride) {
      return Boolean(data.adminReason?.trim());
    }
    return true;
  },
  { message: 'adminReason is required when using admin override' }
);

const updateSubscriptionSchema = z.object({
  tier: z.enum(['free', 'starter', 'professional', 'enterprise']).optional(),
  action: z.enum(['upgrade', 'downgrade', 'cancel', 'reactivate']).optional(),
  stripeSessionId: z.string().optional(),
  adminOverride: z.boolean().optional(),
  adminReason: z.string().optional(),
});

/**
 * Verify a Stripe checkout session is complete and matches the user
 */
async function verifyStripeCheckoutSession(
  sessionId: string,
  userEmail: string
): Promise<{ valid: boolean; subscriptionId?: string; error?: string }> {
  try {
    const stripeKeys = await apiKeyService.getServiceKey(PLATFORM_ID, 'stripe');
    const keys = stripeKeys as { secretKey?: string } | null;

    if (!keys?.secretKey) {
      return { valid: false, error: 'Stripe not configured' };
    }

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(keys.secretKey, { apiVersion: '2023-10-16' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Session must be complete
    if (session.status !== 'complete') {
      return { valid: false, error: `Checkout session not complete (status: ${session.status})` };
    }

    // Payment must be paid or no_payment_required (100% promo code)
    if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
      return { valid: false, error: `Payment not confirmed (status: ${session.payment_status})` };
    }

    // Verify the session belongs to this user
    const sessionEmail = session.customer_email ?? session.customer_details?.email;
    const sessionRef = session.client_reference_id;
    if (sessionEmail !== userEmail && sessionRef !== userEmail) {
      return { valid: false, error: 'Session does not match authenticated user' };
    }

    // Extract subscription ID if present
    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

    return { valid: true, subscriptionId: subscriptionId ?? undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Stripe error';
    logger.error('Stripe session verification failed', error instanceof Error ? error : new Error(message));
    return { valid: false, error: `Stripe verification failed: ${message}` };
  }
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/subscriptions');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const subscription = await FirestoreService.get<Record<string, unknown>>(
      SUBSCRIPTIONS_PATH,
      authResult.user.uid
    );

    if (!subscription) {
      return NextResponse.json({
        success: true,
        subscription: {
          tier: 'free',
          status: 'active',
          userId: authResult.user.uid,
        },
      });
    }

    return NextResponse.json({ success: true, subscription });
  } catch (error: unknown) {
    logger.error('Get subscription error', error instanceof Error ? error : new Error(String(error)));
    return errors.internal('Failed to get subscription');
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/subscriptions');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const body: unknown = await request.json();
    const validation = createSubscriptionSchema.safeParse(body);
    if (!validation.success) {
      return errors.badRequest(validation.error.errors[0]?.message ?? 'Invalid data');
    }

    const { tier, billingPeriod, stripeSessionId, adminOverride, adminReason } = validation.data;
    const isPaidTier = PAID_TIERS.includes(tier as typeof PAID_TIERS[number]);
    const user = authResult.user;

    // ── Gate 1: Free tier — open to all authenticated users ──
    if (!isPaidTier) {
      const subscription = {
        userId: user.uid,
        tier,
        billingPeriod,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await FirestoreService.set(SUBSCRIPTIONS_PATH, user.uid, subscription);
      return NextResponse.json({ success: true, subscription }, { status: 201 });
    }

    // ── Gate 2: Admin override — RBAC-gated ──
    if (adminOverride) {
      const isAdmin = user.role === 'owner' || user.role === 'admin';
      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: 'Admin override requires owner or admin role' },
          { status: 403 }
        );
      }

      const subscription = {
        userId: user.uid,
        tier,
        billingPeriod,
        status: 'active' as const,
        provisionedBy: 'admin',
        provisionedByUid: user.uid,
        provisionedReason: adminReason,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await FirestoreService.set(SUBSCRIPTIONS_PATH, user.uid, subscription);

      logger.info('Admin provisioned subscription', {
        route: '/api/subscriptions',
        tier,
        targetUser: user.uid,
        adminUid: user.uid,
        reason: adminReason,
      });

      return NextResponse.json({ success: true, subscription }, { status: 201 });
    }

    // ── Gate 3: Stripe-verified checkout — paid tiers ──
    if (!stripeSessionId) {
      return errors.badRequest('Paid tier requires a valid Stripe checkout session');
    }

    const userEmail = user.email;
    if (!userEmail) {
      return errors.badRequest('User email is required for Stripe verification');
    }

    const verification = await verifyStripeCheckoutSession(stripeSessionId, userEmail);
    if (!verification.valid) {
      logger.warn('Stripe session verification failed', {
        route: '/api/subscriptions',
        userId: user.uid,
        stripeSessionId,
        error: verification.error,
      });
      return NextResponse.json(
        { success: false, error: verification.error ?? 'Stripe verification failed' },
        { status: 403 }
      );
    }

    const subscription = {
      userId: user.uid,
      tier,
      billingPeriod,
      status: 'active' as const,
      stripeSessionId,
      stripeSubscriptionId: verification.subscriptionId ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await FirestoreService.set(SUBSCRIPTIONS_PATH, user.uid, subscription);

    logger.info('Subscription created via Stripe checkout', {
      route: '/api/subscriptions',
      tier,
      userId: user.uid,
      stripeSessionId,
    });

    return NextResponse.json({ success: true, subscription }, { status: 201 });
  } catch (error: unknown) {
    logger.error('Create subscription error', error instanceof Error ? error : new Error(String(error)));
    return errors.internal('Failed to create subscription');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/subscriptions');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const body: unknown = await request.json();
    const validation = updateSubscriptionSchema.safeParse(body);
    if (!validation.success) {
      return errors.badRequest(validation.error.errors[0]?.message ?? 'Invalid data');
    }

    const { tier, action, stripeSessionId, adminOverride, adminReason } = validation.data;
    const user = authResult.user;

    const existing = await FirestoreService.get<Record<string, unknown>>(
      SUBSCRIPTIONS_PATH,
      user.uid
    );

    if (!existing) {
      return errors.notFound('No subscription found');
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (action === 'cancel') {
      updates.status = 'cancelled';
      updates.cancelledAt = new Date().toISOString();
    } else if (action === 'reactivate') {
      updates.status = 'active';
      updates.reactivatedAt = new Date().toISOString();
    }

    // Gate tier upgrades to paid tiers
    if (tier) {
      const currentRank = TIER_RANK[existing.tier as string] ?? 0;
      const newRank = TIER_RANK[tier] ?? 0;
      const isUpgradeToPaid = newRank > currentRank && PAID_TIERS.includes(tier as typeof PAID_TIERS[number]);

      if (isUpgradeToPaid) {
        // Admin override path
        if (adminOverride) {
          const isAdmin = user.role === 'owner' || user.role === 'admin';
          if (!isAdmin) {
            return NextResponse.json(
              { success: false, error: 'Admin override requires owner or admin role' },
              { status: 403 }
            );
          }
          if (!adminReason?.trim()) {
            return errors.badRequest('adminReason is required for admin override');
          }
          updates.provisionedBy = 'admin';
          updates.provisionedByUid = user.uid;
          updates.provisionedReason = adminReason;
          logger.info('Admin overrode tier upgrade', {
            route: '/api/subscriptions',
            tier,
            userId: user.uid,
            reason: adminReason,
          });
        } else if (stripeSessionId) {
          // Stripe verification path
          const userEmail = user.email;
          if (!userEmail) {
            return errors.badRequest('User email required for Stripe verification');
          }
          const verification = await verifyStripeCheckoutSession(stripeSessionId, userEmail);
          if (!verification.valid) {
            return NextResponse.json(
              { success: false, error: verification.error ?? 'Stripe verification failed' },
              { status: 403 }
            );
          }
          updates.stripeSessionId = stripeSessionId;
          updates.stripeSubscriptionId = verification.subscriptionId ?? null;
        } else {
          return errors.badRequest('Upgrading to a paid tier requires stripeSessionId or admin override');
        }
      }

      updates.tier = tier;
      updates.tierChangedAt = new Date().toISOString();
      updates.previousTier = existing.tier;
    }

    await FirestoreService.update(SUBSCRIPTIONS_PATH, user.uid, updates);

    return NextResponse.json({
      success: true,
      subscription: { ...existing, ...updates },
    });
  } catch (error: unknown) {
    logger.error('Update subscription error', error instanceof Error ? error : new Error(String(error)));
    return errors.internal('Failed to update subscription');
  }
}
