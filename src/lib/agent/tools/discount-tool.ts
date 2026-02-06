/**
 * Discount Tool for AI Agents
 *
 * This tool allows AI agents (Inbound Closer, Campaign Strategist) to:
 * - Fetch authorized discounts for their organization
 * - Validate coupon codes
 * - Apply discounts (within their authorization limits)
 *
 * SECURITY: Permission-based access control
 * - Agents with can_negotiate=false only see 'public_marketing' coupons
 * - Agents with can_negotiate=true can access negotiation coupons
 * - Organizations with is_internal_admin=true bypass all restrictions
 *
 * Integration: Add this to your AI model's function definitions.
 */

import { CouponService } from '@/lib/pricing/coupon-service';
import type { AIAuthorizedDiscounts, MerchantCoupon, CouponValidationResult, CouponCategory } from '@/types/pricing';

/**
 * Agent permissions for discount tool
 * Derived from AgentPersona.can_negotiate
 */
export interface DiscountToolPermissions {
  /** Can this agent access negotiation coupons? Default: false */
  canNegotiate: boolean;
  /** Is this an internal admin organization? (overrides all restrictions) */
  isInternalAdmin?: boolean;
}

/**
 * Tool Definitions for AI Model Function Calling
 * Compatible with OpenAI, Anthropic, and Google Gemini formats
 */
export const DISCOUNT_TOOL_DEFINITIONS = {
  /**
   * Get Authorized Discounts Tool
   * Agents should call this to know what discounts they can offer
   */
  get_authorized_discounts: {
    name: 'get_authorized_discounts',
    description: `Retrieve all discounts and coupons you are authorized to offer to customers.
Call this tool BEFORE quoting prices or when a customer expresses price concerns.
Returns available coupon codes, discount percentages, and your authorization limits.
This helps you know what offers you can make without needing human approval.`,
    parameters: {
      type: 'object',
      properties: {
        context: {
          type: 'string',
          description: 'Why you need the discounts (e.g., "customer expressed price concern", "closing deal", "first-time buyer")',
        },
      },
      required: [],
    },
  },

  /**
   * Validate Coupon Tool
   * Agents should call this when a customer mentions a coupon code
   */
  validate_coupon: {
    name: 'validate_coupon',
    description: `Validate a coupon code that a customer mentioned or wants to use.
Returns whether the coupon is valid, the discount amount, and any restrictions.
Call this when a customer asks "Can I use code XYZ?" or mentions they have a promo code.`,
    parameters: {
      type: 'object',
      properties: {
        coupon_code: {
          type: 'string',
          description: 'The coupon code to validate (case-insensitive)',
        },
        purchase_amount: {
          type: 'number',
          description: 'The purchase amount in cents (e.g., 9900 for $99.00)',
        },
        product_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: List of product IDs in the cart',
        },
      },
      required: ['coupon_code'],
    },
  },

  /**
   * Apply Discount Tool
   * Agents should call this to apply a discount (within their limits)
   */
  apply_discount: {
    name: 'apply_discount',
    description: `Apply a discount to a customer's purchase.
You can only apply discounts within your authorization limit.
If the discount exceeds your limit, this will create a request for human approval.
Use this when closing a deal or offering a promotional discount.`,
    parameters: {
      type: 'object',
      properties: {
        discount_type: {
          type: 'string',
          enum: ['percentage', 'fixed', 'coupon'],
          description: 'Type of discount to apply',
        },
        value: {
          type: 'number',
          description: 'Discount value (percentage 0-100 or fixed amount in cents)',
        },
        coupon_code: {
          type: 'string',
          description: 'If using a coupon, the coupon code to apply',
        },
        reason: {
          type: 'string',
          description: 'Reason for applying this discount (for audit trail)',
        },
        customer_context: {
          type: 'object',
          properties: {
            customer_id: { type: 'string' },
            cart_value: { type: 'number' },
            customer_segment: { type: 'string' },
          },
          description: 'Context about the customer for approval decisions',
        },
      },
      required: ['discount_type', 'value', 'reason'],
    },
  },
};

/**
 * Tool Handlers
 * Process function calls from AI agents
 */
export class DiscountToolHandler {
  private agentId: string;
  private conversationId: string;
  private permissions: DiscountToolPermissions;

  /**
   * Create a DiscountToolHandler with security permissions
   *
   * @param agentId - The agent ID
   * @param conversationId - The conversation ID
   * @param permissions - Security permissions (from AgentPersona.can_negotiate)
   *
   * SECURITY: The permissions.canNegotiate flag MUST come from the agent's
   * stored configuration, not from runtime/user input.
   */
  constructor(
    agentId: string,
    conversationId: string,
    permissions: DiscountToolPermissions = { canNegotiate: false }
  ) {
    this.agentId = agentId;
    this.conversationId = conversationId;
    this.permissions = permissions;
  }

