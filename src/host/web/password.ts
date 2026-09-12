/**
 * Password hashing: Argon2id preferred, bcrypt and PBKDF2-SHA256 as fallbacks.
 * Stored records are salted hashes plus algorithm parameters, never passwords.
 */

import { argon2Sync, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { compareSync, hashSync } from 'bcryptjs';

export const PASSWORD_ALGORITHMS = ['argon2id', 'bcrypt', 'pbkdf2-sha256'] as const;
export type PasswordAlgorithm = (typeof PASSWORD_ALGORITHMS)[number];

export interface PasswordHashOptions {
  readonly algorithm?: PasswordAlgorithm;
  readonly argon2Memory?: number;
  readonly argon2Passes?: number;
  readonly argon2Parallelism?: number;
  readonly bcryptCost?: number;
  readonly iterations?: number;
  readonly salt?: Uint8Array;
}

export interface ResolvedPasswordHashConfig {
  readonly algorithm: PasswordAlgorithm;
  readonly argon2Memory: number;
  readonly argon2Passes: number;
  readonly argon2Parallelism: number;
  readonly bcryptCost: number;
  readonly pbkdf2Iterations: number;
}

const PBKDF2_PREFIX = 'pbkdf2-sha256';
const ARGON2_PREFIX = 'argon2id';
const HASH_ALGORITHM = 'sha256';

export function argon2Available(): boolean {
  return typeof argon2Sync === 'function';
}

export function resolvePasswordHashConfig(
  input: PasswordHashOptions = {},
): ResolvedPasswordHashConfig {
  const algorithm = resolvePasswordAlgorithm(input.algorithm);
  const argon2Memory = input.argon2Memory ?? 19_456;
  const argon2Passes = input.argon2Passes ?? 2;
  const argon2Parallelism = input.argon2Parallelism ?? 1;
  const bcryptCost = input.bcryptCost ?? 10;
  const pbkdf2Iterations = input.iterations ?? 310_000;
  if (!Number.isInteger(argon2Memory) || argon2Memory < 8) {
    throw new Error('argon2Memory must be an integer of at least 8 KiB');
  }
  if (!Number.isInteger(argon2Passes) || argon2Passes < 1) {
    throw new Error('argon2Passes must be a positive integer');
  }
  if (!Number.isInteger(argon2Parallelism) || argon2Parallelism < 1) {
    throw new Error('argon2Parallelism must be a positive integer');
  }
  if (!Number.isInteger(bcryptCost) || bcryptCost < 4 || bcryptCost > 31) {
    throw new Error('bcryptCost must be an integer between 4 and 31');
  }
  if (!Number.isInteger(pbkdf2Iterations) || pbkdf2Iterations < 1_000) {
    throw new Error('PBKDF2 iterations must be an integer greater than or equal to 1000');
  }
  return {
    algorithm,
    argon2Memory,
    argon2Passes,
    argon2Parallelism,
    bcryptCost,
    pbkdf2Iterations,
  };
}

export function resolvePasswordAlgorithm(requested?: PasswordAlgorithm): PasswordAlgorithm {
  const algorithm = requested ?? 'argon2id';
  if (!(PASSWORD_ALGORITHMS as readonly string[]).includes(algorithm)) {
    throw new Error(`unsupported password algorithm: ${String(algorithm)}`);
  }
  if (algorithm === 'argon2id' && !argon2Available()) {
    if (requested === undefined) return 'pbkdf2-sha256';
    throw new Error('passwordAlgorithm argon2id requires Node.js 24.7 or later');
  }
  return algorithm;
}

export function createPasswordHash(password: string, options: PasswordHashOptions = {}): string {
  if (password === '') throw new Error('password must be non-empty');
  const config = resolvePasswordHashConfig(options);
  switch (config.algorithm) {
    case 'argon2id':
      return createArgon2idHash(password, config, options.salt);
    case 'bcrypt':
      return hashSync(password, config.bcryptCost);
    case 'pbkdf2-sha256':
      return createPbkdf2Hash(password, config.pbkdf2Iterations, options.salt);
    default: {
      const _never: never = config.algorithm;
      return _never;
    }
  }
}

export function createPbkdf2PasswordHash(
  password: string,
  options: { readonly iterations?: number; readonly salt?: Uint8Array } = {},
): string {
  return createPasswordHash(password, {
    algorithm: 'pbkdf2-sha256',
    ...(options.iterations !== undefined ? { iterations: options.iterations } : {}),
    ...(options.salt !== undefined ? { salt: options.salt } : {}),
  });
}

export function assertPasswordHashFormat(encoded: string): PasswordAlgorithm {
  if (encoded.startsWith(`${PBKDF2_PREFIX}$`)) {
    parsePbkdf2(encoded);
    return 'pbkdf2-sha256';
  }
  if (encoded.startsWith(`${ARGON2_PREFIX}$`)) {
    parseArgon2id(encoded);
    return 'argon2id';
  }
  if (encoded.startsWith('$2a$') || encoded.startsWith('$2b$') || encoded.startsWith('$2y$')) {
    if (encoded.length < 28) throw new Error('unsupported password hash format');
    return 'bcrypt';
  }
  throw new Error('unsupported password hash format');
}

export function verifyPasswordHash(password: string, encoded: string): boolean {
  const algorithm = assertPasswordHashFormat(encoded);
  switch (algorithm) {
    case 'argon2id':
      return verifyArgon2id(password, encoded);
    case 'bcrypt':
      return compareSync(password, encoded);
    case 'pbkdf2-sha256':
      return verifyPbkdf2(password, encoded);
    default: {
      const _never: never = algorithm;
      return _never;
    }
  }
}

function createPbkdf2Hash(password: string, iterations: number, saltInput: Uint8Array | undefined): string {
  const salt = Buffer.from(saltInput ?? randomBytes(16));
  const hash = pbkdf2Sync(password, salt, iterations, 32, HASH_ALGORITHM);
  return `${PBKDF2_PREFIX}$${String(iterations)}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

function parsePbkdf2(encoded: string): { iterations: number; salt: Buffer; hash: Buffer } {
  const [prefix, iterationText, saltText, hashText] = encoded.split('$');
  if (prefix !== PBKDF2_PREFIX || iterationText === undefined || saltText === undefined || hashText === undefined) {
    throw new Error('unsupported password hash format');
  }
  const iterations = Number(iterationText);
  if (!Number.isInteger(iterations) || iterations < 1_000) {
    throw new Error('invalid PBKDF2 iteration count');
  }
  return {
    iterations,
    salt: Buffer.from(saltText, 'base64url'),
    hash: Buffer.from(hashText, 'base64url'),
  };
}

function verifyPbkdf2(password: string, encoded: string): boolean {
  const parts = parsePbkdf2(encoded);
  const candidate = pbkdf2Sync(password, parts.salt, parts.iterations, parts.hash.length, HASH_ALGORITHM);
  return sameBuffer(parts.hash, candidate);
}

function createArgon2idHash(
  password: string,
  config: ResolvedPasswordHashConfig,
  saltInput: Uint8Array | undefined,
): string {
  const salt = Buffer.from(saltInput ?? randomBytes(16));
  const derived = argon2Sync('argon2id', {
    message: password,
    nonce: salt,
    parallelism: config.argon2Parallelism,
    tagLength: 32,
    memory: config.argon2Memory,
    passes: config.argon2Passes,
  });
  return `${ARGON2_PREFIX}$m=${String(config.argon2Memory)},t=${String(config.argon2Passes)},p=${String(config.argon2Parallelism)}$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`;
}

function parseArgon2id(encoded: string): {
  memory: number;
  passes: number;
  parallelism: number;
  salt: Buffer;
  hash: Buffer;
} {
  const parts = encoded.split('$');
  if (parts[0] !== ARGON2_PREFIX || parts[1] === undefined || parts[2] === undefined || parts[3] === undefined) {
    throw new Error('unsupported password hash format');
  }
  const params = Object.fromEntries(
    parts[1].split(',').map((pair) => {
      const [key, value] = pair.split('=');
      return [key, Number(value)];
    }),
  );
  const memory = params.m;
  const passes = params.t;
  const parallelism = params.p;
  if (
    memory === undefined ||
    passes === undefined ||
    parallelism === undefined ||
    !Number.isInteger(memory) ||
    !Number.isInteger(passes) ||
    !Number.isInteger(parallelism)
  ) {
    throw new Error('unsupported password hash format');
  }
  return {
    memory,
    passes,
    parallelism,
    salt: Buffer.from(parts[2], 'base64url'),
    hash: Buffer.from(parts[3], 'base64url'),
  };
}

function verifyArgon2id(password: string, encoded: string): boolean {
  const parts = parseArgon2id(encoded);
  const derived = argon2Sync('argon2id', {
    message: password,
    nonce: parts.salt,
    parallelism: parts.parallelism,
    tagLength: parts.hash.length,
    memory: parts.memory,
    passes: parts.passes,
  });
  return sameBuffer(parts.hash, Buffer.from(derived));
}

function sameBuffer(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}
