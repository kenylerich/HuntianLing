import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createGovernanceService } from '../../lib/host/governance/service.js';
import { GovernanceError } from '../../lib/host/governance/types.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

const FRAMEWORKS = [
  { id: 'nist-csf-2.0', name: 'NIST CSF 2.0' },
  { id: 'owasp-asvs', name: 'OWASP ASVS' },
  { id: 'nist-ai-rmf', name: 'NIST AI RMF' },
  { id: 'iso-42001', name: 'ISO/IEC 42001' },
];

const FLAGS = [
  'regulated_data',
  'authentication',
  'authorization',
  'audit',
  'retention',
  'ai_output',
  'payment',
  'security',
  'privacy',
  'availability',
];

const KINDS = [
  'regional_law',
  'industry_rule',
  'internal_policy',
  'customer_contract',
  'certification_program',
];

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(12),
  });
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d12-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const governance = createGovernanceService({ board, workspaceRoot: root });
  return { root, board, project, governance };
}

test('the catalog lists NIST CSF 2.0, OWASP ASVS, NIST AI RMF, and ISO/IEC 42001 framework packs', () => {
  const { governance } = setup();
  const packs = governance.listPacks();
  for (const framework of FRAMEWORKS) {
    const pack = packs.find((item) => item.id === framework.id);
    assert.ok(pack, framework.id);
    assert.equal(pack.frameworkName, framework.name);
    assert.equal(pack.kind, 'builtin');
    assert.ok(pack.version);
    assert.ok(pack.controls.length > 0);
    for (const control of pack.controls) {
      assert.ok(control.controlId);
      assert.ok(control.summary);
      assert.ok(control.applicability);
      assert.ok(control.owner);
      assert.ok(Array.isArray(control.requiredEvidence));
      assert.ok(Array.isArray(control.checkRules));
    }
  }
});

test('a project can select a framework pack version', () => {
  const { governance, project, board } = setup();
  const selected = governance.selectPack(project.id, 'nist-csf-2.0', '1.0.0', 'dev');
  assert.equal(selected.packId, 'nist-csf-2.0');
  assert.equal(selected.packVersion, '1.0.0');
  assert.equal(governance.selectedPacks(project.id)[0]?.packId, 'nist-csf-2.0');
  assert.equal(board.listAuditEvents({ projectId: project.id, action: 'governance.pack.selected' }).length, 1);
  assert.throws(
    () => governance.selectPack(project.id, 'nist-csf-2.0', '9.9.9', 'dev'),
    (error) => error instanceof GovernanceError && error.code === 'NOT_FOUND',
  );
});

test('custom control packs can be added for internal baselines and customer audits', () => {
  const { governance } = setup();
  const internal = governance.registerCustomPack({
    id: 'internal-baseline',
    frameworkName: 'Internal security baseline',
    version: '1.0.0',
    controls: [{ controlId: 'SEC-1', summary: 'Secrets stay out of logs', requiredEvidence: ['code'] }],
  });
  const customer = governance.registerCustomPack({
    id: 'customer-audit',
    frameworkName: 'Customer audit requirements',
    version: '1.0.0',
    controls: [{ controlId: 'AUD-1', summary: 'Access reviews are recorded', requiredEvidence: ['audit'] }],
  });
  assert.equal(internal.kind, 'custom');
  assert.equal(customer.kind, 'custom');
  const ids = governance.listPacks().map((item) => item.id);
  assert.ok(ids.includes('internal-baseline'));
  assert.ok(ids.includes('customer-audit'));
  assert.throws(
    () => governance.registerCustomPack({
      id: 'nist-csf-2.0',
      frameworkName: 'override',
      version: '2.0.0',
      controls: [{ controlId: 'X', summary: 'no' }],
    }),
    (error) => error instanceof GovernanceError && error.code === 'VALIDATION',
  );
});

