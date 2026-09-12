import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BoardStore } from '../../lib/host/board/store.js';
import { DEFAULT_ROLES } from '../../lib/host/board/types.js';

function tempStore() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-board-'));
  return new BoardStore(root);
}

function readyStory(store, projectId, input = {}) {
  const { milestoneTitle = 'MVP', ...overrides } = input;
  const milestone = store.createMilestone({ projectId, title: milestoneTitle });
  return store.createWorkItem({
    projectId,
    type: 'story',
    status: 'ready',
    title: '可开发 Story',
    body: '满足进入开发的前置条件。',
    analysis: '需求分析已完成。',
    design: '交付设计已完成。',
    acceptance: ['可以被开发角色认领'],
    milestoneId: milestone.id,
    ...overrides,
  });
}

test('create project seeds default roles', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'HuntianLing' });
  assert.equal(project.roles.length, DEFAULT_ROLES.length);
  assert.ok(project.roles.some((role) => role.id === 'developer'));
});

test('records and filters audit events for WorkItem changes', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-board-'));
  const store = new BoardStore(root);
  const project = store.createProject({ name: '审计项目' });
  const item = store.createWorkItem({
    projectId: project.id,
    type: 'requirement',
    title: '审计需求',
    body: '需要记录需求变化。',
    acceptance: ['能够查询需求变更审计'],
  });

  store.updateWorkItem(item.id, {
    analysis: '需求分析已经补充。',
    priority: 'p1',
  });
  store.transitionCard(item.id, 'triaged');

  const itemEvents = store.listAuditEvents({
    projectId: project.id,
    targetType: 'work_item',
    targetId: item.id,
  });
  assert.deepEqual(
    [...itemEvents.map((event) => event.action)].sort(),
    ['work_item.created', 'work_item.transitioned', 'work_item.updated'],
  );
  assert.deepEqual(
    itemEvents.find((event) => event.action === 'work_item.transitioned').changedFields,
    ['status'],
  );
  assert.deepEqual(
    itemEvents.find((event) => event.action === 'work_item.updated').changedFields,
    ['analysis', 'priority'],
  );

  const persisted = new BoardStore(root);
  assert.equal(persisted.listAuditEvents({ projectId: project.id, action: 'work_item.updated' }).length, 1);
  assert.equal(persisted.listAuditEvents({ projectId: project.id, targetId: project.id }).length, 1);
  assert.equal(persisted.listAuditEvents({ projectId: project.id, from: Date.now() + 1 }).length, 0);
  assert.equal(persisted.listAuditEvents({ projectId: project.id, limit: 2 }).length, 2);
});

test('developer can claim an unclaimed card', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const card = readyStory(store, project.id, { title: '认领切片' });
  assert.equal(card.claimedBy, null);
  const claimed = store.claimCard(card.id, { roleId: 'developer', actorId: 'dev-1' });
  assert.equal(claimed.claimedRoleId, 'developer');
  assert.equal(claimed.claimedBy, 'dev-1');
  assert.equal(typeof claimed.claimedAt, 'number');
});

test('another actor cannot take a claimed card', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const card = readyStory(store, project.id, { title: '卡' });
  store.claimCard(card.id, { roleId: 'developer', actorId: 'dev-1' });
  assert.throws(
    () => store.claimCard(card.id, { roleId: 'product-owner', actorId: 'po-1' }),
    /already claimed/,
  );
});

test('same actor may switch role; unclaim then others may claim', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const card = readyStory(store, project.id, { title: '卡' });
  store.claimCard(card.id, { roleId: 'developer', actorId: 'dev-1' });
  const switched = store.claimCard(card.id, { roleId: 'process-steward', actorId: 'dev-1' });
  assert.equal(switched.claimedRoleId, 'process-steward');
  store.unclaimCard(card.id, 'dev-1');
  const taken = store.claimCard(card.id, { roleId: 'product-owner', actorId: 'po-1' });
  assert.equal(taken.claimedBy, 'po-1');
});

test('claim persists across store reload', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-board-'));
  const first = new BoardStore(root);
  const project = first.createProject({ name: 'p' });
  const card = readyStory(first, project.id, { title: '卡' });
  first.claimCard(card.id, { roleId: 'developer', actorId: 'dev-1' });
  const second = new BoardStore(root);
  const loaded = second.getCard(card.id);
  assert.equal(loaded?.claimedBy, 'dev-1');
  assert.equal(loaded?.claimedRoleId, 'developer');
});

test('creates an Azure Boards-style requirement hierarchy', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const epic = store.createWorkItem({
    projectId: project.id,
    type: 'epic',
    title: '统一需求管理',
    body: '产品目标。',
  });
  const feature = store.createWorkItem({
    projectId: project.id,
    type: 'feature',
    title: '看板化需求拆分',
    body: '能力模块。',
    parentId: epic.id,
  });
  const story = store.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '维护父子需求',
    body: '用户可以追踪需求拆分。',
    analysis: '需要展示父子链路。',
    design: '卡片详情中维护拆分关系。',
    sourceInput: '来自产品访谈：需求拆分需要可追踪。',
    decompositionReason: '把父需求拆成一个可验收的端到端 Story。',
    acceptance: ['父需求展示子项进度'],
    acceptanceCriteria: [{ id: 'ac-1', text: '父需求展示子项进度' }],
    parentId: feature.id,
  });
  const task = store.createWorkItem({
    projectId: project.id,
    type: 'task',
    title: '实现层级校验',
    body: '保存前校验父子类型。',
    parentId: story.id,
    coversAcceptanceIds: ['ac-1'],
  });

  assert.equal(task.parentId, story.id);
  assert.equal(story.analysis, '需要展示父子链路。');
  assert.equal(story.design, '卡片详情中维护拆分关系。');
  assert.equal(story.sourceInput, '来自产品访谈：需求拆分需要可追踪。');
  assert.equal(story.decompositionReason, '把父需求拆成一个可验收的端到端 Story。');
  assert.deepEqual(task.coversAcceptanceIds, ['ac-1']);
});

