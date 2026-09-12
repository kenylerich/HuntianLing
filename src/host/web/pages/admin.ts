/**
 * Admin shell: users, membership, environment, access, audit.
 */

export function renderAdminPage(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>管理员界面 · HuntianLing</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #f4f6f8; color: #1f2933; }
    header, nav, main { max-width: 56rem; margin: 0 auto; padding: 0.75rem 1.25rem; }
    nav { display: flex; gap: 0.5rem; }
    nav button[aria-current="page"] { font-weight: 700; }
    section { background: #fff; border: 1px solid #d8e1e7; border-radius: 8px; padding: 1rem; }
    .row { border-top: 1px solid #e4ebf0; padding: 0.5rem 0; }
    .muted { color: #60717f; font-size: 0.85rem; }
    label { display: grid; gap: 0.25rem; margin: 0.4rem 0; font-size: 0.9rem; }
    input, select, button { font: inherit; padding: 0.35rem 0.5rem; }
  </style>
</head>
<body>
  <header>
    <h1>管理员界面</h1>
    <span id="who" class="muted"></span>
    <button id="logout" type="button">退出</button>
  </header>
  <nav aria-label="管理工作">
    <button type="button" data-job="users">用户</button>
    <button type="button" data-job="membership">归属</button>
    <button type="button" data-job="environment">环境</button>
    <button type="button" data-job="access">访问</button>
    <button type="button" data-job="audit">审计</button>
  </nav>
  <main>
    <section>
      <h2 id="job-title">用户</h2>
      <div id="canvas"></div>
    </section>
  </main>
  <script>
    const jobs = { users: '用户', membership: '归属', environment: '环境', access: '访问', audit: '审计' };
    const state = { job: 'users' };
    function $(id) { return document.getElementById(id); }
    async function api(path, options = {}) {
      const response = await fetch(path, { headers: { 'content-type': 'application/json', ...(options.headers || {}) }, ...options });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || response.statusText);
      return payload;
    }
    async function render() {
      $('job-title').textContent = jobs[state.job];
      for (const button of document.querySelectorAll('nav [data-job]')) {
        button.setAttribute('aria-current', button.getAttribute('data-job') === state.job ? 'page' : 'false');
      }
      const canvas = $('canvas');
      canvas.textContent = '加载中…';
      try {
        if (state.job === 'users' || state.job === 'membership') {
          const payload = await api('/api/v1/admin/users');
          const events = await api('/api/v1/admin/auth-events');
          canvas.innerHTML =
            '<form id="create-user">' +
            '<input name="username" placeholder="用户名" required>' +
            '<input name="password" type="password" placeholder="密码" required>' +
            '<select name="audience"><option value="developer">developer</option><option value="admin">admin</option><option value="customer">customer</option></select>' +
            '<button type="submit">创建用户</button></form>' +
            (payload.users.map((user) =>
              '<div class="row"><strong>' + user.username + '</strong> · ' + user.audience + ' · 项目 ' + user.projectIds.length + '</div>'
            ).join('') || '<p class="muted">没有用户</p>') +
            '<h3>登录审计</h3>' +
            ((events.events || []).map((event) =>
              '<div class="row">' + event.action + ' · ' + event.actorId + '</div>'
            ).join('') || '<p class="muted">没有登录审计</p>');
          const form = document.getElementById('create-user');
          form.onsubmit = async (event) => {
            event.preventDefault();
            await api('/api/v1/admin/users', {
              method: 'POST',
              body: JSON.stringify({
                username: form.elements.username.value,
                password: form.elements.password.value,
                audience: form.elements.audience.value,
              }),
            });
            render();
          };
          return;
        }
        if (state.job === 'access') {
          const payload = await api('/api/v1/admin/access');
          canvas.innerHTML = '<p>认证 ' + payload.enabled + '</p><p>区域 ' + payload.regionMode + '</p>';
          return;
        }
        if (state.job === 'environment') {
          const payload = await api('/api/v1/admin/environment');
          canvas.innerHTML = '<pre>' + JSON.stringify(payload, null, 2) + '</pre>';
          return;
        }
        const projects = await api('/api/v1/projects');
        const project = (projects.projects || [])[0];
        if (!project) { canvas.textContent = '没有项目'; return; }
        const audit = await api('/api/v1/admin/audit?projectId=' + encodeURIComponent(project.id));
        canvas.innerHTML = (audit.auditEvents || []).map((event) =>
          '<div class="row">' + event.action + ' · ' + event.targetType + ' · ' + event.actorId + '</div>'
        ).join('') || '<p class="muted">没有审计事件</p>';
      } catch (error) {
        canvas.textContent = error.message;
      }
    }
    for (const button of document.querySelectorAll('nav [data-job]')) {
      button.addEventListener('click', () => { state.job = button.getAttribute('data-job'); render(); });
    }
    $('logout').onclick = async () => {
      await api('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
      location.assign('/login');
    };
    api('/api/auth/session').then((session) => {
      if (session.auth && session.auth.enabled && !session.authenticated) location.assign('/login');
      if (session.principal) $('who').textContent = session.principal.displayName;
    }).then(render);
  </script>
</body>
</html>
`;
}
