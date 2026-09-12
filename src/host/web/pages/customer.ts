/**
 * Customer shell: own projects, MKT dialog, original requirements, progress.
 */

const PROGRESS_LABELS: Record<string, string> = {
  submitted: '已提出',
  waiting_on_customer: '待客户确认',
  in_analysis: '分析中',
  in_development: '开发中',
  delivered: '已交付',
};

export function renderCustomerPage(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>客户界面 · HuntianLing</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #f4f6f8; color: #1f2933; }
    header, main { max-width: 56rem; margin: 0 auto; padding: 1rem 1.25rem; }
    header { display: flex; justify-content: space-between; align-items: center; }
    h1, h2 { font-size: 1.1rem; margin: 0 0 0.75rem; }
    section { background: #fff; border: 1px solid #d8e1e7; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
    label { display: grid; gap: 0.25rem; margin-bottom: 0.5rem; font-size: 0.9rem; }
    input, textarea, select, button { font: inherit; padding: 0.4rem 0.5rem; }
    textarea { min-height: 4rem; width: 100%; box-sizing: border-box; }
    .messages { display: grid; gap: 0.5rem; margin: 0.75rem 0; max-height: 16rem; overflow: auto; }
    .message { padding: 0.5rem 0.75rem; border-radius: 6px; background: #eef3f6; }
    .message.assistant { background: #f7f3ea; }
    .req { border-top: 1px solid #d8e1e7; padding: 0.75rem 0; }
    .muted { color: #60717f; font-size: 0.85rem; }
    .error { color: #b1423f; }
  </style>
</head>
<body>
  <header>
    <h1>客户界面</h1>
    <div>
      <span id="who" class="muted"></span>
      <button id="logout" type="button">退出</button>
    </div>
  </header>
  <main>
    <p id="error" class="error"></p>
    <section>
      <h2>我的项目</h2>
      <form id="project-form">
        <label>名称 <input id="project-name" name="name" required></label>
        <button type="submit">创建项目</button>
      </form>
      <label>当前项目
        <select id="project-select"></select>
      </label>
    </section>
    <section>
      <h2>需求对话</h2>
      <div id="messages" class="messages"></div>
      <form id="chat-form">
        <label>说明你的需求
          <textarea id="chat-body" name="body"></textarea>
        </label>
        <label>附件
          <input id="chat-file" type="file" accept=".md,.txt,.pdf,.doc,.docx,.png,.jpg,.jpeg,.svg,image/*,application/pdf">
        </label>
        <button type="submit">发送</button>
        <button id="analyze" type="button">生成候选需求</button>
      </form>
      <div id="questions"></div>
    </section>
    <section>
      <h2>我的需求和进度</h2>
      <div id="requirements"></div>
    </section>
  </main>
  <script>
    const progressLabels = ${JSON.stringify(PROGRESS_LABELS)};
    const state = { projects: [], projectId: '', sessionId: '', board: null };

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

    function showError(error) {
      $('error').textContent = error ? String(error.message || error) : '';
    }

    async function loadSession() {
      const payload = await api('/api/auth/session');
      if (!payload.authenticated) {
        window.location.assign('/login');
        return;
      }
      $('who').textContent = payload.principal.displayName;
    }

    async function loadProjects() {
      const payload = await api('/api/v1/projects');
      state.projects = payload.projects || [];
      const select = $('project-select');
      select.innerHTML = '';
      for (const project of state.projects) {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        select.append(option);
      }
      if (!state.projectId && state.projects[0]) state.projectId = state.projects[0].id;
      select.value = state.projectId;
    }

    async function loadBoard() {
      if (!state.projectId) {
        $('messages').textContent = '先创建一个项目。';
        $('requirements').textContent = '';
        return;
      }
      const board = await api('/api/v1/projects/' + encodeURIComponent(state.projectId) + '/customer-board');
      state.board = board;
      const session = board.sessions[0];
      state.sessionId = session ? session.id : '';
      const messages = $('messages');
      messages.innerHTML = '';
      for (const message of session ? session.messages : []) {
        const row = document.createElement('div');
        row.className = 'message ' + message.role;
        row.textContent = (message.kind === 'clarifying-question' ? '待补充 · ' : '') + message.body;
        messages.append(row);
      }
      const questions = $('questions');
      questions.innerHTML = '';
      const openQuestions = (session ? session.questions : []).filter((question) => question.status === 'open');
      if (openQuestions.length) {
        const heading = document.createElement('p');
        heading.className = 'muted';
        heading.textContent = '请补充以下信息，不必进入开发界面。';
        questions.append(heading);
        for (const question of openQuestions) {
          const form = document.createElement('form');
          form.dataset.field = question.field;
          const label = document.createElement('label');
          label.textContent = question.prompt;
          const input = document.createElement(question.field === 'confirm' ? 'input' : 'textarea');
          if (question.field === 'confirm') {
            input.placeholder = '确认 或 暂不跟踪';
          }
          const button = document.createElement('button');
          button.type = 'submit';
          button.textContent = question.field === 'confirm' ? '确认跟踪' : '回答';
          label.append(input);
          form.append(label, button);
          form.addEventListener('submit', async (event) => {
            event.preventDefault();
            showError('');
            try {
              await api('/api/v1/intake/sessions/' + encodeURIComponent(state.sessionId) + '/follow-ups', {
                method: 'POST',
                body: JSON.stringify({ field: question.field, value: input.value.trim() }),
              });
              await loadBoard();
            } catch (error) {
              showError(error);
            }
          });
          questions.append(form);
        }
      }
      const requirements = $('requirements');
      requirements.innerHTML = '';
      if (!board.requirements.length) {
        requirements.innerHTML = '<p class="muted">还没有需求。在对话里说明你要做什么。</p>';
        return;
      }
      for (const item of board.requirements) {
        const row = document.createElement('article');
        row.className = 'req';
        const title = document.createElement('strong');
        title.textContent = item.title;
        const progress = document.createElement('p');
        progress.className = 'muted';
        progress.textContent = '进度 ' + (progressLabels[item.progress] || item.progress);
        const quotes = document.createElement('p');
        quotes.textContent = (item.quotes || []).join('\\n');
        row.append(title, progress, quotes);
        if (item.progress === 'waiting_on_customer') {
          const wait = document.createElement('p');
          wait.className = 'muted';
          wait.textContent = '待客户在对话里补充或确认';
          row.append(wait);
        }
        requirements.append(row);
      }
    }

    $('project-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      showError('');
      try {
        const created = await api('/api/v1/projects', {
          method: 'POST',
          body: JSON.stringify({ name: $('project-name').value.trim() }),
        });
        state.projectId = created.id;
        $('project-name').value = '';
        await loadProjects();
        await loadBoard();
      } catch (error) {
        showError(error);
      }
    });

    $('project-select').addEventListener('change', async (event) => {
      state.projectId = event.target.value;
      await loadBoard();
    });

    $('chat-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      showError('');
      try {
        if (!state.projectId) throw new Error('先创建一个项目');
        if (!state.sessionId) {
          const session = await api('/api/v1/projects/' + encodeURIComponent(state.projectId) + '/intake/sessions', {
            method: 'POST',
            body: JSON.stringify({ title: '需求对话' }),
          });
          state.sessionId = session.id;
        }
        const file = $('chat-file').files && $('chat-file').files[0];
        const body = $('chat-body').value.trim();
        if (!file && !body) throw new Error('请说明需求或上传附件');
        if (file) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          await api('/api/v1/intake/sessions/' + encodeURIComponent(state.sessionId) + '/source-documents', {
            method: 'POST',
            body: JSON.stringify({
              kind: intakeKindForFile(file),
              name: file.name,
              mimeType: file.type || '',
              size: file.size,
              contentBase64: bytesToBase64(bytes),
            }),
          });
          $('chat-file').value = '';
        }
        if (body) {
          await api('/api/v1/intake/sessions/' + encodeURIComponent(state.sessionId) + '/messages', {
            method: 'POST',
            body: JSON.stringify({ role: 'user', body }),
          });
          $('chat-body').value = '';
        }
        await loadBoard();
      } catch (error) {
        showError(error);
      }
    });

    $('analyze').addEventListener('click', async () => {
      showError('');
      try {
        if (!state.sessionId) throw new Error('先发送一条需求或附件');
        await api('/api/v1/intake/sessions/' + encodeURIComponent(state.sessionId) + '/analyze', {
          method: 'POST',
          body: JSON.stringify({}),
        });
        await loadBoard();
      } catch (error) {
        showError(error);
      }
    });

    function intakeKindForFile(file) {
      const type = file.type || '';
      const name = file.name.toLowerCase();
      if (type.startsWith('image/') || name.endsWith('.svg')) return 'image';
      if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
      if (name.endsWith('.doc') || name.endsWith('.docx') || type.includes('word')) return 'word';
      if (name.endsWith('.md') || name.endsWith('.markdown')) return 'markdown';
      if (type.startsWith('text/') || name.endsWith('.txt')) return 'plain-text';
      return 'file';
    }

    function bytesToBase64(bytes) {
      let binary = '';
      const chunk = 0x8000;
      for (let index = 0; index < bytes.length; index += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
      }
      return btoa(binary);
    }

    $('logout').addEventListener('click', async () => {
      await api('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
      window.location.assign('/login');
    });

    loadSession().then(loadProjects).then(loadBoard).catch(showError);
  </script>
</body>
</html>
`;
}
