/**
 * Skill validator used by skill-creator before a draft can be enabled.
 */

import type { SkillRecord, SkillValidationStatus } from './types.js';

export interface SkillValidatorResult {
  readonly status: Exclude<SkillValidationStatus, 'unvalidated'>;
  readonly issues: readonly string[];
}

export function validateSkillRecord(skill: SkillRecord): SkillValidatorResult {
  const issues: string[] = [];
  if (skill.id.trim() === '') issues.push('id is required');
  if (skill.name.trim() === '') issues.push('name is required');
  if (skill.version.trim() === '') issues.push('version is required');
  if (skill.description.trim() === '') issues.push('description is required');
  if (skill.guide.trim() === '') issues.push('guide is required');
  if (skill.supportedRoles.length === 0) issues.push('supported roles are required');
  if (skill.supportedTaskTypes.length === 0) issues.push('supported task types are required');
  if (skill.boundary.outputSchema.trim() === '') issues.push('output schema is required');
  if (skill.boundary.doesNotCover.length === 0) issues.push('capability boundary doesNotCover is required');
  if (skill.boundary.roles.length === 0) issues.push('boundary roles are required');
  if (skill.boundary.taskTypes.length === 0) issues.push('boundary task types are required');
  if (skill.depth.levels.length === 0) issues.push('depth profile is required');
  const depthIds = skill.depth.levels.map((level) => level.id);
  for (const id of [0, 1, 2, 3, 4] as const) {
    if (!depthIds.includes(id)) issues.push(`depth level ${String(id)} is required`);
  }
  if (skill.examples.pass === undefined || skill.examples.pass === null) {
    issues.push('passing example is required');
  }
  if (skill.examples.fail === undefined || skill.examples.fail === null) {
    issues.push('failing example is required');
  }
  if (skill.createdThroughSkillCreator && skill.validationStatus === 'valid' && issues.length > 0) {
    issues.push('skill-creator drafts cannot self-mark valid');
  }
  return {
    status: issues.length === 0 ? 'valid' : 'invalid',
    issues,
  };
}