test('work item API updates details, returns trees, board views, and coverage', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const epic = store.createWorkItem({
    projectId: project.id,
    type: 'epic',
    title: '统一需求管理',
    body: '产品目标。',
    acceptanceCriteria: [{ id: 'epic-ac-1', text: '需求拆分可追踪' }],
  });
  const feature = store.createWorkItem({
    projectId: project.id,
    type: 'feature',
    title: '层级需求树',
    body: '能力模块。',
    parentId: epic.id,
  });
  const story = store.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '查看父子需求',
    body: '用户可以展开需求树。',
    parentId: feature.id,
    acceptance: ['树中显示子项'],
  });
  const task = store.createWorkItem({
    projectId: project.id,
    type: 'task',
    title: '实现树查询',
    body: '返回嵌套节点。',
    parentId: story.id,
    coversAcceptanceIds: ['epic-ac-1'],
  });

  const updated = store.updateWorkItem(story.id, {
    analysis: '父子链路必须可见。',
    design: '树视图和泳道复用同一批 WorkItem。',
    sourceInput: '来自需求评审会议。',
    decompositionReason: '拆出独立 Story 便于验证需求树。',
  });
  const tree = store.getWorkItemTree(epic.id);
  const view = store.getBoardView({ projectId: project.id, groupBy: 'parent' });
  const coverage = store.getAcceptanceCoverage(epic.id);

  assert.equal(updated.analysis, '父子链路必须可见。');
  assert.equal(updated.sourceInput, '来自需求评审会议。');
  assert.equal(updated.decompositionReason, '拆出独立 Story 便于验证需求树。');
  assert.equal(tree.children[0]?.item.id, feature.id);
  assert.equal(tree.children[0]?.children[0]?.item.id, story.id);
  assert.ok(view.columns.some((column) => column.id === story.id && column.workItems[0]?.id === task.id));
  assert.deepEqual(coverage, {
    rootId: epic.id,
    totalCriteria: 1,
    coveredCriteria: 1,
    uncoveredAcceptanceIds: [],
    coveringWorkItemIds: [task.id],
    complete: true,
  });
});

test('milestones group work items and report delivery progress', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const milestone = store.createMilestone({
    projectId: project.id,
    title: 'MVP',
    goal: '交付完整需求管理闭环。',
    status: 'active',
  });
  const epic = store.createWorkItem({
    projectId: project.id,
    type: 'epic',
    title: '统一需求管理',
    body: '产品目标。',
    milestoneId: milestone.id,
  });
  const feature = store.createWorkItem({
    projectId: project.id,
    type: 'feature',
    title: '里程碑看板',
    body: '能力模块。',
    parentId: epic.id,
  });
  const story = store.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '查看版本进度',
    body: '用户按里程碑管理交付。',
    parentId: feature.id,
    acceptance: ['里程碑显示进度'],
  });
  const task = store.createWorkItem({
    projectId: project.id,
    type: 'task',
    title: '实现汇总',
    body: '计算完成率。',
    parentId: story.id,
  });
  store.transitionWorkItem(task.id, 'delivered');

  const view = store.getBoardView({ projectId: project.id, groupBy: 'milestone' });
  const summary = store.getMilestoneSummary(milestone.id);
  const milestoneBoard = store.getMilestoneBoard(project.id);

  assert.equal(feature.milestoneId, milestone.id);
  assert.equal(story.milestoneId, milestone.id);
  assert.equal(view.columns.find((column) => column.id === milestone.id)?.title, 'MVP');
  assert.equal(summary.totalWorkItems, 4);
  assert.equal(summary.deliveredWorkItems, 1);
  assert.equal(summary.percentDelivered, 25);
  assert.equal(milestoneBoard.lanes[0]?.summary?.milestone.id, milestone.id);
});

