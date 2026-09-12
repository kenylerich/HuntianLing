/**
 * Built-in Story ranking method packs.
 */

import type {
  KanoClass,
  Milestone,
  MoscowClass,
  RankingInputs,
  RankingOverride,
  WorkItem,
} from './types.js';

export const PRIORITIZATION_METHOD_IDS = [
  'moscow',
  'rice',
  'wsjf',
  'kano',
  'risk-first',
  'dependency-first',
  'milestone-first',
] as const;

export type PrioritizationMethodId = (typeof PRIORITIZATION_METHOD_IDS)[number];

export const MOSCOW_CLASSES: readonly MoscowClass[] = ['must', 'should', 'could', 'wont'];
export const KANO_CLASSES: readonly KanoClass[] = ['basic', 'performance', 'excitement'];

export interface PrioritizationMethodDefinition {
  readonly id: PrioritizationMethodId;
  readonly version: string;
  readonly name: string;
  readonly inputFields: readonly string[];
}

export const PRIORITIZATION_METHODS: readonly PrioritizationMethodDefinition[] = [
  { id: 'moscow', version: '1.0.0', name: 'MoSCoW', inputFields: ['moscow'] },
  { id: 'rice', version: '1.0.0', name: 'RICE', inputFields: ['riceReach', 'riceImpact', 'riceConfidence', 'riceEffort'] },
  {
    id: 'wsjf',
    version: '1.0.0',
    name: 'WSJF',
    inputFields: ['wsjfUserBusinessValue', 'wsjfTimeCriticality', 'wsjfRiskReduction', 'wsjfJobSize'],
  },
  { id: 'kano', version: '1.0.0', name: 'Kano', inputFields: ['kano'] },
  { id: 'risk-first', version: '1.0.0', name: 'Risk-first', inputFields: ['riskScore'] },
  { id: 'dependency-first', version: '1.0.0', name: 'Dependency-first', inputFields: ['dependencyIds', 'blockedByIds'] },
  { id: 'milestone-first', version: '1.0.0', name: 'Milestone-first', inputFields: ['milestoneId'] },
];

export const DEFAULT_RANKING_EXPLANATION = 'Priority, due date, and WorkItem order';

export interface RankedStory {
  readonly item: WorkItem;
  readonly score: number;
  readonly explanation: string;
  readonly methodId: string | null;
  readonly overridden: boolean;
}

export function isPrioritizationMethodId(value: string): value is PrioritizationMethodId {
  return (PRIORITIZATION_METHOD_IDS as readonly string[]).includes(value);
}

export function requirePrioritizationMethodId(value: string): PrioritizationMethodId {
  if (!isPrioritizationMethodId(value)) {
    throw new Error(`unknown prioritization method: ${value}`);
  }
  return value;
}

export function normalizeRankingInputs(value: unknown): RankingInputs {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('rankingInputs must be an object');
  }
  const record = value as Record<string, unknown>;
  const moscow = optionalEnum(record, 'moscow', MOSCOW_CLASSES);
  const riceReach = optionalFiniteNumber(record, 'riceReach');
  const riceImpact = optionalFiniteNumber(record, 'riceImpact');
  const riceConfidence = optionalFiniteNumber(record, 'riceConfidence');
  const riceEffort = optionalFiniteNumber(record, 'riceEffort');
  const wsjfUserBusinessValue = optionalFiniteNumber(record, 'wsjfUserBusinessValue');
  const wsjfTimeCriticality = optionalFiniteNumber(record, 'wsjfTimeCriticality');
  const wsjfRiskReduction = optionalFiniteNumber(record, 'wsjfRiskReduction');
  const wsjfJobSize = optionalFiniteNumber(record, 'wsjfJobSize');
  const kano = optionalEnum(record, 'kano', KANO_CLASSES);
  const riskScore = optionalFiniteNumber(record, 'riskScore');
  return {
    ...(moscow !== undefined ? { moscow } : {}),
    ...(riceReach !== undefined ? { riceReach } : {}),
    ...(riceImpact !== undefined ? { riceImpact } : {}),
    ...(riceConfidence !== undefined ? { riceConfidence } : {}),
    ...(riceEffort !== undefined ? { riceEffort } : {}),
    ...(wsjfUserBusinessValue !== undefined ? { wsjfUserBusinessValue } : {}),
    ...(wsjfTimeCriticality !== undefined ? { wsjfTimeCriticality } : {}),
    ...(wsjfRiskReduction !== undefined ? { wsjfRiskReduction } : {}),
    ...(wsjfJobSize !== undefined ? { wsjfJobSize } : {}),
    ...(kano !== undefined ? { kano } : {}),
    ...(riskScore !== undefined ? { riskScore } : {}),
  };
}

