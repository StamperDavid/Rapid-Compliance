/**
 * verify-sequence-scheduler-parser.ts
 *
 * Standalone unit check for the Stage A.5 cadence parser. Does not hit
 * Firestore — just validates that parseCadenceToOffsetDays produces sane
 * offsets for the fixture shapes the Copywriter and Jasper prompt examples
 * actually emit.
 *
 * Run:
 *   npx tsx scripts/verify-sequence-scheduler-parser.ts
 */

import { parseCadenceToOffsetDays, type SequenceEmail } from '../src/lib/workflows/sequence-scheduler';

interface Case {
  name: string;
  emails: SequenceEmail[];
  cadence?: string;
  expected: number[];
}

const SAMPLE_EMAIL = (order: number, hint?: string): SequenceEmail => ({
  order,
  subjectLine: `Email ${order}`,
  body: 'body',
  sendTimingHint: hint,
});

const cases: Case[] = [
  {
    name: 'per-email sendTimingHint: day 1, day 3, day 7',
    emails: [
      SAMPLE_EMAIL(1, 'day 1'),
      SAMPLE_EMAIL(2, 'day 3'),
      SAMPLE_EMAIL(3, 'day 7'),
    ],
    expected: [0, 2, 6],
  },
  {
    name: 'per-email immediately + wait hints',
    emails: [
      SAMPLE_EMAIL(1, 'immediately on trigger'),
      SAMPLE_EMAIL(2, 'wait 3 days'),
      SAMPLE_EMAIL(3, '7 days after trigger'),
    ],
    expected: [0, 3, 7],
  },
  {
    name: 'top-level cadence "day 1, day 3, day 6, day 10, day 14"',
    emails: [1, 2, 3, 4, 5].map((n) => SAMPLE_EMAIL(n)),
    cadence: 'day 1, day 3, day 6, day 10, day 14',
    expected: [0, 2, 5, 9, 13],
  },
  {
    name: 'top-level cadence "over 14 days" evenly divided',
    emails: [1, 2, 3, 4, 5].map((n) => SAMPLE_EMAIL(n)),
    cadence: 'over 14 days',
    expected: [0, 3.5, 7, 10.5, 14],
  },
  {
    name: 'top-level cadence "every 2 days"',
    emails: [1, 2, 3].map((n) => SAMPLE_EMAIL(n)),
    cadence: 'every 2 days',
    expected: [0, 2, 4],
  },
  {
    name: 'no hints, no cadence → daily fallback',
    emails: [1, 2, 3].map((n) => SAMPLE_EMAIL(n)),
    expected: [0, 1, 2],
  },
  {
    name: 'single email immediate fire',
    emails: [SAMPLE_EMAIL(1, 'immediately')],
    expected: [0],
  },
];

let pass = 0;
let fail = 0;
for (const c of cases) {
  const actual = parseCadenceToOffsetDays(c.emails, c.cadence);
  const actualRounded = actual.map((v) => Math.round(v * 100) / 100);
  const expectedRounded = c.expected.map((v) => Math.round(v * 100) / 100);
  const match =
    actualRounded.length === expectedRounded.length &&
    actualRounded.every((v, i) => v === expectedRounded[i]);
  if (match) {
    console.log(`PASS  ${c.name}`);
    console.log(`      got: ${JSON.stringify(actualRounded)}`);
    pass++;
  } else {
    console.log(`FAIL  ${c.name}`);
    console.log(`      got:      ${JSON.stringify(actualRounded)}`);
    console.log(`      expected: ${JSON.stringify(expectedRounded)}`);
    fail++;
  }
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail === 0 ? 0 : 1);
