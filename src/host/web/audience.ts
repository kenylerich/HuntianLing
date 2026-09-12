/**
 * Login audience and HTML shell paths for REQ-WEB-007.
 */

export const WEB_AUDIENCES = ['customer', 'developer', 'admin'] as const;

export type WebAuthAudience = (typeof WEB_AUDIENCES)[number];

export function isWebAuthAudience(value: unknown): value is WebAuthAudience {
  return value === 'customer' || value === 'developer' || value === 'admin';
}

export function resolveWebAuthAudience(value: unknown): WebAuthAudience {
  if (value === undefined || value === null) return 'developer';
  if (!isWebAuthAudience(value)) {
    throw new Error('auth audience must be customer, developer, or admin');
  }
  return value;
}

export function shellPathForAudience(audience: WebAuthAudience): string {
  return `/${audience}`;
}

export function audienceFromShellPath(pathname: string): WebAuthAudience | null {
  if (pathname === '/customer' || pathname === '/customer/') return 'customer';
  if (
    pathname === '/developer' ||
    pathname === '/developer/' ||
    pathname.startsWith('/developer/') ||
    pathname === '/board'
  ) {
    return 'developer';
  }
  if (pathname === '/admin' || pathname === '/admin/') return 'admin';
  return null;
}
