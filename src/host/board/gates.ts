/**
 * Transition gates (#45). No built-in business checks — callers register
 * gates. Empty registry means the lifecycle rules alone apply.
 */

import type { Card, WorkItemStatus } from './types.js';

export interface GateResult {
  readonly ok: boolean;
  readonly reason?: string;
}

export interface TransitionGate {
  readonly id: string;
  readonly from?: WorkItemStatus;
  readonly to?: WorkItemStatus;
  run(card: Card, from: WorkItemStatus, to: WorkItemStatus): GateResult;
}

export function gateMatches(
  gate: TransitionGate,
  from: WorkItemStatus,
  to: WorkItemStatus,
): boolean {
  if (gate.from !== undefined && gate.from !== from) return false;
  if (gate.to !== undefined && gate.to !== to) return false;
  return true;
}

export function runTransitionGates(
  gates: readonly TransitionGate[],
  card: Card,
  from: WorkItemStatus,
  to: WorkItemStatus,
): { ok: true } | { ok: false; id: string; reason: string } {
  for (const gate of gates) {
    if (!gateMatches(gate, from, to)) continue;
    const result = gate.run(card, from, to);
    if (!result.ok) {
      return { ok: false, id: gate.id, reason: result.reason ?? `gate ${gate.id} rejected` };
    }
  }
  return { ok: true };
}
