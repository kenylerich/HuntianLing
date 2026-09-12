/**
 * Hosted OCR and live-model intake extractor. Tokens stay on the call.
 */

import { spawnSync } from 'node:child_process';

import type { IntakeLlmExtraction, IntakeLlmExtractor, IntakeLlmNode } from './candidates.js';
import type {
  IntakeConfig,
  IntakeHostedRequest,
  IntakeHostedResponse,
  IntakeHostedTransport,
  IntakeOcrAdapter,
} from './types.js';
import {
  IntakeHostedError,
  resolveIntakeHostedEndpoints,
  resolveIntakeLlmToken,
  resolveIntakeOcrToken,
} from './types.js';

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

export function defaultIntakeHostedTransport(request: IntakeHostedRequest): IntakeHostedResponse {
  const payload = JSON.stringify({
    method: request.method,
    url: request.url,
    headers: request.headers,
    body: request.body,
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
  if (result.error) throw new IntakeHostedError('OCR', result.error.message);
  if (result.status !== 0) {
    const line = result.stderr.trim().split('\n').filter(Boolean).at(-1);
    throw new IntakeHostedError('OCR', line ?? 'hosted intake request failed');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new IntakeHostedError('OCR', 'hosted intake transport returned invalid JSON');
  }
  if (
    parsed === null
    || typeof parsed !== 'object'
    || Array.isArray(parsed)
    || typeof (parsed as { status?: unknown }).status !== 'number'
    || typeof (parsed as { body?: unknown }).body !== 'string'
  ) {
    throw new IntakeHostedError('OCR', 'hosted intake transport returned an invalid response');
  }
  return { status: (parsed as { status: number }).status, body: (parsed as { body: string }).body };
}

export function createHostedIntakeAdapters(input: {
  readonly config?: IntakeConfig;
  readonly env?: NodeJS.ProcessEnv;
  readonly hosted?: IntakeHostedTransport;
}): {
  readonly ocr: IntakeOcrAdapter | undefined;
  readonly llm: IntakeLlmExtractor | undefined;
} {
  const env = input.env ?? {};
  const endpoints = resolveIntakeHostedEndpoints(input.config ?? {}, env);
  const transport = input.hosted ?? defaultIntakeHostedTransport;
  return {
    ocr: endpoints.ocrUrl === null
      ? undefined
      : createHostedOcrAdapter({ url: endpoints.ocrUrl, env, transport }),
    llm: endpoints.llmUrl === null
      ? undefined
      : createHostedLlmExtractor({
        url: endpoints.llmUrl,
        model: endpoints.llmModel,
        env,
        transport,
      }),
  };
}

export function createHostedOcrAdapter(input: {
  readonly url: string;
  readonly env: NodeJS.ProcessEnv;
  readonly transport: IntakeHostedTransport;
}): IntakeOcrAdapter {
  return {
    recognize(request) {
      const token = resolveIntakeOcrToken(undefined, input.env);
      const response = input.transport({
        method: 'POST',
        url: input.url,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mimeType: request.mimeType,
          name: request.name,
          contentBase64: Buffer.from(request.bytes).toString('base64'),
        }),
      });
      const payload = readObject(assertOk(response, 'OCR', 'hosted OCR'), 'hosted OCR');
      const text = stringField(payload.text) ?? stringField(payload.content);
      if (text === undefined || text.trim() === '') {
        throw new IntakeHostedError('OCR', 'hosted OCR returned no text');
      }
      return text.trim();
    },
  };
}

export function createHostedLlmExtractor(input: {
  readonly url: string;
  readonly model: string | null;
  readonly env: NodeJS.ProcessEnv;
  readonly transport: IntakeHostedTransport;
}): IntakeLlmExtractor {
  return {
    extract(request) {
      const model = input.model?.trim() ?? '';
      if (model === '') {
        throw new IntakeHostedError('VALIDATION', 'intake llmModel is required');
      }
      const token = resolveIntakeLlmToken(undefined, input.env);
      const response = input.transport({
        method: 'POST',
        url: input.url,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                'Extract requirement fields as JSON with keys goals, actors, scenarios, constraints, risks, assumptions, openQuestions, acceptance.',
                'Each value is an array of strings. Optional nodes is an array of candidate objects.',
                `Session title: ${request.sessionTitle}`,
                request.sourceText,
              ].join('\n\n'),
            },
          ],
        }),
      });
      const payload = readObject(assertOk(response, 'LLM', 'hosted intake llm'), 'hosted intake llm');
      return parseLlmExtraction(payload);
    },
  };
}

function parseLlmExtraction(payload: Record<string, unknown>): IntakeLlmExtraction {
  const content = assistantContent(payload) ?? jsonObjectBody(payload);
  if (content === undefined) {
    throw new IntakeHostedError('LLM', 'hosted intake llm did not return JSON fields');
  }
  return {
    goals: stringArray(content.goals),
    actors: stringArray(content.actors),
    scenarios: stringArray(content.scenarios),
    constraints: stringArray(content.constraints),
    risks: stringArray(content.risks),
    assumptions: stringArray(content.assumptions),
    openQuestions: stringArray(content.openQuestions ?? content.open_questions),
    acceptance: stringArray(content.acceptance),
    ...(Array.isArray(content.nodes) ? { nodes: content.nodes as readonly IntakeLlmNode[] } : {}),
  };
}

function assistantContent(payload: Record<string, unknown>): Record<string, unknown> | undefined {
  const choices = payload.choices;
  if (!Array.isArray(choices) || choices[0] === undefined) return undefined;
  const first = choices[0];
  if (first === null || typeof first !== 'object' || Array.isArray(first)) return undefined;
  const message = (first as Record<string, unknown>).message;
  if (message === null || typeof message !== 'object' || Array.isArray(message)) return undefined;
  const raw = stringField((message as Record<string, unknown>).content);
  if (raw === undefined) return undefined;
  return parseJsonObject(stripFence(raw), 'hosted intake llm content');
}

function jsonObjectBody(payload: Record<string, unknown>): Record<string, unknown> | undefined {
  if (payload.goals !== undefined || payload.actors !== undefined) return payload;
  return undefined;
}

function stripFence(value: string): string {
  const trimmed = value.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed);
  return (fenced?.[1] ?? trimmed).trim();
}

function parseJsonObject(text: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new IntakeHostedError('LLM', `${label} was not JSON`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new IntakeHostedError('LLM', `${label} was not a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function assertOk(response: IntakeHostedResponse, code: 'OCR' | 'LLM', label: string): IntakeHostedResponse {
  if (response.status < 200 || response.status >= 300) {
    const snippet = response.body.replace(/\s+/g, ' ').trim().slice(0, 200);
    throw new IntakeHostedError(
      code,
      `${label} failed (${String(response.status)})${snippet === '' ? '' : `: ${snippet}`}`,
    );
  }
  return response;
}

function readObject(response: IntakeHostedResponse, label: string): Record<string, unknown> {
  if (response.body.trim() === '') return {};
  return parseJsonObject(response.body, label);
}

function stringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== 'string') return [];
    const trimmed = item.trim();
    return trimmed === '' ? [] : [trimmed];
  });
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}