  /**
   * Handle get_authorized_discounts function call
   *
   * SECURITY: Filters results based on agent's can_negotiate permission.
   * - can_negotiate=false: Only returns 'public_marketing' coupons (can MENTION to customers)
   * - can_negotiate=true: Returns all coupons including 'negotiation' codes (can APPLY)
   * - is_internal_admin=true: Overrides all restrictions
   */
  async handleGetAuthorizedDiscounts(_args: {
    context?: string;
  }): Promise<{
    success: boolean;
    data?: AIAuthorizedDiscounts;
    message: string;
  }> {
    try {
      // SECURITY: Pass agent permissions to filter coupons by category
      const discounts = await CouponService.getAuthorizedDiscounts(
        {
          canNegotiate: this.permissions.canNegotiate,
          isInternalAdmin: this.permissions.isInternalAdmin,
        }
      );

      // If no coupons available and agent cannot negotiate, provide helpful message
      if (discounts.available_coupons.length === 0 && !this.permissions.canNegotiate) {
        return {
          success: true,
          data: discounts,
          message: 'You currently have access to public promotional codes only. ' +
            'No public promotions are currently active. ' +
            'If you need to offer negotiation discounts, please request elevated permissions from your manager.',
        };
      }

      return {
        success: true,
        data: discounts,
        message: this.formatDiscountsForAgent(discounts),
      };
    } catch (error) {
      console.error('Error fetching authorized discounts:', error);
      return {
        success: false,
        message: 'Unable to fetch authorized discounts. You may proceed without offering discounts.',
      };
    }
  }

  /**
   * Handle validate_coupon function call
   */
  async handleValidateCoupon(args: {
    coupon_code: string;
    purchase_amount?: number;
    product_ids?: string[];
  }): Promise<{
    success: boolean;
    data?: CouponValidationResult;
    message: string;
  }> {
    try {
      const result = await CouponService.validateMerchantCoupon(
        args.coupon_code,
        args.purchase_amount ?? 0,
        args.product_ids,
        undefined,
        true // isAIRequest
      );

      if (result.valid) {
        const coupon = result.coupon as MerchantCoupon;
        return {
          success: true,
          data: result,
          message: `Coupon "${args.coupon_code}" is valid! It provides ${
            coupon.discount_type === 'percentage'
              ? `${coupon.value}% off`
              : `$${(coupon.value / 100).toFixed(2)} off`
          }${
            coupon.min_purchase > 0 ? ` (minimum purchase: $${(coupon.min_purchase / 100).toFixed(2)})` : ''
          }. You can apply this coupon for the customer.`,
        };
      } else {
        const errorMessages: Record<string, string> = {
          COUPON_NOT_FOUND: `Coupon "${args.coupon_code}" was not found in the system.`,
          COUPON_EXPIRED: `Coupon "${args.coupon_code}" has expired.`,
          COUPON_DEPLETED: `Coupon "${args.coupon_code}" has reached its maximum usage limit.`,
          COUPON_DISABLED: `Coupon "${args.coupon_code}" is currently disabled.`,
          MIN_PURCHASE_NOT_MET: `This coupon requires a minimum purchase amount.`,
          AI_NOT_AUTHORIZED: `You are not authorized to use this coupon. It requires human approval.`,
          AI_DISCOUNT_LIMIT_EXCEEDED: `This discount exceeds your authorization limit. You would need to request approval.`,
        };

        return {
          success: false,
          data: result,
          message: errorMessages[result.error ?? 'COUPON_NOT_FOUND'] ?? 'This coupon cannot be applied.',
        };
      }
    } catch (error) {
      console.error('Error validating coupon:', error);
      return {
        success: false,
        message: 'Unable to validate the coupon at this time. Please try again.',
      };
    }
  }

