/**
 * Integration Tests - UI Pages
 * Tests that all critical UI pages are properly wired to backend services
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { getOrCreateCart, addToCart } from '@/lib/ecommerce/cart-service';
import { processCheckout } from '@/lib/ecommerce/checkout-service';
import { executeWorkflow } from '@/lib/workflows/workflow-engine';
import { createCampaign, listCampaigns } from '@/lib/email/campaign-manager';
import { FirestoreService } from '@/lib/db/firestore-service';

describe('E-Commerce UI Integration', () => {
  const testOrgId = 'test-org-' + Date.now();
  const testSessionId = 'test-session-' + Date.now();
  const testWorkspaceId = 'default';

  beforeAll(async () => {
    // Set up e-commerce configuration for the test workspace
    await FirestoreService.set(
      `organizations/${testOrgId}/workspaces/${testWorkspaceId}/ecommerce`,
      'config',
      {
        enabled: true,
        currency: 'USD',
        productSchema: 'products', // Entity name, not object
        productMappings: {
          name: 'name',
          price: 'price',
          description: 'description',
          images: 'image',
          sku: 'id',
          inventory: 'inventory'
        }
      },
      false
    );

    // Create a test product in the products entity
    await FirestoreService.set(
      `organizations/${testOrgId}/workspaces/${testWorkspaceId}/entities/products/records`,
      'test-product-1',
      {
        id: 'test-product-1',
        name: 'Test Product',
        description: 'A test product for integration tests',
        price: 1000, // $10.00 in cents
        image: 'https://example.com/test-product.jpg',
        status: 'active',
        inventory: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      false
    );
  }, 10000);

  it('should create cart (products page → cart service)', async () => {
    const cart = await getOrCreateCart(testSessionId, testWorkspaceId, testOrgId);
    
    expect(cart).toBeDefined();
    expect(cart.sessionId).toBe(testSessionId);
    expect(cart.items).toHaveLength(0);
    expect(cart.total).toBe(0);
  }, 10000);

  it('should add product to cart (product detail → cart service)', async () => {
    const cart = await addToCart(testSessionId, testWorkspaceId, testOrgId, 'test-product-1', 2);
    
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(2);
  }, 10000);

  it('should process checkout (checkout page → checkout service)', async () => {
    // First add item to cart
    await addToCart(testSessionId, testWorkspaceId, testOrgId, 'test-product-1', 1);
    
    const order = await processCheckout({
      cartId: testSessionId,
      organizationId: testOrgId,
      workspaceId: testWorkspaceId,
      customer: {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'Customer',
        phone: '555-0100'
      },
      billingAddress: {
        line1: '123 Test St',
        city: 'Test City',
        state: 'TS',
        postal_code: '12345',
        country: 'US',
      },
      shippingAddress: {
        line1: '123 Test St',
        city: 'Test City',
        state: 'TS',
        postal_code: '12345',
        country: 'US',
      },
      paymentMethod: 'card',
      paymentToken: 'tok_visa', // Stripe test token
    });
    
    expect(order).toBeDefined();
    expect(order.id).toBeDefined();
    expect(order.customer.email).toBe('test@example.com');
  }, 15000);
});

describe('Workflow UI Integration', () => {
  const testOrgId = 'test-org-' + Date.now();
  const testWorkspaceId = 'default';

  it('should list workflows (workflows page → firestore)', async () => {
    const workflows = await FirestoreService.getAll(
      `organizations/${testOrgId}/workspaces/${testWorkspaceId}/workflows`,
      []
    );
    
    expect(Array.isArray(workflows)).toBe(true);
  }, 10000);

  it('should create workflow (workflow builder → firestore)', async () => {
    const workflowId = `test-workflow-${Date.now()}`;
    
    await FirestoreService.set(
      `organizations/${testOrgId}/workspaces/${testWorkspaceId}/workflows`,
      workflowId,
      {
        id: workflowId,
        name: 'Test Workflow',
        description: 'Integration test workflow',
        trigger: { type: 'manual', id: 'trigger-1', name: 'Manual', requireConfirmation: false },
        actions: [],
        status: 'draft',
        organizationId: testOrgId,
        workspaceId: testWorkspaceId,
      },
      false
    );
    
    const saved = await FirestoreService.get(
      `organizations/${testOrgId}/workspaces/${testWorkspaceId}/workflows`,
      workflowId
    );
    
    expect(saved).toBeDefined();
    const workflowData: any = saved;
    expect(workflowData.name).toBe('Test Workflow');
  }, 10000);

  it('should execute workflow (workflow page → workflow engine)', async () => {
    const workflow: any = {
      id: 'test-workflow',
      organizationId: testOrgId,
      workspaceId: testWorkspaceId,
      name: 'Test',
      trigger: { type: 'manual', id: 'trigger-1', name: 'Manual', requireConfirmation: false, config: {} },
      actions: [
        { 
          id: 'action-1', 
          type: 'delay', 
          name: 'Test Delay',
          duration: {
            value: 1, // 1 second
            unit: 'seconds'
          },
          onError: 'continue' // Use 'continue' so execution doesn't stop on any errors
        }
      ],
      conditions: [],
      status: 'active',
      settings: {
        stopOnError: false,
        parallel: false
      },
      permissions: {
        canView: ['owner'],
        canEdit: ['owner'],
        canExecute: ['owner']
      }
    };
    
    const execution = await executeWorkflow(workflow, {});
    
    expect(execution).toBeDefined();
    if (execution.status === 'failed') {
      console.log('Workflow execution failed:', execution.error);
      console.log('Action results:', JSON.stringify(execution.actionResults, null, 2));
    }
    expect(execution.status).toBe('completed');
  }, 15000);
});

describe('Email Campaign UI Integration', () => {
  const testOrgId = 'test-org-' + Date.now();
  const testWorkspaceId = 'default';

  it('should create campaign (campaign builder → campaign service)', async () => {
    const campaign = await createCampaign({
      name: 'Test Campaign',
      subject: 'Test Subject',
      htmlContent: 'Test email body',
      organizationId: testOrgId,
      workspaceId: testWorkspaceId,
      fromEmail: 'test@example.com',
      fromName: 'Test Sender',
      createdBy: 'test-user',
      recipientFilters: [],
    });
    
    expect(campaign).toBeDefined();
    expect(campaign.name).toBe('Test Campaign');
  }, 10000);

  it('should list campaigns (campaigns page → campaign service)', async () => {
    const result = await listCampaigns(testOrgId);
    
    expect(result).toBeDefined();
    expect(result.campaigns).toBeDefined();
    expect(Array.isArray(result.campaigns)).toBe(true);
  }, 10000);
});

describe('CRM UI Integration', () => {
  const testOrgId = 'test-org-' + Date.now();
  const testWorkspaceId = 'default';

  it('should list leads (leads page → firestore)', async () => {
    const leads = await FirestoreService.getAll(
      `organizations/${testOrgId}/workspaces/${testWorkspaceId}/entities/leads/records`,
      []
    );
    
    expect(Array.isArray(leads)).toBe(true);
  }, 10000);

  it('should list deals (deals page → firestore)', async () => {
    const deals = await FirestoreService.getAll(
      `organizations/${testOrgId}/workspaces/${testWorkspaceId}/entities/deals/records`,
      []
    );
    
    expect(Array.isArray(deals)).toBe(true);
  }, 10000);

  it('should list contacts (contacts page → firestore)', async () => {
    const contacts = await FirestoreService.getAll(
      `organizations/${testOrgId}/workspaces/${testWorkspaceId}/entities/contacts/records`,
      []
    );
    
    expect(Array.isArray(contacts)).toBe(true);
  }, 10000);

  it('should create lead (leads page → firestore)', async () => {
    const leadId = `test-lead-${Date.now()}`;
    
    await FirestoreService.set(
      `organizations/${testOrgId}/workspaces/${testWorkspaceId}/entities/leads/records`,
      leadId,
      {
        id: leadId,
        name: 'Test Lead',
        email: 'test@example.com',
        status: 'new',
        score: 75,
      },
      false
    );
    
    const saved = await FirestoreService.get(
      `organizations/${testOrgId}/workspaces/${testWorkspaceId}/entities/leads/records`,
      leadId
    );
    
    expect(saved).toBeDefined();
    const leadData: any = saved;
    expect(leadData.name).toBe('Test Lead');
  }, 10000);
});

describe('Product Management UI Integration', () => {
  const testOrgId = 'test-org-' + Date.now();
  const testWorkspaceId = 'default';

  it('should create product (product form → firestore)', async () => {
    const productId = `test-product-${Date.now()}`;
    
    await FirestoreService.set(
      `organizations/${testOrgId}/workspaces/${testWorkspaceId}/entities/products/records`,
      productId,
      {
        id: productId,
        name: 'Test Product',
        price: 99.99,
        sku: 'TEST-001',
        inStock: true,
        category: 'Test Category',
      },
      false
    );
    
    const saved = await FirestoreService.get(
      `organizations/${testOrgId}/workspaces/${testWorkspaceId}/entities/products/records`,
      productId
    );
    
    expect(saved).toBeDefined();
    const productData: any = saved;
    expect(productData.name).toBe('Test Product');
    expect(productData.price).toBe(99.99);
  }, 10000);

  it('should list products for admin (products page → firestore)', async () => {
    const products = await FirestoreService.getAll(
      `organizations/${testOrgId}/workspaces/${testWorkspaceId}/entities/products/records`,
      []
    );
    
    expect(Array.isArray(products)).toBe(true);
  }, 10000);

  it('should list products for customers (store page → firestore)', async () => {
    const products = await FirestoreService.getAll(
      `organizations/${testOrgId}/workspaces/${testWorkspaceId}/entities/products/records`,
      []
    );
    
    expect(Array.isArray(products)).toBe(true);
    
    // Verify products have required fields for display
    if (products.length > 0) {
      const product: any = products[0];
      expect(product.id).toBeDefined();
      // Name, price, etc. are optional but should be present for real products
    }
  }, 10000);
});

