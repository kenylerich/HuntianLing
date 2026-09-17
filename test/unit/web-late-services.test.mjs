import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createAgentRuntime } from '../../lib/host/agents/runtime.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createDeliveryService } from '../../lib/host/delivery/service.js';
import { createHarnessService } from '../../lib/host/harness/service.js';
import { createSkillService } from '../../lib/host/skills/service.js';
import { createWebService } from '../../lib/host/web/server.js';
import { approvedWorkItem } from '../helpers/approved-intake.mjs';

async function fixture(t, optionalServices = {}) {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-web-late-services-'));
  let web;
  t.after(async () => {
    await web?.stop();
    rmSync(root, { recursive: true, force: true });
  });
  const board = createBoardService(root);
  const project = board.createProject({ name: 'Late services' });
  const milestone = board.createMilestone({ projectId: project.id, title: 'M1' });
  const story = approvedWorkItem(board, {
    projectId: project.id,
    type: 'story',
    title: 'Customer can submit a request',
    body: 'Collect the customer request on the board.',
    analysis: 'The customer needs a request form.',
    design: 'Persist submitted requests as intake messages.',
    acceptance: ['The submitted request is visible on the board.'],
    milestoneId: milestone.id,
  });
  const skills = createSkillService();
  const deps = { board, requirements: createRequirementManagementService(board), skills };
  Object.defineProperties(deps, Object.getOwnPropertyDescriptors(optionalServices));
  web = createWebService(deps, {
    enabled: true,
    autoStart: false,
    host: '127.0.0.1',
    port: 0,
    auth: { enabled: false },
    allowUnauthenticatedWrites: true,
    writeToken: 'late-services-test-token',
  });
  const status = await web.start();
  assert.equal(status.running, true);
  assert.ok(status.port > 0);
  const url = `http://127.0.0.1:${status.port}`;
  async function request(path, body) {
    const response = await fetch(`${url}/api/v1${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        authorization: 'Bearer late-services-test-token',
        'content-type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30_000),
    });
    return { status: response.status, payload: await response.json() };
  }
  return { root, board, skills, story, request };
}

function assertUnavailable(result, service) {
  assert.equal(result.status, 400);
  assert.deepEqual(result.payload, { error: `huntianling.${service} is required` });
}

test('running Web reads agents, delivery and harness getters after registration and withdrawal', async (t) => {
  let currentAgents;
  let currentDelivery;
  let currentHarness;
  const { root, board, skills, story, request } = await fixture(t, {
    get agents() { return currentAgents; },
    get delivery() { return currentDelivery; },
    get harness() { return currentHarness; },
  });
  const planPath = `/work-items/${story.id}/plan`;
  const deliveryPath = `/work-items/${story.id}/story-delivery/start`;
  assertUnavailable(await request(planPath, { methodId: 'user-story' }), 'agents');
  assertUnavailable(await request(deliveryPath, { drive: false }), 'delivery');
  assertUnavailable(await request('/harness/comparisons', {}), 'harness');

  const agents = createAgentRuntime({ skills, board });
  const delivery = createDeliveryService({ board, agents, workspaceRoot: root });
  const harness = createHarnessService({ skills, board, agents, workspaceRoot: root });
  currentAgents = agents;
  currentDelivery = delivery;
  currentHarness = harness;

  const planned = await request(planPath, { methodId: 'user-story' });
  assert.equal(planned.status, 200);
  assert.equal(planned.payload.run.workItemId, story.id);
  assert.deepEqual(agents.getRun(planned.payload.run.id), planned.payload.run);
  assert.equal(agents.listRuns().length, 1);

  const started = await request(deliveryPath, { drive: false });
  assert.equal(started.status, 201);
  assert.equal(started.payload.workItemId, story.id);
  assert.deepEqual(delivery.get(started.payload.id), started.payload);
  assert.deepEqual(
    createDeliveryService({ board, agents, workspaceRoot: root }).get(started.payload.id),
    started.payload,
  );
  assert.deepEqual(started.payload.agentRunIds, []);
  const compared = await request('/harness/comparisons', {});
  assert.equal(compared.status, 201);
  assert.deepEqual(harness.listComparisons(), [compared.payload]);

  const agentRuns = structuredClone(agents.listRuns());
  const deliveryRuns = structuredClone(delivery.listForWorkItem(story.id));
  const comparisons = structuredClone(harness.listComparisons());
  currentAgents = undefined;
  currentDelivery = undefined;
  currentHarness = undefined;

  assertUnavailable(await request(planPath, { methodId: 'user-story' }), 'agents');
  assertUnavailable(await request(`/agent-runs/${planned.payload.run.id}/state-recognition`), 'agents');
  assertUnavailable(await request(deliveryPath, { drive: false }), 'delivery');
  assertUnavailable(await request(`/story-delivery-runs/${started.payload.id}`), 'delivery');
  assertUnavailable(await request(`/story-delivery-runs/${started.payload.id}/pause`, { reason: 'Service withdrawn' }), 'delivery');
  assertUnavailable(await request('/harness/comparisons', {}), 'harness');
  assertUnavailable(await request('/harness/comparisons'), 'harness');
  assert.deepEqual(agents.listRuns(), agentRuns);
  assert.deepEqual(delivery.listForWorkItem(story.id), deliveryRuns);
  assert.deepEqual(harness.listComparisons(), comparisons);
});

test('standalone Web without an agents property retains its factory runtime', async (t) => {
  const { story, request } = await fixture(t);
  const planned = await request(`/work-items/${story.id}/plan`, { methodId: 'user-story' });
  assert.equal(planned.status, 200);
  assert.equal(planned.payload.run.agentId, 'planner');
  assert.equal(planned.payload.run.workItemId, story.id);
  assert.equal(planned.payload.workItem.id, story.id);
  const recognized = await request(`/agent-runs/${planned.payload.run.id}/state-recognition`);
  assert.equal(recognized.status, 200);
  assert.deepEqual(recognized.payload.recognition, planned.payload.run.stateRecognition);
});
