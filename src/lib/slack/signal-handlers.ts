/**
 * Slack Signal Handlers
 * 
 * Automatically send Slack notifications when Signal Bus events occur.
 * Integrates with all AI features to deliver real-time alerts via Slack.
 * 
 * Features:
 * - Listens to all notification-worthy signals
 * - Routes to appropriate Slack channels based on category
 * - Formats rich messages with blocks and attachments
 * - Respects user preferences and quiet hours
 * - Implements retry logic and error handling
 */

import { logger } from '@/lib/logger/logger';
import type { SalesSignal } from '@/lib/orchestration/types';
import type { NotificationVariables, NotificationCategory } from '@/lib/notifications/types';
import type { SlackService } from './slack-service';
import { SlackMessageBuilder } from './message-builder';
import { db } from '@/lib/firebase-admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type {
  SlackWorkspace,
  SlackChannelMapping,
  SlackMessagePriority,
  SlackMessage,
} from './types';

/**
 * Slack Signal Handler
 * 
 * Handles Signal Bus events and sends Slack notifications
 */
export class SlackSignalHandler {
  private slackService: SlackService;
  private messageBuilder: SlackMessageBuilder;
  
  constructor(
    slackService: SlackService
  ) {
    this.slackService = slackService;
    this.messageBuilder = new SlackMessageBuilder();
  }
  