test('milestone delivery slices track cross-milestone parent delivery', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const mvp = store.createMilestone({ projectId: project.id, title: 'MVP' });
  const ga = store.createMilestone({ projectId: project.id, title: 'GA' });
  const story = store.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '跨里程碑需求',
    body: '一个大需求分多期交付。',
    acceptanceCriteria: [
      { id: 'story-ac-1', text: 'MVP 范围可交付' },
      { id: 'story-ac-2', text: 'GA 范围可交付' },
    ],
  });
  const first = store.createMilestoneDeliverySlice({
    parentWorkItemId: story.id,
    milestoneId: mvp.id,
    scope: 'MVP 范围',
    acceptanceCriterionIds: ['story-ac-1'],
    expectedEvidence: ['unit evidence'],
    owner: 'po-1',
  });
  const second = store.createMilestoneDeliverySlice({
    parentWorkItemId: story.id,
    milestoneId: ga.id,
    scope: 'GA 范围',
    acceptanceCriterionIds: ['story-ac-2'],
  });

  assert.equal(store.listMilestoneDeliverySlices({ parentWorkItemId: story.id }).length, 2);
  assert.equal(store.listMilestoneDeliverySlices({ milestoneId: mvp.id })[0]?.id, first.id);
  assert.throws(() => store.transitionWorkItem(story.id, 'delivered'), /executed evidence|incomplete milestone delivery slices/);

  const deliveredFirst = store.updateMilestoneDeliverySlice(first.id, { status: 'delivered' });
  assert.equal(deliveredFirst.updatedAt >= deliveredFirst.createdAt, true);
  assert.throws(() => store.transitionWorkItem(story.id, 'delivered'), /executed evidence|incomplete milestone delivery slices/);

  store.updateMilestoneDeliverySlice(second.id, { status: 'delivered' });
  store.updateDeliveryEvidenceSummary(story.id, {
    checks: [{
      id: 'evaluator:mvp',
      area: 'acceptance',
      title: 'MVP 范围可交付',
      status: 'passing',
      required: true,
      reason: 'executed',
      evidenceIds: ['run-1'],
      acceptanceCriterionIds: [],
      links: [],
      producer: 'evaluator',
      executionKind: 'executed',
      designRevision: '',
    }],
  });
  assert.equal(store.transitionWorkItem(story.id, 'delivered').status, 'delivered');
});

test('milestone delivery slices reject wrong parent type and cross-project milestones', () => {
  const store = tempStore();
  const first = store.createProject({ name: 'first' });
  const second = store.createProject({ name: 'second' });
  const firstMilestone = store.createMilestone({ projectId: first.id, title: 'MVP' });
  const secondMilestone = store.createMilestone({ projectId: second.id, title: '外部里程碑' });
  const story = store.createWorkItem({
    projectId: first.id,
    type: 'story',
    title: '合法父项',
    body: '用于跨项目校验。',
    acceptance: ['可以校验里程碑归属'],
  });
  const task = store.createWorkItem({
    projectId: first.id,
    type: 'task',
    parentId: story.id,
    title: '不能作为切片父项',
    body: 'Task 不是大需求父项。',
  });

  assert.throws(
    () =>
      store.createMilestoneDeliverySlice({
        parentWorkItemId: task.id,
        milestoneId: firstMilestone.id,
        scope: '错误父项',
      }),
    /delivery slice parent/,
  );
  assert.throws(
    () =>
      store.createMilestoneDeliverySlice({
        parentWorkItemId: story.id,
        milestoneId: secondMilestone.id,
        scope: '错误里程碑',
      }),
    /from another project/,
  );
  assert.throws(
    () =>
      store.createMilestoneDeliverySlice({
        parentWorkItemId: story.id,
        milestoneId: firstMilestone.id,
        scope: '错误验收标准',
        acceptanceCriterionIds: ['missing-ac'],
      }),
    /is not on parent/,
  );
});

test('team members track capacity, assignments, and WIP warnings', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const dev = store.createTeamMember({
    projectId: project.id,
    displayName: 'Dev Agent',
    memberType: 'agent',
    roleIds: ['developer'],
    capacityUnits: 1,
    concurrentWorkLimit: 1,
    skillProfile: ['typescript'],
  });
  const reviewer = store.createTeamMember({
    projectId: project.id,
    displayName: 'Reviewer',
    memberType: 'human',
    status: 'unavailable',
    roleIds: ['process-steward'],
  });
  const first = readyStory(store, project.id, { title: '第一条 Story', body: '先交付。' });
  const second = readyStory(store, project.id, { title: '第二条 Story', body: '等待容量。' });

  const assigned = store.assignWorkItem(first.id, {
    memberId: dev.id,
    roleId: 'developer',
    actorId: 'dispatcher',
  });
  assert.equal(assigned.assignee, dev.id);
  assert.equal(assigned.claimedRoleId, 'developer');
  assert.equal(assigned.claimedBy, 'dispatcher');

  const capacity = store.getTeamCapacity(project.id);
  assert.equal(capacity.totalMembers, 2);
  assert.equal(capacity.activeMembers, 1);
  assert.equal(capacity.assignedWorkItems, 1);
  assert.equal(capacity.unassignedWorkItems, 1);
  assert.equal(capacity.members.find((item) => item.member.id === dev.id)?.availableSlots, 0);
  assert.ok(capacity.warnings.includes('unassigned_work'));

  assert.throws(
    () => store.assignWorkItem(second.id, { memberId: dev.id, roleId: 'developer' }),
    /exceeds WIP limit/,
  );
  assert.throws(
    () => store.assignWorkItem(second.id, { memberId: reviewer.id, roleId: 'process-steward' }),
    /is not active/,
  );
  assert.throws(
    () => store.assignWorkItem(second.id, { memberId: dev.id, roleId: 'product-owner' }),
    /does not have role/,
  );

  store.updateTeamMember(dev.id, { concurrentWorkLimit: 2 });
  assert.equal(store.assignWorkItem(second.id, { memberId: dev.id, roleId: 'developer' }).assignee, dev.id);
  assert.equal(store.getTeamCapacity(project.id).overloadedMembers, 0);

  store.updateTeamMember(dev.id, { concurrentWorkLimit: 1, status: 'unavailable' });
  const overloaded = store.getTeamCapacity(project.id);
  assert.equal(overloaded.overloadedMembers, 1);
  assert.equal(overloaded.unavailableMembers, 2);
  assert.ok(overloaded.warnings.includes('member_over_wip_limit'));
  assert.ok(overloaded.warnings.includes('member_unavailable_with_work'));

  assert.throws(
    () =>
      store.createTeamMember({
        projectId: project.id,
        displayName: 'Unknown Role',
        roleIds: ['missing-role'],
      }),
    /role not found/,
  );
});

