/**
 * Injects agent-task context and lists missing required information before start.
 */

import type { AgentDefinition, AgentId, MethodDefinition } from '../agents/types.js';
import type { BoardService } from '../board/plugin.js';
import type { DispatchService } from '../dispatch/service.js';
import type { EnvironmentService } from '../environment/service.js';
import type { MissingInput, TaskContextPacket, ToolPermissionSnapshot } from './types.js';
import type { ToolRegistry } from './registry.js';

export function inspectTaskContext(deps: {
  readonly board: BoardService;
  readonly tools: ToolRegistry;
  readonly definition: AgentDefinition;
  readonly environment?: EnvironmentService;
  readonly dispatch?: DispatchService;
  readonly method?: MethodDefinition | null;
  readonly environmentReady?: boolean;
  readonly input?: unknown;
}, workItemId: string): TaskContextPacket {
  const item = deps.board.getWorkItem(workItemId as never);
  if (item === undefined) {
    return emptyPacket(workItemId, deps.definition.id, [
      { field: 'workItem', reason: `work item not found: ${workItemId}`, blocking: true },
    ]);
  }
  const parent = item.parentId === null ? undefined : deps.board.getWorkItem(item.parentId);
  const children = deps.board.listWorkItems({ projectId: item.projectId }).filter((row) => row.parentId === item.id);
  const milestone = item.milestoneId === null ? undefined : deps.board.getMilestone(item.milestoneId);
  const acceptance = item.acceptance.length > 0
    ? item.acceptance
    : item.acceptanceCriteria.map((criterion) => criterion.text);
  const profile = deps.environment?.profile();
  const lastPrepare = deps.environment?.lastPrepare();
  const sourceDocuments = deps.board.listIntakeSessions({ projectId: item.projectId }).flatMap((session) =>
    deps.board.getIntakeSessionBundle(session.id).sourceDocuments.map((document) => ({
      id: document.id,
      title: document.name,
    })),
  );
  const priorFeedback = (deps.dispatch?.listFeedback(item.id) ?? []).map((row) => ({
    id: row.id,
    agentId: row.agentId,
    summary: row.summary,
  }));
  const toolPermissions: ToolPermissionSnapshot[] = deps.definition.allowedToolIds.map((toolId) => {
    const tool = deps.tools.get(toolId);
    const allowed = tool !== undefined
      && tool.roles.includes(deps.definition.bindingRole)
      && tool.taskTypes.includes(deps.definition.taskType);
    return {
      toolId,
      permission: tool?.permission ?? 'read',
      allowed,
    };
  });
  const checks = deps.board.getDeliveryEvidenceSummary(item.id).checks.map((check) => ({
    producer: check.producer,
    title: check.title,
    status: check.status,
  }));
  const record = asObject(deps.input);
  const missing: MissingInput[] = [];
  if (acceptance.length === 0 && (deps.definition.id === 'generator' || deps.definition.id === 'evaluator')) {
    missing.push({ field: 'acceptance', reason: 'acceptance criteria are required', blocking: true });
  }
  if (deps.definition.id === 'generator') {
    if (item.analysis.trim() === '') {
      missing.push({ field: 'analysis', reason: 'analysis is required before implementation', blocking: true });
    }
    if (item.design.trim() === '') {
      missing.push({ field: 'design', reason: 'design is required before implementation', blocking: true });
    }
    if (deps.environmentReady !== true) {
      missing.push({ field: 'environmentReady', reason: 'Generator requires a ready environment', blocking: true });
    }
  }
  if (deps.definition.id === 'planner') {
    const quotes = record.quotes;
    const hasQuotes = Array.isArray(quotes) && quotes.length > 0 || item.sourceInput.trim() !== '';
    if (!hasQuotes) {
      missing.push({ field: 'quotes', reason: 'source quotes are required', blocking: true });
    }
    const goal = typeof record.goal === 'string' ? record.goal : item.title;
    if (goal.trim() === '') {
      missing.push({ field: 'goal', reason: 'goal is required', blocking: true });
    }
    if (record.confirmed !== true && item.analysis.trim() === '') {
      missing.push({ field: 'confirmed', reason: 'confirmed original requirements are required', blocking: true });
    }
  }
  for (const field of deps.method?.requiredInputs ?? []) {
    if (!hasInput(record, field) && !hasWorkItemField(item, field)) {
      missing.push({ field, reason: `method requires ${field}`, blocking: true });
    }
  }
  for (const permission of toolPermissions) {
    if (!permission.allowed) {
      missing.push({
        field: `tool:${permission.toolId}`,
        reason: `tool ${permission.toolId} is not allowed for ${deps.definition.bindingRole}/${deps.definition.taskType}`,
        blocking: true,
      });
    }
  }
  if (milestone === undefined) {
    missing.push({ field: 'milestone', reason: 'no milestone linked', blocking: false });
  }
  if (sourceDocuments.length === 0) {
    missing.push({ field: 'sourceDocuments', reason: 'no intake source documents', blocking: false });
  }
  if (priorFeedback.length === 0) {
    missing.push({ field: 'priorFeedback', reason: 'no prior agent feedback', blocking: false });
  }
  if (profile === undefined) {
    missing.push({ field: 'techProfile', reason: 'project tech profile is not loaded', blocking: false });
  }
  if (checks.length === 0) {
    missing.push({ field: 'checks', reason: 'no executed checks yet', blocking: false });
  }

  return {
    workItemId: item.id,
    agentId: deps.definition.id,
    ready: missing.every((row) => !row.blocking),
    workItem: {
      id: item.id,
      title: item.title,
      type: item.type,
      status: item.status,
      body: item.body,
      analysis: item.analysis,
      design: item.design,
    },
    parent: parent === undefined ? null : { id: parent.id, title: parent.title, type: parent.type },
    children: children.map((row) => ({ id: row.id, title: row.title, type: row.type })),
    milestone: milestone === undefined ? null : { id: milestone.id, title: milestone.title },
    acceptance,
    techProfile: profile === undefined
      ? null
      : {
          id: profile.id,
          version: profile.version,
          runtime: profile.runtime,
          ready: lastPrepare?.ready ?? null,
        },
    sourceDocuments,
    priorFeedback,
    toolPermissions,
    checks,
    missing,
  };
}

function emptyPacket(workItemId: string, agentId: AgentId, missing: readonly MissingInput[]): TaskContextPacket {
  return {
    workItemId,
    agentId,
    ready: false,
    workItem: { id: workItemId, title: '', type: '', status: '', body: '', analysis: '', design: '' },
    parent: null,
    children: [],
    milestone: null,
    acceptance: [],
    techProfile: null,
    sourceDocuments: [],
    priorFeedback: [],
    toolPermissions: [],
    checks: [],
    missing,
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function hasInput(record: Record<string, unknown>, field: string): boolean {
  const value = record[field];
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== false;
}

function hasWorkItemField(item: { readonly title: string; readonly body: string; readonly sourceInput: string }, field: string): boolean {
  if (field === 'goal') return item.title.trim() !== '';
  if (field === 'quotes') return item.sourceInput.trim() !== '';
  if (field === 'body') return item.body.trim() !== '';
  return false;
}
