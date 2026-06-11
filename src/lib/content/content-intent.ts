/**
 * The shared "intent contract" for the Content Manager.
 *
 * The Content Manager (src/app/api/content/assistant/route.ts) interprets a
 * request + attached references into this structured shape, shows the operator a
 * plain-language summary, and PAUSES for approval before anything is generated.
 * On approval the same structure drives the right specialist (Video Specialist,
 * Hedra image gen, Music Planner, Copywriter).
 *
 * It is emitted by the model as a fenced ```intent JSON block inside its proposal
 * reply, so it round-trips through the conversation history: the proposal turn
 * carries the intent, and the next (approval) turn reads it back from history and
 * builds. All four media types reuse the same envelope; type-specific fields stay
 * optional so one contract covers video / image / music / text.
 */

import { z } from 'zod';

/**
 * How faithfully a subject's reference images should be reproduced:
 *  - exact   — recreate THIS character/subject precisely (identity-lock), only
 *              re-rendered in the requested style.
 *  - inspired — use the references as loose inspiration; a similar-but-distinct
 *              result is fine.
 *  - new     — invent from the description; references (if any) are mood only.
 */
export const SubjectFidelitySchema = z.enum(['exact', 'inspired', 'new']);
export type SubjectFidelity = z.infer<typeof SubjectFidelitySchema>;

/**
 * A person/character/product in the request, with the reference files that depict
 * it and how faithfully to reproduce it. `referenceNames` are matched against the
 * attached files' names AND their AI vision summaries, so the naming convention
 * helps but is not the only signal.
 */
export const IntentSubjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  referenceNames: z.array(z.string().trim().max(300)).max(60).default([]),
  fidelity: SubjectFidelitySchema.default('exact'),
  /** Free-text per-character guidance, e.g. "civilian in Acts 1–3, suited from Act 4". */
  notes: z.string().trim().max(2000).optional(),
});
export type IntentSubject = z.infer<typeof IntentSubjectSchema>;

// Limits are deliberately GENEROUS — the model writes rich descriptions, and a tight
// cap here silently fails the whole intent parse and falls back to a stale version.
export const ContentIntentSchema = z.object({
  mediaType: z.enum(['video', 'image', 'music', 'text']),
  /** Plain-language understanding shown to the operator for approval. */
  summary: z.string().trim().min(1).max(8000),
  subjects: z.array(IntentSubjectSchema).max(20).default([]),
  /** Visual/audio style, e.g. "Pixar 3D", "documentary", "lo-fi". */
  style: z.string().trim().max(2000).optional(),
  format: z
    .object({
      // min 0 — images/text carry no duration and the model sometimes emits 0;
      // a tight min(1) was silently failing the whole intent parse.
      durationSeconds: z.number().int().min(0).max(600).optional(),
      aspectRatio: z.string().trim().max(20).optional(),
      platform: z.string().trim().max(80).optional(),
    })
    .default({}),
  message: z.string().trim().max(3000).optional(),
  /** Story/structure beats (video) or section points (text). */
  beats: z.array(z.string().trim().max(1000)).max(40).default([]),
  callToAction: z.string().trim().max(600).optional(),
});
export type ContentIntent = z.infer<typeof ContentIntentSchema>;

const INTENT_FENCE = /```intent\s*([\s\S]*?)```/i;
// A truncated/unclosed intent block (output hit the length cap mid-JSON) — strip
// from the opening fence to end-of-string so partial JSON can never show in chat.
const INTENT_FENCE_UNCLOSED = /```intent[\s\S]*$/i;

/** Parse a fenced ```intent JSON block out of a model reply (or null). */
export function extractIntent(reply: string): ContentIntent | null {
  const fence = INTENT_FENCE.exec(reply);
  if (!fence) {
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fence[1].trim());
  } catch {
    return null;
  }
  const parsed = ContentIntentSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Remove the ```intent block (complete OR truncated) so the operator sees only the plain summary. */
export function stripIntentBlock(reply: string): string {
  return reply
    .replace(INTENT_FENCE, '')
    .replace(INTENT_FENCE_UNCLOSED, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Scan the conversation (newest first) for the most recent proposal that carried
 * an intent block — the thing an "approve" would build.
 */
export function findPriorIntent(
  messages: { role: 'user' | 'assistant'; content: string }[],
): ContentIntent | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role === 'assistant') {
      const intent = extractIntent(m.content);
      if (intent) {
        return intent;
      }
    }
  }
  return null;
}

// A bare affirmation (the whole message is just "yes" / "ok build it" / etc.).
const APPROVAL_RE =
  /^(?:\s*(?:yes|yep|yeah|yup|sure|ok|okay|k|approve[d]?|approved|go|go ahead|do it|make it|build it|build|create it|let'?s go|let'?s do it|that'?s right|correct|proceed|ship it|lgtm|perfect|looks? good|sounds? good|love it|nailed it|👍|✅)[\s.!]*)+$/i;

// A clear build/redo COMMAND — fires the build even with surrounding filler, e.g.
// "re-do it, and do it right", "ok go ahead and build it now", "render this".
const BUILD_COMMAND_RE =
  /\b(re-?do|re-?build|rebuild|redo|recreate)\b|\b(do it|build it|make it|run it|send it|ship it|go ahead|go for it|fire it|kick it off|let'?s go)\b|\b(build|render|generate|produce|create|make)\s+(it|this|that|the|them|these|those|all|my|some|a |an )/i;

// A substantive content CHANGE — re-proposes instead of building (takes precedence
// over a build command, so "re-do it but make the bully scarier" still re-proposes).
const EDIT_CUE_RE =
  /\b(change|instead|but |except|swap|replace|remove|drop |more |less |bigger|smaller|different|without|shorter|longer|tweak|adjust|fix|\d+\s*(?:seconds?|secs?|minutes?|mins?)|\bscene\b|\bcharacter\b|wardrobe|colou?r|palette|faster|slower|\btone\b|\bmood\b|\bmusic\b|\bvoice\b|narrat|caption|act\s*\d)\b/i;

/**
 * True when the operator's message is a clear go-ahead to BUILD the pending proposal —
 * a bare affirmation OR a build/redo command — and carries no substantive content
 * change. A message that asks for a change re-proposes (edit) rather than building.
 */
export function isApproval(text: string): boolean {
  const t = text.trim();
  if (!t) {
    return false;
  }
  if (EDIT_CUE_RE.test(t)) {
    return false;
  }
  return APPROVAL_RE.test(t) || BUILD_COMMAND_RE.test(t);
}
