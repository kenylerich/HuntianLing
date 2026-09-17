import { createHash, randomUUID } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseService } from '../database/types.js';
import type { DeliveryEvidenceCheck, WorkItem } from './types.js';
import { workItemDesignRevision } from './executed-evidence.js';

/** Fingerprint source, configuration, tests, and candidates without following symlinks. */
export function workspaceRevision(root: string): string {
  const hash = createHash('sha256');
  const visit = (directory: string, prefix: string): void => {
    for (const name of readdirSync(directory).sort()) {
      if (name === '.git' || name === 'node_modules') continue;
      if (prefix === '.huntianling/' && name !== 'candidates') continue;
      const path = join(directory, name);
      const ref = prefix + name;
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error(`cannot verify symlink candidate: ${ref}`);
      if (stat.isDirectory()) visit(path, ref + '/');
      else if (stat.isFile()) hash.update(ref).update('\0').update(String(stat.mode & 0o777))
        .update('\0').update(readFileSync(path)).update('\0');
      else throw new Error(`cannot verify non-file candidate: ${ref}`);
    }
  };
  visit(realpathSync(root), '');
  return hash.digest('hex');
}

function checkDigest(check: DeliveryEvidenceCheck): string {
  return createHash('sha256').update(JSON.stringify([
    check.id, check.area, check.title, check.status, check.required, check.reason,
    check.evidenceIds, check.acceptanceCriterionIds, check.links.map(link => [
      link.kind, link.id, link.label, link.url, link.acceptanceCriterionIds,
    ]), check.producer, check.executionKind, check.designRevision,
  ])).digest('hex');
}

/** Host-owned receipts are separate from user-editable Board summaries. */
export class ExecutionRecords {
  constructor(private readonly database: DatabaseService) {
    database.execute('CREATE TABLE IF NOT EXISTS execution_receipts (id TEXT PRIMARY KEY, work_item_id TEXT NOT NULL, check_digest TEXT NOT NULL, workspace_root TEXT NOT NULL, revision TEXT NOT NULL)');
    database.execute('CREATE TABLE IF NOT EXISTS execution_batches (work_item_id TEXT PRIMARY KEY, required_checks TEXT NOT NULL)');
  }

  begin(item: WorkItem): void {
    this.database.execute('DELETE FROM execution_batches WHERE work_item_id = ?', [item.id]);
    this.database.execute('DELETE FROM execution_receipts WHERE work_item_id = ?', [item.id]);
  }

  record(item: WorkItem, checks: readonly DeliveryEvidenceCheck[], root: string, revision: string): void {
    this.begin(item);
    if (workspaceRevision(root) !== revision) throw new Error('candidate changed during execution');
    for (const check of checks) {
      if (check.executionKind !== 'executed' || check.designRevision !== workItemDesignRevision(item)) {
        throw new Error('execution receipt requires an executed check for the current design');
      }
      this.database.execute('INSERT INTO execution_receipts (id, work_item_id, check_digest, workspace_root, revision) VALUES (?, ?, ?, ?, ?)',
        [randomUUID(), item.id, checkDigest(check), realpathSync(root), revision]);
    }
    this.database.execute('INSERT INTO execution_batches (work_item_id, required_checks) VALUES (?, ?)',
      [item.id, JSON.stringify(checks.filter(check => check.required).map(checkDigest))]);
  }

  verify(item: WorkItem, check: DeliveryEvidenceCheck, summaryChecks: readonly DeliveryEvidenceCheck[]): boolean {
    if (check.designRevision !== workItemDesignRevision(item)) return false;
    const batch = this.database.query('SELECT required_checks FROM execution_batches WHERE work_item_id = ?', [item.id])[0];
    if (typeof batch?.required_checks !== 'string') return false;
    const required: unknown = JSON.parse(batch.required_checks);
    const submitted = new Set(summaryChecks.map(checkDigest));
    if (!Array.isArray(required) || !required.every(digest => typeof digest === 'string' && submitted.has(digest))) return false;
    const receipts = this.database.query('SELECT workspace_root, revision FROM execution_receipts WHERE work_item_id = ? AND check_digest = ?',
      [item.id, checkDigest(check)]);
    return receipts.some(receipt => typeof receipt.workspace_root === 'string'
      && receipt.revision === workspaceRevision(receipt.workspace_root));
  }
}
