/**
 * composer-metadata — helpers for converting the flat `metadata` bag that
 * arrives from the TagsAndSeoSection composer into the typed values each
 * platform handler needs.
 *
 * The composer serialises hashtags/keywords as comma-separated strings
 * because the route-level Zod schema uses `Record<string, string>`. These
 * helpers reverse that serialisation in a consistent, tested-once place
 * rather than letting each platform case reinvent the split/trim/dedup loop.
 *
 * None of these functions perform I/O or have side-effects — they are pure
 * string transformations that are safe to call on every request.
 */

/**
 * Split a comma-separated hashtag string, normalise each token so it starts
 * with exactly one `#`, deduplicate (case-sensitive), and drop empties.
 *
 * Handles both "#tag" and "tag" input forms; the TagsAndSeoSection already
 * normalises on entry but the backend should not trust that invariant.
 *
 * @example
 * parseHashtags('#sales, compliance, #AI')
 * // => ['#sales', '#compliance', '#AI']
 */
export function parseHashtags(raw?: string): string[] {
  if (!raw?.trim()) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const token of raw.split(',')) {
    const trimmed = token.trim();
    if (!trimmed) { continue; }
    const normalised = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    if (!seen.has(normalised)) {
      seen.add(normalised);
      result.push(normalised);
    }
  }
  return result;
}

/**
 * Split a comma-separated keyword string, trim whitespace, deduplicate, and
 * drop empties. Keywords never carry a `#` prefix.
 *
 * @example
 * parseKeywords('sales automation, compliance, AI sales')
 * // => ['sales automation', 'compliance', 'AI sales']
 */
export function parseKeywords(raw?: string): string[] {
  if (!raw?.trim()) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const token of raw.split(',')) {
    const trimmed = token.trim().replace(/^#+/, ''); // strip any stray # prefix
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

/**
 * Join hashtags with a single space. Returns `''` for an empty array so
 * callers can safely do `text + buildHashtagFooter(tags)` without adding
 * trailing whitespace.
 *
 * Used for platforms where hashtags appear inline (TikTok captions, plain
 * short bodies) and a double-newline prefix would look out of place.
 *
 * @example
 * buildHashtagFooter(['#sales', '#AI'])
 * // => '#sales #AI'
 */
export function buildHashtagFooter(hashtags: string[]): string {
  return hashtags.join(' ');
}

/**
 * Prepend a `separator` to the joined hashtag string when hashtags are
 * non-empty, otherwise return `''`. The separator defaults to `'\n\n'`
 * which is the standard convention for social platforms (blank line between
 * post body and hashtag block).
 *
 * The caller appends this directly to the body string:
 *   `const finalText = body + buildHashtagFooterWithSeparator(tags);`
 *
 * @example
 * buildHashtagFooterWithSeparator(['#sales', '#AI'])
 * // => '\n\n#sales #AI'
 *
 * buildHashtagFooterWithSeparator([])
 * // => ''
 */
export function buildHashtagFooterWithSeparator(
  hashtags: string[],
  separator = '\n\n',
): string {
  if (hashtags.length === 0) {
    return '';
  }
  return `${separator}${hashtags.join(' ')}`;
}
