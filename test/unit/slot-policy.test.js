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