export function normalizeRankingOverride(value: unknown): RankingOverride | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('rankingOverride must be an object');
  }
  const record = value as Record<string, unknown>;
  const rank = record.rank;
  const reason = typeof record.reason === 'string' ? record.reason.trim() : '';
  const actorId = typeof record.actorId === 'string' ? record.actorId : '';
  const at = typeof record.at === 'number' && Number.isFinite(record.at) ? record.at : 0;
  if (typeof rank !== 'number' || !Number.isInteger(rank) || rank < 1) {
    throw new Error('ranking override rank must be a positive integer');
  }
  if (reason.length === 0) {
    throw new Error('ranking override requires an audit reason');
  }
  return { rank, reason, actorId, at };
}

export function rankStories(input: {
  readonly methodId: string | null;
  readonly stories: readonly WorkItem[];
  readonly milestones: ReadonlyMap<string, Milestone>;
}): readonly RankedStory[] {
  const base = input.methodId === null
    ? defaultRanked(input.stories)
    : packRanked(requirePrioritizationMethodId(input.methodId), input.stories, input.milestones);
  return applyRankingOverrides(base);
}

function defaultRanked(stories: readonly WorkItem[]): RankedStory[] {
  return [...stories]
    .sort(compareDefault)
    .map((item) => ({
      item,
      score: 0,
      explanation: DEFAULT_RANKING_EXPLANATION,
      methodId: null,
      overridden: false,
    }));
}

