/**
 * Unauthenticated login document. Does not render the fused board.
 */

export function renderLoginPage(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>登录 · HuntianLing</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #f4f6f8; color: #1f2933; }
    main { max-width: 24rem; margin: 12vh auto; padding: 1.5rem; background: #fff; border: 1px solid #d8e1e7; border-radius: 8px; }
    h1 { font-size: 1.25rem; margin: 0 0 1rem; }
    label { display: grid; gap: 0.25rem; margin-bottom: 0.75rem; font-size: 0.9rem; }
    input, select { padding: 0.4rem 0.5rem; }
    button { padding: 0.5rem 0.75rem; }
    .error { color: #b1423f; min-height: 1.25rem; }
    .muted { color: #60717f; font-size: 0.85rem; }
    #providers { display: grid; gap: 0.35rem; margin: 0.75rem 0; }
  </style>
</head>
<body>
  <main>
    <h1>HuntianLing 登录</h1>
    <p>登录后进入你的人群界面，不会打开开发驾驶舱。</p>
    <form id="login-form">
      <label>区域
        <select id="region" name="region">
          <option value="global">Global</option>
          <option value="cn">中国</option>
          <option value="auto">自动</option>
        </select>
      </label>
      <label>账号 <input id="username" name="username" autocomplete="username"></label>
      <label>密码 <input id="password" name="password" type="password" autocomplete="current-password"></label>
      <button type="submit">登录</button>
    </form>
    <p class="muted">或使用第三方登录</p>
    <div id="providers"></div>
    <p id="error" class="error"></p>
  </main>
  <script>
    const region = document.getElementById('region');
    async function loadProviders() {
      const query = region.value === 'auto' ? '' : ('?region=' + encodeURIComponent(region.value));
      const payload = await fetch('/api/auth/providers' + query).then((item) => item.json());
      const list = document.getElementById('providers');
      list.innerHTML = '';
      for (const provider of payload.providers || []) {
        if (!provider.enabled || !provider.loginUrl) continue;
        const link = document.createElement('a');
        link.href = provider.loginUrl + (region.value === 'auto' ? '' : ('?region=' + encodeURIComponent(region.value)));
        link.textContent = provider.label || provider.id;
        list.append(link);
      }
    }
    region.addEventListener('change', () => { loadProviders().catch(() => undefined); });
    loadProviders().catch(() => undefined);
    document.getElementById('login-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const error = document.getElementById('error');
      error.textContent = '';
      const response = await fetch('/api/auth/password/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: document.getElementById('username').value,
          password: document.getElementById('password').value,
          region: document.getElementById('region').value,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        error.textContent = payload.error || '登录失败';
        return;
      }
      window.location.assign(payload.shellPath || '/developer');
    });
  </script>
</body>
</html>
`;
}
