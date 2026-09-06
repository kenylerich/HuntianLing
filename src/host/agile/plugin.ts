/**
 * Agile methodology capability — Service Definition stub.
 *
 * This file publishes the cordis Service contract for requirement intake
 * and workflow orchestration. The Service interface is empty in this
 * skeleton; implementations live in ./intake.ts and ./workflow.ts and will
 * be added in subsequent PRs.
 *
 * Conventions (see AGENTS.md):
 *   - the Plugin's `apply` body owns all contributions via ctx.effect()
 *   - hard Service dependencies go in `inject`
 *   - typed events are declared on a merge-extensible EventMap
 *
 * TODO once the workflow lands: declare the merged EventMap for
 *   `requirement/submitted` and `workflow/state-changed`.
 */

import type { Context, Plugin, Service } from '@deepseek-ai/cordis';

/**
 * Public Service contract for the agile capability.
 *
 * Future shape (skeleton only declares the empty interface):
 *   - intake: structured submission entry point
 *   - workflow: state-machine driver for the agile flow
 *   - query: read-side queries over collected requirements
 */
export interface AgileService extends Service {
  // TODO
}

const AgilePlugin: Plugin = {
  name: 'huntianling:agile',
  // inject: ['model'], // TODO once intake starts calling the LLM

  apply(ctx: Context): void {
    // Future: ctx.effect(() => { ctx.register('agile', { ... }); });
    // Future: ctx.on('model:ready', () => { ... });
    // The skeleton registers nothing; the apply body is intentionally empty
    // so the loader contract is observable without claiming functionality.
    void ctx;
  },
};

export default AgilePlugin;
