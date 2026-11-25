import assert from 'node:assert/strict';
import { fixture } from './fixture.js';

export const workload = {
  concurrency: 12,
  browseRequests: 1_800,
  bookingBatches: 100,
  warmupBrowse: 120,
  warmupBatches: 8,
};

async function send(base, route, options) {
  const start = performance.now();
  const response = await fetch(base + route, {
    ...options,
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json();
  return {
    latencyMs: performance.now() - start,
    status: response.status,
    processId: response.headers.get('x-business-process-id'),
    body,
  };
}

function dateAt(day) {
  return new Date(Date.parse(fixture.firstDate) + day * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

async function browse(base, warmup) {
  const total = warmup ? workload.warmupBrowse : workload.browseRequests;
  const samples = new Array(total);
  const { concurrency } = workload;
  await Promise.all(
    Array.from({ length: concurrency }, async (_, worker) => {
      for (let index = worker; index < total; index += concurrency) {
        const equipmentId = 3 + (index % (fixture.equipment - 2));
        const day = Math.floor(index / (fixture.equipment - 2)) % fixture.days;
        const route =
          '/equipment/' + equipmentId + '/slots?date=' + dateAt(day);
        const { body, ...sample } = await send(base, route);
        assert.equal(sample.status, 200);
        assert.ok(body.length === 25 || body.length === 26);
        samples[index] = sample;
      }
    }),
  );
  return samples;
}

async function reserve(base, warmup) {
  const batchCount = warmup ? workload.warmupBatches : workload.bookingBatches;
  const firstSlot = warmup ? 1 : 1 + workload.warmupBatches;
  const samples = [];
  for (let offset = 0; offset < batchCount; offset += 1) {
    const slotId = firstSlot + offset;
    const batch = await Promise.all(
      Array.from({ length: workload.concurrency }, async (_, student) => {
        const { body, ...sample } = await send(base, '/bookings', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-user-id': student % 2 === 0 ? 'student-a' : 'student-b',
            'idempotency-key': 'bench-' + slotId + '-' + student,
          },
          body: JSON.stringify({ slotId }),
        });
        if (sample.status === 409)
          assert.deepEqual(body, { error: 'slot_occupied' });
        else {
          assert.equal(sample.status, 201);
          assert.equal(body.slotId, slotId);
        }
        return sample;
      }),
    );
    assert.equal(batch.filter(({ status }) => status === 201).length, 1);
    samples.push(...batch);
  }
  return samples;
}

export const scenarios = { browse, reserve };
