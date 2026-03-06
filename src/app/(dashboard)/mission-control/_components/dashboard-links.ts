/**
 * Dashboard Links — Maps tool names to their relevant dashboard routes.
 *
 * Used by Mission Control to provide "View in Dashboard" links for each step,
 * allowing the user to jump directly to the relevant page to review output.
 */

const TOOL_ROUTE_MAP: Record<string, { route: string; label: string }> = {
  delegate_to_builder: { route: '/website/editor', label: 'Website Editor' },
  delegate_to_architect: { route: '/website/editor', label: 'Website Editor' },
  delegate_to_sales: { route: '/contacts', label: 'Contacts' },
  delegate_to_revenue_director: { route: '/contacts', label: 'Contacts' },
  delegate_to_marketing: { route: '/email/campaigns', label: 'Email Campaigns' },
  delegate_to_marketing_manager: { route: '/email/campaigns', label: 'Email Campaigns' },
  delegate_to_content: { route: '/content/video', label: 'Video Studio' },
  delegate_to_outreach: { route: '/leads', label: 'Lead Scanner' },
  delegate_to_intelligence: { route: '/analytics', label: 'Analytics' },
  delegate_to_trust: { route: '/analytics', label: 'Analytics' },
  delegate_to_commerce: { route: '/products', label: 'Products' },
  create_video: { route: '/content/video', label: 'Video Studio' },
  generate_video: { route: '/content/video', label: 'Video Studio' },
  social_post: { route: '/social/command-center', label: 'Social Command Center' },
  voice_agent: { route: '/calls', label: 'Voice Calls' },
  save_blog_draft: { route: '/website', label: 'Website' },
  research_trending_topics: { route: '/seo', label: 'SEO' },
  get_seo_config: { route: '/seo', label: 'SEO' },
  migrate_website: { route: '/website', label: 'Website' },
};

export interface DashboardLink {
  route: string;
  label: string;
}

/**
 * Get the dashboard link for a given tool name.
 * Returns null if no known route exists for the tool.
 */
export function getDashboardLink(toolName: string): DashboardLink | null {
  return TOOL_ROUTE_MAP[toolName] ?? null;
}

/**
 * Format a tool name into a human-readable step name.
 * e.g., "delegate_to_builder" -> "Builder", "create_video" -> "Create Video"
 */
export function formatToolName(toolName: string): string {
  return toolName
    .replace('delegate_to_', '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
