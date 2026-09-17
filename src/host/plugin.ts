/**
 * HuntianLing root plugin.
 *
 * Wires the agile methodology capability and the project board capability
 * under a single Cordis Plugin. The database service starts first so the
 * board can persist through `huntianling.database`; the Web service starts
 * last so dsh and browser users see the same data.
 *
 * Lifecycle rules (see AGENTS.md):
 *   - contributions only via `ctx.effect()` / `ctx.on()`
 *   - hard Service dependencies declared in `inject`
 *   - optional Services read through `ctx.get()` and tolerate `undefined`
 *
 * Future work (not in this skeleton):
 *   - declare typed events on the merged `EventMap` (see ./agile/types.ts)
 */

import type { Context, Plugin } from '@deepseek-ai/cordis';

import boardPlugin from './board/plugin.js';
import agilePlugin from './agile/plugin.js';
import skillsPlugin from './skills/plugin.js';
import environmentPlugin from './environment/plugin.js';
import agentsPlugin from './agents/plugin.js';
import authorityPlugin from './authority/plugin.js';
import scmPlugin from './scm/plugin.js';
import ciPlugin from './ci/plugin.js';
import deliveryPlugin from './delivery/plugin.js';
import harnessPlugin from './harness/plugin.js';
import collabPlugin from './collab/plugin.js';
import databasePlugin from './database/plugin.js';
import workflowPlugin from './workflow/plugin.js';
import dispatchPlugin from './dispatch/plugin.js';
import governancePlugin from './governance/plugin.js';
import issueSyncPlugin from './issue-sync/plugin.js';
import webPlugin from './web/plugin.js';
import type { DispatchConfig } from './dispatch/types.js';
import type { AuthorityConfig } from './authority/types.js';
import type { DatabaseConfig } from './database/types.js';
import type { DeliveryConfig } from './delivery/types.js';
import type { EnvironmentConfig } from './environment/types.js';
import type { HarnessConfig } from './harness/types.js';
import type { IntakeConfig } from './intake/types.js';
import type { ScmConfig } from './scm/types.js';
import type { WebConfig } from './web/types.js';
import type { CiConfig } from './ci/types.js';

export interface HuntianLingConfig {
  readonly workspaceRoot?: string;
  readonly web?: WebConfig;
  readonly delivery?: DeliveryConfig;
  readonly harness?: HarnessConfig;
  readonly authority?: AuthorityConfig;
  readonly scm?: ScmConfig;
  readonly database?: DatabaseConfig;
  readonly environment?: EnvironmentConfig;
  readonly dispatch?: DispatchConfig;
  readonly intake?: IntakeConfig;
  readonly ci?: CiConfig;
}

const HuntianLingRoot: Plugin<HuntianLingConfig> = {
  name: 'huntianling:root',
  provide: 'huntianling.workspaceRoot',

  async apply(ctx: Context, config: HuntianLingConfig = {}): Promise<void> {
    if (config.workspaceRoot !== undefined) {
      ctx.provide('huntianling.workspaceRoot', config.workspaceRoot);
    }

    // Register sub-plugins. `ctx.plugin()` walks each entry and applies it
    // under this Plugin's lifetime; its disposer is bound to this Plugin.
    // Await each provider before mounting consumers. Real Cordis fibers do
    // not make sibling services synchronously available merely because
    // ctx.plugin() was called; an unawaited fan-out leaves injected consumers
    // pending even though the aggregate root itself reports started.
    await ctx.plugin(databasePlugin, config.database ?? {});
    await ctx.plugin(boardPlugin, config.intake ?? {});
    await ctx.plugin(agilePlugin);
    await ctx.plugin(skillsPlugin);
    await ctx.plugin(environmentPlugin, config.environment ?? {});
    await ctx.plugin(governancePlugin);
    await ctx.plugin(issueSyncPlugin);
    await ctx.plugin(agentsPlugin);
    await ctx.plugin(authorityPlugin, config.authority ?? {});
    await ctx.plugin(scmPlugin, config.scm ?? {});
    await ctx.plugin(ciPlugin, config.ci ?? {});
    await ctx.plugin(deliveryPlugin, config.delivery ?? {});
    await ctx.plugin(harnessPlugin, config.harness ?? {});
    await ctx.plugin(collabPlugin);
    await ctx.plugin(dispatchPlugin, config.dispatch ?? {});
    await ctx.plugin(workflowPlugin);
    await ctx.plugin(webPlugin, config.web ?? {});
  },
};

export default HuntianLingRoot;
