// Diagnostic: exit 0 confirms the recorded defect, not customer acceptance.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createAgentRuntime } from '../../../lib/host/agents/runtime.js';
import { createBoardService } from '../../../lib/host/board/plugin.js';
import { createSkillService } from '../../../lib/host/skills/service.js';
import { createEnvironmentService } from '../../../lib/host/environment/service.js';
import { createDeliveryService } from '../../../lib/host/delivery/service.js';
import { createHarnessService } from '../../../lib/host/harness/service.js';
import { workItemDesignRevision, hasExecutedDeliveryEvidence } from '../../../lib/host/board/executed-evidence.js';

const mode = process.argv[2] ?? 'runtime';
const root = mkdtempSync(join(tmpdir(), 'htl-negative-'));
const board = createBoardService(root);
const skills = createSkillService();
const environment = createEnvironmentService({ skills, board });
const agents = createAgentRuntime({ skills, board, environment });
function makeStory() {
  const project = board.createProject({ name: 'audit' });
  const milestone = board.createMilestone({ projectId: project.id, title: 'M1' });
  const story = board.createWorkItem({ projectId: project.id, milestoneId: milestone.id,
    type: 'story', status: 'verifying', title: 'Customer login', body: 'Draft, not approved',
    analysis: 'Login is needed', design: 'Authenticate with password',
    acceptance: ['customer can log in'], sourceInput: '' });
  return { project, story };
}
function prepare(project) {
  const scripts = Object.fromEntries(['typecheck', 'test', 'doc-sync', 'lint', 'hygiene']
    .map(name => [name, `node -e "require('node:fs').appendFileSync('checks.log','${name}\\n')"`]));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'audit-app', type: 'module', scripts }));
  const prepared = environment.prepare({ workspaceRoot: root, projectId: project.id });
  assert.equal(prepared.ready, true, JSON.stringify(prepared.blockers));
  assert.match(readFileSync(join(root, 'checks.log'), 'utf8'), /typecheck\ntest/);
  return prepared;
}
function revision(ref) {
  return createHash('sha256').update(ref).update('\0').update(readFileSync(join(root, ref)))
    .update('\0').digest('hex').slice(0,16);
}
function deliver(story) {
  board.transitionWorkItem(story.id, 'delivered');
  const restored = createBoardService(root);
  assert.equal(restored.getWorkItem(story.id).status, 'delivered');
}
if (mode === 'forged') {
  const { story } = makeStory();
  assert.throws(() => board.transitionWorkItem(story.id, 'delivered'));
  board.updateDeliveryEvidenceSummary(story.id, {
    designRevision: workItemDesignRevision(story),
    checks: [{ id: 'fake', area: 'ci', title: 'unexecuted', status: 'passing', required: true,
      reason: 'fabricated', evidenceIds: ['ci:never-executed'], acceptanceCriterionIds: [], links: [],
      producer: 'ci', executionKind: 'executed', designRevision: workItemDesignRevision(story) }]
  });
  deliver(story);
  assert.equal(agents.listRuns().length, 0);
  assert.equal(existsSync(join(root, '.git')), false);
  console.log(JSON.stringify({ mode, root, persistedStatus: 'delivered', agentRuns: 0, gitRepository: false }));
} else if (mode === 'demo') {
  const harness = createHarnessService({ board, skills, agents, environment, workspaceRoot: root });
  const demo = harness.demonstrateSelfDevelopment();
  assert.equal(board.getWorkItem(demo.workItemId).status, 'delivered');
  assert.equal(board.listIntakeSessions().length, 0);
  const fresh = join(root, '.huntianling/demo-fresh');
  const pkg = JSON.parse(readFileSync(join(fresh, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.test, 'node -e "process.exit(0)"');
  const implementation = agents.listRuns().filter(r => r.agentId === 'generator');
  const candidates = implementation.map(r => readFileSync(join(fresh,r.output.artifactRefs[0]), 'utf8'));
  assert.equal(candidates.every(text => text.includes('verifiedMarkers')), true);
  assert.equal(existsSync(join(fresh, 'src')), false);
  const firstRef = implementation[0].output.artifactRefs[0];
  assert.match(readFileSync(join(fresh, firstRef), 'utf8'), /changed after generator self-check/);
  console.log(JSON.stringify({ mode, root, progress: demo.customerProgress, intakeSessions: 0,
    sourceDirectory: false, testCommand: pkg.scripts.test, candidateCount: candidates.length,
    selfDevelopmentRefs: demo.selfHarnessSliceRefs }));
} else {
  const { project, story } = makeStory();
  prepare(project);
  const logBefore = readFileSync(join(root, 'checks.log'), 'utf8');
  const delivery = createDeliveryService({ board, agents, environment, workspaceRoot: root });
  const started = delivery.start({ workItemId: story.id });
  delivery.advance(started.id);
  const implemented = delivery.advance(started.id);
  const ref = implemented.checkpoint.artifactRefs[0];
  if (mode === 'runtime') {
    const packageData = JSON.parse(readFileSync(join(root,'package.json'), 'utf8'));
    packageData.scripts.test = 'node -e "process.exit(23)"';
    packageData.scripts.typecheck = 'node -e "process.exit(24)"';
    writeFileSync(join(root,'package.json'), JSON.stringify(packageData));
    writeFileSync(join(root,ref), '// customer can log in\nthrow new Error("candidate cannot run");\n');
    const actual = spawnSync(process.execPath, [join(root,ref)], { cwd: root, encoding:'utf8' });
    assert.notEqual(actual.status,0);
    assert.match(actual.stderr, /candidate cannot run/);
    const run = agents.startRun({ agentId:'evaluator', executor:'huntianling-runtime', projectId:project.id,
      workItemId:story.id, workspaceRoot:root,
      input:{ acceptance:story.acceptance, artifactRefs:[ref], candidateRevision:revision(ref) } });
    assert.equal(run.output.decision, 'pass');
    assert.equal(readFileSync(join(root,'checks.log'),'utf8'),logBefore);
    assert.equal(existsSync(join(root,'.git')),false);
    deliver(story);
    console.log(JSON.stringify({mode,root,candidateExit:actual.status,checksUnchanged:true,persistedStatus:'delivered',
      selfCheck:implemented.checkpoint.decisions.implement.selfCheck,execution:run.execution}));
  } else if (mode === 'stale') {
    const done = delivery.drive(started.id);
    assert.equal(done.status,'completed');
    const before = revision(ref);
    writeFileSync(join(root,ref),'throw new Error("regression after evaluation");\n');
    assert.notEqual(revision(ref),before);
    const restored = createBoardService(root);
    assert.equal(hasExecutedDeliveryEvidence(restored.getDeliveryEvidenceSummary(story.id),restored.getWorkItem(story.id)),true);
    restored.transitionWorkItem(story.id,'delivered');
    assert.equal(createBoardService(root).getWorkItem(story.id).status,'delivered');
    console.log(JSON.stringify({mode,root,changedHash:true,persistedStatus:'delivered'}));
  } else if (mode === 'approval') {
    assert.equal(board.listIntakeSessions().length,0);
    assert.equal(board.listIntakeCandidates().length,0);
    assert.equal(story.sourceInput,'');
    const planner = agents.getRun(started.id) ?? agents.listRuns().find(r=>r.agentId==='planner');
    assert.equal(planner.input.confirmed,true);
    const done = delivery.drive(started.id);
    assert.equal(done.status,'completed');
    deliver(story);
    console.log(JSON.stringify({mode,root,intakeSessions:0,intakeCandidates:0,
      plannerInput:planner.input,persistedStatus:'delivered'}));
  } else throw new Error('unknown mode');
}
