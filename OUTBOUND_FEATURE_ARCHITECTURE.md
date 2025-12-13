# 🎛️ OUTBOUND FEATURES - Modular Architecture & Subscription Tiers

**Design Principle**: Every outbound feature is optional, configurable, and gated by subscription tier

---

## 📦 SUBSCRIPTION TIERS & FEATURES

### **Starter Plan - $99/mo**
**Target**: Small businesses, solopreneurs  
**Outbound Limits**: Basic automation

| Feature | Limit | Status |
|---------|-------|--------|
| **Core Platform** | | |
| AI Chat Agent | Unlimited conversations | ✅ Included |
| CRM | 1,000 contacts | ✅ Included |
| E-commerce | Basic | ✅ Included |
| Workflows | 10 active | ✅ Included |
| **Outbound Features** | | |
| AI Email Writer | 50 emails/month | ⚙️ Optional Add-on |
| Email Sequences | 1 active sequence, 100 prospects | ⚙️ Optional Add-on |
| Email Reply Handler | ❌ Not available | - |
| Meeting Scheduler | Manual only (Calendly link) | ✅ Included |
| Prospect Finder | ❌ Not available | - |
| Multi-Channel | Email only | ⚙️ Optional Add-on |
| A/B Testing | ❌ Not available | - |

**Add-on**: Basic Outbound (+$49/mo) - Unlocks email writer + sequences

---

### **Professional Plan - $299/mo**
**Target**: Growing sales teams (2-10 reps)  
**Outbound Limits**: Full automation for small team

| Feature | Limit | Status |
|---------|-------|--------|
| **Core Platform** | | |
| AI Chat Agent | Unlimited | ✅ Included |
| CRM | 10,000 contacts | ✅ Included |
| E-commerce | Advanced | ✅ Included |
| Workflows | 50 active | ✅ Included |
| **Outbound Features** | | |
| AI Email Writer | 500 emails/month | ✅ Included |
| Email Sequences | 5 active sequences, 1,000 prospects | ✅ Included |
| Email Reply Handler | Basic (requires approval) | ✅ Included |
| Meeting Scheduler | Automated | ✅ Included |
| Prospect Finder | 100 prospects/month | ⚙️ Optional Add-on |
| Multi-Channel | Email + LinkedIn (100 actions/mo) | ⚙️ Optional Add-on |
| A/B Testing | 3 concurrent tests | ✅ Included |

**Add-on**: Advanced Outbound (+$199/mo) - Unlocks prospect finder + multi-channel

---

### **Enterprise Plan - $999/mo**
**Target**: Large sales teams (10+ reps)  
**Outbound Limits**: Unlimited automation

| Feature | Limit | Status |
|---------|-------|--------|
| **Core Platform** | | |
| AI Chat Agent | Unlimited | ✅ Included |
| CRM | Unlimited contacts | ✅ Included |
| E-commerce | Enterprise | ✅ Included |
| Workflows | Unlimited | ✅ Included |
| **Outbound Features** | | |
| AI Email Writer | 5,000 emails/month | ✅ Included |
| Email Sequences | Unlimited sequences, 10,000 prospects | ✅ Included |
| Email Reply Handler | Fully autonomous | ✅ Included |
| Meeting Scheduler | Automated + Smart routing | ✅ Included |
| Prospect Finder | 1,000 prospects/month | ✅ Included |
| Multi-Channel | Email + LinkedIn + SMS (unlimited) | ✅ Included |
| A/B Testing | Unlimited concurrent tests | ✅ Included |
| Dedicated AI Model | Custom fine-tuned model | ✅ Included |
| White-glove Onboarding | Sequence setup, ICP definition | ✅ Included |

---

## 🎛️ FEATURE TOGGLE SYSTEM

### Database Schema: Organization Features

