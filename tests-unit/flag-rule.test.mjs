import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { baseLevel, deriveFlags, holdReason, CATEGORY_SOURCES, FLAG_RULE_VERSION } from '../scripts/flag-rule.mjs';

test('base map: 0->1, 1->2, 2->2, 3->3, 4->4, 5->4', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(baseLevel), [1, 2, 2, 3, 4, 4]);
  assert.throws(() => baseLevel(6));
  assert.throws(() => baseLevel(-1));
  assert.throws(() => baseLevel(2.5));
});

test('csm sex feeds romance and csm drugs feeds drinking', () => {
  assert.deepEqual(deriveFlags({ v: 0, s: 3, l: 1, d: 2 }), { violence: 1, language: 2, romance: 3, drinking: 2 });
  assert.equal(CATEGORY_SOURCES.romance, 's');
  assert.equal(CATEGORY_SOURCES.drinking, 'd');
});

test('a text bump is exactly +1 and caps at 4', () => {
  const adj = { violence: { kind: 'depicted' } };
  assert.equal(deriveFlags({ v: 3, s: 0, l: 0, d: 0 }, adj).violence, 4);
  assert.equal(deriveFlags({ v: 4, s: 0, l: 0, d: 0 }, adj).violence, 4);
  assert.equal(deriveFlags({ v: 0, s: 0, l: 0, d: 0 }, adj).violence, 2);
  assert.equal(deriveFlags({ v: 3, s: 0, l: 0, d: 0 }, adj).language, 1);
});

test('hold-outs: any score of 4+ or an age of 10+', () => {
  assert.equal(holdReason({ v: 3, s: 2, l: 2, d: 1, age: 9 }), null);
  assert.match(holdReason({ v: 4, s: 0, l: 0, d: 0, age: 6 }), /score of 4/);
  assert.match(holdReason({ v: 1, s: 5, l: 0, d: 0, age: 6 }), /score of 4/);
  assert.match(holdReason({ v: 3, s: 2, l: 2, d: 1, age: 10 }), /age of 10/);
});

// The 108 already-flagged titles the rule was calibrated on. The rule must
// never come out ABOVE an existing flag, and an existing flag is never more
// than one level above it (that gap is the recorded text bump). If this fails
// after a change to the base map, the change makes new flags too high or
// leaves existing human bumps unexplained: bump FLAG_RULE_VERSION and
// re-review, do not just edit the fixture.
test('calibration fixture: existing flags are never below the rule and at most one above', () => {
  const lines = fs.readFileSync(new URL('./fixtures/flag-calibration.tsv', import.meta.url), 'utf8').trim().split('\n').slice(1);
  assert.equal(lines.length, 108);
  let above = 0;
  for (const line of lines) {
    const [num, v, s, l, d, , fv, fl, fr, fd] = line.split('\t').map(Number);
    const base = deriveFlags({ v, s, l, d });
    const actual = { violence: fv, language: fl, romance: fr, drinking: fd };
    for (const id of Object.keys(actual)) {
      const gap = actual[id] - base[id];
      assert.ok(gap >= 0, `#${num} ${id}: existing flag ${actual[id]} is below the rule's ${base[id]}`);
      assert.ok(gap <= 1, `#${num} ${id}: existing flag ${actual[id]} is more than one above the rule's ${base[id]}`);
      if (gap === 1) above++;
    }
  }
  assert.equal(above, 17, 'the 17 known text bumps in the calibration sample');
});

test('rule version is a positive integer', () => {
  assert.ok(Number.isInteger(FLAG_RULE_VERSION) && FLAG_RULE_VERSION >= 1);
});
