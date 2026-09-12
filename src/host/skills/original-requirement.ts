/**
 * Original-requirement write schema and sensors for MKT.
 */

import { SkillWriteError, type OriginalRequirementWriteInput } from './types.js';

const FORBIDDEN_FIELDS = [
  'technicalDesign',
  'files',
  'filePaths',
  'code',
  'acceptanceDecision',
  'tasks',
] as const;

export const ORIGINAL_REQUIREMENT_SCHEMA = 'huntianling.original-requirement.v1';

export function validateOriginalRequirementWrite(input: unknown): OriginalRequirementWriteInput {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new SkillWriteError('VALIDATION', 'original requirement must be an object');
  }
  const record = input as Record<string, unknown>;
  for (const field of FORBIDDEN_FIELDS) {
    if (Object.hasOwn(record, field)) {
      throw new SkillWriteError('VALIDATION', `forbidden field ${field}`);
    }
  }
  if (typeof record.goal !== 'string' || record.goal.trim() === '') {
    throw new SkillWriteError('VALIDATION', 'goal is required');
  }
  if (typeof record.confirmed !== 'boolean') {
    throw new SkillWriteError('VALIDATION', 'confirmed must be boolean');
  }
  if (!Array.isArray(record.quotes) || record.quotes.length === 0) {
    throw new SkillWriteError('VALIDATION', 'source quotes are required');
  }
  const quotes = record.quotes.map((quote, index) => {
    if (typeof quote !== 'object' || quote === null || Array.isArray(quote)) {
      throw new SkillWriteError('VALIDATION', `quotes[${String(index)}] is invalid`);
    }
    const row = quote as Record<string, unknown>;
    if (typeof row.text !== 'string' || row.text.trim() === '') {
      throw new SkillWriteError('VALIDATION', `quotes[${String(index)}] missing text`);
    }
    return {
      text: row.text,
      source: typeof row.source === 'string' && row.source.trim() !== '' ? row.source : 'customer',
    };
  });
  const actors = stringArray(record.actors);
  const scenarios = stringArray(record.scenarios);
  const constraints = stringArray(record.constraints);
  const nonGoals = stringArray(record.nonGoals);
  const openQuestions = stringArray(record.openQuestions);
  const sessionId = typeof record.sessionId === 'string' ? record.sessionId : undefined;
  const projectId = typeof record.projectId === 'string' ? record.projectId : undefined;
  return {
    quotes,
    goal: record.goal,
    confirmed: record.confirmed,
    ...(actors !== undefined ? { actors } : {}),
    ...(scenarios !== undefined ? { scenarios } : {}),
    ...(constraints !== undefined ? { constraints } : {}),
    ...(nonGoals !== undefined ? { nonGoals } : {}),
    ...(openQuestions !== undefined ? { openQuestions } : {}),
    ...(sessionId !== undefined ? { sessionId } : {}),
    ...(projectId !== undefined ? { projectId } : {}),
  };
}

function stringArray(value: unknown): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new SkillWriteError('VALIDATION', 'expected a string array');
  }
  return value;
}
