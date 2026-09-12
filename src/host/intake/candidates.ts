/**
 * Deterministic and LLM intake candidate generation.
 */

import { randomUUID } from 'node:crypto';

import type {
  IntakeAnalyzeMode,
  IntakeCandidateId,
  IntakeCandidateRequirement,
  IntakeCandidateSourceRef,
  IntakeCandidateStatus,
  IntakeCandidateType,
  IntakeMessage,
  IntakeSession,
  IntakeSourceDocument,
} from '../board/types.js';

export interface IntakeExtractionFields {
  readonly goals: readonly string[];
  readonly actors: readonly string[];
  readonly scenarios: readonly string[];
  readonly constraints: readonly string[];
  readonly risks: readonly string[];
  readonly assumptions: readonly string[];
  readonly openQuestions: readonly string[];
  readonly acceptance: readonly string[];
}

export interface IntakeLlmNode {
  readonly type: IntakeCandidateType;
  readonly title: string;
  readonly body: string;
  readonly analysis?: string;
  readonly design?: string;
  readonly acceptance?: readonly string[];
  readonly parentKey?: string;
  readonly key?: string;
}

export interface IntakeLlmExtraction extends IntakeExtractionFields {
  readonly nodes?: readonly IntakeLlmNode[];
}

export interface IntakeLlmExtractor {
  extract(input: {
    readonly sessionTitle: string;
    readonly sourceText: string;
    readonly documents: readonly { readonly name: string; readonly parseStatus: string }[];
  }): IntakeLlmExtraction;
}

export interface IntakeCandidateBuildInput {
  readonly session: IntakeSession;
  readonly messages: readonly IntakeMessage[];
  readonly sourceDocuments: readonly IntakeSourceDocument[];
  readonly createdAt: number;
  readonly sourceRefs: readonly IntakeCandidateSourceRef[];
  readonly mode: IntakeAnalyzeMode;
  readonly llm?: IntakeLlmExtractor;
  readonly compactTitle: (value: string, fallback: string) => string;
  readonly clampText: (value: string) => string;
}

const DEFAULT_ACCEPTANCE = [
  '产品负责人可以确认需求目标和业务范围。',
  '拆分出的 Story 可以覆盖核心用户场景。',
  '交付证据可以回链到来源材料和验收标准。',
] as const;

export function buildIntakeCandidates(input: IntakeCandidateBuildInput): readonly IntakeCandidateRequirement[] {
  const sourceText = [
    ...input.messages.map((message) => message.body),
    ...input.sourceDocuments.map((sourceDocument) => sourceDocument.extractedText),
  ].join('\n\n').trim();
  if (input.mode === 'llm') {
    if (input.llm === undefined) {
      throw new Error('LLM intake analysis requires an extractor');
    }
    const extraction = input.llm.extract({
      sessionTitle: input.session.title,
      sourceText,
      documents: input.sourceDocuments.map((document) => ({
        name: document.name,
        parseStatus: document.parseStatus,
      })),
    });
    return buildFromExtraction(input, sourceText, extraction, true);
  }
  return buildFromExtraction(input, sourceText, extractFieldsFromText(sourceText), false);
}

export function extractFieldsFromText(text: string): IntakeExtractionFields {
  return {
    goals: labeledValues(text, /^(?:goals?|目标|业务目标)[:：]\s*(.+)$/i),
    actors: labeledValues(text, /^(?:actors?|角色|作为)[:：]\s*(.+)$/i),
    scenarios: labeledValues(text, /^(?:scenarios?|场景)[:：]\s*(.+)$/i),
    constraints: labeledValues(text, /^(?:constraints?|约束)[:：]\s*(.+)$/i),
    risks: labeledValues(text, /^(?:risks?|风险)[:：]\s*(.+)$/i),
    assumptions: labeledValues(text, /^(?:assumptions?|假设)[:：]\s*(.+)$/i),
    openQuestions: labeledValues(text, /^(?:open questions?|未决问题|问题)[:：]\s*(.+)$/i),
    acceptance: extractAcceptance(text),
  };
}

