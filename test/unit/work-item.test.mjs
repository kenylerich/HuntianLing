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
  isForbiddenTransition,
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
    status: 'inbox',
    priority: null,
    estimate: null,
    assignee: '',
    parentId: null,
    startDate: null,
    dueDate: null,
    acceptance: ['Save button submits the form'],
    sourceRequirementId: null,
    ...overrides,
  }
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
  // Defects, tasks, process cards do not require acceptance; an empty
  // list must not raise. The acceptance rule is requirement-specific.
  const item = makeRequirement({ type: 'defect', acceptance: [] })
  assert.equal(assertRequirementHasAcceptance(item), null)
})

test('validateWorkItemHierarchy passes when there is no parent', () => {
  const item = makeRequirement()
  assert.equal(validateWorkItemHierarchy(item, () => null), null)
})

test('validateWorkItemHierarchy passes when the parent has no further parent', () => {
  const item = makeRequirement({ parentId: 'epic-1' })
  const epic = makeRequirement({ id: 'epic-1' })
  assert.equal(validateWorkItemHierarchy(item, () => epic), null)
})

test('validateWorkItemHierarchy rejects a parent that is itself a child', () => {
  const item = makeRequirement({ parentId: 'child-parent' })
  const parent = makeRequirement({
    id: 'child-parent',
    parentId: 'epic-1',
  })
  const error = validateWorkItemHierarchy(item, () => parent)
  assert.equal(error?.kind, 'parent_is_child')
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
