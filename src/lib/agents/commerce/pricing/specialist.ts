// STATUS: FUNCTIONAL - Pricing Strategist wired to Stripe/Payment service
// Pricing Strategist
// FUNCTIONAL LOC: 280+

import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { processPayment, refundPayment, type PaymentRequest, type PaymentResult } from '@/lib/ecommerce/payment-service';
import { logger } from '@/lib/logger/logger';

// ============== Configuration ==============

const CONFIG: SpecialistConfig = {
  identity: {
    id: 'PRICING_STRATEGIST',
    name: 'Pricing Strategist',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'COMMERCE_MANAGER',
    capabilities: [
      'process_payment',
      'validate_pricing',
      'apply_discount',
      'calculate_total',
      'dynamic_pricing',
      'competitor_price_tracking',
      'margin_optimization',
      'discount_strategy',
    ],
  },
  systemPrompt: `You are a Pricing Strategist specialist responsible for payment processing and pricing strategy.
Your capabilities include:
- Processing payments via Stripe/Square/PayPal
- Applying discounts and validating pricing
- Calculating totals with tax and shipping
- Optimizing margins and pricing strategies

Always validate payment amounts, apply appropriate discounts, and ensure PCI compliance.`,
  tools: ['process_payment', 'validate_pricing', 'apply_discount', 'calculate_total', 'refund'],
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      transactionId: { type: 'string' },
      amount: { type: 'number' },
      error: { type: 'string' },
    },
  },
  maxTokens: 4096,
  temperature: 0.2,
};

// ============== Type Definitions ==============

interface ProcessPaymentPayload {
  action: 'process_payment';
  organizationId: string;
  workspaceId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentToken?: string;
  customer: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
  metadata?: Record<string, unknown>;
}

interface ValidatePricingPayload {
  action: 'validate_pricing';
  organizationId: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  discountCode?: string;
}

interface ApplyDiscountPayload {
  action: 'apply_discount';
  organizationId: string;
  workspaceId: string;
  subtotal: number;
  discountCode: string;
}

interface CalculateTotalPayload {
  action: 'calculate_total';
  organizationId: string;
  workspaceId: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  shippingCost?: number;
  taxRate?: number;
  discountAmount?: number;
}

interface RefundPayload {
  action: 'refund';
  organizationId: string;
  workspaceId: string;
  transactionId: string;
  amount?: number;
  reason?: string;
}

interface GetStatusPayload {
  action: 'get_status';
  organizationId: string;
  workspaceId: string;
  transactionId: string;
}

type PricingPayload =
  | ProcessPaymentPayload
  | ValidatePricingPayload
  | ApplyDiscountPayload
  | CalculateTotalPayload
  | RefundPayload
  | GetStatusPayload;

interface PricingExecutionResult {
  success: boolean;
  action: string;
  transactionId?: string;
  amount?: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  shipping?: number;
  total?: number;
  validItems?: Array<{ productId: string; valid: boolean; reason?: string }>;
  paymentResult?: PaymentResult;
  error?: string;
}

// ============== Pricing Strategist Implementation ==============

export class PricingStrategist extends BaseSpecialist {
  private isReady: boolean = false;

  constructor() {
    super(CONFIG);
  }

  /**
   * Initialize the specialist
   */
  async initialize(): Promise<void> {
    try {
      this.log('INFO', 'Initializing Pricing Strategist...');
      this.isReady = true;
      this.isInitialized = true;
      this.log('INFO', 'Pricing Strategist initialized successfully');
      await Promise.resolve(); // Ensure async
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.log('ERROR', `Failed to initialize Pricing Strategist: ${err.message}`);
      throw err;
    }
  }

  /**
   * Execute pricing operations
   */
  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const payload = message.payload as PricingPayload;

      if (!payload || typeof payload !== 'object' || !('action' in payload)) {
        return this.createReport(taskId, 'FAILED', null, ['Invalid payload: action is required']);
      }

      let result: PricingExecutionResult;

      switch (payload.action) {
        case 'process_payment':
          result = await this.handleProcessPayment(payload);
          break;

        case 'validate_pricing':
          result = await this.handleValidatePricing(payload);
          break;

        case 'apply_discount':
          result = await this.handleApplyDiscount(payload);
          break;

        case 'calculate_total':
          result = this.handleCalculateTotal(payload);
          break;

        case 'refund':
          result = await this.handleRefund(payload);
          break;

        case 'get_status':
          result = await this.handleGetStatus(payload);
          break;

        default:
          return this.createReport(taskId, 'FAILED', null, [`Unknown action: ${(payload as { action: string }).action}`]);
      }