test('old control pack versions remain available after a newer version is added', () => {
  const { governance } = setup();
  governance.registerCustomPack({
    id: 'internal-baseline',
    frameworkName: 'Internal security baseline',
    version: '1.0.0',
    controls: [{ controlId: 'SEC-1', summary: 'v1 control', requiredEvidence: ['code'] }],
  });
  governance.registerCustomPack({
    id: 'internal-baseline',
    frameworkName: 'Internal security baseline',
    version: '1.1.0',
    controls: [{ controlId: 'SEC-1', summary: 'v1.1 control', requiredEvidence: ['code', 'check'] }],
  });
  const versions = governance.listPacks().filter((item) => item.id === 'internal-baseline').map((item) => item.version);
  assert.deepEqual(versions, ['1.0.0', '1.1.0']);
  assert.equal(
    governance.listPacks().find((item) => item.id === 'internal-baseline' && item.version === '1.0.0')?.controls[0]?.summary,
    'v1 control',
  );
});

test('an obligation stores id, title, jurisdiction, source, applicability reason, owner, reviewer, dates, status, and linked controls', () => {
  const { governance, project } = setup();
  const obligation = governance.createObligation({
    projectId: project.id,
    title: 'PIPL records of processing',
    kind: 'regional_law',
    jurisdiction: 'CN',
    source: 'PIPL',
    applicabilityReason: 'The product stores personal data of mainland users.',
    owner: 'compliance',
    reviewer: 'legal',
    effectiveDate: 1,
    reviewDate: 2,
    controlIds: ['nist-csf-2.0@1.0.0:GV.OC-01'],
  });
  assert.ok(obligation.id);
  assert.equal(obligation.title, 'PIPL records of processing');
  assert.equal(obligation.jurisdiction, 'CN');
  assert.equal(obligation.source, 'PIPL');
  assert.equal(obligation.applicabilityReason, 'The product stores personal data of mainland users.');
  assert.equal(obligation.owner, 'compliance');
  assert.equal(obligation.reviewer, 'legal');
  assert.equal(obligation.effectiveDate, 1);
  assert.equal(obligation.reviewDate, 2);
  assert.equal(obligation.status, 'draft');
  assert.deepEqual(obligation.controlIds, ['nist-csf-2.0@1.0.0:GV.OC-01']);
});

test('a project can register regional laws, industry rules, internal policies, customer contracts, and certification programs', () => {
  const { governance, project } = setup();
  for (const kind of KINDS) {
    const created = governance.createObligation({
      projectId: project.id,
      title: kind,
      kind,
      jurisdiction: 'global',
      source: kind,
      applicabilityReason: 'selected by the project owner',
      owner: 'owner',
      reviewer: 'reviewer',
    });
    assert.equal(created.kind, kind);
  }
  assert.equal(governance.listObligations(project.id).length, KINDS.length);
});

test('obligations link to WorkItems, acceptance criteria, data categories, user roles, source documents, controls, risks, checks, and evidence', () => {
  const { governance, project, board } = setup();
  const item = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '登录',
    body: '客户能登录',
    acceptance: ['可登录'],
  });
  const obligation = governance.createObligation({
    projectId: project.id,
    title: 'Access control',
    kind: 'internal_policy',
    jurisdiction: 'internal',
    source: 'policy',
    applicabilityReason: 'login handles credentials',
    owner: 'security',
    reviewer: 'legal',
    workItemIds: [item.id],
    acceptanceCriterionIds: [item.acceptanceCriteria[0].id],
    dataCategories: ['credentials'],
    userRoles: ['customer'],
    sourceDocumentIds: ['doc-1'],
    controlIds: ['owasp-asvs@1.0.0:V2.1.1'],
    riskIds: ['risk-1'],
    checkIds: ['check-1'],
    evidenceIds: ['ev-1'],
  });
  assert.deepEqual(obligation.workItemIds, [item.id]);
  assert.deepEqual(obligation.acceptanceCriterionIds, [item.acceptanceCriteria[0].id]);
  assert.deepEqual(obligation.dataCategories, ['credentials']);
  assert.deepEqual(obligation.userRoles, ['customer']);
  assert.deepEqual(obligation.sourceDocumentIds, ['doc-1']);
  assert.deepEqual(obligation.controlIds, ['owasp-asvs@1.0.0:V2.1.1']);
  assert.deepEqual(obligation.riskIds, ['risk-1']);
  assert.deepEqual(obligation.checkIds, ['check-1']);
  assert.deepEqual(obligation.evidenceIds, ['ev-1']);
  assert.equal(board.getDeliveryEvidenceSummary(item.id).obligations[0]?.id, obligation.id);
});