test('developer assignment and claim require Ready work', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const dev = store.createTeamMember({
    projectId: project.id,
    displayName: 'Dev Agent',
    memberType: 'agent',
    roleIds: ['developer'],
  });
  const inbox = store.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '未梳理 Story',
    body: '还没有走完前置流程。',
    acceptance: ['说明不允许直接开发'],
  });
  const milestone = store.createMilestone({ projectId: project.id, title: 'Ready gate' });

  assert.throws(
    () => store.assignWorkItem(inbox.id, { memberId: dev.id, roleId: 'developer' }),
    /must be ready before developer can claim it/,
  );
  assert.throws(
    () => store.claimWorkItem(inbox.id, { roleId: 'developer', actorId: 'dev-1' }),
    /must be ready before developer can claim it/,
  );
  assert.throws(
    () =>
      store.createWorkItem({
        projectId: project.id,
        type: 'story',
        status: 'ready',
        title: '缺少设计的 Ready Story',
        body: '不能跳过设计进入 Ready。',
        analysis: '分析已完成。',
        acceptance: ['设计缺失时不能 Ready'],
        milestoneId: milestone.id,
      }),
    /cannot become ready without design/,
  );
  const ready = readyStory(store, project.id);
  assert.throws(
    () => store.updateWorkItem(ready.id, { design: '' }),
    /cannot become ready without design/,
  );
  assert.equal(
    store.assignWorkItem(ready.id, { memberId: dev.id, roleId: 'developer' }).assignee,
    dev.id,
  );
});

test('claimed role board seeds every project role lane and filters cards', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const productWork = store.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '确认范围',
    body: '产品负责人确认目标。',
  });
  const devWork = store.createWorkItem({
    projectId: project.id,
    type: 'task',
    status: 'ready',
    title: '实现切片',
    body: '开发认领实现工作。',
  });
  const unclaimedWork = store.createWorkItem({
    projectId: project.id,
    type: 'research',
    title: '梳理约束',
    body: '等待角色认领。',
  });
  store.claimWorkItem(productWork.id, { roleId: 'product-owner', actorId: 'po-1' });
  store.claimWorkItem(devWork.id, { roleId: 'developer', actorId: 'dev-1' });

  const view = store.getBoardView({ projectId: project.id, groupBy: 'claimedRole' });
  assert.deepEqual(
    view.columns.map((column) => [column.id, column.title]),
    [
      ['product-owner', '产品负责人'],
      ['developer', '开发'],
      ['process-steward', '流程看护'],
      ['unclaimed', 'Unclaimed'],
    ],
  );
  assert.equal(
    view.columns.find((column) => column.id === 'product-owner')?.workItems[0]?.id,
    productWork.id,
  );
  assert.equal(
    view.columns.find((column) => column.id === 'developer')?.workItems[0]?.id,
    devWork.id,
  );
  assert.equal(view.columns.find((column) => column.id === 'process-steward')?.workItems.length, 0);
  assert.equal(
    view.columns.find((column) => column.id === 'unclaimed')?.workItems[0]?.id,
    unclaimedWork.id,
  );

  const developerOnly = store.getBoardView({
    projectId: project.id,
    groupBy: 'claimedRole',
    claimedRoleId: 'developer',
  });
  assert.deepEqual(developerOnly.workItems.map((item) => item.id), [devWork.id]);
  assert.equal(developerOnly.columns.find((column) => column.id === 'developer')?.workItems.length, 1);
  assert.equal(developerOnly.columns.find((column) => column.id === 'product-owner')?.workItems.length, 0);
});

