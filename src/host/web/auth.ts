/**
 * Web authentication for the browser surface and HTTP APIs.
 *
 * The first implementation is process-local. It verifies configured password
 * hashes, issues short-lived session cookies, and stores API tokens as hashes.
 */

import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { DatabaseService } from '../database/types.js';
import {
  resolveWebAuthAudience,
  shellPathForAudience,
  type WebAuthAudience,
} from './audience.js';
import type { ProjectId } from '../board/types.js';
import {
  assertPasswordHashFormat,
  createPasswordHash,
  createPbkdf2PasswordHash,
  resolvePasswordHashConfig,
  verifyPasswordHash,
  type PasswordAlgorithm,
  type ResolvedPasswordHashConfig,
} from './password.js';
import {
  authorizationUrl,
  createOAuthState,
  createPkcePair,
  DEFAULT_OAUTH_ENDPOINTS,
  publicOAuthFields,
  type OAuthExchange,
  type OAuthProfile,
  type ResolvedOAuthProvider,
} from './oauth.js';

export {
  createPasswordHash,
  createPbkdf2PasswordHash,
  verifyPasswordHash,
} from './password.js';

export type { WebAuthAudience } from './audience.js';

export type WebAuthRegion = 'cn' | 'global' | 'auto';
export type WebAuthUserRegion = Exclude<WebAuthRegion, 'auto'>;
export type WebAuthPrincipalKind = 'session' | 'api-token' | 'static-token';

export interface WebAuthProviderConfig {
  readonly id: string;
  readonly label?: string;
  readonly kind?: 'oauth' | 'oidc';
  readonly enabled?: boolean;
  readonly loginUrl?: string;
  readonly clientId?: string;
  readonly clientSecret?: string;
  readonly authorizationEndpoint?: string;
  readonly tokenEndpoint?: string;
  readonly userinfoEndpoint?: string;
  readonly redirectUri?: string;
  readonly scopes?: readonly string[];
  readonly pkce?: boolean;
}

export interface WebAuthProvider {
  readonly id: string;
  readonly label: string;
  readonly kind: 'oauth' | 'oidc';
  readonly enabled: boolean;
  readonly loginUrl: string | null;
}

export interface WebAuthRegionHosts {
  readonly cn?: readonly string[];
  readonly global?: readonly string[];
}

export interface OAuthIdentity {
  readonly id: string;
  readonly userId: string;
  readonly provider: string;
  readonly subject: string;
  readonly unionid: string | null;
  readonly email: string | null;
  readonly profile: Readonly<Record<string, string>>;
  readonly createdAt: number;
}

interface PendingOAuth {
  readonly state: string;
  readonly providerId: string;
  readonly region: WebAuthUserRegion;
  readonly redirectUri: string;
  readonly codeVerifier: string | null;
  readonly bindUserId: string | null;
  readonly createdAt: number;
}

export interface WebAuthUserConfig {
  readonly username: string;
  readonly displayName?: string;
  readonly passwordHash: string;
  readonly roles?: readonly string[];
  readonly projectIds?: readonly ProjectId[];
  readonly region?: WebAuthUserRegion;
  readonly audience?: WebAuthAudience;
}

export interface WebAuthConfig {
  readonly enabled?: boolean;
  readonly sessionTtlMs?: number;
  readonly apiTokenTtlMs?: number | null;
  readonly regionMode?: WebAuthRegion;
  readonly regionHosts?: WebAuthRegionHosts;
  readonly users?: readonly WebAuthUserConfig[];
  readonly providers?: Partial<Record<WebAuthUserRegion, readonly WebAuthProviderConfig[]>>;
  readonly passwordAlgorithm?: PasswordAlgorithm;
  readonly argon2Memory?: number;
  readonly argon2Passes?: number;
  readonly argon2Parallelism?: number;
  readonly bcryptCost?: number;
  readonly pbkdf2Iterations?: number;
}

export interface ResolvedWebAuthUser {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly passwordHash: string;
  readonly roles: readonly string[];
  readonly projectIds: readonly ProjectId[];
  readonly region: WebAuthUserRegion | null;
  readonly audience: WebAuthAudience;
}

export interface ResolvedWebAuthConfig {
  readonly enabled: boolean;
  readonly sessionTtlMs: number;
  readonly apiTokenTtlMs: number | null;
  readonly regionMode: WebAuthRegion;
  readonly regionHosts: { readonly cn: readonly string[]; readonly global: readonly string[] };
  readonly users: readonly ResolvedWebAuthUser[];
  readonly providers: Record<WebAuthUserRegion, readonly ResolvedOAuthProvider[]>;
  readonly password: ResolvedPasswordHashConfig;
}

export interface CredentialRecord {
  readonly username: string;
  readonly passwordHash: string;
  readonly algorithm: PasswordAlgorithm;
  readonly enabled: boolean;
  readonly rotatedAt: number | null;
  readonly disabledAt: number | null;
  readonly updatedAt: number;
}

export interface WebAuthPrincipal {
  readonly kind: WebAuthPrincipalKind;
  readonly userId: string;
  readonly username: string;
  readonly displayName: string;
  readonly roles: readonly string[];
  readonly projectIds: readonly ProjectId[];
  readonly region: WebAuthUserRegion | null;
  readonly audience: WebAuthAudience;
  readonly tokenId: string | null;
}

export interface WebAuthSession {
  readonly id: string;
  readonly user: WebAuthPrincipal;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly region: WebAuthUserRegion;
}

