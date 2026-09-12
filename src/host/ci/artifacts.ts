/**
 * Classify and parse JUnit, coverage, SARIF, and Playwright CI artifacts.
 */

export type CiArtifactKind = 'junit' | 'coverage' | 'sarif' | 'playwright' | 'log' | 'other';

export interface ParsedJunit {
  readonly kind: 'junit';
  readonly tests: number;
  readonly failures: number;
  readonly errors: number;
}

export interface ParsedCoverage {
  readonly kind: 'coverage';
  readonly percent: number;
  readonly hit: number;
  readonly total: number;
}

export interface ParsedSarif {
  readonly kind: 'sarif';
  readonly errors: number;
  readonly warnings: number;
  readonly findings: readonly { readonly ruleId: string; readonly level: string; readonly message: string }[];
}

export interface ParsedPlaywright {
  readonly kind: 'playwright';
  readonly expected: number;
  readonly unexpected: number;
  readonly skipped: number;
}

export type ParsedCiArtifact = ParsedJunit | ParsedCoverage | ParsedSarif | ParsedPlaywright;

export function classifyArtifact(name: string, content: string): CiArtifactKind {
  const lower = name.toLowerCase();
  if (lower.includes('playwright')) return 'playwright';
  if (lower.includes('sarif') || lower.endsWith('.sarif')) return 'sarif';
  if (lower.includes('junit') || lower.includes('surefire') || (lower.endsWith('.xml') && content.includes('<testsuite'))) {
    return 'junit';
  }
  if (
    lower.includes('coverage')
    || lower.includes('lcov')
    || lower.includes('cobertura')
    || lower.includes('clover')
  ) {
    return 'coverage';
  }
  if (content.includes('<testsuite') || content.includes('<testsuites')) return 'junit';
  if (looksLikeSarif(content)) return 'sarif';
  if (looksLikePlaywright(content)) return 'playwright';
  if (looksLikeCoverage(content)) return 'coverage';
  if (lower.includes('log')) return 'log';
  return 'other';
}

export function parseCiArtifact(name: string, content: string): ParsedCiArtifact | null {
  const kind = classifyArtifact(name, content);
  if (kind === 'junit') return parseJunit(content);
  if (kind === 'coverage') return parseCoverage(content);
  if (kind === 'sarif') return parseSarif(content);
  if (kind === 'playwright') return parsePlaywright(content);
  return null;
}

function parseJunit(xml: string): ParsedJunit | null {
  if (!xml.includes('<testsuite') && !xml.includes('<testsuites')) return null;
  const suites = xml.includes('<testsuites')
    ? attributeNumber(xml, 'testsuites', 'tests')
    : null;
  const tests = suites ?? attributeNumber(xml, 'testsuite', 'tests') ?? countTags(xml, 'testcase');
  const failures = attributeNumber(xml, 'testsuites', 'failures')
    ?? attributeNumber(xml, 'testsuite', 'failures')
    ?? countTags(xml, 'failure');
  const errors = attributeNumber(xml, 'testsuites', 'errors')
    ?? attributeNumber(xml, 'testsuite', 'errors')
    ?? countTags(xml, 'error');
  return { kind: 'junit', tests, failures, errors };
}

function parseCoverage(text: string): ParsedCoverage | null {
  const lineRate = /line-rate="([0-9.]+)"/.exec(text);
  if (lineRate?.[1] !== undefined) {
    const percent = Number(lineRate[1]) * 100;
    if (!Number.isFinite(percent)) return null;
    return { kind: 'coverage', percent, hit: 0, total: 0 };
  }
  const lf = [...text.matchAll(/^LF:(\d+)\s*$/gm)].map((row) => Number(row[1]));
  const lh = [...text.matchAll(/^LH:(\d+)\s*$/gm)].map((row) => Number(row[1]));
  if (lf.length > 0 && lh.length > 0) {
    const total = lf.reduce((sum, value) => sum + value, 0);
    const hit = lh.reduce((sum, value) => sum + value, 0);
    const percent = total === 0 ? 0 : (hit / total) * 100;
    return { kind: 'coverage', percent, hit, total };
  }
  const json = parseJson(text);
  const pct = json !== null ? istanbulPercent(json) : undefined;
  if (pct !== undefined) return { kind: 'coverage', percent: pct, hit: 0, total: 0 };
  return null;
}

function parseSarif(text: string): ParsedSarif | null {
  const json = parseJson(text);
  if (json === null) return null;
  const runs = json.runs;
  if (!Array.isArray(runs)) return null;
  const findings: { ruleId: string; level: string; message: string }[] = [];
  for (const run of runs) {
    if (run === null || typeof run !== 'object' || Array.isArray(run)) continue;
    const results = (run as Record<string, unknown>).results;
    if (!Array.isArray(results)) continue;
    for (const result of results) {
      if (result === null || typeof result !== 'object' || Array.isArray(result)) continue;
      const row = result as Record<string, unknown>;
      const message = row.message;
      const textValue = message !== null && typeof message === 'object' && !Array.isArray(message)
        ? stringField((message as Record<string, unknown>).text)
        : stringField(message);
      findings.push({
        ruleId: stringField(row.ruleId) ?? 'unknown',
        level: stringField(row.level) ?? 'warning',
        message: textValue ?? '',
      });
    }
  }
  return {
    kind: 'sarif',
    errors: findings.filter((row) => row.level === 'error').length,
    warnings: findings.filter((row) => row.level !== 'error').length,
    findings,
  };
}

function parsePlaywright(text: string): ParsedPlaywright | null {
  const json = parseJson(text);
  if (json === null) return null;
  const stats = json.stats;
  if (stats !== null && typeof stats === 'object' && !Array.isArray(stats)) {
    const row = stats as Record<string, unknown>;
    return {
      kind: 'playwright',
      expected: numberField(row.expected) ?? 0,
      unexpected: numberField(row.unexpected) ?? 0,
      skipped: numberField(row.skipped) ?? 0,
    };
  }
  if (Array.isArray(json.suites)) {
    return { kind: 'playwright', expected: 0, unexpected: 0, skipped: 0 };
  }
  return null;
}

function looksLikeSarif(content: string): boolean {
  const json = parseJson(content);
  return json !== null && Array.isArray(json.runs);
}

function looksLikePlaywright(content: string): boolean {
  const json = parseJson(content);
  if (json === null) return false;
  if (json.stats !== null && typeof json.stats === 'object') return true;
  return Array.isArray(json.suites);
}

function looksLikeCoverage(content: string): boolean {
  return content.includes('\nLF:') || content.includes('line-rate="') || istanbulPercent(parseJson(content) ?? {}) !== undefined;
}

function istanbulPercent(json: Record<string, unknown>): number | undefined {
  const total = json.total;
  if (total === null || typeof total !== 'object' || Array.isArray(total)) return undefined;
  const lines = (total as Record<string, unknown>).lines;
  if (lines === null || typeof lines !== 'object' || Array.isArray(lines)) return undefined;
  return numberField((lines as Record<string, unknown>).pct);
}

function attributeNumber(xml: string, tag: string, attr: string): number | null {
  const match = new RegExp(`<${tag}\\b[^>]*\\b${attr}="(\\d+)"`, 'i').exec(xml);
  if (match?.[1] === undefined) return null;
  return Number(match[1]);
}

function countTags(xml: string, tag: string): number {
  return [...xml.matchAll(new RegExp(`<${tag}\\b`, 'gi'))].length;
}

function parseJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function numberField(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
