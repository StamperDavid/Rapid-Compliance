/**
 * Notification Templates
 * 
 * Pre-built notification templates for all AI features.
 * These templates define how notifications are formatted across all channels.
 * 
 * Templates use {{variable}} syntax for dynamic content interpolation.
 * 
 * Note: Using type assertions to avoid TypeScript build timeouts
 */

import { Timestamp } from 'firebase/firestore';
import type { NotificationTemplate } from './types';

/**
 * Get all notification templates
 */
export function getAllTemplates(): NotificationTemplate[] {
  const now = Timestamp.now();
  const templates: NotificationTemplate[] = [
    // Deal Risk Templates
    {
      id: 'deal_risk_critical',
      name: 'Critical Deal Risk Alert',
      category: 'deal_risk',
      signalTypes: ['deal.risk.critical'],
      priority: 'critical',
      channels: ['slack', 'in_app'],
      slack: {
        text: '🚨 *CRITICAL RISK*: {{dealName}} ({{dealValue}}) is at high risk of slipping',
      },
      inApp: {
        title: '🚨 Critical Deal Risk',
        body: '{{dealName}} ({{dealValue}}) is at {{riskProbability}}% risk of slipping',
        icon: '🚨',
        actionUrl: '/deals/{{dealId}}',
      },
      metadata: {
        description: 'Alerts when a deal enters critical risk status',
        requiredVariables: ['dealId', 'dealName', 'dealValue', 'riskLevel', 'riskProbability'],
        optionalVariables: ['interventions', 'riskFactors'],
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      },
    },
    {
      id: 'deal_risk_high',
      name: 'High Deal Risk Alert',
      category: 'deal_risk',
      signalTypes: ['deal.risk.high'],
      priority: 'high',
      channels: ['slack', 'in_app'],
      slack: {
        text: '⚠️ Deal at risk: {{dealName}} requires attention',
      },
      inApp: {
        title: '⚠️ Deal Risk Alert',
        body: '{{dealName}} requires attention ({{riskProbability}}% risk)',
        icon: '⚠️',
        actionUrl: '/deals/{{dealId}}',
      },
      metadata: {
        description: 'Alerts when a deal enters high risk status',
        requiredVariables: ['dealId', 'dealName', 'riskLevel', 'riskProbability'],
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      },
    },
    
    // Conversation Intelligence Templates
    {
      id: 'conversation_low_score',
      name: 'Low Conversation Quality',
      category: 'conversation',
      signalTypes: ['conversation.low_score'],
      priority: 'high',
      channels: ['slack', 'in_app'],
      slack: {
        text: '📉 {{repName}}\'s call scored {{score}}/100 - coaching needed',
      },
      inApp: {
        title: '📉 Coaching Opportunity',
        body: 'Call scored {{score}}/100 - review coaching insights',
        actionUrl: '/conversations/{{conversationId}}',
      },
      metadata: {
        description: 'Notifies when a conversation quality is below threshold',
        requiredVariables: ['conversationId', 'repName', 'score'],
        optionalVariables: ['issues', 'coaching'],
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      },
    },
    {
      id: 'conversation_red_flag',
      name: 'Conversation Red Flag',
      category: 'conversation',
      signalTypes: ['conversation.red_flag'],
      priority: 'critical',
      channels: ['slack', 'in_app'],
      slack: {
        text: '🚩 RED FLAG: {{redFlagType}} detected in {{repName}}\'s call',
      },
      inApp: {
        title: '🚩 Red Flag Detected',
        body: '{{redFlagType}} in conversation - {{severity}} severity',
        icon: '🚩',
        actionUrl: '/conversations/{{conversationId}}',
      },
      metadata: {
        description: 'Critical alert for conversation red flags',
        requiredVariables: ['conversationId', 'repName', 'redFlagType', 'severity', 'description'],
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      },
    },
    {
      id: 'competitor_mentioned',
      name: 'Competitor Mentioned',
      category: 'conversation',
      signalTypes: ['conversation.competitor_mentioned'],
      priority: 'high',
      channels: ['slack', 'in_app'],
      slack: {
        text: '⚔️ Competitor Alert: {{competitorName}} mentioned with {{sentiment}} sentiment',
      },
      inApp: {
        title: '⚔️ Competitor Alert',
        body: '{{competitorName}} mentioned - battlecard available',
        actionUrl: '/battlecards/{{battlecardId}}',
      },
      metadata: {
        description: 'Alerts when a competitor is mentioned in a conversation',
        requiredVariables: ['conversationId', 'competitorName', 'sentiment', 'concernLevel'],
        optionalVariables: ['battlecardId'],
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      },
    },
    {
      id: 'buying_signal_detected',
      name: 'Buying Signal Detected',
      category: 'conversation',
      signalTypes: ['conversation.positive_signal'],
      priority: 'high',
      channels: ['slack', 'in_app'],
      slack: {
        text: '✅ Buying signal detected: {{signalType}}',
      },
      inApp: {
        title: '✅ Buying Signal',
        body: '{{signalType}} detected - take action now',
        icon: '✅',
        actionUrl: '/conversations/{{conversationId}}',
      },
      metadata: {
        description: 'Alerts when a positive buying signal is detected',
        requiredVariables: ['conversationId', 'signalType', 'description'],
        optionalVariables: ['nextSteps'],
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      },
    },
    
    // Coaching Templates
    {
      id: 'coaching_insights_ready',
      name: 'Coaching Insights Ready',
      category: 'coaching',
      signalTypes: ['coaching.insights.generated'],
      priority: 'medium',
      channels: ['slack', 'in_app'],
      slack: {
        text: '📊 Your personalized coaching insights are ready, {{repName}}',
      },
      inApp: {
        title: '📊 Coaching Insights Ready',
        body: 'View your personalized performance insights',
        actionUrl: '/coaching',
      },
      metadata: {
        description: 'Notifies when new coaching insights are generated',
        requiredVariables: ['repName', 'performanceTier'],
        optionalVariables: ['strengths', 'weaknesses', 'recommendations'],
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      },
    },
    
    // Performance Analytics Templates
    {
      id: 'top_performer_recognition',
      name: 'Top Performer Recognition',
      category: 'team_performance',
      signalTypes: ['performance.top_performer_identified'],
      priority: 'low',
      channels: ['slack', 'in_app'],
      slack: {
        text: '🏆 Congrats {{repName}}! You\'re ranked #{{rank}} this period',
      },
      inApp: {
        title: '🏆 Top Performer',
        body: 'You\'re ranked #{{rank}} - keep up the great work!',
        icon: '🏆',
      },
      metadata: {
        description: 'Celebrates top performers',
        requiredVariables: ['repName', 'rank'],
        optionalVariables: ['strengths'],
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      },
    },
    {
      id: 'improvement_opportunity',
      name: 'Improvement Opportunity',
      category: 'team_performance',
      signalTypes: ['performance.improvement_opportunity'],
      priority: 'medium',
      channels: ['slack', 'in_app'],
      slack: {
        text: '📈 Opportunity to improve {{skillArea}} - current score: {{currentScore}}',
      },
      inApp: {
        title: '📈 Improvement Opportunity',
        body: 'Focus on {{skillArea}} to reach your target',
        actionUrl: '/coaching',
      },
      metadata: {
        description: 'Highlights improvement opportunities',
        requiredVariables: ['skillArea', 'currentScore', 'targetScore'],
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      },
    },
    
    // Playbook Builder Templates
    {
      id: 'playbook_ready',
      name: 'Playbook Ready',
      category: 'playbook',
      signalTypes: ['playbook.generated'],
      priority: 'medium',
      channels: ['slack', 'in_app'],
      slack: {
        text: '📚 New playbook ready: {{playbookName}} ({{patternCount}} patterns, {{talkTrackCount}} talk tracks)',
      },
      inApp: {
        title: '📚 Playbook Ready',
        body: '{{playbookName}} is ready to use',
        actionUrl: '/playbooks',
      },
      metadata: {
        description: 'Notifies when a new playbook is generated',
        requiredVariables: ['playbookName', 'patternCount', 'talkTrackCount'],
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      },
    },
    {
      id: 'success_pattern_found',
      name: 'Success Pattern Found',
      category: 'playbook',
      signalTypes: ['playbook.pattern_identified'],
      priority: 'low',
      channels: ['slack', 'in_app'],
      slack: {
        text: '🎯 Success pattern identified: {{patternType}} ({{successRate}}% success rate)',
      },
      inApp: {
        title: '🎯 Success Pattern',
        body: 'New winning pattern: {{patternType}}',
        actionUrl: '/playbooks',
      },
      metadata: {
        description: 'Alerts when a new success pattern is identified',
        requiredVariables: ['patternType', 'successRate', 'description'],
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      },
    },
    
    // Sequence Intelligence Templates
    {
      id: 'sequence_underperforming',
      name: 'Sequence Underperforming',
      category: 'sequence',
      signalTypes: ['sequence.underperforming'],
      priority: 'high',
      channels: ['slack', 'in_app'],
      slack: {
        text: '📉 Sequence alert: {{sequenceName}} is {{replyRate}}% below baseline',
      },
      inApp: {
        title: '📉 Sequence Alert',
        body: '{{sequenceName}} needs optimization',
        actionUrl: '/sequences/{{sequenceId}}',
      },
      metadata: {
        description: 'Alerts when a sequence performs below baseline',
        requiredVariables: ['sequenceId', 'sequenceName', 'replyRate', 'baselineReplyRate'],
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      },
    },
    {
      id: 'optimization_opportunity',
      name: 'Optimization Opportunity',
      category: 'sequence',
      signalTypes: ['sequence.optimization_needed'],
      priority: 'medium',
      channels: ['slack', 'in_app'],
      slack: {
        text: '💡 Quick win: Optimize {{sequenceName}} for {{potentialLift}}% lift ({{effort}} effort)',
      },
      inApp: {
        title: '💡 Quick Win',
        body: '{{optimizationType}} optimization available',
        actionUrl: '/sequences/{{sequenceId}}',
      },
      metadata: {
        description: 'Suggests sequence optimizations',
        requiredVariables: ['sequenceId', 'sequenceName', 'optimizationType', 'potentialLift', 'effort'],
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      },
    },
    
    // Lead Routing Templates
    {
      id: 'lead_assigned',
      name: 'Lead Assigned',
      category: 'lead_routing',
      signalTypes: ['lead.routed'],
      priority: 'high',
      channels: ['slack', 'in_app'],
      slack: {
        text: '🎯 New lead assigned: {{leadName}} from {{leadCompany}} (Quality: {{qualityScore}}/100)',
      },
      inApp: {
        title: '🎯 New Lead',
        body: '{{leadName}} from {{leadCompany}}',
        actionUrl: '/leads/{{leadId}}',
      },
      metadata: {
        description: 'Notifies when a lead is routed to a rep',
        requiredVariables: ['leadId', 'leadName', 'leadCompany', 'qualityScore', 'strategy'],
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      },
    },
    
    // Email Writer Templates
    {
      id: 'email_ready_to_send',
      name: 'Email Ready to Send',
      category: 'email_writer',
      signalTypes: ['email.generated'],
      priority: 'medium',
      channels: ['slack', 'in_app'],
      slack: {
        text: '✉️ AI-generated {{emailType}} email ready to review',
      },
      inApp: {
        title: '✉️ Email Ready',
        body: '{{emailType}} email ready to send',
        actionUrl: '/emails/{{emailId}}',
      },
      metadata: {
        description: 'Notifies when an AI email is generated',
        requiredVariables: ['emailId', 'emailType'],
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      },
    },
    
    // Workflow Automation Templates
    {
      id: 'workflow_executed',
      name: 'Workflow Executed',
      category: 'workflow',
      signalTypes: ['workflow.executed'],
      priority: 'low',
      channels: ['in_app'],
      inApp: {
        title: '⚙️ Workflow Executed',
        body: '{{workflowName}} completed {{actionsExecuted}} actions',
        icon: '⚙️',
      },
      metadata: {
        description: 'Confirms workflow execution',
        requiredVariables: ['workflowName', 'actionsExecuted', 'success'],
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      },
    },
    
    // Forecasting Templates
    {
      id: 'quota_at_risk',
      name: 'Quota At Risk',
      category: 'forecasting',
      signalTypes: ['quota.at_risk'],
      priority: 'critical',
      channels: ['slack', 'in_app'],
      slack: {
        // eslint-disable-next-line no-template-curly-in-string -- Template string placeholders for variable interpolation
        text: '🚨 QUOTA AT RISK: {{period}} - ${{gap}} gap ({{attainmentProbability}}% probability)',
      },
      inApp: {
        title: '🚨 Quota At Risk',
        // eslint-disable-next-line no-template-curly-in-string -- Template string placeholders for variable interpolation
        body: '${{gap}} gap - {{attainmentProbability}}% probability',
        icon: '🚨',
        actionUrl: '/forecasting',
      },
      metadata: {
        description: 'Critical alert when quota attainment is at risk',
        requiredVariables: ['period', 'quota', 'forecast', 'gap', 'attainmentProbability'],
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      },
    },
    {
      id: 'quota_achieved_celebration',
      name: 'Quota Achieved',
      category: 'forecasting',
      signalTypes: ['quota.achieved'],
      priority: 'low',
      channels: ['slack', 'in_app'],
      slack: {
        text: '🎉 QUOTA ACHIEVED! {{period}} - {{attainment}}% attainment',
      },
      inApp: {
        title: '🎉 Quota Achieved!',
        body: '{{period}} - {{attainment}}% attainment',
        icon: '🎉',
      },
      metadata: {
        description: 'Celebrates quota achievement',
        requiredVariables: ['period', 'quota', 'actual', 'attainment'],
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      },
    },
  ];
  
  return templates;
}
