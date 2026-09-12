/**
 * Local filesystem backend for uploaded file bytes.
 *
 * Paths stay under the configured storage root. A later S3-compatible adapter
 * can implement `FileStorageBackend` without changing callers.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

import { DatabaseError, type FileStorageBackend } from './types.js';

export class LocalFileStorage implements FileStorageBackend {
  constructor(private readonly root: string) {
    mkdirSync(this.root, { recursive: true });
  }

  write(relativePath: string, bytes: Uint8Array): void {
    const target = resolveUnderRoot(this.root, relativePath, 'storage path');
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }

  read(relativePath: string): Uint8Array {
    const target = resolveUnderRoot(this.root, relativePath, 'storage path');
    return new Uint8Array(readFileSync(target));
  }
}

export function resolveUnderRoot(root: string, candidate: string, label: string): string {
  if (candidate === ':memory:') return candidate;
  if (candidate.trim() === '') {
    throw new DatabaseError('VALIDATION', `${label} cannot be blank`);
  }
  if (isAbsolute(candidate) === false && candidate.split(/[\\/]/).includes('..')) {
    throw new DatabaseError('VALIDATION', `${label} must stay under the workspace root`);
  }
  const resolvedRoot = resolve(root);
  const resolvedTarget = isAbsolute(candidate) ? resolve(candidate) : resolve(resolvedRoot, candidate);
  if (!isInsideRoot(resolvedRoot, resolvedTarget)) {
    throw new DatabaseError('VALIDATION', `${label} must stay under the workspace root`);
  }
  return resolvedTarget;
}

export function isInsideRoot(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === '' || (rel.startsWith('..') === false && isAbsolute(rel) === false && rel !== `..${sep}`);
}

export function storageSegment(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9._-]/g, '_');
  if (cleaned.length === 0 || cleaned === '.' || cleaned === '..') {
    throw new DatabaseError('VALIDATION', 'invalid storage path segment');
  }
  return cleaned;
}
