/**
 * Local command-runner and hosted CI results.
 */

import type { CheckResult } from '../environment/types.js';

export interface CiCommandResult {
  readonly status: CheckResult;
  readonly output: string;
}

export type CiCommandRunner = (command: string) => CiCommandResult;

export interface CiCommandSpec {
  readonly id: string;
  readonly command: string;
  readonly required: boolean;
}

export type HostedCiProvider = 'github-actions' | 'gitea-actions' | 'gitlab-ci';

export const HOSTED_CI_PROVIDERS: readonly HostedCiProvider[] = [
  'github-actions',
  'gitea-actions',
  'gitlab-ci',
];

export function isHostedCiProvider(value: string): value is HostedCiProvider {
  return (HOSTED_CI_PROVIDERS as readonly string[]).includes(value);
}

export interface HostedCiRequest {
  readonly method: 'GET' | 'POST';
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
}

export interface HostedCiResponse {
  readonly status: number;
  readonly body: string;
}

export type HostedCiTransport = (request: HostedCiRequest) => HostedCiResponse;

export interface HostedCiWorkflow {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly provider: HostedCiProvider;
}

export interface CiRunInput {
  readonly workItemId: string;
  readonly workspaceRoot: string;
  readonly commands?: readonly CiCommandSpec[];
  readonly runner?: CiCommandRunner;
  readonly production?: boolean;
  readonly role?: string;
  readonly actor?: string;
  readonly approvalId?: string;
  readonly provider?: string;
  readonly owner?: string;
  readonly repo?: string;
  readonly workflow?: string;
  readonly ref?: string;
  readonly token?: string;
  readonly apiBaseUrl?: string;
}

export interface CiWorkflowListInput {
  readonly provider: string;
  readonly owner: string;
  readonly repo: string;
  readonly role?: string;
  readonly actor?: string;
  readonly token?: string;
  readonly apiBaseUrl?: string;
  readonly ref?: string;
}

export class CiError extends Error {
  constructor(readonly code: 'NOT_FOUND' | 'VALIDATION' | 'RUN' | 'AUTHORITY' | 'HOSTED', message: string) {
    super(message);
  }
}
