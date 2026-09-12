/**
 * GitHub, Gitea, and GitLab write adapters. Tokens stay on the call, never in records.
 */

import { spawnSync } from 'node:child_process';

import type {
  HostedScmProvider,
  HostedScmRequest,
  HostedScmResponse,
  HostedScmTransport,
  ProjectRepository,
} from './types.js';
import { isHostedScmProvider, ScmError } from './types.js';

export interface HostedPullRequestResult {
  readonly id: string;
  readonly url: string;
}

export interface HostedShaResult {
  readonly sha: string;
}

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

export function defaultHostedTransport(request: HostedScmRequest): HostedScmResponse {
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
  if (result.error) {
    throw new ScmError('HOSTED', result.error.message);
  }
  if (result.status !== 0) {
    const line = result.stderr.trim().split('\n').filter(Boolean).at(-1);
    throw new ScmError('HOSTED', line ?? 'hosted SCM request failed');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new ScmError('HOSTED', 'hosted SCM transport returned invalid JSON');
  }
  if (
    parsed === null
    || typeof parsed !== 'object'
    || Array.isArray(parsed)
    || typeof (parsed as { status?: unknown }).status !== 'number'
    || typeof (parsed as { body?: unknown }).body !== 'string'
  ) {
    throw new ScmError('HOSTED', 'hosted SCM transport returned an invalid response');
  }
  return { status: (parsed as { status: number; body: string }).status, body: (parsed as { body: string }).body };
}

export function requireHostedProvider(repository: ProjectRepository): HostedScmProvider {
  if (!isHostedScmProvider(repository.provider)) {
    throw new ScmError('VALIDATION', `repository ${repository.id} is not a hosted provider`);
  }
  return repository.provider;
}

export function resolveHostedToken(
  provider: HostedScmProvider,
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
  throw new ScmError('HOSTED', `hosted ${provider} token is required (request or ${keys.join('/')})`);
}

export function resolveApiBaseUrl(repository: ProjectRepository): string {
  const configured = repository.apiBaseUrl?.trim();
  if (configured !== undefined && configured !== '') return stripTrailingSlash(configured);
  const provider = requireHostedProvider(repository);
  if (provider === 'github') return 'https://api.github.com';
  if (provider === 'gitlab') {
    const origin = originOf(requireRemoteUrl(repository));
    return origin === 'https://gitlab.com' || origin === 'http://gitlab.com'
      ? 'https://gitlab.com/api/v4'
      : `${origin}/api/v4`;
  }
  return `${originOf(requireRemoteUrl(repository))}/api/v1`;
}

export function hostedPush(input: {
  readonly transport: HostedScmTransport;
  readonly repository: ProjectRepository;
  readonly branch: string;
  readonly sha: string;
  readonly token: string;
}): HostedShaResult {
  const provider = requireHostedProvider(input.repository);
  const owner = requireOwner(input.repository);
  const repo = requireRepoName(input.repository);
  const base = resolveApiBaseUrl(input.repository);
  if (provider === 'github') return githubPush(input.transport, base, owner, repo, input.branch, input.sha, input.token);
  if (provider === 'gitea') return giteaPush(input.transport, base, owner, repo, input.branch, input.sha, input.token);
  return gitlabPush(input.transport, base, owner, repo, input.branch, input.sha, input.token);
}

export function hostedOpenPullRequest(input: {
  readonly transport: HostedScmTransport;
  readonly repository: ProjectRepository;
  readonly title: string;
  readonly head: string;
  readonly base: string;
  readonly token: string;
}): HostedPullRequestResult {
  const provider = requireHostedProvider(input.repository);
  const owner = requireOwner(input.repository);
  const repo = requireRepoName(input.repository);
  const api = resolveApiBaseUrl(input.repository);
  if (provider === 'github') {
    const response = input.transport({
      method: 'POST',
      url: `${api}/repos/${owner}/${repo}/pulls`,
      headers: githubHeaders(input.token),
      body: JSON.stringify({ title: input.title, head: input.head, base: input.base }),
    });
    const payload = readObject(assertOk(response, 'github open pull request'), 'github open pull request');
    return {
      id: requiredId(payload.number, 'github pull request number'),
      url: requiredUrl(payload.html_url, 'github pull request html_url'),
    };
  }
  if (provider === 'gitea') {
    const response = input.transport({
      method: 'POST',
      url: `${api}/repos/${owner}/${repo}/pulls`,
      headers: giteaHeaders(input.token),
      body: JSON.stringify({ title: input.title, head: input.head, base: input.base }),
    });
    const payload = readObject(assertOk(response, 'gitea open pull request'), 'gitea open pull request');
    return {
      id: requiredId(payload.number, 'gitea pull request number'),
      url: requiredUrl(payload.html_url ?? payload.url, 'gitea pull request url'),
    };
  }
  const response = input.transport({
    method: 'POST',
    url: `${api}/projects/${gitlabProject(owner, repo)}/merge_requests`,
    headers: gitlabHeaders(input.token),
    body: JSON.stringify({
      title: input.title,
      source_branch: input.head,
      target_branch: input.base,
    }),
  });
  const payload = readObject(assertOk(response, 'gitlab open merge request'), 'gitlab open merge request');
  return {
    id: requiredId(payload.iid, 'gitlab merge request iid'),
    url: requiredUrl(payload.web_url, 'gitlab merge request web_url'),
  };
}

