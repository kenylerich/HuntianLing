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
