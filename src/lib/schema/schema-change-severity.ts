/**
 * Schema Change Severity Assessment
 * Determines severity of schema changes and appropriate UX response
 */

import type { SchemaChangeEvent } from './schema-change-tracker';
import { logger } from '@/lib/logger/logger';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

export interface SeverityAssessment {
  level: SeverityLevel;
  requiresImmediateAction: boolean;
  blockingAction: boolean;
  userMessage: string;
  recommendation: string;
  affectedItemCount: number;
}

/**
 * Severity Assessor
 */
export class SchemaChangeSeverityAssessor {
  /**
   * Assess severity of schema change
   */
  static async assessSeverity(event: SchemaChangeEvent): Promise<SeverityAssessment> {
    // Count affected items
    const affectedCount = event.affectedSystems.reduce((sum, system) => sum + system.itemsAffected, 0);
    
    // Determine severity based on change type and impact
    let level: SeverityLevel;
    let requiresImmediateAction: boolean;
    let blockingAction: boolean;
    let userMessage: string;
    let recommendation: string;
    
    switch (event.changeType) {
      case 'field_deleted':
        if (affectedCount > 0) {
          level = 'critical';
          requiresImmediateAction = true;
          blockingAction = true;
          userMessage = `Deleting field "${event.oldFieldName}" will break ${affectedCount} workflow(s), integration(s), or other system(s).`;
          recommendation = 'Review affected systems and update them before deleting this field, or choose a replacement field.';
        } else {
          level = 'low';
          requiresImmediateAction = false;
          blockingAction = false;
          userMessage = `Field "${event.oldFieldName}" deleted successfully.`;
          recommendation = 'No further action needed.';
        }
        break;
      
      case 'field_type_changed':
        if (this.isIncompatibleTypeChange(event.oldFieldType!, event.newFieldType!)) {
          level = 'high';
          requiresImmediateAction = true;
          blockingAction = false;
          userMessage = `Changing field type from ${event.oldFieldType} to ${event.newFieldType} may require data conversion.`;
          recommendation = 'Review the conversion preview and approve if acceptable.';
        } else {
          level = 'medium';
          requiresImmediateAction = false;
          blockingAction = false;
          userMessage = `Field type changed from ${event.oldFieldType} to ${event.newFieldType}.`;
          recommendation = 'Compatible type change - auto-converted.';
        }
        break;
      
      case 'field_renamed':
      case 'field_key_changed':
        if (affectedCount > 5) {
          level = 'high';
          requiresImmediateAction = true;
          blockingAction = false;
          userMessage = `Renaming field affects ${affectedCount} systems.`;
          recommendation = 'Systems have been auto-updated. Please verify they still work correctly.';
        } else if (affectedCount > 0) {
          level = 'medium';
          requiresImmediateAction = false;
          blockingAction = false;
          userMessage = `Field renamed from "${event.oldFieldKey}" to "${event.newFieldKey}". ${affectedCount} system(s) updated.`;
          recommendation = 'Auto-updated. Monitor for any issues.';
        } else {
          level = 'low';
          requiresImmediateAction = false;
          blockingAction = false;
          userMessage = `Field renamed successfully.`;
          recommendation = 'No systems affected.';
        }
        break;
      
      case 'schema_renamed':
        level = 'medium';
        requiresImmediateAction = false;
        blockingAction = false;
        userMessage = `Schema renamed from "${event.oldSchemaName}" to "${event.newSchemaName}".`;
        recommendation = 'Systems have been updated automatically.';
        break;
      
      case 'field_added':
        level = 'low';
        requiresImmediateAction = false;
        blockingAction = false;
        userMessage = `Field "${event.newFieldName}" added successfully.`;
        recommendation = 'New field is now available for use.';
        break;
      
      default:
        level = 'low';
        requiresImmediateAction = false;
        blockingAction = false;
        userMessage = 'Schema change detected.';
        recommendation = 'No action required.';
    }
    
    return {
      level,
      requiresImmediateAction,
      blockingAction,
      userMessage,
      recommendation,
      affectedItemCount: affectedCount,
    };
  }
  
  /**
   * Check if type change is incompatible
   */
  private static isIncompatibleTypeChange(oldType: string, newType: string): boolean {
    // Complex conversions that need preview
    const incompatible = [
      ['text', 'number'],
      ['text', 'currency'],
      ['text', 'date'],
      ['longText', 'number'],
      ['longText', 'currency'],
    ];
    
    return incompatible.some(([from, to]) => 
      oldType === from && newType === to
    );
  }
}

/**
 * UX Handler
 * Routes schema changes to appropriate user experience based on severity
 */
export class SchemaChangeUXHandler {
  /**
   * Handle schema change with appropriate UX
   */
  static async handleSchemaChange(event: SchemaChangeEvent): Promise<void> {
    const assessment = await SchemaChangeSeverityAssessor.assessSeverity(event);
    
    logger.info('[Schema Change UX] Handling schema change', {
      file: 'schema-change-severity.ts',
      eventId: event.id,
      severity: assessment.level,
      blocking: assessment.blockingAction,
    });
    
    switch (assessment.level) {
      case 'critical':
        await this.handleCritical(event, assessment);
        break;
      
      case 'high':
        await this.handleHigh(event, assessment);
        break;
      
      case 'medium':
        await this.handleMedium(event, assessment);
        break;
      
      case 'low':
        await this.handleLow(event, assessment);
        break;
    }
  }
  
