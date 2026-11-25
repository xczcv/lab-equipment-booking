import { readFile } from 'node:fs/promises';

const round = (value) => Number(value.toFixed(3));

export function distribution(values) {
  const ordered = [...values].sort((a, b) => a - b);
  const percentile = (point) =>
    round(ordered[Math.ceil(point * ordered.length) - 1]);
  return { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99) };
}

export function summarize(samples, metrics) {
  const operations = new Map();
  const status = {};
  const dbTimes = samples.map((sample) => {
    status[sample.status] = (status[sample.status] ?? 0) + 1;
    let total = 0;
    for (const [name, duration] of sample.db) {
      if (!operations.has(name)) operations.set(name, []);
      operations.get(name).push(duration);
      total += duration;
    }
    return total;
  });
  const cpuMs = (metrics.cpu.user + metrics.cpu.system) / 1_000;
  return {
    requests: samples.length,
    status,
    latencyMs: distribution(samples.map(({ latencyMs }) => latencyMs)),
    serverMs: distribution(samples.map(({ serverMs }) => serverMs)),
    dbMs: distribution(dbTimes),
    dbByOperationMs: Object.fromEntries(
      [...operations].map(([name, values]) => [name, distribution(values)]),
    ),
    elapsedMs: round(metrics.wallMs),
    cpuMs: round(cpuMs),
    cpuPercentOfOneCore: round((cpuMs / metrics.wallMs) * 100),
    peakRssMiB: round(metrics.peakRss / 1_048_576),
    finalHeapMiB: round(metrics.memory.heapUsed / 1_048_576),
    loopActiveMs: round(metrics.eventLoop.active),
    loopIdleMs: round(metrics.eventLoop.idle),
  };
}

export async function summarizeProfile(path) {
  const profile = JSON.parse(await readFile(path, 'utf8'));
  const frames = new Map(
    profile.nodes.map(({ callFrame, id }) => [id, callFrame]),
  );
  const times = new Map();
  const entries = profile.samples ?? [];
  for (const [position, id] of entries.entries()) {
    const frame = frames.get(id);
    const url = frame.url.replace(new URL('../', import.meta.url).href, '');
    const name =
      (frame.functionName || '(anonymous)') +
      (url ? ' · ' + url.split('/node_modules/').pop() : '');
    times.set(name, (times.get(name) ?? 0) + profile.timeDeltas[position]);
  }
  const sorted = [...times].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [, time]) => sum + time, 0);
  const idle = times.get('(idle)') ?? 0;
  return {
    samples: entries.length,
    idlePercent: round((idle / total) * 100),
    topActiveFrames: sorted
      .filter(([name]) => name !== '(idle)')
      .slice(0, 12)
      .map(([frame, micros]) => ({ frame, ms: round(micros / 1_000) })),
  };
}
