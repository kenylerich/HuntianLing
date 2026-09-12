/**
 * Extract intake source text from PDF, Word, images, and plain documents.
 */

import { inflateRawSync, inflateSync } from 'node:zlib';

import type { IntakeSourceKind, IntakeSourceParseStatus } from '../board/types.js';
import type { IntakeOcrAdapter } from './types.js';

export type { IntakeOcrAdapter };

export interface ImageUnderstandingAdapter {
  understand(input: { readonly bytes: Uint8Array; readonly mimeType: string; readonly name: string }): string;
}

export interface IntakeExtractInput {
  readonly kind: IntakeSourceKind;
  readonly name: string;
  readonly mimeType?: string;
  readonly bytes?: Uint8Array;
  readonly extractedText?: string;
  readonly understanding?: string;
  readonly imageUnderstanding?: ImageUnderstandingAdapter;
  readonly ocr?: IntakeOcrAdapter;
}

export interface IntakeExtractResult {
  readonly text: string;
  readonly status: IntakeSourceParseStatus;
  readonly error: string;
}

export function extractStoredFile(input: {
  readonly mimeType: string;
  readonly bytes: Uint8Array;
  readonly extractedText?: string;
  readonly ocr?: IntakeOcrAdapter;
}): IntakeExtractResult {
  const mime = input.mimeType.toLowerCase();
  const kind: IntakeSourceKind = mime === 'application/pdf'
    ? 'pdf'
    : mime.includes('wordprocessingml') || mime === 'application/msword'
      ? 'word'
      : mime.startsWith('image/')
        ? 'image'
        : mime === 'text/markdown' || mime === 'text/x-markdown'
          ? 'markdown'
          : mime.startsWith('text/') || mime === 'application/json'
            ? 'plain-text'
            : 'file';
  return extractIntakeSource({
    kind,
    name: 'upload',
    mimeType: input.mimeType,
    bytes: input.bytes,
    ...(input.extractedText !== undefined ? { extractedText: input.extractedText } : {}),
    ...(input.ocr !== undefined ? { ocr: input.ocr } : {}),
  });
}

