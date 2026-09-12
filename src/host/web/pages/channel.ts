/**
 * Developer-shell Agent Channel. Not the customer MKT dialog.
 */

export function renderChannelPage(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Agent 频道 · HuntianLing</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #f4f6f8; color: #1f2933; }
    main { max-width: 48rem; margin: 0 auto; padding: 1.25rem; }
    .msg { padding: 0.5rem 0; border-bottom: 1px solid #d8e1e7; }
    .muted { color: #60717f; font-size: 0.85rem; }
  </style>
</head>
<body>
  <main>
    <h1>Agent 频道</h1>
    <p class="muted">开发者与 Planner / Generator / Evaluator 的类型化协作。客户不会进入此频道。</p>
    <label>项目 ID <input id="project-id"></label>
    <button id="open" type="button">打开会话</button>
    <div id="log"></div>
    <form id="note">
      <label>备注 <input id="body" required></label>
      <button type="submit">发送 note.chat</button>
    </form>
  </main>
  <script>
    const state = { conversationId: '' };
    async function api(path, options = {}) {
      const response = await fetch(path, { headers: { 'content-type': 'application/json' }, ...options });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || response.statusText);
      return payload;
    }
    document.getElementById('open').onclick = async () => {
      const projectId = document.getElementById('project-id').value.trim();
      const created = await api('/api/v1/team/conversations', {
        method: 'POST',
        body: JSON.stringify({ projectId, title: 'Agent Channel' }),
      });
      state.conversationId = created.id;
      document.getElementById('log').textContent = '会话 ' + created.id;
    };
    document.getElementById('note').onsubmit = async (event) => {
      event.preventDefault();
      await api('/api/v1/team/conversations/' + state.conversationId + '/messages', {
        method: 'POST',
        body: JSON.stringify({
          type: 'note.chat',
          from: { kind: 'human', role: 'developer' },
          payload: { body: document.getElementById('body').value },
        }),
      });
    };
  </script>
</body>
</html>
`;
}