export interface WebApiToken {
  readonly id: string;
  readonly name: string;
  readonly user: WebAuthPrincipal;
  readonly prefix: string;
  readonly createdAt: number;
  readonly expiresAt: number | null;
  readonly lastUsedAt: number | null;
}

interface StoredSession {
  readonly id: string;
  readonly secretHash: string;
  readonly user: ResolvedWebAuthUser;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly region: WebAuthUserRegion;
}

interface StoredApiToken {
  readonly id: string;
  readonly secretHash: string;
  readonly name: string;
  readonly user: ResolvedWebAuthUser;
  readonly prefix: string;
  readonly createdAt: number;
  readonly expiresAt: number | null;
  lastUsedAt: number | null;
}

interface StoredCredential {
  passwordHash: string;
  enabled: boolean;
  rotatedAt: number | null;
  disabledAt: number | null;
}

const AUTH_COOKIE = 'huntianling_session';
const AUTH_COOKIE_PATH = '/';
const HASH_ALGORITHM = 'sha256';

const PROVIDERS: Record<WebAuthUserRegion, readonly WebAuthProvider[]> = {
  cn: [
    {
      id: 'wechat',
      label: 'WeChat',
      kind: 'oauth',
      enabled: false,
      loginUrl: null,
    },
  ],
  global: [
    {
      id: 'google',
      label: 'Google',
      kind: 'oidc',
      enabled: false,
      loginUrl: null,
    },
    {
      id: 'github',
      label: 'GitHub',
      kind: 'oauth',
      enabled: false,
      loginUrl: null,
    },
  ],
};

export interface AuthAuditEvent {
  readonly id: string;
  readonly actorId: string;
  readonly action: string;
  readonly targetId: string;
  readonly requestSource: string;
  readonly reason: string;
  readonly region: WebAuthUserRegion | null;
  readonly createdAt: number;
}

export class WebAuthManager {
  private readonly usersByName: Map<string, ResolvedWebAuthUser>;
  private readonly sessions = new Map<string, StoredSession>();
  private readonly apiTokens = new Map<string, StoredApiToken>();
  private readonly extraProjectIds = new Map<string, Set<ProjectId>>();
  private readonly audienceOverrides = new Map<string, WebAuthAudience>();
  private readonly credentials = new Map<string, StoredCredential>();
  private readonly authEvents: AuthAuditEvent[] = [];
  private readonly identities: OAuthIdentity[] = [];
  private readonly oauthStates = new Map<string, PendingOAuth>();
  private readonly database: DatabaseService | undefined;
  private readonly oauthExchange: OAuthExchange | undefined;

  constructor(
    readonly config: ResolvedWebAuthConfig,
    database?: DatabaseService,
    options: { readonly oauthExchange?: OAuthExchange } = {},
  ) {
    this.usersByName = new Map(config.users.map((user) => [user.username, user]));
    this.database = database;
    this.oauthExchange = options.oauthExchange;
    for (const user of config.users) {
      const stored = database?.getCredential(user.username);
      this.credentials.set(user.username, {
        passwordHash: stored?.passwordHash ?? user.passwordHash,
        enabled: stored?.enabled ?? true,
        rotatedAt: stored?.rotatedAt ?? null,
        disabledAt: stored?.disabledAt ?? null,
      });
    }
    for (const stored of database?.listAuthUsers() ?? []) {
      if (this.usersByName.has(stored.username)) continue;
      const credential = database?.getCredential(stored.username);
      this.usersByName.set(stored.username, {
        id: stored.username,
        username: stored.username,
        displayName: stored.displayName,
        passwordHash: credential?.passwordHash ?? '',
        roles: [],
        projectIds: stored.projectIds as ProjectId[],
        region: null,
        audience: resolveWebAuthAudience(stored.audience),
      });
      if (credential !== undefined) this.credentials.set(stored.username, {
        passwordHash: credential.passwordHash,
        enabled: credential.enabled,
        rotatedAt: credential.rotatedAt,
        disabledAt: credential.disabledAt,
      });
    }
    for (const event of database?.listAuthEvents(200) ?? []) {
      this.authEvents.push({
        ...event,
        region: event.region === 'cn' || event.region === 'global' ? event.region : null,
      });
    }
    for (const identity of database?.listOAuthIdentities() ?? []) {
      this.identities.push(identity);
    }
  }

  grantProjectAccess(userId: string, projectId: ProjectId): void {
    const current = this.extraProjectIds.get(userId) ?? new Set<ProjectId>();
    current.add(projectId);
    this.extraProjectIds.set(userId, current);
  }

  revokeProjectAccess(userId: string, projectId: ProjectId): void {
    this.extraProjectIds.get(userId)?.delete(projectId);
  }

  setAudience(userId: string, audience: WebAuthAudience): void {
    this.audienceOverrides.set(userId, resolveWebAuthAudience(audience));
  }

  listDirectory(): readonly {
    readonly username: string;
    readonly displayName: string;
    readonly audience: WebAuthAudience;
    readonly projectIds: readonly ProjectId[];
  }[] {
    return [...this.usersByName.values()].map((user) => ({
      username: user.username,
      displayName: user.displayName,
      audience: this.audienceOverrides.get(user.id) ?? user.audience,
      projectIds: this.projectIdsFor(user),
    }));
  }