test('reviewer approval is required before an obligation can become enforcement policy', () => {
  const { governance, project, board } = setup();
  const item = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    status: 'verifying',
    title: '登录',
    body: '客户能登录',
    analysis: '需要登录',
    design: '表单',
    acceptance: ['可登录'],
  });
  const obligation = governance.createObligation({
    projectId: project.id,
    title: 'Auth policy',
    kind: 'internal_policy',
    jurisdiction: 'internal',
    source: 'policy',
    applicabilityReason: 'login',
    owner: 'security',
    reviewer: 'legal',
    workItemIds: [item.id],
  });
  assert.throws(
    () => governance.approveObligation(obligation.id, 'legal'),
    (error) => error instanceof GovernanceError && error.code === 'NOT_READY',
  );
  assert.throws(
    () => governance.activateObligation(obligation.id, 'legal'),
    (error) => error instanceof GovernanceError && error.code === 'NOT_READY',
  );
  governance.submitObligation(obligation.id, 'security');
  assert.throws(
    () => governance.approveObligation(obligation.id, 'security'),
    (error) => error instanceof GovernanceError && error.code === 'VALIDATION',
  );
  const approved = governance.approveObligation(obligation.id, 'legal');
  assert.equal(approved.status, 'approved');
  assert.equal(approved.approvedBy, 'legal');
  const active = governance.activateObligation(obligation.id, 'legal');
  assert.equal(active.status, 'active');
  assert.equal(board.getDeliveryEvidenceSummary(item.id).obligations[0]?.status, 'active');
});

test('WorkItems can be flagged for regulated data, authentication, authorization, audit, retention, AI output, payment, security, privacy, or availability', () => {
  const { root, board, project } = setup();
  const item = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '支付',
    body: '处理支付',
    acceptance: ['可支付'],
    governanceFlags: FLAGS,
  });
  assert.deepEqual(item.governanceFlags, FLAGS);
  const updated = board.updateWorkItem(item.id, { governanceFlags: ['privacy'] });
  assert.deepEqual(updated.governanceFlags, ['privacy']);
  assert.throws(
    () => board.updateWorkItem(item.id, { governanceFlags: ['not-a-flag'] }),
    /unknown governance impact flag/,
  );
  assert.deepEqual(createBoardService(root).getWorkItem(item.id)?.governanceFlags, ['privacy']);
});

test('controls map to WorkItems, checks, code evidence, CI reports, manual approvals, and audit events', () => {
  const { governance, project, board } = setup();
  const item = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '登录',
    body: '客户能登录',
    acceptance: ['可登录'],
  });
  governance.selectPack(project.id, 'owasp-asvs', '1.0.0', 'dev');
  const mapping = governance.mapControl({
    projectId: project.id,
    packId: 'owasp-asvs',
    packVersion: '1.0.0',
    controlId: 'V2.1.1',
    workItemId: item.id,
    checkIds: ['password-length'],
    codeEvidenceIds: ['commit-1'],
    ciReportIds: ['ci-1'],
    approvalIds: ['approval-1'],
    actor: 'dev',
  });
  assert.deepEqual(mapping.checkIds, ['password-length']);
  assert.deepEqual(mapping.codeEvidenceIds, ['commit-1']);
  assert.deepEqual(mapping.ciReportIds, ['ci-1']);
  assert.deepEqual(mapping.approvalIds, ['approval-1']);
  assert.equal(mapping.auditEventIds.length, 1);
  assert.equal(board.getDeliveryEvidenceSummary(item.id).evidenceLinks.some((link) => link.kind === 'governance-control'), true);
  assert.equal(board.listAuditEvents({ projectId: project.id, action: 'governance.control.mapped' }).length, 1);
});

