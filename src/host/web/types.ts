import type { BoardViewQuery, WorkItemFilter } from '../board/types.js';
import type { ResolvedWebAuthConfig, WebAuthConfig } from './auth.js';

export interface WebConfig {
  readonly enabled?: boolean;
  readonly autoStart?: boolean;
  readonly host?: string;
  readonly port?: number;
  readonly publicUrl?: string;
  readonly writeToken?: string;
  readonly allowUnauthenticatedWrites?: boolean;
  readonly auth?: WebAuthConfig;
}

export interface ResolvedWebConfig {
  readonly enabled: boolean;
  readonly autoStart: boolean;
  readonly host: string;
  readonly port: number;
  readonly publicUrl: string | null;
  readonly writeToken: string | null;
  readonly allowUnauthenticatedWrites: boolean;
  readonly auth: ResolvedWebAuthConfig;
}

export interface WebStatus {
  readonly enabled: boolean;
  readonly running: boolean;
  readonly host: string;
  readonly port: number | null;
  readonly url: string | null;
  readonly externalWritable: boolean;
  readonly authRequired: boolean;
}

export interface WebDisplaySurface {
  readonly id: 'huntianling.board';
  readonly title: 'HuntianLing Board';
  readonly kind: 'browser';
  readonly url: string;
}

export interface WebService {
  start(): Promise<WebStatus>;
  stop(): Promise<void>;
  status(): WebStatus;
  url(): string | null;
  getSurface(): WebDisplaySurface | null;
  boardUrl(query?: BoardViewQuery | WorkItemFilter): string | null;
}
