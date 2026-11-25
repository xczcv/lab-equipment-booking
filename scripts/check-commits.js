import { execFileSync } from 'node:child_process';

const range = process.argv[2];
if (!range) throw new Error('Supply a Git revision or range');
const conventional =
  /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([a-z0-9/-]+\))?!?: \S.*$/;
const format = '--format=%h%x09%s';
const args = range.includes('..') ? [range] : ['-1', range];
const commits = execFileSync(
  'git',
  ['log', '--no-merges', format, ...args, '--'],
  { encoding: 'utf8' },
)
  .trimEnd()
  .split('\n')
  .filter(Boolean);
for (const commit of commits) {
  const subject = commit.slice(commit.indexOf('\t') + 1);
  if (conventional.test(subject)) continue;
  console.error('Invalid Conventional Commit: ' + commit);
  process.exitCode = 1;
}
if (!process.exitCode)
  console.log('Conventional Commits checked: ' + commits.length);
