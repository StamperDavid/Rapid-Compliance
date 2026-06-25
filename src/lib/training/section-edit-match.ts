/**
 * Section-edit matcher — the SINGLE place every training path applies a surgical
 * prompt edit, so the rule is identical for all agents (specialists, managers,
 * Jasper, and both Prompt Engineers).
 *
 * Why this exists: the Prompt Engineer is an LLM and cannot re-quote a long block
 * of text character-perfectly. A strict verbatim `includes()` check failed
 * regularly — a single stray space, smart-quote, or dash broke the match and the
 * whole approval errored out (the 422s the operator hit). These helpers forgive the
 * realistic drift (whitespace runs, quote variants, dash variants) while still
 * REFUSING on a non-unique match, so a prompt is never corrupted by a guess. A
 * genuine paraphrase still fails — correctly — and surfaces a clear "re-grade".
 *
 * Pure + dependency-free on purpose: anything can import it with zero circular risk.
 */

/** Build a drift-tolerant regex source from a quoted section. */
function tolerantPattern(currentText: string): string {
  return currentText
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // escape regex specials
    .replace(/\s+/g, '\\s+') // any run of whitespace
    .replace(/["“”]/g, '["“”]') // any double quote
    .replace(/['‘’]/g, "['‘’]") // any single quote / apostrophe
    .replace(/[-–—]/g, '[-–—]'); // any hyphen / en / em dash
}

/**
 * Replace `currentText` with `proposedText` in `prompt`. Exact substring first,
 * then a UNIQUE drift-tolerant match. Returns the edited text, or null if the
 * section cannot be located uniquely (zero or multiple matches → refuse to guess).
 * Uses a function replacer so `$`-sequences in proposedText stay literal.
 */
export function applySectionEdit(
  prompt: string,
  currentText: string,
  proposedText: string,
): string | null {
  if (prompt.includes(currentText)) {
    return prompt.replace(currentText, () => proposedText);
  }
  const pattern = tolerantPattern(currentText);
  let matches: RegExpMatchArray | null;
  try {
    matches = prompt.match(new RegExp(pattern, 'g'));
  } catch {
    return null;
  }
  if (matches?.length !== 1) {
    return null; // zero or ambiguous → refuse to guess
  }
  return prompt.replace(new RegExp(pattern), () => proposedText);
}

/** True when `currentText` can be located UNIQUELY in `prompt` (exact or tolerant). */
export function canLocateSection(prompt: string, currentText: string): boolean {
  if (prompt.includes(currentText)) {
    return true;
  }
  try {
    const matches = prompt.match(new RegExp(tolerantPattern(currentText), 'g'));
    return matches?.length === 1;
  } catch {
    return false;
  }
}
