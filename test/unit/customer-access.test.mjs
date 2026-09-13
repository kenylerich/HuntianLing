import assert from 'node:assert/strict';
import test from 'node:test';
import { isCustomerApiRequest } from '../../lib/host/web/customer-access.js';
import { renderWorkflowLabPage } from '../../lib/host/web/pages/workflow-lab.js';

test('customer routes allow collection but not developer records or approvals', () => {
  for (const [method, path] of [
    ['GET', '/api/v1/issue-sync/catalog'],
    ['GET', '/api/v1/projects'], ['POST', '/api/v1/projects'],
    ['GET', '/api/v1/projects/p/customer-board'],
    ['GET', '/api/v1/projects/p/intake/sessions'], ['POST', '/api/v1/projects/p/intake/sessions'],
    ['GET', '/api/v1/intake/sessions/s'], ['GET', '/api/v1/intake/sessions/s/candidates'],
    ...['messages', 'clarify', 'follow-ups', 'source-documents', 'analyze']
      .map(action => ['POST', `/api/v1/intake/sessions/s/${action}`]),
  ]) assert.equal(isCustomerApiRequest(method, path), true, `${method} ${path}`);
  for (const path of [
    '/api/work-items', '/api/requirements/stories', '/api/v1/projects/p/developer-board',
    '/api/v1/projects/p/main-board', '/api/v1/projects/p/team/members',
    '/api/v1/projects/p/business-crud', '/api/v1/work-items/i/delivery-evidence',
    '/api/v1/intake/sessions/s/approve', '/api/v1/intake/candidates/c',
  ]) for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
    assert.equal(isCustomerApiRequest(method, path), false, `${method} ${path}`);
  }
  assert.equal(isCustomerApiRequest('PATCH', '/api/v1/intake/sessions/s'), false);
  assert.equal(isCustomerApiRequest('DELETE', '/api/v1/projects'), false);
});

test('Workflow Lab logout targets the shared session revocation route', () => {
  const html = renderWorkflowLabPage();
  assert.match(html, /await api\('\/api\/auth\/logout', \{ method: 'POST' \}\)/);
  assert.doesNotMatch(html, /\/api\/auth\/password\/logout/);
});
