import { writeFile } from 'node:fs/promises';
import { Session } from 'node:inspector/promises';

let measured;

async function begin(profilePath) {
  const session = profilePath ? new Session() : null;
  if (session) {
    session.connect();
    await session.post('Profiler.enable');
    await session.post('Profiler.setSamplingInterval', { interval: 1_000 });
    await session.post('Profiler.start');
  }
  let peakRss = process.memoryUsage.rss();
  const sampler = setInterval(() => {
    peakRss = Math.max(peakRss, process.memoryUsage.rss());
  }, 20).unref();
  measured = {
    session,
    profilePath,
    sampler,
    peakRss: () => Math.max(peakRss, process.memoryUsage.rss()),
    startCpu: process.cpuUsage(),
    startElapsed: performance.now(),
    startLoop: performance.eventLoopUtilization(),
  };
}

async function end() {
  const {
    session,
    profilePath,
    sampler,
    peakRss,
    startCpu,
    startElapsed,
    startLoop,
  } = measured;
  const wallMs = performance.now() - startElapsed;
  const cpu = process.cpuUsage(startCpu);
  const eventLoop = performance.eventLoopUtilization(startLoop);
  const memory = process.memoryUsage();
  clearInterval(sampler);
  if (session) {
    const { profile } = await session.post('Profiler.stop');
    session.disconnect();
    await writeFile(profilePath, JSON.stringify(profile));
  }
  return { wallMs, cpu, eventLoop, memory, peakRss: peakRss() };
}

process.on('message', async ({ command, profilePath }) => {
  try {
    const result = command === 'begin' ? await begin(profilePath) : await end();
    process.send({ result });
  } catch (error) {
    process.send({ error: error.message });
  }
});