function buildFromExtraction(
  input: IntakeCandidateBuildInput,
  sourceText: string,
  fields: IntakeLlmExtraction,
  llm: boolean,
): readonly IntakeCandidateRequirement[] {
  const baseTitle = input.compactTitle(input.session.title || sourceText || fields.goals[0] || '', '未命名需求');
  const pendingSources = input.sourceDocuments.filter((sourceDocument) => sourceDocument.parseStatus !== 'parsed');
  const openQuestions = unique([
    ...fields.openQuestions,
    ...(pendingSources.length > 0
      ? pendingSources.map((sourceDocument) =>
        `${sourceDocument.name} 仍需解析后确认是否补充需求范围。`,
      )
      : ['请产品负责人确认优先级、里程碑和验收口径。']),
  ]);
  const acceptance = fields.acceptance.length > 0 ? [...fields.acceptance] : [...DEFAULT_ACCEPTANCE];
  const body = sourceText !== ''
    ? input.clampText(sourceText)
    : `来自 ${input.session.sourceChannel || 'web-chat'} 的需求录入会话。`;
  const analysis = summarizeAnalysis(fields, llm);
  const common = {
    sessionId: input.session.id,
    projectId: input.session.projectId,
    sourceRefs: input.sourceRefs,
    confidence: llm ? 0.78 : input.sourceRefs.length > 0 ? 0.62 : 0.4,
    status: 'draft' as IntakeCandidateStatus,
    workItemId: null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    goals: fields.goals,
    actors: fields.actors,
    scenarios: fields.scenarios,
    constraints: fields.constraints,
    risks: fields.risks,
    assumptions: fields.assumptions,
  };
  if (fields.nodes !== undefined && fields.nodes.length > 0) {
    return materializeNodes(common, fields.nodes, openQuestions, acceptance, analysis);
  }
  const epicId = randomUUID() as IntakeCandidateId;
  const featureId = randomUUID() as IntakeCandidateId;
  const storyId = randomUUID() as IntakeCandidateId;
  const taskId = randomUUID() as IntakeCandidateId;
  const candidates: IntakeCandidateRequirement[] = [
    {
      ...common,
      id: epicId,
      type: 'epic',
      title: baseTitle,
      body,
      analysis,
      design: '作为需求树根节点进入看板，后续 Feature、Story 和 Task 都保留父子追踪。',
      acceptance,
      parentCandidateId: null,
      milestoneId: null,
      openQuestions,
    },
    {
      ...common,
      id: featureId,
      type: 'feature',
      title: `${baseTitle} / 功能范围`,
      body: '承接 Epic 的可交付功能范围，等待进一步拆分为 Story。',
      analysis: '候选 Feature 用于聚合用户场景、边界条件和验收标准。',
      design: 'Feature 下的 Story 承担端到端交付，Task 承担具体实现工作。',
      acceptance,
      parentCandidateId: epicId,
      milestoneId: null,
      openQuestions,
    },
    {
      ...common,
      id: storyId,
      type: 'story',
      title: `${baseTitle} / 首个可交付 Story`,
      body: '把录入内容落成一个可排序、可分配、可验证的 Story。',
      analysis: '该 Story 是最小端到端交付单元，后续需要补齐优先级、负责人和里程碑。',
      design: 'Story 进入工作流后由团队角色完成分析、设计、开发、评审、验证和证据回链。',
      acceptance,
      parentCandidateId: featureId,
      milestoneId: null,
      openQuestions,
    },
    {
      ...common,
      id: taskId,
      type: 'task',
      title: `${baseTitle} / 完善验收与证据`,
      body: '补齐验收标准、来源引用和交付证据清单。',
      analysis: '该任务保证 Story 具备进入团队交付流水线的最小信息。',
      design: '完成后将验收、代码、PR、CI 和文档证据绑定回 Story。',
      acceptance: ['验收标准已确认。', '来源引用已保留。', '交付证据清单已建立。'],
      parentCandidateId: storyId,
      milestoneId: null,
      openQuestions: [],
    },
  ];
  if (pendingSources.length > 0) {
    candidates.push({
      ...common,
      id: randomUUID() as IntakeCandidateId,
      type: 'research',
      title: `${baseTitle} / 解析待处理附件`,
      body: pendingSources.map((sourceDocument) => sourceDocument.name).join('\n'),
      analysis: '存在尚未解析的图片、PDF、Word 或通用文件，需要补充解析器或人工确认。',
      design: '解析完成后把新增事实追加到同一录入会话，再重新生成候选需求。',
      acceptance: pendingSources.map((sourceDocument) => `${sourceDocument.name} 已完成解析或被明确标记为不采纳。`),
      parentCandidateId: featureId,
      milestoneId: null,
      openQuestions: pendingSources.map((sourceDocument) =>
        `确认 ${sourceDocument.name} 是否包含额外需求、约束或验收标准。`,
      ),
    });
  }
  if (shouldAddBug(sourceText, fields)) {
    candidates.push({
      ...common,
      id: randomUUID() as IntakeCandidateId,
      type: 'bug',
      title: `${baseTitle} / 缺陷候选`,
      body: fields.risks[0] ?? '录入材料提到缺陷或故障，需要单独跟踪。',
      analysis: 'LLM 或文本线索表明存在缺陷，而不是新功能范围。',
      design: '缺陷候选在批准前保持 draft，不直接写入看板。',
      acceptance: ['缺陷复现路径已确认。', '修复证据可以回链到来源材料。'],
      parentCandidateId: featureId,
      milestoneId: null,
      openQuestions: ['确认该缺陷是否独立于首个 Story 交付。'],
    });
  }
  return candidates;
}

