// HuntianLing work-item contract test.
//
// Pure-function checks for the helpers in `lib/host/board/work-item.js`.
// These tests load the compiled output so the same compilation pipeline
// as the plugin's other consumers is exercised. They do not spin up a
// cordis Context; the integration test (scripts/plugin-e2e.mjs) owns
// that surface.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  assertRequirementHasAcceptance,
  allowedParentTypes,
  isForbiddenTransition,
  validateDefinitionOfReady,
  validateWorkItemHierarchy,
  validateWorkItemRequiredFields,
  validateWorkItemTransition,
} from '../../lib/host/board/work-item.js'

/** Build a minimal valid requirement-shaped WorkItem for tests. */
function makeRequirement(overrides = {}) {
  return {
    id: 'wi-1',
    projectId: 'proj-1',
    type: 'requirement',
    title: 'Add a button',
    body: 'Clicking should save the form.',
    analysis: '',
    design: '',
    status: 'inbox',
    priority: null,
    estimate: null,
    assignee: '',
    parentId: null,
    startDate: null,
    dueDate: null,
    acceptance: ['Save button submits the form'],
    acceptanceCriteria: [],
    coversAcceptanceIds: [],
    dependencyIds: [],
    blockedByIds: [],
    evidence: [],
    sourceRequirementId: null,
    ...overrides,
  }
}

function makeReadyRequirement(overrides = {}) {
  return makeRequirement({
    analysis: 'The user needs a clear delivery path.',
    design: 'The board records the transition and evidence.',
    milestoneId: 'milestone-1',
    status: 'ready',
    ...overrides,
  })
}

test('validateWorkItemRequiredFields passes for a fully-populated requirement', () => {
  assert.equal(validateWorkItemRequiredFields(makeRequirement()), null)
})

test('validateWorkItemRequiredFields rejects a blank title', () => {
  const error = validateWorkItemRequiredFields(makeRequirement({ title: '   ' }))
  assert.equal(error?.kind, 'missing_title')
})

test('validateWorkItemRequiredFields rejects a blank body', () => {
  const error = validateWorkItemRequiredFields(makeRequirement({ body: '' }))
  assert.equal(error?.kind, 'missing_body')
})

test('assertRequirementHasAcceptance rejects an empty acceptance list', () => {
  const error = assertRequirementHasAcceptance(makeRequirement({ acceptance: [] }))
  assert.equal(error?.kind, 'missing_acceptance_for_requirement')
})

test('assertRequirementHasAcceptance passes for non-requirement types', () => {
  // Bugs, tasks, process cards do not require acceptance; an empty
  // list must not raise. The acceptance rule is requirement-specific.
  const item = makeRequirement({ type: 'bug', acceptance: [] })
  assert.equal(assertRequirementHasAcceptance(item), null)
})

test('assertRequirementHasAcceptance applies to story work items', () => {
  const error = assertRequirementHasAcceptance(makeRequirement({ type: 'story', acceptance: [] }))
  assert.equal(error?.kind, 'missing_acceptance_for_requirement')
})

test('validateWorkItemHierarchy passes when there is no parent', () => {
  const item = makeRequirement()
  assert.equal(validateWorkItemHierarchy(item, () => null), null)
})

test('allowedParentTypes documents the product hierarchy', () => {
  assert.deepEqual(allowedParentTypes('feature'), ['epic'])
  assert.deepEqual(allowedParentTypes('requirement'), ['feature'])
  assert.deepEqual(allowedParentTypes('story'), ['feature'])
  assert.deepEqual(allowedParentTypes('task'), ['requirement', 'story'])
})

test('validateWorkItemHierarchy accepts an Epic to Task requirement tree', () => {
  const epic = makeRequirement({ id: 'epic-1', type: 'epic' })
  const feature = makeRequirement({ id: 'feature-1', type: 'feature', parentId: 'epic-1' })
  const story = makeRequirement({ id: 'story-1', type: 'story', parentId: 'feature-1' })
  const task = makeRequirement({ id: 'task-1', type: 'task', parentId: 'story-1', acceptance: [] })
  const items = new Map([
    [epic.id, epic],
    [feature.id, feature],
    [story.id, story],
    [task.id, task],
  ])
  assert.equal(validateWorkItemHierarchy(task, (id) => items.get(id) ?? null), null)
})