export function extractIntakeSource(input: IntakeExtractInput): IntakeExtractResult {
  const provided = (input.extractedText ?? '').trim();
  if (provided.length > 0) {
    return { text: provided, status: 'parsed', error: '' };
  }
  const understanding = (input.understanding ?? '').trim();
  if (understanding.length > 0) {
    return { text: understanding, status: 'parsed', error: '' };
  }
  const bytes = input.bytes;
  if (bytes === undefined || bytes.byteLength === 0) {
    if (input.kind === 'image' || input.kind === 'word' || input.kind === 'pdf') {
      return { text: '', status: 'pending', error: 'attachment bytes are required to extract text' };
    }
    if (input.kind === 'text' || input.kind === 'markdown' || input.kind === 'plain-text') {
      return { text: '', status: 'failed', error: 'plain-text attachment is empty' };
    }
    return { text: '', status: 'unsupported', error: `unsupported intake source kind: ${input.kind}` };
  }
  try {
    if (input.kind === 'pdf' || (input.mimeType ?? '').toLowerCase() === 'application/pdf') {
      const text = extractPdfText(bytes).trim();
      if (text.length > 0) {
        return { text, status: 'parsed', error: '' };
      }
      const ocrText = recognizeWithOcr(input, bytes);
      if (ocrText !== undefined) {
        return { text: ocrText, status: 'parsed', error: '' };
      }
      return { text: '', status: 'failed', error: 'PDF contained no extractable text' };
    }
    if (input.kind === 'word' || isWordMime(input.mimeType)) {
      const text = extractDocxText(bytes).trim();
      if (text.length === 0) {
        return { text: '', status: 'failed', error: 'Word document contained no extractable text' };
      }
      return { text, status: 'parsed', error: '' };
    }
    if (input.kind === 'image' || (input.mimeType ?? '').toLowerCase().startsWith('image/')) {
      if (input.imageUnderstanding !== undefined) {
        const text = input.imageUnderstanding.understand({
          bytes,
          mimeType: input.mimeType ?? '',
          name: input.name,
        }).trim();
        if (text.length === 0) {
          return { text: '', status: 'failed', error: 'image understanding returned no text' };
        }
        return { text, status: 'parsed', error: '' };
      }
      if ((input.mimeType ?? '').toLowerCase() === 'image/svg+xml' || input.name.toLowerCase().endsWith('.svg')) {
        const text = stripXml(new TextDecoder().decode(bytes)).trim();
        if (text.length === 0) {
          return { text: '', status: 'failed', error: 'SVG contained no extractable text' };
        }
        return { text, status: 'parsed', error: '' };
      }
      const ocrText = recognizeWithOcr(input, bytes);
      if (ocrText !== undefined) {
        return { text: ocrText, status: 'parsed', error: '' };
      }
      return { text: '', status: 'pending', error: 'image understanding or OCR is required' };
    }
    if (input.kind === 'text' || input.kind === 'markdown' || input.kind === 'plain-text') {
      const text = new TextDecoder().decode(bytes).trim();
      if (text.length === 0) {
        return { text: '', status: 'failed', error: 'plain-text attachment is empty' };
      }
      return { text, status: 'parsed', error: '' };
    }
    return { text: '', status: 'unsupported', error: `unsupported intake source kind: ${input.kind}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'extraction failed';
    return { text: '', status: 'failed', error: message };
  }
}

function recognizeWithOcr(input: IntakeExtractInput, bytes: Uint8Array): string | undefined {
  if (input.ocr === undefined) return undefined;
  const text = input.ocr.recognize({
    bytes,
    mimeType: input.mimeType ?? '',
    name: input.name,
  }).trim();
  if (text.length === 0) {
    throw new Error('OCR returned no text');
  }
  return text;
}

function isWordMime(mimeType: string | undefined): boolean {
  const mime = (mimeType ?? '').toLowerCase();
  return mime.includes('wordprocessingml') || mime === 'application/msword';
}

export function extractPdfText(bytes: Uint8Array): string {
  const source = Buffer.from(bytes).toString('latin1');
  const texts: string[] = [];
  const streamPattern = /stream\r?\n([\s\S]*?)endstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamPattern.exec(source)) !== null) {
    const header = source.slice(Math.max(0, match.index - 240), match.index);
    const payload = Buffer.from(match[1] ?? '', 'latin1');
    let decoded = match[1] ?? '';
    if (/\/FlateDecode/.test(header)) {
      decoded = inflatePdf(payload);
    }
    texts.push(...pdfStrings(decoded));
  }
  texts.push(...pdfStrings(source));
  return uniqueJoin(texts);
}

function inflatePdf(payload: Buffer): string {
  try {
    return inflateSync(payload).toString('latin1');
  } catch {
    try {
      return inflateSync(payload.subarray(0, Math.max(0, payload.length - 1))).toString('latin1');
    } catch {
      return payload.toString('latin1');
    }
  }
}

function pdfStrings(source: string): readonly string[] {
  const found: string[] = [];
  const pattern = /\((?:\\.|[^\\)])*\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const raw = match[0]?.slice(1, -1) ?? '';
    const text = decodePdfString(unescapePdf(raw)).trim();
    if (text.length > 0) found.push(text);
  }
  return found;
}

function decodePdfString(value: string): string {
  const bytes = Buffer.from(value, 'latin1');
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return value;
  }
}

function unescapePdf(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}

export function extractDocxText(bytes: Uint8Array): string {
  const xml = readZipEntry(bytes, 'word/document.xml');
  if (xml === undefined) {
    throw new Error('Word document is missing word/document.xml');
  }
  return stripXml(new TextDecoder().decode(xml));
}

function readZipEntry(bytes: Uint8Array, path: string): Uint8Array | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  while (offset + 30 <= bytes.byteLength) {
    if (view.getUint32(offset, true) !== 0x04034b50) break;
    const method = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLength));
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.byteLength) break;
    const data = bytes.subarray(dataStart, dataEnd);
    if (name === path) {
      if (method === 0) return data;
      if (method === 8) return new Uint8Array(inflateRawSync(data));
      throw new Error(`unsupported ZIP compression method ${String(method)}`);
    }
    offset = dataEnd;
  }
  return undefined;
}

function stripXml(xml: string): string {
  return xml
    .replace(/<w:tab\b[^>]*\/>/g, ' ')
    .replace(/<w:br\b[^>]*\/>/g, '\n')
    .replace(/<w:p\b[^>]*>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function uniqueJoin(values: readonly string[]): string {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    ordered.push(trimmed);
  }
  return ordered.join('\n');
}
