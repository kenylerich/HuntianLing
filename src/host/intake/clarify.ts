/**
 * MKT clarifying questions and structured follow-up answers for intake sessions.
 */

import {
  MKT_FOLLOW_UP_FIELDS,
  type IntakeClarifyingQuestion,
  type IntakeMessage,
  type IntakeMktDraft,
  type IntakeSourceDocument,
  type MktFollowUpField,
} from '../board/types.js';

const FORBIDDEN_FOLLOW_UP = [
  'technicalDesign',
  'files',
  'filePaths',
  'code',
  'acceptanceDecision',
  'tasks',
] as const;

const PROMPTS: Record<MktFollowUpField, string> = {
  goal: '这条需求的目标是什么？',
  actors: '谁会使用这个能力？',
  scenarios: '主要使用场景是什么？',
  constraints: '有哪些约束或限制？',
  nonGoals: '哪些事情明确不做？',
  confirm: '确认把以上内容记为可跟踪的原始需求吗？请回答“确认”或“暂不跟踪”。',
};

export function isMktFollowUpField(value: string): value is MktFollowUpField {
  return (MKT_FOLLOW_UP_FIELDS as readonly string[]).includes(value);
}

export function promptForField(field: MktFollowUpField): string {
  return PROMPTS[field];
}

export function assertFollowUpValue(field: MktFollowUpField, value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error('follow-up answer is required');
  for (const forbidden of FORBIDDEN_FOLLOW_UP) {
    if (trimmed.includes(forbidden) || new RegExp(`["']${forbidden}["']`).test(trimmed)) {
      throw new Error(`follow-up cannot include ${forbidden}`);
    }
  }
  if (field === 'confirm' && !isConfirmYes(trimmed) && !isConfirmNo(trimmed)) {
    throw new Error('confirm must be 确认 or 暂不跟踪');
  }
  return trimmed;
}

export function collectMktDraft(
  messages: readonly IntakeMessage[],
  sourceDocuments: readonly IntakeSourceDocument[] = [],
): IntakeMktDraft {
  const answers = collectAnswers(messages);
  const quotes = collectQuotes(messages, sourceDocuments);
  const goal = firstValue(answers.goal) ?? inferGoal(messages, sourceDocuments);
  const actors = splitValues(answers.actors);
  const scenarios = splitValues(answers.scenarios);
  const constraints = splitValues(answers.constraints);
  const nonGoals = splitValues(answers.nonGoals);
  const confirmed = answers.confirm !== undefined && isConfirmYes(answers.confirm);
  const missingFields = missingMktFields({
    quotes,
    goal,
    actors,
    scenarios,
    confirmAnswered: answers.confirm !== undefined,
  });
  return {
    quotes,
    goal,
    actors,
    scenarios,
    constraints,
    nonGoals,
    openQuestions: missingFields.filter((field) => field !== 'confirm').map((field) => PROMPTS[field]),
    confirmed,
    tracked: confirmed && quotes.length > 0 && goal.trim() !== '',
    missingFields,
  };
}

export function listClarifyingQuestions(messages: readonly IntakeMessage[]): readonly IntakeClarifyingQuestion[] {
  const answered = new Set(
    messages
      .filter((message) => message.kind === 'follow-up-answer' && message.field !== null)
      .map((message) => message.field as MktFollowUpField),
  );
  return messages
    .filter((message) => message.kind === 'clarifying-question' && message.field !== null)
    .map((message) => ({
      id: message.id,
      field: message.field as MktFollowUpField,
      prompt: message.body,
      status: answered.has(message.field as MktFollowUpField) ? 'answered' : 'open',
    }));
}

export function questionsToAsk(
  messages: readonly IntakeMessage[],
  sourceDocuments: readonly IntakeSourceDocument[] = [],
): readonly { readonly field: MktFollowUpField; readonly prompt: string }[] {
  const draft = collectMktDraft(messages, sourceDocuments);
  const alreadyOpen = new Set(
    listClarifyingQuestions(messages)
      .filter((question) => question.status === 'open')
      .map((question) => question.field),
  );
  const alreadyAsked = new Set(
    messages
      .filter((message) => message.kind === 'clarifying-question' && message.field !== null)
      .map((message) => message.field as MktFollowUpField),
  );
  return draft.missingFields
    .filter((field) => !alreadyOpen.has(field) && !alreadyAsked.has(field))
    .map((field) => ({ field, prompt: PROMPTS[field] }));
}

