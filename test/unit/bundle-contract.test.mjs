import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const declaredPatch = manifest.dsh?.bundle?.patch;

test('package declares one packaged DSH bundle patch', () => {
  assert.equal(declaredPatch, './cordis.patch.yml');
  assert.ok(manifest.files.includes('cordis.patch.yml'));
  assert.equal(manifest.exports['./cordis.patch.yml'], './cordis.patch.yml');
});

test('bundle patch inserts one stable inert HuntianLing host row', () => {
  const source = readFileSync(join(root, declaredPatch), 'utf8');
  assert.equal((source.match(/^\s*- id: huntianling$/gm) ?? []).length, 1);
  assert.match(source, /^\s+name: '@kenylerich\/dsh-huntianling\/host'$/m);
  assert.match(source, /^\s+enabled: false$/m);
  assert.match(source, /^\s+autoStart: false$/m);
  assert.doesNotMatch(source, /(api[_-]?key|token|password|secret)\s*:/i);
});

test('declared host export imports the root plugin', async () => {
  const host = await import('../../lib/host/plugin.js');
  assert.equal(host.default?.name, 'huntianling:root');
  assert.equal(typeof host.default?.apply, 'function');
});