test('workflow summaries persist and story queue explains skipped higher-priority stories', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-board-'));
  const store = new BoardStore(root);
  const project = store.createProject({ name: 'p' });
  const milestone = store.createMilestone({ projectId: project.id, title: 'MVP' });
  const dev = store.createTeamMember({
    projectId: project.id,
    displayName: 'Dev Agent',
    memberType: 'agent',
    roleIds: ['developer'],
    concurrentWorkLimit: 3,
  });
  const blocked = store.createWorkItem({
    projectId: project.id,
    type: 'story',
    status: 'planned',
    milestoneId: milestone.id,
    title: '高优先级但缺设计',
    body: '调度器必须解释为什么跳过。',
    analysis: '分析已完成。',
    acceptance: ['解释跳过原因'],
  });
  const ready = store.createWorkItem({
    projectId: project.id,
    type: 'story',
    status: 'ready',
    milestoneId: milestone.id,
    title: '可端到端交付',
    body: '满足 Definition of Ready。',
    analysis: '分析已完成。',
    design: '设计已完成。',
    acceptance: ['可以进入交付运行'],
  });
  store.updateWorkItem(blocked.id, { priority: 'p0' });
  store.updateWorkItem(ready.id, { priority: 'p1' });
  store.assignWorkItem(ready.id, { memberId: dev.id, roleId: 'developer' });

  const summary = store.updateWorkflowBoardSummary(blocked.id, {
    workflowRunId: 'run-1',
    workflowTemplateVersion: 'story-e2e@1',
    runStatus: 'blocked',
    activeOwner: 'PO',
    activeRoleId: 'product-owner',
    nextAction: '补齐需求设计后重新调度',
    downstreamImpact: '实现和 QA 不会启动。',
    schedulerReason: '跳过高优先级 Story，因为设计缺失。',
    waitingApprovals: [{
      id: 'approval-1',
      type: 'approval',
      title: 'PO 确认设计完整性',
      status: 'waiting',
      roleId: 'product-owner',
      owner: 'PO',
      dueAt: null,
      links: [],
    }],
    blockedSteps: [{
      id: 'design-step',
      title: '需求设计评审',
      status: 'blocked',
      owner: 'Architect',
      roleId: 'developer',
      dependsOnStepIds: [],
      reason: '缺少设计说明。',
      links: [{ kind: 'work-item', id: blocked.id, label: blocked.title, url: null }],
    }],
    failedChecks: [{
      id: 'dor-check',
      title: 'Definition of Ready',
      status: 'failing',
      reason: 'design is empty',
      links: [],
    }],
    controls: ['resume', 'reassign', 'retry'],
    links: [{ kind: 'scheduler-timeline', id: 'run-1', label: 'Scheduler timeline', url: null }],
  });

  assert.equal(summary.workflowRunId, 'run-1');
  assert.equal(summary.waitingApprovals.length, 1);
  assert.equal(summary.blockedSteps[0].links[0].kind, 'work-item');
  assert.throws(
    () => store.updateWorkflowBoardSummary(blocked.id, { controls: ['merge'] }),
    /invalid workflow control/,
  );

  const reloaded = new BoardStore(root);
  assert.equal(reloaded.getWorkflowBoardSummary(blocked.id).schedulerReason, '跳过高优先级 Story，因为设计缺失。');
  const queue = reloaded.getStoryPriorityQueue(project.id);
  assert.deepEqual(queue.items.map((item) => item.workItemId), [blocked.id, ready.id]);
  assert.equal(queue.items[0].skipped, true);
  assert.ok(queue.items[0].blockedReasons.includes('missing_design'));
  assert.ok(queue.items[0].blockedReasons.includes('waiting_approvals'));
  assert.equal(queue.items[1].ready, true);
  assert.deepEqual(queue.readyStoryIds, [ready.id]);
  assert.deepEqual(queue.skippedStoryIds, [blocked.id]);
});

