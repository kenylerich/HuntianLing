/**
 * Board capability — Service Definition stub.
 *
 * Models a GitHub Projects-style board: projects → milestones → lanes →
 * cards. Skeleton declares the Service interface; the read/write methods
 * will be added once ./store.ts and the agile link are in place.
 *
 * Conventions (see AGENTS.md):
 *   - the Plugin's `apply` body owns all contributions via ctx.effect()
 *   - hard Service dependencies go in `inject`
 */

import type { Context, Plugin, Service } from '@deepseek-ai/cordis';

/**
 * Public Service contract for the board capability.
 *
 * Future shape (skeleton only declares the empty interface):
 *   - projects.create / projects.list / projects.get
 *   - milestones.create / milestones.get
 *   - lanes.configure / lanes.move
 *   - cards.create / cards.move / cards.link-requirement
 */
export interface BoardService extends Service {
  // TODO
}

const BoardPlugin: Plugin = {
  name: 'huntianling:board',
  // inject: [], // TODO once the board depends on the agile Service

  apply(ctx: Context): void {
    // Future: ctx.effect(() => { ctx.register('board', { ... }); });
    void ctx;
  },
};

export default BoardPlugin;
