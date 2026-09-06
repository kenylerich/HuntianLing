/**
 * HuntianLing root plugin.
 *
 * Wires the agile methodology capability and the project board capability
 * under a single Cordis Plugin. The current shape is a deliberate skeleton:
 * sub-plugins are registered so the loader contract is observable, but the
 * sub-plugin bodies are empty stubs that return early.
 *
 * Lifecycle rules (see AGENTS.md):
 *   - contributions only via `ctx.effect()` / `ctx.on()`
 *   - hard Service dependencies declared in `inject`
 *   - optional Services read through `ctx.get()` and tolerate `undefined`
 *
 * Future work (not in this skeleton):
 *   - replace the empty `apply` bodies with the actual Service Definitions
 *   - wire persistence (`store.ts`) and the workflow state machine
 *   - declare typed events on the merged `EventMap` (see ./agile/types.ts)
 */

import type { Context, Plugin } from '@deepseek-ai/cordis';

import agilePlugin from './agile/plugin.js';
import boardPlugin from './board/plugin.js';

/**
 * Root plugin for the HuntianLing capability bundle.
 *
 * TODO once the host composition is finalised: declare `inject` for any hard
 * Service this root depends on (e.g. the harness `model` Service when the
 * agile intake starts calling the LLM).
 */
const HuntianLingRoot: Plugin = {
  name: 'huntianling:root',
  // inject: [],

  apply(ctx: Context): void {
    // Register sub-plugins. `ctx.plugin()` walks each entry and applies it
    // under this Plugin's lifetime; its disposer is bound to this Plugin.
    ctx.plugin(agilePlugin);
    ctx.plugin(boardPlugin);

    // Future: ctx.effect(() => { ... });
  },
};

export default HuntianLingRoot;