export function hostedMerge(input: {
  readonly transport: HostedScmTransport;
  readonly repository: ProjectRepository;
  readonly providerPullRequestId: string;
  readonly token: string;
}): HostedShaResult {
  const provider = requireHostedProvider(input.repository);
  const owner = requireOwner(input.repository);
  const repo = requireRepoName(input.repository);
  const api = resolveApiBaseUrl(input.repository);
  const id = encodeURIComponent(input.providerPullRequestId);
  if (provider === 'github') {
    const response = input.transport({
      method: 'PUT',
      url: `${api}/repos/${owner}/${repo}/pulls/${id}/merge`,
      headers: githubHeaders(input.token),
      body: JSON.stringify({ merge_method: 'merge' }),
    });
    const payload = readObject(assertOk(response, 'github merge pull request'), 'github merge pull request');
    return { sha: requiredUrl(payload.sha, 'github merge sha') };
  }
  if (provider === 'gitea') {
    const response = input.transport({
      method: 'POST',
      url: `${api}/repos/${owner}/${repo}/pulls/${id}/merge`,
      headers: giteaHeaders(input.token),
      body: JSON.stringify({ Do: 'merge' }),
    });
    const payload = readObject(assertOk(response, 'gitea merge pull request'), 'gitea merge pull request');
    const sha = stringField(payload.sha) ?? stringField(payload.merge_commit_sha);
    return { sha: requiredUrl(sha, 'gitea merge sha') };
  }
  const response = input.transport({
    method: 'PUT',
    url: `${api}/projects/${gitlabProject(owner, repo)}/merge_requests/${id}/merge`,
    headers: gitlabHeaders(input.token),
  });
  const payload = readObject(assertOk(response, 'gitlab merge merge request'), 'gitlab merge merge request');
  const sha = stringField(payload.merge_commit_sha) ?? stringField(payload.sha);
  return { sha: requiredUrl(sha, 'gitlab merge sha') };
}

