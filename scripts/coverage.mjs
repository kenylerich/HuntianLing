import { readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);

export function checkCoverageInventory(directory, report) {
  const expected = [];
  function walk(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) expected.push(realpathSync(file));
    }
  }
  walk(join(directory, 'src'));
  const errors = [];
  if (expected.length === 0) errors.push('coverage requires nonempty product sources');
  for (const file of expected) {
    const row = report[file];
    if (!row) { errors.push(`coverage missing source: ${relative(directory, file)}`); continue; }
    for (const metric of ['lines', 'statements', 'functions', 'branches']) {
      if (typeof row[metric]?.pct !== 'number' || row[metric].pct !== 100) {
        errors.push(`${relative(directory, file)} ${metric}: ${String(row[metric]?.pct)}; required 100%`);
      }
    }
  }
  return errors;
}

function main() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_V8_COVERAGE;
  const options = { cwd: root, env, stdio: 'inherit' };
  const built = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-b', 'tsconfig.src.json', '--force'], options);
  if (built.error || built.status !== 0) { process.exitCode = 1; return; }
  const summary = join(root, 'coverage/coverage-summary.json');
  rmSync(summary, { force: true });
  const tests = readdirSync(join(root, 'test/unit')).filter(name => name.endsWith('.test.mjs')).map(name => join('test/unit', name));
  if (tests.length === 0) throw new Error('coverage requires test files');
  const measured = spawnSync(process.execPath, [require.resolve('c8/bin/c8.js'), '--all', '--src', 'lib',
    '--include', 'lib/**/*.js', '--include', 'src/**/*.ts', '--exclude-after-remap', '--check-coverage', '--per-file',
    '--lines', '100', '--branches', '100', '--functions', '100', '--statements', '100',
    '--reporter', 'text', '--reporter', 'json-summary', process.execPath, '--test', ...tests], options);
  const errors = checkCoverageInventory(root, JSON.parse(readFileSync(summary, 'utf8')));
  for (const error of errors) console.error(error);
  process.exitCode = measured.error || measured.status !== 0 || errors.length > 0 ? 1 : 0;
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) main();
