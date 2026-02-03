/**
 * Recovery Engine - Multi-Channel Siege Orchestrator
 *
 * Triggers Email, SMS, and Voice recovery sequences when leads abandon.
 */
import type { PendingMerchant } from '@/lib/stores/pending-merchants-store';
import { getRecoverySequence, type RecoveryStep } from './recovery-sequences';

export class RecoveryEngine {
  private scheduledJobs: Map<string, NodeJS.Timeout[]> = new Map();

  /**
   * Start multi-channel recovery campaign for abandoned merchant
   */
  startRecoveryCampaign(merchant: PendingMerchant): void {
    // Cancel any existing campaign for this merchant
    this.cancelCampaign(merchant.id);

    const sequence = getRecoverySequence(merchant.stepAbandoned);
    const jobs: NodeJS.Timeout[] = [];

    // console.log(`[RecoveryEngine] Starting ${sequence.name} campaign for ${merchant.email}`);

    for (const step of sequence.steps) {
      const job = setTimeout(() => {
        void this.executeRecoveryStep(merchant, step);
      }, step.delayMs);

      jobs.push(job);
    }

    this.scheduledJobs.set(merchant.id, jobs);
  }

  /**
   * Cancel active recovery campaign
   */
  cancelCampaign(merchantId: string): void {
    const jobs = this.scheduledJobs.get(merchantId);
    if (jobs) {
      jobs.forEach(clearTimeout);
      this.scheduledJobs.delete(merchantId);
      // console.log(`[RecoveryEngine] Cancelled campaign for ${merchantId}`);
    }
  }

  /**
   * Execute a single recovery step
   */
  private async executeRecoveryStep(
    merchant: PendingMerchant,
    step: RecoveryStep
  ): Promise<void> {
    // console.log(`[RecoveryEngine] Executing ${step.channel} step for ${merchant.email}`);

    try {
      switch (step.channel) {
        case 'email':
          await this.sendRecoveryEmail(merchant, step.template);
          break;
        case 'sms':
          await this.sendRecoverySMS(merchant, step.template);
          break;
        case 'voice':
          await this.initiateRecoveryCall(merchant, step.template);
          break;
      }
    } catch (_error) {
      // console.error(`[RecoveryEngine] ${step.channel} step failed:`, error);
    }
  }

  /**
   * Send recovery email
   */
  private async sendRecoveryEmail(merchant: PendingMerchant, template: string): Promise<void> {
    const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/onboarding/industry?recovery=${merchant.id}&source=email_${merchant.emailsSent + 1}`;

    // Dynamic import to avoid circular dependencies
    const { sendEmail } = await import('@/lib/email/email-service');

    const templates = this.getEmailTemplates(merchant, trackingUrl);
    const emailTemplate = templates[template as keyof typeof templates];

    if (!emailTemplate) {
      // console.error(`[RecoveryEngine] Unknown email template: ${template}`);
      return;
    }

    await sendEmail({
      to: merchant.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      from: 'support@rapidcompliance.us',
      fromName: 'Rapid Compliance Team',
      tracking: { trackOpens: true, trackClicks: true },
      metadata: {
        merchantId: merchant.id,
        recoveryAttempt: merchant.emailsSent + 1,
        organizationId: 'platform',
      },
    });

    // console.log(`[RecoveryEngine] Sent ${template} email to ${merchant.email}`);
  }

  /**
   * Send recovery SMS
   */
  private async sendRecoverySMS(merchant: PendingMerchant, template: string): Promise<void> {
    if (!merchant.phoneNumber) {
      // console.warn(`[RecoveryEngine] No phone number for ${merchant.email}`);
      return;
    }

    const shortUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/r/${merchant.id}`;
    const templates = this.getSMSTemplates(merchant, shortUrl);
    const smsTemplate = templates[template as keyof typeof templates];

    if (!smsTemplate) {
      // console.error(`[RecoveryEngine] Unknown SMS template: ${template}`);
      return;
    }

    const { sendSMS } = await import('@/lib/sms/sms-service');

    await sendSMS({
      to: merchant.phoneNumber,
      message: smsTemplate,
      organizationId: 'platform',
      metadata: {
        merchantId: merchant.id,
        recoveryAttempt: merchant.smsSent + 1,
      },
    });

    // console.log(`[RecoveryEngine] Sent ${template} SMS to ${merchant.phoneNumber}`);
  }