function githubPush(
  transport: HostedScmTransport,
  api: string,
  owner: string,
  repo: string,
  branch: string,
  sha: string,
  token: string,
): HostedShaResult {
  const created = transport({
    method: 'POST',
    url: `${api}/repos/${owner}/${repo}/git/refs`,
    headers: githubHeaders(token),
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
  });
  if (created.status === 201 || created.status === 200) return { sha };
  if (created.status === 422) {
    const updated = transport({
      method: 'PATCH',
      url: `${api}/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
      headers: githubHeaders(token),
      body: JSON.stringify({ sha }),
    });
    assertOk(updated, 'github update ref');
    return { sha };
  }
  throw hostedFailure('github create ref', created);
}

function giteaPush(
  transport: HostedScmTransport,
  api: string,
  owner: string,
  repo: string,
  branch: string,
  sha: string,
  token: string,
): HostedShaResult {
  const created = transport({
    method: 'POST',
    url: `${api}/repos/${owner}/${repo}/git/refs`,
    headers: giteaHeaders(token),
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
  });
  if (created.status === 201 || created.status === 200) return { sha };
  if (created.status === 404 || created.status === 409 || created.status === 422) {
    const updated = transport({
      method: 'PATCH',
      url: `${api}/repos/${owner}/${repo}/git/refs/${encodeURIComponent(`heads/${branch}`)}`,
      headers: giteaHeaders(token),
      body: JSON.stringify({ sha }),
    });
    assertOk(updated, 'gitea update ref');
    return { sha };
  }
  throw hostedFailure('gitea create ref', created);
}

function gitlabPush(
  transport: HostedScmTransport,
  api: string,
  owner: string,
  repo: string,
  branch: string,
  sha: string,
  token: string,
): HostedShaResult {
  const project = gitlabProject(owner, repo);
  const created = transport({
    method: 'POST',
    url: `${api}/projects/${project}/repository/branches`,
    headers: gitlabHeaders(token),
    body: JSON.stringify({ branch, ref: sha }),
  });
  if (created.status === 201 || created.status === 200) return { sha };
  if (created.status === 400) {
    const existing = transport({
      method: 'GET',
      url: `${api}/projects/${project}/repository/branches/${encodeURIComponent(branch)}`,
      headers: gitlabHeaders(token),
    });
    const payload = readObject(assertOk(existing, 'gitlab read branch'), 'gitlab read branch');
    const commit = payload.commit;
    const current = commit !== null && typeof commit === 'object' && !Array.isArray(commit)
      ? stringField((commit as Record<string, unknown>).id)
      : undefined;
    if (current === sha) return { sha };
    throw new ScmError(
      'HOSTED',
      `gitlab cannot move existing branch ${branch} via REST (at ${current ?? 'unknown'}, wanted ${sha})`,
    );
  }
  throw hostedFailure('gitlab create branch', created);
}

function tokenEnvKeys(provider: HostedScmProvider): readonly string[] {
  if (provider === 'github') return ['HUNTIANLING_GITHUB_TOKEN', 'GITHUB_TOKEN'];
  if (provider === 'gitea') return ['HUNTIANLING_GITEA_TOKEN'];
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
  return {
    Authorization: `token ${token}`,
    'Content-Type': 'application/json',
  };
}

function gitlabHeaders(token: string): Record<string, string> {
  return {
    'PRIVATE-TOKEN': token,
    'Content-Type': 'application/json',
  };
}

function gitlabProject(owner: string, repo: string): string {
  return encodeURIComponent(`${owner}/${repo}`);
}

function requireRemoteUrl(repository: ProjectRepository): string {
  const remoteUrl = repository.remoteUrl?.trim();
  if (remoteUrl === undefined || remoteUrl === '') {
    throw new ScmError('VALIDATION', `hosted ${repository.provider} repository requires remoteUrl`);
  }
  return remoteUrl;
}

function requireOwner(repository: ProjectRepository): string {
  const owner = repository.owner?.trim();
  if (owner === undefined || owner === '') {
    throw new ScmError('VALIDATION', `hosted ${repository.provider} repository requires owner`);
  }
  return owner;
}

function requireRepoName(repository: ProjectRepository): string {
  const repo = repository.repo?.trim();
  if (repo === undefined || repo === '') {
    throw new ScmError('VALIDATION', `hosted ${repository.provider} repository requires repo`);
  }
  return repo;
}

function originOf(remoteUrl: string): string {
  try {
    const normalized = remoteUrl.replace(/^git@([^:]+):/, 'https://$1/');
    const url = new URL(normalized);
    return `${url.protocol}//${url.host}`;
  } catch {
    throw new ScmError('VALIDATION', `invalid remoteUrl: ${remoteUrl}`);
  }
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function assertOk(response: HostedScmResponse, label: string): HostedScmResponse {
  if (response.status < 200 || response.status >= 300) throw hostedFailure(label, response);
  return response;
}

function hostedFailure(label: string, response: HostedScmResponse): ScmError {
  const snippet = response.body.replace(/\s+/g, ' ').trim().slice(0, 200);
  return new ScmError('HOSTED', `${label} failed (${String(response.status)})${snippet === '' ? '' : `: ${snippet}`}`);
}

function readObject(response: HostedScmResponse, label: string): Record<string, unknown> {
  if (response.body.trim() === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    throw new ScmError('HOSTED', `${label} returned invalid JSON`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ScmError('HOSTED', `${label} did not return a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function requiredUrl(value: unknown, label: string): string {
  const text = typeof value === 'number' ? String(value) : stringField(value);
  if (text === undefined) throw new ScmError('HOSTED', `${label} is missing`);
  return text;
}

function requiredId(value: unknown, label: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  const text = stringField(value);
  if (text === undefined) throw new ScmError('HOSTED', `${label} is missing`);
  return text;
}
