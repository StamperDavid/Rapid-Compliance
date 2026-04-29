/**
 * Discord Expert — barrel export.
 *
 * Single entry point for the Discord specialist + its public types so callers
 * (Marketing Manager, agent factory, route handlers) import from one place.
 */

export {
  DiscordExpert,
  getDiscordExpert,
} from './specialist';

export type {
  GenerateContentRequest,
  ComposeDmReplyRequest,
  ComposeDmReplyResult,
  DiscordContentResult,
} from './specialist';
