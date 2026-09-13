import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createGovernanceService } from '../../lib/host/governance/service.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(14),
  });
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d14-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const governance = createGovernanceService({ board, workspaceRoot: root });
  return { root, board, project, governance };
}

function story(board, project, extras = {}) {
  return board.createWorkItem({
    projectId: project.id,
    type: 'story',
    status: 'verifying',
    title: '登录',
    body: '客户能登录',
    analysis: '需要登录',
    design: '表单',
    acceptance: ['可登录'],
    ...extras,
  });
}

test('Project view shows applicable obligations, control coverage, risk register, open exceptions, security readiness, reliability readiness, AI trust assessments, and evidence report status', () => {
  const { board, project, governance } = setup();
  const item = story(board, project, { productionFacing: true });
  governance.selectPack(project.id, 'owasp-asvs', '1.0.0', 'dev');
  const obligation = governance.createObligation({
    projectId: project.id,
    title: 'PIPL',
    kind: 'regional_law',
    jurisdiction: 'CN',
    source: 'PIPL',
    applicabilityReason: 'personal data',
    owner: 'compliance',
    reviewer: 'legal',
    workItemIds: [item.id],
  });
  governance.mapControl({
    projectId: project.id,
    packId: 'owasp-asvs',
    packVersion: '1.0.0',
    controlId: 'V2.1.1',
    workItemId: item.id,
    checkIds: ['password-length'],
    actor: 'dev',
  });
  governance.recordRiskAcceptance({
    workItemId: item.id,
    area: 'security',
    title: 'legacy hash',
    approver: 'sec',
    reason: 'migrate next quarter',
    scope: 'login',
    actor: 'sec',
  });
  governance.ingestSecurityEvidence({
    workItemId: item.id,
    kind: 'secret-scan',
    title: 'gitleaks',
    status: 'failing',
    actor: 'dev',
  });
  governance.recordSlo({
    projectId: project.id,
    workItemId: item.id,
    name: 'login availability',
    availabilityTarget: '99.9%',
    latencyTarget: '200ms',
    errorBudget: '0.1%',
    capacityAssumptions: 'single region',
    backupRequirements: 'daily',
    restoreObjective: '1h',
    dependencyAssumptions: 'idp',
    observabilityPlan: 'metrics',
    actor: 'sre',
  });
  governance.recordAiRiskAssessment({
    workItemId: item.id,
    summary: 'login copy assist',
    residualRisk: 'low',
    usesAi: true,
    actor: 'dev',
  });
  const report = governance.createEvidenceReport({
    projectId: project.id,
    scope: 'project',
    actor: 'dev',
  });
  const dashboard = governance.dashboard({ projectId: project.id });
  assert.equal(dashboard.obligations.some((row) => row.id === obligation.id), true);
  assert.ok(dashboard.controlCoverage.totalControls > 0);
  assert.ok(dashboard.controlCoverage.mappedControls >= 1);
  assert.equal(dashboard.riskRegister.some((row) => row.title === 'legacy hash'), true);
  assert.ok(dashboard.openExceptions.length >= 1);
  assert.equal(typeof dashboard.securityReadiness.ready, 'boolean');
  assert.equal(typeof dashboard.reliabilityReadiness.ready, 'boolean');
  assert.equal(dashboard.trustAssessments.some((row) => row.summary === 'login copy assist'), true);
  assert.equal(dashboard.evidenceReports.some((row) => row.id === report.id && row.status === 'draft'), true);
});

