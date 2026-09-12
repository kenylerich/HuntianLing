import test from 'node:test';
import assert from 'node:assert/strict';

import { customerProgressForWorkItem, hasExecutedDeliveryEvidence } from '../../lib/host/web/customer-progress.js';

function summary(overrides = {}) {
  return {
    id: 'item-1',
    projectId: 'project-1',
    workItemId: 'item-1',
    codeLinks: [],
    pullRequests: [],
    reviewLinks: [],
    ciRuns: [],
    deploymentLinks: [],
    evidenceLinks: [],
    checks: [],
    obligations: [],
    riskAcceptances: [],
    provenanceLinks: [],
    notes: '',
    updatedAt: 0,
    ...overrides,
  };
}

test('inbox maps to submitted', () => {
  assert.equal(customerProgressForWorkItem('inbox', null), 'submitted');
});

test('designing maps to in_analysis', () => {
  assert.equal(customerProgressForWorkItem('designing', null), 'in_analysis');
});

test('in_progress maps to in_development', () => {
  assert.equal(customerProgressForWorkItem('in_progress', null), 'in_development');
});

test('delivered without executed evidence is in_development', () => {
  const notesOnly = summary({ notes: 'looks done' });
  assert.equal(hasExecutedDeliveryEvidence(notesOnly), false);
  assert.equal(customerProgressForWorkItem('delivered', notesOnly), 'in_development');
});

test('delivered with a passing check is delivered', () => {
  const passing = summary({
    checks: [{
      id: 'ci',
      area: 'ci',
      title: 'tests',
      status: 'passing',
      required: true,
      reason: '',
      evidenceIds: ['run-1'],
      acceptanceCriterionIds: [],
      links: [],
      producer: 'ci',
      executionKind: 'executed',
      designRevision: 'rev-1',
    }],
  });
  assert.equal(hasExecutedDeliveryEvidence(passing), true);
  assert.equal(customerProgressForWorkItem('delivered', passing), 'delivered');
});

test('code links without executed checks are not delivered', () => {
  const linksOnly = summary({
    codeLinks: [{
      kind: 'commit',
      id: 'c1',
      label: 'abc',
      url: null,
      acceptanceCriterionIds: [],
    }],
  });
  assert.equal(hasExecutedDeliveryEvidence(linksOnly), false);
  assert.equal(customerProgressForWorkItem('delivered', linksOnly), 'in_development');
});

test('generator self-check cannot mark customer progress delivered', () => {
  const selfCheck = summary({
    checks: [{
      id: 'generator-self-check',
      area: 'evidence',
      title: 'Generator self-check',
      status: 'passing',
      required: false,
      reason: '',
      evidenceIds: ['run-1'],
      acceptanceCriterionIds: [],
      links: [],
      producer: 'generator',
      executionKind: 'self_check',
      designRevision: 'rev-1',
    }],
  });
  assert.equal(hasExecutedDeliveryEvidence(selfCheck), false);
  assert.equal(customerProgressForWorkItem('delivered', selfCheck), 'in_development');
});

test('stale executed evidence after a design revision is not delivered', () => {
  const item = {
    analysis: 'a',
    design: 'd',
    acceptance: ['can verify'],
    acceptanceCriteria: [],
  };
  const passing = summary({
    designRevision: 'old-revision',
    checks: [{
      id: 'evaluator:can verify',
      area: 'acceptance',
      title: 'can verify',
      status: 'passing',
      required: true,
      reason: 'deterministic-evaluator',
      evidenceIds: ['run-1'],
      acceptanceCriterionIds: [],
      links: [],
      producer: 'evaluator',
      executionKind: 'executed',
      designRevision: 'old-revision',
    }],
  });
  assert.equal(hasExecutedDeliveryEvidence(passing), true);
  assert.equal(hasExecutedDeliveryEvidence(passing, item), false);
  assert.equal(customerProgressForWorkItem('delivered', passing, item), 'in_development');
});
