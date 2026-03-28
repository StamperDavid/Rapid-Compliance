/**
 * Dashboard Links — Maps tool names to their relevant dashboard routes.
 *
 * Used by Mission Control to provide "View in Dashboard" links for each step,
 * allowing the user to jump directly to the relevant page to review output.
 */

const TOOL_ROUTE_MAP: Record<string, { route: string; label: string }> = {
  // Delegation agents
  delegate_to_builder: { route: '/website/editor', label: 'Website Editor' },
  delegate_to_architect: { route: '/website/editor', label: 'Website Editor' },
  delegate_to_sales: { route: '/contacts', label: 'Contacts' },
  delegate_to_revenue_director: { route: '/contacts', label: 'Contacts' },
  delegate_to_marketing: { route: '/email/campaigns', label: 'Email Campaigns' },
  delegate_to_marketing_manager: { route: '/email/campaigns', label: 'Email Campaigns' },
  delegate_to_content: { route: '/website/blog', label: 'Content' },
  delegate_to_outreach: { route: '/leads', label: 'Lead Scanner' },
  delegate_to_intelligence: { route: '/analytics', label: 'Analytics' },
  delegate_to_trust: { route: '/analytics', label: 'Analytics' },
  delegate_to_commerce: { route: '/products', label: 'Products' },
  // Video tools
  create_video: { route: '/content/video', label: 'Video Studio' },
  generate_video: { route: '/content/video', label: 'Video Studio' },
  produce_video: { route: '/content/video', label: 'Video Studio' },
  assemble_video: { route: '/content/video', label: 'Video Studio' },
  // Video orchestration chain steps
  video_script: { route: '/content/video', label: 'Video Studio' },
  video_cinematic: { route: '/content/video', label: 'Video Studio' },
  video_thumbnails: { route: '/content/video', label: 'Video Studio' },
  // Image
  create_image: { route: '/content/image-generator', label: 'Image Generator' },
  // Other tools
  social_post: { route: '/social/command-center', label: 'Social Command Center' },
  voice_agent: { route: '/calls', label: 'Voice Calls' },
  save_blog_draft: { route: '/website/blog', label: 'Blog' },
  research_trending_topics: { route: '/seo', label: 'SEO' },
  get_seo_config: { route: '/seo', label: 'SEO' },
  migrate_website: { route: '/website', label: 'Website' },
  // Campaign tools
  create_campaign: { route: '/mission-control', label: 'Mission Control' },
  orchestrate_campaign: { route: '/mission-control', label: 'Campaign Review' },
  batch_produce_videos: { route: '/content/video/calendar', label: 'Content Calendar' },
};

export interface DashboardLink {
  route: string;
  label: string;
}

/**
 * Get the dashboard link for a given tool name.
 * Returns null if no known route exists for the tool.
 *
 * If toolResult contains a reviewLink with a projectId, uses that for dynamic routing.
 */
export function getDashboardLink(toolName: string, toolResult?: string): DashboardLink | null {
  // Check for dynamic review link in tool result
  if (toolResult) {
    try {
      const parsed = JSON.parse(toolResult) as Record<string, unknown>;
      if (typeof parsed.reviewLink === 'string' && parsed.reviewLink.startsWith('/')) {
        return {
          route: parsed.reviewLink,
          label: TOOL_ROUTE_MAP[toolName]?.label ?? 'Review',
        };
      }
    } catch {
      // Not JSON — fall through to static map
    }
  }

  return TOOL_ROUTE_MAP[toolName] ?? null;
}

/**
 * Build a link to the step review page for a given mission step.
 * Returns null if missionId or stepId are missing.
 */
export function getStepReviewLink(
  missionId: string | undefined,
  stepId: string | undefined,
): DashboardLink | null {
  if (!missionId || !stepId) {
    return null;
  }
  return {
    route: `/mission-control/review?mission=${encodeURIComponent(missionId)}&step=${encodeURIComponent(stepId)}`,
    label: 'Review Details',
  };
}

/**
 * Human-readable names for orchestration step tools.
 */
const STEP_DISPLAY_NAMES: Record<string, string> = {
  video_research: 'Research',
  video_strategy: 'Strategy',
  video_script: 'Script Writing',
  video_cinematic: 'Cinematic Design',
  video_thumbnails: 'Thumbnail Generation',
  produce_video: 'Video Production',
  assemble_video: 'Video Assembly',
  create_video: 'Create Video',
  generate_video: 'Generate Video',
  edit_video: 'Edit Video',
  create_image: 'Image Generation',
  // Campaign orchestration steps
  orchestrate_campaign: 'Campaign Orchestration',
  campaign_research: 'Campaign Research',
  campaign_strategy: 'Campaign Strategy',
  campaign_blog: 'Blog Draft',
  campaign_video: 'Video Storyboard',
  campaign_social: 'Social Posts',
  campaign_email: 'Email Draft',
  create_campaign: 'Create Campaign',
  batch_produce_videos: 'Batch Video Production',
};

/**
 * Format a tool name into a human-readable step name.
 * Uses custom display names for orchestration steps, falls back to title-casing.
 */
export function formatToolName(toolName: string): string {
  if (STEP_DISPLAY_NAMES[toolName]) {
    return STEP_DISPLAY_NAMES[toolName];
  }

  return toolName
    .replace('delegate_to_', '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
