import { spawn } from 'node:child_process';

const [root, script, timeoutValue, limitValue] = process.argv.slice(2);
const timeout = Number(timeoutValue);
const limit = Number(limitValue);
if (!root || !script || !Number.isSafeInteger(timeout) || timeout < 1 || !Number.isSafeInteger(limit) || limit < 1) {
  throw new Error('invalid local check worker arguments');
}
const child = spawn('pnpm', ['run', script], { cwd: root, env: process.env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
let timedOut = false;
let overflow = false;
let failure = '';
const stop = (): void => {
  if (!child.pid) return;
  try { process.kill(-child.pid, 'SIGKILL'); }
  catch (error) {
    // The owned process group may have exited before timeout or cleanup.
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') failure = String(error);
  }
};
const timer = setTimeout(() => { timedOut = true; stop(); }, timeout);
const collect = (chunk: Buffer): void => {
  output += chunk.toString('utf8');
  if (Buffer.byteLength(output) > limit) {
    output = Buffer.from(output).subarray(0, limit).toString('utf8');
    overflow = true;
    stop();
  }
};
child.stdout.on('data', collect);
child.stderr.on('data', collect);
child.on('error', error => { failure = error.message; });
child.on('exit', stop);
child.on('close', (exitCode, signal) => {
  clearTimeout(timer);
  const blocked = timedOut || overflow || failure !== '' || signal !== null;
  process.stdout.write(JSON.stringify({ status: blocked ? 'blocked' : exitCode === 0 ? 'pass' : 'fail',
    output: output + failure, exitCode, signal, timedOut, overflow }));
});
