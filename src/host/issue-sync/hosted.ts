/**
 * GitHub, Gitea, and GitLab issue adapters. Tokens stay on the call, never in records.
 */

import { spawnSync } from 'node:child_process';

import type {
  ExternalIssueSnapshot,
  ExternalIssueState,
  HostedIssueRequest,
  HostedIssueResponse,
  HostedIssueTransport,
  IssueProvider,
  IssueTrackerBinding,
} from './types.js';
import { IssueSyncError } from './types.js';

const DEFAULT_FETCH_SCRIPT = `
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const req = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const init = { method: req.method, headers: req.headers };
if (req.body) init.body = req.body;
const response = await fetch(req.url, init);
const body = await response.text();
process.stdout.write(JSON.stringify({ status: response.status, body }));
`;

export function defaultIssueTransport(request: HostedIssueRequest): HostedIssueResponse {
  const payload = JSON.stringify({
    method: request.method,
    url: request.url,
    headers: request.headers,
    body: request.body ?? null,
  });
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', DEFAULT_FETCH_SCRIPT],
    {
      encoding: 'utf8',
      input: payload,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30_000,
    },
  );
  if (result.error) throw new IssueSyncError('HOSTED', result.error.message);
  if (result.status !== 0) {
    const line = result.stderr.trim().split('\n').filter(Boolean).at(-1);
    throw new IssueSyncError('HOSTED', line ?? 'hosted issue request failed');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new IssueSyncError('HOSTED', 'hosted issue transport returned invalid JSON');
  }
  if (
    parsed === null
    || typeof parsed !== 'object'
    || Array.isArray(parsed)
    || typeof (parsed as { status?: unknown }).status !== 'number'
    || typeof (parsed as { body?: unknown }).body !== 'string'
  ) {
    throw new IssueSyncError('HOSTED', 'hosted issue transport returned an invalid response');
  }
  return { status: (parsed as { status: number; body: string }).status, body: (parsed as { body: string }).body };
}

export function resolveIssueToken(
  provider: IssueProvider,
  requestToken: string | undefined,
  env: NodeJS.ProcessEnv,
): string {
  const fromRequest = requestToken?.trim();
  if (fromRequest !== undefined && fromRequest !== '') return fromRequest;
  const keys = tokenEnvKeys(provider);
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value !== undefined && value !== '') return value;
  }
  throw new IssueSyncError('HOSTED', `hosted ${provider} token is required (request or ${keys.join('/')})`);
}

export function defaultApiBaseUrl(provider: IssueProvider, configured?: string): string {
  const trimmed = configured?.trim();
  if (trimmed !== undefined && trimmed !== '') return stripTrailingSlash(trimmed);
  if (provider === 'github') return 'https://api.github.com';
  if (provider === 'gitlab') return 'https://gitlab.com/api/v4';
  throw new IssueSyncError('VALIDATION', 'gitea issue tracker requires apiBaseUrl');
}

export function createHostedIssue(input: {
  readonly transport: HostedIssueTransport;
  readonly tracker: IssueTrackerBinding;
  readonly title: string;
  readonly body: string;
  readonly token: string;
}): ExternalIssueSnapshot {
  const { tracker, token } = input;
  if (tracker.provider === 'gitlab') {
    return parseGitlab(assertOk(input.transport({
      method: 'POST',
      url: `${tracker.apiBaseUrl}/projects/${gitlabProject(tracker)}/issues`,
      headers: gitlabHeaders(token),
      body: JSON.stringify({ title: input.title, description: input.body }),
    }), 'gitlab create issue'));
  }
  const response = input.transport({
    method: 'POST',
    url: `${tracker.apiBaseUrl}/repos/${tracker.owner}/${tracker.repo}/issues`,
    headers: tracker.provider === 'gitea' ? giteaHeaders(token) : githubHeaders(token),
    body: JSON.stringify({ title: input.title, body: input.body }),
  });
  return parseGithubFamily(assertOk(response, `${tracker.provider} create issue`));
}

export function getHostedIssue(input: {
  readonly transport: HostedIssueTransport;
  readonly tracker: IssueTrackerBinding;
  readonly number: number;
  readonly token: string;
}): ExternalIssueSnapshot {
  const { tracker, token, number } = input;
  if (tracker.provider === 'gitlab') {
    return parseGitlab(assertOk(input.transport({
      method: 'GET',
      url: `${tracker.apiBaseUrl}/projects/${gitlabProject(tracker)}/issues/${String(number)}`,
      headers: gitlabHeaders(token),
    }), 'gitlab get issue'));
  }
  return parseGithubFamily(assertOk(input.transport({
    method: 'GET',
    url: `${tracker.apiBaseUrl}/repos/${tracker.owner}/${tracker.repo}/issues/${String(number)}`,
    headers: tracker.provider === 'gitea' ? giteaHeaders(token) : githubHeaders(token),
  }), `${tracker.provider} get issue`));
}

