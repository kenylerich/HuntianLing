#!/usr/bin/env node
// HUNTIANLING_PROBE_STUB
//
// HuntianLing does not own a multi-platform CI matrix (the host dsh repo
// owns that script). This stub exists only so that the dsh-copied
// landlock-run.yml workflow can step past
// `node ./scripts/github-matrix.mjs ci` while we evaluate workflow fit.
//
// Emits a single `ci=` line into $GITHUB_OUTPUT so consumers can read it.

import process from 'node:process';
import fs from 'node:fs';

const name = process.argv[2] ?? 'unknown';
const value = JSON.stringify({ name, os: [process.platform], node: [process.version] });

const outputPath = process.env.GITHUB_OUTPUT;
if (outputPath) {
  fs.appendFileSync(outputPath, `ci=${value}\n`);
} else {
  process.stdout.write(`ci=${value}\n`);
}
