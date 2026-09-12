/**
 * Invoke remaining-category tools with allow/deny and delivery evidence.
 * Hosted browser fleets fail loud. Secrets stay on the call.
 */

import type { BoardService } from '../board/plugin.js';
import { mergeChecksByProducer, workItemDesignRevision } from '../board/executed-evidence.js';
import type { WorkItemId } from '../board/types.js';
import type { DatabaseService } from '../database/types.js';
import { extractIntakeSource } from '../intake/extract.js';
import type { IntakeOcrAdapter } from '../intake/types.js';
import type { IntakeSourceKind } from '../board/types.js';
import {
  TOOL_BROWSER_NAVIGATE,
  TOOL_DATABASE_MIGRATE,
  TOOL_DOCUMENT_PARSE,
  TOOL_IMAGE_ANALYZE,
  TOOL_WEB_API_CALL,
  type ToolRegistry,
} from './registry.js';
import {
  ToolInvokeError,
  type ToolCallEvidence,
  type ToolId,
  type ToolInvokeInput,
  type WebApiTransportRequest,
  type WebApiTransportResponse,
} from './types.js';

export interface ToolInvokeDeps {
  readonly registry: ToolRegistry;
  readonly board?: BoardService;
  readonly database?: DatabaseService;
  readonly transport?: (request: WebApiTransportRequest) => WebApiTransportResponse;
  readonly ocr?: IntakeOcrAdapter;
}

const SECRET_KEY = /password|token|api[_-]?key|secret|authorization/i;

export function invokeTool(deps: ToolInvokeDeps, input: ToolInvokeInput): ToolCallEvidence {
  const tool = deps.registry.assertAllowed(input.toolId, input.role, input.taskType);
  const payload = input.input ?? {};
  const detail = runAdapter(deps, input.toolId, payload);
  const evidence = deps.registry.recordCall({
    toolId: input.toolId,
    role: input.role,
    taskType: input.taskType,
    affectsDelivery: input.affectsDelivery === true,
    result: 'ran',
    detail,
  });
  if (input.affectsDelivery === true && input.workItemId !== undefined && deps.board !== undefined) {
    attachDeliveryEvidence(deps.board, input.workItemId as WorkItemId, tool.capability, evidence);
  }
  return evidence;
}

function runAdapter(deps: ToolInvokeDeps, toolId: ToolId, payload: Record<string, unknown>): string {
  switch (toolId) {
    case TOOL_BROWSER_NAVIGATE:
      return runBrowser(payload);
    case TOOL_DOCUMENT_PARSE:
      return runDocument(payload);
    case TOOL_IMAGE_ANALYZE:
      return runImage(payload, deps.ocr);
    case TOOL_DATABASE_MIGRATE:
      return runMigrate(deps.database);
    case TOOL_WEB_API_CALL:
      return runWebApi(payload, deps.transport);
    default:
      return `ran ${toolId}`;
  }
}

function runBrowser(payload: Record<string, unknown>): string {
  if (payload.fleet === 'hosted' || payload.hosted === true || payload.browserFleet === true) {
    throw new ToolInvokeError('HOSTED_FLEET', 'hosted browser fleets are not available');
  }
  const url = optionalText(payload.url);
  if (url === null) {
    throw new ToolInvokeError('MISSING_INPUT', 'browser.navigate requires url');
  }
  return `local:${url}`;
}

function runDocument(payload: Record<string, unknown>): string {
  const extracted = extractIntakeSource({
    kind: sourceKind(payload.kind, 'pdf'),
    name: optionalText(payload.name) ?? 'document',
    mimeType: optionalText(payload.mimeType) ?? 'application/pdf',
    bytes: asBytes(payload.bytes),
    ...(optionalText(payload.extractedText) !== null ? { extractedText: optionalText(payload.extractedText) ?? '' } : {}),
  });
  if (extracted.status !== 'parsed') {
    throw new ToolInvokeError('MISSING_INPUT', extracted.error || 'document.parse failed');
  }
  return `parsed:${String(extracted.text.length)}`;
}

