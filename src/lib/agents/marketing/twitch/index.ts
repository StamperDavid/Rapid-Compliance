/**
 * Twitch Expert — public barrel.
 *
 * Re-exports the specialist class, factory, and the request/result types
 * callers need to invoke generate_content. No DM action — Twitch
 * Whispers are inert per the platform viability matrix.
 */

export {
  TwitchExpert,
  getTwitchExpert,
  type GenerateContentRequest,
  type TwitchContentResult,
} from './specialist';
