#!/usr/bin/env node
// HUNTIANLING_E2E_SCRIPT
//
// Integration test: load the compiled HuntianLing plugin into a real
// cordis Context and assert the contract the dsh harness expects. This
// is NOT a DeepSeek-API smoke test — HuntianLing is a cordis plugin
// consumed BY dsh, not a product that calls dsh's API. Real-API
// coverage belongs in dsh.

import { access, mkdtemp } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import huntianling from '../lib/host/plugin.js'

// Prefer the Cordis runtime shipped by the installed dsh host. The plugin's
// vendored workspace is a source/type fixture and may deliberately have no
// generated lib/ on a clean checkout. Falling back keeps contributor setups
// with a separately built workspace working.
const dshCordis = join(
  process.env.DSH_HOME ?? join(homedir(), '.dsh'),
  'profiles/node_modules/@deepseek-ai/cordis/lib/index.js',
)
let Context
try {
  await access(dshCordis)
  ;({ Context } = await import(pathToFileURL(dshCordis).href))
} catch {
  ;({ Context } = await import('@deepseek-ai/cordis'))
}

// 1. Root plugin module exports a Plugin-shaped object.
if (!huntianling || typeof huntianling !== 'object') {
  console.error('FAIL: lib/host/plugin.js did not export a Plugin object')
  process.exit(1)
}
if (typeof huntianling.name !== 'string' || huntianling.name.length === 0) {
  console.error('FAIL: plugin.name must be a non-empty string')
  process.exit(1)
}
if (typeof huntianling.apply !== 'function') {
  console.error('FAIL: plugin.apply must be a function')
  process.exit(1)
}
console.log(`OK  plugin name: ${huntianling.name}`)

// 2. Root plugin can be applied to a fresh cordis Context without
//    throwing. This proves the plugin's apply() body is well-formed
//    and that the sub-plugin registrations (agile, board) compile and
//    import without runtime errors. cordis 4 returns the plugin's
//    fiber from `ctx.plugin()`; awaiting it settles the startup phase,
//    and the fiber's `dispose()` unloads the plugin.
const ctx = new Context()
let fiber
const workspaceRoot = await mkdtemp(join(tmpdir(), 'huntianling-dsh-e2e-'))
const sqlitePath = join(workspaceRoot, '.huntianling', 'huntianling.sqlite')
try {
  fiber = ctx.plugin(huntianling, {
    workspaceRoot,
    database: { sqlitePath },
    web: { autoStart: false },
  })
  await fiber
  console.log('OK  plugin applied; fiber started')
  await access(sqlitePath)
  console.log('OK  production database child reached ready state')
} catch (err) {
  console.error('FAIL: plugin.apply threw:', err.message)
  process.exit(1)
} finally {
  if (fiber) await fiber.dispose()
}

// 3. Public package entry point re-exports the same Plugin, so the
//    `cordis.yml` loader path (import('@kenylerich/dsh-huntianling/host'))
//    resolves to the same module.
const root = await import('../lib/index.js')
if (root.default !== huntianling) {
  console.error('FAIL: lib/index.js default export is not the root Plugin')
  process.exit(1)
}
console.log('OK  lib/index.js default export matches lib/host/plugin.js')

console.log('PASS plugin integration test')
