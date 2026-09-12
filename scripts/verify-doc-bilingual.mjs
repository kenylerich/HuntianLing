#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');
const sources = findSources();
const errors = [];
const today = process.env.HUNTIANLING_DOC_TODAY ?? new Date().toISOString().slice(0, 10);

verifyRootPlacement();

for (const source of sources) {
  verifyPair(source);
}

if (errors.length > 0) {
  console.error('Bilingual documentation check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Bilingual documentation check passed for ${sources.length} source document(s).`);

function verifyPair(source) {
  const zh = source.replace(/\.md$/, '.zh.md');
  const sidecar = source.replace(/\.md$/, '.i18n.yaml');
  const sourcePath = join(root, source);
  const zhPath = join(root, zh);
  const sidecarPath = join(root, sidecar);

  if (!existsSync(zhPath)) {
    errors.push(`${source}: missing bilingual counterpart ${zh}`);
    return;
  }

  const sourceText = readFileSync(sourcePath, 'utf8');
  const zhText = readFileSync(zhPath, 'utf8');
  const sourceHash = sha256(sourceText);
  const zhHash = sha256(zhText);
  const expected = renderSidecar(source, zh, sourceHash, zhHash);
  const errorCountBeforePair = errors.length;

  assertSwitcher(source, sourceText, `English | [中文](${basename(zh)})`);
  assertSwitcher(zh, zhText, `[English](${basename(source)}) | 中文`);
  verifyLifecycle(source, sourceText, zh, zhText);

  if (write) {
    guardSingleLanguageRewrite(source, sidecarPath, sourceHash, zhHash);
    if (errors.length === errorCountBeforePair) {
      writeFileSync(sidecarPath, expected);
    }
    return;
  }

  if (!existsSync(sidecarPath)) {
    errors.push(`${source}: missing bilingual sidecar ${sidecar}`);
    return;
  }

  const actual = readFileSync(sidecarPath, 'utf8');
  if (actual !== expected) {
    errors.push(`${source}: stale bilingual sidecar ${sidecar}; update both languages and run pnpm run doc-sync:write`);
  }
}

function assertSwitcher(path, text, expected) {
  const firstLines = text.split('\n').slice(0, 16).join('\n');
  if (!firstLines.includes(expected)) {
    errors.push(`${path}: missing language switcher "${expected}" in the first 16 lines`);
  }
}

function verifyLifecycle(source, sourceText, zh, zhText) {
  const sourceMeta = parseFrontmatter(source, sourceText);
  const zhMeta = parseFrontmatter(zh, zhText);
  if (!sourceMeta || !zhMeta) {
    return;
  }

  const required = ['doc_status', 'doc_version', 'created', 'last_reviewed', 'review_after'];
  for (const key of required) {
    if (!sourceMeta[key]) {
      errors.push(`${source}: missing lifecycle field ${key}`);
    }
    if (!zhMeta[key]) {
      errors.push(`${zh}: missing lifecycle field ${key}`);
    }
    if (sourceMeta[key] && zhMeta[key] && sourceMeta[key] !== zhMeta[key]) {
      errors.push(`${source}: lifecycle field ${key} must match ${zh}`);
    }
  }

  if (sourceMeta.doc_status && !['active', 'draft', 'superseded', 'archived'].includes(sourceMeta.doc_status)) {
    errors.push(`${source}: doc_status must be active, draft, superseded, or archived`);
  }

  if (sourceMeta.doc_version && !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(sourceMeta.doc_version)) {
    errors.push(`${source}: doc_version must use YYYY-MM-DD.N`);
  }

  if ((sourceMeta.archive_after || zhMeta.archive_after) && sourceMeta.archive_after !== zhMeta.archive_after) {
    errors.push(`${source}: lifecycle field archive_after must match ${zh}`);
  }

  for (const key of ['created', 'last_reviewed', 'review_after', 'archive_after']) {
    if (sourceMeta[key] && !isIsoDate(sourceMeta[key])) {
      errors.push(`${source}: ${key} must use YYYY-MM-DD`);
    }
  }

  if (sourceMeta.created && sourceMeta.last_reviewed && sourceMeta.created > sourceMeta.last_reviewed) {
    errors.push(`${source}: created cannot be after last_reviewed`);
  }

  if (sourceMeta.last_reviewed && sourceMeta.last_reviewed > today) {
    errors.push(`${source}: last_reviewed cannot be in the future`);
  }

  if (sourceMeta.review_after && sourceMeta.last_reviewed && sourceMeta.review_after < sourceMeta.last_reviewed) {
    errors.push(`${source}: review_after cannot be before last_reviewed`);
  }

  const archived = sourceMeta.doc_status === 'archived';
  const archiveReadme = source === 'docs/archive/README.md';
  const insideArchive = source.startsWith('docs/archive/');
  if (archived && !insideArchive) {
    errors.push(`${source}: archived documents must live under docs/archive/`);
  }
  if (insideArchive && !archiveReadme && !archived) {
    errors.push(`${source}: non-index documents under docs/archive/ must use doc_status: archived`);
  }

  if (!archived && sourceMeta.review_after && sourceMeta.review_after < today) {
    errors.push(`${source}: review_after has passed; review the document, update lifecycle dates, or archive it`);
  }

  if (!archived && sourceMeta.archive_after && sourceMeta.archive_after < today) {
    errors.push(`${source}: archive_after has passed; move it under docs/archive/ or extend archive_after with review approval`);
  }
}

function parseFrontmatter(path, text) {
  if (!text.startsWith('---\n')) {
    errors.push(`${path}: missing lifecycle frontmatter`);
    return undefined;
  }

  const end = text.indexOf('\n---\n', 4);
  if (end === -1) {
    errors.push(`${path}: missing closing lifecycle frontmatter marker`);
    return undefined;
  }

  const meta = {};
  for (const line of text.slice(4, end).split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) {
      continue;
    }
    const match = line.match(/^([a-z_]+):\s*(.+)$/);
    if (!match) {
      errors.push(`${path}: invalid lifecycle frontmatter line "${line}"`);
      continue;
    }
    meta[match[1]] = match[2].trim();
  }
  return meta;
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function guardSingleLanguageRewrite(source, sidecarPath, sourceHash, zhHash) {
  if (!existsSync(sidecarPath)) {
    return;
  }

  const previous = readFileSync(sidecarPath, 'utf8');
  const previousSourceHash = readHash(previous, 'source_sha256');
  const previousZhHash = readHash(previous, 'target_sha256');
  if (!previousSourceHash || !previousZhHash) {
    errors.push(`${source}: cannot read existing sidecar hashes; fix the sidecar before recording`);
    return;
  }

  const sourceChanged = previousSourceHash !== sourceHash;
  const zhChanged = previousZhHash !== zhHash;
  if (sourceChanged !== zhChanged) {
    errors.push(`${source}: only one language changed since the last bilingual record; update the counterpart before running pnpm run doc-sync:write`);
  }
}

function renderSidecar(source, zh, sourceHash, zhHash) {
  return [
    '# Generated by scripts/verify-doc-bilingual.mjs.',
    '# Update both documents, then run: pnpm run doc-sync:write',
    `source: ${source}`,
    `target: ${zh}`,
    `source_sha256: ${sourceHash}`,
    `target_sha256: ${zhHash}`,
    '',
  ].join('\n');
}

function readHash(text, key) {
  const match = text.match(new RegExp(`^${key}: ([0-9a-f]{64})$`, 'm'));
  return match ? match[1] : undefined;
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function findSources() {
  const files = ['README.md'];
  const docsDir = join(root, 'docs');
  if (existsSync(docsDir)) {
    for (const file of walk(docsDir)) {
      const repoPath = relative(root, file);
      if (repoPath.endsWith('.md') && !repoPath.endsWith('.zh.md')) {
        files.push(repoPath);
      }
    }
  }
  return files.sort();
}

function verifyRootPlacement() {
  const docsDir = join(root, 'docs');
  if (!existsSync(docsDir)) {
    return;
  }

  for (const file of walk(docsDir)) {
    const repoPath = relative(root, file);
    const allowedRootDoc = repoPath === 'docs/README.md' || repoPath === 'docs/README.zh.md';
    if (repoPath.endsWith('.md') && dirname(repoPath) === 'docs' && !allowedRootDoc) {
      errors.push(`${repoPath}: put user-facing docs under a category directory; docs/ root is reserved for README.md`);
    }
  }
}

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}
