/**
 * Replacement environment file inventory. Uncommitted work is preserved
 * or reported; node_modules and .git are not copied.
 */

import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SKIP_NAMES = new Set(['node_modules', '.git']);

export function listWorkspaceRelPaths(root: string): readonly string[] {
  const out: string[] = [];
  walk(root, '', out);
  return out;
}

export function isRetainedArtifact(relPath: string): boolean {
  return relPath === '.huntianling' || relPath.startsWith('.huntianling/');
}

export function isProfileInventory(relPath: string): boolean {
  return relPath === 'package.json' || isRetainedArtifact(relPath);
}

export function copyWorkspaceFiles(sourceRoot: string, targetRoot: string, relPaths: readonly string[]): void {
  mkdirSync(targetRoot, { recursive: true });
  for (const rel of relPaths) {
    const from = join(sourceRoot, rel);
    const to = join(targetRoot, rel);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to);
  }
}

function walk(root: string, rel: string, out: string[]): void {
  const abs = rel === '' ? root : join(root, rel);
  let entries;
  try {
    entries = readdirSync(abs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_NAMES.has(entry.name)) continue;
    const child = rel === '' ? entry.name : `${rel}/${entry.name}`;
    if (entry.isDirectory()) {
      walk(root, child, out);
      continue;
    }
    if (entry.isFile()) out.push(child);
  }
}
