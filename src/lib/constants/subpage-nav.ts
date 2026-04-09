/**
 * Centralized SubpageNav tab definitions.
 *
 * Every hub's tab array is defined here once.  Layout files and cross-route
 * pages import from this module — no more copy-pasting arrays per page.
 */

import type { SubpageNavItem } from '@/components/ui/SubpageNav';

// ── Dashboard ───────────────────────────────────────────────────────────────
export const DASHBOARD_TABS: SubpageNavItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Activities', href: '/dashboard/activities' },
  { label: 'Executive Briefing', href: '/executive-briefing' },
  { label: 'Workforce HQ', href: '/workforce' },
  { label: 'Team', href: '/team/leaderboard' },
];

// ── Catalog (hub for products, services, orders, coupons, subscriptions) ─────
export const CATALOG_TABS: SubpageNavItem[] = [
  { label: 'Products', href: '/products' },
  { label: 'Services', href: '/products/services' },
  { label: 'Orders', href: '/orders' },
  { label: 'Coupons', href: '/entities/coupons' },
  { label: 'Subscriptions', href: '/entities/subscriptions' },
];

// ── Social Hub (8 tabs — Analytics absorbed from standalone sidebar item) ────
export const SOCIAL_TABS: SubpageNavItem[] = [
  { label: 'Command Center', href: '/social/command-center' },
  { label: 'Campaigns', href: '/social/campaigns' },
  { label: 'Calendar', href: '/social/calendar' },
  { label: 'Approvals', href: '/social/approvals' },
  { label: 'Listening', href: '/social/listening' },
  { label: 'Agent Rules', href: '/social/agent-rules' },
  { label: 'Playbook', href: '/social/playbook' },
  { label: 'Analytics', href: '/social/analytics' },
];

// ── Analytics ───────────────────────────────────────────────────────────────
export const ANALYTICS_TABS: SubpageNavItem[] = [
  { label: 'Overview', href: '/analytics' },
  { label: 'Revenue', href: '/analytics/revenue' },
  { label: 'CRM Analytics', href: '/analytics/sales' },
  { label: 'Sales & Orders', href: '/analytics/ecommerce' },
  { label: 'Attribution', href: '/analytics/attribution' },
  { label: 'Workflows', href: '/analytics/workflows' },
  { label: 'Sequences', href: '/sequences/analytics' },
  { label: 'Compliance', href: '/compliance-reports' },
  { label: 'Competitor Research', href: '/battlecards' },
];

// ── Website (top-level hub) ─────────────────────────────────────────────────
export const WEBSITE_TABS: SubpageNavItem[] = [
  { label: 'Editor', href: '/website/editor' },
  { label: 'Pages', href: '/website/pages' },
  { label: 'Templates', href: '/website/templates' },
  { label: 'Blog', href: '/website/blog' },
  { label: 'SEO', href: '/website/seo' },
  { label: 'Store', href: '/website/store' },
  { label: 'Navigation', href: '/website/navigation' },
  { label: 'Settings', href: '/website/settings' },
  { label: 'Audit Log', href: '/website/audit-log' },
];

// ── Website > Blog sub-hub ──────────────────────────────────────────────────
export const WEBSITE_BLOG_TABS: SubpageNavItem[] = [
  { label: 'Posts', href: '/website/blog' },
  { label: 'Editor', href: '/website/blog/editor' },
  { label: 'Categories', href: '/website/blog/categories' },
];

// ── Website > SEO sub-hub ───────────────────────────────────────────────────
export const WEBSITE_SEO_TABS: SubpageNavItem[] = [
  { label: 'SEO', href: '/website/seo' },
  { label: 'Competitors', href: '/website/seo/competitors' },
  { label: 'Domains', href: '/website/domains' },
];

// ── Mission Control ─────────────────────────────────────────────────────────
export const MISSION_CONTROL_TABS: SubpageNavItem[] = [
  { label: 'Live', href: '/mission-control' },
  { label: 'History', href: '/mission-control/history' },
];

// ── AI / Models & Data ──────────────────────────────────────────────────────
export const AI_DATA_TABS: SubpageNavItem[] = [
  { label: 'Datasets', href: '/ai/datasets' },
  { label: 'Fine-Tuning', href: '/ai/fine-tuning' },
];

// ── Lead Intelligence ───────────────────────────────────────────────────────
export const LEAD_INTEL_TABS: SubpageNavItem[] = [
  { label: 'Lead Research', href: '/leads/research' },
  { label: 'Lead Scoring', href: '/lead-scoring' },
  { label: 'Marketing Scraper', href: '/scraper' },
];

// ── Email Studio ────────────────────────────────────────────────────────────
export const EMAIL_STUDIO_TABS: SubpageNavItem[] = [
  { label: 'Email Writer', href: '/email-writer' },
  { label: 'Nurture', href: '/nurture' },
  { label: 'Email Builder', href: '/marketing/email-builder' },
  { label: 'Templates', href: '/templates' },
];

