/**
 * Phase 2 clone-map smoke test.
 *
 * Captures the live localhost:3000 home page with the Phase 1 engine, maps it to
 * an editable Page with the Phase 2 deterministic mapper, and writes:
 *   - clone-page.json     — the resulting Page (our editor model)
 *   - clone-preview.html  — a standalone, self-contained faithful reproduction
 * to the scratchpad dir. Prints a summary + verbatim fidelity checks.
 *
 * Run: npx tsx scripts/test-clone-map.ts
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { captureSite } from '../src/lib/website-builder/site-capture';
import { captureToPageDetailed } from '../src/lib/website-builder/capture-to-page';

const SCRATCH =
  'C:/Users/David/AppData/Local/Temp/claude/D--Future-Rapid-Compliance/6a8ff825-4bf7-4dc7-9bb9-b3fef81464ff/scratchpad';

const TARGET_URL = 'http://localhost:3000/';

function countWidgets(page: { content: Array<{ columns: Array<{ widgets: unknown[] }> }> }): number {
  let n = 0;
  for (const section of page.content) {
    for (const column of section.columns) {
      n += column.widgets.length;
    }
  }
  return n;
}

async function main(): Promise<void> {
  console.log(`Capturing ${TARGET_URL} ...`);
  const capture = await captureSite(TARGET_URL, { viewportWidth: 1440, viewportHeight: 900 });
  console.log(`  captured "${capture.title}" — root <${capture.root.tag}> with ${capture.root.children.length} body children`);

  const { page, decomposedSections, capturedSections, sectionsHtml } = captureToPageDetailed(capture, {
    title: capture.title,
  });

  // ---- write the Page JSON ----
  const pagePath = join(SCRATCH, 'clone-page.json');
  writeFileSync(pagePath, JSON.stringify(page, null, 2), 'utf8');

  // ---- write the standalone faithful preview ----
  const fontLinks =
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet">';
  const previewHtml =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=1440">' +
    `<title>${page.title}</title>${fontLinks}` +
    '<style>*{box-sizing:border-box;margin:0}body{background:#000;font-family:Inter,sans-serif}</style>' +
    '</head><body style="background:#000">' +
    sectionsHtml.join('\n') +
    '</body></html>';
  const previewPath = join(SCRATCH, 'clone-preview.html');
  writeFileSync(previewPath, previewHtml, 'utf8');

  // ---- summary ----
  const widgetCount = countWidgets(page);
  console.log('\n=== SUMMARY ===');
  console.log(`sections:            ${page.content.length}`);
  console.log(`widgets:             ${widgetCount}`);
  console.log(`decomposed sections: ${decomposedSections} (native widgets)`);
  console.log(`captured-block:      ${capturedSections} (captured-html)`);
  console.log(`clone-page.json:     ${pagePath}`);
  console.log(`clone-preview.html:  ${previewPath}`);

  // ---- verbatim fidelity checks ----
  const combined = sectionsHtml.join('\n');
  const phrases = [
    'Your AI-Native',
    'Sales Workforce',
    'AI-Native Workforce Platform',
    'BYOK',
    'Cancel anytime',
    'No credit card required',
    '✓ Lead Scraper & Enrichment',
  ];
  console.log('\n=== VERBATIM PRESENCE (in reconstructed HTML) ===');
  let allPresent = true;
  for (const phrase of phrases) {
    const present = combined.includes(phrase);
    if (!present) {
      allPresent = false;
    }
    console.log(`  ${present ? 'OK ' : 'MISSING'} — ${JSON.stringify(phrase)}`);
  }

  // Pull the hero H1 verbatim (text + gradient span) straight from the output.
  const heroMatch = combined.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (heroMatch) {
    const heroText = heroMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    console.log(`\nHero H1 (tags stripped): ${JSON.stringify(heroText)}`);
  }

  console.log(`\n${allPresent ? 'ALL fidelity phrases present verbatim.' : 'SOME phrases missing — investigate.'}`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('test-clone-map failed:', err);
    process.exit(1);
  });
