import type { WebAuthAudience } from '../audience.js';

const COPY: Record<WebAuthAudience, { readonly title: string; readonly body: string }> = {
  customer: {
    title: '客户界面',
    body: '这里将只展示你的项目、需求对话和进度。完整录入工作台尚未迁入本界面。',
  },
  developer: {
    title: '开发界面',
    body: '开发驾驶舱在 /developer。',
  },
  admin: {
    title: '管理员界面',
    body: '这里将管理用户、项目归属、环境就绪和访问设置。完整 Admin 工作台尚未迁入本界面。',
  },
};

export function renderAudienceDeniedPage(audience: WebAuthAudience): string {
  return renderSimplePage(
    '无权访问该界面',
    `当前账号属于 ${audience} 人群，不能打开其他人群的界面。`,
  );
}

export function renderAudienceShellPage(audience: WebAuthAudience): string {
  const copy = COPY[audience];
  return renderSimplePage(copy.title, copy.body);
}

function renderSimplePage(title: string, body: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · HuntianLing</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #f4f6f8; color: #1f2933; }
    main { max-width: 36rem; margin: 12vh auto; padding: 1.5rem; background: #fff; border: 1px solid #d8e1e7; border-radius: 8px; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(body)}</p>
  </main>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
