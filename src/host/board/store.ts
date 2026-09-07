/**
 * JSON board store under a workspace root.
 *
 * Cards are stored as a flat list. Role claim mutates claimedRoleId /
 * claimedBy / claimedAt. Persistence path: `<root>/.huntianling/board.json`.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  DEFAULT_ROLES,
  SCHEMA_VERSION,
  type Card,
  type CardId,
  type Project,
  type ProjectId,
  type RoleId,
  type WorkItemType,
  type WorkItemStatus,
} from './types.js';
import { runTransitionGates, type TransitionGate } from './gates.js';
import { validateWorkItemTransition, type WorkItemError } from './work-item.js';

export interface BoardSnapshot {
  readonly schemaVersion: number;
  readonly projects: Project[];
  readonly cards: Card[];
}

const EMPTY: BoardSnapshot = {
  schemaVersion: SCHEMA_VERSION,
  projects: [],
  cards: [],
};

function formatTransitionError(
  error: WorkItemError | { readonly kind: 'forbidden_transition'; readonly from: WorkItemStatus; readonly to: WorkItemStatus },
): string {
  switch (error.kind) {
    case 'forbidden_transition':
      return `forbidden transition: ${error.from} → ${error.to}`;
    case 'missing_acceptance_for_requirement':
      return `requirement ${error.id} cannot leave inbox without acceptance`;
    case 'missing_title':
      return `card ${error.id} is missing a title`;
    case 'missing_body':
      return `card ${error.id} is missing a body`;
    case 'cycle_in_parent_chain':
      return `card ${error.id} parent chain cycles`;
    case 'parent_is_child':
      return `card ${error.id} parent is itself a child`;
    default: {
      const _never: never = error;
      return `transition rejected: ${JSON.stringify(_never)}`;
    }
  }
}

export function boardFilePath(workspaceRoot: string): string {
  return join(workspaceRoot, '.huntianling', 'board.json');
}

export class BoardStore {
  private snapshot: BoardSnapshot;
  private gates: TransitionGate[] = [];

  constructor(private readonly workspaceRoot: string) {
    this.snapshot = this.read();
  }

  registerGate(gate: TransitionGate): void {
    this.gates = [...this.gates, gate];
  }

  listProjects(): readonly Project[] {
    return this.snapshot.projects;
  }

  listCards(projectId?: ProjectId): readonly Card[] {
    if (projectId === undefined) return this.snapshot.cards;
    return this.snapshot.cards.filter((card) => card.projectId === projectId);
  }

  getCard(cardId: CardId): Card | undefined {
    return this.snapshot.cards.find((card) => card.id === cardId);
  }

  createProject(input: { name: string; description?: string }): Project {
    const project: Project = {
      id: randomUUID() as ProjectId,
      name: input.name,
      description: input.description ?? '',
      roles: [...DEFAULT_ROLES],
    };
    this.snapshot = {
      ...this.snapshot,
      projects: [...this.snapshot.projects, project],
    };
    this.write();
    return project;
  }

  createCard(input: {
    projectId: ProjectId;
    title: string;
    body?: string;
    type?: WorkItemType;
    stateGroup?: WorkItemStatus;
    acceptance?: readonly string[];
  }): Card {
    const project = this.snapshot.projects.find((item) => item.id === input.projectId);
    if (!project) throw new Error(`project not found: ${input.projectId}`);
    const siblings = this.snapshot.cards.filter((card) => card.projectId === input.projectId);
    const sortOrder = siblings.reduce((max, card) => Math.max(max, card.sortOrder), 0) + 10000;
    const card: Card = {
      id: randomUUID() as CardId,
      projectId: input.projectId,
      title: input.title,
      body: input.body ?? '',
      type: input.type ?? 'requirement',
      status: input.stateGroup ?? 'inbox',
      priority: null,
      estimate: null,
      assignee: '',
      parentId: null,
      startDate: null,
      dueDate: null,
      acceptance: input.acceptance ? [...input.acceptance] : [],
      sourceRequirementId: null,
      sortOrder,
      claimedRoleId: null,
      claimedBy: null,
      claimedAt: null,
    };
    this.snapshot = {
      ...this.snapshot,
      cards: [...this.snapshot.cards, card],
    };
    this.write();
    return card;
  }

  /**
   * Claim a card for a project role. Another role must unclaim first.
   * The same actor may reclaim to switch role on an already-owned card.
   */
  claimCard(cardId: CardId, input: { roleId: RoleId; actorId: string }): Card {
    const card = this.requireCard(cardId);
    const project = this.snapshot.projects.find((item) => item.id === card.projectId);
    if (!project) throw new Error(`project not found: ${card.projectId}`);
    const role = project.roles.find((item) => item.id === input.roleId);
    if (!role) throw new Error(`role not found: ${input.roleId}`);
    if (card.claimedBy !== null && card.claimedBy !== input.actorId) {
      throw new Error(`card already claimed by ${card.claimedBy}`);
    }
    return this.replaceCard({
      ...card,
      claimedRoleId: input.roleId,
      claimedBy: input.actorId,
      claimedAt: Date.now(),
    });
  }

  /**
   * The only write path for status (#52). UI and hooks must call this;
   * patching `status` on disk is ignored on the next load only if we
   * never expose a setter — callers go through this method.
   */
  transitionCard(cardId: CardId, to: WorkItemStatus): Card {
    const card = this.requireCard(cardId);
    if (card.status === to) return card;
    const error = validateWorkItemTransition(card, to);
    if (error !== null) {
      throw new Error(formatTransitionError(error));
    }
    const gate = runTransitionGates(this.gates, card, card.status, to);
    if (!gate.ok) {
      throw new Error(`gate ${gate.id} blocked ${card.status} → ${to}: ${gate.reason}`);
    }
    return this.replaceCard({ ...card, status: to });
  }

  unclaimCard(cardId: CardId, actorId: string): Card {
    const card = this.requireCard(cardId);
    if (card.claimedBy === null) return card;
    if (card.claimedBy !== actorId) {
      throw new Error(`only ${card.claimedBy} can unclaim this card`);
    }
    return this.replaceCard({
      ...card,
      claimedRoleId: null,
      claimedBy: null,
      claimedAt: null,
    });
  }

  private requireCard(cardId: CardId): Card {
    const card = this.getCard(cardId);
    if (!card) throw new Error(`card not found: ${cardId}`);
    return card;
  }

  private replaceCard(next: Card): Card {
    this.snapshot = {
      ...this.snapshot,
      cards: this.snapshot.cards.map((card) => (card.id === next.id ? next : card)),
    };
    this.write();
    return next;
  }

  private read(): BoardSnapshot {
    try {
      const raw = readFileSync(boardFilePath(this.workspaceRoot), 'utf8');
      const parsed = JSON.parse(raw) as BoardSnapshot;
      if (parsed.schemaVersion !== SCHEMA_VERSION) {
        throw new Error(`unsupported board schema ${String(parsed.schemaVersion)}`);
      }
      return parsed;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return { ...EMPTY, projects: [], cards: [] };
      throw error;
    }
  }

  private write(): void {
    const path = boardFilePath(this.workspaceRoot);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(this.snapshot, null, 2)}\n`, 'utf8');
  }
}
