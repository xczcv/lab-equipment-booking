import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { availableParallelism, cpus, release } from 'node:os';
import { join, resolve } from 'node:path';
import { fixture, withFixture, writeQueryPlan } from './fixture.js';
import { inspectServer } from './monitor.js';
import { summarize, summarizeProfile } from './report.js';
import { scenarios, workload } from './workload.js';

const mode = process.argv[2];
if (!['load', 'profile'].includes(mode))
  throw new Error('Expected load or profile');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (git('status', '--porcelain'))
  throw new Error('Commit project files before measuring a Git revision');
const sha = git('rev-parse', 'HEAD');
const startedAt = new Date().toISOString();
const directory = resolve(
  '.local/bench',
  mode + '-' + sha.slice(0, 7) + '-' + startedAt.replaceAll(':', ''),
);
await mkdir(directory, { recursive: true });
const report = {
  sha,
  mode,
  startedAt,
  fixture,
  workload,
  host: {
    platform: process.platform,
    release: release(),
    arch: process.arch,
    cpu: cpus()[0].model,
    parallelism: availableParallelism(),
    node: process.version,
  },
  rounds: [],
};

const write = (name, data) =>
  writeFile(join(directory, name), JSON.stringify(data, null, 2) + '\n');
for (let round = 1; round <= (mode === 'load' ? 3 : 1); round += 1) {
  const result = await withFixture(async ({ url, pool, ...dataset }) => {
    const result = { round, dataset, scenarios: {} };
    if (round === 1) await writeQueryPlan(pool, directory, sha);
    for (const [name, scenario] of Object.entries(scenarios)) {
      const profilePath =
        mode === 'profile' ? join(directory, name + '.cpuprofile') : undefined;
      result.scenarios[name] = await inspectServer(url, sha, async (server) => {
        await scenario(server.base, true);
        server.clearTraces();
        await server.command({ command: 'begin', profilePath });
        const responses = await scenario(server.base, false);
        const metrics = await server.command({ command: 'end' });
        const samples = await server.correlated(responses);
        const stats = summarize(samples, metrics);
        await write('round-' + round + '-' + name + '-samples.json', samples);
        if (profilePath) stats.profile = await summarizeProfile(profilePath);
        return stats;
      });
    }
    return result;
  });
  report.rounds.push(result);
  console.log(JSON.stringify(result));
}
await write('result.json', report);
console.log('Saved ' + directory);