  /**
   * Handle any signal
   * 
   * Routes signal to appropriate handler based on type
   */
  async handleSignal(signal: SalesSignal): Promise<void> {
    try {
      logger.debug('Processing signal for Slack notifications', {
        signalType: signal.type,
      });

      // Get workspace for organization
      const workspace = await this.getWorkspace();
      
      if (!workspace) {
        logger.debug('No Slack workspace connected for organization');
        return;
      }
      
      if (!workspace.settings.enabled) {
        logger.debug('Slack notifications disabled for workspace', {
          workspaceId: workspace.id,
        });
        return;
      }
      
      // Check quiet hours
      if (this.isInQuietHours(workspace)) {
        logger.debug('In quiet hours, skipping Slack notification', {
          workspaceId: workspace.id,
        });
        return;
      }
      
      // Route to specific handler based on signal type
      await this.routeSignal(signal, workspace);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to handle signal for Slack', err, {
        signalType: signal.type,
      });
    }
  }
  
  /**
   * Route signal to appropriate handler
   */
  private async routeSignal(
    signal: SalesSignal,
    workspace: SlackWorkspace
  ): Promise<void> {
    switch (signal.type) {
      // Deal Risk signals
      case 'deal.risk.critical':
        await this.handleDealRiskCritical(signal, workspace);
        break;
        
      case 'deal.risk.high':
        await this.handleDealRiskHigh(signal, workspace);
        break;
      
      // Conversation Intelligence signals
      case 'conversation.low_score':
        await this.handleConversationLowScore(signal, workspace);
        break;
        
      case 'conversation.red_flag':
        await this.handleConversationRedFlag(signal, workspace);
        break;
      
      // Coaching signals
      case 'coaching.insights.generated':
        await this.handleCoachingInsights(signal, workspace);
        break;
      
      // Performance signals
      case 'performance.top_performer_identified':
        await this.handleTopPerformer(signal, workspace);
        break;
        
      case 'performance.improvement_opportunity':
        await this.handleImprovementOpportunity(signal, workspace);
        break;
      
      // Playbook signals
      case 'playbook.generated':
        await this.handlePlaybookGenerated(signal, workspace);
        break;
      
      // Sequence signals
      case 'sequence.underperforming':
        await this.handleSequenceUnderperforming(signal, workspace);
        break;
        
      case 'sequence.optimization_needed':
        await this.handleSequenceOptimization(signal, workspace);
        break;
      
      // Lead Routing signals
      case 'lead.routed':
        await this.handleLeadRouted(signal, workspace);
        break;
      
      // Email Writer signals
      case 'email.generated':
        await this.handleEmailGenerated(signal, workspace);
        break;
      
      // Workflow signals
      case 'workflow.executed':
        await this.handleWorkflowExecuted(signal, workspace);
        break;
      
      // Forecasting signals
      case 'quota.at_risk':
        await this.handleQuotaAtRisk(signal, workspace);
        break;
        
      case 'quota.achieved':
        await this.handleQuotaAchieved(signal, workspace);
        break;
      
      default:
        logger.debug('No Slack handler for signal type', {
          signalType: signal.type,
        });
    }
  }
  
  // ============================================================================
  // DEAL RISK HANDLERS
  // ============================================================================
  
  private async handleDealRiskCritical(
    signal: SalesSignal,
    workspace: SlackWorkspace
  ): Promise<void> {
    const variables: NotificationVariables = {
      dealId: signal.metadata.dealId as string,
      dealName: signal.metadata.dealName as string,
      dealValue: signal.metadata.dealValue as number,
      dealStage: signal.metadata.dealStage as string,
      riskLevel: 'critical',
      riskProbability: signal.metadata.probability as number,
    };
    
    const message = this.messageBuilder.buildDealRiskAlert(variables, 'critical');
    
    await this.sendNotification(
      workspace,
      'deal_risk',
      message,
      'critical'
    );
  }
  
  private async handleDealRiskHigh(
    signal: SalesSignal,
    workspace: SlackWorkspace
  ): Promise<void> {
    const variables: NotificationVariables = {
      dealId: signal.metadata.dealId as string,
      dealName: signal.metadata.dealName as string,
      dealValue: signal.metadata.dealValue as number,
      dealStage: signal.metadata.dealStage as string,
      riskLevel: 'high',
      riskProbability: signal.metadata.probability as number,
    };
    
    const message = this.messageBuilder.buildDealRiskAlert(variables, 'high');
    
    await this.sendNotification(
      workspace,
      'deal_risk',
      message,
      'high'
    );
  }
  
  // ============================================================================
  // CONVERSATION INTELLIGENCE HANDLERS
  // ============================================================================
  
  private async handleConversationLowScore(
    signal: SalesSignal,
    workspace: SlackWorkspace
  ): Promise<void> {
    const variables: NotificationVariables = {
      conversationId: signal.metadata.conversationId as string,
      conversationScore: signal.metadata.score as number,
      userId: signal.metadata.repId as string,
      userName: signal.metadata.repName as string,
    };
    
    const message = this.messageBuilder.buildConversationAlert(variables, 'low_score');
    
    await this.sendNotification(
      workspace,
      'conversation',
      message,
      'medium'
    );
  }
  
  private async handleConversationRedFlag(
    signal: SalesSignal,
    workspace: SlackWorkspace
  ): Promise<void> {
    const variables: NotificationVariables = {
      conversationId: signal.metadata.conversationId as string,
      redFlagType: signal.metadata.redFlagType as string,
      redFlagDetails: signal.metadata.redFlagDetails as string,
      userId: signal.metadata.repId as string,
      userName: signal.metadata.repName as string,
    };
    
    const message = this.messageBuilder.buildConversationAlert(variables, 'red_flag');
    
    await this.sendNotification(
      workspace,
      'conversation',
      message,
      'high'
    );
  }
  
  // ============================================================================
  // COACHING HANDLERS
  // ============================================================================
  
  private async handleCoachingInsights(
    signal: SalesSignal,
    workspace: SlackWorkspace
  ): Promise<void> {
    const variables: NotificationVariables = {
      userId: signal.metadata.repId as string,
      userName: signal.metadata.repName as string,
      insightsCount: signal.metadata.insightsCount as number,
    };
    
    const message = this.messageBuilder.buildCoachingAlert(variables);
    
    await this.sendNotification(
      workspace,
      'coaching',
      message,
      'low'
    );
  }
  
  // ============================================================================
  // PERFORMANCE HANDLERS
  // ============================================================================
  
  private async handleTopPerformer(
    signal: SalesSignal,
    workspace: SlackWorkspace
  ): Promise<void> {
    const variables: NotificationVariables = {
      userId: signal.metadata.repId as string,
      userName: signal.metadata.repName as string,
      performanceScore: signal.metadata.score as number,
      performanceTier: signal.metadata.tier as string,
    };
    
    const message = this.messageBuilder.buildPerformanceAlert(variables, 'top_performer');
    
    await this.sendNotification(
      workspace,
      'team_performance',
      message,
      'medium'
    );
  }
  
  private async handleImprovementOpportunity(
    signal: SalesSignal,
    workspace: SlackWorkspace
  ): Promise<void> {
    const variables: NotificationVariables = {
      userId: signal.metadata.repId as string,
      userName: signal.metadata.repName as string,
      skillGap: signal.metadata.skillGap as string,
      improvementArea: signal.metadata.area as string,
    };
    
    const message = this.messageBuilder.buildPerformanceAlert(variables, 'improvement');
    
    await this.sendNotification(
      workspace,
      'team_performance',
      message,
      'low'
    );
  }
  
  // ============================================================================
  // PLAYBOOK HANDLERS
  // ============================================================================
  
  private async handlePlaybookGenerated(
    signal: SalesSignal,
    workspace: SlackWorkspace
  ): Promise<void> {
    const variables: NotificationVariables = {
      playbookId: signal.metadata.playbookId as string,
      playbookName: signal.metadata.playbookName as string,
      patternsCount: signal.metadata.patternsCount as number,
    };
    
    const message = this.messageBuilder.buildPlaybookAlert(variables);
    
    await this.sendNotification(
      workspace,
      'playbook',
      message,
      'medium'
    );
  }
  
  // ============================================================================
  // SEQUENCE HANDLERS
  // ============================================================================
  
  private async handleSequenceUnderperforming(
    signal: SalesSignal,
    workspace: SlackWorkspace
  ): Promise<void> {
    const variables: NotificationVariables = {
      sequenceId: signal.metadata.sequenceId as string,
      sequenceName: signal.metadata.sequenceName as string,
      performanceScore: signal.metadata.score as number,
    };
    
    const message = this.messageBuilder.buildSequenceAlert(variables, 'underperforming');
    
    await this.sendNotification(
      workspace,
      'sequence',
      message,
      'high'
    );
  }
  
  private async handleSequenceOptimization(
    signal: SalesSignal,
    workspace: SlackWorkspace
  ): Promise<void> {
    const variables: NotificationVariables = {
      sequenceId: signal.metadata.sequenceId as string,
      sequenceName: signal.metadata.sequenceName as string,
      optimizationCount: signal.metadata.optimizationCount as number,
    };
    
    const message = this.messageBuilder.buildSequenceAlert(variables, 'optimization');
    
    await this.sendNotification(
      workspace,
      'sequence',
      message,
      'medium'
    );
  }
  
  // ============================================================================
  // LEAD ROUTING HANDLERS
  // ============================================================================
  
  private async handleLeadRouted(
    signal: SalesSignal,
    workspace: SlackWorkspace
  ): Promise<void> {
    const variables: NotificationVariables = {
      leadId: signal.metadata.leadId as string,
      leadName: signal.metadata.leadName as string,
      leadCompany: signal.metadata.leadCompany as string,
      userId: signal.metadata.repId as string,
      userName: signal.metadata.repName as string,
      routingScore: signal.metadata.score as number,
    };
    
    const message = this.messageBuilder.buildLeadRoutingAlert(variables);
    
    await this.sendNotification(
      workspace,
      'lead_routing',
      message,
      'high'
    );
  }
  
  // ============================================================================
  // EMAIL WRITER HANDLERS
  // ============================================================================
  
  private async handleEmailGenerated(
    signal: SalesSignal,
    workspace: SlackWorkspace
  ): Promise<void> {
    const variables: NotificationVariables = {
      emailId: signal.metadata.emailId as string,
      emailType: signal.metadata.emailType as string,
      userId: signal.metadata.userId as string,
      dealId: signal.metadata.dealId as string,
      dealName: signal.metadata.dealName as string,
    };
    
    const message = this.messageBuilder.buildEmailWriterAlert(variables);
    
    await this.sendNotification(
      workspace,
      'email_writer',
      message,
      'low'
    );
  }
  
  // ============================================================================
  // WORKFLOW HANDLERS
  // ============================================================================
  
  private async handleWorkflowExecuted(
    signal: SalesSignal,
    workspace: SlackWorkspace
  ): Promise<void> {
    const variables: NotificationVariables = {
      workflowId: signal.metadata.workflowId as string,
      workflowName: signal.metadata.workflowName as string,
      actionsExecuted: signal.metadata.actionsExecuted as number,
      success: signal.metadata.success as boolean,
    };
    
    const message = this.messageBuilder.buildWorkflowAlert(variables);
    
    await this.sendNotification(
      workspace,
      'workflow',
      message,
      'low'
    );
  }
  
  // ============================================================================
  // FORECASTING HANDLERS
  // ============================================================================
  
  private async handleQuotaAtRisk(
    signal: SalesSignal,
    workspace: SlackWorkspace
  ): Promise<void> {
    const variables: NotificationVariables = {
      userId: signal.metadata.repId as string,
      userName: signal.metadata.repName as string,
      quota: signal.metadata.quota as number,
      attainment: signal.metadata.attainment as number,
      gap: signal.metadata.gap as number,
    };
    
    const message = this.messageBuilder.buildForecastingAlert(variables, 'at_risk');
    
    await this.sendNotification(
      workspace,
      'forecasting',
      message,
      'critical'
    );
  }
  
  private async handleQuotaAchieved(
    signal: SalesSignal,
    workspace: SlackWorkspace
  ): Promise<void> {
    const variables: NotificationVariables = {
      userId: signal.metadata.repId as string,
      userName: signal.metadata.repName as string,
      quota: signal.metadata.quota as number,
      attainment: signal.metadata.attainment as number,
    };
    
    const message = this.messageBuilder.buildForecastingAlert(variables, 'achieved');
    
    await this.sendNotification(
      workspace,
      'forecasting',
      message,
      'medium'
    );
  }
  
  // ============================================================================
  // HELPER METHODS
  // ============================================================================
  
  /**
   * Send notification to Slack
   */
  private async sendNotification(
    workspace: SlackWorkspace,
    category: string,
    message: Partial<SlackMessage>,
    priority: SlackMessagePriority
  ): Promise<void> {
    try {
      // Get channel mapping for category
      const mapping = await this.getChannelMapping(workspace.id, category);
      
      if (!mapping) {
        logger.debug('No channel mapping for category', {
          workspaceId: workspace.id,
          category,
        });
        
        // Use default channel if configured
        if (workspace.defaultChannelId) {
          message.channelId = workspace.defaultChannelId;
        } else {
          logger.warn('No default channel configured', {
            workspaceId: workspace.id,
          });
          return;
        }
      } else {
        message.channelId = mapping.channelId;
      }
      
      // Set message priority and category
      message.priority = priority;
      message.category = category as NotificationCategory;
      message.workspaceId = workspace.id;
      
      // Send message
      const result = await this.slackService.sendMessage(
        workspace,
        message
      );
      
      logger.info('Slack notification sent successfully', {
        workspaceId: workspace.id,
        category,
        channelId: message.channelId,
        ts: result.ts,
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to send Slack notification', err, {
        workspaceId: workspace.id,
        category,
      });
    }
  }
  
  /**
   * Get workspace for organization
   */
  private async getWorkspace(): Promise<SlackWorkspace | null> {
    try {
      // Get first active workspace
      const snapshot = await db
        .collection('organizations')
        .doc(PLATFORM_ID)
        .collection('slack_workspaces')
        .where('status', '==', 'connected')
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return null;
      }
      
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as SlackWorkspace;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get Slack workspace', err);
      return null;
    }
  }
  
  /**
   * Get channel mapping for category
   */
  private async getChannelMapping(
    workspaceId: string,
    category: string
  ): Promise<SlackChannelMapping | null> {
    try {
      const workspace = await db.collection('slack_workspaces').doc(workspaceId).get();
      
      if (!workspace.exists) {
        return null;
      }
      
      const workspaceData = workspace.data() as SlackWorkspace;
      
      const snapshot = await db
        .collection('organizations')
        .doc(PLATFORM_ID)
        .collection('slack_channel_mappings')
        .where('workspaceId', '==', workspaceId)
        .where('category', '==', category)
        .where('enabled', '==', true)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return null;
      }
      
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as SlackChannelMapping;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get channel mapping', err, {
        workspaceId,
        category,
      });
      return null;
    }
  }
  
  /**
   * Check if currently in quiet hours
   */
  private isInQuietHours(workspace: SlackWorkspace): boolean {
    const quietHours = workspace.settings.quietHours;
    
    if (!quietHours?.enabled) {
      return false;
    }
    
    try {
      const now = new Date();
      const timezone = quietHours.timezone;
      
      // Get current time in workspace timezone
      const timeStr = now.toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      });
      
      const [currentHour, currentMinute] = timeStr.split(':').map(Number);
      const currentTimeMinutes = currentHour * 60 + currentMinute;
      
      const [startHour, startMinute] = quietHours.start.split(':').map(Number);
      const startTimeMinutes = startHour * 60 + startMinute;
      
      const [endHour, endMinute] = quietHours.end.split(':').map(Number);
      const endTimeMinutes = endHour * 60 + endMinute;
      
      // Handle quiet hours that cross midnight
      if (startTimeMinutes > endTimeMinutes) {
        return currentTimeMinutes >= startTimeMinutes || currentTimeMinutes < endTimeMinutes;
      } else {
        return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes;
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to check quiet hours', err, {
        workspaceId: workspace.id,
      });
      return false;
    }
  }
}

/**
 * Initialize Slack signal handlers
 */
export function initializeSlackHandlers(
  slackService: SlackService
): SlackSignalHandler {
  const handler = new SlackSignalHandler(slackService);
  
  logger.info('Slack signal handlers initialized');
  
  return handler;
}

export default SlackSignalHandler;
