import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONCERN_KEYS,
  checkPreShow,
  validateGuidance,
  loadCatalogAndGuidance
} from '../scripts/validate-guidance.mjs';
import { dataFiles } from '../scripts/data-version.mjs';

// Node-native unit tests for scripts/validate-guidance.mjs, the checker for
// data-guidance.js (per-movie concerns + Pre-Show OpenUI Lang programs).
// Run via `npm run test:unit`.

const movie = {
  num: 1,
  t: 'Test Movie',
  full: 'The mother is ill and hospitalized. A grumpy troll chases the kids.'
};

function concerns(overrides = {}) {
  const base = Object.fromEntries(CONCERN_KEYS.map(key => [key, { level: 'no', quote: '' }]));
  return { ...base, ...overrides };
}

const goodPreShow = [
  'root = Card([hdr, after])',
  'hdr = CardHeader("Test Movie · 2001", "Pixar · 90 min · CSM 6+")',
  'after = TextContent("Ask after: who was brave?", "small")'
].join('\n');

test('checkPreShow accepts a Card program built from library components', () => {
  assert.deepEqual(checkPreShow(goodPreShow), []);
  assert.deepEqual(checkPreShow('root = Card([note])\nnote = TextContent("Gentle. Nothing to prep for.", "small")'), []);
});

test('checkPreShow rejects missing required props, unused statements, and a non-Card root', () => {
  assert.ok(checkPreShow('root = Card([w])\nw = Callout("warning")').some(p => p.includes('missing required')));
  assert.ok(checkPreShow(goodPreShow + '\nextra = TextContent("never used")').some(p => p.includes('unused')));
  assert.ok(checkPreShow('root = TextContent("hi")').some(p => p.includes('root must be a Card')));
  assert.ok(checkPreShow('').length > 0);
});

test('validateGuidance passes a well-formed entry with a verbatim quote', () => {
  const guidance = {
    1: { concerns: concerns({ parentInDanger: { level: 'mild', quote: 'The mother is ill and hospitalized' } }), preShow: goodPreShow }
  };
  const result = validateGuidance([movie], guidance);
  assert.deepEqual(result.errors, []);
  assert.equal(result.covered, 1);
});

test('validateGuidance flags a quote that is not word for word from full', () => {
  const guidance = {
    1: { concerns: concerns({ scaryVillain: { level: 'yes', quote: 'A scary troll chases the kids' } }), preShow: goodPreShow }
  };
  const { errors } = validateGuidance([movie], guidance);
  assert.ok(errors.some(e => e.includes('not verbatim')));
});

test('validateGuidance flags bad levels, missing keys, "no" with a quote, and missing entries', () => {
  const broken = concerns({ rudeHumor: { level: 'maybe', quote: '' }, animalPeril: { level: 'no', quote: 'troll' } });
  delete broken.sadOrLoss;
  const { errors, covered } = validateGuidance([movie, { ...movie, num: 2 }], { 1: { concerns: broken, preShow: goodPreShow }, 99: {} });
  assert.ok(errors.some(e => e.includes('rudeHumor.level')));
  assert.ok(errors.some(e => e.includes('missing concern sadOrLoss')));
  assert.ok(errors.some(e => e.includes('animalPeril is "no" but has a quote')));
  assert.ok(errors.some(e => e.includes('guidance 2 Test Movie: missing entry')));
  assert.ok(errors.some(e => e.includes('guidance 99: no matching movie')));
  assert.equal(covered, 1);
});

test('the shipped data-guidance.js covers every movie with no errors', () => {
  const { movies, guidance } = loadCatalogAndGuidance(dataFiles);
  const { errors, covered, total } = validateGuidance(movies, guidance);
  assert.deepEqual(errors, []);
  assert.equal(covered, total);
});
