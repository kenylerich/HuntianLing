#!/usr/bin/env node
/**
 * Evaluator check loop. On failure writes a repair handoff for Generator.
 * Does not invoke a model. The Generator (human or external Agent) applies
 * the handoff and re-runs this command.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = parseArgs(process.argv.slice(2));
if (!args.slice || !args.check) {
  console.error('usage: node repair-loop.mjs --slice <dir> --check <command> [--max 5]');
  process.exit(2);
}

const max = args.max ?? 5;
const sliceDir = args.slice;
mkdirSync(sliceDir, { recursive: true });

let round = 0;
while (round < max) {
  round += 1;
  const result = spawnSync(args.check, {
    shell: true,
    encoding: 'utf8',
    env: process.env,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.status === 0) {
    const evaluation = {
      schemaVersion: 1,
      role: 'evaluator',
      independent: true,
      criteria: [
        {
          id: 'check-command',
          result: 'pass',
          evidence: args.check,
        },
      ],
      decision: 'pass',
      round,
    };
    const evaluationPath = join(sliceDir, 'evaluation-record.json');
    writeFileSync(evaluationPath, `${JSON.stringify(evaluation, null, 2)}\n`);
    console.log(`${evaluationPath}: pass (round ${round})`);
    process.exit(0);
  }

  const repair = {
    schemaVersion: 1,
    role: 'repair',
    from: 'evaluator',
    to: 'generator',
    handoffKind: 'repair',
    round,
    failedCriteria: ['check-command'],
    command: args.check,
    output: output.slice(-8000),
  };
  const repairPath = join(sliceDir, 'repair-handoff.json');
  writeFileSync(repairPath, `${JSON.stringify(repair, null, 2)}\n`);
  console.error(`${repairPath}: revision-required (round ${round}/${max})`);
  if (round >= max) {
    process.exit(1);
  }
  process.exit(2);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--') continue;
    if (token === '--slice') {
      parsed.slice = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--check') {
      parsed.check = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--max') {
      parsed.max = Number(argv[i + 1]);
      i += 1;
    }
  }
  return parsed;
}