// ── Coaching ────────────────────────────────────────────────────────────────
export const COACHING_TABS: SubpageNavItem[] = [
  { label: 'My Coaching', href: '/coaching' },
  { label: 'Team Coaching', href: '/coaching/team' },
  { label: 'Playbook', href: '/playbook' },
];

// ── Team (expanded hub: leaderboard, tasks, performance, coaching, playbook) ─
export const TEAM_TABS: SubpageNavItem[] = [
  { label: 'Leaderboard', href: '/team/leaderboard' },
  { label: 'Tasks', href: '/team/tasks' },
  { label: 'Performance', href: '/performance' },
  { label: 'Coaching', href: '/coaching' },
  { label: 'Team Coaching', href: '/coaching/team' },
  { label: 'Playbook', href: '/playbook' },
];

// ── Proposals ───────────────────────────────────────────────────────────────
export const PROPOSALS_TABS: SubpageNavItem[] = [
  { label: 'Proposals', href: '/proposals' },
  { label: 'Builder', href: '/proposals/builder' },
];

// ── Training Hub (AI Workforce training across domains) ─────────────────────
export const TRAINING_HUB_TABS: SubpageNavItem[] = [
  { label: 'AI Training', href: '/settings/ai-agents/training' },
  { label: 'Voice', href: '/voice/training' },
  { label: 'Social', href: '/social/training' },
  { label: 'SEO', href: '/seo/training' },
];

// ── AI Agent Settings ───────────────────────────────────────────────────────
export const AI_AGENTS_SETTINGS_TABS: SubpageNavItem[] = [
  { label: 'Overview', href: '/settings/ai-agents' },
  { label: 'Persona', href: '/settings/ai-agents/persona' },
  { label: 'Training', href: '/settings/ai-agents/training' },
  { label: 'Business Setup', href: '/settings/ai-agents/business-setup' },
  { label: 'Configuration', href: '/settings/ai-agents/configuration' },
  { label: 'Voice', href: '/settings/ai-agents/voice' },
];

// ── Growth Command Center ───────────────────────────────────────────────────
export const GROWTH_TABS: SubpageNavItem[] = [
  { label: 'Command Center', href: '/growth/command-center' },
  { label: 'Competitors', href: '/growth/competitors' },
  { label: 'Keywords', href: '/growth/keywords' },
  { label: 'Strategy', href: '/growth/strategy' },
  { label: 'AI Visibility', href: '/growth/ai-visibility' },
  { label: 'Activity', href: '/growth/activity' },
];

// ── System (owner-only admin tools — Schemas absorbed) ──────────────────────
export const SYSTEM_TABS: SubpageNavItem[] = [
  { label: 'System Health', href: '/system' },
  { label: 'Impersonate', href: '/system/impersonate' },
  { label: 'Schemas', href: '/schemas' },
];

// ── Leads Hub (All Leads + Proposals/Quotes + Lead Research + Scoring) ──────
export const LEADS_TABS: SubpageNavItem[] = [
  { label: 'All Leads', href: '/entities/leads' },
  { label: 'Proposals / Quotes', href: '/leads/proposals' },
  { label: 'Intelligence Hub', href: '/leads/research' },
  { label: 'Scoring', href: '/lead-scoring' },
];

// ── Deals Hub (Pipeline + Revenue + Risk + Health) ─────────────────────────
export const DEALS_TABS: SubpageNavItem[] = [
  { label: 'All Deals', href: '/deals' },
  { label: 'Orders', href: '/deals/orders' },
  { label: 'Invoices', href: '/deals/invoices' },
  { label: 'Payments', href: '/deals/payments' },
  { label: 'Tasks', href: '/deals/tasks' },
  { label: 'Risk', href: '/risk' },
  { label: 'Living Ledger', href: '/living-ledger' },
];

// ── Content Generator Hub (Video + Image + Editor + Library + Audio Lab) ─────
export const CONTENT_GENERATOR_TABS: SubpageNavItem[] = [
  { label: 'Video', href: '/content/video' },
  { label: 'Calendar', href: '/content/video/calendar' },
  { label: 'Image', href: '/content/image-generator' },
  { label: 'Editor', href: '/content/video/editor' },
  { label: 'Library', href: '/content/video/library' },
  { label: 'Audio Lab', href: '/content/voice-lab' },
];

// ── AI Workforce Hub (all 5 AI items → 1 hub) ──────────────────────────────
export const AI_WORKFORCE_TABS: SubpageNavItem[] = [
  { label: 'Agents', href: '/workforce' },
  { label: 'Mission Control', href: '/mission-control' },
  { label: 'Performance', href: '/workforce/performance' },
  { label: 'Training', href: '/settings/ai-agents/training' },
  { label: 'Models & Data', href: '/ai/datasets' },
];
