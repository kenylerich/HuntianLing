/**
 * GitHub Actions, Gitea Actions, and GitLab CI adapters. Tokens stay on the call.
 */

import { spawnSync } from 'node:child_process';

import type {
  HostedCiProvider,
  HostedCiRequest,
  HostedCiResponse,
  HostedCiTransport,
  HostedCiWorkflow,
} from './types.js';
import { CiError, isHostedCiProvider } from './types.js';

export interface HostedCiTarget {
  readonly provider: HostedCiProvider;
  readonly owner: string;
  readonly repo: string;
  readonly apiBaseUrl: string;
}

export interface HostedCiRunResult {
  readonly runId: string;
  readonly url: string | null;
  readonly conclusion: 'success' | 'failure' | 'cancelled';
  readonly logs: string;
  readonly artifacts: readonly { readonly name: string; readonly content: string; readonly url: string | null }[];
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

export function defaultHostedCiTransport(request: HostedCiRequest): HostedCiResponse {
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
  if (result.error) throw new CiError('HOSTED', result.error.message);
  if (result.status !== 0) {
    const line = result.stderr.trim().split('\n').filter(Boolean).at(-1);
    throw new CiError('HOSTED', line ?? 'hosted CI request failed');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new CiError('HOSTED', 'hosted CI transport returned invalid JSON');
  }
  if (
    parsed === null
    || typeof parsed !== 'object'
    || Array.isArray(parsed)
    || typeof (parsed as { status?: unknown }).status !== 'number'
    || typeof (parsed as { body?: unknown }).body !== 'string'
  ) {
    throw new CiError('HOSTED', 'hosted CI transport returned an invalid response');
  }
  return { status: (parsed as { status: number }).status, body: (parsed as { body: string }).body };
}

export function parseHostedCiProvider(value: string | undefined): HostedCiProvider | 'local' {
  const provider = value?.trim() ?? 'local';
  if (provider === '' || provider === 'local' || provider === 'local-git') return 'local';
  if (provider === 'github' || provider === 'github-actions') return 'github-actions';
  if (provider === 'gitea' || provider === 'gitea-actions') return 'gitea-actions';
  if (provider === 'gitlab' || provider === 'gitlab-ci') return 'gitlab-ci';
  throw new CiError('VALIDATION', `unknown ci provider: ${provider}`);
}

export function resolveHostedCiToken(
  provider: HostedCiProvider,
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
  throw new CiError('HOSTED', `hosted ${provider} token is required (request or ${keys.join('/')})`);
}

export function resolveHostedCiTarget(input: {
  readonly provider?: string;
  readonly owner?: string;
  readonly repo?: string;
  readonly apiBaseUrl?: string;
}): HostedCiTarget {
  const provider = parseHostedCiProvider(input.provider);
  if (provider === 'local' || !isHostedCiProvider(provider)) {
    throw new CiError('VALIDATION', 'hosted CI requires a hosted provider');
  }
  const owner = input.owner?.trim() ?? '';
  const repo = input.repo?.trim() ?? '';
  if (owner === '' || repo === '') {
    throw new CiError('VALIDATION', `hosted ${provider} requires owner and repo`);
  }
  return {
    provider,
    owner,
    repo,
    apiBaseUrl: resolveApiBaseUrl(provider, input.apiBaseUrl),
  };
}

export function hostedListWorkflows(input: {
  readonly transport: HostedCiTransport;
  readonly target: HostedCiTarget;
  readonly token: string;
  readonly ref?: string;
}): readonly HostedCiWorkflow[] {
  const { target, token, transport } = input;
  if (target.provider === 'gitlab-ci') {
    const ref = encodeURIComponent(input.ref?.trim() || 'main');
    const response = transport({
      method: 'GET',
      url: `${target.apiBaseUrl}/projects/${gitlabProject(target)}/repository/files/.gitlab-ci.yml?ref=${ref}`,
      headers: gitlabHeaders(token),
    });
    if (response.status === 404) return [];
    assertOk(response, 'gitlab discover workflow');
    return [{
      id: '.gitlab-ci.yml',
      name: 'GitLab CI',
      path: '.gitlab-ci.yml',
      provider: 'gitlab-ci',
    }];
  }
  const response = transport({
    method: 'GET',
    url: `${target.apiBaseUrl}/repos/${target.owner}/${target.repo}/actions/workflows`,
    headers: target.provider === 'gitea-actions' ? giteaHeaders(token) : githubHeaders(token),
  });
  const payload = readObject(assertOk(response, `${target.provider} list workflows`), `${target.provider} list workflows`);
  const workflows = payload.workflows;
  if (!Array.isArray(workflows)) return [];
  return workflows.flatMap((row) => {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) return [];
    const item = row as Record<string, unknown>;
    const path = stringField(item.path) ?? stringField(item.name);
    if (path === undefined) return [];
    return [{
      id: stringField(item.id) ?? (typeof item.id === 'number' ? String(item.id) : path),
      name: stringField(item.name) ?? path,
      path,
      provider: target.provider,
    }];
  });
}

