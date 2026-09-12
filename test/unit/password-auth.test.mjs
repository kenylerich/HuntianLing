import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createBoardService } from '../../lib/host/board/plugin.js';
import { createDatabaseService } from '../../lib/host/database/service.js';
import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import {
  createPbkdf2PasswordHash,
  createPasswordHash,
  verifyPasswordHash,
  WebAuthManager,
  publicCredentialStatus,
  resolveWebAuthConfig,
} from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

const FAST_ARGON = { algorithm: 'argon2id', argon2Memory: 32, argon2Passes: 1, argon2Parallelism: 1 };

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

test('a newly stored password uses Argon2id with salt and algorithm parameters', () => {
  const encoded = createPasswordHash('correct-password', FAST_ARGON);
  assert.match(encoded, /^argon2id\$m=32,t=1,p=1\$/);
  assert.equal(verifyPasswordHash('correct-password', encoded), true);
  assert.equal(verifyPasswordHash('wrong-password', encoded), false);
  assert.equal(encoded.includes('correct-password'), false);
});

test('bcrypt and PBKDF2 hashes remain accepted fallbacks', () => {
  const pbkdf2 = createPbkdf2PasswordHash('correct-password', { iterations: 1_000 });
  const bcrypt = createPasswordHash('correct-password', { algorithm: 'bcrypt', bcryptCost: 4 });
  assert.match(pbkdf2, /^pbkdf2-sha256\$/);
  assert.match(bcrypt, /^\$2[aby]\$/);
  assert.equal(verifyPasswordHash('correct-password', pbkdf2), true);
  assert.equal(verifyPasswordHash('correct-password', bcrypt), true);
  assert.equal(verifyPasswordHash('wrong-password', pbkdf2), false);
  assert.equal(verifyPasswordHash('wrong-password', bcrypt), false);
});

test('password rotation replaces the stored hash and disable blocks login', async () => {
  const hash = createPbkdf2PasswordHash('correct-password', { iterations: 1_000 });
  const root = mkdtempSync(join(tmpdir(), 'huntianling-password-'));
  const database = createDatabaseService({ workspaceRoot: root });
  const board = createBoardService(root, { database });
  const requirements = createRequirementManagementService(board);
  const web = createWebService(
    { board, requirements, database },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        argon2Memory: 32,
        argon2Passes: 1,
        argon2Parallelism: 1,
        users: [{ username: 'dev', passwordHash: hash, audience: 'developer' }],
      },
    },
  );
  await web.start();
  const base = web.url();
  const login = await json(`${base}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  assert.equal(login.response.status, 200);
  const cookie = login.response.headers.get('set-cookie');
  const rotated = await json(`${base}/api/auth/password/rotate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ currentPassword: 'correct-password', newPassword: 'next-password' }),
  });
  assert.equal(rotated.response.status, 200);
  assert.equal(rotated.payload.algorithm, 'argon2id');
  assert.equal(rotated.payload.passwordHash, undefined);
  assert.equal(JSON.stringify(rotated.payload).includes('next-password'), false);

  const oldLogin = await json(`${base}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  assert.equal(oldLogin.response.status, 401);

  const newLogin = await json(`${base}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'next-password' }),
  });
  assert.equal(newLogin.response.status, 200);

  const persisted = database.getCredential('dev');
  assert.equal(persisted?.algorithm, 'argon2id');
  assert.equal(verifyPasswordHash('next-password', persisted.passwordHash), true);

  await web.stop();
  database.close();
});

test('a disabled credential cannot log in', () => {
  const hash = createPbkdf2PasswordHash('correct-password', { iterations: 1_000 });
  const manager = new WebAuthManager(resolveWebAuthConfig({
    enabled: true,
    users: [{ username: 'dev', passwordHash: hash, audience: 'developer' }],
  }));
  manager.setCredentialEnabled('dev', false);
  assert.throws(
    () => manager.login({ username: 'dev', password: 'correct-password' }),
    (error) => error.statusCode === 403 && error.message === 'credential is disabled',
  );
  assert.equal(errorOmitsSecret(manager), true);
});

function errorOmitsSecret(manager) {
  try {
    manager.login({ username: 'dev', password: 'correct-password' });
    return false;
  } catch (error) {
    const text = String(error.message);
    return !text.includes('correct-password') && !text.includes('pbkdf2-sha256');
  }
}

test('public credential status omits the password hash', () => {
  const hash = createPbkdf2PasswordHash('correct-password', { iterations: 1_000 });
  const manager = new WebAuthManager(resolveWebAuthConfig({
    enabled: true,
    users: [{ username: 'dev', passwordHash: hash, audience: 'developer' }],
  }));
  const status = manager.credentialStatus('dev');
  const published = publicCredentialStatus(status);
  assert.equal(published.passwordHash, undefined);
  assert.equal(published.username, 'dev');
});
