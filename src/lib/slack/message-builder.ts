/**
 * Slack Message Builder
 * 
 * Builds rich Slack messages with blocks, attachments, and interactive elements.
 * Provides consistent formatting across all notification types.
 */

import type {
  SlackMessage,
  SlackBlock,
  SlackAttachment,
  SlackMessagePriority,
} from './types';
import type { NotificationVariables } from '@/lib/notifications/types';

/**
 * Slack Message Builder
 * 
 * Creates formatted Slack messages for different event types
 */
export class SlackMessageBuilder {
  /**
   * Build deal risk alert message
   */
  buildDealRiskAlert(
    variables: NotificationVariables,
    level: 'critical' | 'high'
  ): Partial<SlackMessage> {
    const color = level === 'critical' ? '#FF0000' : '#FFA500';
    const emoji = level === 'critical' ? '🚨' : '⚠️';
    const priority = variables.riskProbability as number;
    
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${level.toUpperCase()} Deal Risk Detected`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Deal:*\n${variables.dealName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Value:*\n$${(variables.dealValue as number).toLocaleString()}`,
          },
          {
            type: 'mrkdwn',
            text: `*Stage:*\n${variables.dealStage}`,
          },
          {
            type: 'mrkdwn',
            text: `*Risk:*\n${Math.round(priority * 100)}% probability`,
          },
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: level === 'critical' 
              ? '🔴 *Immediate action required* - This deal needs urgent attention'
              : '🟠 *Action recommended* - Review this deal soon to prevent slippage',
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Deal',
              emoji: true,
            },
            style: 'primary',
            url: `${process.env.NEXT_PUBLIC_APP_URL}/deals/${variables.dealId}`,
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Risk Analysis',
              emoji: true,
            },
            url: `${process.env.NEXT_PUBLIC_APP_URL}/risk/${variables.dealId}`,
          },
        ],
      },
    ];
    
    return {
      type: 'blocks',
      text: `${emoji} ${level.toUpperCase()}: Deal "${variables.dealName}" has ${Math.round(priority * 100)}% risk of slipping`,
      blocks,
    };
  }
  
  /**
   * Build conversation intelligence alert
   */
  buildConversationAlert(
    variables: NotificationVariables,
    alertType: 'low_score' | 'red_flag'
  ): Partial<SlackMessage> {
    const emoji = alertType === 'red_flag' ? '🚩' : '📉';
    const title = alertType === 'red_flag' 
      ? 'Red Flag in Conversation' 
      : 'Low Conversation Score';
    
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Rep:*\n${variables.userName}`,
          },
          alertType === 'low_score' && {
            type: 'mrkdwn',
            text: `*Score:*\n${variables.conversationScore}/100`,
          },
          alertType === 'red_flag' && {
            type: 'mrkdwn',
            text: `*Issue:*\n${variables.redFlagType}`,
          },
        ].filter(Boolean) as any[],
      },
    ];
    
    if (alertType === 'red_flag' && variables.redFlagDetails) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Details:*\n${variables.redFlagDetails}`,
        },
      });
    }
    
    blocks.push(
      {
        type: 'divider',
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Conversation',
              emoji: true,
            },
            style: 'primary',
            url: `${process.env.NEXT_PUBLIC_APP_URL}/conversation/${variables.conversationId}`,
          },
        ],
      }
    );
    
    return {
      type: 'blocks',
      text: `${emoji} ${title}: ${variables.userName}`,
      blocks,
    };
  }
  
  /**
   * Build coaching insights alert
   */
  buildCoachingAlert(variables: NotificationVariables): Partial<SlackMessage> {
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '💡 Coaching Insights Ready',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `New coaching insights are available for *${variables.userName}*`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Insights:*\n${variables.insightsCount} new recommendations`,
          },
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Insights',
              emoji: true,
            },
            style: 'primary',
            url: `${process.env.NEXT_PUBLIC_APP_URL}/coaching/${variables.userId}`,
          },
        ],
      },
    ];
    
    return {
      type: 'blocks',
      text: `💡 Coaching insights ready for ${variables.userName}`,
      blocks,
    };
  }
  
  /**
   * Build performance alert
   */
  buildPerformanceAlert(
    variables: NotificationVariables,
    alertType: 'top_performer' | 'improvement'
  ): Partial<SlackMessage> {
    const emoji = alertType === 'top_performer' ? '🏆' : '📊';
    const title = alertType === 'top_performer'
      ? 'Top Performer Recognized'
      : 'Improvement Opportunity';
    
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Rep:*\n${variables.userName}`,
          },
          alertType === 'top_performer' && {
            type: 'mrkdwn',
            text: `*Score:*\n${variables.performanceScore}/100`,
          },
          alertType === 'top_performer' && {
            type: 'mrkdwn',
            text: `*Tier:*\n${variables.performanceTier}`,
          },
          alertType === 'improvement' && {
            type: 'mrkdwn',
            text: `*Area:*\n${variables.improvementArea}`,
          },
          alertType === 'improvement' && {
            type: 'mrkdwn',
            text: `*Gap:*\n${variables.skillGap}`,
          },
        ].filter(Boolean) as any[],
      },
      {
        type: 'divider',
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Performance',
              emoji: true,
            },
            style: 'primary',
            url: `${process.env.NEXT_PUBLIC_APP_URL}/performance/${variables.userId}`,
          },
        ],
      },
    ];
    
    return {
      type: 'blocks',
      text: `${emoji} ${title}: ${variables.userName}`,
      blocks,
    };
  }
  
  /**
   * Build playbook alert
   */
  buildPlaybookAlert(variables: NotificationVariables): Partial<SlackMessage> {
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📚 New Playbook Generated',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `A new playbook has been created: *${variables.playbookName}*`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Patterns:*\n${variables.patternsCount} success patterns identified`,
          },
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Playbook',
              emoji: true,
            },
            style: 'primary',
            url: `${process.env.NEXT_PUBLIC_APP_URL}/playbook/${variables.playbookId}`,
          },
        ],
      },
    ];
    
    return {
      type: 'blocks',
      text: `📚 New playbook: ${variables.playbookName}`,
      blocks,
    };
  }
  
  /**
   * Build sequence alert
   */
  buildSequenceAlert(
    variables: NotificationVariables,
    alertType: 'underperforming' | 'optimization'
  ): Partial<SlackMessage> {
    const emoji = alertType === 'underperforming' ? '📉' : '⚡';
    const title = alertType === 'underperforming'
      ? 'Underperforming Sequence'
      : 'Sequence Optimization Available';
    
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Sequence:*\n${variables.sequenceName}`,
          },
          alertType === 'underperforming' && {
            type: 'mrkdwn',
            text: `*Performance:*\n${variables.performanceScore}/100`,
          },
          alertType === 'optimization' && {
            type: 'mrkdwn',
            text: `*Opportunities:*\n${variables.optimizationCount} optimizations`,
          },
        ].filter(Boolean) as any[],
      },
      {
        type: 'divider',
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Analysis',
              emoji: true,
            },
            style: 'primary',
            url: `${process.env.NEXT_PUBLIC_APP_URL}/sequence/${variables.sequenceId}`,
          },
        ],
      },
    ];
    
    return {
      type: 'blocks',
      text: `${emoji} ${title}: ${variables.sequenceName}`,
      blocks,
    };
  }
  
  /**
   * Build lead routing alert
   */
  buildLeadRoutingAlert(variables: NotificationVariables): Partial<SlackMessage> {
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🎯 New Lead Assigned',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `A new lead has been assigned to *${variables.userName}*`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Lead:*\n${variables.leadName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Company:*\n${variables.leadCompany}`,
          },
          {
            type: 'mrkdwn',
            text: `*Match Score:*\n${Math.round((variables.routingScore as number) * 100)}%`,
          },
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Lead',
              emoji: true,
            },
            style: 'primary',
            url: `${process.env.NEXT_PUBLIC_APP_URL}/leads/${variables.leadId}`,
          },
        ],
      },
    ];
    
    return {
      type: 'blocks',
      text: `🎯 New lead assigned to ${variables.userName}: ${variables.leadName}`,
      blocks,
    };
  }
  
  /**
   * Build email writer alert
   */
  buildEmailWriterAlert(variables: NotificationVariables): Partial<SlackMessage> {
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '✉️ AI Email Ready to Send',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Type:*\n${variables.emailType}`,
          },
          {
            type: 'mrkdwn',
            text: `*Deal:*\n${variables.dealName}`,
          },
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Review Email',
              emoji: true,
            },
            style: 'primary',
            url: `${process.env.NEXT_PUBLIC_APP_URL}/email-writer/${variables.emailId}`,
          },
        ],
      },
    ];
    
    return {
      type: 'blocks',
      text: `✉️ AI email ready: ${variables.emailType} for ${variables.dealName}`,
      blocks,
    };
  }
  
  /**
   * Build workflow alert
   */
  buildWorkflowAlert(variables: NotificationVariables): Partial<SlackMessage> {
    const emoji = variables.success ? '✅' : '❌';
    const status = variables.success ? 'Completed' : 'Failed';
    
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} Workflow ${status}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Workflow:*\n${variables.workflowName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Actions:*\n${variables.actionsExecuted} executed`,
          },
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Details',
              emoji: true,
            },
            url: `${process.env.NEXT_PUBLIC_APP_URL}/workflows/${variables.workflowId}`,
          },
        ],
      },
    ];
    
    return {
      type: 'blocks',
      text: `${emoji} Workflow ${status.toLowerCase()}: ${variables.workflowName}`,
      blocks,
    };
  }
  
  /**
   * Build forecasting alert
   */
  buildForecastingAlert(
    variables: NotificationVariables,
    alertType: 'at_risk' | 'achieved'
  ): Partial<SlackMessage> {
    const emoji = alertType === 'at_risk' ? '⚠️' : '🎉';
    const title = alertType === 'at_risk'
      ? 'Quota At Risk'
      : 'Quota Achieved';
    
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Rep:*\n${variables.userName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Quota:*\n$${(variables.quota as number).toLocaleString()}`,
          },
          {
            type: 'mrkdwn',
            text: `*Attainment:*\n${Math.round((variables.attainment as number) * 100)}%`,
          },
          alertType === 'at_risk' && {
            type: 'mrkdwn',
            text: `*Gap:*\n$${(variables.gap as number).toLocaleString()}`,
          },
        ].filter(Boolean) as any[],
      },
      {
        type: 'divider',
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Forecast',
              emoji: true,
            },
            style: alertType === 'at_risk' ? 'danger' : 'primary',
            url: `${process.env.NEXT_PUBLIC_APP_URL}/forecast`,
          },
        ],
      },
    ];
    
    return {
      type: 'blocks',
      text: `${emoji} ${title}: ${variables.userName}`,
      blocks,
    };
  }
}

export default SlackMessageBuilder;
