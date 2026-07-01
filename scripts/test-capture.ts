/**
 * Manual smoke test for the faithful capture engine.
 *
 * Captures http://localhost:3000/, writes the JSON tree to the scratchpad,
 * and prints a summary so a reviewer can confirm it captured REAL computed
 * styles + verbatim text.
 *
 * Usage: npx tsx scripts/test-capture.ts
 */

/* eslint-disable no-console */

import * as fs from 'fs';
import * as path from 'path';
import { captureSite } from '../src/lib/website-builder/site-capture';
import type { CaptureNode, CaptureResult } from '../src/lib/website-builder/site-capture-types';

const TARGET_URL = 'http://localhost:3000/';
const OUT_PATH = path.join(
  'C:',
  'Users',
  'David',
  'AppData',
  'Local',
  'Temp',
  'claude',
  'D--Future-Rapid-Compliance',
  '6a8ff825-4bf7-4dc7-9bb9-b3fef81464ff',
  'scratchpad',
  'capture-home.json',
);

function countNodes(node: CaptureNode): number {
  let total = 1;
  for (const child of node.children) total += countNodes(child);
  return total;
}

function maxDepth(node: CaptureNode, depth = 1): number {
  if (node.children.length === 0) return depth;
  let deepest = depth;
  for (const child of node.children) {
    deepest = Math.max(deepest, maxDepth(child, depth + 1));
  }
  return deepest;
}

function collectText(node: CaptureNode, out: string[], limit: number): void {
  if (out.length >= limit) return;
  if (node.text && node.text.trim().length > 0) out.push(node.text.trim());
  for (const child of node.children) {
    if (out.length >= limit) return;
    collectText(child, out, limit);
  }
}

function findFirstHeading(node: CaptureNode): CaptureNode | null {
  if (/^h[1-6]$/.test(node.tag)) return node;
  for (const child of node.children) {
    const found = findFirstHeading(child);
    if (found) return found;
  }
  return null;
}

async function main(): Promise<void> {
  console.log(`Capturing ${TARGET_URL} ...`);

  let result: CaptureResult;
  try {
    result = await captureSite(TARGET_URL);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error('\n❌ Capture failed.');
    console.error(reason);
    if (/ECONNREFUSED|net::ERR|failed to load|Timeout/i.test(reason)) {
      console.error(
        '\nIs the dev server running? Start it with `npm run dev` and retry.',
      );
    }
    process.exitCode = 1;
    return;
  }

  result.capturedAt = new Date().toISOString();

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2), 'utf8');

  const nodeCount = countNodes(result.root);
  const depth = maxDepth(result.root);
  const sampleText: string[] = [];
  collectText(result.root, sampleText, 15);
  const heading = findFirstHeading(result.root);

  console.log('\n===== CAPTURE SUMMARY =====');
  console.log(`URL captured:     ${result.url}`);
  console.log(`Page title:       ${result.title}`);
  console.log(`Meta description: ${result.metaDescription ?? '(none)'}`);
  console.log(`Viewport:         ${result.viewport.width}x${result.viewport.height}`);
  console.log(`Total nodes:      ${nodeCount}`);
  console.log(`Max tree depth:   ${depth}`);
  console.log(`Font families:    ${result.fontFamilies.length}`);
  result.fontFamilies.slice(0, 6).forEach((f) => console.log(`   - ${f}`));

  console.log('\n----- First ~15 captured text strings (VERBATIM) -----');
  sampleText.forEach((t, i) => {
    const trimmed = t.length > 100 ? `${t.slice(0, 100)}…` : t;
    console.log(`  ${String(i + 1).padStart(2, ' ')}. ${JSON.stringify(trimmed)}`);
  });

  console.log('\n----- First heading node -----');
  if (heading) {
    console.log(`  tag:   <${heading.tag}>`);
    console.log(`  text:  ${JSON.stringify(heading.text ?? '(no direct text)')}`);
    console.log(`  rect:  ${JSON.stringify(heading.rect)}`);
    console.log('  styles:');
    for (const [k, v] of Object.entries(heading.styles)) {
      console.log(`     ${k}: ${v}`);
    }
  } else {
    console.log('  (no <h1>-<h6> found in capture)');
  }

  console.log(`\n✅ Wrote full JSON tree to:\n   ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
