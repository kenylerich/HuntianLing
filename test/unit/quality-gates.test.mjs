import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkManifestAndImports } from '../../scripts/hygiene.mjs';
import { checkCoverageInventory } from '../../scripts/coverage.mjs';

function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'htl-quality-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const name of ['src', 'scripts', 'test']) mkdirSync(join(root, name));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'fixture', type: 'module',
    engines: { node: '>=24' }, exports: { '.': { types: './lib/index.d.ts', default: './lib/index.js' } },
    dependencies: { approved: '1.0.0' }, devDependencies: { development: '1.0.0' } }));
  return root;
}

test('hygiene rejects undeclared runtime imports in static, dynamic, template and type forms', t => {
  const root = fixture(t);
  for (const source of ['import "development";', 'import("development");', 'import(`development`);', 'type Value = typeof import("development");']) {
    writeFileSync(join(root, 'src/index.ts'), source);
    assert.match(checkManifestAndImports(root).join('\n'), /undeclared dependency development/);
  }
  writeFileSync(join(root, 'src/index.ts'), 'import "approved"; import "node:fs";');
  writeFileSync(join(root, 'scripts/check.mjs'), 'import "development";');
  assert.deepEqual(checkManifestAndImports(root), []);
});

test('coverage inventory rejects empty reports, missing files, unknown and insufficient percentages', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'src/index.ts'), 'export const answer = 42;');
  const file = join(root, 'src/index.ts');
  assert.match(checkCoverageInventory(root, {}).join('\n'), /missing source/);
  assert.match(checkCoverageInventory(root, { total: {} }).join('\n'), /missing source/);
  const metrics = Object.fromEntries(['lines', 'statements', 'functions', 'branches'].map(name => [name, { pct: 100 }]));
  assert.deepEqual(checkCoverageInventory(root, { [file]: metrics }), []);
  for (const pct of ['Unknown', 99, Number.NaN]) {
    assert.match(checkCoverageInventory(root, { [file]: { ...metrics, branches: { pct } } }).join('\n'), /required 100%/);
  }
  writeFileSync(join(root, 'src/unmeasured.ts'), 'export const missing = 0;');
  assert.match(checkCoverageInventory(root, { [file]: metrics }).join('\n'), /unmeasured.ts/);
});