export function hostedTriggerAndCollect(input: {
  readonly transport: HostedCiTransport;
  readonly target: HostedCiTarget;
  readonly token: string;
  readonly workflow: string;
  readonly ref: string;
}): HostedCiRunResult {
  const workflow = input.workflow.trim();
  const ref = input.ref.trim();
  if (workflow === '' || ref === '') {
    throw new CiError('VALIDATION', `hosted ${input.target.provider} requires workflow and ref`);
  }
  if (input.target.provider === 'gitlab-ci') {
    return gitlabTrigger(input.transport, input.target, input.token, ref);
  }
  return githubCompatibleTrigger(input.transport, input.target, input.token, workflow, ref);
}

function githubCompatibleTrigger(
  transport: HostedCiTransport,
  target: HostedCiTarget,
  token: string,
  workflow: string,
  ref: string,
): HostedCiRunResult {
  const headers = target.provider === 'gitea-actions' ? giteaHeaders(token) : githubHeaders(token);
  const dispatched = transport({
    method: 'POST',
    url: `${target.apiBaseUrl}/repos/${target.owner}/${target.repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
    headers,
    body: JSON.stringify({ ref }),
  });
  if (dispatched.status !== 204 && dispatched.status !== 200 && dispatched.status !== 201) {
    throw hostedFailure(`${target.provider} dispatch`, dispatched);
  }
  const listed = transport({
    method: 'GET',
    url: `${target.apiBaseUrl}/repos/${target.owner}/${target.repo}/actions/runs?per_page=1`,
    headers,
  });
  const listPayload = readObject(assertOk(listed, `${target.provider} list runs`), `${target.provider} list runs`);
  const first = firstObject(listPayload.workflow_runs);
  if (first === undefined) throw new CiError('HOSTED', `${target.provider} run was not found after dispatch`);
  const runId = requiredId(first.id, `${target.provider} run id`);
  const waited = waitForGithubRun(transport, target, headers, runId, first);
  const logs = readLogs(transport, {
    method: 'GET',
    url: `${target.apiBaseUrl}/repos/${target.owner}/${target.repo}/actions/runs/${encodeURIComponent(runId)}/logs`,
    headers,
  });
  const artifacts = readGithubArtifacts(transport, target, headers, runId);
  return {
    runId,
    url: stringField(waited.html_url) ?? null,
    conclusion: normalizeConclusion(stringField(waited.conclusion) ?? stringField(waited.status)),
    logs,
    artifacts,
  };
}

function waitForGithubRun(
  transport: HostedCiTransport,
  target: HostedCiTarget,
  headers: Record<string, string>,
  runId: string,
  initial: Record<string, unknown>,
): Record<string, unknown> {
  let current = initial;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const status = stringField(current.status) ?? '';
    if (status === 'completed' || status === 'success' || status === 'failure' || status === 'failed') {
      return current;
    }
    const polled = transport({
      method: 'GET',
      url: `${target.apiBaseUrl}/repos/${target.owner}/${target.repo}/actions/runs/${encodeURIComponent(runId)}`,
      headers,
    });
    current = readObject(assertOk(polled, `${target.provider} read run`), `${target.provider} read run`);
  }
  throw new CiError('HOSTED', `${target.provider} pipeline did not complete`);
}

function readGithubArtifacts(
  transport: HostedCiTransport,
  target: HostedCiTarget,
  headers: Record<string, string>,
  runId: string,
): readonly { readonly name: string; readonly content: string; readonly url: string | null }[] {
  const listed = transport({
    method: 'GET',
    url: `${target.apiBaseUrl}/repos/${target.owner}/${target.repo}/actions/runs/${encodeURIComponent(runId)}/artifacts`,
    headers,
  });
  const payload = readObject(assertOk(listed, `${target.provider} list artifacts`), `${target.provider} list artifacts`);
  const artifacts = payload.artifacts;
  if (!Array.isArray(artifacts)) return [];
  const collected: { name: string; content: string; url: string | null }[] = [];
  for (const row of artifacts) {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) continue;
    const item = row as Record<string, unknown>;
    const name = stringField(item.name) ?? 'artifact';
    const url = stringField(item.archive_download_url) ?? stringField(item.url) ?? null;
    if (url === null) {
      collected.push({ name, content: '', url: null });
      continue;
    }
    const downloaded = transport({ method: 'GET', url, headers });
    collected.push({
      name,
      content: downloaded.status < 200 || downloaded.status >= 300 ? '' : downloaded.body,
      url,
    });
  }
  return collected;
}

function gitlabTrigger(
  transport: HostedCiTransport,
  target: HostedCiTarget,
  token: string,
  ref: string,
): HostedCiRunResult {
  const headers = gitlabHeaders(token);
  const project = gitlabProject(target);
  const created = transport({
    method: 'POST',
    url: `${target.apiBaseUrl}/projects/${project}/pipeline`,
    headers,
    body: JSON.stringify({ ref }),
  });
  const createdPayload = readObject(assertOk(created, 'gitlab create pipeline'), 'gitlab create pipeline');
  const runId = requiredId(createdPayload.id, 'gitlab pipeline id');
  const waited = waitForGitlab(transport, target, headers, runId, createdPayload);
  const jobsResponse = transport({
    method: 'GET',
    url: `${target.apiBaseUrl}/projects/${project}/pipelines/${encodeURIComponent(runId)}/jobs`,
    headers,
  });
  const jobs = readArray(assertOk(jobsResponse, 'gitlab list jobs'), 'gitlab list jobs');
  const artifacts = jobs.flatMap((job) => {
    const jobId = requiredId(job.id, 'gitlab job id');
    const name = stringField(job.name) ?? `job-${jobId}`;
    const downloaded = transport({
      method: 'GET',
      url: `${target.apiBaseUrl}/projects/${project}/jobs/${encodeURIComponent(jobId)}/artifacts`,
      headers,
    });
    if (downloaded.status === 404) return [];
    if (downloaded.status < 200 || downloaded.status >= 300) return [];
    return [{ name, content: downloaded.body, url: stringField(job.web_url) ?? null }];
  });
  return {
    runId,
    url: stringField(waited.web_url) ?? null,
    conclusion: normalizeConclusion(stringField(waited.status)),
    logs: '',
    artifacts,
  };
}

function waitForGitlab(
  transport: HostedCiTransport,
  target: HostedCiTarget,
  headers: Record<string, string>,
  runId: string,
  initial: Record<string, unknown>,
): Record<string, unknown> {
  let current = initial;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const status = stringField(current.status) ?? '';
    if (['success', 'failed', 'canceled', 'cancelled', 'skipped', 'completed'].includes(status)) {
      return current;
    }
    const polled = transport({
      method: 'GET',
      url: `${target.apiBaseUrl}/projects/${gitlabProject(target)}/pipelines/${encodeURIComponent(runId)}`,
      headers,
    });
    current = readObject(assertOk(polled, 'gitlab read pipeline'), 'gitlab read pipeline');
  }
  throw new CiError('HOSTED', 'gitlab-ci pipeline did not complete');
}

function readLogs(transport: HostedCiTransport, request: HostedCiRequest): string {
  const response = transport(request);
  if (response.status < 200 || response.status >= 300) return '';
  if (response.body.includes('\u0000')) return '';
  return response.body.slice(0, 4000);
}

function resolveApiBaseUrl(provider: HostedCiProvider, configured: string | undefined): string {
  const value = configured?.trim();
  if (value !== undefined && value !== '') return value.replace(/\/+$/, '');
  if (provider === 'github-actions') return 'https://api.github.com';
  if (provider === 'gitlab-ci') return 'https://gitlab.com/api/v4';
  throw new CiError('VALIDATION', 'gitea-actions requires apiBaseUrl');
}

function tokenEnvKeys(provider: HostedCiProvider): readonly string[] {
  if (provider === 'github-actions') return ['HUNTIANLING_GITHUB_TOKEN', 'GITHUB_TOKEN'];
  if (provider === 'gitea-actions') return ['HUNTIANLING_GITEA_TOKEN'];
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

function gitlabProject(target: HostedCiTarget): string {
  return encodeURIComponent(`${target.owner}/${target.repo}`);
}

function normalizeConclusion(value: string | undefined): 'success' | 'failure' | 'cancelled' {
  const status = (value ?? '').toLowerCase();
  if (status === 'success' || status === 'passed') return 'success';
  if (status === 'cancelled' || status === 'canceled' || status === 'skipped') return 'cancelled';
  if (status === 'failure' || status === 'failed') return 'failure';
  throw new CiError('HOSTED', `hosted pipeline did not complete (${value ?? 'unknown'})`);
}

function assertOk(response: HostedCiResponse, label: string): HostedCiResponse {
  if (response.status < 200 || response.status >= 300) throw hostedFailure(label, response);
  return response;
}

function hostedFailure(label: string, response: HostedCiResponse): CiError {
  const snippet = response.body.replace(/\s+/g, ' ').trim().slice(0, 200);
  return new CiError('HOSTED', `${label} failed (${String(response.status)})${snippet === '' ? '' : `: ${snippet}`}`);
}

function readObject(response: HostedCiResponse, label: string): Record<string, unknown> {
  if (response.body.trim() === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    throw new CiError('HOSTED', `${label} returned invalid JSON`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CiError('HOSTED', `${label} did not return a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function readArray(response: HostedCiResponse, label: string): readonly Record<string, unknown>[] {
  if (response.body.trim() === '') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    throw new CiError('HOSTED', `${label} returned invalid JSON`);
  }
  if (!Array.isArray(parsed)) throw new CiError('HOSTED', `${label} did not return a JSON array`);
  return parsed.flatMap((row) => {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) return [];
    return [row as Record<string, unknown>];
  });
}

function firstObject(value: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(value) || value[0] === undefined) return undefined;
  const row = value[0];
  if (row === null || typeof row !== 'object' || Array.isArray(row)) return undefined;
  return row as Record<string, unknown>;
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function requiredId(value: unknown, label: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  const text = stringField(value);
  if (text === undefined) throw new CiError('HOSTED', `${label} is missing`);
  return text;
}