  createDirectoryUser(input: {
    readonly username: string;
    readonly password: string;
    readonly audience: WebAuthAudience;
    readonly displayName?: string;
    readonly projectIds?: readonly ProjectId[];
  }): {
    readonly username: string;
    readonly displayName: string;
    readonly audience: WebAuthAudience;
    readonly projectIds: readonly ProjectId[];
  } {
    const username = input.username.trim();
    if (username === '') throw new AuthHttpError(400, 'username is required');
    if (input.password.trim() === '') throw new AuthHttpError(400, 'password is required');
    if (this.usersByName.has(username)) throw new AuthHttpError(409, `user already exists: ${username}`);
    const passwordHash = createPasswordHash(input.password, {
      algorithm: this.config.password.algorithm,
      argon2Memory: this.config.password.argon2Memory,
      argon2Passes: this.config.password.argon2Passes,
      argon2Parallelism: this.config.password.argon2Parallelism,
      bcryptCost: this.config.password.bcryptCost,
      iterations: this.config.password.pbkdf2Iterations,
    });
    const user: ResolvedWebAuthUser = {
      id: username,
      username,
      displayName: input.displayName?.trim() || username,
      passwordHash,
      roles: [],
      projectIds: [...(input.projectIds ?? [])],
      region: null,
      audience: resolveWebAuthAudience(input.audience),
    };
    this.usersByName.set(username, user);
    this.writeCredential(username, {
      passwordHash,
      enabled: true,
      rotatedAt: null,
      disabledAt: null,
    });
    this.database?.upsertAuthUser({
      username,
      displayName: user.displayName,
      audience: user.audience,
      projectIds: user.projectIds,
      createdAt: Date.now(),
    });
    this.recordAuthEvent({
      actorId: username,
      action: 'auth.user.created',
      targetId: username,
      requestSource: 'admin',
      reason: `audience ${user.audience}`,
    });
    return {
      username,
      displayName: user.displayName,
      audience: user.audience,
      projectIds: user.projectIds,
    };
  }

  listAuthEvents(): readonly AuthAuditEvent[] {
    return [...this.authEvents].sort((left, right) => right.createdAt - left.createdAt);
  }

  accessSettings(): {
    readonly enabled: boolean;
    readonly regionMode: WebAuthRegion;
    readonly sessionTtlMs: number;
  } {
    return {
      enabled: this.config.enabled,
      regionMode: this.config.regionMode,
      sessionTtlMs: this.config.sessionTtlMs,
    };
  }

  private projectIdsFor(user: ResolvedWebAuthUser): readonly ProjectId[] {
    const extra = this.extraProjectIds.get(user.id);
    if (extra === undefined || extra.size === 0) return user.projectIds;
    return [...new Set([...user.projectIds, ...extra])];
  }

  providers(region: WebAuthRegion | null = null, host: string | null = null): {
    readonly region: WebAuthUserRegion;
    readonly mode: WebAuthRegion;
    readonly providers: readonly WebAuthProvider[];
  } {
    const selected = this.selectRegion(region, host);
    return {
      region: selected,
      mode: this.config.regionMode,
      providers: this.config.providers[selected].map(publicOAuthFields),
    };
  }

  login(input: {
    readonly username: string;
    readonly password: string;
    readonly region?: WebAuthRegion | null;
    readonly host?: string | null;
  }): { readonly session: WebAuthSession; readonly cookie: string } {
    if (!this.config.enabled) throw new AuthHttpError(404, 'authentication is disabled');
    const username = input.username.trim();
    const user = this.usersByName.get(username);
    const credential = username === '' ? undefined : this.credentials.get(username);
    if (user === undefined || credential === undefined || !verifyPasswordHash(input.password, credential.passwordHash)) {
      this.recordAuthEvent({
        actorId: username === '' ? 'unknown' : username,
        action: 'auth.login_failed',
        targetId: username === '' ? 'unknown' : username,
        requestSource: 'password',
        reason: 'invalid username or password',
      });
      throw new AuthHttpError(401, 'invalid username or password');
    }
    if (!credential.enabled) {
      throw new AuthHttpError(403, 'credential is disabled');
    }
    const region = this.selectRegion(input.region ?? user.region ?? null, input.host ?? null);
    if (user.region !== null && user.region !== region) {
      throw new AuthHttpError(403, 'login region is not allowed for this user');
    }
    const secret = createSecret('hls');
    const now = Date.now();
    const stored: StoredSession = {
      id: randomUUID(),
      secretHash: hashSecret(secret),
      user,
      createdAt: now,
      expiresAt: now + this.config.sessionTtlMs,
      region,
    };
    this.sessions.set(stored.secretHash, stored);
    this.recordAuthEvent({
      actorId: user.username,
      action: 'auth.login',
      targetId: user.username,
      requestSource: 'password',
      reason: `audience ${user.audience}`,
      region,
    });
    return {
      session: this.sessionView(stored),
      cookie: sessionCookie(secret, this.config.sessionTtlMs),
    };
  }

  logout(req: IncomingMessage): string {
    const secret = cookieValue(req, AUTH_COOKIE);
    if (secret !== null) {
      const stored = this.sessions.get(hashSecret(secret));
      this.sessions.delete(hashSecret(secret));
      if (stored !== undefined) {
        this.recordAuthEvent({
          actorId: stored.user.username,
          action: 'auth.logout',
          targetId: stored.user.username,
          requestSource: 'session',
          reason: 'logout',
        });
      }
    }
    return expiredSessionCookie();
  }

