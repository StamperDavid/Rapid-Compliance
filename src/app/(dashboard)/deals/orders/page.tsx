import { redirect } from 'next/navigation';

/**
 * Consolidated Jun 29 2026: there is now ONE Orders page — the full /orders
 * (search, CSV export, detail drawer with order-status + fulfillment controls).
 * This thinner Deals-hub copy was deleted; it forwards to /orders so the Deals
 * "Orders" tab and any old links still land on the real order manager.
 */
export default function DealsOrdersRedirect(): never {
  redirect('/orders');
}