test('delivery evidence summaries persist, roll up, and gate delivered status when configured', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-board-'));
  const store = new BoardStore(root);
  const project = store.createProject({ name: 'p' });
  const milestone = store.createMilestone({ projectId: project.id, title: 'MVP' });
  const story = store.createWorkItem({
    projectId: project.id,
    type: 'story',
    status: 'verifying',
    milestoneId: milestone.id,
    title: '需要证据的 Story',
    body: '交付前必须证明代码、CI 和治理门禁。',
    analysis: '证据需要和需求关联。',
    design: '证据摘要由 BoardStore 持久化。',
    acceptanceCriteria: [{ id: 'story-ac-1', text: '交付证据可追踪' }],
  });

  const summary = store.updateDeliveryEvidenceSummary(story.id, {
    codeLinks: [{
      kind: 'commit',
      id: 'commit-1',
      label: 'abc123',
      url: null,
      acceptanceCriterionIds: ['story-ac-1'],
    }],
    pullRequests: [{
      kind: 'pull-request',
      id: 'pr-1',
      label: 'PR #1',
      url: 'https://example.test/pr/1',
      acceptanceCriterionIds: ['story-ac-1'],
    }],
    reviewLinks: [{
      kind: 'code-review',
      id: 'review-1',
      label: 'Review approved',
      url: null,
      acceptanceCriterionIds: [],
    }],
    ciRuns: [{
      kind: 'ci-run',
      id: 'ci-1',
      label: 'unit tests',
      url: null,
      acceptanceCriterionIds: [],
    }],
    checks: [
      {
        id: 'code-linked',
        area: 'code',
        title: 'Code linked to acceptance',
        status: 'passing',
        required: true,
        reason: 'commit covers story-ac-1',
        evidenceIds: ['commit-1'],
        acceptanceCriterionIds: ['story-ac-1'],
        links: [],
      },
      {
        id: 'security-review',
        area: 'security',
        title: 'Threat model review',
        status: 'blocked',
        required: true,
        reason: 'review not complete',
        evidenceIds: [],
        acceptanceCriterionIds: [],
        links: [],
      },
      {
        id: 'reliability-test',
        area: 'reliability',
        title: 'Rollback drill',
        status: 'pending',
        required: true,
        reason: 'waiting for CI evidence',
        evidenceIds: [],
        acceptanceCriterionIds: [],
        links: [],
      },
      {
        id: 'trust-provenance',
        area: 'trust',
        title: 'AI provenance attached',
        status: 'missing',
        required: true,
        reason: 'agent output lacks source links',
        evidenceIds: [],
        acceptanceCriterionIds: [],
        links: [],
      },
    ],
    obligations: [{
      id: 'nist-csf-govern',
      title: 'NIST CSF governance control',
      jurisdiction: 'global',
      source: 'NIST CSF 2.0',
      status: 'pending_review',
      owner: 'Compliance',
      reviewer: 'Legal',
      effectiveDate: null,
      reviewDate: null,
      controlIds: ['GV.OC-01'],
      links: [],
    }],
    riskAcceptances: [{
      id: 'risk-1',
      area: 'security',
      title: 'Temporary scan waiver',
      status: 'requested',
      approver: '',
      reason: 'scanner integration is pending',
      expiresAt: null,
      links: [],
    }],
    provenanceLinks: [{
      kind: 'trust-evidence',
      id: 'agent-run-1',
      label: 'Agent provenance',
      url: null,
      acceptanceCriterionIds: [],
    }],
    notes: 'Evidence is not sufficient for delivery yet.',
  });

  assert.equal(summary.codeLinks[0].acceptanceCriterionIds[0], 'story-ac-1');
  assert.equal(summary.checks.length, 4);
  assert.throws(
    () => store.updateDeliveryEvidenceSummary(story.id, {
      checks: [{
        id: 'bad-area',
        area: 'privacy',
        title: 'Bad area',
        status: 'passing',
        required: true,
        reason: '',
        evidenceIds: [],
        acceptanceCriterionIds: [],
        links: [],
      }],
    }),
    /invalid delivery evidence check area/,
  );

  const reloaded = new BoardStore(root);
  assert.equal(reloaded.getDeliveryEvidenceSummary(story.id).notes, 'Evidence is not sufficient for delivery yet.');
  const rollup = reloaded.getProjectDeliveryEvidenceRollup(project.id);
  assert.equal(rollup.totalWorkItems, 1);
  assert.equal(rollup.workItemsWithCode, 1);
  assert.equal(rollup.workItemsWithPullRequests, 1);
  assert.equal(rollup.workItemsWithReviews, 1);
  assert.equal(rollup.workItemsWithCi, 1);
  assert.equal(rollup.missingRequiredChecks, 1);
  assert.equal(rollup.pendingRequiredChecks, 1);
  assert.equal(rollup.failedRequiredChecks, 1);
  assert.equal(rollup.unapprovedObligations, 1);
  assert.equal(rollup.openRiskAcceptances, 1);
  assert.deepEqual(rollup.blockedWorkItemIds, [story.id]);
  assert.throws(() => reloaded.transitionWorkItem(story.id, 'delivered'), /executed evidence|blocking delivery evidence/);

  reloaded.updateDeliveryEvidenceSummary(story.id, {
    checks: [
      ...summary.checks.map((check) => ({ ...check, status: 'passing' })),
      {
        id: 'evaluator:行为',
        area: 'acceptance',
        title: '行为可验证',
        status: 'passing',
        required: true,
        reason: 'executed',
        evidenceIds: ['run-1'],
        acceptanceCriterionIds: [],
        links: [],
        producer: 'evaluator',
        executionKind: 'executed',
        designRevision: '',
      },
    ],
    obligations: summary.obligations.map((obligation) => ({ ...obligation, status: 'active' })),
    riskAcceptances: summary.riskAcceptances.map((riskAcceptance) => ({
      ...riskAcceptance,
      status: 'approved',
      approver: 'Compliance',
    })),
  });
  assert.equal(reloaded.transitionWorkItem(story.id, 'delivered').status, 'delivered');
});

test('executed evidence becomes stale after analysis or design change', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const story = store.createWorkItem({
    projectId: project.id,
    type: 'story',
    status: 'verifying',
    title: '版本变化',
    body: '设计变化后旧证据失效。',
    analysis: '初版分析',
    design: '初版设计',
    acceptance: ['行为可验证'],
  });
  store.updateDeliveryEvidenceSummary(story.id, {
    designRevision: 'keep-until-update',
    checks: [{
      id: 'evaluator:行为可验证',
      area: 'acceptance',
      title: '行为可验证',
      status: 'passing',
      required: true,
      reason: 'deterministic-evaluator',
      evidenceIds: ['run-1'],
      acceptanceCriterionIds: [],
      links: [],
      producer: 'evaluator',
      executionKind: 'executed',
      designRevision: 'keep-until-update',
    }],
  });
  store.updateWorkItem(story.id, { analysis: '改过的分析' });
  const stale = store.getDeliveryEvidenceSummary(story.id);
  assert.equal(stale.checks[0].status, 'blocked');
  assert.match(stale.checks[0].reason, /stale after design revision/);
  assert.throws(() => store.transitionWorkItem(story.id, 'delivered'), /executed evidence|blocking delivery evidence/);
});

test('work items cannot use a milestone from another project', () => {
  const store = tempStore();
  const first = store.createProject({ name: 'first' });
  const second = store.createProject({ name: 'second' });
  const milestone = store.createMilestone({ projectId: first.id, title: 'MVP' });

  assert.throws(
    () =>
      store.createWorkItem({
        projectId: second.id,
        type: 'epic',
        title: '错误跨项目里程碑',
        body: '不能挂到 first 的里程碑。',
        milestoneId: milestone.id,
      }),
    /from another project/,
  );
});

