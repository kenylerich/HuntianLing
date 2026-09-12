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
import webPlugin from './web/plugin.js';
import type { DispatchConfig } from './dispatch/types.js';
import type { AuthorityConfig } from './authority/types.js';
import type { DatabaseConfig } from './database/types.js';
import type { DeliveryConfig } from './delivery/types.js';
import type { HarnessConfig } from './harness/types.js';
import type { IntakeConfig } from './intake/types.js';
import type { ScmConfig } from './scm/types.js';
import type { WebConfig } from './web/types.js';

export interface HuntianLingConfig {
  readonly workspaceRoot?: string;
  readonly web?: WebConfig;
  readonly delivery?: DeliveryConfig;
  readonly harness?: HarnessConfig;
  readonly authority?: AuthorityConfig;
  readonly scm?: ScmConfig;
  readonly database?: DatabaseConfig;
  readonly dispatch?: DispatchConfig;
  readonly intake?: IntakeConfig;
}

const HuntianLingRoot: Plugin<HuntianLingConfig> = {
  name: 'huntianling:root',

  apply(ctx: Context, config: HuntianLingConfig = {}): void {
    if (config.workspaceRoot !== undefined) {
      ctx.provide('huntianling.workspaceRoot', config.workspaceRoot);
    }

    // Register sub-plugins. `ctx.plugin()` walks each entry and applies it
    // under this Plugin's lifetime; its disposer is bound to this Plugin.
    ctx.plugin(databasePlugin, config.database ?? {});
    ctx.plugin(boardPlugin, config.intake ?? {});
    ctx.plugin(agilePlugin);
    ctx.plugin(skillsPlugin);
    ctx.plugin(environmentPlugin);
    ctx.plugin(agentsPlugin);
    ctx.plugin(authorityPlugin, config.authority ?? {});
    ctx.plugin(scmPlugin, config.scm ?? {});
    ctx.plugin(ciPlugin);
    ctx.plugin(deliveryPlugin, config.delivery ?? {});
    ctx.plugin(harnessPlugin, config.harness ?? {});
    ctx.plugin(collabPlugin);
    ctx.plugin(dispatchPlugin, config.dispatch ?? {});
    ctx.plugin(workflowPlugin);
    ctx.plugin(webPlugin, config.web ?? {});
  },
};

export default HuntianLingRoot;