  currentSession(req: IncomingMessage): WebAuthSession | null {
    const secret = cookieValue(req, AUTH_COOKIE);
    if (secret === null) return null;
    const stored = this.sessions.get(hashSecret(secret));
    if (stored === undefined) return null;
    if (stored.expiresAt <= Date.now()) {
      this.sessions.delete(stored.secretHash);
      return null;
    }
    return this.sessionView(stored);
  }

  private sessionView(stored: StoredSession): WebAuthSession {
    const session = publicSession(stored);
    const extra = this.extraProjectIds.get(session.user.userId);
    const audience = this.audienceOverrides.get(session.user.userId) ?? session.user.audience;
    const projectIds = extra === undefined || extra.size === 0
      ? session.user.projectIds
      : [...new Set([...session.user.projectIds, ...extra])];
    if (audience === session.user.audience && extra === undefined) return session;
    return {
      ...session,
      user: {
        ...session.user,
        audience,
        projectIds,
      },
    };
  }

  authenticate(req: IncomingMessage, staticWriteToken: string | null): WebAuthPrincipal | null {
    const session = this.currentSession(req);
    if (session !== null) return session.user;
    const bearer = bearerToken(req);
    if (bearer !== null) {
      const apiToken = this.authenticateApiToken(bearer);
      if (apiToken !== null) return apiToken;
      if (staticWriteToken !== null && bearer === staticWriteToken) return staticTokenPrincipal();
    }
    const header = staticTokenHeader(req);
    if (staticWriteToken !== null && header === staticWriteToken) return staticTokenPrincipal();
    return null;
  }

  createApiToken(req: IncomingMessage, input: { readonly name: string }): {
    readonly token: string;
    readonly apiToken: WebApiToken;
  } {
    const session = this.requireSession(req);
    const name = input.name.trim();
    if (name === '') throw new AuthHttpError(400, 'token name must be a non-empty string');
    const token = createSecret('hlt');
    const now = Date.now();
    const expiresAt = this.config.apiTokenTtlMs === null ? null : now + this.config.apiTokenTtlMs;
    const stored: StoredApiToken = {
      id: randomUUID(),
      secretHash: hashSecret(token),
      name,
      user: session.user,
      prefix: token.slice(0, 12),
      createdAt: now,
      expiresAt,
      lastUsedAt: null,
    };
    this.apiTokens.set(stored.id, stored);
    this.recordAuthEvent({
      actorId: session.user.username,
      action: 'auth.api_token.created',
      targetId: stored.id,
      requestSource: 'api-token',
      reason: name,
    });
    return { token, apiToken: publicApiToken(stored) };
  }

  listApiTokens(req: IncomingMessage): readonly WebApiToken[] {
    const session = this.requireSession(req);
    this.purgeExpiredApiTokens();
    return [...this.apiTokens.values()]
      .filter((token) => token.user.id === session.user.id)
      .map((token) => publicApiToken(token));
  }

  deleteApiToken(req: IncomingMessage, tokenId: string): boolean {
    const session = this.requireSession(req);
    const existing = this.apiTokens.get(tokenId);
    if (existing === undefined) return false;
    if (existing.user.id !== session.user.id) throw new AuthHttpError(403, 'api token access denied');
    return this.apiTokens.delete(tokenId);
  }

  private authenticateApiToken(secret: string): WebAuthPrincipal | null {
    this.purgeExpiredApiTokens();
    const secretHash = hashSecret(secret);
    for (const token of this.apiTokens.values()) {
      if (!sameSecret(token.secretHash, secretHash)) continue;
      token.lastUsedAt = Date.now();
      return publicPrincipal(token.user, 'api-token', token.id);
    }
    return null;
  }

  private requireSession(req: IncomingMessage): StoredSession {
    const secret = cookieValue(req, AUTH_COOKIE);
    if (secret === null) throw new AuthHttpError(401, 'session authentication required');
    const stored = this.sessions.get(hashSecret(secret));
    if (stored === undefined || stored.expiresAt <= Date.now()) {
      if (stored !== undefined) this.sessions.delete(stored.secretHash);
      throw new AuthHttpError(401, 'session authentication required');
    }
    return stored;
  }

  private purgeExpiredApiTokens(): void {
    const now = Date.now();
    for (const [id, token] of this.apiTokens.entries()) {
      if (token.expiresAt !== null && token.expiresAt <= now) this.apiTokens.delete(id);
    }
  }

  credentialStatus(username: string): CredentialRecord | undefined {
    const user = this.usersByName.get(username);
    const credential = this.credentials.get(username);
    if (user === undefined || credential === undefined) return undefined;
    return {
      username,
      passwordHash: credential.passwordHash,
      algorithm: assertPasswordHashFormat(credential.passwordHash),
      enabled: credential.enabled,
      rotatedAt: credential.rotatedAt,
      disabledAt: credential.disabledAt,
      updatedAt: credential.rotatedAt ?? credential.disabledAt ?? 0,
    };
  }

