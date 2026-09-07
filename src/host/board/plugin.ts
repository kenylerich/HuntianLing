/**
 * Board capability — Service Definition.
 *
 * Provides `huntianling.board` for card CRUD and role claim. Persistence
 * is a JSON file under the workspace (see store.ts).
 */

import type { Context, Plugin } from '@deepseek-ai/cordis';

import { BoardStore } from './store.js';
import type { Card, CardId, Project, ProjectId, RoleId, WorkItemType } from './types.js';
import { resolveWorkspaceRoot } from './workspace.js';

export interface BoardService {
  listProjects(): readonly Project[];
  listCards(projectId?: ProjectId): readonly Card[];
  getCard(cardId: CardId): Card | undefined;
  createProject(input: { name: string; description?: string }): Project;
  createCard(input: {
    projectId: ProjectId;
    title: string;
    body?: string;
    type?: WorkItemType;
  }): Card;
  claimCard(cardId: CardId, input: { roleId: RoleId; actorId: string }): Card;
  unclaimCard(cardId: CardId, actorId: string): Card;
}

export function createBoardService(workspaceRoot: string): BoardService {
  const store = new BoardStore(workspaceRoot);
  return {
    listProjects: () => store.listProjects(),
    listCards: (projectId) => store.listCards(projectId),
    getCard: (cardId) => store.getCard(cardId),
    createProject: (input) => store.createProject(input),
    createCard: (input) => store.createCard(input),
    claimCard: (cardId, input) => store.claimCard(cardId, input),
    unclaimCard: (cardId, actorId) => store.unclaimCard(cardId, actorId),
  };
}

const BoardPlugin: Plugin = {
  name: 'huntianling:board',

  apply(ctx: Context): void {
    const configured = ctx.get('huntianling.workspaceRoot');
    const root = resolveWorkspaceRoot({
      ...(typeof configured === 'string' ? { explicit: configured } : {}),
      env: process.env,
    });
    const service = createBoardService(root);
    ctx.provide('huntianling.board', service);
  },
};

export default BoardPlugin;