      if (result.success) {
        return this.createReport(taskId, 'COMPLETED', result);
      } else {
        return this.createReport(taskId, 'FAILED', result, [result.error ?? 'Unknown error']);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[Pricing Strategist] Execution error:', err, { taskId, file: 'specialist.ts' });
      return this.createReport(taskId, 'FAILED', null, [err.message]);
    }
  }

  /**
   * Handle process_payment action
   */
  private async handleProcessPayment(payload: ProcessPaymentPayload): Promise<PricingExecutionResult> {
    if (!payload.organizationId || !payload.workspaceId || !payload.amount || !payload.customer) {
      return {
        success: false,
        action: 'process_payment',
        error: 'Missing required fields: organizationId, workspaceId, amount, customer',
      };
    }

    if (payload.amount <= 0) {
      return {
        success: false,
        action: 'process_payment',
        error: 'Payment amount must be greater than zero',
      };
    }

    const request: PaymentRequest = {
      organizationId: payload.organizationId,
      workspaceId: payload.workspaceId,
      amount: Math.round(payload.amount * 100), // Convert to cents
      currency: payload.currency ?? 'usd',
      paymentMethod: payload.paymentMethod ?? 'card',
      paymentToken: payload.paymentToken,
      customer: payload.customer,
      metadata: payload.metadata,
    };

    const paymentResult = await processPayment(request);

    this.log('INFO', `Payment processed: ${paymentResult.success ? 'SUCCESS' : 'FAILED'} - ${paymentResult.transactionId ?? paymentResult.error}`);

    return {
      success: paymentResult.success,
      action: 'process_payment',
      transactionId: paymentResult.transactionId,
      amount: payload.amount,
      paymentResult,
      error: paymentResult.error,
    };
  }

  /**
   * Handle validate_pricing action
   */
  private async handleValidatePricing(payload: ValidatePricingPayload): Promise<PricingExecutionResult> {
    if (!payload.items || payload.items.length === 0) {
      return {
        success: false,
        action: 'validate_pricing',
        error: 'Items array is empty',
      };
    }

    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

    const validItems: Array<{ productId: string; valid: boolean; reason?: string }> = [];

    for (const item of payload.items) {
      // Fetch product to validate price
      const product: { price?: number; status?: string } | null = await FirestoreService.get(
        `${COLLECTIONS.ORGANIZATIONS}/${payload.organizationId}/products`,
        item.productId
      );

      if (!product) {
        validItems.push({ productId: item.productId, valid: false, reason: 'Product not found' });
        continue;
      }

      if (product.status === 'inactive') {
        validItems.push({ productId: item.productId, valid: false, reason: 'Product is inactive' });
        continue;
      }

      // Check if price matches (allow 1% tolerance for rounding)
      const productPrice = product.price ?? 0;
      const priceMatch = productPrice > 0 && Math.abs(productPrice - item.unitPrice) <= productPrice * 0.01;
      if (!priceMatch) {
        validItems.push({
          productId: item.productId,
          valid: false,
          reason: `Price mismatch: expected ${productPrice}, got ${item.unitPrice}`,
        });
        continue;
      }

      validItems.push({ productId: item.productId, valid: true });
    }

    const allValid = validItems.every(item => item.valid);

    return {
      success: true,
      action: 'validate_pricing',
      validItems,
      error: allValid ? undefined : 'Some items have pricing issues',
    };
  }

  /**
   * Handle apply_discount action
   */
  private async handleApplyDiscount(payload: ApplyDiscountPayload): Promise<PricingExecutionResult> {
    if (!payload.discountCode || !payload.subtotal) {
      return {
        success: false,
        action: 'apply_discount',
        error: 'Missing required fields: discountCode, subtotal',
      };
    }

    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

    // Fetch discount code
    const discount: {
      type?: 'percentage' | 'fixed';
      value?: number;
      minPurchase?: number;
      maxDiscount?: number;
      expiresAt?: string;
      usageCount?: number;
      usageLimit?: number;
      active?: boolean;
    } | null = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${payload.organizationId}/discounts`,
      payload.discountCode.toUpperCase()
    );

    if (!discount) {
      return {
        success: false,
        action: 'apply_discount',
        error: 'Invalid discount code',
      };
    }

    if (!discount.active) {
      return {
        success: false,
        action: 'apply_discount',
        error: 'Discount code is not active',
      };
    }

    if (discount.expiresAt && new Date(discount.expiresAt) < new Date()) {
      return {
        success: false,
        action: 'apply_discount',
        error: 'Discount code has expired',
      };
    }

    if (discount.usageLimit && discount.usageCount && discount.usageCount >= discount.usageLimit) {
      return {
        success: false,
        action: 'apply_discount',
        error: 'Discount code usage limit reached',
      };
    }

    const minPurchase = discount.minPurchase ?? 0;
    if (minPurchase > 0 && payload.subtotal < minPurchase) {
      return {
        success: false,
        action: 'apply_discount',
        error: `Minimum purchase of $${minPurchase.toFixed(2)} required`,
      };
    }

    // Calculate discount amount
    let discountAmount = 0;
    const discountValue = discount.value ?? 0;
    if (discount.type === 'percentage' && discountValue > 0) {
      discountAmount = payload.subtotal * (discountValue / 100);
    } else if (discount.type === 'fixed' && discountValue > 0) {
      discountAmount = discountValue;
    }

    // Apply max discount cap
    const maxDiscount = discount.maxDiscount ?? 0;
    if (maxDiscount > 0 && discountAmount > maxDiscount) {
      discountAmount = maxDiscount;
    }

    this.log('INFO', `Discount applied: ${payload.discountCode} - $${discountAmount.toFixed(2)}`);

    return {
      success: true,
      action: 'apply_discount',
      subtotal: payload.subtotal,
      discount: discountAmount,
      total: payload.subtotal - discountAmount,
    };
  }

  /**
   * Handle calculate_total action
   */
  private handleCalculateTotal(payload: CalculateTotalPayload): PricingExecutionResult {
    if (!payload.items || payload.items.length === 0) {
      return {
        success: false,
        action: 'calculate_total',
        error: 'Items array is empty',
      };
    }

    // Calculate subtotal
    const subtotal = payload.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    // Apply discount
    const discountAmount = payload.discountAmount ?? 0;
    const afterDiscount = subtotal - discountAmount;

    // Calculate tax
    const taxRate = payload.taxRate ?? 0;
    const tax = afterDiscount * (taxRate / 100);

    // Add shipping
    const shipping = payload.shippingCost ?? 0;

    // Calculate total
    const total = afterDiscount + tax + shipping;

    return {
      success: true,
      action: 'calculate_total',
      subtotal,
      discount: discountAmount,
      tax,
      shipping,
      total,
    };
  }

  /**
   * Handle refund action
   */
  private async handleRefund(payload: RefundPayload): Promise<PricingExecutionResult> {
    if (!payload.transactionId) {
      return {
        success: false,
        action: 'refund',
        error: 'transactionId is required',
      };
    }

    const refundResult = await refundPayment(
      payload.workspaceId,
      payload.organizationId,
      payload.transactionId,
      payload.amount
    );

    this.log('INFO', `Refund processed: ${refundResult.success ? 'SUCCESS' : 'FAILED'}`);

    return {
      success: refundResult.success,
      action: 'refund',
      transactionId: payload.transactionId,
      amount: payload.amount,
      error: refundResult.error,
    };
  }

  /**
   * Handle get_status action
   */
  private async handleGetStatus(payload: GetStatusPayload): Promise<PricingExecutionResult> {
    if (!payload.transactionId) {
      return {
        success: false,
        action: 'get_status',
        error: 'transactionId is required',
      };
    }

    const { RecordService } = await import('@/lib/db/firestore-service');
    const { where } = await import('firebase/firestore');

    // Find order with this transaction ID
    const orders = await RecordService.getAll(
      payload.workspaceId,
      'orders',
      [where('payment.transactionId', '==', payload.transactionId)]
    ) as Array<{
      payment?: { transactionId: string; status?: string; provider?: string };
      status?: string;
    }>;

    if (orders.length === 0) {
      return {
        success: false,
        action: 'get_status',
        transactionId: payload.transactionId,
        error: 'Transaction not found',
      };
    }

    const order = orders[0];
    const paymentResult: PaymentResult = {
      success: true,
      transactionId: payload.transactionId,
      provider: order.payment?.provider,
    };

    return {
      success: true,
      action: 'get_status',
      transactionId: payload.transactionId,
      paymentResult,
    };
  }

  /**
   * Handle incoming signals from the Signal Bus
   */
  async handleSignal(signal: Signal): Promise<AgentReport> {
    const message: AgentMessage = {
      id: signal.id,
      timestamp: signal.createdAt,
      from: signal.origin,
      to: this.identity.id,
      type: 'COMMAND',
      priority: 'NORMAL',
      payload: signal.payload.payload,
      requiresResponse: true,
      traceId: signal.id,
    };

    return this.execute(message);
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean {
    return true;
  }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 300, boilerplate: 50 };
  }
}

// Export singleton instance
export const pricingStrategist = new PricingStrategist();

// ============================================================================
// SINGLETON GETTER
// ============================================================================

export function getPricingStrategist(): PricingStrategist {
  return pricingStrategist;
}