  /**
   * Handle apply_discount function call
   *
   * SECURITY: Checks permissions before applying negotiation discounts.
   * - Agents without can_negotiate cannot apply percentage/fixed discounts
   * - Coupon applications are validated against the coupon's category
   */
  async handleApplyDiscount(args: {
    discount_type: 'percentage' | 'fixed' | 'coupon';
    value: number;
    coupon_code?: string;
    reason: string;
    customer_context?: {
      customer_id?: string;
      cart_value?: number;
      customer_segment?: string;
    };
  }): Promise<{
    success: boolean;
    data?: {
      applied: boolean;
      requires_approval: boolean;
      request_id?: string;
    };
    message: string;
  }> {
    try {
      // SECURITY: Agents without negotiation permission cannot apply direct discounts
      if (args.discount_type !== 'coupon' && !this.permissions.canNegotiate && !this.permissions.isInternalAdmin) {
        return {
          success: false,
          message: 'You are not authorized to apply direct percentage or fixed discounts. ' +
            'You can only mention public promotional codes to customers. ' +
            'Please escalate to a manager if the customer requires a special discount.',
        };
      }

      // Get authorization limits (respecting permissions)
      const authorization = await CouponService.getAuthorizedDiscounts(
        {
          canNegotiate: this.permissions.canNegotiate,
          isInternalAdmin: this.permissions.isInternalAdmin,
        }
      );

      // If using a coupon, validate and apply it
      if (args.discount_type === 'coupon' && args.coupon_code) {
        const validation = await CouponService.validateMerchantCoupon(
          args.coupon_code,
          args.customer_context?.cart_value ?? 0,
          undefined,
          args.customer_context?.customer_id,
          true
        );

        if (!validation.valid) {
          return {
            success: false,
            message: `Cannot apply coupon: ${validation.error}`,
          };
        }

        // SECURITY: Check if agent can apply this coupon based on category
        const coupon = validation.coupon as MerchantCoupon;
        const couponCategory = coupon.coupon_category || 'negotiation';

        if (couponCategory === 'negotiation' && !this.permissions.canNegotiate && !this.permissions.isInternalAdmin) {
          return {
            success: false,
            message: `Coupon "${args.coupon_code}" is a negotiation code reserved for closing deals. ` +
              'You are not authorized to apply negotiation discounts. ' +
              'Please escalate to a manager or use public promotional codes instead.',
          };
        }

        return {
          success: true,
          data: { applied: true, requires_approval: false },
          message: `Successfully applied coupon ${args.coupon_code}. The customer will receive ${
            validation.discount_amount ? `$${(validation.discount_amount / 100).toFixed(2)} off` : 'the discount'
          }.`,
        };
      }

      // For percentage/fixed discounts, check authorization
      const discountPercentage = args.discount_type === 'percentage'
        ? args.value
        : (args.value / (args.customer_context?.cart_value ?? 10000)) * 100;

      const requiresApproval = discountPercentage > authorization.require_human_approval_above;

      if (requiresApproval) {
        // Create approval request
        const request = await CouponService.requestAIDiscount(
          this.agentId,
          this.conversationId,
          discountPercentage,
          undefined,
          {
            customer_id: args.customer_context?.customer_id,
            cart_value: args.customer_context?.cart_value,
            customer_segment: args.customer_context?.customer_segment,
            conversation_sentiment: args.reason,
          }
        );

        return {
          success: true,
          data: {
            applied: false,
            requires_approval: true,
            request_id: request.id,
          },
          message: `This ${discountPercentage.toFixed(1)}% discount exceeds your authorization limit of ${authorization.require_human_approval_above}%. A request has been submitted for manager approval. You can inform the customer that a special discount is being reviewed.`,
        };
      }

      // Within limits - apply directly
      return {
        success: true,
        data: { applied: true, requires_approval: false },
        message: `Applied ${
          args.discount_type === 'percentage'
            ? `${args.value}% discount`
            : `$${(args.value / 100).toFixed(2)} discount`
        }. This is within your authorization limit.`,
      };
    } catch (error) {
      console.error('Error applying discount:', error);
      return {
        success: false,
        message: 'Unable to apply the discount. Please try again or escalate to a human agent.',
      };
    }
  }

  /**
   * Main handler - route function calls to appropriate handlers
   */
  async handleFunctionCall(
    functionName: string,
    args: Record<string, unknown>
  ): Promise<{
    success: boolean;
    data?: unknown;
    message: string;
  }> {
    switch (functionName) {
      case 'get_authorized_discounts':
        return this.handleGetAuthorizedDiscounts(args as { context?: string });

      case 'validate_coupon':
        return this.handleValidateCoupon(args as {
          coupon_code: string;
          purchase_amount?: number;
          product_ids?: string[];
        });

      case 'apply_discount':
        return this.handleApplyDiscount(args as {
          discount_type: 'percentage' | 'fixed' | 'coupon';
          value: number;
          coupon_code?: string;
          reason: string;
          customer_context?: {
            customer_id?: string;
            cart_value?: number;
            customer_segment?: string;
          };
        });

      default:
        return {
          success: false,
          message: `Unknown function: ${functionName}`,
        };
    }
  }

