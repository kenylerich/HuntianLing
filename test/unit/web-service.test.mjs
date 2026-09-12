import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService, isPublicHost, resolveWebConfig } from '../../lib/host/web/server.js';

const WORKFLOW_LIFECYCLE_STATUS_COVERAGE = [
  'inbox',
  'analyzing',
  'designing',
  'triaged',
  'planned',
  'ready',
  'in_progress',
  'in_review',
  'verifying',
  'gates_passing',
  'delivered',
  'rejected',
  'stopped',
];

function services() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-web-'));
  const board = createBoardService(root);
  const requirements = createRequirementManagementService(board);
  const project = board.createProject({ name: 'HuntianLing', description: '需求管理项目' });
  return { board, requirements, project };
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json();
  return { response, payload };
}

test('web service serves the browser surface and board APIs', async (t) => {
  const { board, requirements, project } = services();
  const milestone = board.createMilestone({
    projectId: project.id,
    title: 'MVP',
    goal: '外部用户可以访问需求看板。',
    status: 'active',
  });
  const release = board.createMilestone({
    projectId: project.id,
    title: 'Release 2',
    goal: '跨里程碑交付后续需求。',
    status: 'planned',
  });
  const epic = requirements.createEpic({
    projectId: project.id,
    title: '完整需求管理',
    body: '管理产品级目标。',
    milestoneId: milestone.id,
  });
  const feature = requirements.createFeature({
    epicId: epic.id,
    title: '看板化需求拆分',
    body: '管理能力模块。',
  });
  const story = requirements.createStory({
    featureId: feature.id,
    title: '填写需求分析和设计',
    body: '用户在详情中维护需求信息。',
    acceptanceCriteria: [{ id: 'story-ac-1', text: '需求可以被拆分和追踪' }],
  });
  const task = requirements.createTask({
    parentId: story.id,
    title: '实现 Web API',
    body: '外部用户可以通过 URL 访问。',
    coversAcceptanceIds: ['story-ac-1'],
  });

  const web = createWebService({ board, requirements }, { autoStart: false, host: '127.0.0.1', port: 0 });
  t.after(() => web.stop());
  const status = await web.start();
  assert.equal(status.running, true);
  assert.match(status.url, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.deepEqual(web.getSurface(), {
    id: 'huntianling.board',
    title: 'HuntianLing Board',
    kind: 'browser',
    url: status.url,
  });

  const html = await fetch(`${status.url}/`).then((response) => response.text());
  assert.match(html, /HuntianLing Board/);
  assert.match(html, /id="workspace-heading"/);
  assert.match(html, /id="workspace" class="workspace"/);
  assert.match(html, /\.workspace\.has-detail/);
  assert.match(html, /id="view-tabs"/);
  assert.match(html, /data-area-id="requirements"/);
  assert.match(html, /backlog-workbench/);
  assert.match(html, /backlog-view-manager/);
  assert.match(html, /backlog-column-checks/);
  assert.match(html, /backlog-filter-grid/);
  assert.match(html, /backlog-level-grid/);
  assert.match(html, /backlog-planning-grid/);
  assert.match(html, /backlog-decision-grid/);
  assert.match(html, /backlog-command-layout/);
  assert.match(html, /backlog-support-drawer/);
  assert.match(html, /backlog-insights/);
  assert.match(html, /backlog-signal-list/);
  assert.match(html, /backlog-delivery-list/);
  assert.match(html, /backlog-list-panel/);
  assert.match(html, /backlog-bulk-bar/);
  assert.match(html, /backlog-flow-panel/);
  assert.match(html, /intake-workbench/);
  assert.match(html, /intake-session-bar/);
  assert.match(html, /renderIntakeConversationPanel/);
  assert.match(html, /renderIntakeSourcePanel/);
  assert.match(html, /renderIntakeCandidateReviewPanel/);
  assert.match(html, /intake-review-toolbar/);
  assert.match(html, /intakeSessionNextAction/);
  assert.match(html, /planning-workbench/);
  assert.match(html, /planning-roadmap-workbench/);
  assert.match(html, /planning-focus-list/);
  assert.match(html, /planning-scope-panel/);
  assert.match(html, /planning-timeline/);
  assert.match(html, /planning-scope-matrix/);
  assert.match(html, /renderMilestoneTimeline/);
  assert.match(html, /renderPlanningFocusPanel/);
  assert.match(html, /renderPlanningScopeMatrix/);
  assert.match(html, /renderDeliveryBoard/);
  assert.match(html, /delivery-slice-workbench/);
  assert.match(html, /renderDeliveryParentMap/);
  assert.match(html, /sidebarChromeForArea/);
  assert.match(html, /里程碑维护/);
  assert.match(html, /deliverySliceItems/);
  assert.match(html, /audit-board/);
  assert.match(html, /audit-workbench/);
  assert.match(html, /audit-filter-bar/);
  assert.match(html, /audit-timeline/);
  assert.match(html, /audit-summary-panel/);
  assert.match(html, /audit-mini-timeline/);
  assert.match(html, /business-crud/);
  assert.match(html, /admin-workbench/);
  assert.match(html, /renderAdminProjectPanel/);
  assert.match(html, /renderAdminAccessPanel/);
  assert.match(html, /admin-provider-list/);
  assert.match(html, /createProjectFromValues/);
  assert.match(html, /saveTokenValue/);
  assert.match(html, /board-summary\.compact/);
  assert.match(html, /\(state\.areaId === 'intake' &&\s+state\.viewId === 'intake-board'\)/);
  assert.match(html, /state\.areaId === 'settings' && state\.viewId === 'admin-settings'/);
  assert.match(html, /body\[data-current-area-id="settings"\]:not\(\.auth-locked\)/);
  assert.match(html, /crud-workbench/);
  assert.match(html, /renderBusinessCrudBoard/);
  assert.match(html, /loadBusinessCrudCoverage/);
  assert.match(html, /workflow-workbench/);
  assert.match(html, /agile-lifecycle-lanes/);
  assert.match(html, /renderWorkflowLifecycleLanes/);
  assert.match(html, /workflowLifecycleCoverage/);
  assert.match(html, /workflow-stage-track/);
  assert.match(html, /renderWorkflowRunway/);
  assert.match(html, /renderWorkflowStoryQueue/);
  assert.match(html, /renderWorkflowHandoffPanel/);
  assert.match(html, /renderWorkflowBlockerPanel/);
  assert.match(html, /workflowBlockedItems/);
  assert.match(html, /team-workbench/);
  assert.match(html, /renderTeamRoleBoard/);
  assert.match(html, /renderTeamRoleLanes/);
  assert.match(html, /renderTeamCapacityPanel/);
  assert.match(html, /team-work-card/);
  assert.match(html, /evidence-workbench/);
  assert.match(html, /evidence-matrix/);
  assert.match(html, /renderEvidenceMatrix/);
  assert.match(html, /renderEvidenceBlockerQueue/);
  assert.match(html, /renderEvidenceGovernanceQueue/);
  assert.match(html, /evidenceGapLabels/);
  assert.match(html, /delivery-gate-panel/);
  assert.match(html, /delivery-gate-list/);
  assert.match(html, /deliveryGateField/);
  assert.match(html, /deliveryGateBlocks/);
  assert.match(html, /gate-blocked/);
  assert.match(html, /loadProjectAuditEvents/);
  assert.match(html, /loadWorkItemAuditEvents/);
  assert.match(html, /document\.body\.dataset\.currentAreaId/);
  assert.doesNotMatch(html, /document\.body\.dataset\.areaId/);
  assert.match(html, /querySelectorAll\('\.module-rail \[data-area-id\]'\)/);
  assert.doesNotMatch(html, /querySelectorAll\('\[data-area-id\]'\)/);
  assert.match(html, /select\.hidden = area\.views\.length <= 1/);
  assert.match(html, /root\.hidden = area\.views\.length <= 1/);

  const projects = await json(`${status.url}/api/projects`);
  assert.equal(projects.response.status, 200);
  assert.equal(projects.payload.projects[0].id, project.id);

  const crud = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/business-crud`);
  assert.equal(crud.response.status, 200);
  assert.equal(crud.payload.projectId, project.id);
  assert.equal(crud.payload.entities.some((entity) => entity.id === 'work-item'), true);
  assert.equal(crud.payload.entities.some((entity) => entity.id === 'audit-event'), true);
  assert.equal(crud.payload.entities.some((entity) =>
    entity.operations.some((operation) => operation.kind === 'delete' && operation.status === 'forbidden'),
  ), true);
  assert.equal(crud.payload.summary.entities, crud.payload.entities.length);
  assert.equal(crud.payload.summary.gaps > 0, true);

  const milestones = await json(`${status.url}/api/milestones?projectId=${encodeURIComponent(project.id)}`);
  assert.equal(milestones.response.status, 200);
  assert.equal(milestones.payload.milestones[0].id, milestone.id);

  const view = await json(`${status.url}/api/board?projectId=${encodeURIComponent(project.id)}&groupBy=milestone`);
  assert.equal(view.response.status, 200);
  assert.equal(view.payload.workItems.length, 4);
  assert.equal(view.payload.columns.some((column) => column.id === milestone.id), true);

  const updated = await json(`${status.url}/api/work-items/${encodeURIComponent(story.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      analysis: '看板详情可维护需求分析。',
      design: 'Web 表单写回 WorkItem 字段。',
      sourceInput: '来自需求评审会纪要。',
      decompositionReason: '把能力拆成 Story 便于端到端验收。',
      milestoneId: null,
    }),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(updated.payload.analysis, '看板详情可维护需求分析。');
  assert.equal(updated.payload.design, 'Web 表单写回 WorkItem 字段。');
  assert.equal(updated.payload.sourceInput, '来自需求评审会纪要。');
  assert.equal(updated.payload.decompositionReason, '把能力拆成 Story 便于端到端验收。');
  assert.equal(updated.payload.milestoneId, null);

  const milestoneBoard = await json(`${status.url}/api/milestone-board?projectId=${encodeURIComponent(project.id)}`);
  assert.equal(milestoneBoard.response.status, 200);
  assert.equal(milestoneBoard.payload.lanes[0].summary.milestone.id, milestone.id);

  const mvpSlice = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/milestone-slices`, {
    method: 'POST',
    body: JSON.stringify({
      milestoneId: milestone.id,
      title: 'MVP slice',
      scope: 'MVP 完成需求分析和设计。',
      acceptanceCriterionIds: ['story-ac-1'],
      expectedEvidence: ['unit test'],
      owner: 'po-1',
    }),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(mvpSlice.response.status, 201);
  assert.equal(mvpSlice.payload.parentWorkItemId, story.id);

  const releaseSlice = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/milestone-slices`, {
    method: 'POST',
    body: JSON.stringify({
      milestoneId: release.id,
      scope: 'Release 2 完成外部访问增强。',
      acceptanceCriterionIds: ['story-ac-1'],
      owner: 'dev-1',
    }),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(releaseSlice.response.status, 201);

  const milestonePlan = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/milestone-plan`);
  assert.equal(milestonePlan.response.status, 200);
  assert.equal(milestonePlan.payload.totalSlices, 2);
  assert.equal(milestonePlan.payload.milestoneRollups.some((rollup) => rollup.milestone.id === release.id), true);

  const v1MilestoneBoard = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/main-board/milestones`);
  assert.equal(v1MilestoneBoard.response.status, 200);
  assert.equal(v1MilestoneBoard.payload.totalSlices, 2);
  assert.equal(v1MilestoneBoard.payload.lanes.some((lane) => lane.milestone?.id === release.id && lane.slices.length === 1), true);
  assert.equal(v1MilestoneBoard.payload.lanes.some((lane) => lane.rollup.totalSlices > 0), true);

  const milestoneSlices = await json(`${status.url}/api/v1/milestones/${encodeURIComponent(release.id)}/requirement-slices`);
  assert.equal(milestoneSlices.response.status, 200);
  assert.equal(milestoneSlices.payload.slices[0].slice.id, releaseSlice.payload.id);

  board.updateDeliveryEvidenceSummary(story.id, {
    checks: [{
      id: 'evaluator:story-delivery',
      area: 'acceptance',
      title: 'story delivery evidence',
      status: 'passing',
      required: true,
      reason: 'executed',
      evidenceIds: ['run-1'],
      acceptanceCriterionIds: ['story-ac-1'],
      links: [],
      producer: 'evaluator',
      executionKind: 'executed',
      designRevision: '',
    }],
  });
  const blockedDelivery = await json(`${status.url}/api/work-items/${encodeURIComponent(story.id)}/transition`, {
    method: 'POST',
    body: JSON.stringify({ status: 'delivered' }),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(blockedDelivery.response.status, 400);
  assert.match(blockedDelivery.payload.error, /incomplete milestone delivery slices/);

  const completedMvpSlice = await json(
    `${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/milestone-slices/${encodeURIComponent(mvpSlice.payload.id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status: 'delivered' }),
      headers: { 'content-type': 'application/json' },
    },
  );
  assert.equal(completedMvpSlice.response.status, 200);
  assert.equal(completedMvpSlice.payload.status, 'delivered');

  const tree = await json(`${status.url}/api/requirements/${encodeURIComponent(epic.id)}/tree`);
  assert.equal(tree.payload.children[0].item.id, feature.id);
  assert.equal(tree.payload.children[0].children[0].item.id, story.id);

  const coverage = await json(`${status.url}/api/work-items/${encodeURIComponent(story.id)}/coverage`);
  assert.equal(coverage.payload.complete, true);

  const member = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/team/members`, {
    method: 'POST',
    body: JSON.stringify({
      displayName: 'Dev Agent',
      memberType: 'agent',
      roleIds: ['developer'],
      capacityUnits: 1,
      concurrentWorkLimit: 1,
      skillProfile: ['typescript'],
    }),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(member.response.status, 201);
  assert.equal(member.payload.displayName, 'Dev Agent');

  const readyTask = await json(`${status.url}/api/work-items/${encodeURIComponent(task.id)}/transition`, {
    method: 'POST',
    body: JSON.stringify({ status: 'ready' }),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(readyTask.response.status, 200);
  assert.equal(readyTask.payload.status, 'ready');

  const assignment = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(task.id)}/assignments`, {
    method: 'POST',
    body: JSON.stringify({
      memberId: member.payload.id,
      roleId: 'developer',
      actorId: 'dispatcher',
    }),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(assignment.response.status, 200);
  assert.equal(assignment.payload.assignee, member.payload.id);

  const storyWithMilestone = await json(`${status.url}/api/work-items/${encodeURIComponent(story.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ milestoneId: milestone.id }),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(storyWithMilestone.response.status, 200);
  assert.equal(storyWithMilestone.payload.milestoneId, milestone.id);

  const readyStory = await json(`${status.url}/api/work-items/${encodeURIComponent(story.id)}/transition`, {
    method: 'POST',
    body: JSON.stringify({ status: 'ready' }),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(readyStory.response.status, 200);
  assert.equal(readyStory.payload.status, 'ready');

  const rejectedAssignment = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/assignments`, {
    method: 'POST',
    body: JSON.stringify({
      memberId: member.payload.id,
      roleId: 'developer',
    }),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(rejectedAssignment.response.status, 400);
  assert.match(rejectedAssignment.payload.error, /exceeds WIP limit/);

  const capacity = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/team/capacity`);
  assert.equal(capacity.response.status, 200);
  assert.equal(capacity.payload.assignedWorkItems, 1);
  assert.equal(capacity.payload.unassignedWorkItems, 3);

  const teamBoard = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/main-board/team`);
  assert.equal(teamBoard.response.status, 200);
  assert.equal(teamBoard.payload.members[0].member.id, member.payload.id);
  assert.equal(teamBoard.payload.members[0].assignedCards[0].workItem.id, task.id);
  assert.equal(teamBoard.payload.unassignedCards.length, 3);

  const roleBoard = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/main-board?viewId=role-board`);
  assert.equal(roleBoard.response.status, 200);
  assert.equal(roleBoard.payload.view.id, 'role-board');
  assert.deepEqual(
    roleBoard.payload.columns.map((column) => [column.id, column.title]),
    [
      ['product-owner', '产品负责人'],
      ['developer', '开发'],
      ['process-steward', '流程看护'],
      ['unclaimed', 'Unclaimed'],
    ],
  );
  assert.equal(
    roleBoard.payload.columns.find((column) => column.id === 'developer')?.cards[0]?.workItem.id,
    task.id,
  );
  assert.equal(roleBoard.payload.columns.find((column) => column.id === 'unclaimed')?.cards.length, 3);

  const workflowPatch = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/workflow`, {
    method: 'PATCH',
    body: JSON.stringify({
      workflowRunId: 'run-story-1',
      workflowTemplateVersion: 'story-e2e@1',
      runStatus: 'blocked',
      activeOwner: 'Product Owner',
      activeRoleId: 'product-owner',
      nextAction: '补齐设计评审后继续',
      schedulerReason: 'Story 等待 PO 审批和 DoR 检查。',
      downstreamImpact: '实现、评审和 QA 暂不启动。',
      waitingApprovals: [{
        id: 'approval-1',
        type: 'approval',
        title: 'PO 审批 Story 设计',
        status: 'waiting',
        roleId: 'product-owner',
        owner: 'Alice PO',
        dueAt: null,
        links: [],
      }],
      waitingReviews: [{
        id: 'review-1',
        type: 'review',
        title: '架构评审设计输出',
        status: 'waiting',
        roleId: 'developer',
        owner: 'Dev Agent',
        dueAt: null,
        links: [],
      }],
      blockedSteps: [{
        id: 'design-review',
        title: '设计评审',
        status: 'blocked',
        owner: 'Dev Agent',
        roleId: 'developer',
        dependsOnStepIds: ['analysis'],
        reason: '等待 PO 审批。',
        links: [{ kind: 'work-item', id: story.id, label: story.title, url: null }],
      }],
      failedChecks: [{
        id: 'dor',
        title: 'Definition of Ready',
        status: 'failing',
        reason: 'Milestone and owner are missing.',
        links: [],
      }],
      controls: ['resume', 'cancel', 'reassign', 'retry'],
      links: [{ kind: 'scheduler-timeline', id: 'run-story-1', label: 'Scheduler timeline', url: null }],
    }),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(workflowPatch.response.status, 200);
  assert.equal(workflowPatch.payload.runStatus, 'blocked');
  assert.equal(workflowPatch.payload.waitingApprovals.length, 1);

  const workflowAlias = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/workflow-board-summary`);
  assert.equal(workflowAlias.response.status, 200);
  assert.equal(workflowAlias.payload.workflowRunId, 'run-story-1');

  const workflowBoard = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/main-board/workflow`);
  assert.equal(workflowBoard.response.status, 200);
  assert.equal(workflowBoard.payload.blockedWorkflows, 1);
  assert.equal(workflowBoard.payload.waitingApprovals, 1);
  assert.equal(workflowBoard.payload.waitingReviews, 1);
  assert.equal(workflowBoard.payload.failedChecks, 1);
  assert.equal(workflowBoard.payload.lanes.some((lane) => lane.id === 'blocked'), true);
  assert.equal(workflowBoard.payload.lifecycleLanes.length, 12);
  assert.deepEqual(workflowBoard.payload.lifecycleCoverage.mappedStatuses, WORKFLOW_LIFECYCLE_STATUS_COVERAGE);
  assert.deepEqual(workflowBoard.payload.lifecycleCoverage.unmappedStatuses, []);
  assert.equal(workflowBoard.payload.lifecycleLanes.some((lane) =>
    lane.id === 'ready' && lane.cards.some((item) => item.card.workItem.id === story.id),
  ), true);
  assert.equal(workflowBoard.payload.lifecycleLanes.some((lane) =>
    lane.id === 'quality-gates' && lane.evidenceAreas.includes('security') && lane.evidenceAreas.includes('trust'),
  ), true);
  assert.equal(workflowBoard.payload.lifecycleLanes.some((lane) =>
    lane.id === 'exception' && lane.statuses.includes('rejected') && lane.statuses.includes('stopped'),
  ), true);

  const storyQueue = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/story-queue`, {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(storyQueue.response.status, 200);
  assert.equal(storyQueue.payload.recomputed, true);
  assert.equal(storyQueue.payload.items[0].workItemId, story.id);
  assert.ok(storyQueue.payload.items[0].blockedReasons.includes('waiting_approvals'));

  const evidencePatch = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/delivery-evidence`, {
    method: 'PATCH',
    body: JSON.stringify({
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
        url: null,
        acceptanceCriterionIds: ['story-ac-1'],
      }],
      reviewLinks: [{
        kind: 'code-review',
        id: 'review-1',
        label: 'Code review approved',
        url: null,
        acceptanceCriterionIds: [],
      }],
      ciRuns: [{
        kind: 'ci-run',
        id: 'ci-1',
        label: 'unit test workflow',
        url: null,
        acceptanceCriterionIds: [],
      }],
      checks: [{
        id: 'security-gate',
        area: 'security',
        title: 'Threat model review',
        status: 'blocked',
        required: true,
        reason: 'security review is not complete',
        evidenceIds: [],
        acceptanceCriterionIds: [],
        links: [],
      }],
      obligations: [{
        id: 'obligation-1',
        title: 'NIST CSF governance review',
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
        title: 'Temporary security waiver',
        status: 'requested',
        approver: '',
        reason: 'scanner adapter is pending',
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
      notes: 'Evidence is visible before delivery.',
    }),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(evidencePatch.response.status, 200);
  assert.equal(evidencePatch.payload.codeLinks.length, 1);
  assert.equal(evidencePatch.payload.checks[0].area, 'security');

  const evidenceAlias = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/evidence`);
  assert.equal(evidenceAlias.response.status, 200);
  assert.equal(evidenceAlias.payload.notes, 'Evidence is visible before delivery.');

  const evidenceBoard = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/main-board/evidence`);
  assert.equal(evidenceBoard.response.status, 200);
  assert.equal(evidenceBoard.payload.rollup.workItemsWithPullRequests, 1);
  assert.equal(evidenceBoard.payload.rollup.workItemsWithCi, 1);
  assert.equal(evidenceBoard.payload.rollup.unapprovedObligations, 1);
  assert.equal(evidenceBoard.payload.lanes.some((lane) => lane.id === 'blocked'), true);
  const blockedEvidenceCard = evidenceBoard.payload.summaries.find((summary) => summary.card.workItem.id === story.id);
  assert.equal(blockedEvidenceCard.laneId, 'blocked');
  assert.equal(blockedEvidenceCard.blockedReasonCodes.includes('missing_security_evidence'), true);
  assert.equal(blockedEvidenceCard.blockedReasonCodes.includes('compliance_review_pending'), true);
  assert.equal(blockedEvidenceCard.blockedReasonCodes.includes('risk_acceptance_open'), true);

  const projectEvidence = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/delivery-evidence`);
  assert.equal(projectEvidence.response.status, 200);
  assert.equal(projectEvidence.payload.summaries.some((summary) => summary.workItemId === story.id), true);

  const codeView = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/code-view`);
  assert.equal(codeView.response.status, 200);
  assert.equal(codeView.payload.commits[0].id, 'commit-1');
  assert.equal(codeView.payload.pullRequests[0].id, 'pr-1');
  assert.equal(codeView.payload.ciRuns[0].id, 'ci-1');

  const milestoneCodeView = await json(`${status.url}/api/v1/milestones/${encodeURIComponent(milestone.id)}/code-view`);
  assert.equal(milestoneCodeView.response.status, 200);
  assert.equal(milestoneCodeView.payload.rollup.workItemsWithPullRequests, 1);

  const compliance = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/compliance`);
  assert.equal(compliance.response.status, 200);
  assert.equal(compliance.payload.obligations[0].id, 'obligation-1');
  assert.equal(compliance.payload.blockers.length, 3);

  const security = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/security`);
  assert.equal(security.response.status, 200);
  assert.equal(security.payload.checks[0].id, 'security-gate');

  const unlinkedCode = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/unlinked-code`);
  assert.equal(unlinkedCode.response.status, 200);
  assert.deepEqual(unlinkedCode.payload.unlinkedCode, []);

  const mainBoard = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/main-board`);
  assert.equal(mainBoard.response.status, 200);
  assert.equal(mainBoard.payload.project.id, project.id);
  assert.equal(mainBoard.payload.view.id, 'requirement-board');
  assert.equal(mainBoard.payload.boardHealth.total, 4);
  assert.equal(mainBoard.payload.teamMembers[0].id, member.payload.id);
  assert.equal(mainBoard.payload.teamBoard.capacity.assignedWorkItems, 1);
  assert.equal(mainBoard.payload.columns.some((column) => column.id === 'inbox'), true);
  const storyCard = mainBoard.payload.cards.find((card) => card.id === story.id);
  assert.equal(storyCard.workItem.id, story.id);
  assert.equal(storyCard.parentBreadcrumb.at(-1).id, feature.id);
  assert.equal(storyCard.childRollup.total, 1);
  assert.equal(storyCard.acceptanceRollup.complete, true);
  assert.equal(storyCard.workflowSummary.workflowRunId, 'run-story-1');
  assert.equal(storyCard.evidenceSummary.pullRequestCount, 1);
  assert.equal(storyCard.evidenceSummary.ciRunCount, 1);
  assert.equal(storyCard.evidenceSummary.reviewCount, 1);
  assert.equal(storyCard.evidenceSummary.blockers.length, 1);
  assert.equal(storyCard.governanceSummary.unapprovedObligations, 1);
  assert.equal(storyCard.warnings.some((warning) => warning.code === 'compliance_review_pending'), true);
  assert.equal(storyCard.warnings.some((warning) => warning.code === 'risk_acceptance_open'), true);
  assert.equal(mainBoard.payload.workflowBoard.blockedWorkflows, 1);
  assert.equal(mainBoard.payload.storyQueue.items[0].workItemId, story.id);
  assert.equal(mainBoard.payload.evidenceBoard.rollup.workItemsWithCi, 1);
  assert.equal(mainBoard.payload.tree.roots[0].card.workItem.id, epic.id);
  assert.equal(mainBoard.payload.tree.roots[0].children[0].card.workItem.id, feature.id);
  assert.equal(mainBoard.payload.tree.roots[0].children[0].children[0].card.workItem.id, story.id);
  assert.equal(mainBoard.payload.tree.roots[0].children[0].children[0].children[0].card.workItem.id, task.id);
  assert.equal(mainBoard.payload.tree.maxDepth, 4);
  assert.equal(mainBoard.payload.coverage.parents[0].parent.id, story.id);
  assert.equal(mainBoard.payload.coverage.parents[0].rows[0].coveredBy[0].id, task.id);
  assert.equal(mainBoard.payload.coverage.complete, true);
  assert.equal(mainBoard.payload.milestoneBoard.totalSlices, 2);
  assert.equal(mainBoard.payload.milestoneBoard.openSlices, 1);
  assert.equal(mainBoard.payload.milestoneBoard.lanes.some((lane) => lane.rollup.openSlices === 1), true);

  const cards = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/main-board/cards?viewId=delivery-board`);
  assert.equal(cards.response.status, 200);
  assert.equal(cards.payload.cards.length, 1);
  assert.equal(cards.payload.cards[0].workItem.type, 'task');

  const treeBoard = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/main-board/tree`);
  assert.equal(treeBoard.response.status, 200);
  assert.equal(treeBoard.payload.roots[0].children[0].children[0].children[0].card.workItem.id, task.id);

  const coverageBoard = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/main-board/coverage`);
  assert.equal(coverageBoard.response.status, 200);
  assert.equal(coverageBoard.payload.parents[0].coverage.complete, true);
  assert.equal(coverageBoard.payload.parents[0].rows[0].criterionId, 'story-ac-1');
  assert.equal(coverageBoard.payload.parents[0].rows[0].complete, true);

  const coverageView = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/main-board?viewId=coverage-board`);
  assert.equal(coverageView.response.status, 200);
  assert.equal(coverageView.payload.view.id, 'coverage-board');
  assert.equal(coverageView.payload.cards.some((card) => card.workItem.id === story.id), true);
  assert.equal(coverageView.payload.cards.some((card) => card.workItem.id === task.id), false);

  const workflowView = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/main-board?viewId=workflow-board`);
  assert.equal(workflowView.response.status, 200);
  assert.equal(workflowView.payload.view.id, 'workflow-board');
  assert.equal(workflowView.payload.cards.some((card) => card.workItem.id === story.id), true);
  assert.equal(workflowView.payload.workflowBoard.storyQueue.items[0].workItemId, story.id);
  assert.equal(workflowView.payload.workflowBoard.blockedWorkflows, 1);
  assert.equal(workflowView.payload.workflowBoard.waitingApprovals, 1);
  assert.equal(workflowView.payload.workflowBoard.waitingReviews, 1);
  assert.equal(workflowView.payload.workflowBoard.failedChecks, 1);
  assert.equal(workflowView.payload.workflowBoard.lifecycleCoverage.unmappedStatuses.length, 0);
  assert.equal(workflowView.payload.workflowBoard.lifecycleLanes.some((lane) => lane.id === 'implementation'), true);

  const evidenceView = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/main-board?viewId=evidence-board`);
  assert.equal(evidenceView.response.status, 200);
  assert.equal(evidenceView.payload.view.id, 'evidence-board');
  assert.equal(evidenceView.payload.evidenceBoard.lanes.some((lane) => lane.id === 'blocked'), true);

  const detail = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/board-detail`);
  assert.equal(detail.response.status, 200);
  assert.equal(detail.payload.card.workItem.id, story.id);
  assert.equal(detail.payload.children[0].id, task.id);
  assert.equal(detail.payload.milestonePlan.totalSlices, 2);
  assert.equal(detail.payload.teamMembers[0].id, member.payload.id);
  assert.equal(detail.payload.editableFields.includes('analysis'), true);
  assert.equal(detail.payload.card.evidenceSummary.ciRunCount, 1);
  assert.equal(detail.payload.card.governanceSummary.blockers.length, 3);

  const detailPatch = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/board-detail`, {
    method: 'PATCH',
    body: JSON.stringify({
      analysis: 'v1 主看板详情可以维护需求分析。',
      design: 'v1 主看板详情可以维护需求设计。',
      sourceInput: '来自 Story Mapping 评审。',
      decompositionReason: '拆成可独立验证的 Web API 子需求。',
      parentId: feature.id,
      priority: 'p1',
    }),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(detailPatch.response.status, 200);
  assert.equal(detailPatch.payload.card.workItem.analysis, 'v1 主看板详情可以维护需求分析。');
  assert.equal(detailPatch.payload.card.workItem.design, 'v1 主看板详情可以维护需求设计。');
  assert.equal(detailPatch.payload.card.workItem.sourceInput, '来自 Story Mapping 评审。');
  assert.equal(detailPatch.payload.card.workItem.decompositionReason, '拆成可独立验证的 Web API 子需求。');
  assert.equal(detailPatch.payload.card.workItem.parentId, feature.id);
  assert.equal(detailPatch.payload.card.workItem.priority, 'p1');

  const projectAudit = await json(
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/audit-events?action=work_item.updated&limit=5`,
  );
  assert.equal(projectAudit.response.status, 200);
  assert.equal(projectAudit.payload.projectId, project.id);
  assert.equal(
    projectAudit.payload.auditEvents.some((event) =>
      event.targetId === story.id &&
      event.action === 'work_item.updated' &&
      event.changedFields.includes('analysis') &&
      event.changedFields.includes('design'),
    ),
    true,
  );

  const workItemProjectAudit = await json(
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/audit-events?targetType=work_item&limit=10`,
  );
  assert.equal(workItemProjectAudit.response.status, 200);
  assert.equal(
    workItemProjectAudit.payload.auditEvents.every((event) => event.targetType === 'work_item'),
    true,
  );

  const workItemAudit = await json(
    `${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/audit-events`,
  );
  assert.equal(workItemAudit.response.status, 200);
  assert.equal(workItemAudit.payload.workItemId, story.id);
  assert.equal(
    workItemAudit.payload.auditEvents.every((event) =>
      event.targetType === 'work_item' && event.targetId === story.id,
    ),
    true,
  );

  const traceability = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(epic.id)}/traceability`);
  assert.equal(traceability.response.status, 200);
  assert.equal(traceability.payload.root.workItem.id, epic.id);
  assert.deepEqual(traceability.payload.descendants.map((item) => item.id), [feature.id, story.id, task.id]);
  assert.deepEqual(traceability.payload.intakeOrigins, []);

  const intakeSession = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/intake/sessions`, {
    method: 'POST',
    body: JSON.stringify({
      title: '支付对账自动化',
      submitter: 'po',
      sourceChannel: 'web-chat',
    }),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(intakeSession.response.status, 201);
  assert.equal(intakeSession.payload.status, 'collecting');

  const sourceDocument = await json(
    `${status.url}/api/v1/intake/sessions/${encodeURIComponent(intakeSession.payload.id)}/source-documents`,
    {
      method: 'POST',
      body: JSON.stringify({
        kind: 'markdown',
        name: 'idea.md',
        mimeType: 'text/markdown',
        size: 128,
        extractedText: '用户需要上传交易文件。\n验收标准：系统能够识别异常交易。',
      }),
      headers: { 'content-type': 'application/json' },
    },
  );
  assert.equal(sourceDocument.response.status, 201);
  assert.equal(sourceDocument.payload.parseStatus, 'parsed');

  const intakeMessage = await json(
    `${status.url}/api/v1/intake/sessions/${encodeURIComponent(intakeSession.payload.id)}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({
        role: 'user',
        author: 'po',
        body: '需要把 idea 变成可评审的需求树。',
        sourceDocumentIds: [sourceDocument.payload.id],
      }),
      headers: { 'content-type': 'application/json' },
    },
  );
  assert.equal(intakeMessage.response.status, 201);

  const analyzed = await json(
    `${status.url}/api/v1/intake/sessions/${encodeURIComponent(intakeSession.payload.id)}/analyze`,
    {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    },
  );
  assert.equal(analyzed.response.status, 200);
  assert.equal(analyzed.payload.session.status, 'candidates_ready');
  assert.deepEqual(
    analyzed.payload.candidates.map((candidate) => candidate.type),
    ['epic', 'feature', 'story', 'task'],
  );
  const storyCandidate = analyzed.payload.candidates.find((candidate) => candidate.type === 'story');
  const taskCandidate = analyzed.payload.candidates.find((candidate) => candidate.type === 'task');
  assert.ok(storyCandidate);
  assert.ok(taskCandidate);
  assert.equal(
    storyCandidate.sourceRefs.some((ref) => ref.messageId === intakeMessage.payload.id),
    true,
  );
  assert.equal(
    storyCandidate.sourceRefs.some((ref) =>
      ref.sourceDocumentId === sourceDocument.payload.id && ref.sourceChunkId !== null,
    ),
    true,
  );

  const patchedCandidate = await json(
    `${status.url}/api/v1/intake/candidates/${encodeURIComponent(storyCandidate.id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        title: '支付对账自动化 Story',
        body: '用户上传交易文件后，系统自动完成支付对账并标记异常。',
        analysis: '以文件导入、自动比对和异常识别作为首个端到端 Story。',
        design: 'Story 交付时需要保留文件来源、异常明细和审计证据。',
        acceptance: ['可以导入交易文件', '可以生成异常列表'],
        openQuestions: ['确认支持的文件格式'],
        milestoneId: milestone.id,
      }),
      headers: { 'content-type': 'application/json' },
    },
  );
  assert.equal(patchedCandidate.response.status, 200);
  assert.equal(patchedCandidate.payload.title, '支付对账自动化 Story');
  assert.equal(patchedCandidate.payload.body, '用户上传交易文件后，系统自动完成支付对账并标记异常。');
  assert.equal(patchedCandidate.payload.analysis, '以文件导入、自动比对和异常识别作为首个端到端 Story。');
  assert.equal(patchedCandidate.payload.design, 'Story 交付时需要保留文件来源、异常明细和审计证据。');
  assert.deepEqual(patchedCandidate.payload.acceptance, ['可以导入交易文件', '可以生成异常列表']);
  assert.deepEqual(patchedCandidate.payload.openQuestions, ['确认支持的文件格式']);
  assert.equal(patchedCandidate.payload.milestoneId, milestone.id);

  const candidates = await json(
    `${status.url}/api/v1/intake/sessions/${encodeURIComponent(intakeSession.payload.id)}/candidates?status=draft`,
  );
  assert.equal(candidates.response.status, 200);
  assert.equal(candidates.payload.candidates.length, 4);

  const approved = await json(
    `${status.url}/api/v1/intake/sessions/${encodeURIComponent(intakeSession.payload.id)}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({ candidateIds: [storyCandidate.id], actorId: 'po' }),
      headers: { 'content-type': 'application/json' },
    },
  );
  assert.equal(approved.response.status, 200);
  assert.equal(approved.payload.session.status, 'candidates_ready');
  assert.deepEqual(
    approved.payload.workItems.map((item) => item.type),
    ['epic', 'feature', 'story'],
  );
  const approvedStory = approved.payload.workItems.find((item) => item.type === 'story');
  assert.ok(approvedStory);
  assert.equal(approvedStory.title, '支付对账自动化 Story');
  assert.equal(approvedStory.body, '用户上传交易文件后，系统自动完成支付对账并标记异常。');
  assert.equal(approvedStory.analysis, '以文件导入、自动比对和异常识别作为首个端到端 Story。');
  assert.equal(approvedStory.design, 'Story 交付时需要保留文件来源、异常明细和审计证据。');
  assert.deepEqual(approvedStory.acceptance, ['可以导入交易文件', '可以生成异常列表']);
  assert.equal(approvedStory.milestoneId, milestone.id);

  const intakeDetail = await json(
    `${status.url}/api/v1/work-items/${encodeURIComponent(approvedStory.id)}/board-detail`,
  );
  assert.equal(intakeDetail.response.status, 200);
  assert.equal(intakeDetail.payload.intakeOrigin.candidate.id, patchedCandidate.payload.id);
  assert.equal(intakeDetail.payload.intakeOrigin.session.id, intakeSession.payload.id);
  assert.equal(
    intakeDetail.payload.intakeOrigin.sourceRefs.some((ref) => ref.message?.id === intakeMessage.payload.id),
    true,
  );
  assert.equal(
    intakeDetail.payload.intakeOrigin.sourceRefs.some((ref) =>
      ref.sourceDocument?.id === sourceDocument.payload.id && ref.chunk !== null,
    ),
    true,
  );

  const intakeTraceability = await json(
    `${status.url}/api/v1/work-items/${encodeURIComponent(approved.payload.workItems[0].id)}/traceability`,
  );
  assert.equal(intakeTraceability.response.status, 200);
  assert.equal(
    intakeTraceability.payload.intakeOrigins.some((origin) => origin.candidate.id === patchedCandidate.payload.id),
    true,
  );

  const approvedTask = await json(
    `${status.url}/api/v1/intake/sessions/${encodeURIComponent(intakeSession.payload.id)}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({ candidateIds: [taskCandidate.id], actorId: 'po' }),
      headers: { 'content-type': 'application/json' },
    },
  );
  assert.equal(approvedTask.response.status, 200);
  assert.equal(approvedTask.payload.session.status, 'approved');
  assert.equal(board.listWorkItems({ projectId: project.id }).length, 8);

  const directWorkItem = await json(`${status.url}/api/work-items`, {
    method: 'POST',
    body: JSON.stringify({
      projectId: project.id,
      type: 'story',
      parentId: feature.id,
      title: '手工拆分来源追踪',
      body: '人工创建的 Story 也要保留拆分来源。',
      sourceInput: '来自 PO 在需求评审中的补充说明。',
      decompositionReason: '该能力可以独立交付并独立验收。',
      acceptance: ['人工拆分的来源可见'],
    }),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(directWorkItem.response.status, 201);
  assert.equal(directWorkItem.payload.sourceInput, '来自 PO 在需求评审中的补充说明。');
  assert.equal(directWorkItem.payload.decompositionReason, '该能力可以独立交付并独立验收。');
});

test('main board warns about duplicate acceptance coverage and orphaned children', async (t) => {
  const { board, requirements, project } = services();
  const epic = requirements.createEpic({
    projectId: project.id,
    title: '覆盖追踪',
    body: '产品级目标。',
  });
  const feature = requirements.createFeature({
    epicId: epic.id,
    title: '验收覆盖',
    body: '能力模块。',
  });
  const story = requirements.createStory({
    featureId: feature.id,
    title: '重复覆盖检查',
    body: '用户需要知道验收标准是否被重复声明覆盖。',
    acceptanceCriteria: [{ id: 'story-ac-duplicate', text: '重复覆盖可见' }],
  });
  requirements.createTask({
    parentId: story.id,
    title: '前端覆盖',
    body: '实现看板展示。',
    coversAcceptanceIds: ['story-ac-duplicate'],
  });
  requirements.createTask({
    parentId: story.id,
    title: '后端覆盖',
    body: '实现 API 展示。',
    coversAcceptanceIds: ['story-ac-duplicate'],
  });
  const orphanFeature = board.createWorkItem({
    projectId: project.id,
    type: 'feature',
    title: '孤立 Feature',
    body: '缺少 Epic 父项。',
  });
  const missingParentStory = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    parentId: 'missing-parent',
    title: '缺失父项 Story',
    body: '父项 id 指向不存在的 WorkItem。',
    acceptance: ['父项缺失被告警'],
  });

  const web = createWebService({ board, requirements }, { autoStart: false, host: '127.0.0.1', port: 0 });
  t.after(() => web.stop());
  const status = await web.start();

  const coverage = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/main-board/coverage`);
  assert.equal(coverage.response.status, 200);
  assert.equal(coverage.payload.duplicateCoveredCriteria, 1);
  const coverageParent = coverage.payload.parents.find((parent) => parent.parent.id === story.id);
  assert.equal(coverageParent.duplicateCoveredCriteria, 1);
  assert.equal(coverageParent.rows[0].duplicateCoverage, true);
  assert.equal(
    coverageParent.rows[0].warnings.some((warning) => warning.code === 'duplicate_acceptance_coverage'),
    true,
  );

  const tree = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/main-board/tree`);
  assert.equal(tree.response.status, 200);
  assert.equal(tree.payload.warnings.some((warning) => warning.code === 'orphan_without_parent'), true);
  assert.equal(tree.payload.warnings.some((warning) => warning.code === 'missing_parent'), true);

  const cards = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/main-board/cards`);
  assert.equal(cards.response.status, 200);
  const orphanCard = cards.payload.cards.find((card) => card.workItem.id === orphanFeature.id);
  const missingParentCard = cards.payload.cards.find((card) => card.workItem.id === missingParentStory.id);
  assert.equal(orphanCard.warnings.some((warning) => warning.code === 'orphan_without_parent'), true);
  assert.equal(missingParentCard.warnings.some((warning) => warning.code === 'missing_parent'), true);
});

