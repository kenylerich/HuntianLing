/**
 * Harness tool registry types (REQ-TOOL-001).
 */

declare const _toolBrand: unique symbol;
type ToolBranded<T extends string> = string & { readonly [_toolBrand]: T };

export type ToolId = ToolBranded<'ToolId'>;
export type ToolPermission = 'read' | 'write' | 'execute';
export type ToolRisk = 'low' | 'medium' | 'high';
export const TOOL_CATEGORIES = [
  'filesystem',
  'terminal',
  'browser',
  'git',
  'document',
  'image',
  'test',
  'ci',
  'database',
  'web-api',
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export interface ToolRecord {
  readonly id: ToolId;
  readonly capability: string;
  readonly category: ToolCategory;
  readonly permission: ToolPermission;
  readonly risk: ToolRisk;
  readonly taskTypes: readonly string[];
  readonly roles: readonly string[];
}

export interface ToolCallEvidence {
  readonly id: string;
  readonly toolId: ToolId;
  readonly role: string;
  readonly taskType: string;
  readonly affectsDelivery: boolean;
  readonly result: 'allowed' | 'denied' | 'ran';
  readonly detail: string;
}

export class ToolDeniedError extends Error {
  constructor(readonly toolId: ToolId, readonly role: string, readonly taskType: string) {
    super(`tool ${toolId} is not allowed for role ${role} and task ${taskType}`);
  }
}

export class ToolInvokeError extends Error {
  constructor(readonly code: 'HOSTED_FLEET' | 'MISSING_INPUT' | 'TRANSPORT' | 'SECRET', message: string) {
    super(message);
  }
}

export interface ToolInvokeInput {
  readonly toolId: ToolId;
  readonly role: string;
  readonly taskType: string;
  readonly workItemId?: string;
  readonly input?: Record<string, unknown>;
  readonly affectsDelivery?: boolean;
}

export interface WebApiTransportRequest {
  readonly url: string;
  readonly method: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
}

export interface WebApiTransportResponse {
  readonly status: number;
  readonly body: string;
}

export interface MissingInput {
  readonly field: string;
  readonly reason: string;
  readonly blocking: boolean;
}

export interface ToolPermissionSnapshot {
  readonly toolId: ToolId;
  readonly permission: ToolPermission;
  readonly allowed: boolean;
}

export interface TaskContextPacket {
  readonly workItemId: string;
  readonly agentId: string;
  readonly ready: boolean;
  readonly workItem: {
    readonly id: string;
    readonly title: string;
    readonly type: string;
    readonly status: string;
    readonly body: string;
    readonly analysis: string;
    readonly design: string;
  };
  readonly parent: { readonly id: string; readonly title: string; readonly type: string } | null;
  readonly children: readonly { readonly id: string; readonly title: string; readonly type: string }[];
  readonly milestone: { readonly id: string; readonly title: string } | null;
  readonly acceptance: readonly string[];
  readonly techProfile: {
    readonly id: string;
    readonly version: string;
    readonly runtime: { readonly node: string; readonly packageManager: string };
    readonly ready: boolean | null;
  } | null;
  readonly sourceDocuments: readonly { readonly id: string; readonly title: string }[];
  readonly priorFeedback: readonly { readonly id: string; readonly agentId: string; readonly summary: string }[];
  readonly toolPermissions: readonly ToolPermissionSnapshot[];
  readonly checks: readonly { readonly producer: string; readonly title: string; readonly status: string }[];
  readonly missing: readonly MissingInput[];
}
