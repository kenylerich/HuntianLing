/**
 * Hosted OCR and live-model intake extractor configuration.
 */

export interface IntakeConfig {
  readonly ocrUrl?: string;
  readonly llmUrl?: string;
  readonly llmModel?: string;
}

export interface IntakeHostedRequest {
  readonly method: 'POST';
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export interface IntakeHostedResponse {
  readonly status: number;
  readonly body: string;
}

export type IntakeHostedTransport = (request: IntakeHostedRequest) => IntakeHostedResponse;

export interface IntakeOcrAdapter {
  recognize(input: {
    readonly bytes: Uint8Array;
    readonly mimeType: string;
    readonly name: string;
  }): string;
}

export class IntakeHostedError extends Error {
  constructor(readonly code: 'OCR' | 'LLM' | 'VALIDATION', message: string) {
    super(message);
  }
}

export function resolveIntakeHostedEndpoints(
  config: IntakeConfig = {},
  env: NodeJS.ProcessEnv = {},
): {
  readonly ocrUrl: string | null;
  readonly llmUrl: string | null;
  readonly llmModel: string | null;
} {
  return {
    ocrUrl: firstNonBlank(config.ocrUrl, env.HUNTIANLING_OCR_URL),
    llmUrl: firstNonBlank(config.llmUrl, env.HUNTIANLING_INTAKE_LLM_URL),
    llmModel: firstNonBlank(config.llmModel, env.HUNTIANLING_INTAKE_LLM_MODEL),
  };
}

export function resolveIntakeOcrToken(requestToken: string | undefined, env: NodeJS.ProcessEnv): string {
  const fromRequest = requestToken?.trim();
  if (fromRequest !== undefined && fromRequest !== '') return fromRequest;
  const fromEnv = env.HUNTIANLING_OCR_TOKEN?.trim();
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv;
  throw new IntakeHostedError('OCR', 'hosted OCR token is required (HUNTIANLING_OCR_TOKEN)');
}

export function resolveIntakeLlmToken(requestToken: string | undefined, env: NodeJS.ProcessEnv): string {
  const fromRequest = requestToken?.trim();
  if (fromRequest !== undefined && fromRequest !== '') return fromRequest;
  const keys = ['HUNTIANLING_INTAKE_LLM_TOKEN', 'DEEPSEEK_API_KEY'] as const;
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value !== undefined && value !== '') return value;
  }
  throw new IntakeHostedError('LLM', `hosted intake llm token is required (request or ${keys.join('/')})`);
}

function firstNonBlank(...values: readonly (string | undefined)[]): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed !== undefined && trimmed !== '') return trimmed;
  }
  return null;
}
