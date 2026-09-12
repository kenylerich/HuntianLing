import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
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

test('generator cannot self-accept or pass probe lint', () => {
  const result = run('generator-fail.json');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /lint/);
  assert.match(result.stderr, /accepted/);
});

test('environment cannot record probe lint as pass', () => {
  const result = run('environment-fail.json');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /lint cannot be pass/);
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