  /**
   * Handle critical severity (blocking modal)
   */
  private static async handleCritical(
    event: SchemaChangeEvent,
    assessment: SeverityAssessment
  ): Promise<void> {
    logger.warn('[Schema Change UX] Critical issue - creating blocking notification', {
      file: 'schema-change-severity.ts',
      eventId: event.id,
    });
    
    await this.createNotification(event, {
      ...assessment,
      type: 'error',
      blocking: true,
      actions: [
        { label: 'Cancel Change', action: 'cancel', primary: true },
        { label: 'View Affected Systems', action: 'view_impact' },
        { label: 'Proceed Anyway', action: 'force', dangerous: true },
      ],
    });
  }
  
  /**
   * Handle high severity (wizard/guided flow)
   */
  private static async handleHigh(
    event: SchemaChangeEvent,
    assessment: SeverityAssessment
  ): Promise<void> {
    logger.warn('[Schema Change UX] High priority - launching wizard', {
      file: 'schema-change-severity.ts',
      eventId: event.id,
    });
    
    await this.createNotification(event, {
      ...assessment,
      type: 'warning',
      blocking: false,
      showWizard: true,
      actions: [
        { label: 'Fix Now', action: 'launch_wizard', primary: true },
        { label: 'View Details', action: 'view_details' },
        { label: 'Remind Me Later', action: 'dismiss' },
      ],
    });
  }
  
  /**
   * Handle medium severity (notification + dashboard)
   */
  private static async handleMedium(
    event: SchemaChangeEvent,
    assessment: SeverityAssessment
  ): Promise<void> {
    logger.info('[Schema Change UX] Medium priority - notification + dashboard', {
      file: 'schema-change-severity.ts',
      eventId: event.id,
    });
    
    await Promise.all([
      this.createNotification(event, {
        ...assessment,
        type: 'warning',
        blocking: false,
        actions: [
          { label: 'Review Changes', action: 'view_impact' },
          { label: 'Dismiss', action: 'dismiss' },
        ],
      }),
      this.addToIssuesDashboard(event, assessment),
    ]);
  }
  
  /**
   * Handle low severity (dashboard only)
   */
  private static async handleLow(
    event: SchemaChangeEvent,
    assessment: SeverityAssessment
  ): Promise<void> {
    logger.info('[Schema Change UX] Low priority - dashboard only', {
      file: 'schema-change-severity.ts',
      eventId: event.id,
    });
    
    await this.addToIssuesDashboard(event, assessment);
  }
  
  /**
   * Create user notification
   */
  private static async createNotification(
    event: SchemaChangeEvent,
    options: any
  ): Promise<void> {
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      
      const notificationPath = `${COLLECTIONS.ORGANIZATIONS}/${event.organizationId}/notifications`;
      const notificationId = `notif_severity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await FirestoreService.set(
        notificationPath,
        notificationId,
        {
          id: notificationId,
          organizationId: event.organizationId,
          workspaceId: event.workspaceId,
          title: `Schema Change: ${options.level.toUpperCase()}`,
          message: options.userMessage,
          type: options.type || 'info',
          category: 'schema_change_severity',
          metadata: {
            eventId: event.id,
            severity: options.level,
            blocking: options.blocking,
            affectedCount: options.affectedItemCount,
            recommendation: options.recommendation,
            showWizard: options.showWizard,
          },
          actions: options.actions ?? [],
          read: false,
          requiresAction: options.blocking || false,
          createdAt: new Date().toISOString(),
        },
        false
      );
      
    } catch (error) {
      logger.error('[Schema Change UX] Failed to create notification', error, {
        file: 'schema-change-severity.ts',
      });
    }
  }
  
  /**
   * Add to issues dashboard
   */
  private static async addToIssuesDashboard(
    event: SchemaChangeEvent,
    assessment: SeverityAssessment
  ): Promise<void> {
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      
      const issuesPath = `${COLLECTIONS.ORGANIZATIONS}/${event.organizationId}/schemaIssues`;
      const issueId = `issue_${event.id}`;
      
      await FirestoreService.set(
        issuesPath,
        issueId,
        {
          id: issueId,
          eventId: event.id,
          organizationId: event.organizationId,
          workspaceId: event.workspaceId,
          schemaId: event.schemaId,
          
          severity: assessment.level,
          status: 'open',
          
          title: `${event.changeType}: ${event.oldFieldName || event.newFieldName || 'Schema change'}`,
          description: assessment.userMessage,
          recommendation: assessment.recommendation,
          
          affectedSystems: event.affectedSystems,
          affectedItemCount: assessment.affectedItemCount,
          
          requiresAction: assessment.requiresImmediateAction,
          
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        false
      );
      
      logger.info('[Schema Change UX] Added to issues dashboard', {
        file: 'schema-change-severity.ts',
        issueId,
      });
      
    } catch (error) {
      logger.error('[Schema Change UX] Failed to add to dashboard', error, {
        file: 'schema-change-severity.ts',
      });
    }
  }
}