  /**
   * Format discounts as a human-readable message for the agent
   * Categorizes coupons by type for clarity
   */
  private formatDiscountsForAgent(discounts: AIAuthorizedDiscounts): string {
    const lines: string[] = [
      '**Your Authorized Discounts:**',
      '',
    ];

    // Access category field from available coupons
    interface CouponWithCategory {
      code: string;
      discount_type: 'percentage' | 'fixed';
      value: number;
      max_discount?: number;
      description?: string;
      trigger_keywords?: string[];
      category?: CouponCategory;
    }

    // Separate coupons by category
    const publicCoupons = discounts.available_coupons.filter(
      (c) => (c as CouponWithCategory).category === 'public_marketing'
    );
    const negotiationCoupons = discounts.available_coupons.filter(
      (c) => (c as CouponWithCategory).category === 'negotiation' || !(c as CouponWithCategory).category
    );

    // Show public marketing codes (can mention to customers)
    if (publicCoupons.length > 0) {
      lines.push('**📢 Public Promotional Codes** (You can mention these to customers):');
      for (const coupon of publicCoupons) {
        const discountStr = coupon.discount_type === 'percentage'
          ? `${coupon.value}% off`
          : `$${(coupon.value / 100).toFixed(2)} off`;
        lines.push(`- **${coupon.code}**: ${discountStr}${coupon.description ? ` - ${coupon.description}` : ''}`);
      }
      lines.push('');
    }

    // Show negotiation codes (only if agent has permission)
    if (negotiationCoupons.length > 0) {
      lines.push('**🤝 Negotiation Codes** (For closing deals/price objections):');
      for (const coupon of negotiationCoupons) {
        const discountStr = coupon.discount_type === 'percentage'
          ? `${coupon.value}% off`
          : `$${(coupon.value / 100).toFixed(2)} off`;
        lines.push(`- **${coupon.code}**: ${discountStr}${coupon.description ? ` - ${coupon.description}` : ''}`);
      }
      lines.push('');
    }

    // Show message if no coupons
    if (discounts.available_coupons.length === 0) {
      lines.push('*No coupons currently available for your authorization level.*');
      lines.push('');
    }

    // Show authorization limits (only relevant for agents with negotiation permission)
    if (this.permissions.canNegotiate || this.permissions.isInternalAdmin) {
      lines.push(`**Your Authorization Limits:**`);
      lines.push(`- Maximum discount you can offer without approval: ${discounts.max_ai_discount_percentage}%`);
      lines.push(`- Discounts above ${discounts.require_human_approval_above}% require manager approval`);
      lines.push('');

      if (discounts.auto_offer_on_hesitation) {
        lines.push('*Tip: You can proactively offer discounts when customers hesitate on price.*');
      }
      if (discounts.auto_offer_on_price_objection) {
        lines.push('*Tip: You are authorized to offer discounts when customers object to pricing.*');
      }
    } else {
      lines.push('**Your Permissions:**');
      lines.push('- You can MENTION public promotional codes to customers');
      lines.push('- You CANNOT apply direct percentage/fixed discounts');
      lines.push('- Escalate to a manager for special discount requests');
    }

    return lines.join('\n');
  }
}

/**
 * Export function definitions in different formats
 */

// OpenAI Format
export const getOpenAITools = () => [
  {
    type: 'function',
    function: DISCOUNT_TOOL_DEFINITIONS.get_authorized_discounts,
  },
  {
    type: 'function',
    function: DISCOUNT_TOOL_DEFINITIONS.validate_coupon,
  },
  {
    type: 'function',
    function: DISCOUNT_TOOL_DEFINITIONS.apply_discount,
  },
];

// Google Gemini Format
export const getGeminiTools = () => ({
  function_declarations: [
    DISCOUNT_TOOL_DEFINITIONS.get_authorized_discounts,
    DISCOUNT_TOOL_DEFINITIONS.validate_coupon,
    DISCOUNT_TOOL_DEFINITIONS.apply_discount,
  ],
});

// Anthropic Format
export const getAnthropicTools = () => [
  {
    name: DISCOUNT_TOOL_DEFINITIONS.get_authorized_discounts.name,
    description: DISCOUNT_TOOL_DEFINITIONS.get_authorized_discounts.description,
    input_schema: DISCOUNT_TOOL_DEFINITIONS.get_authorized_discounts.parameters,
  },
  {
    name: DISCOUNT_TOOL_DEFINITIONS.validate_coupon.name,
    description: DISCOUNT_TOOL_DEFINITIONS.validate_coupon.description,
    input_schema: DISCOUNT_TOOL_DEFINITIONS.validate_coupon.parameters,
  },
  {
    name: DISCOUNT_TOOL_DEFINITIONS.apply_discount.name,
    description: DISCOUNT_TOOL_DEFINITIONS.apply_discount.description,
    input_schema: DISCOUNT_TOOL_DEFINITIONS.apply_discount.parameters,
  },
];
