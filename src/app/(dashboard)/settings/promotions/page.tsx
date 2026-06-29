import { redirect } from 'next/navigation';

/**
 * Consolidated Jun 29 2026: coupons now live ONLY at /coupons (Commerce nav
 * group). This page was a parallel coupon CRUD surface that nothing linked to;
 * it now forwards to the canonical page so there is exactly one coupons screen.
 */
export default function PromotionsRedirect(): never {
  redirect('/coupons');
}
