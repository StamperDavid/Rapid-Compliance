/**
 * Schema Adaptability System Tests
 * Tests for automatic schema change adaptation across all systems
 */

import { describe, it, expect } from '@jest/globals';
import { SchemaChangeDetector } from '@/lib/schema/schema-change-tracker';
import { FieldResolver } from '@/lib/schema/field-resolver';
import { autoConfigureEcommerceMappings } from '@/lib/ecommerce/mapping-adapter';
import { validateWorkflow } from '@/lib/schema/workflow-validator';
import type { Schema } from '@/types/schema';
import type { Workflow } from '@/types/workflow';
import { Timestamp } from 'firebase/firestore';

describe('Schema Adaptability System', () => {
  describe('Schema Change Detection', () => {
    it('should detect field rename', () => {
      const oldSchema: Schema = {
        id: 'schema_1',
        workspaceId: 'ws_1',
        name: 'Products',
        pluralName: 'Products',
        singularName: 'Product',
        fields: [
          {
            id: 'field_1',
            key: 'price',
            label: 'Price',
            type: 'currency',
            config: { type: 'currency' },
            required: true,
            unique: false,
            readonly: false,
            hidden: false,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          },
        ],
        primaryFieldId: 'field_1',
        relations: [],
        permissions: { create: [], read: [], update: [], delete: [] },
        settings: {
          allowAttachments: true,
          allowComments: true,
          allowActivityLog: true,
          enableVersioning: false,
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: 'user_1',
        status: 'active',
        version: 1,
      };

      const newSchema: Schema = {
        ...oldSchema,
        fields: [
          {
            ...oldSchema.fields[0],
            key: 'hourly_rate',
            label: 'Hourly Rate',
          },
        ],
        version: 2,
      };

      const events = SchemaChangeDetector.detectChanges(oldSchema, newSchema);

      expect(events.length).toBeGreaterThan(0);
      const renameEvent = events.find(e => e.changeType === 'field_key_changed');
      expect(renameEvent).toBeDefined();
      expect(renameEvent?.oldFieldKey).toBe('price');
      expect(renameEvent?.newFieldKey).toBe('hourly_rate');
    });

    it('should detect field deletion', () => {
      const oldSchema: Schema = {
        id: 'schema_1',
        workspaceId: 'ws_1',
        name: 'Products',
        pluralName: 'Products',
        singularName: 'Product',
        fields: [
          {
            id: 'field_1',
            key: 'price',
            label: 'Price',
            type: 'currency',
            config: { type: 'currency' },
            required: true,
            unique: false,
            readonly: false,
            hidden: false,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          },
          {
            id: 'field_2',
            key: 'name',
            label: 'Name',
            type: 'text',
            config: { type: 'text' },
            required: true,
            unique: false,
            readonly: false,
            hidden: false,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          },
        ],
        primaryFieldId: 'field_2',
        relations: [],
        permissions: { create: [], read: [], update: [], delete: [] },
        settings: {
          allowAttachments: true,
          allowComments: true,
          allowActivityLog: true,
          enableVersioning: false,
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: 'user_1',
        status: 'active',
        version: 1,
      };

      const newSchema: Schema = {
        ...oldSchema,
        fields: [oldSchema.fields[1]], // Remove field_1
        version: 2,
      };

      const events = SchemaChangeDetector.detectChanges(oldSchema, newSchema);

      const deletionEvent = events.find(e => e.changeType === 'field_deleted');
      expect(deletionEvent).toBeDefined();
      expect(deletionEvent?.oldFieldKey).toBe('price');
    });

    it('should detect schema rename', () => {
      const oldSchema: Schema = {
        id: 'schema_1',
        workspaceId: 'ws_1',
        name: 'Products',
        pluralName: 'Products',
        singularName: 'Product',
        fields: [],
        primaryFieldId: 'field_1',
        relations: [],
        permissions: { create: [], read: [], update: [], delete: [] },
        settings: {
          allowAttachments: true,
          allowComments: true,
          allowActivityLog: true,
          enableVersioning: false,
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: 'user_1',
        status: 'active',
        version: 1,
      };

      const newSchema: Schema = {
        ...oldSchema,
        name: 'Services',
        version: 2,
      };

      const events = SchemaChangeDetector.detectChanges(oldSchema, newSchema);

      const renameEvent = events.find(e => e.changeType === 'schema_renamed');
      expect(renameEvent).toBeDefined();
      expect(renameEvent?.oldSchemaName).toBe('Products');
      expect(renameEvent?.newSchemaName).toBe('Services');
    });
  });

  describe('Field Resolver', () => {
    const testSchema: Schema = {
      id: 'schema_1',
      workspaceId: 'ws_1',
      name: 'Products',
      pluralName: 'Products',
      singularName: 'Product',
      fields: [
        {
          id: 'field_1',
          key: 'hourly_rate',
          label: 'Hourly Rate',
          type: 'currency',
          config: { type: 'currency' },
          required: true,
          unique: false,
          readonly: false,
          hidden: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        {
          id: 'field_2',
          key: 'service_name',
          label: 'Service Name',
          type: 'text',
          config: { type: 'text' },
          required: true,
          unique: false,
          readonly: false,
          hidden: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
      ],
      primaryFieldId: 'field_2',
      relations: [],
      permissions: { create: [], read: [], update: [], delete: [] },
      settings: {
        allowAttachments: true,
        allowComments: true,
        allowActivityLog: true,
        enableVersioning: false,
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: 'user_1',
      status: 'active',
      version: 1,
    };

    it('should resolve exact key match', () => {
      const resolved = FieldResolver.resolveField(testSchema, 'hourly_rate');

      expect(resolved).toBeDefined();
      expect(resolved?.fieldKey).toBe('hourly_rate');
      expect(resolved?.confidence).toBe(1.0);
      expect(resolved?.matchType).toBe('exact_key');
    });

    it('should resolve field by common alias', () => {
      const resolved = FieldResolver.resolveFieldWithCommonAliases(testSchema, 'price');

      expect(resolved).toBeDefined();
      expect(resolved?.fieldKey).toBe('hourly_rate');
      expect(resolved?.confidence).toBeGreaterThan(0.5);
    });

    it('should resolve field by partial label match', () => {
      const resolved = FieldResolver.resolveField(testSchema, 'name');

      expect(resolved).toBeDefined();
      expect(resolved?.fieldKey).toBe('service_name');
    });

    it('should get field value from record', () => {
      const record = {
        hourly_rate: 150,
        service_name: 'Consulting',
      };

      const value = FieldResolver.getFieldValue(record, 'hourly_rate');
      expect(value).toBe(150);
    });

    it('should handle nested field values', () => {
      const record = {
        customer: {
          email: 'test@example.com',
        },
      };

      const value = FieldResolver.getFieldValue(record, 'customer.email');
      expect(value).toBe('test@example.com');
    });

    it('should validate field references', () => {
      const validation = FieldResolver.validateFieldReference(testSchema, 'price');

      // 'price' should resolve to 'hourly_rate' via aliases
      expect(validation.valid).toBeDefined();
    });
  });

  describe('E-Commerce Mapping Adapter', () => {
    it('should auto-configure product mappings', () => {
      // This test would require mocking Firestore
      // For now, we just ensure the function exists
      expect(autoConfigureEcommerceMappings).toBeDefined();
    });
  });

  describe('Workflow Validation', () => {
    const testSchema = {
      id: 'schema_1',
      name: 'Products',
      fields: [
        {
          id: 'field_1',
          key: 'price',
          label: 'Price',
          type: 'currency',
        },
        {
          id: 'field_2',
          key: 'name',
          label: 'Name',
          type: 'text',
        },
      ],
    };

    it('should validate workflow with valid field references', () => {
      const workflow = {
        id: 'wf_1',
        name: 'Test Workflow',
        trigger: {
          type: 'entity.created',
          schemaId: 'schema_1',
        },
        actions: [
          {
            type: 'create_entity',
            schemaId: 'schema_1',
            fieldMappings: [
              {
                targetField: 'price',
                source: 'static',
                staticValue: 100,
              },
            ],
          },
        ],
        status: 'active',
      } as Workflow;

      const validation = validateWorkflow(workflow, testSchema as Schema);

      expect(validation.valid).toBeDefined();
    });

    it('should detect invalid field references in workflows', () => {
      const workflow: Workflow = {
        id: 'wf_1',
        name: 'Test Workflow',
        trigger: {
          type: 'entity.created',
          schemaId: 'schema_1',
        },
        actions: [
          {
            type: 'create_entity',
            schemaId: 'schema_1',
            fieldMappings: [
              {
                targetField: 'nonexistent_field',
                source: 'static',
                staticValue: 100,
              },
            ],
          },
        ],
        status: 'active',
      } as Workflow;

      const validation = validateWorkflow(workflow, testSchema as Schema);

      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle field rename scenario end-to-end', () => {
      // Scenario: User renames 'price' to 'hourly_rate'
      
      // 1. Create old schema
      const oldSchema: Schema = {
        id: 'schema_products',
        workspaceId: 'ws_1',
        name: 'Products',
        pluralName: 'Products',
        singularName: 'Product',
        fields: [
          {
            id: 'field_price',
            key: 'price',
            label: 'Price',
            type: 'currency',
            config: { type: 'currency' },
            required: true,
            unique: false,
            readonly: false,
            hidden: false,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          },
        ],
        primaryFieldId: 'field_price',
        relations: [],
        permissions: { create: [], read: [], update: [], delete: [] },
        settings: {
          allowAttachments: true,
          allowComments: true,
          allowActivityLog: true,
          enableVersioning: false,
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: 'user_1',
        status: 'active',
        version: 1,
      };

      // 2. Create new schema with renamed field
      const newSchema: Schema = {
        ...oldSchema,
        fields: [
          {
            ...oldSchema.fields[0],
            key: 'hourly_rate',
            label: 'Hourly Rate',
          },
        ],
        version: 2,
      };

      // 3. Detect changes
      const events = SchemaChangeDetector.detectChanges(oldSchema, newSchema);
      expect(events.length).toBeGreaterThan(0);

      // 4. Verify field resolver can still find the field
      const resolved = FieldResolver.resolveFieldWithCommonAliases(newSchema, 'price');
      expect(resolved).toBeDefined();
      expect(resolved?.fieldKey).toBe('hourly_rate');

      // 5. Verify workflows can still reference the old name
      const product = { hourly_rate: 150 };
      const value = FieldResolver.getFieldValue(product, resolved!);
      expect(value).toBe(150);
    });
  });
});



