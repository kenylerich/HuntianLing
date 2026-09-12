/**
 * Agent Channel message validation.
 * First-slice types are a closed union ending in assertNever.
 * Later catalog types are merge-extensible; unknown types are rejected at write time.
 */

import {
  CHANNEL_MESSAGE_TYPES,
  FIRST_SLICE_MESSAGE_TYPES,
  ChannelWriteError,
  HANDOFF_KINDS,
  type ChannelHandoffKind,
  type ChannelMessageType,
  type FirstSliceMessageType,
  type LaterCatalogMessageType,
} from './types.js';

export function isChannelMessageType(value: unknown): value is ChannelMessageType {
  return typeof value === 'string' && (CHANNEL_MESSAGE_TYPES as readonly string[]).includes(value);
}

export function parseChannelMessageType(value: unknown): ChannelMessageType {
  if (!isChannelMessageType(value)) {
    throw new ChannelWriteError('UNKNOWN_TYPE', `unknown channel message type: ${String(value)}`);
  }
  return value;
}

export function assertNever(value: never): never {
  throw new ChannelWriteError('VALIDATION', `unhandled channel message type: ${String(value)}`);
}

export function requireString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ChannelWriteError('VALIDATION', `${key} is required`);
  }
  return value;
}

export function requireStringArray(payload: Record<string, unknown>, key: string): readonly string[] {
  const value = payload[key];
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string') || value.length === 0) {
    throw new ChannelWriteError('VALIDATION', `${key} must be a non-empty string array`);
  }
  return value;
}

export function parseHandoffKind(value: unknown): ChannelHandoffKind {
  if (typeof value !== 'string' || !(HANDOFF_KINDS as readonly string[]).includes(value)) {
    throw new ChannelWriteError('VALIDATION', `invalid handoffKind: ${String(value)}`);
  }
  return value as ChannelHandoffKind;
}

export function isFirstSliceMessageType(value: unknown): value is FirstSliceMessageType {
  return typeof value === 'string' && (FIRST_SLICE_MESSAGE_TYPES as readonly string[]).includes(value);
}

export function validateTypedPayload(type: ChannelMessageType, payload: Record<string, unknown>): void {
  if (isFirstSliceMessageType(type)) {
    validateFirstSlicePayload(type, payload);
    return;
  }
  validateLaterCatalogPayload(type, payload);
}

function validateFirstSlicePayload(type: FirstSliceMessageType, payload: Record<string, unknown>): void {
  switch (type) {
    case 'note.chat':
    case 'progress.update':
    case 'question.ask':
    case 'question.answer':
      requireString(payload, 'body');
      return;
    case 'task.question':
    case 'task.answer':
      requireString(payload, 'taskId');
      requireString(payload, 'body');
      return;
    case 'task.propose':
      requireString(payload, 'objective');
      requireString(payload, 'assigneeRole');
      requireStringArray(payload, 'requiredSkills');
      requireStringArray(payload, 'allowedTools');
      requireString(payload, 'expectedOutput');
      return;
    case 'task.accept':
    case 'task.decline':
    case 'task.block':
    case 'task.unblock':
    case 'task.complete':
    case 'task.cancel':
    case 'handoff.accept':
    case 'handoff.decline':
    case 'blocker.raise':
    case 'blocker.resolve':
    case 'human.redirect':
    case 'human.stop':
      requireString(payload, 'taskId');
      return;
    case 'task.transfer':
      requireString(payload, 'taskId');
      requireString(payload, 'sendingRole');
      requireString(payload, 'receiverRole');
      requireString(payload, 'reason');
      requireString(payload, 'transferredContext');
      requireString(payload, 'expectedNextAction');
      requireStringArray(payload, 'requiredEvidence');
      requireStringArray(payload, 'unresolvedQuestions');
      return;
    case 'handoff.request':
      parseHandoffKind(payload.handoffKind);
      requireString(payload, 'receiverRole');
      requireStringArray(payload, 'requiredSkills');
      requireStringArray(payload, 'allowedTools');
      requireString(payload, 'outputSchema');
      requireStringArray(payload, 'checks');
      return;
    case 'report.findings':
      requireStringArray(payload, 'criterionIds');
      if (payload.kind !== 'self_check' && payload.kind !== 'evaluator') {
        throw new ChannelWriteError('VALIDATION', 'report.findings kind must be self_check or evaluator');
      }
      return;
    case 'customer.question_needed':
      requireString(payload, 'body');
      return;
    default:
      return assertNever(type);
  }
}

function validateLaterCatalogPayload(type: LaterCatalogMessageType, payload: Record<string, unknown>): void {
  switch (type) {
    case 'task.split':
      requireString(payload, 'taskId');
      requireStringArray(payload, 'childObjectives');
      return;
    case 'task.merge':
      requireStringArray(payload, 'taskIds');
      requireString(payload, 'objective');
      return;
    case 'decision.record':
      requireString(payload, 'body');
      return;
    case 'approval.request':
      requireString(payload, 'taskId');
      return;
    case 'approval.granted':
    case 'approval.rejected':
      requireString(payload, 'taskId');
      requireString(payload, 'reason');
      return;
    default: {
      // Later catalog types are merge-extensible. Unknown later types are rejected at write time.
      throw new ChannelWriteError('UNKNOWN_TYPE', `unhandled later catalog type: ${String(type)}`);
    }
  }
}