test('public web access rejects writes unless a token or explicit anonymous writes are configured', async (t) => {
  assert.equal(isPublicHost('0.0.0.0'), true);
  assert.equal(resolveWebConfig({ host: '0.0.0.0' }).allowUnauthenticatedWrites, false);

  const { board, requirements } = services();
  const locked = createWebService({ board, requirements }, { autoStart: false, host: '0.0.0.0', port: 0 });
  t.after(() => locked.stop());
  const lockedStatus = await locked.start();

  const rejected = await json(`${lockedStatus.url}/api/projects`, {
    method: 'POST',
    body: JSON.stringify({ name: '外部项目' }),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(rejected.response.status, 403);
  assert.equal(rejected.payload.error, 'write token required');

  await locked.stop();

  const writable = createWebService(
    { board, requirements },
    { autoStart: false, host: '0.0.0.0', port: 0, writeToken: 'secret' },
  );
  t.after(() => writable.stop());
  const writableStatus = await writable.start();
  const created = await json(`${writableStatus.url}/api/projects`, {
    method: 'POST',
    body: JSON.stringify({ name: '外部项目' }),
    headers: {
      authorization: 'Bearer secret',
      'content-type': 'application/json',
    },
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.name, '外部项目');
});

test('authenticated web access uses sessions, API tokens, provider regions, and project scopes', async (t) => {
  const { board, requirements, project } = services();
  const otherProject = board.createProject({ name: 'Restricted', description: '其他项目' });
  const passwordHash = createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(7),
  });
  const web = createWebService(
    { board, requirements },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        sessionTtlMs: 60_000,
        apiTokenTtlMs: 60_000,
        regionMode: 'auto',
        users: [{
          username: 'alice',
          displayName: 'Alice PO',
          passwordHash,
          roles: ['product-owner'],
          projectIds: [project.id],
          region: 'global',
        }],
        providers: {
          cn: [{ id: 'wechat', label: '微信', enabled: false }],
          global: [
            { id: 'google', label: 'Google', kind: 'oidc', enabled: false },
            { id: 'github', label: 'GitHub', enabled: false },
          ],
        },
      },
    },
  );
  t.after(() => web.stop());
  const status = await web.start();

  const unauthenticated = await json(`${status.url}/api/v1/projects`);
  assert.equal(unauthenticated.response.status, 401);
  assert.equal(unauthenticated.payload.error, 'authentication required');

  const providerList = await json(`${status.url}/api/auth/providers?region=cn`);
  assert.equal(providerList.response.status, 200);
  assert.equal(providerList.payload.region, 'cn');
  assert.equal(providerList.payload.providers[0].id, 'wechat');

  const sessionBeforeLogin = await json(`${status.url}/api/auth/session`);
  assert.equal(sessionBeforeLogin.response.status, 200);
  assert.equal(sessionBeforeLogin.payload.auth.enabled, true);
  assert.equal(sessionBeforeLogin.payload.authenticated, false);

  const rejectedLogin = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    body: JSON.stringify({
      username: 'alice',
      password: 'wrong-password',
      region: 'global',
    }),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(rejectedLogin.response.status, 401);
  assert.equal(rejectedLogin.payload.error, 'invalid username or password');

  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    body: JSON.stringify({
      username: 'alice',
      password: 'correct-password',
      region: 'global',
    }),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(login.response.status, 200);
  assert.equal(login.payload.authenticated, true);
  assert.equal(login.payload.principal.username, 'alice');
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);

  const visibleProjects = await json(`${status.url}/api/v1/projects`, {
    headers: { cookie },
  });
  assert.deepEqual(visibleProjects.payload.projects.map((item) => item.id), [project.id]);

  const deniedProject = await json(`${status.url}/api/v1/projects/${encodeURIComponent(otherProject.id)}/main-board`, {
    headers: { cookie },
  });
  assert.equal(deniedProject.response.status, 403);
  assert.equal(deniedProject.payload.error, 'project access denied');

  const createdToken = await json(`${status.url}/api/auth/api-tokens`, {
    method: 'POST',
    body: JSON.stringify({ name: 'automation' }),
    headers: {
      cookie,
      'content-type': 'application/json',
    },
  });
  assert.equal(createdToken.response.status, 201);
  assert.match(createdToken.payload.token, /^hlt_/);
  assert.equal(createdToken.payload.apiToken.name, 'automation');

  const tokenProjects = await json(`${status.url}/api/v1/projects`, {
    headers: { authorization: `Bearer ${createdToken.payload.token}` },
  });
  assert.deepEqual(tokenProjects.payload.projects.map((item) => item.id), [project.id]);

  const listedTokens = await json(`${status.url}/api/auth/api-tokens`, {
    headers: { cookie },
  });
  assert.equal(listedTokens.payload.apiTokens.length, 1);
  assert.equal(listedTokens.payload.apiTokens[0].id, createdToken.payload.apiToken.id);
  assert.equal(listedTokens.payload.apiTokens[0].lastUsedAt > 0, true);

  const deletedToken = await json(
    `${status.url}/api/auth/api-tokens/${encodeURIComponent(createdToken.payload.apiToken.id)}`,
    {
      method: 'DELETE',
      headers: { cookie },
    },
  );
  assert.equal(deletedToken.response.status, 200);
  assert.equal(deletedToken.payload.deleted, true);

  const rejectedToken = await json(`${status.url}/api/v1/projects`, {
    headers: { authorization: `Bearer ${createdToken.payload.token}` },
  });
  assert.equal(rejectedToken.response.status, 401);
  assert.equal(rejectedToken.payload.error, 'authentication required');

  const logout = await json(`${status.url}/api/auth/logout`, {
    method: 'POST',
    body: JSON.stringify({}),
    headers: {
      cookie,
      'content-type': 'application/json',
    },
  });
  assert.equal(logout.response.status, 200);
  assert.match(logout.response.headers.get('set-cookie') ?? '', /Max-Age=0/);

  const sessionAfterLogout = await json(`${status.url}/api/auth/session`, {
    headers: { cookie },
  });
  assert.equal(sessionAfterLogout.payload.authenticated, false);
});
