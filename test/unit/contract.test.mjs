// HuntianLing plugin contract test.
//
// Compiled output (lib/host/plugin.js) must export a default Plugin
// object with a non-empty `name` and a function `apply`. This is the
// shape dsh expects when it loads the bundle through `cordis.yml`'s
// `!!js/function` resolver.
//
// The companion integration test (scripts/plugin-e2e.mjs) loads the
// plugin into a real cordis Context and asserts the runtime contract.
// This test exercises only the module surface, so it runs in
// milliseconds and never needs cordis's full event loop.

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import huntianling from '../../lib/host/plugin.js'

test('root plugin module exports a Plugin-shaped object', () => {
  assert.equal(typeof huntianling, 'object')
  assert.equal(huntianling === null, false)
})

test('root plugin has a non-empty name', () => {
  assert.equal(typeof huntianling.name, 'string')
  assert.notEqual(huntianling.name, '')
})

test('root plugin.apply is a function', () => {
  assert.equal(typeof huntianling.apply, 'function')
})

test('lib/index.js default export re-exports the root Plugin', async () => {
  const root = await import('../../lib/index.js')
  assert.equal(root.default, huntianling)
})

test('root plugin provides board and requirement management services', () => {
  const services = new Map([
    ['huntianling.workspaceRoot', mkdtempSync(join(tmpdir(), 'huntianling-plugin-'))],
  ])
  const disposers = []
  const ctx = {
    get: (name) => services.get(name),
    provide: (name, value) => {
      services.set(name, value)
    },
    effect: (execute) => {
      const disposer = execute()
      if (typeof disposer === 'function') disposers.push(disposer)
      return disposer
    },
    plugin: (plugin, config) => plugin.apply(ctx, config),
  }

  huntianling.apply(ctx, { web: { autoStart: false } })

  assert.equal(typeof services.get('huntianling.board')?.createWorkItem, 'function')
  assert.equal(typeof services.get('huntianling.board')?.createMilestone, 'function')
  assert.equal(typeof services.get('huntianling.board')?.createIntakeSession, 'function')
  assert.equal(typeof services.get('huntianling.requirements')?.createEpic, 'function')
  assert.equal(typeof services.get('huntianling.web')?.start, 'function')
  assert.equal(typeof services.get('huntianling.skills')?.writeOriginalRequirement, 'function')
  assert.equal(typeof services.get('huntianling.skills')?.draftSkill, 'function')
  assert.equal(typeof services.get('huntianling.agents')?.inspectTask, 'function')
  assert.equal(services.get('huntianling.skills')?.mktCoverage().complete, true)
  assert.equal(typeof services.get('huntianling.environment')?.prepare, 'function')
  assert.equal(services.get('huntianling.environment')?.profile().id, 'huntianling.node-pnpm')
  assert.equal(typeof services.get('huntianling.agents')?.startRun, 'function')
  assert.deepEqual(
    services.get('huntianling.agents')?.definitions().slice(0, 3).map((definition) => definition.id),
    ['planner', 'generator', 'evaluator'],
  )
  assert.equal(typeof services.get('huntianling.scm')?.inspect, 'function')
  assert.equal(typeof services.get('huntianling.ci')?.run, 'function')
  assert.equal(typeof services.get('huntianling.delivery')?.start, 'function')
  assert.equal(typeof services.get('huntianling.harness')?.compare, 'function')
  assert.equal(typeof services.get('huntianling.authority')?.assert, 'function')
  assert.equal(typeof services.get('huntianling.collab')?.postMessage, 'function')
  assert.equal(services.get('huntianling.database')?.driver, 'sqlite')
  assert.equal(typeof services.get('huntianling.database')?.schemaVersion, 'function')
  assert.equal(typeof services.get('huntianling.workflow')?.plan, 'function')
  assert.equal(typeof services.get('huntianling.dispatch')?.recommend, 'function')
  assert.equal(disposers.length > 0, true)
})
