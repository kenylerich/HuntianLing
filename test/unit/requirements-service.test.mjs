import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createBoardService } from '../../lib/host/board/plugin.js';
import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';

function services() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-requirements-'));
  const board = createBoardService(root);
  const requirements = createRequirementManagementService(board);
  const project = board.createProject({ name: 'p' });
  return { board, requirements, project };
}

test('requirement API creates the portfolio hierarchy and execution work', () => {
  const { requirements, project } = services();
  const epic = requirements.createEpic({
    projectId: project.id,
    title: '完整需求管理',
    body: '产品级目标。',
  });
  const feature = requirements.createFeature({
    epicId: epic.id,
    title: '看板需求拆分',
    body: '能力模块。',
  });
  const story = requirements.createStory({
    featureId: feature.id,
    title: '维护需求分析和设计',
    body: '用户在卡片详情中填写需求信息。',
    analysis: '需要同时保留需求分析和设计说明。',
    design: '详情面板写入 WorkItem 字段。',
    acceptanceCriteria: [{ id: 'story-ac-1', text: '卡片包含分析和设计字段' }],
  });
  const task = requirements.createTask({
    parentId: story.id,
    title: '实现详情字段 API',
    body: '提供可调用的更新接口。',
    coversAcceptanceIds: ['story-ac-1'],
  });

  const tree = requirements.getRequirementTree(epic.id);
  assert.equal(tree.children[0]?.item.id, feature.id);
  assert.equal(tree.children[0]?.children[0]?.item.id, story.id);
  assert.equal(tree.children[0]?.children[0]?.children[0]?.item.id, task.id);
  assert.equal(story.analysis, '需要同时保留需求分析和设计说明。');
});

test('requirement API updates details and reports acceptance coverage', () => {
  const { requirements, project } = services();
  const epic = requirements.createEpic({
    projectId: project.id,
    title: '完整需求管理',
    body: '产品级目标。',
    acceptanceCriteria: [
      { id: 'epic-ac-1', text: '需求可拆分' },
      { id: 'epic-ac-2', text: '进度可汇总' },
    ],
  });
  const [feature, research] = requirements.splitRequirement({
    parentId: epic.id,
    children: [
      {
        type: 'feature',
        title: '需求树',
        body: '管理父子层级。',
        sourceInput: '来自产品目标：需求可拆分。',
        decompositionReason: '先拆出 Feature 承载需求树能力。',
        coversAcceptanceIds: ['epic-ac-1'],
      },
      {
        type: 'research',
        title: '汇总策略',
        body: '确定父项完成度算法。',
        coversAcceptanceIds: ['epic-ac-2'],
      },
    ],
  });

  const updated = requirements.updateRequirement(epic.id, {
    analysis: '对齐 Azure Boards 的层级工作项。',
    design: '看板视图从内部 WorkItem 树投影。',
  });
  const coverage = requirements.getAcceptanceCoverage(epic.id);

  assert.equal(feature?.parentId, epic.id);
  assert.equal(feature?.sourceInput, '来自产品目标：需求可拆分。');
  assert.equal(feature?.decompositionReason, '先拆出 Feature 承载需求树能力。');
  assert.equal(research?.parentId, epic.id);
  assert.equal(updated.design, '看板视图从内部 WorkItem 树投影。');
  assert.equal(coverage.complete, true);
  assert.deepEqual(coverage.coveringWorkItemIds, [feature?.id, research?.id]);
});
