/**
 * Subscription Management API
 * GET - Get current subscription (or null if user has none)
 * POST - Create subscription via verified checkout session or admin override
 * PUT - Cancel or reactivate the existing subscription
 *
 * Single-product model: SalesVelocity flat $299/mo with 14-day trial.
 * No tiers, no upgrade/downgrade — a user either has a subscription or they don't.
 *
 * Provider-agnostic: supports Stripe, Authorize.Net, PayPal, Square, Paddle, Chargebee
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { getSubCollection } from '@/lib/firebase/collections';
import {
  verifyCheckoutSession,
  cancelSubscription,
  getSubscriptionProvider,
  type SubscriptionProviderId,
} from '@/lib/subscriptions/subscription-provider-service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const SUBSCRIPTIONS_PATH = getSubCollection('subscriptions');

const VALID_PROVIDERS = ['stripe', 'authorizenet', 'paypal', 'square', 'paddle', 'chargebee'] as const;

const createSubscriptionSchema = z.object({
  checkoutSessionId: z.string().optional(),
  paymentProvider: z.enum(VALID_PROVIDERS).optional(),
  // Legacy field — still accepted for backward compatibility with old Stripe-only clients
  stripeSessionId: z.string().optional(),
  adminOverride: z.boolean().optional(),
  adminReason: z.string().optional(),
}).refine(
  (data) => Boolean(data.checkoutSessionId) || Boolean(data.stripeSessionId) || Boolean(data.adminOverride),
  { message: 'Subscription requires checkoutSessionId or admin provisioning' }
).refine(
  (data) => {
    if (data.adminOverride) {
      return Boolean(data.adminReason?.trim());
    }
    return true;
  },
  { message: 'adminReason is required when using admin override' }
);

const updateSubscriptionSchema = z.object({
  action: z.enum(['cancel', 'reactivate']),
});

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/subscriptions');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const subscription = await AdminFirestoreService.get(
      SUBSCRIPTIONS_PATH,
      authResult.user.uid
    );

    return NextResponse.json({ success: true, subscription: subscription ?? null });
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

    const { adminOverride, adminReason } = validation.data;
    // Support both new field and legacy stripeSessionId
    const sessionId = validation.data.checkoutSessionId ?? validation.data.stripeSessionId;
    const provider: SubscriptionProviderId = validation.data.paymentProvider
      ?? (validation.data.stripeSessionId ? 'stripe' : await getSubscriptionProvider());
    const user = authResult.user;

    // ── Admin override — RBAC-gated ──
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
        status: 'active' as const,
        provisionedBy: 'admin',
        provisionedByUid: user.uid,
        provisionedReason: adminReason,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await AdminFirestoreService.set(SUBSCRIPTIONS_PATH, user.uid, subscription);

      logger.info('Admin provisioned subscription', {
        route: '/api/subscriptions',
        targetUser: user.uid,
        adminUid: user.uid,
        reason: adminReason,
      });

      return NextResponse.json({ success: true, subscription }, { status: 201 });
    }

    // ── Provider-verified checkout ──
    if (!sessionId) {
      return errors.badRequest('Subscription requires a valid checkout session');
    }

    const userEmail = user.email;
    if (!userEmail) {
      return errors.badRequest('User email is required for payment verification');
    }

    const verification = await verifyCheckoutSession(sessionId, userEmail, provider);
    if (!verification.valid) {
      logger.warn('Checkout session verification failed', {
        route: '/api/subscriptions',
        userId: user.uid,
        sessionId,
        provider,
        error: verification.error,
      });
      return NextResponse.json(
        { success: false, error: verification.error ?? 'Payment verification failed' },
        { status: 403 }
      );
    }

    const subscription = {
      userId: user.uid,
      status: 'active' as const,
      paymentProvider: provider,
      checkoutSessionId: sessionId,
      providerSubscriptionId: verification.subscriptionId ?? null,
      // Legacy Stripe fields for backward compatibility
      ...(provider === 'stripe' ? {
        stripeSessionId: sessionId,
        stripeSubscriptionId: verification.subscriptionId ?? null,
      } : {}),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await AdminFirestoreService.set(SUBSCRIPTIONS_PATH, user.uid, subscription);

    logger.info('Subscription created via checkout', {
      route: '/api/subscriptions',
      provider,
      userId: user.uid,
      sessionId,
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

    const { action } = validation.data;
    const user = authResult.user;

    const existing = await AdminFirestoreService.get(
      SUBSCRIPTIONS_PATH,
      user.uid
    );

    if (!existing) {
      return errors.notFound('No subscription found');
    }

    const provider: SubscriptionProviderId = (existing.paymentProvider as SubscriptionProviderId | undefined)
      ?? (existing.stripeSubscriptionId ? 'stripe' : await getSubscriptionProvider());

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (action === 'cancel') {
      // Cancel via the subscription's payment provider
      const existingSubId = (existing.providerSubscriptionId ?? existing.stripeSubscriptionId) as string | undefined;
      if (existingSubId) {
        const cancelResult = await cancelSubscription(existingSubId, provider);
        if (cancelResult.success) {
          if (cancelResult.cancelAtPeriodEnd) {
            updates.cancelAtPeriodEnd = true;
          }
          logger.info('Subscription cancelled via provider', {
            route: '/api/subscriptions',
            provider,
            subscriptionId: existingSubId,
          });
        } else {
          logger.error('Provider cancel failed — local cancel will proceed',
            new Error(cancelResult.error ?? 'Unknown error'), {
              route: '/api/subscriptions',
              provider,
              subscriptionId: existingSubId,
            });
        }
      }
      updates.status = 'cancelled';
      updates.cancelledAt = new Date().toISOString();
    } else {
      updates.status = 'active';
      updates.cancelAtPeriodEnd = false;
      updates.reactivatedAt = new Date().toISOString();
    }

    await AdminFirestoreService.update(SUBSCRIPTIONS_PATH, user.uid, updates);

    return NextResponse.json({
      success: true,
      subscription: { ...existing, ...updates },
    });
  } catch (error: unknown) {
    logger.error('Update subscription error', error instanceof Error ? error : new Error(String(error)));
    return errors.internal('Failed to update subscription');
  }
}