```typescript
// src/types/subscription.ts

export interface OrganizationSubscription {
  organizationId: string;
  plan: 'starter' | 'professional' | 'enterprise' | 'custom';
  billingCycle: 'monthly' | 'yearly';
  status: 'active' | 'trial' | 'past_due' | 'canceled';
  
  // Core features (always enabled)
  coreFeatures: {
    aiChatAgent: boolean;
    crm: boolean;
    ecommerce: boolean;
    workflows: boolean;
  };
  
  // Outbound features (configurable)
  outboundFeatures: {
    aiEmailWriter: {
      enabled: boolean;
      monthlyLimit: number; // emails per month
      used: number; // current month usage
      resetDate: Date;
    };
    emailSequences: {
      enabled: boolean;
      maxActiveSequences: number;
      maxProspectsPerSequence: number;
      currentSequences: number;
      currentProspects: number;
    };
    emailReplyHandler: {
      enabled: boolean;
      autonomousMode: boolean; // true = auto-send, false = approval required
      confidenceThreshold: number; // 0-100, only auto-send if AI confidence > threshold
    };
    meetingScheduler: {
      enabled: boolean;
      automated: boolean; // true = AI handles, false = manual Calendly
      smartRouting: boolean; // route to best rep based on criteria
    };
    prospectFinder: {
      enabled: boolean;
      monthlyLimit: number;
      used: number;
      resetDate: Date;
      enabledSources: ('apollo' | 'linkedin' | 'zoominfo' | 'clearbit')[];
    };
    multiChannel: {
      enabled: boolean;
      channels: {
        email: { enabled: boolean; monthlyLimit: number; used: number };
        linkedin: { enabled: boolean; monthlyLimit: number; used: number };
        sms: { enabled: boolean; monthlyLimit: number; used: number };
      };
    };
    abTesting: {
      enabled: boolean;
      maxConcurrentTests: number;
    };
  };
  
  // Add-ons
  addOns: {
    id: string;
    name: string;
    price: number;
    features: string[];
  }[];
  
  // Usage tracking
  usage: {
    emailsSent: number;
    linkedinActions: number;
    smsSent: number;
    prospectsFilled: number;
    aiTokensUsed: number;
  };
  
  // Billing
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  nextBillingDate: Date;
  totalMRR: number;
}
```

---

## 🔒 FEATURE GATE SERVICE

### Implementation

**File**: `src/lib/subscription/feature-gate.ts`

