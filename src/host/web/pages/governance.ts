/**
 * Authenticated governance and trust dashboard. Not GitHub Issue ownership.
 */

export function renderGovernancePage(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>治理和信任看板 · HuntianLing</title>
  <style>
    :root {
      color-scheme: light;
      --surface: #f4f6f8;
      --panel: #ffffff;
      --line: #d8e1e7;
      --ink: #1f2933;
      --muted: #60717f;
      --accent: #006d77;
      --green: #20744f;
      --red: #b1423f;
      --amber: #9b6211;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: var(--surface); color: var(--ink); }
    header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.75rem 1.25rem; background: var(--panel); border-bottom: 1px solid var(--line); }
    header h1 { margin: 0; font-size: 1.15rem; }
    header .tools { display: flex; align-items: center; gap: 0.75rem; }
    main { display: grid; gap: 1rem; padding: 1rem 1.25rem; }
    .strip, .panel, aside, form { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 0.9rem; }
    .strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr)); gap: 0.75rem; }
    .metric { display: grid; gap: 0.15rem; }
    .metric strong { font-size: 1.25rem; font-variant-numeric: tabular-nums; }
    .metric span, .muted { color: var(--muted); font-size: 0.82rem; }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 20rem; gap: 1rem; align-items: start; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 0.75rem; }
    .panel h2 { margin: 0 0 0.6rem; font-size: 0.95rem; }
    .row { border-top: 1px solid #e4ebf0; padding: 0.45rem 0; }
    .row:first-of-type { border-top: 0; padding-top: 0; }
    .badge { display: inline-block; margin-right: 0.3rem; padding: 0.1rem 0.4rem; border-radius: 999px; background: #eef3f6; font-size: 0.72rem; }
    .badge.ready { background: #e7f6ee; color: var(--green); }
    .badge.blocking { background: #fdecea; color: var(--red); }
    .badge.warn { background: #fff4e5; color: var(--amber); }
    label { display: grid; gap: 0.25rem; margin: 0.4rem 0; font-size: 0.88rem; }
    input, select, textarea, button { font: inherit; padding: 0.35rem 0.5rem; }
    textarea { min-height: 3.2rem; width: 100%; }
    button { cursor: pointer; }
    button.primary { background: var(--accent); color: #fff; border: 0; border-radius: 6px; }
    #message.error { color: var(--red); }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <h1>治理和信任看板</h1>
    <div class="tools">
      <label>项目 <select id="project-select"></select></label>
      <a href="/developer">返回开发界面</a>
      <span id="who" class="muted"></span>
      <button id="logout" type="button">退出</button>
    </div>
  </header>
  <main id="governance-dashboard">
    <p id="message" class="muted">选择项目后查看义务、残余风险和已签名证据。</p>
    <section class="strip" id="status-strip" aria-label="治理准备摘要"></section>
    <div class="layout">
      <section class="grid" id="panels"></section>
      <aside>
        <h2>范围与操作</h2>
        <label>里程碑
          <select id="milestone-select"><option value="">整个项目</option></select>
        </label>
        <label>工作项
          <select id="work-item-select"><option value="">全部工作项</option></select>
        </label>
        <p id="item-detail" class="muted">选择工作项后查看控制、缺证据、残余风险和 provenance。</p>
        <form id="review-form">
          <label>义务
            <select id="obligation-select"></select>
          </label>
          <button type="submit" id="request-review">请求评审</button>
          <button type="button" id="approve-obligation">批准义务</button>
        </form>
        <form id="risk-form">
          <label>标题 <input id="risk-title" required></label>
          <label>批准人 <input id="risk-approver" required></label>
          <label>原因 <textarea id="risk-reason" required></textarea></label>
          <label>范围 <input id="risk-scope" required></label>
          <label>补偿控制 <input id="risk-controls" placeholder="逗号分隔"></label>
          <button type="submit" class="primary" id="accept-risk">接受残余风险</button>
        </form>
        <form id="report-form">
          <label>报告范围
            <select id="report-scope">
              <option value="project">project</option>
              <option value="milestone">milestone</option>
              <option value="work-item">work-item</option>
              <option value="release">release</option>
              <option value="certification">certification</option>
            </select>
          </label>
          <button type="submit" id="create-report">起草证据报告</button>
          <label>签署
            <select id="report-select"></select>
          </label>
          <button type="button" class="primary" id="sign-report">签署证据报告</button>
        </form>
      </aside>
    </div>
  </main>
  <script>
    const state = { projectId: '', milestoneId: '', workItemId: '', dashboard: null };
    function $(id) { return document.getElementById(id); }
    async function api(path, options) {
      const response = await fetch(path, {
        ...(options || {}),
        headers: { 'content-type': 'application/json', ...((options && options.headers) || {}) },
      });
      const payload = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(payload.error || response.statusText);
      return payload;
    }
    function setMessage(text, isError) {
      $('message').textContent = text;
      $('message').className = isError ? 'error' : 'muted';
    }
    function metric(value, label, tone) {
      const node = document.createElement('div');
      node.className = 'metric';
      const strong = document.createElement('strong');
      strong.textContent = value;
      const span = document.createElement('span');
      span.textContent = label;
      if (tone) {
        const badge = document.createElement('span');
        badge.className = 'badge ' + tone;
        badge.textContent = tone === 'ready' ? 'Ready' : '阻塞';
        node.append(strong, span, badge);
      } else node.append(strong, span);
      return node;
    }
    function panel(title, rows) {
      const section = document.createElement('section');
      section.className = 'panel';
      const heading = document.createElement('h2');
      heading.textContent = title;
      section.append(heading);
      if (!rows.length) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = '暂无记录。';
        section.append(empty);
        return section;
      }
      for (const row of rows) {
        const item = document.createElement('div');
        item.className = 'row';
        item.textContent = row;
        section.append(item);
      }
      return section;
    }
    function dashboardPath() {
      if (state.workItemId) {
        return '/api/v1/work-items/' + encodeURIComponent(state.workItemId) + '/governance/dashboard';
      }
      if (state.milestoneId) {
        return '/api/v1/milestones/' + encodeURIComponent(state.milestoneId) + '/governance/dashboard';
      }
      return '/api/v1/projects/' + encodeURIComponent(state.projectId) + '/governance/dashboard';
    }
    function fillSelect(id, items, valueKey, labelKey, blank) {
      const select = $(id);
      const current = select.value;
      select.innerHTML = '';
      const blankOption = document.createElement('option');
      blankOption.value = '';
      blankOption.textContent = blank;
      select.append(blankOption);
      for (const item of items) {
        const option = document.createElement('option');
        option.value = item[valueKey];
        option.textContent = item[labelKey];
        select.append(option);
      }
      select.value = current;
    }
    function renderDashboard(data) {
      state.dashboard = data;
      const strip = $('status-strip');
      strip.innerHTML = '';
      const unapproved = (data.obligations || []).filter(function (row) {
        return row.status !== 'approved' && row.status !== 'active' && row.status !== 'retired';
      }).length;
      const coverage = data.controlCoverage || {};
      const security = data.securityReadiness || {};
      const reliability = data.reliabilityReadiness || {};
      const reports = data.evidenceReports || [];
      strip.append(
        metric(String((data.obligations || []).length), '适用义务'),
        metric(String(coverage.evidenceCompleteControls || 0) + '/' + String(coverage.totalControls || 0), '控制覆盖', coverage.ready ? 'ready' : 'blocking'),
        metric(String((data.riskRegister || []).length), '风险登记'),
        metric(String((data.openExceptions || []).length), '开放例外', (data.openExceptions || []).length ? 'blocking' : 'ready'),
        metric(security.ready ? 'Ready' : '未就绪', '安全准备', security.ready ? 'ready' : 'blocking'),
        metric(reliability.ready ? 'Ready' : '未就绪', '可靠性准备', reliability.ready ? 'ready' : 'blocking'),
        metric(String((data.trustAssessments || []).length), '可信评估'),
        metric(String(reports.filter(function (row) { return row.status === 'approved'; }).length) + '/' + String(reports.length), '证据报告', reports.some(function (row) { return row.status === 'draft'; }) ? 'warn' : 'ready'),
      );
      const panels = $('panels');
      panels.innerHTML = '';
      panels.append(
        panel('适用义务', (data.obligations || []).map(function (row) { return row.title + ' · ' + row.status; })),
        panel('控制覆盖', (coverage.controls || []).map(function (row) {
          return row.controlId + ' · ' + (row.mapped ? '已映射' : '未映射') + (row.evidenceComplete ? ' · 证据齐' : ' · 缺证据');
        })),
        panel('风险登记', (data.riskRegister || []).map(function (row) { return row.title + ' · ' + row.approver + ' · ' + row.scope; })),
        panel('开放例外', (data.openExceptions || []).map(function (row) { return row.kind + ' · ' + row.title; })),
        panel('安全准备', [
          '高风险工作项 ' + String(security.highRiskWorkItems || 0),
          '威胁模型 ' + String(security.threatModelCount || 0),
          '扫描通过 ' + String(security.passingScans || 0),
          '扫描失败 ' + String(security.failingScans || 0),
        ]),
        panel('可靠性准备', [
          'SLO ' + String(reliability.totalSlos || 0),
          '含可观测性 ' + String(reliability.slosWithObservability || 0),
          '生产缺观测 ' + String(reliability.productionFacingMissingObservability || 0),
        ]),
        panel('可信评估', (data.trustAssessments || []).map(function (row) { return row.summary + ' · ' + row.residualRisk; })),
        panel('证据报告状态', reports.map(function (row) { return row.scope + ' · ' + row.status + (row.approvedBy ? ' · ' + row.approvedBy : ''); })),
      );
      const milestones = data.milestones || [];
      if (milestones.length) {
        panels.append(panel('里程碑汇总', milestones.map(function (row) {
          return row.title
            + ' · 合规 ' + (row.complianceReady ? 'Ready' : '阻塞')
            + ' · 安全 ' + (row.securityReady ? 'Ready' : '阻塞')
            + ' · 可靠性 ' + (row.reliabilityReady ? 'Ready' : '阻塞')
            + ' · 可信 ' + (row.trustReady ? 'Ready' : '阻塞');
        })));
      }
      fillSelect('obligation-select', data.obligations || [], 'id', 'title', '选择义务');
      fillSelect('report-select', reports.filter(function (row) { return row.status === 'draft'; }), 'id', 'id', '选择草稿报告');
      const selected = (data.workItems || []).find(function (row) { return row.workItemId === state.workItemId; })
        || ((data.workItems || [])[0] && !state.workItemId ? null : (data.workItems || [])[0]);
      if (state.workItemId && selected) {
        $('item-detail').textContent = [
          '必需控制 ' + (selected.requiredControls.map(function (row) { return row.controlId; }).join(',') || '无'),
          '已映射检查 ' + (selected.mappedChecks.join(',') || '无'),
          '缺证据 ' + (selected.missingEvidence.join(',') || '无'),
          '残余风险 ' + (selected.residualRisks.map(function (row) { return row.title; }).join(',') || '无'),
          '待审批 ' + (selected.approvalRequirements.join(',') || '无'),
          'provenance ' + String((selected.provenance || []).length),
        ].join(' · ');
      } else {
        $('item-detail').textContent = '选择工作项后查看控制、缺证据、残余风险和 provenance。';
      }
    }
    async function loadDashboard() {
      if (!state.projectId) return;
      const data = await api(dashboardPath());
      renderDashboard(data);
      const items = data.workItems || [];
      fillSelect('work-item-select', items, 'workItemId', 'title', '全部工作项');
      $('work-item-select').value = state.workItemId;
      fillSelect('milestone-select', data.milestones || [], 'milestoneId', 'title', '整个项目');
      $('milestone-select').value = state.milestoneId;
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
    $('project-select').onchange = async function () {
      state.projectId = $('project-select').value;
      state.milestoneId = '';
      state.workItemId = '';
      await loadDashboard();
    };
    $('milestone-select').onchange = async function () {
      state.milestoneId = $('milestone-select').value;
      state.workItemId = '';
      await loadDashboard();
    };
    $('work-item-select').onchange = async function () {
      state.workItemId = $('work-item-select').value;
      await loadDashboard();
    };
    $('review-form').onsubmit = async function (event) {
      event.preventDefault();
      try {
        await api('/api/v1/compliance/obligations/' + encodeURIComponent($('obligation-select').value) + '/request-review', { method: 'POST', body: '{}' });
        setMessage('已请求评审');
        await loadDashboard();
      } catch (error) { setMessage(error.message, true); }
    };
    $('approve-obligation').onclick = async function () {
      try {
        await api('/api/v1/compliance/obligations/' + encodeURIComponent($('obligation-select').value) + '/approve', { method: 'POST', body: '{}' });
        setMessage('义务已批准');
        await loadDashboard();
      } catch (error) { setMessage(error.message, true); }
    };
    $('risk-form').onsubmit = async function (event) {
      event.preventDefault();
      if (!state.workItemId) { setMessage('接受残余风险需要选择工作项', true); return; }
      try {
        const controls = $('risk-controls').value.split(',').map(function (row) { return row.trim(); }).filter(Boolean);
        await api('/api/v1/work-items/' + encodeURIComponent(state.workItemId) + '/security/risk-acceptance', {
          method: 'POST',
          body: JSON.stringify({
            title: $('risk-title').value,
            approver: $('risk-approver').value,
            reason: $('risk-reason').value,
            scope: $('risk-scope').value,
            compensatingControls: controls,
          }),
        });
        setMessage('残余风险已接受');
        await loadDashboard();
      } catch (error) { setMessage(error.message, true); }
    };
    $('report-form').onsubmit = async function (event) {
      event.preventDefault();
      try {
        const body = { scope: $('report-scope').value };
        if (body.scope === 'milestone' && state.milestoneId) body.scopeId = state.milestoneId;
        if (body.scope === 'work-item' && state.workItemId) body.scopeId = state.workItemId;
        await api('/api/v1/projects/' + encodeURIComponent(state.projectId) + '/evidence-reports', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        setMessage('证据报告已起草');
        await loadDashboard();
      } catch (error) { setMessage(error.message, true); }
    };
    $('sign-report').onclick = async function () {
      try {
        await api('/api/v1/evidence-reports/' + encodeURIComponent($('report-select').value) + '/sign', { method: 'POST', body: '{}' });
        setMessage('证据报告已签署');
        await loadDashboard();
      } catch (error) { setMessage(error.message, true); }
    };
    $('logout').onclick = async function () {
      await api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(function () {});
      location.assign('/login');
    };
    loadProjects().then(loadDashboard).catch(function (error) { setMessage(error.message, true); });
  </script>
</body>
</html>
`;
}