export function updateHostedIssue(input: {
  readonly transport: HostedIssueTransport;
  readonly tracker: IssueTrackerBinding;
  readonly number: number;
  readonly title?: string;
  readonly body?: string;
  readonly state?: ExternalIssueState;
  readonly token: string;
}): ExternalIssueSnapshot {
  const { tracker, token, number } = input;
  if (tracker.provider === 'gitlab') {
    const payload: Record<string, string> = {};
    if (input.title !== undefined) payload.title = input.title;
    if (input.body !== undefined) payload.description = input.body;
    if (input.state !== undefined) payload.state_event = input.state === 'closed' ? 'close' : 'reopen';
    return parseGitlab(assertOk(input.transport({
      method: 'PUT',
      url: `${tracker.apiBaseUrl}/projects/${gitlabProject(tracker)}/issues/${String(number)}`,
      headers: gitlabHeaders(token),
      body: JSON.stringify(payload),
    }), 'gitlab update issue'));
  }
  const payload: Record<string, string> = {};
  if (input.title !== undefined) payload.title = input.title;
  if (input.body !== undefined) payload.body = input.body;
  if (input.state !== undefined) payload.state = input.state;
  return parseGithubFamily(assertOk(input.transport({
    method: 'PATCH',
    url: `${tracker.apiBaseUrl}/repos/${tracker.owner}/${tracker.repo}/issues/${String(number)}`,
    headers: tracker.provider === 'gitea' ? giteaHeaders(token) : githubHeaders(token),
    body: JSON.stringify(payload),
  }), `${tracker.provider} update issue`));
}

function tokenEnvKeys(provider: IssueProvider): readonly string[] {
  if (provider === 'github') return ['HUNTIANLING_GITHUB_TOKEN', 'GITHUB_TOKEN'];
  if (provider === 'gitea') return ['HUNTIANLING_GITEA_TOKEN', 'GITEA_TOKEN'];
  return ['HUNTIANLING_GITLAB_TOKEN', 'GITLAB_TOKEN'];
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
}

function giteaHeaders(token: string): Record<string, string> {
  return { Authorization: `token ${token}`, 'Content-Type': 'application/json' };
}

function gitlabHeaders(token: string): Record<string, string> {
  return { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' };
}

function gitlabProject(tracker: IssueTrackerBinding): string {
  return encodeURIComponent(`${tracker.owner}/${tracker.repo}`);
}

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function assertOk(response: HostedIssueResponse, action: string): Record<string, unknown> {
  if (response.status < 200 || response.status >= 300) {
    throw new IssueSyncError('HOSTED', `${action} failed with ${String(response.status)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    throw new IssueSyncError('HOSTED', `${action} returned invalid JSON`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new IssueSyncError('HOSTED', `${action} returned a non-object`);
  }
  return parsed as Record<string, unknown>;
}

function parseGithubFamily(payload: Record<string, unknown>): ExternalIssueSnapshot {
  return {
    number: requiredNumber(payload.number, 'issue number'),
    externalId: String(payload.id ?? payload.number),
    url: requiredString(payload.html_url ?? payload.url, 'issue url'),
    title: requiredString(payload.title, 'issue title'),
    body: typeof payload.body === 'string' ? payload.body : '',
    state: payload.state === 'closed' ? 'closed' : 'open',
    updatedAt: typeof payload.updated_at === 'string' ? payload.updated_at : '',
  };
}

function parseGitlab(payload: Record<string, unknown>): ExternalIssueSnapshot {
  const state = payload.state === 'closed' ? 'closed' : 'open';
  return {
    number: requiredNumber(payload.iid ?? payload.id, 'issue iid'),
    externalId: String(payload.id ?? payload.iid),
    url: requiredString(payload.web_url ?? payload.url, 'issue url'),
    title: requiredString(payload.title, 'issue title'),
    body: typeof payload.description === 'string' ? payload.description : '',
    state,
    updatedAt: typeof payload.updated_at === 'string' ? payload.updated_at : '',
  };
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new IssueSyncError('HOSTED', `missing ${label}`);
  }
  return value;
}

function requiredNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new IssueSyncError('HOSTED', `missing ${label}`);
  }
  return value;
}
