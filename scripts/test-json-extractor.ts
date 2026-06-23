/**
 * UNIT TEST (deterministic, no LLM): proves the new robust JSON extractor fixes the
 * ensemble double-emit failure — extracting balanced objects, ignoring trailing content,
 * and respecting braces inside string literals.
 *
 * Run: npx tsx scripts/test-json-extractor.ts
 */

/* eslint-disable no-console */

import { __internal } from '../src/lib/agents/content/shot-plan/planner';

const { extractJsonObjectCandidates, parseLlmShotPlan } = __internal;

let failures = 0;
function check(name: string, cond: boolean, detail?: string): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  if (!cond) failures++;
}

// 1. Single clean object → one candidate.
check('single object', extractJsonObjectCandidates('{"a":1}').length === 1);

// 2. The actual ensemble failure shape: object then a SECOND object after it.
const two = extractJsonObjectCandidates('{"a":1}\n{"b":2,"c":[1,2]}');
check('double-emit → two candidates', two.length === 2, `got ${two.length}`);
check('double-emit → first object intact', two[0] === '{"a":1}', two[0]);

// 3. Trailing prose after a complete object (another way JSON.parse throws).
const withProse = extractJsonObjectCandidates('{"x":true} and that is my final answer.');
check('trailing prose ignored', withProse.length === 1 && withProse[0] === '{"x":true}', withProse[0]);

// 4. Braces INSIDE string literals must NOT split the object.
const braceString = extractJsonObjectCandidates('{"note":"a } brace { inside","n":2}');
check('braces in strings respected', braceString.length === 1, `got ${braceString.length}`);

// 5. Escaped quote inside a string must not end the string early.
const escaped = extractJsonObjectCandidates('{"q":"she said \\"hi}\\" ok","n":3}');
check('escaped quotes respected', escaped.length === 1, `got ${escaped.length}`);

// 6. parseLlmShotPlan picks the VALID object even when an invalid object precedes it.
//    (A bare {"junk":1} fails the schema; the real plan must win.)
const validPlanInner = JSON.stringify({
  title: 'Test',
  sharedChoices: {
    cutCount: 1,
    timePeriod: 'present day',
    genre: 'test',
    colorPalette: [
      { name: 'Ink', hex: '#111111' },
      { name: 'Paper', hex: '#eeeeee' },
    ],
    environmentFingerprint: 'a plain test room',
    cast: [],
    moodKeywords: ['calm', 'plain', 'neutral'],
    cinematographyNotes: ['locked-off frame', 'soft key'],
    artStyle: 'photoreal',
    lookBible: {
      movieLook: 'clean commercial',
      filmStock: 'digital',
      camera: 'ARRI Alexa',
      lensType: 'prime',
      focalLength: '35mm',
      videographerStyle: 'measured, locked-off',
      filters: ['none'],
      temperature: 0.5,
      aspectRatio: '16:9',
      artStyle: 'photoreal',
      composition: 'centered',
      lighting: 'soft key',
      atmosphere: 'neutral',
    },
  },
  floorPlan: {},
  shots: [
    {
      id: 's1',
      title: 'Only shot',
      action: 'A thing happens on screen for the test.',
      cast: [],
      environment: 'a plain test room',
      camera: { shotType: 'wide', movement: 'static' },
      lighting: 'soft',
      mood: 'calm',
      durationSeconds: 4,
      transitionIn: 'cut',
      timeOfDay: 'day',
      weather: 'clear',
    },
  ],
  layout: { rows: [{ heightWeight: 1, blocks: [{ type: 'storyboard', widthWeight: 1 }] }] },
});

const mixed = `{"junk":1}\n${validPlanInner}`;
const parsed = parseLlmShotPlan(mixed);
check('parseLlmShotPlan recovers the valid plan past junk', parsed.ok, parsed.ok ? '' : parsed.error);
if (parsed.ok) {
  check('recovered plan has the test title', parsed.data.title === 'Test');
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