test('certification readiness is shown by Project, Milestone, and WorkItem', () => {
  const { governance, project, board } = setup();
  const milestone = board.createMilestone({ projectId: project.id, title: 'M1' });
  const item = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '登录',
    body: '客户能登录',
    acceptance: ['可登录'],
    milestoneId: milestone.id,
  });
  governance.selectPack(project.id, 'owasp-asvs', '1.0.0', 'dev');
  const before = governance.certificationReadiness({ projectId: project.id });
  assert.equal(before.ready, false);
  assert.ok(before.totalControls > 0);
  assert.equal(before.mappedControls, 0);
  governance.mapControl({
    projectId: project.id,
    packId: 'owasp-asvs',
    packVersion: '1.0.0',
    controlId: 'V2.1.1',
    workItemId: item.id,
    codeEvidenceIds: ['commit-1'],
    actor: 'dev',
  });
  board.updateDeliveryEvidenceSummary(item.id, {
    checks: [{
      id: 'authz',
      area: 'security',
      title: 'server-side authorization',
      status: 'passing',
      required: true,
      reason: 'ok',
      evidenceIds: ['ci:authz'],
      acceptanceCriterionIds: [],
      links: [{
        kind: 'ci-run',
        id: 'ci:authz',
        label: 'authz',
        url: null,
        acceptanceCriterionIds: [],
      }],
      producer: 'ci',
      executionKind: 'executed',
      designRevision: '',
    }],
  });
  governance.mapControl({
    projectId: project.id,
    packId: 'owasp-asvs',
    packVersion: '1.0.0',
    controlId: 'V4.1.1',
    workItemId: item.id,
    actor: 'dev',
  });
  const projectReady = governance.certificationReadiness({ projectId: project.id });
  assert.equal(projectReady.ready, true);
  const milestoneReady = governance.certificationReadiness({ projectId: project.id, milestoneId: milestone.id });
  assert.equal(milestoneReady.ready, true);
  const itemReady = governance.certificationReadiness({ projectId: project.id, workItemId: item.id });
  assert.equal(itemReady.ready, true);
});

test('customers cannot select packs or approve obligations', async (t) => {
  const { board, project, governance } = setup();
  const hash = passwordHash();
  const web = createWebService(
    {
      board,
      requirements: createRequirementManagementService(board),
      governance,
    },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        sessionTtlMs: 60_000,
        users: [
          { username: 'dev', passwordHash: hash, audience: 'developer' },
          { username: 'legal', passwordHash: hash, audience: 'developer' },
          { username: 'cust', passwordHash: hash, audience: 'customer', projectIds: [project.id] },
        ],
      },
    },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const customerLogin = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cust', password: 'correct-password' }),
  });
  const customerCookie = customerLogin.response.headers.get('set-cookie')?.split(';')[0];
  const deniedSelect = await json(
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/governance/packs/nist-csf-2.0/select`,
    {
      method: 'POST',
      headers: { cookie: customerCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ version: '1.0.0' }),
    },
  );
  assert.equal(deniedSelect.response.status, 403);
  const developerLogin = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const developerCookie = developerLogin.response.headers.get('set-cookie')?.split(';')[0];
  const created = await json(
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/compliance/obligations`,
    {
      method: 'POST',
      headers: { cookie: developerCookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Contract clause',
        kind: 'customer_contract',
        jurisdiction: 'global',
        source: 'MSA',
        applicabilityReason: 'customer requires it',
        owner: 'dev',
        reviewer: 'legal',
      }),
    },
  );
  assert.equal(created.response.status, 201);
  await json(
    `${status.url}/api/v1/compliance/obligations/${encodeURIComponent(created.payload.id)}/submit`,
    { method: 'POST', headers: { cookie: developerCookie, 'content-type': 'application/json' }, body: JSON.stringify({}) },
  );
  const deniedApprove = await json(
    `${status.url}/api/v1/compliance/obligations/${encodeURIComponent(created.payload.id)}/approve`,
    { method: 'POST', headers: { cookie: customerCookie, 'content-type': 'application/json' }, body: JSON.stringify({}) },
  );
  assert.equal(deniedApprove.response.status, 403);
});