function missingMktFields(input: {
  readonly quotes: readonly { readonly text: string }[];
  readonly goal: string;
  readonly actors: readonly string[];
  readonly scenarios: readonly string[];
  readonly confirmAnswered: boolean;
}): readonly MktFollowUpField[] {
  const missing: MktFollowUpField[] = [];
  if (input.quotes.length === 0 || input.goal.trim() === '') missing.push('goal');
  if (input.actors.length === 0) missing.push('actors');
  if (input.scenarios.length === 0) missing.push('scenarios');
  if (!input.confirmAnswered) missing.push('confirm');
  return missing;
}

function collectAnswers(messages: readonly IntakeMessage[]): Partial<Record<MktFollowUpField, string>> {
  const answers: Partial<Record<MktFollowUpField, string>> = {};
  for (const message of messages) {
    if (message.kind !== 'follow-up-answer' || message.field === null) continue;
    answers[message.field] = message.body;
  }
  for (const message of messages) {
    if (message.kind !== 'chat' || message.role !== 'user') continue;
    applyLabeledAnswers(message.body, answers);
  }
  return answers;
}

function applyLabeledAnswers(body: string, answers: Partial<Record<MktFollowUpField, string>>): void {
  const labeled: ReadonlyArray<readonly [MktFollowUpField, RegExp]> = [
    ['goal', /^(?:goal|目标)[:：]\s*(.+)$/i],
    ['actors', /^(?:actors?|角色|作为)[:：]\s*(.+)$/i],
    ['scenarios', /^(?:scenarios?|场景)[:：]\s*(.+)$/i],
    ['constraints', /^(?:constraints?|约束)[:：]\s*(.+)$/i],
    ['nonGoals', /^(?:non-?goals?|非目标|不做)[:：]\s*(.+)$/i],
  ];
  for (const line of body.split(/\r?\n/)) {
    for (const [field, pattern] of labeled) {
      const match = line.trim().match(pattern);
      if (match?.[1] && answers[field] === undefined) answers[field] = match[1].trim();
    }
  }
}

function collectQuotes(
  messages: readonly IntakeMessage[],
  sourceDocuments: readonly IntakeSourceDocument[],
): readonly { readonly text: string; readonly source: string }[] {
  const quotes: { text: string; source: string }[] = [];
  for (const message of messages) {
    if (message.role !== 'user' || message.body.trim() === '') continue;
    if (message.kind === 'clarifying-question') continue;
    quotes.push({ text: message.body.trim(), source: message.author || 'customer' });
  }
  for (const document of sourceDocuments) {
    if (document.extractedText.trim() === '') continue;
    quotes.push({ text: document.extractedText.trim(), source: document.name });
  }
  return quotes;
}

function inferGoal(
  messages: readonly IntakeMessage[],
  sourceDocuments: readonly IntakeSourceDocument[],
): string {
  const user = messages.find((message) => message.role === 'user' && message.kind === 'chat' && message.body.trim() !== '');
  if (user !== undefined) return user.body.trim().split(/\r?\n/)[0] ?? '';
  const document = sourceDocuments.find((item) => item.extractedText.trim() !== '');
  if (document === undefined) return '';
  return document.extractedText.trim().split(/\r?\n/)[0] ?? '';
}

function firstValue(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function splitValues(value: string | undefined): readonly string[] {
  if (value === undefined || value.trim() === '') return [];
  return value.split(/[、,;；]/).map((item) => item.trim()).filter((item) => item.length > 0);
}

function isConfirmYes(value: string): boolean {
  return /^(确认|是|yes|true)$/i.test(value.trim());
}

function isConfirmNo(value: string): boolean {
  return /^(暂不跟踪|不|no|false)$/i.test(value.trim());
}
