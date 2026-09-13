import { after } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { workspaceRevision } from '../../lib/host/board/execution-records.js';
import { workItemDesignRevision } from '../../lib/host/board/executed-evidence.js';

const root = mkdtempSync(join(tmpdir(), 'htl-mock-producer-'));
after(() => rmSync(root, { recursive: true, force: true }));

// Unit-only producer fixture for lifecycle tests, not real execution or acceptance evidence.
export function attachMockExecutionReceipt(board, id) {
  const item = board.getWorkItem(id);
  const summary = board.getDeliveryEvidenceSummary(id);
  const revision = workItemDesignRevision(item);
  const checks = summary.checks.map(check => check.producer === 'ci'
    ? { ...check, executionKind: 'executed', designRevision: revision } : check);
  board.recordExecutionEvidence(id, checks.filter(check => check.producer === 'ci'), root, workspaceRevision(root));
  return board.updateDeliveryEvidenceSummary(id, { checks, designRevision: revision });
}