test('requirement intake keeps sources, candidates, and approved work item hierarchy', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-board-'));
  const store = new BoardStore(root);
  const project = store.createProject({ name: 'p' });
  const session = store.createIntakeSession({
    projectId: project.id,
    title: '支付对账自动化',
    submitter: 'po',
  });
  const source = store.addIntakeSourceDocument(session.id, {
    kind: 'markdown',
    name: 'idea.md',
    mimeType: 'text/markdown',
    size: 128,
    extractedText: '用户需要上传交易文件。\n验收标准：系统能够识别异常交易。',
  });
  const pending = store.addIntakeSourceDocument(session.id, {
    kind: 'pdf',
    name: 'contract.pdf',
    mimeType: 'application/pdf',
    size: 256,
  });
  store.addIntakeMessage(session.id, {
    role: 'user',
    author: 'po',
    body: '需要一个端到端 Story，支持分析、设计和验收证据。',
    sourceDocumentIds: [source.id, pending.id],
  });

  const analyzed = store.analyzeIntakeSession(session.id);
  assert.equal(analyzed.session.status, 'candidates_ready');
  assert.equal(analyzed.sourceDocuments[0].parseStatus, 'parsed');
  assert.equal(analyzed.sourceDocuments[1].parseStatus, 'pending');
  assert.deepEqual(
    analyzed.candidates.map((candidate) => candidate.type),
    ['epic', 'feature', 'story', 'research', 'task'],
  );
  assert.equal(analyzed.candidates[1].parentCandidateId, analyzed.candidates[0].id);
  assert.equal(analyzed.candidates[2].parentCandidateId, analyzed.candidates[1].id);
  assert.equal(analyzed.candidates[3].parentCandidateId, analyzed.candidates[1].id);
  assert.equal(analyzed.candidates[4].parentCandidateId, analyzed.candidates[2].id);
  assert.equal(analyzed.candidates.some((candidate) => candidate.sourceRefs.length > 0), true);
  const epicRefs = analyzed.candidates[0].sourceRefs;
  assert.equal(epicRefs.some((ref) => ref.messageId !== null), true);
  assert.equal(
    epicRefs.some((ref) => ref.sourceDocumentId === source.id && ref.sourceChunkId !== null),
    true,
  );
  assert.equal(
    epicRefs.some((ref) => ref.sourceDocumentId === pending.id && ref.sourceChunkId === null),
    true,
  );

  const approved = store.approveIntakeCandidates(session.id, { actorId: 'po' });
  assert.equal(approved.session.status, 'approved');
  assert.equal(approved.workItems.length, 5);
  const epic = approved.workItems.find((item) => item.type === 'epic');
  const feature = approved.workItems.find((item) => item.type === 'feature');
  const story = approved.workItems.find((item) => item.type === 'story');
  const task = approved.workItems.find((item) => item.type === 'task');
  const research = approved.workItems.find((item) => item.type === 'research');
  assert.ok(epic);
  assert.equal(feature?.parentId, epic.id);
  assert.equal(story?.parentId, feature?.id);
  assert.equal(task?.parentId, story?.id);
  assert.equal(research?.parentId, feature?.id);

  const reloaded = new BoardStore(root);
  assert.equal(reloaded.getIntakeSessionBundle(session.id).candidates.every((candidate) => (
    candidate.status === 'approved' && candidate.workItemId !== null
  )), true);
  assert.equal(reloaded.listWorkItems({ projectId: project.id }).length, 5);
});

test('requirement intake approves selected candidates with milestone assignments', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-board-'));
  const store = new BoardStore(root);
  const project = store.createProject({ name: 'p' });
  const mvp = store.createMilestone({ projectId: project.id, title: 'MVP' });
  const ga = store.createMilestone({ projectId: project.id, title: 'GA' });
  const session = store.createIntakeSession({
    projectId: project.id,
    title: '支付对账自动化',
    submitter: 'po',
  });
  store.addIntakeMessage(session.id, {
    role: 'user',
    author: 'po',
    body: '需要一个端到端 Story，验收标准：上传交易文件后自动识别异常。',
  });

  const analyzed = store.analyzeIntakeSession(session.id);
  const storyCandidate = analyzed.candidates.find((candidate) => candidate.type === 'story');
  const taskCandidate = analyzed.candidates.find((candidate) => candidate.type === 'task');
  assert.ok(storyCandidate);
  assert.ok(taskCandidate);
  store.updateIntakeCandidate(storyCandidate.id, { milestoneId: mvp.id });

  const partial = store.approveIntakeCandidates(session.id, {
    candidateIds: [storyCandidate.id],
    actorId: 'po',
  });
  assert.equal(partial.session.status, 'candidates_ready');
  assert.deepEqual(partial.workItems.map((item) => item.type), ['epic', 'feature', 'story']);
  const storyWorkItem = partial.workItems.find((item) => item.type === 'story');
  assert.equal(storyWorkItem?.milestoneId, mvp.id);
  assert.match(storyWorkItem?.sourceInput ?? '', /需要一个端到端 Story/);
  assert.match(storyWorkItem?.decompositionReason ?? '', /父候选需求/);
  assert.equal(
    store.getIntakeSessionBundle(session.id).candidates.find((candidate) => candidate.id === taskCandidate.id)?.status,
    'draft',
  );
  assert.throws(
    () => store.approveIntakeCandidates(session.id, { candidateIds: [] }),
    /at least one intake candidate/,
  );

  store.updateIntakeCandidate(taskCandidate.id, { milestoneId: ga.id });
  const completed = store.approveIntakeCandidates(session.id, {
    candidateIds: [taskCandidate.id],
    actorId: 'po',
  });
  assert.equal(completed.session.status, 'approved');
  const taskWorkItem = store.listWorkItems({ projectId: project.id }).find((item) => item.type === 'task');
  assert.equal(taskWorkItem?.parentId, storyWorkItem?.id);
  assert.equal(taskWorkItem?.milestoneId, ga.id);
  assert.equal(store.listWorkItems({ projectId: project.id }).length, 4);
});

