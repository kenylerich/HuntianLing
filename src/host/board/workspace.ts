/**
 * Resolve the HuntianLing workspace root (#84).
 *
 * Order: explicit option, HUNTIANLING_WORKSPACE, then cwd.
 * Manifests and hooks load relative to this root; board.json lives under
 * `<root>/.huntianling/`.
 */

import { isAbsolute, resolve } from 'node:path';

export function resolveWorkspaceRoot(input: {
  explicit?: string;
  env?: Record<string, string | undefined>;
  cwd?: string;
} = {}): string {
  const fromExplicit = input.explicit?.trim();
  if (fromExplicit) return normalize(fromExplicit, input.cwd);
  const fromEnv = input.env?.HUNTIANLING_WORKSPACE?.trim() ?? '';
  if (fromEnv) return normalize(fromEnv, input.cwd);
  return resolve(input.cwd ?? process.cwd());
}

function normalize(path: string, cwd?: string): string {
  if (isAbsolute(path)) return path;
  return resolve(cwd ?? process.cwd(), path);
}
