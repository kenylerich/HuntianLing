/** Customer API access is limited to intake and customer-safe projections. */
export function isCustomerApiRequest(method: string, pathname: string): boolean {
  if (pathname === '/api/v1/issue-sync/catalog') return method === 'GET';
  if (pathname === '/api/v1/projects') return method === 'GET' || method === 'POST';
  if (/^\/api\/v1\/projects\/[^/]+\/customer-board$/.test(pathname)) return method === 'GET';
  if (/^\/api\/v1\/projects\/[^/]+\/intake\/sessions$/.test(pathname)) {
    return method === 'GET' || method === 'POST';
  }
  if (/^\/api\/v1\/intake\/sessions\/[^/]+$/.test(pathname)) return method === 'GET';
  if (/^\/api\/v1\/intake\/sessions\/[^/]+\/candidates$/.test(pathname)) return method === 'GET';
  if (/^\/api\/v1\/intake\/sessions\/[^/]+\/(messages|clarify|follow-ups|source-documents|analyze)$/.test(pathname)) {
    return method === 'POST';
  }
  return false;
}