function materializeNodes(
  common: Omit<IntakeCandidateRequirement, 'id' | 'type' | 'title' | 'body' | 'analysis' | 'design' | 'acceptance' | 'parentCandidateId' | 'milestoneId' | 'openQuestions'>,
  nodes: readonly IntakeLlmNode[],
  openQuestions: readonly string[],
  acceptance: readonly string[],
  analysis: string,
): readonly IntakeCandidateRequirement[] {
  const ids = new Map<string, IntakeCandidateId>();
  const created: IntakeCandidateRequirement[] = [];
  for (const [index, node] of nodes.entries()) {
    const id = randomUUID() as IntakeCandidateId;
    const key = node.key ?? `${node.type}:${String(index)}`;
    ids.set(key, id);
    const parentCandidateId = node.parentKey !== undefined ? ids.get(node.parentKey) ?? null : created[0]?.id ?? null;
    created.push({
      ...common,
      id,
      type: node.type,
      title: node.title,
      body: node.body,
      analysis: node.analysis ?? analysis,
      design: node.design ?? '',
      acceptance: node.acceptance ?? acceptance,
      parentCandidateId: index === 0 ? null : parentCandidateId,
      milestoneId: null,
      openQuestions,
    });
  }
  return created;
}

function summarizeAnalysis(fields: IntakeExtractionFields, llm: boolean): string {
  const parts = [
    llm ? 'LLM 从录入材料和附件中抽取业务结构。' : '从录入会话中识别出的上层业务目标，需要产品负责人确认范围。',
    fields.goals.length > 0 ? `目标：${fields.goals.join('；')}` : '',
    fields.actors.length > 0 ? `角色：${fields.actors.join('；')}` : '',
    fields.scenarios.length > 0 ? `场景：${fields.scenarios.join('；')}` : '',
    fields.constraints.length > 0 ? `约束：${fields.constraints.join('；')}` : '',
    fields.risks.length > 0 ? `风险：${fields.risks.join('；')}` : '',
    fields.assumptions.length > 0 ? `假设：${fields.assumptions.join('；')}` : '',
  ].filter((part) => part.length > 0);
  return parts.join('\n');
}

function shouldAddBug(sourceText: string, fields: IntakeExtractionFields): boolean {
  if (fields.risks.some((risk) => /缺陷|故障|bug|defect/i.test(risk))) return true;
  return /缺陷|故障|\bbug\b|\bdefect\b/i.test(sourceText);
}

function extractAcceptance(text: string): readonly string[] {
  const candidates = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*#\d.)]+/, '').trim())
    .filter((line) => line.length >= 6)
    .filter((line) =>
      /验收|标准|必须|需要|能够|可以|should|must|acceptance|criteria|requirement/i.test(line),
    )
    .slice(0, 5);
  return candidates;
}

function labeledValues(text: string, pattern: RegExp): readonly string[] {
  return unique(
    text
      .split(/\r?\n/)
      .map((line) => {
        const match = line.trim().match(pattern);
        return match?.[1]?.trim() ?? '';
      })
      .filter((value) => value.length > 0),
  );
}

function unique(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    ordered.push(value);
  }
  return ordered;
}