  rotatePassword(req: IncomingMessage, input: { readonly currentPassword: string; readonly newPassword: string }): CredentialRecord {
    const session = this.requireSession(req);
    const username = session.user.username;
    const credential = this.credentials.get(username);
    if (credential === undefined || !verifyPasswordHash(input.currentPassword, credential.passwordHash)) {
      throw new AuthHttpError(401, 'invalid username or password');
    }
    if (!credential.enabled) {
      throw new AuthHttpError(403, 'credential is disabled');
    }
    if (input.newPassword === '') {
      throw new AuthHttpError(400, 'password must be non-empty');
    }
    const passwordHash = createPasswordHash(input.newPassword, {
      algorithm: this.config.password.algorithm,
      argon2Memory: this.config.password.argon2Memory,
      argon2Passes: this.config.password.argon2Passes,
      argon2Parallelism: this.config.password.argon2Parallelism,
      bcryptCost: this.config.password.bcryptCost,
      iterations: this.config.password.pbkdf2Iterations,
    });
    this.writeCredential(username, {
      passwordHash,
      enabled: true,
      rotatedAt: Date.now(),
      disabledAt: null,
    });
    const status = this.credentialStatus(username);
    if (status === undefined) throw new AuthHttpError(404, 'credential not found');
    return status;
  }

  setCredentialEnabled(username: string, enabled: boolean): CredentialRecord {
    const user = this.usersByName.get(username);
    const credential = this.credentials.get(username);
    if (user === undefined || credential === undefined) {
      throw new AuthHttpError(404, 'credential not found');
    }
    const now = Date.now();
    this.writeCredential(username, {
      passwordHash: credential.passwordHash,
      enabled,
      rotatedAt: credential.rotatedAt,
      disabledAt: enabled ? null : now,
    });
    if (!enabled) this.revokeSessionsFor(username);
    const status = this.credentialStatus(username);
    if (status === undefined) throw new AuthHttpError(404, 'credential not found');
    return status;
  }

  startOAuth(input: {
    readonly providerId: string;
    readonly region?: WebAuthRegion | null;
    readonly host?: string | null;
    readonly origin: string;
    readonly bindUserId?: string | null;
  }): { readonly authorizationUrl: string; readonly state: string } {
    if (!this.config.enabled) throw new AuthHttpError(404, 'authentication is disabled');
    const region = this.selectRegion(input.region ?? null, input.host ?? null);
    const provider = this.providerFor(input.providerId, region);
    if (!provider.enabled || provider.clientId === null || provider.authorizationEndpoint === null) {
      throw new AuthHttpError(400, `oauth provider is not configured: ${input.providerId}`);
    }
    const state = createOAuthState();
    const pkce = provider.pkce ? createPkcePair() : null;
    const redirectUri = provider.redirectUri
      ?? `${input.origin}/api/auth/oauth/${encodeURIComponent(provider.id)}/callback`;
    this.oauthStates.set(state, {
      state,
      providerId: provider.id,
      region,
      redirectUri,
      codeVerifier: pkce?.verifier ?? null,
      bindUserId: input.bindUserId ?? null,
      createdAt: Date.now(),
    });
    this.database?.upsertOAuthState({
      state,
      providerId: provider.id,
      region,
      redirectUri,
      codeVerifier: pkce?.verifier ?? null,
      bindUserId: input.bindUserId ?? null,
      createdAt: Date.now(),
    });
    return {
      authorizationUrl: authorizationUrl(provider, {
        state,
        redirectUri,
        challenge: pkce?.challenge ?? null,
      }),
      state,
    };
  }

  async completeOAuth(input: {
    readonly providerId: string;
    readonly code: string;
    readonly state: string;
  }): Promise<{ readonly session: WebAuthSession; readonly cookie: string; readonly identity: OAuthIdentity }> {
    if (!this.config.enabled) throw new AuthHttpError(404, 'authentication is disabled');
    if (input.code.trim() === '' || input.state.trim() === '') {
      throw new AuthHttpError(400, 'oauth code and state are required');
    }
    const pending = this.takeOAuthState(input.state);
    if (pending === undefined || pending.providerId !== input.providerId) {
      throw new AuthHttpError(400, 'invalid oauth state');
    }
    if (Date.now() - pending.createdAt > 10 * 60 * 1000) {
      throw new AuthHttpError(400, 'oauth state expired');
    }
    const provider = this.providerFor(pending.providerId, pending.region);
    if (provider.clientId === null || provider.clientSecret === null || provider.tokenEndpoint === null || provider.userinfoEndpoint === null) {
      throw new AuthHttpError(400, `oauth provider is not configured: ${provider.id}`);
    }
    if (this.oauthExchange === undefined) {
      throw new AuthHttpError(503, 'oauth exchange is not configured');
    }
    const profile = await this.oauthExchange.exchange({
      providerId: provider.id,
      kind: provider.kind,
      clientId: provider.clientId,
      clientSecret: provider.clientSecret,
      tokenEndpoint: provider.tokenEndpoint,
      userinfoEndpoint: provider.userinfoEndpoint,
      redirectUri: pending.redirectUri,
      code: input.code,
      codeVerifier: pending.codeVerifier,
    });
    const user = this.userForOAuth(provider.id, profile, pending.bindUserId, pending.region);
    const identity = this.upsertIdentity(user.id, provider.id, profile);
    const issued = this.issueSession(user, pending.region, `oauth:${provider.id}`);
    this.recordAuthEvent({
      actorId: user.username,
      action: 'auth.login',
      targetId: identity.subject,
      requestSource: `oauth:${provider.id}`,
      reason: `bound ${provider.id}`,
      region: pending.region,
    });
    return { ...issued, identity };
  }