function packRanked(
  methodId: PrioritizationMethodId,
  stories: readonly WorkItem[],
  milestones: ReadonlyMap<string, Milestone>,
): RankedStory[] {
  return [...stories]
    .map((item) => {
      const scored = scoreStory(methodId, item, stories, milestones);
      return {
        item,
        score: scored.score,
        explanation: scored.explanation,
        methodId,
        overridden: false,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.item.sortOrder - right.item.sortOrder;
    });
}

function scoreStory(
  methodId: PrioritizationMethodId,
  item: WorkItem,
  stories: readonly WorkItem[],
  milestones: ReadonlyMap<string, Milestone>,
): { readonly score: number; readonly explanation: string } {
  const inputs = item.rankingInputs;
  switch (methodId) {
    case 'moscow': {
      const order = { must: 4, should: 3, could: 2, wont: 1 } as const;
      if (inputs.moscow === undefined) {
        return { score: 0, explanation: 'MoSCoW missing moscow class' };
      }
      return { score: order[inputs.moscow], explanation: `MoSCoW ${inputs.moscow}` };
    }
    case 'rice': {
      const reach = inputs.riceReach;
      const impact = inputs.riceImpact;
      const confidence = inputs.riceConfidence;
      const effort = inputs.riceEffort;
      if (reach === undefined || impact === undefined || confidence === undefined || effort === undefined || effort <= 0) {
        return { score: 0, explanation: 'RICE missing reach, impact, confidence, or effort' };
      }
      const score = (reach * impact * confidence) / effort;
      return {
        score,
        explanation: `RICE ${formatScore(score)} = (${formatScore(reach)} × ${formatScore(impact)} × ${formatScore(confidence)}) / ${formatScore(effort)}`,
      };
    }
    case 'wsjf': {
      const value = inputs.wsjfUserBusinessValue;
      const time = inputs.wsjfTimeCriticality;
      const risk = inputs.wsjfRiskReduction;
      const size = inputs.wsjfJobSize;
      if (value === undefined || time === undefined || risk === undefined || size === undefined || size <= 0) {
        return { score: 0, explanation: 'WSJF missing user-business value, time criticality, risk reduction, or job size' };
      }
      const score = (value + time + risk) / size;
      return {
        score,
        explanation: `WSJF ${formatScore(score)} = (${formatScore(value)} + ${formatScore(time)} + ${formatScore(risk)}) / ${formatScore(size)}`,
      };
    }
    case 'kano': {
      const order = { basic: 3, performance: 2, excitement: 1 } as const;
      if (inputs.kano === undefined) {
        return { score: 0, explanation: 'Kano missing kano class' };
      }
      return { score: order[inputs.kano], explanation: `Kano ${inputs.kano}` };
    }
    case 'risk-first': {
      const score = inputs.riskScore ?? 0;
      return {
        score,
        explanation: inputs.riskScore === undefined ? 'risk-first missing riskScore' : `risk-first ${formatScore(score)}`,
      };
    }
    case 'dependency-first': {
      const dependents = stories.filter((story) =>
        story.id !== item.id
        && (story.dependencyIds.includes(item.id) || story.blockedByIds.includes(item.id)),
      ).length;
      const blockers = uniqueIds([
        ...item.dependencyIds.filter((id) => stories.some((story) => story.id === id)),
        ...item.blockedByIds.filter((id) => stories.some((story) => story.id === id)),
      ]).length;
      return {
        score: dependents * 1000 - blockers,
        explanation: `dependency-first dependents ${String(dependents)}, blockers ${String(blockers)}`,
      };
    }
    case 'milestone-first': {
      if (item.milestoneId === null) {
        return { score: 0, explanation: 'milestone-first missing milestone' };
      }
      const milestone = milestones.get(item.milestoneId);
      if (milestone === undefined) {
        return { score: 0, explanation: 'milestone-first missing milestone' };
      }
      const due = milestone.dueDate ?? milestone.startDate;
      if (due === null) {
        return { score: 1, explanation: `milestone-first ${milestone.title} undated` };
      }
      return {
        score: Number.MAX_SAFE_INTEGER - due,
        explanation: `milestone-first ${milestone.title} due ${String(due)}`,
      };
    }
    default: {
      const exhausted: never = methodId;
      throw new Error(`unhandled prioritization method: ${String(exhausted)}`);
    }
  }
}

function applyRankingOverrides(rows: readonly RankedStory[]): readonly RankedStory[] {
  const n = rows.length;
  if (n === 0) return rows;
  const slots: (RankedStory | undefined)[] = Array.from({ length: n });
  const remaining: RankedStory[] = [];
  for (const row of rows) {
    const override = row.item.rankingOverride;
    if (override === null) {
      remaining.push(annotateOverride(row, null));
      continue;
    }
    let index = Math.min(Math.max(override.rank, 1), n) - 1;
    while (index < n && slots[index] !== undefined) index += 1;
    const next = annotateOverride(row, override);
    if (index >= n) remaining.push(next);
    else slots[index] = next;
  }
  let cursor = 0;
  for (let index = 0; index < n; index += 1) {
    if (slots[index] !== undefined) continue;
    slots[index] = remaining[cursor];
    cursor += 1;
  }
  return slots.filter((row): row is RankedStory => row !== undefined);
}

function annotateOverride(row: RankedStory, override: RankingOverride | null): RankedStory {
  if (override === null) return { ...row, overridden: false };
  return {
    ...row,
    overridden: true,
    explanation: `override rank ${String(override.rank)}: ${override.reason}; ${row.explanation}`,
  };
}

function compareDefault(left: WorkItem, right: WorkItem): number {
  const priority = defaultPriorityScore(left.priority) - defaultPriorityScore(right.priority);
  if (priority !== 0) return priority;
  const leftDue = left.dueDate ?? Number.MAX_SAFE_INTEGER;
  const rightDue = right.dueDate ?? Number.MAX_SAFE_INTEGER;
  if (leftDue !== rightDue) return leftDue - rightDue;
  return left.sortOrder - right.sortOrder;
}

function defaultPriorityScore(priority: WorkItem['priority']): number {
  switch (priority) {
    case 'p0':
      return 0;
    case 'p1':
      return 1;
    case 'p2':
      return 2;
    case 'p3':
      return 3;
    case null:
      return 4;
    default: {
      const exhausted: never = priority;
      return exhausted;
    }
  }
}

function optionalEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${key} must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}

function optionalFiniteNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${key} must be a finite number`);
  }
  return value;
}

function formatScore(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 10_000) / 10_000);
}

function uniqueIds(ids: readonly string[]): readonly string[] {
  return [...new Set(ids)];
}