  /**
   * Initiate recovery voice call
   */
  private async initiateRecoveryCall(merchant: PendingMerchant, template: string): Promise<void> {
    if (!merchant.phoneNumber) {
      // console.warn(`[RecoveryEngine] No phone number for voice call to ${merchant.email}`);
      return;
    }

    const scripts = this.getVoiceScripts(merchant);
    const script = scripts[template as keyof typeof scripts];

    if (!script) {
      // console.error(`[RecoveryEngine] Unknown voice template: ${template}`);
      return;
    }

    try {
      const { initiateCall } = await import('@/lib/voice/twilio-service');

      // Use platform org ID and recovery agent for outbound calls
      await initiateCall(
        'platform',
        merchant.phoneNumber,
        `recovery-${template}`,
        { record: true, timeout: 45 }
      );

      // console.log(`[RecoveryEngine] Initiated ${template} call to ${merchant.phoneNumber}`);
    } catch (_error) {
      // console.error(`[RecoveryEngine] Voice call failed:`, error);
    }
  }

  /**
   * Email templates with glassmorphism design
   */
  private getEmailTemplates(merchant: PendingMerchant, trackingUrl: string) {
    const firstName = merchant.fullName.split(' ')[0];

    return {
      welcome_back_soft: {
        subject: `${firstName}, let's get your AI sales agent set up`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 40px; }
    .header { color: #fff; font-size: 24px; margin-bottom: 20px; }
    .content { color: #e0e0e0; line-height: 1.8; }
    .cta { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; padding: 16px 32px; border-radius: 12px; text-decoration: none; margin-top: 24px; font-weight: 600; }
    .footer { margin-top: 32px; font-size: 14px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">Hi ${firstName},</div>
    <div class="content">
      <p>We noticed you started setting up your AI sales agent${merchant.industryName ? ` for ${merchant.industryName}` : ''}, but didn't quite finish.</p>
      <p>No worries! We saved your progress. You're just <strong>2 minutes away</strong> from having a 24/7 AI sales rep working for you.</p>
      <a href="${trackingUrl}" class="cta">Continue Setup &rarr;</a>
      <p class="footer">Still have 1,000 free records waiting for you.</p>
    </div>
  </div>
</body>
</html>`,
      },

      industry_guide: {
        subject: `${firstName}, your ${merchant.industryName ?? 'industry'} AI toolkit is ready`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 40px; }
    .header { color: #fff; font-size: 24px; margin-bottom: 20px; }
    .content { color: #e0e0e0; line-height: 1.8; }
    .feature { background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 8px; padding: 16px; margin: 12px 0; }
    .feature-title { color: #818cf8; font-weight: 600; margin-bottom: 4px; }
    .cta { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; padding: 16px 32px; border-radius: 12px; text-decoration: none; margin-top: 24px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">${firstName}, check out what's waiting for you</div>
    <div class="content">
      <p>Your personalized ${merchant.industryName ?? 'AI'} toolkit includes:</p>
      <div class="feature">
        <div class="feature-title">🎯 Lead Hunter</div>
        <div>Find qualified prospects automatically</div>
      </div>
      <div class="feature">
        <div class="feature-title">✍️ Content Factory</div>
        <div>Generate posts, emails, and videos</div>
      </div>
      <div class="feature">
        <div class="feature-title">📊 Analytics Dashboard</div>
        <div>Track performance in real-time</div>
      </div>
      <a href="${trackingUrl}" class="cta">Activate My Toolkit &rarr;</a>
    </div>
  </div>
</body>
</html>`,
      },

      account_reminder: {
        subject: `${firstName}, your account is almost ready`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 40px; }
    .header { color: #fff; font-size: 24px; margin-bottom: 20px; }
    .content { color: #e0e0e0; line-height: 1.8; }
    .progress { background: rgba(0,0,0,0.3); border-radius: 8px; height: 8px; margin: 20px 0; overflow: hidden; }
    .progress-bar { background: linear-gradient(90deg, #667eea, #764ba2); height: 100%; width: 66%; border-radius: 8px; }
    .cta { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; padding: 16px 32px; border-radius: 12px; text-decoration: none; margin-top: 24px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">${firstName}, you're 66% done!</div>
    <div class="content">
      <div class="progress"><div class="progress-bar"></div></div>
      <p>Just one more step to complete your account setup and unlock your AI sales workforce.</p>
      <p>Remember: <strong>No credit card required</strong> for your 14-day trial.</p>
      <a href="${trackingUrl}" class="cta">Complete Setup &rarr;</a>
    </div>
  </div>
</body>
</html>`,
      },

      come_back: {
        subject: `${firstName}, we miss you!`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 40px; }
    .header { color: #fff; font-size: 24px; margin-bottom: 20px; }
    .content { color: #e0e0e0; line-height: 1.8; }
    .cta { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; padding: 16px 32px; border-radius: 12px; text-decoration: none; margin-top: 24px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">Hey ${firstName} 👋</div>
    <div class="content">
      <p>Your AI sales workforce is still waiting for you!</p>
      <p>We saved everything where you left off. Pick up in seconds and start generating leads today.</p>
      <a href="${trackingUrl}" class="cta">Let's Go &rarr;</a>
    </div>
  </div>
</body>
</html>`,
      },

      value_reminder: {
        subject: `${firstName}, here's what you're missing`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 40px; }
    .header { color: #fff; font-size: 24px; margin-bottom: 20px; }
    .content { color: #e0e0e0; line-height: 1.8; }
    .stat { display: inline-block; text-align: center; padding: 20px; background: rgba(99, 102, 241, 0.1); border-radius: 12px; margin: 8px; }
    .stat-value { font-size: 32px; font-weight: bold; color: #818cf8; }
    .stat-label { font-size: 12px; color: #999; }
    .cta { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; padding: 16px 32px; border-radius: 12px; text-decoration: none; margin-top: 24px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">What our users achieve</div>
    <div class="content">
      <div style="text-align: center;">
        <div class="stat"><div class="stat-value">47%</div><div class="stat-label">More Leads</div></div>
        <div class="stat"><div class="stat-value">3x</div><div class="stat-label">Faster Outreach</div></div>
        <div class="stat"><div class="stat-value">24/7</div><div class="stat-label">AI Working</div></div>
      </div>
      <p style="margin-top: 24px;">Join thousands of businesses using AI to supercharge their sales.</p>
      <a href="${trackingUrl}" class="cta">Start Free Trial &rarr;</a>
    </div>
  </div>
</body>
</html>`,
      },
    };
  }

  /**
   * SMS templates (160 char limit)
   */
  private getSMSTemplates(merchant: PendingMerchant, shortUrl: string) {
    const firstName = merchant.fullName.split(' ')[0];

    return {
      quick_setup: `Hi ${firstName}! Your AI sales agent is 90% ready. Finish in 2 min: ${shortUrl} - Rapid Compliance`,
      finish_signup: `${firstName}, complete your signup to get 1,000 free records + 14-day trial: ${shortUrl}`,
      personal_reach: `${firstName}, quick question - was there something that stopped you from finishing your setup? Reply or click: ${shortUrl}`,
      final_offer: `Last chance ${firstName}! Your reserved spot expires soon. Get your AI sales team now: ${shortUrl}`,
    };
  }

  /**
   * Voice call scripts
   */
  private getVoiceScripts(merchant: PendingMerchant) {
    const firstName = merchant.fullName.split(' ')[0];

    return {
      personal_assist: `
Hi ${firstName}, this is the Rapid Compliance team calling.

We noticed you started setting up your AI sales agent ${merchant.industryName ? `for ${merchant.industryName}` : ''} but didn't complete the signup.

I wanted to personally reach out and see if you had any questions or if there's anything I can help you with to get your account set up.

We've saved your progress, and you're literally 2 minutes away from having a 24/7 AI sales rep working for you.

Would you like me to walk you through the rest of the setup right now?
      `.trim(),

      final_offer: `
Hi ${firstName}, this is a quick call from Rapid Compliance.

I see your trial reservation is about to expire. Before it does, I wanted to make sure you didn't have any questions holding you back.

Is there anything specific about the platform you'd like me to explain?
      `.trim(),
    };
  }
}

// Singleton instance
let recoveryEngineInstance: RecoveryEngine | null = null;

export function getRecoveryEngine(): RecoveryEngine {
  recoveryEngineInstance ??= new RecoveryEngine();
  return recoveryEngineInstance;
}