  unlinkOAuth(req: IncomingMessage, providerId: string): OAuthIdentity {
    const session = this.requireSession(req);
    const identity = this.identities.find((row) => row.userId === session.user.id && row.provider === providerId);
    if (identity === undefined) throw new AuthHttpError(404, `oauth identity not bound: ${providerId}`);
    this.identities.splice(this.identities.indexOf(identity), 1);
    this.database?.deleteOAuthIdentity(identity.id);
    this.recordAuthEvent({
      actorId: session.user.username,
      action: 'auth.oauth_unlinked',
      targetId: identity.subject,
      requestSource: `oauth:${providerId}`,
      reason: `unlinked ${providerId}`,
      region: session.region,
    });
    return identity;
  }

  listIdentities(userId: string): readonly OAuthIdentity[] {
    return this.identities.filter((row) => row.userId === userId);
  }

  private providerFor(providerId: string, region: WebAuthUserRegion): ResolvedOAuthProvider {
    const provider = this.config.providers[region].find((item) => item.id === providerId)
      ?? [...this.config.providers.cn, ...this.config.providers.global].find((item) => item.id === providerId);
    if (provider === undefined) throw new AuthHttpError(404, `unknown oauth provider: ${providerId}`);
    return provider;
  }

  private takeOAuthState(state: string): PendingOAuth | undefined {
    const memory = this.oauthStates.get(state);
    this.oauthStates.delete(state);
    if (memory !== undefined) {
      this.database?.deleteOAuthState(state);
      return memory;
    }
    const stored = this.database?.takeOAuthState(state);
    if (stored === undefined) return undefined;
    return {
      state: stored.state,
      providerId: stored.providerId,
      region: stored.region === 'cn' ? 'cn' : 'global',
      redirectUri: stored.redirectUri,
      codeVerifier: stored.codeVerifier,
      bindUserId: stored.bindUserId,
      createdAt: stored.createdAt,
    };
  }

  private userForOAuth(
    providerId: string,
    profile: OAuthProfile,
    bindUserId: string | null,
    region: WebAuthUserRegion,
  ): ResolvedWebAuthUser {
    if (bindUserId !== null) {
      const bound = [...this.usersByName.values()].find((user) => user.id === bindUserId);
      if (bound === undefined) throw new AuthHttpError(401, 'oauth bind requires a signed-in user');
      return bound;
    }
    const existing = this.identities.find((row) => row.provider === providerId && row.subject === profile.subject);
    if (existing !== undefined) {
      const user = [...this.usersByName.values()].find((item) => item.id === existing.userId);
      if (user !== undefined) return user;
    }
    if (profile.email !== null) {
      const byEmail = [...this.usersByName.values()].find((user) => user.username === profile.email);
      if (byEmail !== undefined) return byEmail;
    }
    const username = profile.email ?? `${providerId}-${profile.subject}`;
    const user: ResolvedWebAuthUser = {
      id: username,
      username,
      displayName: profile.profile['name'] ?? username,
      passwordHash: '',
      roles: [],
      projectIds: [],
      region,
      audience: 'developer',
    };
    this.usersByName.set(username, user);
    this.database?.upsertAuthUser({
      username,
      displayName: user.displayName,
      audience: user.audience,
      projectIds: [],
      createdAt: Date.now(),
    });
    return user;
  }

  private upsertIdentity(userId: string, provider: string, profile: OAuthProfile): OAuthIdentity {
    const existing = this.identities.find((row) => row.provider === provider && row.subject === profile.subject);
    if (existing !== undefined) {
      const next: OAuthIdentity = {
        ...existing,
        userId,
        unionid: profile.unionid,
        email: profile.email,
        profile: profile.profile,
      };
      this.identities.splice(this.identities.indexOf(existing), 1, next);
      this.database?.upsertOAuthIdentity(next);
      return next;
    }
    const identity: OAuthIdentity = {
      id: randomUUID(),
      userId,
      provider,
      subject: profile.subject,
      unionid: profile.unionid,
      email: profile.email,
      profile: profile.profile,
      createdAt: Date.now(),
    };
    this.identities.push(identity);
    this.database?.upsertOAuthIdentity(identity);
    return identity;
  }

  private issueSession(
    user: ResolvedWebAuthUser,
    region: WebAuthUserRegion,
    requestSource: string,
  ): { readonly session: WebAuthSession; readonly cookie: string } {
    const secret = createSecret('hls');
    const now = Date.now();
    const stored: StoredSession = {
      id: randomUUID(),
      secretHash: hashSecret(secret),
      user,
      createdAt: now,
      expiresAt: now + this.config.sessionTtlMs,
      region,
    };
    this.sessions.set(stored.secretHash, stored);
    void requestSource;
    return {
      session: this.sessionView(stored),
      cookie: sessionCookie(secret, this.config.sessionTtlMs),
    };
  }

  private recordAuthEvent(input: {
    readonly actorId: string;
    readonly action: string;
    readonly targetId: string;
    readonly requestSource: string;
    readonly reason: string;
    readonly region?: WebAuthUserRegion | null;
  }): void {
    const event: AuthAuditEvent = {
      id: randomUUID(),
      actorId: input.actorId,
      action: input.action,
      targetId: input.targetId,
      requestSource: input.requestSource,
      reason: input.reason,
      region: input.region ?? null,
      createdAt: Date.now(),
    };
    this.authEvents.push(event);
    this.database?.recordAuthEvent(event);
  }

  private writeCredential(username: string, credential: StoredCredential): void {
    this.credentials.set(username, credential);
    this.database?.upsertCredential({
      username,
      passwordHash: credential.passwordHash,
      algorithm: assertPasswordHashFormat(credential.passwordHash),
      enabled: credential.enabled,
      rotatedAt: credential.rotatedAt,
      disabledAt: credential.disabledAt,
      updatedAt: Date.now(),
    });
  }

