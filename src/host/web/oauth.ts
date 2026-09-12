/**
 * OAuth/OIDC helpers. Client secrets stay in config/env, never in board records.
 */

import { createHash, randomBytes } from 'node:crypto';

export const OAUTH_PROVIDERS = ['google', 'github', 'wechat'] as const;
export type OAuthProviderId = (typeof OAUTH_PROVIDERS)[number];

export interface OAuthProfile {
  readonly subject: string;
  readonly unionid: string | null;
  readonly email: string | null;
  readonly profile: Readonly<Record<string, string>>;
}

export interface OAuthExchangeInput {
  readonly providerId: string;
  readonly kind: 'oauth' | 'oidc';
  readonly clientId: string;
  readonly clientSecret: string;
  readonly tokenEndpoint: string;
  readonly userinfoEndpoint: string;
  readonly redirectUri: string;
  readonly code: string;
  readonly codeVerifier: string | null;
}

export interface OAuthExchange {
  exchange(input: OAuthExchangeInput): Promise<OAuthProfile>;
}

export interface ResolvedOAuthProvider {
  readonly id: string;
  readonly label: string;
  readonly kind: 'oauth' | 'oidc';
  readonly enabled: boolean;
  readonly clientId: string | null;
  readonly clientSecret: string | null;
  readonly authorizationEndpoint: string | null;
  readonly tokenEndpoint: string | null;
  readonly userinfoEndpoint: string | null;
  readonly redirectUri: string | null;
  readonly scopes: readonly string[];
  readonly pkce: boolean;
}

export function createPkcePair(): { readonly verifier: string; readonly challenge: string } {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function createOAuthState(): string {
  return base64Url(randomBytes(24));
}

export function authorizationUrl(
  provider: ResolvedOAuthProvider,
  input: { readonly state: string; readonly redirectUri: string; readonly challenge: string | null },
): string {
  const endpoint = provider.authorizationEndpoint;
  if (endpoint === null || provider.clientId === null) {
    throw new Error(`oauth provider is not configured: ${provider.id}`);
  }
  const params = new URLSearchParams();
  if (provider.id === 'wechat') {
    params.set('appid', provider.clientId);
    params.set('redirect_uri', input.redirectUri);
    params.set('response_type', 'code');
    params.set('scope', provider.scopes.join(',') || 'snsapi_login');
    params.set('state', input.state);
    return `${endpoint}?${params.toString()}#wechat_redirect`;
  }
  params.set('client_id', provider.clientId);
  params.set('redirect_uri', input.redirectUri);
  params.set('response_type', 'code');
  params.set('scope', provider.scopes.join(' '));
  params.set('state', input.state);
  if (input.challenge !== null) {
    params.set('code_challenge', input.challenge);
    params.set('code_challenge_method', 'S256');
  }
  if (provider.kind === 'oidc') params.set('nonce', createOAuthState());
  return `${endpoint}?${params.toString()}`;
}

export const DEFAULT_OAUTH_ENDPOINTS: Readonly<Record<OAuthProviderId, {
  readonly authorizationEndpoint: string;
  readonly tokenEndpoint: string;
  readonly userinfoEndpoint: string;
  readonly scopes: readonly string[];
  readonly pkce: boolean;
  readonly kind: 'oauth' | 'oidc';
}>> = {
  google: {
    kind: 'oidc',
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    userinfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
    scopes: ['openid', 'email', 'profile'],
    pkce: true,
  },
  github: {
    kind: 'oauth',
    authorizationEndpoint: 'https://github.com/login/oauth/authorize',
    tokenEndpoint: 'https://github.com/login/oauth/access_token',
    userinfoEndpoint: 'https://api.github.com/user',
    scopes: ['read:user', 'user:email'],
    pkce: true,
  },
  wechat: {
    kind: 'oauth',
    authorizationEndpoint: 'https://open.weixin.qq.com/connect/qrconnect',
    tokenEndpoint: 'https://api.weixin.qq.com/sns/oauth2/access_token',
    userinfoEndpoint: 'https://api.weixin.qq.com/sns/userinfo',
    scopes: ['snsapi_login'],
    pkce: false,
  },
};

export function publicOAuthFields(provider: ResolvedOAuthProvider): {
  readonly id: string;
  readonly label: string;
  readonly kind: 'oauth' | 'oidc';
  readonly enabled: boolean;
  readonly loginUrl: string | null;
} {
  return {
    id: provider.id,
    label: provider.label,
    kind: provider.kind,
    enabled: provider.enabled,
    loginUrl: provider.enabled ? `/api/auth/oauth/${encodeURIComponent(provider.id)}/start` : null,
  };
}

function base64Url(bytes: Buffer): string {
  return bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