test('WorkItem detail shows required controls, mapped checks, missing evidence, residual risks, approval requirements, and trust provenance', () => {
  const { board, project, governance } = setup();
  const item = story(board, project, { governanceFlags: ['ai_output'] });
  governance.selectPack(project.id, 'owasp-asvs', '1.0.0', 'dev');
  governance.createObligation({
    projectId: project.id,
    title: 'ASVS passwords',
    kind: 'industry_rule',
    jurisdiction: 'global',
    source: 'OWASP',
    applicabilityReason: 'login',
    owner: 'security',
    reviewer: 'legal',
    workItemIds: [item.id],
  });
  governance.mapControl({
    projectId: project.id,
    packId: 'owasp-asvs',
    packVersion: '1.0.0',
    controlId: 'V2.1.1',
    workItemId: item.id,
    checkIds: ['password-length'],
    actor: 'dev',
  });
  governance.recordRiskAcceptance({
    workItemId: item.id,
    area: 'trust',
    title: 'model drift',
    approver: 'owner',
    reason: 'monitored',
    scope: 'copy',
    actor: 'owner',
  });
  governance.recordAgentProvenance({
    runId: 'run-1',
    projectId: project.id,
    workItemId: item.id,
    sourceInputs: ['story'],
    modelIdentity: 'test-model',
    generatedOutput: 'draft',
  });
  governance.configureGatePolicy(project.id, { requireAttestationForDelivery: true }, 'dev');
  const dashboard = governance.dashboard({ projectId: project.id, workItemId: item.id });
  const view = dashboard.workItems[0];
  assert.ok(view);
  assert.ok(view.requiredControls.some((row) => row.controlId === 'V2.1.1'));
  assert.deepEqual(view.mappedChecks, ['password-length']);
  assert.ok(view.missingEvidence.length > 0);
  assert.equal(view.residualRisks.some((row) => row.title === 'model drift'), true);
  assert.ok(view.approvalRequirements.some((row) => row.includes('request review') || row.includes('signed evidence')));
  assert.equal(view.provenance.length, 1);
  assert.equal(view.provenance[0].modelIdentity, 'test-model');
});

test('Milestone view rolls up compliance, security, reliability, and trust readiness for the planned delivery scope', () => {
  const { board, project, governance } = setup();
  const milestone = board.createMilestone({ projectId: project.id, title: 'M1' });
  story(board, project, {
    milestoneId: milestone.id,
    productionFacing: true,
    securityClassification: {
      securityImpact: 'high',
      dataSensitivity: 'low',
      permissionImpact: 'low',
      exposedApiSurface: 'low',
      dependencyRisk: 'low',
      deploymentRisk: 'low',
    },
  });
  const dashboard = governance.dashboard({ projectId: project.id, milestoneId: milestone.id });
  assert.equal(dashboard.milestoneId, milestone.id);
  assert.equal(dashboard.milestones.length, 1);
  const rollup = dashboard.milestones[0];
  assert.equal(rollup.title, 'M1');
  assert.equal(typeof rollup.complianceReady, 'boolean');
  assert.equal(typeof rollup.securityReady, 'boolean');
  assert.equal(typeof rollup.reliabilityReady, 'boolean');
  assert.equal(typeof rollup.trustReady, 'boolean');
  assert.equal(rollup.workItemCount, 1);
});

test('Users can request review, approve obligations, accept residual risk, and sign evidence reports when their role allows it', async (t) => {
  const { board, project, governance } = setup();
  const item = story(board, project);
  const obligation = governance.createObligation({
    projectId: project.id,
    title: 'Contract clause',
    kind: 'customer_contract',
    jurisdiction: 'global',
    source: 'MSA',
    applicabilityReason: 'customer requires it',
    owner: 'dev',
    reviewer: 'dev',
    workItemIds: [item.id],
  });
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements: createRequirementManagementService(board), governance },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        sessionTtlMs: 60_000,
        users: [
          { username: 'dev', passwordHash: hash, audience: 'developer' },
          { username: 'cust', passwordHash: hash, audience: 'customer', projectIds: [project.id] },
        ],
      },
    },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const reviewed = await json(
    `${status.url}/api/v1/compliance/obligations/${encodeURIComponent(obligation.id)}/request-review`,
    { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{}' },
  );
  assert.equal(reviewed.response.status, 200);
  assert.equal(reviewed.payload.status, 'pending_review');
  const approved = await json(
    `${status.url}/api/v1/compliance/obligations/${encodeURIComponent(obligation.id)}/approve`,
    { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{}' },
  );
  assert.equal(approved.response.status, 200);
  assert.equal(approved.payload.status, 'approved');
  const risk = await json(
    `${status.url}/api/v1/work-items/${encodeURIComponent(item.id)}/security/risk-acceptance`,
    {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'waiver',
        approver: 'sec',
        reason: 'tracked',
        scope: 'login',
        compensatingControls: ['waf'],
      }),
    },
  );
  assert.equal(risk.response.status, 201);
  const created = await json(
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/evidence-reports`,
    {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ scope: 'project' }),
    },
  );
  assert.equal(created.response.status, 201);
  const signed = await json(
    `${status.url}/api/v1/evidence-reports/${encodeURIComponent(created.payload.id)}/sign`,
    { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{}' },
  );
  assert.equal(signed.response.status, 200);
  assert.equal(signed.payload.status, 'approved');
  assert.equal(signed.payload.approvedBy, 'dev');
  assert.equal(
    board.listAuditEvents({ projectId: project.id, action: 'governance.evidence-report.signed' }).length,
    1,
  );
  const dashboard = await json(
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/governance/dashboard`,
    { headers: { cookie } },
  );
  assert.equal(dashboard.response.status, 200);
  assert.equal(dashboard.payload.obligations[0]?.status, 'approved');
  assert.equal(dashboard.payload.riskRegister.length, 1);
  assert.equal(dashboard.payload.evidenceReports[0]?.status, 'approved');
});