```typescript
import { OrganizationSubscription } from '@/types/subscription';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

export class FeatureGate {
  /**
   * Check if organization has access to a feature
   */
  static async hasFeature(
    orgId: string,
    feature: keyof OrganizationSubscription['outboundFeatures']
  ): Promise<boolean> {
    const subscription = await this.getSubscription(orgId);
    return subscription.outboundFeatures[feature]?.enabled || false;
  }

  /**
   * Check if organization has reached usage limit
   */
  static async checkLimit(
    orgId: string,
    feature: 'aiEmailWriter' | 'prospectFinder' | 'linkedin' | 'sms',
    requestedAmount: number = 1
  ): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const subscription = await this.getSubscription(orgId);
    
    let used = 0;
    let limit = 0;
    
    switch (feature) {
      case 'aiEmailWriter':
        used = subscription.outboundFeatures.aiEmailWriter.used;
        limit = subscription.outboundFeatures.aiEmailWriter.monthlyLimit;
        break;
      case 'prospectFinder':
        used = subscription.outboundFeatures.prospectFinder.used;
        limit = subscription.outboundFeatures.prospectFinder.monthlyLimit;
        break;
      case 'linkedin':
        used = subscription.outboundFeatures.multiChannel.channels.linkedin.used;
        limit = subscription.outboundFeatures.multiChannel.channels.linkedin.monthlyLimit;
        break;
      case 'sms':
        used = subscription.outboundFeatures.multiChannel.channels.sms.used;
        limit = subscription.outboundFeatures.multiChannel.channels.sms.monthlyLimit;
        break;
    }
    
    const remaining = Math.max(0, limit - used);
    const allowed = remaining >= requestedAmount;
    
    return { allowed, remaining, limit };
  }

  /**
   * Increment usage counter
   */
  static async incrementUsage(
    orgId: string,
    feature: 'aiEmailWriter' | 'prospectFinder' | 'linkedin' | 'sms',
    amount: number = 1
  ): Promise<void> {
    const subscription = await this.getSubscription(orgId);
    
    // Update usage counters
    switch (feature) {
      case 'aiEmailWriter':
        subscription.outboundFeatures.aiEmailWriter.used += amount;
        subscription.usage.emailsSent += amount;
        break;
      case 'prospectFinder':
        subscription.outboundFeatures.prospectFinder.used += amount;
        subscription.usage.prospectsFilled += amount;
        break;
      case 'linkedin':
        subscription.outboundFeatures.multiChannel.channels.linkedin.used += amount;
        subscription.usage.linkedinActions += amount;
        break;
      case 'sms':
        subscription.outboundFeatures.multiChannel.channels.sms.used += amount;
        subscription.usage.smsSent += amount;
        break;
    }
    
    await this.saveSubscription(orgId, subscription);
  }

  /**
   * Get subscription for organization
   */
  private static async getSubscription(orgId: string): Promise<OrganizationSubscription> {
    const sub = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/subscription`,
      'current'
    );
    return sub as OrganizationSubscription;
  }

  /**
   * Save subscription
   */
  private static async saveSubscription(
    orgId: string,
    subscription: OrganizationSubscription
  ): Promise<void> {
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/subscription`,
      'current',
      subscription
    );
  }

  /**
   * Reset monthly limits (run on 1st of month)
   */
  static async resetMonthlyLimits(orgId: string): Promise<void> {
    const subscription = await this.getSubscription(orgId);
    
    // Reset email writer
    subscription.outboundFeatures.aiEmailWriter.used = 0;
    subscription.outboundFeatures.aiEmailWriter.resetDate = new Date();
    
    // Reset prospect finder
    subscription.outboundFeatures.prospectFinder.used = 0;
    subscription.outboundFeatures.prospectFinder.resetDate = new Date();
    
    // Reset multi-channel
    subscription.outboundFeatures.multiChannel.channels.email.used = 0;
    subscription.outboundFeatures.multiChannel.channels.linkedin.used = 0;
    subscription.outboundFeatures.multiChannel.channels.sms.used = 0;
    
    await this.saveSubscription(orgId, subscription);
  }
}
```

---

## 🎨 UI FEATURE GATING

### Workspace Settings - Outbound Configuration

**File**: `src/app/workspace/[orgId]/settings/outbound/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { FeatureGate } from '@/lib/subscription/feature-gate';
import { useParams } from 'next/navigation';

export default function OutboundSettingsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscription();
  }, [orgId]);

  const loadSubscription = async () => {
    const response = await fetch(`/api/subscription?orgId=${orgId}`);
    const data = await response.json();
    setSubscription(data);
    setLoading(false);
  };

  const toggleFeature = async (feature: string) => {
    // Save toggle state
    await fetch('/api/subscription/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, feature })
    });
    loadSubscription();
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Outbound Features</h1>
      
      {/* Current Plan */}
      <div className="bg-gray-800 p-6 rounded-lg mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold capitalize">{subscription.plan} Plan</h2>
            <p className="text-gray-400">${subscription.totalMRR}/month</p>
          </div>
          <button className="px-4 py-2 bg-blue-600 rounded-lg">
            Upgrade Plan
          </button>
        </div>
      </div>

      {/* Feature Toggles */}
      <div className="space-y-6">
        {/* AI Email Writer */}
        <FeatureCard
          title="AI Email Writer"
          description="Generate personalized cold emails using AI"
          enabled={subscription.outboundFeatures.aiEmailWriter.enabled}
          available={subscription.plan !== 'starter'}
          usage={`${subscription.outboundFeatures.aiEmailWriter.used} / ${subscription.outboundFeatures.aiEmailWriter.monthlyLimit} emails this month`}
          onToggle={() => toggleFeature('aiEmailWriter')}
          upgradeRequired={subscription.plan === 'starter'}
        />

        {/* Email Sequences */}
        <FeatureCard
          title="Email Sequences"
          description="Automated multi-step email campaigns"
          enabled={subscription.outboundFeatures.emailSequences.enabled}
          available={subscription.plan !== 'starter'}
          usage={`${subscription.outboundFeatures.emailSequences.currentSequences} / ${subscription.outboundFeatures.emailSequences.maxActiveSequences} sequences active`}
          onToggle={() => toggleFeature('emailSequences')}
          upgradeRequired={subscription.plan === 'starter'}
        />

        {/* Email Reply Handler */}
        <FeatureCard
          title="AI Reply Handler"
          description="Automatically respond to prospect emails"
          enabled={subscription.outboundFeatures.emailReplyHandler.enabled}
          available={subscription.plan !== 'starter'}
          autonomousMode={subscription.outboundFeatures.emailReplyHandler.autonomousMode}
          onToggle={() => toggleFeature('emailReplyHandler')}
          upgradeRequired={subscription.plan === 'starter'}
        >
          {subscription.outboundFeatures.emailReplyHandler.enabled && (
            <div className="mt-4 p-4 bg-gray-700 rounded">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={subscription.outboundFeatures.emailReplyHandler.autonomousMode}
                  onChange={(e) => updateReplyMode(e.target.checked)}
                  className="mr-2"
                />
                <span>Autonomous Mode (auto-send without approval)</span>
              </label>
              <p className="text-xs text-gray-400 mt-2">
                Only sends when AI confidence &gt; {subscription.outboundFeatures.emailReplyHandler.confidenceThreshold}%
              </p>
            </div>
          )}
        </FeatureCard>

        {/* Prospect Finder */}
        <FeatureCard
          title="Prospect Finder"
          description="Find and enrich prospects automatically"
          enabled={subscription.outboundFeatures.prospectFinder.enabled}
          available={subscription.plan === 'enterprise'}
          usage={`${subscription.outboundFeatures.prospectFinder.used} / ${subscription.outboundFeatures.prospectFinder.monthlyLimit} prospects this month`}
          onToggle={() => toggleFeature('prospectFinder')}
          upgradeRequired={subscription.plan !== 'enterprise'}
        />

        {/* Multi-Channel */}
        <FeatureCard
          title="Multi-Channel Outreach"
          description="LinkedIn + SMS + Email sequences"
          enabled={subscription.outboundFeatures.multiChannel.enabled}
          available={subscription.plan === 'enterprise'}
          onToggle={() => toggleFeature('multiChannel')}
          upgradeRequired={subscription.plan !== 'enterprise'}
        >
          {subscription.outboundFeatures.multiChannel.enabled && (
            <div className="mt-4 space-y-2">
              <ChannelToggle
                name="LinkedIn"
                enabled={subscription.outboundFeatures.multiChannel.channels.linkedin.enabled}
                usage={`${subscription.outboundFeatures.multiChannel.channels.linkedin.used} / ${subscription.outboundFeatures.multiChannel.channels.linkedin.monthlyLimit} actions`}
                onChange={(enabled) => toggleChannel('linkedin', enabled)}
              />
              <ChannelToggle
                name="SMS"
                enabled={subscription.outboundFeatures.multiChannel.channels.sms.enabled}
                usage={`${subscription.outboundFeatures.multiChannel.channels.sms.used} / ${subscription.outboundFeatures.multiChannel.channels.sms.monthlyLimit} messages`}
                onChange={(enabled) => toggleChannel('sms', enabled)}
              />
            </div>
          )}
        </FeatureCard>
      </div>

      {/* Usage Summary */}
      <div className="mt-8 bg-gray-800 p-6 rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Usage This Month</h2>
        <div className="grid grid-cols-2 gap-4">
          <UsageMetric label="Emails Sent" value={subscription.usage.emailsSent} />
          <UsageMetric label="LinkedIn Actions" value={subscription.usage.linkedinActions} />
          <UsageMetric label="SMS Sent" value={subscription.usage.smsSent} />
          <UsageMetric label="Prospects Found" value={subscription.usage.prospectsFilled} />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, description, enabled, available, usage, onToggle, upgradeRequired, children, autonomousMode }: any) {
  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">{title}</h3>
            {autonomousMode && <span className="text-xs bg-yellow-600 px-2 py-1 rounded">AUTONOMOUS</span>}
          </div>
          <p className="text-gray-400 text-sm mt-1">{description}</p>
          {usage && <p className="text-gray-500 text-xs mt-2">{usage}</p>}
        </div>
        
        {upgradeRequired ? (
          <button className="px-4 py-2 bg-blue-600 rounded-lg text-sm">
            Upgrade to Enable
          </button>
        ) : (
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={onToggle}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        )}
      </div>
      {children}
    </div>
  );
}
```

---

## 🛡️ MIDDLEWARE PROTECTION

### API Route Protection

**File**: `src/lib/subscription/middleware.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { FeatureGate } from './feature-gate';

export async function requireFeature(
  request: NextRequest,
  orgId: string,
  feature: string
): Promise<NextResponse | null> {
  const hasAccess = await FeatureGate.hasFeature(orgId, feature as any);
  
  if (!hasAccess) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Feature not available on your plan',
        upgrade: true,
        feature
      },
      { status: 403 }
    );
  }
  
  return null;
}

export async function requireLimit(
  request: NextRequest,
  orgId: string,
  feature: 'aiEmailWriter' | 'prospectFinder' | 'linkedin' | 'sms',
  amount: number = 1
): Promise<NextResponse | null> {
  const limit = await FeatureGate.checkLimit(orgId, feature, amount);
  
  if (!limit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: `Monthly limit exceeded for ${feature}`,
        limit: limit.limit,
        used: limit.limit - limit.remaining,
        remaining: limit.remaining,
        upgrade: true
      },
      { status: 429 }
    );
  }
  
  return null;
}
```

### Example Usage in API Routes

```typescript
// src/app/api/outbound/email/generate/route.ts

import { requireFeature, requireLimit } from '@/lib/subscription/middleware';
import { FeatureGate } from '@/lib/subscription/feature-gate';

export async function POST(request: NextRequest) {
  const { orgId, prospectData } = await request.json();
  
  // Check if feature is enabled
  const featureCheck = await requireFeature(request, orgId, 'aiEmailWriter');
  if (featureCheck) return featureCheck;
  
  // Check usage limit
  const limitCheck = await requireLimit(request, orgId, 'aiEmailWriter', 1);
  if (limitCheck) return limitCheck;
  
  // Generate email
  const email = await generateColdEmail(prospectData);
  
  // Increment usage counter
  await FeatureGate.incrementUsage(orgId, 'aiEmailWriter', 1);
  
  return NextResponse.json({ success: true, email });
}
```

---

## 📊 UPGRADE PROMPTS

### In-App Upgrade CTAs

When user tries to use a locked feature:

```tsx
<UpgradeModal
  feature="AI Email Writer"
  currentPlan="Starter"
  requiredPlan="Professional"
  benefits={[
    "Generate 500 personalized emails per month",
    "Automated email sequences",
    "AI reply handler",
    "A/B testing"
  ]}
  price={299}
  onUpgrade={() => upgradeSubscription('professional')}
/>
```

When user hits usage limit:

```tsx
<UsageLimitModal
  feature="AI Email Writer"
  used={50}
  limit={50}
  options={[
    { label: "Upgrade to Professional (500/month)", price: 200, plan: 'professional' },
    { label: "One-time top-up (+100 emails)", price: 49, type: 'addon' }
  ]}
/>
```

---

## 🎯 SUMMARY

**What We're Building:**
✅ **Modular outbound system** - Every feature can be toggled on/off  
✅ **Tiered access** - Features unlocked by subscription level  
✅ **Usage limits** - Monthly quotas enforced automatically  
✅ **Graceful degradation** - Platform works without outbound  
✅ **Upsell opportunities** - Clear upgrade paths  

**This Allows:**
- Clients start with just CRM + chat
- Add outbound when they're ready
- Pay for what they use
- Upgrade as they scale
- Enterprise gets everything

**Ready to implement this architecture?** I can start building:
1. Subscription schema and feature gate service
2. Outbound settings UI
3. API middleware protection
4. Usage tracking system
5. Upgrade flow

Say the word and I'll begin! 🚀













