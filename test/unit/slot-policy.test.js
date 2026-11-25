import assert from 'node:assert/strict';
import { test } from 'node:test';
import { slotIssue } from '../../src/domain/slot-policy.js';

test('allows a future free slot', () => {
  assert.equal(slotIssue({ startsAt: 101, occupied: false }, 100), null);
});

test('rejects a future occupied slot', () => {
  assert.equal(
    slotIssue({ startsAt: 101, occupied: true }, 100),
    'slot_occupied',
  );
});

test('reports a missing slot', () => {
  assert.equal(slotIssue(null, 100), 'slot_not_found');
});

test('rejects a slot that has already started before checking occupancy', () => {
  assert.equal(
    slotIssue({ startsAt: 99, occupied: true }, 100),
    'slot_started',
  );
});

test('rejects a slot at the exact instant it starts', () => {
  assert.equal(
    slotIssue({ startsAt: 100, occupied: false }, 100),
    'slot_started',
  );
});