test('customers cannot request review, approve obligations, accept residual risk, or sign evidence reports', async (t) => {
  const { board, project, governance } = setup();
  const item = story(board, project);
  const obligation = governance.createObligation({
    projectId: project.id,
    title: 'Contract clause',
    kind: 'customer_contract',
    jurisdiction: 'global',
    source: 'MSA',
    applicabilityReason: 'customer requires it',
    owner: 'dev',
    reviewer: 'legal',
  });
  const report = governance.createEvidenceReport({ projectId: project.id, scope: 'project', actor: 'dev' });
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements: createRequirementManagementService(board), governance },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        sessionTtlMs: 60_000,
        users: [
          { username: 'dev', passwordHash: hash, audience: 'developer' },
          { username: 'cust', passwordHash: hash, audience: 'customer', projectIds: [project.id] },
        ],
      },
    },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cust', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const deniedReview = await json(
    `${status.url}/api/v1/compliance/obligations/${encodeURIComponent(obligation.id)}/request-review`,
    { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{}' },
  );
  assert.equal(deniedReview.response.status, 403);
  const deniedApprove = await json(
    `${status.url}/api/v1/compliance/obligations/${encodeURIComponent(obligation.id)}/approve`,
    { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{}' },
  );
  assert.equal(deniedApprove.response.status, 403);
  const deniedRisk = await json(
    `${status.url}/api/v1/work-items/${encodeURIComponent(item.id)}/security/risk-acceptance`,
    {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'waiver',
        approver: 'x',
        reason: 'y',
        scope: 'z',
      }),
    },
  );
  assert.equal(deniedRisk.response.status, 403);
  const deniedSign = await json(
    `${status.url}/api/v1/evidence-reports/${encodeURIComponent(report.id)}/sign`,
    { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{}' },
  );
  assert.equal(deniedSign.response.status, 403);
});

test('authenticated dashboard HTML shows obligations, residual risk, and signed evidence actions', async (t) => {
  const { board, project } = setup();
  story(board, project);
  const web = createWebService(
    { board, requirements: createRequirementManagementService(board) },
    { autoStart: false, host: '127.0.0.1', port: 0 },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const page = await fetch(`${status.url}/developer/governance`).then((response) => response.text());
  assert.match(page, /治理和信任看板/);
  assert.match(page, /id="governance-dashboard"/);
  assert.match(page, /适用义务/);
  assert.match(page, /控制覆盖/);
  assert.match(page, /风险登记/);
  assert.match(page, /开放例外/);
  assert.match(page, /安全准备/);
  assert.match(page, /可靠性准备/);
  assert.match(page, /可信评估/);
  assert.match(page, /证据报告/);
  assert.match(page, /请求评审/);
  assert.match(page, /批准义务/);
  assert.match(page, /接受残余风险/);
  assert.match(page, /签署证据报告/);
  const fused = await fetch(`${status.url}/`).then((response) => response.text());
  assert.match(fused, /data-area-id="governance"/);
  assert.match(fused, /治理和信任看板/);
  assert.match(fused, /请求评审/);
  assert.match(fused, /签署证据报告/);
  const developer = await fetch(`${status.url}/developer`).then((response) => response.text());
  assert.match(developer, /href="\/developer\/governance"/);
});