test('validateWorkItemHierarchy rejects an invalid parent type', () => {
  const feature = makeRequirement({ id: 'feature-1', type: 'feature' })
  const task = makeRequirement({ id: 'task-1', type: 'task', parentId: 'feature-1', acceptance: [] })
  const error = validateWorkItemHierarchy(task, (id) => (id === feature.id ? feature : null))
  assert.equal(error?.kind, 'invalid_parent_type')
  assert.equal(error?.childType, 'task')
  assert.equal(error?.parentType, 'feature')
})

test('validateWorkItemHierarchy rejects cross-project parents', () => {
  const feature = makeRequirement({ id: 'feature-1', type: 'feature', projectId: 'proj-1' })
  const story = makeRequirement({
    id: 'story-1',
    type: 'story',
    projectId: 'proj-2',
    parentId: 'feature-1',
  })
  const error = validateWorkItemHierarchy(story, (id) => (id === feature.id ? feature : null))
  assert.equal(error?.kind, 'cross_project_parent')
})

test('validateWorkItemHierarchy detects a self-referential cycle', () => {
  const item = makeRequirement({ parentId: 'wi-1' })
  const error = validateWorkItemHierarchy(item, () => item)
  assert.equal(error?.kind, 'cycle_in_parent_chain')
})

test('isForbiddenTransition blocks delivered back to inbox', () => {
  assert.equal(isForbiddenTransition('delivered', 'inbox'), true)
})

test('isForbiddenTransition allows inbox to triaged', () => {
  assert.equal(isForbiddenTransition('inbox', 'triaged'), false)
})

test('validateWorkItemTransition rejects when acceptance is missing', () => {
  const item = makeRequirement({ acceptance: [] })
  const error = validateWorkItemTransition(item, 'triaged')
  assert.equal(error?.kind, 'missing_acceptance_for_requirement')
})

test('validateWorkItemTransition rejects a forbidden transition', () => {
  const item = makeRequirement({ status: 'delivered' })
  const error = validateWorkItemTransition(item, 'inbox')
  assert.equal(error?.kind, 'forbidden_transition')
})

test('validateWorkItemTransition passes for an inbox → triaged move with acceptance', () => {
  const item = makeRequirement()
  assert.equal(validateWorkItemTransition(item, 'triaged'), null)
})

test('Definition of Ready requires analysis, design, acceptance, milestone, and no blockers', () => {
  assert.equal(validateDefinitionOfReady(makeReadyRequirement()), null)
  assert.equal(validateDefinitionOfReady(makeReadyRequirement({ analysis: '' }))?.kind, 'missing_analysis_for_ready')
  assert.equal(validateDefinitionOfReady(makeReadyRequirement({ design: '' }))?.kind, 'missing_design_for_ready')
  assert.equal(
    validateDefinitionOfReady(makeReadyRequirement({ acceptance: [] }))?.kind,
    'missing_acceptance_for_requirement',
  )
  assert.equal(
    validateDefinitionOfReady(makeReadyRequirement({ milestoneId: null }))?.kind,
    'missing_milestone_for_ready',
  )
  assert.equal(
    validateDefinitionOfReady(makeReadyRequirement({ blockedByIds: ['wi-2'] }))?.kind,
    'blocked_work_items_for_ready',
  )
})

test('validateWorkItemTransition blocks development before Ready', () => {
  assert.equal(
    validateWorkItemTransition(makeReadyRequirement({ status: 'planned' }), 'in_progress')?.kind,
    'not_ready_for_development',
  )
  assert.equal(validateWorkItemTransition(makeReadyRequirement(), 'in_progress'), null)
  assert.equal(
    validateWorkItemTransition(makeReadyRequirement({ status: 'in_review' }), 'in_progress'),
    null,
  )
})