function runImage(payload: Record<string, unknown>, ocr: IntakeOcrAdapter | undefined): string {
  const extracted = extractIntakeSource({
    kind: 'image',
    name: optionalText(payload.name) ?? 'image',
    mimeType: optionalText(payload.mimeType) ?? 'image/png',
    bytes: asBytes(payload.bytes),
    ...(optionalText(payload.extractedText) !== null ? { extractedText: optionalText(payload.extractedText) ?? '' } : {}),
    ...(ocr !== undefined ? { ocr } : {}),
  });
  if (extracted.status !== 'parsed') {
    throw new ToolInvokeError('MISSING_INPUT', extracted.error || 'image.analyze failed');
  }
  return `analyzed:${String(extracted.text.length)}`;
}

function runMigrate(database: DatabaseService | undefined): string {
  if (database === undefined) {
    throw new ToolInvokeError('MISSING_INPUT', 'database.migrate requires huntianling.database');
  }
  const version = database.migrate();
  return `schema:${String(version)}`;
}

function runWebApi(
  payload: Record<string, unknown>,
  transport: ToolInvokeDeps['transport'],
): string {
  if (hasSecret(payload) && payload.persistSecrets === true) {
    throw new ToolInvokeError('SECRET', 'web-api.call cannot persist secrets');
  }
  const url = optionalText(payload.url);
  if (url === null) {
    throw new ToolInvokeError('MISSING_INPUT', 'web-api.call requires url');
  }
  if (transport === undefined) {
    throw new ToolInvokeError('TRANSPORT', 'web-api.call requires a call-time transport');
  }
  const method = optionalText(payload.method) ?? 'GET';
  const headers = asHeaderMap(payload.headers);
  const body = optionalText(payload.body) ?? undefined;
  const response = transport({
    url,
    method,
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
    ...(body !== undefined ? { body } : {}),
  });
  return `${method} ${url} status=${String(response.status)}`;
}

function attachDeliveryEvidence(
  board: BoardService,
  workItemId: WorkItemId,
  capability: string,
  evidence: ToolCallEvidence,
): void {
  const item = board.getWorkItem(workItemId);
  if (item === undefined) {
    throw new ToolInvokeError('MISSING_INPUT', `work item not found: ${workItemId}`);
  }
  const existing = board.getDeliveryEvidenceSummary(workItemId);
  const revision = workItemDesignRevision(item);
  board.updateDeliveryEvidenceSummary(workItemId, {
    checks: mergeChecksByProducer(existing?.checks ?? [], [
      {
        id: `tool:${evidence.toolId}`,
        area: 'evidence',
        title: capability,
        status: evidence.result === 'ran' ? 'passing' : 'failing',
        required: false,
        reason: evidence.detail,
        evidenceIds: [evidence.id],
        acceptanceCriterionIds: [],
        links: [],
        producer: 'tool',
        executionKind: 'executed',
        designRevision: revision,
      },
    ], 'tool'),
    designRevision: revision,
  });
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function sourceKind(value: unknown, fallback: IntakeSourceKind): IntakeSourceKind {
  if (value === 'pdf' || value === 'word' || value === 'markdown' || value === 'plain-text' || value === 'image') {
    return value;
  }
  return fallback;
}

function asBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    return Uint8Array.from(Buffer.from(value, 'base64'));
  }
  return new Uint8Array();
}

function asHeaderMap(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const headers: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) continue;
    if (typeof item === 'string') headers[key] = item;
  }
  return headers;
}

function hasSecret(payload: Record<string, unknown>): boolean {
  return Object.keys(payload).some((key) => SECRET_KEY.test(key))
    || (typeof payload.headers === 'object' && payload.headers !== null && !Array.isArray(payload.headers)
      && Object.keys(payload.headers).some((key) => SECRET_KEY.test(key)));
}
