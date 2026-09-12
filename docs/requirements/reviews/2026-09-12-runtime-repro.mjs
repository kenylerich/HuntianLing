import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAgentRuntime } from '../../../lib/host/agents/runtime.js';
import { createBoardService } from '../../../lib/host/board/plugin.js';
import { hasExecutedDeliveryEvidence } from '../../../lib/host/board/executed-evidence.js';
import { createDeliveryService } from '../../../lib/host/delivery/service.js';
import { createEnvironmentService } from '../../../lib/host/environment/service.js';
import { createSkillService } from '../../../lib/host/skills/service.js';
import { customerProgressForWorkItemRecord } from '../../../lib/host/web/customer-progress.js';

// This diagnostic prints observations; its exit status does not certify delivery.
const root = mkdtempSync(join(tmpdir(), 'huntianling-runtime-review-'));
try {
  writeFileSync(join(root, 'package.json'), JSON.stringify({
    name: 'runtime-review-empty-project',
    scripts: { typecheck: 'exit 1', test: 'exit 1' },
  }));
  const board = createBoardService(root);
  const skills = createSkillService();
  const environment = createEnvironmentService({ skills, board });
  const prepared = environment.prepare({ workspaceRoot: root });
  const canStart = environment.canStartImplementation(root);
  const project = board.createProject({ name: 'Runtime review' });
  const milestone = board.createMilestone({ projectId: project.id, title: 'M1' });
  const story = board.createWorkItem({
    projectId: project.id,
    milestoneId: milestone.id,
    type: 'story',
    title: 'Login application',
    body: 'A customer needs to log in.',
    sourceInput: 'Build a login application.',
    analysis: 'The customer needs authenticated access.',
    design: 'Provide a login form and check credentials.',
    acceptance: ['A running application accepts valid credentials'],
  });
  const agents = createAgentRuntime({ skills, board, environment });
  const delivery = createDeliveryService({ board, agents, workspaceRoot: root });
  const run = delivery.start({ workItemId: story.id, environmentReady: true, drive: true });
  const generated = run.checkpoint.decisions.implement;
  const evaluated = run.checkpoint.decisions.evaluate;
  const evidence = board.listDeliveryEvidenceSummaries({ workItemId: story.id })[0];
  let transition = 'allowed';
  try {
    board.transitionWorkItem(story.id, 'delivered');
  } catch (error) {
    transition = `blocked: ${error instanceof Error ? error.message : String(error)}`;
  }
  console.log(JSON.stringify({
    defaultPrepareReady: prepared.ready,
    canStartDespiteFailingScripts: canStart,
    deliveryStatus: run.status,
    claimedFiles: generated?.files?.map(file => ({ file, exists: existsSync(join(root, file)) })),
    selfCheck: generated?.selfCheck,
    evaluator: evaluated,
    recognizedExecutedEvidence: hasExecutedDeliveryEvidence(evidence, story),
    transitionToDelivered: transition,
    customerProgress: customerProgressForWorkItemRecord(board.getWorkItem(story.id), evidence),
  }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