  private revokeSessionsFor(username: string): void {
    for (const [key, stored] of this.sessions.entries()) {
      if (stored.user.username === username) this.sessions.delete(key);
    }
  }

  private selectRegion(requested: WebAuthRegion | null, host: string | null = null): WebAuthUserRegion {
    if (requested !== null && requested !== 'auto') return requested;
    if (this.config.regionMode !== 'auto') return this.config.regionMode;
    return inferRegionFromHost(host, this.config.regionHosts) ?? 'global';
  }
}

export function inferRegionFromHost(
  host: string | null | undefined,
  hosts: { readonly cn: readonly string[]; readonly global: readonly string[] },
): WebAuthUserRegion | null {
  if (host === undefined || host === null || host.trim() === '') return null;
  const name = host.split(':')[0]?.toLowerCase() ?? '';
  if (name === '') return null;
  if (hosts.cn.some((item) => name === item || name.endsWith(`.${item}`))) return 'cn';
  if (hosts.global.some((item) => name === item || name.endsWith(`.${item}`))) return 'global';
  if (name.endsWith('.cn')) return 'cn';
  if (name.endsWith('.com') || name.endsWith('.dev') || name.endsWith('.io')) return 'global';
  return null;
}

export function publicCredentialStatus(record: CredentialRecord): Omit<CredentialRecord, 'passwordHash'> {
  return {
    username: record.username,
    algorithm: record.algorithm,
    enabled: record.enabled,
    rotatedAt: record.rotatedAt,
    disabledAt: record.disabledAt,
    updatedAt: record.updatedAt,
  };
}

export class AuthHttpError extends Error {
  constructor(readonly statusCode: number, message: string) {
    super(message);
  }
}

export function createWebAuthManager(
  input: WebAuthConfig = {},
  env: NodeJS.ProcessEnv = process.env,
): WebAuthManager {
  return new WebAuthManager(resolveWebAuthConfig(input, env));
}

export function resolveWebAuthConfig(
  input: WebAuthConfig = {},
  env: NodeJS.ProcessEnv = process.env,
): ResolvedWebAuthConfig {
  const users = input.users ?? parseUsers(env.HUNTIANLING_WEB_AUTH_USERS_JSON);
  return {
    enabled: input.enabled ?? parseBoolean(env.HUNTIANLING_WEB_AUTH_ENABLED) ?? false,
    sessionTtlMs:
      input.sessionTtlMs ?? parsePositiveInteger(env.HUNTIANLING_WEB_AUTH_SESSION_TTL_MS) ?? 8 * 60 * 60 * 1000,
    apiTokenTtlMs:
      input.apiTokenTtlMs ??
      parseNullablePositiveInteger(env.HUNTIANLING_WEB_AUTH_API_TOKEN_TTL_MS) ??
      90 * 24 * 60 * 60 * 1000,
    regionMode:
      input.regionMode ??
      parseRegion(env.HUNTIANLING_WEB_AUTH_REGION_MODE) ??
      'auto',
    regionHosts: {
      cn: [...(input.regionHosts?.cn ?? [])],
      global: [...(input.regionHosts?.global ?? [])],
    },
    users: normalizeUsers(users ?? []),
    providers: {
      cn: normalizeProviders(input.providers?.cn, PROVIDERS.cn),
      global: normalizeProviders(input.providers?.global, PROVIDERS.global),
    },
    password: resolvePasswordHashConfig({
      ...(input.passwordAlgorithm !== undefined ? { algorithm: input.passwordAlgorithm } : {}),
      ...(input.argon2Memory !== undefined ? { argon2Memory: input.argon2Memory } : {}),
      ...(input.argon2Passes !== undefined ? { argon2Passes: input.argon2Passes } : {}),
      ...(input.argon2Parallelism !== undefined ? { argon2Parallelism: input.argon2Parallelism } : {}),
      ...(input.bcryptCost !== undefined ? { bcryptCost: input.bcryptCost } : {}),
      ...(input.pbkdf2Iterations !== undefined ? { iterations: input.pbkdf2Iterations } : {}),
    }),
  };
}

export function writeAuthCookie(res: ServerResponse, value: string): void {
  res.setHeader('set-cookie', value);
}

export function projectAccessAllowed(
  principal: WebAuthPrincipal | null,
  projectId: ProjectId,
): boolean {
  if (principal === null) return true;
  if (principal.audience === 'customer') {
    return principal.projectIds.includes(projectId);
  }
  return principal.projectIds.length === 0 || principal.projectIds.includes(projectId);
}

function normalizeUsers(users: readonly WebAuthUserConfig[]): readonly ResolvedWebAuthUser[] {
  const seen = new Set<string>();
  return users.map((user) => {
    const username = user.username.trim();
    if (username === '') throw new Error('auth username must be non-empty');
    if (seen.has(username)) throw new Error(`duplicate auth username: ${username}`);
    seen.add(username);
    assertPasswordHashFormat(user.passwordHash);
    return {
      id: username,
      username,
      displayName: user.displayName?.trim() || username,
      passwordHash: user.passwordHash,
      roles: [...(user.roles ?? [])],
      projectIds: [...(user.projectIds ?? [])],
      region: user.region ?? null,
      audience: resolveWebAuthAudience(user.audience),
    };
  });
}

