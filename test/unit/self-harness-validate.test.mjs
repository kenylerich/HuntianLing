import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const validate = join(root, '.agents/skills/huntianling-self-harness/validate.mjs');
const examples = join(root, '.agents/skills/huntianling-self-harness/examples');

function run(name) {
  return spawnSync(process.execPath, [validate, join(examples, name)], { encoding: 'utf8' });
}

test('mkt pass example validates', () => {
  const result = run('mkt-pass.json');
  assert.equal(result.status, 0, result.stderr);
});

test('planner pass example validates', () => {
  const result = run('planner-pass.json');
  assert.equal(result.status, 0, result.stderr);
});

test('evaluator pass example validates', () => {
  const result = run('evaluator-pass.json');
  assert.equal(result.status, 0, result.stderr);
});

test('mkt fail example is rejected', () => {
  const result = run('mkt-fail.json');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /rawQuotes/);
  assert.match(result.stderr, /technicalDesign/);
});

test('generator cannot self-accept', () => {
  const result = run('generator-fail.json');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /accepted/);
});

test('environment and generator cannot record missing or probe gates as pass', t => {
  const fixture = mkdtempSync(join(tmpdir(), 'htl-gate-sensor-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const sensor = join(fixture, '.agents/skills/huntianling-self-harness/validate.mjs');
  mkdirSync(dirname(sensor), { recursive: true });
  writeFileSync(sensor, readFileSync(validate));
  for (const scripts of [{}, { lint: 'echo HUNTIANLING_PROBE; exit 1' }]) {
    writeFileSync(join(fixture, 'package.json'), JSON.stringify({ scripts }));
    for (const name of ['environment-fail.json', 'generator-fail.json']) {
      const result = spawnSync(process.execPath, [sensor, join(examples, name)], { encoding: 'utf8' });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /lint cannot be pass/);
    }
  }
});

test('real gate scripts permit reporting observed lint and hygiene passes', t => {
  const fixture = mkdtempSync(join(tmpdir(), 'htl-gate-record-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const artifact = join(fixture, 'record.json');
  writeFileSync(artifact, JSON.stringify({ role: 'generator', files: ['package.json'], selfCheck: { lint: 'pass', hygiene: 'pass' } }));
  const result = spawnSync(process.execPath, [validate, artifact], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('repair loop writes evaluation on pass and handoff on fail', () => {
  const loop = join(root, '.agents/skills/huntianling-self-harness/repair-loop.mjs');
  const passDir = mkdtempSync(join(tmpdir(), 'self-harness-pass-'));
  const pass = spawnSync(process.execPath, [loop, '--slice', passDir, '--check', 'true'], { encoding: 'utf8' });
  assert.equal(pass.status, 0, pass.stderr);
  const evaluation = JSON.parse(readFileSync(join(passDir, 'evaluation-record.json'), 'utf8'));
  assert.equal(evaluation.decision, 'pass');
  const validatePass = spawnSync(process.execPath, [validate, join(passDir, 'evaluation-record.json')], {
    encoding: 'utf8',
  });
  assert.equal(validatePass.status, 0, validatePass.stderr);

  const failDir = mkdtempSync(join(tmpdir(), 'self-harness-fail-'));
  const fail = spawnSync(process.execPath, [loop, '--slice', failDir, '--check', 'false'], { encoding: 'utf8' });
  assert.equal(fail.status, 2);
  const repair = JSON.parse(readFileSync(join(failDir, 'repair-handoff.json'), 'utf8'));
  assert.equal(repair.role, 'repair');
  const validateRepair = spawnSync(process.execPath, [validate, join(failDir, 'repair-handoff.json')], {
    encoding: 'utf8',
  });
  assert.equal(validateRepair.status, 0, validateRepair.stderr);
});