test('old board snapshots migrate missing milestone fields', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-board-'));
  mkdirSync(join(root, '.huntianling'), { recursive: true });
  writeFileSync(
    join(root, '.huntianling', 'board.json'),
    JSON.stringify({
      schemaVersion: 2,
      projects: [{ id: 'project-1', name: 'p', description: '', roles: [] }],
      cards: [
        {
          id: 'item-1',
          projectId: 'project-1',
          type: 'epic',
          title: '旧数据',
          body: '旧 schema 没有里程碑。',
          analysis: '',
          design: '',
          status: 'inbox',
          priority: null,
          estimate: null,
          assignee: '',
          parentId: null,
          startDate: null,
          dueDate: null,
          acceptance: [],
          acceptanceCriteria: [],
          coversAcceptanceIds: [],
          dependencyIds: [],
          blockedByIds: [],
          evidence: [],
          sourceRequirementId: null,
          sortOrder: 10000,
          claimedRoleId: null,
          claimedBy: null,
          claimedAt: null,
        },
      ],
    }),
    'utf8',
  );

  const store = new BoardStore(root);
  assert.equal(store.getWorkItem('item-1')?.milestoneId, null);
  assert.equal(store.getWorkItem('item-1')?.sourceInput, '');
  assert.equal(store.getWorkItem('item-1')?.decompositionReason, '');
  assert.deepEqual(store.listMilestones(), []);
  assert.deepEqual(store.listMilestoneDeliverySlices(), []);
  assert.deepEqual(store.listWorkflowBoardSummaries(), []);
  assert.deepEqual(store.listDeliveryEvidenceSummaries(), []);
  assert.deepEqual(store.listIntakeSessions(), []);
  assert.deepEqual(store.listIntakeCandidates(), []);
});

test('rejects work items under the wrong parent type', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const feature = store.createCard({
    projectId: project.id,
    type: 'feature',
    title: '孤立能力',
    body: '暂未挂 Epic。',
  });

  assert.throws(
    () =>
      store.createCard({
        projectId: project.id,
        type: 'task',
        title: '错误任务',
        body: 'Task 不能直接挂 Feature。',
        parentId: feature.id,
      }),
    /task .* cannot use feature .* as parent/,
  );
});

test('rejects a parent from another project', () => {
  const store = tempStore();
  const first = store.createProject({ name: 'first' });
  const second = store.createProject({ name: 'second' });
  const feature = store.createWorkItem({
    projectId: first.id,
    type: 'feature',
    title: '第一个项目的能力',
    body: '只属于 first。',
  });

  assert.throws(
    () =>
      store.createWorkItem({
        projectId: second.id,
        type: 'story',
        title: '错误跨项目子需求',
        body: '不能挂到 first 的 Feature。',
        parentId: feature.id,
        acceptance: ['拒绝跨项目父项'],
      }),
    /from another project/,
  );
});

function readyCard(store, projectId) {
  return store.createCard({
    projectId,
    title: '薄片',
    body: '可验证的一小步。',
    acceptance: ['Given x When y Then z'],
  });
}

function attachExecutedEvidence(store, itemId) {
  store.updateDeliveryEvidenceSummary(itemId, {
    checks: [{
      id: 'evaluator:done',
      area: 'acceptance',
      title: 'Given x When y Then z',
      status: 'passing',
      required: true,
      reason: 'executed',
      evidenceIds: ['run-1'],
      acceptanceCriterionIds: [],
      links: [],
      producer: 'evaluator',
      executionKind: 'executed',
      designRevision: '',
    }],
  });
}

test('transitionCard is the only status write path and allows inbox to triaged', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const card = readyCard(store, project.id);
  const moved = store.transitionCard(card.id, 'triaged');
  assert.equal(moved.status, 'triaged');
});

test('transitionCard rejects delivered back to inbox', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const card = readyCard(store, project.id);
  attachExecutedEvidence(store, card.id);
  store.transitionCard(card.id, 'delivered');
  assert.throws(() => store.transitionCard(card.id, 'inbox'), /forbidden transition/);
});

test('failing gate blocks transition and leaves status unchanged', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const card = readyCard(store, project.id);
  attachExecutedEvidence(store, card.id);
  store.registerGate({
    id: 'block-delivered',
    to: 'delivered',
    run: () => ({ ok: false, reason: 'no evidence' }),
  });
  assert.throws(() => store.transitionCard(card.id, 'delivered'), /gate block-delivered/);
  assert.equal(store.getCard(card.id)?.status, 'inbox');
});

test('passing gate allows the transition', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const card = readyCard(store, project.id);
  store.registerGate({
    id: 'allow-triaged',
    to: 'triaged',
    run: () => ({ ok: true }),
  });
  const moved = store.transitionCard(card.id, 'triaged');
  assert.equal(moved.status, 'triaged');
});

test('requirement cannot leave inbox without acceptance', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const card = store.createCard({
    projectId: project.id,
    title: '无验收',
    body: '缺验收。',
  });
  assert.throws(() => store.transitionCard(card.id, 'triaged'), /without acceptance/);
});