function normalizeProviders(
  configured: readonly WebAuthProviderConfig[] | undefined,
  fallback: readonly WebAuthProvider[],
): readonly ResolvedOAuthProvider[] {
  const source = configured ?? fallback.map((item) => fallbackProviderConfig(item));
  return source.map((provider) => resolveConfiguredProvider(provider));
}

function fallbackProviderConfig(item: WebAuthProvider): WebAuthProviderConfig {
  return {
    id: item.id,
    label: item.label,
    kind: item.kind,
    enabled: item.enabled,
  };
}

function resolveConfiguredProvider(provider: WebAuthProviderConfig): ResolvedOAuthProvider {
  const id = provider.id.trim();
  if (id === '') throw new Error('auth provider id must be non-empty');
  const defaults = id === 'google' || id === 'github' || id === 'wechat'
    ? DEFAULT_OAUTH_ENDPOINTS[id]
    : undefined;
  const clientId = provider.clientId?.trim() || null;
  const clientSecret = provider.clientSecret?.trim() || null;
  return {
    id,
    label: provider.label?.trim() || id,
    kind: provider.kind ?? defaults?.kind ?? 'oauth',
    enabled: provider.enabled ?? clientId !== null,
    clientId,
    clientSecret,
    authorizationEndpoint: provider.authorizationEndpoint?.trim() || defaults?.authorizationEndpoint || null,
    tokenEndpoint: provider.tokenEndpoint?.trim() || defaults?.tokenEndpoint || null,
    userinfoEndpoint: provider.userinfoEndpoint?.trim() || defaults?.userinfoEndpoint || null,
    redirectUri: provider.redirectUri?.trim() || null,
    scopes: provider.scopes ?? defaults?.scopes ?? [],
    pkce: provider.pkce ?? defaults?.pkce ?? true,
  };
}

function publicSession(stored: StoredSession): WebAuthSession {
  return {
    id: stored.id,
    user: publicPrincipal(stored.user, 'session', null),
    createdAt: stored.createdAt,
    expiresAt: stored.expiresAt,
    region: stored.region,
  };
}

function publicApiToken(stored: StoredApiToken): WebApiToken {
  return {
    id: stored.id,
    name: stored.name,
    user: publicPrincipal(stored.user, 'api-token', stored.id),
    prefix: stored.prefix,
    createdAt: stored.createdAt,
    expiresAt: stored.expiresAt,
    lastUsedAt: stored.lastUsedAt,
  };
}

function publicPrincipal(
  user: ResolvedWebAuthUser,
  kind: WebAuthPrincipalKind,
  tokenId: string | null,
): WebAuthPrincipal {
  return {
    kind,
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    roles: user.roles,
    projectIds: user.projectIds,
    region: user.region,
    audience: user.audience,
    tokenId,
  };
}

function staticTokenPrincipal(): WebAuthPrincipal {
  return {
    kind: 'static-token',
    userId: 'static-token',
    username: 'static-token',
    displayName: 'Static API token',
    roles: ['api'],
    projectIds: [],
    region: null,
    audience: 'developer',
    tokenId: null,
  };
}

function createSecret(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString('base64url')}`;
}

function hashSecret(secret: string): string {
  return createHash(HASH_ALGORITHM).update(secret, 'utf8').digest('base64url');
}

function sameSecret(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function bearerToken(req: IncomingMessage): string | null {
  const authorization = req.headers.authorization;
  if (authorization === undefined || !authorization.startsWith('Bearer ')) return null;
  const value = authorization.slice('Bearer '.length).trim();
  return value === '' ? null : value;
}

function staticTokenHeader(req: IncomingMessage): string | null {
  const rawHeader = req.headers['x-huntianling-token'];
  const value = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  return value === undefined || value.trim() === '' ? null : value.trim();
}

function cookieValue(req: IncomingMessage, name: string): string | null {
  const header = req.headers.cookie;
  if (header === undefined) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(index + 1).trim());
  }
  return null;
}

function sessionCookie(secret: string, ttlMs: number): string {
  const maxAge = Math.max(1, Math.floor(ttlMs / 1000));
  return `${AUTH_COOKIE}=${encodeURIComponent(secret)}; Path=${AUTH_COOKIE_PATH}; HttpOnly; SameSite=Lax; Max-Age=${String(maxAge)}`;
}

function expiredSessionCookie(): string {
  return `${AUTH_COOKIE}=; Path=${AUTH_COOKIE_PATH}; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function parseUsers(value: string | undefined): readonly WebAuthUserConfig[] | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed) || !parsed.every(isUserConfig)) {
    throw new Error('HUNTIANLING_WEB_AUTH_USERS_JSON must be a JSON array of auth users');
  }
  return parsed;
}

function isUserConfig(value: unknown): value is WebAuthUserConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { readonly username?: unknown }).username === 'string' &&
    typeof (value as { readonly passwordHash?: unknown }).passwordHash === 'string'
  );
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`invalid positive integer: ${value}`);
  return parsed;
}

function parseNullablePositiveInteger(value: string | undefined): number | null | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  if (value.trim().toLowerCase() === 'null') return null;
  return parsePositiveInteger(value);
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') return false;
  throw new Error(`invalid boolean value: ${value}`);
}

function parseRegion(value: string | undefined): WebAuthRegion | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const normalized = value.trim();
  if (normalized === 'cn' || normalized === 'global' || normalized === 'auto') return normalized;
  throw new Error(`invalid auth region mode: ${value}`);
}
