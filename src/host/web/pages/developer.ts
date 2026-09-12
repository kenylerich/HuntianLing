/**
 * Developer shell: Collect, Design, Progress, Channel, Environment.
 */

export function renderDeveloperPage(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>开发界面 · HuntianLing</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #f4f6f8; color: #1f2933; }
    header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1.25rem; background: #fff; border-bottom: 1px solid #d8e1e7; }
    nav { display: flex; gap: 0.5rem; padding: 0.75rem 1.25rem; }
    nav button { padding: 0.4rem 0.75rem; }
    nav button[aria-current="page"] { font-weight: 700; }
    main { display: grid; grid-template-columns: 1fr 18rem; gap: 1rem; padding: 1rem 1.25rem; }
    section, aside { background: #fff; border: 1px solid #d8e1e7; border-radius: 8px; padding: 1rem; }
    .item { border-top: 1px solid #e4ebf0; padding: 0.6rem 0; cursor: pointer; }
    .muted { color: #60717f; font-size: 0.85rem; }
    label { display: grid; gap: 0.25rem; margin: 0.5rem 0; font-size: 0.9rem; }
    textarea, input, select, button { font: inherit; padding: 0.35rem 0.5rem; }
    textarea { min-height: 4rem; width: 100%; box-sizing: border-box; }
  </style>
</head>
<body>
  <header>
    <h1>开发界面</h1>
    <div>
      <label>项目 <select id="project-select"></select></label>
      <span id="who" class="muted"></span>
      <button id="logout" type="button">退出</button>
    </div>
  </header>
  <nav aria-label="开发工作">
    <button type="button" data-job="collect">收集</button>
    <button type="button" data-job="design">设计</button>
    <button type="button" data-job="progress">进度</button>
    <button type="button" data-job="channel">频道</button>
    <button type="button" data-job="environment">环境</button>
  </nav>
  <main>
    <section>
      <h2 id="job-title">收集</h2>
      <div id="canvas"></div>
    </section>
    <aside>
      <h2>详情</h2>
      <div id="inspector" class="muted">选择一条记录</div>
    </aside>
  </main>
  <script>
    const jobs = {
      collect: '收集',
      design: '设计',
      progress: '进度',
      channel: '频道',
      environment: '环境',
    };
    const state = { job: jobFromPath(), projectId: '', board: null, conversationId: '' };

    function $(id) { return document.getElementById(id); }
    function jobFromPath() {
      const part = location.pathname.split('/')[2];
      return jobs[part] ? part : 'collect';
    }
    async function api(path, options = {}) {
      const response = await fetch(path, {
        ...options,
        headers: { 'content-type': 'application/json', ...(options.headers || {}) },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || response.statusText);
      return payload;
    }
    function setJob(job) {
      state.job = job;
      history.replaceState({}, '', '/developer/' + job);
      for (const button of document.querySelectorAll('nav [data-job]')) {
        button.setAttribute('aria-current', button.getAttribute('data-job') === job ? 'page' : 'false');
      }
      $('job-title').textContent = jobs[job];
      $('inspector').textContent = '选择一条记录';
      renderCanvas();
    }
    async function loadProjects() {
      const session = await api('/api/auth/session');
      if (session.auth && session.auth.enabled && !session.authenticated) {
        location.assign('/login');
        return;
      }
      if (session.principal) $('who').textContent = session.principal.displayName;
      const payload = await api('/api/v1/projects');
      const select = $('project-select');
      select.innerHTML = '';
      for (const project of payload.projects || []) {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        select.append(option);
      }
      state.projectId = select.value || state.projectId;
      if (state.projectId) select.value = state.projectId;
    }
    async function loadBoard() {
      if (!state.projectId) return;
      state.board = await api('/api/v1/projects/' + encodeURIComponent(state.projectId) + '/developer-board');
      renderCanvas();
    }
    function renderCanvas() {
      const canvas = $('canvas');
      canvas.innerHTML = '';
      if (!state.board && state.job !== 'environment') {
        canvas.textContent = '选择一个项目。';
        return;
      }
      if (state.job === 'collect') {
        for (const item of state.board.collect.requirements) {
          const row = document.createElement('div');
          row.className = 'item';
          row.textContent = item.title + ' · ' + item.progress;
          canvas.append(row);
        }
        return;
      }
      if (state.job === 'design') {
        for (const item of state.board.design.items) {
          const row = document.createElement('div');
          row.className = 'item';
          row.textContent = item.title;
          row.onclick = () => showDesign(item);
          canvas.append(row);
        }
        return;
      }
      if (state.job === 'progress') {
        for (const item of state.board.progress.items) {
          const row = document.createElement('div');
          row.className = 'item';
          row.textContent = item.title + ' · ' + item.progress;
          row.onclick = () => showProgress(item);
          canvas.append(row);
        }
        return;
      }
      if (state.job === 'channel') {
        canvas.innerHTML = '<p class="muted">开发者与 Agent 的类型化协作，不是客户对话框。</p><button id="open-channel" type="button">打开频道会话</button><div id="channel-log"></div>';
        $('open-channel').onclick = openChannel;
        return;
      }
      canvas.innerHTML = '<button id="prepare-env" type="button">检查环境</button> <button id="compare-depth" type="button">比较 Skill 深度</button> <button id="self-demo" type="button">自身开发演示</button> <button id="draft-skill" type="button">起草 Skill</button><pre id="env-log"></pre>';
      $('prepare-env').onclick = prepareEnv;
      $('compare-depth').onclick = compareDepth;
      $('self-demo').onclick = selfDemo;
      $('draft-skill').onclick = draftSkill;
    }
    function showDesign(item) {
      const inspector = $('inspector');
      inspector.innerHTML = '';
      const analysis = field('分析', 'analysis', item.analysis);
      const design = field('设计', 'design', item.design);
      const acceptance = field('验收', 'acceptance', (item.acceptance || []).join('\\n'));
      const save = document.createElement('button');
      save.textContent = '保存';
      save.onclick = async () => {
        await api('/api/work-items/' + encodeURIComponent(item.id), {
          method: 'PATCH',
          body: JSON.stringify({
            analysis: analysis.value,
            design: design.value,
            acceptance: acceptance.value.split('\\n').filter(Boolean),
          }),
        });
        await loadBoard();
      };
      inspector.append(analysis.label, design.label, acceptance.label, save);
    }
    function showProgress(item) {
      const inspector = $('inspector');
      inspector.innerHTML = '';
      const heading = document.createElement('p');
      heading.textContent = item.title + ' · ' + item.progress + (item.stale ? ' · 证据已过期' : '');
      const agent = panel(
        'Agent 反馈',
        (item.agentFeedback || []).map((row) =>
          (row.agentId || row.title || 'agent') + ' · ' + row.status
          + (row.summary ? ' · ' + row.summary : '')
          + (row.runId ? ' · run ' + row.runId : '')
          + ((row.skillVersions || []).length ? ' · skills ' + row.skillVersions.join(',') : '')
          + ((row.openQuestions || []).length ? ' · 问题 ' + row.openQuestions.join(',') : '')
          + ((row.decisions || []).length ? ' · 决策 ' + row.decisions.join(',') : '')
          + ((row.blockers || []).length ? ' · 阻塞 ' + row.blockers.join(',') : '')
          + ((row.missingEvidence || []).length ? ' · 缺证据 ' + row.missingEvidence.join(',') : '')
          + ((row.nextActions || []).length ? ' · 下一步 ' + row.nextActions.join(',') : '')
        ).join('\\n') || '尚无 Agent 反馈',
      );
      const leases = panel(
        '资源租约',
        (item.leases || []).map((lease) =>
          lease.resourceType + ' ' + lease.resourceId + ' · ' + lease.mode + ' · ' + lease.ownerId
        ).join('\\n') || '没有活动租约',
      );
      const names = Object.fromEntries(((state.board && state.board.teamMembers) || []).map((member) => [member.id, member.displayName]));
      const participants = panel(
        '参与者',
        '负责人 ' + (item.assignee ? (names[item.assignee] || item.assignee) : '无')
          + ' · 评审 ' + ((item.reviewerIds || []).map((id) => names[id] || id).join(',') || '无')
          + ' · 审批 ' + ((item.approverIds || []).map((id) => names[id] || id).join(',') || '无')
          + ' · 关注 ' + ((item.watcherIds || []).map((id) => names[id] || id).join(',') || '无'),
      );
      const missing = panel(
        '缺输入',
        item.taskContext
          ? ((item.taskContext.missing || []).map((row) =>
            row.field + (row.blocking ? ' · 阻塞' : '') + ' · ' + row.reason
          ).join('\\n') || '所需信息已齐')
          : '尚未检查任务输入',
      );
      const view = item.codeView;
      const code = panel(
        '代码视图',
        view
          ? (
            '仓库 ' + (view.repositories || []).length
            + ((view.repositories || []).map((repo) => repo.provider).filter(Boolean).length
              ? ' · ' + [...new Set((view.repositories || []).map((repo) => repo.provider))].join(',')
              : '')
            + ' · 分支 ' + ((view.branches || []).map((branch) => branch.name).join(',') || '无')
            + ' · 提交 ' + (view.commits || []).length
            + ' · 文件 ' + ((view.changedFiles || []).join(',') || '无')
            + ((view.pullRequests || []).length
              ? ' · PR ' + (view.pullRequests || []).map((pr) => pr.url || pr.title || pr.id).join(',')
              : '')
            + ((view.leases || []).length
              ? ' · 租约 ' + (view.leases || []).map((lease) => lease.mode + ':' + lease.resourceType).join(',')
              : '')
            + (view.unlinked ? ' · 未关联分支' : '')
          )
          : ((item.codeLinks || []).map((link) => link.kind + ' ' + link.label).join('\\n') || '尚未关联本地提交'),
      );
      const ci = panel(
        'CI',
        [
          ...(item.ciRuns || []).map((link) => link.label + (link.url ? ' ' + link.url : '')),
          ...(item.evidenceLinks || []).filter((link) =>
            link.kind === 'ci-artifact' || link.kind === 'coverage-report' || link.kind === 'security-finding'
          ).map((link) => link.kind + ' ' + link.label),
        ].join('\\n') || '尚未运行本地检查',
      );
      const evidence = panel('证据', (item.checks || []).map((check) => check.producer + ' · ' + check.title + ' · ' + check.status).join('\\n') || '尚无已执行检查');
      const collabTasks = panel(
        '协作任务',
        (item.collaborationTasks || []).map((task) => task.objective + ' · ' + task.status).join('\\n') || '没有未完成协作任务',
      );
      const unresolved = panel(
        '未解决问题',
        [
          ...((item.unresolvedQuestions || []).map((question) => question.type + ' · ' + question.body)),
          ...((item.channelDecisions || []).map((decision) => 'decision · ' + decision.body)),
        ].join('\\n') || '没有未解决问题或决策',
      );
      const workflowRun = item.workflowRun;
      const workflow = panel(
        '工作流',
        workflowRun
          ? (workflowRun.status + ' · ' + workflowRun.nextAction + ' · 步骤 ' + (workflowRun.steps || []).length)
          : '尚未规划工作流',
      );
      const generatorPolicy = ((state.board && state.board.authority && state.board.authority.roles) || []).find((role) => role.role === 'generator');
      const authority = panel(
        '权限边界',
        generatorPolicy
          ? ('允许 ' + (generatorPolicy.allowedActions || []).join(',') + ' · 需审批 ' + (generatorPolicy.approvalRequired || []).join(',') + ' · 禁止 ' + (generatorPolicy.forbiddenActions || []).join(','))
          : '尚未加载角色权限',
      );
      const run = item.deliveryRun;
      const delivery = panel(
        '交付运行',
        run
          ? (run.status + ' · 下一步 ' + (run.checkpoint && run.checkpoint.nextAction ? run.checkpoint.nextAction : '') + ' · 已完成 ' + ((run.checkpoint && run.checkpoint.completedSteps) || []).join(','))
          : '尚未开始 Story 交付运行',
      );
      const linkGit = document.createElement('button');
      linkGit.textContent = '关联当前提交';
      linkGit.onclick = async () => {
        await api('/api/v1/work-items/' + encodeURIComponent(item.id) + '/scm/link', {
          method: 'POST',
          body: JSON.stringify({}),
        });
        await loadBoard();
      };
      const runCi = document.createElement('button');
      runCi.textContent = '运行本地检查';
      runCi.onclick = async () => {
        await api('/api/v1/work-items/' + encodeURIComponent(item.id) + '/ci/run', {
          method: 'POST',
          body: JSON.stringify({}),
        });
        await loadBoard();
      };
      const evaluate = document.createElement('button');
      evaluate.textContent = '独立评价';
      evaluate.onclick = async () => {
        await api('/api/v1/work-items/' + encodeURIComponent(item.id) + '/evaluate', {
          method: 'POST',
          body: JSON.stringify({ independent: true }),
        });
        await loadBoard();
      };
      const startRun = document.createElement('button');
      startRun.textContent = '开始交付运行';
      startRun.onclick = async () => {
        await api('/api/v1/work-items/' + encodeURIComponent(item.id) + '/story-delivery/start', {
          method: 'POST',
          body: JSON.stringify({ environmentReady: true, drive: true }),
        });
        await loadBoard();
      };
      const pauseRun = document.createElement('button');
      pauseRun.textContent = '暂停';
      pauseRun.onclick = async () => {
        if (!item.deliveryRun) return;
        await api('/api/v1/story-delivery-runs/' + encodeURIComponent(item.deliveryRun.id) + '/pause', {
          method: 'POST',
          body: JSON.stringify({ reason: 'developer pause' }),
        });
        await loadBoard();
      };
      const resumeRun = document.createElement('button');
      resumeRun.textContent = '恢复';
      resumeRun.onclick = async () => {
        if (!item.deliveryRun) return;
        await api('/api/v1/story-delivery-runs/' + encodeURIComponent(item.deliveryRun.id) + '/resume', {
          method: 'POST',
          body: JSON.stringify({}),
        });
        await loadBoard();
      };
      const cancelRun = document.createElement('button');
      cancelRun.textContent = '取消';
      cancelRun.onclick = async () => {
        if (!item.deliveryRun) return;
        await api('/api/v1/story-delivery-runs/' + encodeURIComponent(item.deliveryRun.id) + '/cancel', {
          method: 'POST',
          body: JSON.stringify({ reason: 'developer cancel' }),
        });
        await loadBoard();
      };
      const registerRepo = document.createElement('button');
      registerRepo.textContent = '登记仓库';
      registerRepo.onclick = async () => {
        await api('/api/v1/projects/' + encodeURIComponent(state.projectId) + '/repositories', {
          method: 'POST',
          body: JSON.stringify({ name: 'local', workspaceRoot: '' }),
        });
        await loadBoard();
      };
      const createBranch = document.createElement('button');
      createBranch.textContent = '创建分支';
      createBranch.onclick = async () => {
        await api('/api/v1/work-items/' + encodeURIComponent(item.id) + '/branches', {
          method: 'POST',
          body: JSON.stringify({ role: 'generator' }),
        });
        await loadBoard();
      };
      const dispatchRun = document.createElement('button');
      dispatchRun.textContent = '按策略调度';
      dispatchRun.onclick = async () => {
        await api('/api/v1/team/dispatch/run', {
          method: 'POST',
          body: JSON.stringify({ projectId: state.projectId }),
        });
        await loadBoard();
      };
      inspector.append(heading, agent, participants, missing, leases, code, ci, evidence, collabTasks, unresolved, workflow, delivery, authority, dispatchRun, linkGit, runCi, evaluate, startRun, pauseRun, resumeRun, cancelRun, registerRepo, createBranch);
      for (const row of (item.agentFeedback || [])) {
        if (row.status !== 'pending' && row.status !== 'revision_requested') continue;
        const accept = document.createElement('button');
        accept.textContent = '接受反馈';
        accept.onclick = async () => {
          await api('/api/v1/agent-feedback/' + encodeURIComponent(row.id) + '/accept', {
            method: 'POST',
            body: JSON.stringify({}),
          });
          await loadBoard();
        };
        const reject = document.createElement('button');
        reject.textContent = '拒绝反馈';
        reject.onclick = async () => {
          await api('/api/v1/agent-feedback/' + encodeURIComponent(row.id) + '/reject', {
            method: 'POST',
            body: JSON.stringify({}),
          });
          await loadBoard();
        };
        const revision = document.createElement('button');
        revision.textContent = '要求修订';
        revision.onclick = async () => {
          await api('/api/v1/agent-feedback/' + encodeURIComponent(row.id) + '/revision', {
            method: 'POST',
            body: JSON.stringify({}),
          });
          await loadBoard();
        };
        inspector.append(accept, reject, revision);
      }
    }
    function panel(title, text) {
      const block = document.createElement('section');
      const heading = document.createElement('h3');
      heading.textContent = title;
      const body = document.createElement('p');
      body.className = 'muted';
      body.textContent = text;
      block.append(heading, body);
      return block;
    }
    function field(title, name, value) {
      const label = document.createElement('label');
      label.textContent = title;
      const area = document.createElement('textarea');
      area.name = name;
      area.value = value || '';
      label.append(area);
      return {
        label,
        get value() { return area.value; },
      };
    }
    async function openChannel() {
      const created = await api('/api/v1/team/conversations', {
        method: 'POST',
        body: JSON.stringify({ projectId: state.projectId, title: 'Agent Channel' }),
      });
      state.conversationId = created.id;
      const tasks = await api('/api/v1/team/conversations/' + created.id + '/tasks');
      $('channel-log').textContent = '会话 ' + created.id + ' · 开放任务 ' + ((tasks.tasks || []).length);
    }
    async function prepareEnv() {
      const result = await api('/api/v1/environment/prepare', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      $('env-log').textContent = JSON.stringify({ ready: result.ready, blockers: result.blockers }, null, 2);
    }
    async function compareDepth() {
      const result = await api('/api/v1/harness/comparisons', { method: 'POST', body: JSON.stringify({}) });
      $('env-log').textContent = JSON.stringify({
        changedMechanism: result.changedMechanism,
        baselineDepth: result.baselineDepth,
        candidateDepth: result.candidateDepth,
        meetsThreshold: result.meetsThreshold,
        tokenCost: result.candidateTrials && result.candidateTrials[0] ? result.candidateTrials[0].tokenCost : null,
      }, null, 2);
    }
    async function selfDemo() {
      const result = await api('/api/v1/harness/demonstrations', { method: 'POST', body: JSON.stringify({}) });
      $('env-log').textContent = JSON.stringify({
        customerProgress: result.customerProgress,
        gates: result.gates,
        gaps: result.gaps,
        freshProjectReady: result.freshProjectReady,
      }, null, 2);
    }
    async function draftSkill() {
      const created = await api('/api/v1/skills/drafts', {
        method: 'POST',
        body: JSON.stringify({ templateId: 'requirement-intake' }),
      });
      const validation = await api('/api/v1/skills/drafts/' + encodeURIComponent(created.id) + '/validate', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      let enabled = null;
      if (validation.status === 'valid' && state.projectId) {
        enabled = await api('/api/v1/skills/drafts/' + encodeURIComponent(created.id) + '/enable', {
          method: 'POST',
          body: JSON.stringify({ projectId: state.projectId }),
        });
      }
      $('env-log').textContent = JSON.stringify({
        draft: created.id,
        createdThroughSkillCreator: created.createdThroughSkillCreator,
        validation: validation.status,
        enabled: enabled ? enabled.id : null,
        gated: validation.status !== 'valid',
      }, null, 2);
    }
    for (const button of document.querySelectorAll('nav [data-job]')) {
      button.addEventListener('click', () => setJob(button.getAttribute('data-job')));
    }
    $('project-select').addEventListener('change', async (event) => {
      state.projectId = event.target.value;
      await loadBoard();
    });
    $('logout').onclick = async () => {
      await api('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
      location.assign('/login');
    };
    setJob(state.job);
    loadProjects().then(loadBoard);
  </script>
</body>
</html>
`;
}
