// Agent Swarm Index
// STATUS: REGISTRY - Exports all agents for easy importing

// Types
export * from './types';

// Base Classes
export { BaseSpecialist } from './base-specialist';
export { BaseManager } from './base-manager';

// Managers
export { IntelligenceManager } from './intelligence/manager';
export { MarketingManager } from './marketing/manager';
export { BuilderManager } from './builder/manager';
export { CommerceManager } from './commerce/manager';
export { OutreachManager } from './outreach/manager';
export { ContentManager } from './content/manager';

// Intelligence Specialists
export { CompetitorAnalyst } from './intelligence/competitor/specialist';
export { SentimentAnalyst } from './intelligence/sentiment/specialist';
export { TechnographicScout } from './intelligence/technographic/specialist';

// Marketing Specialists
export { TikTokExpert } from './marketing/tiktok/specialist';
export { XExpert } from './marketing/x/specialist';
export { FacebookExpert } from './marketing/facebook/specialist';
export { LinkedInExpert } from './marketing/linkedin/specialist';
export { SEOExpert } from './marketing/seo/specialist';

// Builder Specialists
export { UxUiArchitect } from './builder/ux-ui/specialist';
export { FunnelEngineer } from './builder/funnel/specialist';
export { AssetGenerator } from './builder/assets/specialist';

// Commerce Specialists
export { PricingStrategist } from './commerce/pricing/specialist';
export { InventoryManagerAgent } from './commerce/inventory/specialist';

// Outreach Specialists
export { EmailSpecialist } from './outreach/email/specialist';
export { SmsSpecialist } from './outreach/sms/specialist';

// Content Specialists
export { Copywriter } from './content/copywriter/specialist';
export { CalendarCoordinator } from './content/calendar/specialist';

/**
 * SWARM STATUS REPORT
 *
 * Total Agents: 23 (6 managers + 17 specialists)
 * Functional: 0
 * Shell: 6 (managers)
 * Ghost: 17 (specialists)
 *
 * The swarm infrastructure exists. The agents do not.
 */
