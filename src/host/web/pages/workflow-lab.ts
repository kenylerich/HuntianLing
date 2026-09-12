/**
 * Developer workflow canvas and Test Lab. Not the fused board cockpit.
 */

export function renderWorkflowLabPage(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>工作流画布 · HuntianLing</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #f4f6f8; color: #1f2933; }
    header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1.25rem; background: #fff; border-bottom: 1px solid #d8e1e7; }
    main { display: grid; grid-template-columns: 16rem 1fr 18rem; gap: 1rem; padding: 1rem 1.25rem; }
    section, aside { background: #fff; border: 1px solid #d8e1e7; border-radius: 8px; padding: 1rem; }
    .item { border-top: 1px solid #e4ebf0; padding: 0.5rem 0; cursor: pointer; }
    .muted { color: #60717f; font-size: 0.85rem; }
    label { display: grid; gap: 0.25rem; margin: 0.4rem 0; font-size: 0.9rem; }
    input, select, button { font: inherit; padding: 0.35rem 0.5rem; }
    svg { width: 100%; min-height: 22rem; background: #fbfcfd; border: 1px dashed #d8e1e7; }
  </style>
</head>
<body>
  <header>
    <h1>工作流画布与 Test Lab</h1>
    <div>
      <a href="/developer">返回开发界面</a>
      <button id="logout" type="button">退出</button>
    </div>
  </header>
  <main>
    <aside>
      <h2>模板</h2>
      <button id="clone" type="button">克隆 user-story</button>
      <div id="templates"></div>
    </aside>
    <section>
      <h2>画布</h2>
      <div>
        <button id="view-edit" type="button">编辑</button>
        <button id="view-map" type="button">查看地图</button>
        <button id="view-replay" type="button">回放</button>
      </div>
      <div id="layers" class="muted"></div>
      <svg id="canvas" viewBox="0 0 1400 360" role="img" aria-label="workflow canvas"></svg>
      <label class="muted">回放帧 <input id="scrubber" type="range" min="0" max="0" value="0"></label>
      <p id="issues" class="muted"></p>
    </section>
    <aside>
      <h2>节点</h2>
      <div id="inspector" class="muted">选择一个步骤节点</div>
      <h2>Test Lab</h2>
      <label>场景
        <select id="scenario">
          <option value="happy-path">happy-path</option>
          <option value="missing-approval">missing-approval</option>
          <option value="resource-conflict">resource-conflict</option>
          <option value="stale-state">stale-state</option>
          <option value="missing-evidence">missing-evidence</option>
        </select>
      </label>
      <button id="run-test" type="button">dry-run</button>
      <button id="publish" type="button">发布</button>
      <pre id="lab-log" class="muted"></pre>
    </aside>
  </main>
  <script>
    const state = { templates: [], templateId: '', canvas: null, selected: null, mode: 'edit', visualization: null, replay: null, frame: 0, hiddenLayers: {} };
    function $(id) { return document.getElementById(id); }
    async function api(path, options = {}) {
      const response = await fetch(path, {
        ...options,
        headers: { 'content-type': 'application/json', ...(options.headers || {}) },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || response.statusText);
      return payload;
    }
    async function loadTemplates() {
      const payload = await api('/api/v1/workflow-templates');
      state.templates = payload.templates || [];
      const box = $('templates');
      box.innerHTML = '';
      for (const template of state.templates) {
        const row = document.createElement('div');
        row.className = 'item';
        row.textContent = template.title + ' · ' + template.state;
        row.onclick = () => openTemplate(template.id);
        box.append(row);
      }
    }
    async function openTemplate(id) {
      state.templateId = id;
      state.canvas = await api('/api/v1/workflow-templates/' + encodeURIComponent(id) + '/canvas');
      if (state.mode !== 'edit') await loadMap();
      draw();
    }
    async function loadMap() {
      if (!state.templateId) return;
      state.visualization = await api('/api/v1/workflow-templates/' + encodeURIComponent(state.templateId) + '/visualization');
      renderLayers();
    }
    function renderLayers() {
      const box = $('layers');
      box.innerHTML = '';
      if (!state.visualization || state.mode === 'edit') return;
      for (const layer of state.visualization.layers || []) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !state.hiddenLayers[layer.id];
        input.onchange = () => {
          state.hiddenLayers[layer.id] = !input.checked;
          draw();
        };
        label.append(input, document.createTextNode(' ' + layer.title));
        box.append(label);
      }
    }
    function visibleIds() {
      if (!state.visualization) return null;
      const hidden = new Set();
      for (const layer of state.visualization.layers || []) {
        if (state.hiddenLayers[layer.id]) {
          for (const id of layer.nodeIds || []) hidden.add(id);
        }
      }
      return hidden;
    }
    function draw() {
      const svg = $('canvas');
      svg.innerHTML = '';
      const source = state.mode === 'edit' ? state.canvas : (state.replay && state.replay.map) || (state.visualization && state.visualization.presentations.dependencyGraph);
      if (!source) return;
      const nodes = source.nodes || [];
      const hidden = state.mode === 'edit' ? null : visibleIds();
      const active = state.mode === 'replay' && state.replay ? state.replay.frames[state.frame] : null;
      for (const edge of source.edges || []) {
        const from = nodes.find((node) => node.id === edge.from);
        const to = nodes.find((node) => node.id === edge.to);
        if (!from || !to) continue;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(from.x + 70));
        line.setAttribute('y1', String(from.y + 20));
        line.setAttribute('x2', String(to.x + 70));
        line.setAttribute('y2', String(to.y + 20));
        line.setAttribute('stroke', '#94a3b8');
        svg.append(line);
      }
      for (const node of nodes) {
        if (hidden && hidden.has(node.id)) continue;
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', String(node.x));
        rect.setAttribute('y', String(node.y));
        rect.setAttribute('width', '150');
        rect.setAttribute('height', '40');
        rect.setAttribute('rx', '6');
        const highlight = active && node.id === 'step:' + active.stepId;
        rect.setAttribute('fill', highlight ? '#fde68a' : node.kind === 'stage' ? '#e8f0fe' : '#fff');
        rect.setAttribute('stroke', '#64748b');
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(node.x + 8));
        text.setAttribute('y', String(node.y + 24));
        text.setAttribute('font-size', '12');
        text.textContent = node.title;
        g.append(rect, text);
        g.style.cursor = 'pointer';
        g.onclick = () => inspect(node);
        svg.append(g);
      }
    }
    function inspect(node) {
      state.selected = node;
      const inspector = $('inspector');
      inspector.innerHTML = '';
      inspector.className = '';
      if (state.mode !== 'edit') {
        const info = node.inspector || {};
        inspector.textContent = (node.title || '') + ' · ' + (info.role || node.role || '') + ' · ' + (info.skills || node.requiredSkills || []).join(',');
        return;
      }
      const role = field('角色', node.role);
      const save = document.createElement('button');
      save.textContent = '保存节点';
      save.onclick = async () => {
        if (!state.canvas) return;
        const nodes = state.canvas.nodes.map((item) => item.id === node.id ? { ...item, role: role.value } : item);
        const saved = await api('/api/v1/workflow-templates/' + encodeURIComponent(state.templateId) + '/canvas', {
          method: 'PUT',
          body: JSON.stringify({ nodes, edges: state.canvas.edges }),
        });
        state.canvas = saved.canvas;
        $('issues').textContent = (saved.validation.issues || []).map((issue) => issue.message).join('；') || '画布有效';
        draw();
      };
      inspector.append(role.label, save);
    }
    function field(labelText, value) {
      const label = document.createElement('label');
      label.textContent = labelText;
      const input = document.createElement('input');
      input.value = value || '';
      label.append(input);
      return { label, get value() { return input.value; } };
    }
    $('clone').onclick = async () => {
      const cloned = await api('/api/v1/harness/workflows', {
        method: 'POST',
        body: JSON.stringify({ templateId: 'huntianling.user-story' }),
      });
      await loadTemplates();
      await openTemplate(cloned.id);
    };
    $('view-edit').onclick = () => { state.mode = 'edit'; draw(); };
    $('view-map').onclick = async () => {
      state.mode = 'map';
      await loadMap();
      draw();
    };
    $('view-replay').onclick = async () => {
      state.mode = 'replay';
      if (state.replay) draw();
    };
    $('scrubber').oninput = (event) => {
      state.frame = Number(event.target.value);
      draw();
    };
    $('run-test').onclick = async () => {
      if (!state.templateId) return;
      const scenario = $('scenario').value;
      const created = await api('/api/v1/workflow-templates/' + encodeURIComponent(state.templateId) + '/test-cases', {
        method: 'POST',
        body: JSON.stringify({ title: scenario, scenario }),
      });
      const run = await api('/api/v1/workflow-templates/' + encodeURIComponent(state.templateId) + '/test-runs', {
        method: 'POST',
        body: JSON.stringify({ testCaseId: created.id }),
      });
      state.replay = await api('/api/v1/workflow-test-runs/' + encodeURIComponent(run.id) + '/replay');
      state.mode = 'replay';
      state.frame = 0;
      $('scrubber').max = String(Math.max((state.replay.frames || []).length - 1, 0));
      $('lab-log').textContent = run.status + '\\n' + (run.replay || []).map((frame) => frame.title + ' · ' + frame.nextSafeAction).join('\\n');
      draw();
    };
    $('publish').onclick = async () => {
      if (!state.templateId) return;
      try {
        const published = await api('/api/v1/workflow-templates/' + encodeURIComponent(state.templateId) + '/publish', { method: 'POST' });
        $('lab-log').textContent = '已发布 ' + published.version;
        await loadTemplates();
      } catch (error) {
        $('lab-log').textContent = error.message;
      }
    };
    $('logout').onclick = async () => {
      await api('/api/auth/password/logout', { method: 'POST' });
      location.assign('/login');
    };
    loadTemplates().catch((error) => { $('issues').textContent = error.message; });
  </script>
</body>
</html>
`;
}