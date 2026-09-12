export function renderBoardPage(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>HuntianLing Board</title>
  <style>
    :root {
      color-scheme: light;
      --surface: #f4f6f8;
      --panel: #ffffff;
      --panel-soft: #eef3f6;
      --line: #d8e1e7;
      --line-strong: #aebdc8;
      --ink: #1f2933;
      --muted: #60717f;
      --accent: #006d77;
      --accent-strong: #07545d;
      --amber: #9b6211;
      --green: #20744f;
      --red: #b1423f;
      --blue: #315a9f;
      --violet: #6a558d;
      --shadow: 0 16px 34px rgba(24, 35, 45, 0.10);
      --radius: 8px;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    [hidden] {
      display: none !important;
    }

    html,
    body {
      min-height: 100%;
    }

    body {
      margin: 0;
      background: var(--surface);
      color: var(--ink);
      font-size: 14px;
      letter-spacing: 0;
    }

    button,
    input,
    select,
    textarea {
      font: inherit;
    }

    ::selection {
      background: rgba(13, 104, 107, 0.22);
      color: var(--ink);
    }

    :focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    .shell {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 116px minmax(248px, 292px) minmax(0, 1fr);
      grid-template-rows: auto 1fr;
    }

    header {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 18px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.88);
      backdrop-filter: blur(8px);
      position: sticky;
      top: 0;
      z-index: 3;
    }

    .brand {
      display: flex;
      align-items: baseline;
      gap: 10px;
      min-width: 0;
    }

    .brand h1 {
      margin: 0;
      font-size: 1.2rem;
      line-height: 1.2;
      font-weight: 740;
    }

    .brand span {
      color: var(--muted);
      white-space: nowrap;
    }

    .toolbar {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      flex-wrap: wrap;
    }

    .toolbar select {
      width: clamp(190px, 28vw, 360px);
    }

    .toolbar .view-select-fallback {
      display: none;
    }

    .toolbar button {
      width: auto;
      flex: 0 0 auto;
    }

    .module-rail {
      grid-column: 1;
      grid-row: 2;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 14px 10px;
      border-right: 1px solid var(--line);
      background: #fbfcfd;
      overflow: auto;
    }

    .module-rail button {
      display: grid;
      justify-items: start;
      align-content: center;
      gap: 2px;
      min-height: 50px;
      padding: 8px 9px;
      border-color: transparent;
      background: transparent;
      color: var(--muted);
      font-size: 0.78rem;
      line-height: 1.25;
      text-align: left;
    }

    .module-rail button:hover {
      border-color: var(--line);
      background: var(--panel-soft);
      color: var(--ink);
    }

    .module-rail button.active {
      border-color: rgba(0, 109, 119, 0.24);
      background: #e7f5f3;
      color: var(--accent-strong);
      font-weight: 700;
    }

    .module-label {
      color: var(--ink);
      font-weight: 720;
      overflow-wrap: anywhere;
    }

    .module-stage {
      color: var(--muted);
      font-size: 0.7rem;
      overflow-wrap: anywhere;
    }

    .sidebar {
      grid-column: 2;
      grid-row: 2;
      border-right: 1px solid var(--line);
      background: var(--panel-soft);
      padding: 16px;
      overflow: auto;
    }

    main {
      grid-column: 3;
      grid-row: 2;
      min-width: 0;
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
    }

    .workspace-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 16px;
      align-items: start;
      padding: 16px;
      border-bottom: 1px solid var(--line);
      background: #fff;
    }

    .workspace-head-copy {
      display: grid;
      gap: 6px;
      min-width: 0;
    }

    .workspace-stage {
      color: var(--accent-strong);
      font-size: 0.78rem;
      font-weight: 760;
      line-height: 1.25;
    }

    .workspace-head h2 {
      margin: 0;
      font-size: 1.12rem;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }

    .workspace-head p {
      max-width: 72ch;
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
    }

    .workspace-context,
    .view-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
    }

    .view-tabs {
      justify-content: flex-end;
      align-self: start;
      padding: 3px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel-soft);
    }

    .view-tab {
      min-width: 0;
      max-width: none;
      min-height: 30px;
      padding: 6px 10px;
      text-align: left;
      border-color: transparent;
      background: transparent;
    }

    .view-tab strong {
      line-height: 1.25;
      white-space: nowrap;
    }

    .view-tab span {
      display: none;
    }

    .view-tab.active {
      border-color: #fff;
      background: #fff;
      color: var(--accent-strong);
      box-shadow: 0 1px 2px rgba(24, 35, 45, 0.08);
    }

    .workspace {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      min-height: 0;
    }

    .board-summary {
      display: grid;
      grid-template-columns: minmax(180px, 0.42fr) minmax(0, 1fr);
      gap: 12px;
      padding: 14px 16px 0;
      background: var(--surface);
    }

    .board-summary.compact {
      grid-template-columns: minmax(0, 1fr);
    }

    .board {
      min-width: 0;
      padding: 16px;
      overflow: auto;
    }

    .section-heading {
      display: grid;
      gap: 4px;
      margin-bottom: 10px;
    }

    .section-heading h2 {
      margin: 0;
    }

    .section-heading p {
      margin: 0;
      line-height: 1.45;
    }

    .detail {
      border-top: 1px solid var(--line);
      background: var(--panel);
      padding: 16px;
      overflow: auto;
    }

    .section {
      margin-bottom: 18px;
      min-width: 0;
    }

    .section h2,
    .section h3 {
      margin: 0 0 8px;
      font-size: 0.95rem;
      line-height: 1.3;
    }

    .composer-panel {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #fff;
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .composer-panel > summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 12px;
      color: var(--ink);
      cursor: pointer;
      font-weight: 720;
      list-style: none;
    }

    .composer-panel > summary::-webkit-details-marker {
      display: none;
    }

    .composer-panel > summary::after {
      content: "+";
      color: var(--accent);
      font-weight: 760;
    }

    .composer-panel[open] > summary::after {
      content: "-";
    }

    .composer-panel .controls {
      padding: 12px;
      border-top: 1px solid var(--line);
    }

    .muted {
      color: var(--muted);
    }

    .controls {
      display: grid;
      gap: 8px;
    }

    .trace-edit {
      display: grid;
      gap: 8px;
      min-width: 0;
    }

    .auth-card {
      display: grid;
      gap: 10px;
    }

    body.auth-locked .toolbar select,
    body.auth-locked #refresh-button,
    body.auth-locked #view-tabs button,
    body.auth-locked .module-rail button:not([data-area-id="settings"]),
    body.auth-locked .sidebar .context-panel:not(.auth-panel-section),
    body.auth-locked .board,
    body.auth-locked .detail {
      opacity: 0.48;
      pointer-events: none;
    }

    body[data-current-area-id="settings"]:not(.auth-locked) .sidebar .context-panel[data-area-panel="settings"] {
      display: none;
    }

    .auth-user {
      display: grid;
      gap: 3px;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--panel);
    }

    .provider-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .provider-list button {
      flex: 1 1 86px;
    }

    .inline {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    label {
      display: grid;
      gap: 4px;
      color: var(--muted);
      font-size: 0.78rem;
      line-height: 1.25;
    }

    input,
    select,
    textarea {
      width: 100%;
      min-width: 0;
      border: 1px solid var(--line-strong);
      border-radius: 6px;
      background: #fff;
      color: var(--ink);
      padding: 8px 9px;
    }

    input[type="checkbox"] {
      width: auto;
      min-width: 16px;
    }

    textarea {
      min-height: 82px;
      resize: vertical;
    }

    button {
      border: 1px solid var(--line-strong);
      border-radius: 6px;
      background: #fff;
      color: var(--ink);
      padding: 8px 10px;
      min-height: 34px;
      cursor: pointer;
      transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
    }

    button:hover {
      border-color: var(--accent);
      background: #f2fbfa;
    }

    button:active {
      background: #e1f1ef;
    }

    button.primary {
      border-color: var(--accent);
      background: var(--accent);
      color: #fff;
    }

    button.primary:hover {
      border-color: var(--accent-strong);
      background: var(--accent-strong);
    }

    button:disabled {
      border-color: var(--line);
      background: var(--panel-soft);
      color: #89958f;
      cursor: not-allowed;
    }

    .status {
      min-height: 32px;
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: #fff;
      color: var(--muted);
      align-self: stretch;
      display: flex;
      align-items: center;
    }

    .status.error {
      border-color: rgba(162, 58, 50, 0.45);
      background: #fff2ef;
      color: var(--red);
    }

    .health {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
      gap: 8px;
    }

    .columns {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(272px, 1fr);
      gap: 12px;
      align-items: start;
    }

    .backlog-board {
      display: grid;
      gap: 12px;
      align-items: start;
      min-width: 0;
    }

    .backlog-board > .columns {
      min-width: 0;
      overflow-x: auto;
      padding-bottom: 4px;
    }

    .backlog-workbench {
      display: grid;
      gap: 12px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #fff;
      padding: 12px;
      box-shadow: 0 8px 20px rgba(24, 35, 45, 0.07);
    }

    .backlog-workbench-header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: start;
    }

    .backlog-workbench-title {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .backlog-workbench-title strong {
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .backlog-workbench-title span {
      color: var(--muted);
      font-size: 0.78rem;
      line-height: 1.35;
    }

    .backlog-workbench-title h3,
    .backlog-list-head h3,
    .backlog-flow-head h3 {
      margin: 0;
      font-size: 0.98rem;
      line-height: 1.3;
    }

    .backlog-filter-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
      gap: 8px;
      align-items: end;
    }

    .backlog-filter-grid label:first-child {
      grid-column: span 2;
    }

    .backlog-filter-check {
      display: flex;
      align-items: center;
      gap: 7px;
      min-height: 38px;
      padding: 8px 9px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel-soft);
      color: var(--ink);
    }

    .backlog-filter-check input {
      width: auto;
    }

    .backlog-risk-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }

    .backlog-risk {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 8px;
      align-items: center;
      min-height: 58px;
      text-align: left;
      background: var(--panel-soft);
    }

    .backlog-risk.active {
      border-color: var(--accent);
      background: #eef9f7;
    }

    .backlog-risk strong {
      display: block;
      font-size: 1rem;
      font-variant-numeric: tabular-nums;
    }

    .backlog-risk span {
      color: var(--muted);
      font-size: 0.74rem;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .backlog-view-manager {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(260px, 0.72fr);
      gap: 10px;
      align-items: start;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel-soft);
    }

    .workbench-tools-drawer,
    .workflow-support-drawer {
      display: grid;
      gap: 0;
      min-width: 0;
    }

    .workbench-tools-drawer > summary,
    .workflow-support-drawer > summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-height: 38px;
      padding: 9px 10px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel-soft);
      cursor: pointer;
      font-weight: 720;
      list-style: none;
    }

    .workbench-tools-drawer > summary::-webkit-details-marker,
    .workflow-support-drawer > summary::-webkit-details-marker {
      display: none;
    }

    .workbench-tools-drawer[open] > summary,
    .workflow-support-drawer[open] > summary {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
    }

    .workbench-tools-body,
    .workflow-support-drawer-body {
      display: grid;
      gap: 12px;
      min-width: 0;
      padding-top: 10px;
    }

    .backlog-view-tools,
    .backlog-column-tools {
      display: grid;
      gap: 8px;
      min-width: 0;
    }

    .backlog-view-tools h3,
    .backlog-column-tools h3 {
      margin: 0;
      font-size: 0.9rem;
      line-height: 1.3;
    }

    .backlog-view-presets,
    .backlog-column-checks {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .backlog-view-presets button {
      min-height: 30px;
      padding: 6px 8px;
    }

    .backlog-view-presets button.active {
      border-color: var(--accent);
      background: #eef9f7;
      color: var(--accent-strong);
      font-weight: 700;
    }

    .backlog-column-checks label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 30px;
      padding: 5px 8px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: #fff;
      color: var(--ink);
      font-size: 0.75rem;
      white-space: nowrap;
    }

    .backlog-column-checks input {
      width: auto;
      min-width: 14px;
    }

    .backlog-view-save {
      display: grid;
      grid-template-columns: minmax(150px, 1fr) minmax(150px, 1fr) auto auto;
      gap: 6px;
      align-items: end;
    }

    .backlog-level-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }

    .backlog-level {
      display: grid;
      gap: 6px;
      min-height: 92px;
      padding: 10px;
      text-align: left;
      background: #fff;
    }

    .backlog-level.active {
      border-color: var(--accent);
      background: #eef9f7;
      color: var(--accent-strong);
    }

    .backlog-level strong {
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .backlog-level span {
      color: var(--muted);
      font-size: 0.74rem;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .backlog-level .meta {
      margin-top: 2px;
    }

    .backlog-queue-strip {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(220px, 1fr);
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 2px;
    }

    .backlog-queue-item {
      display: grid;
      gap: 5px;
      text-align: left;
      min-height: 74px;
      background: #fff;
    }

    .backlog-queue-item.selected {
      border-color: var(--accent);
      background: #eef9f7;
    }

    .backlog-queue-item strong {
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .backlog-planning-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      align-items: start;
      min-width: 0;
    }

    .backlog-planning-panel {
      display: grid;
      gap: 8px;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #fff;
      padding: 10px;
      box-shadow: var(--shadow);
    }

    .backlog-planning-panel h3 {
      margin: 0;
      font-size: 0.9rem;
      line-height: 1.3;
    }

    .backlog-panel-list {
      display: grid;
      gap: 6px;
      min-width: 0;
    }

    .backlog-panel-item {
      width: 100%;
      display: grid;
      gap: 5px;
      min-height: 56px;
      padding: 8px;
      text-align: left;
      background: #fff;
    }

    .backlog-panel-item.active,
    .backlog-panel-item.selected {
      border-color: var(--accent);
      background: #eef9f7;
      color: var(--accent-strong);
    }

    .backlog-panel-item strong {
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .backlog-decision-grid {
      display: grid;
      grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
      gap: 12px;
      align-items: start;
      min-width: 0;
    }

    .backlog-decision-panel {
      display: grid;
      gap: 10px;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #fff;
      padding: 10px;
      box-shadow: var(--shadow);
    }

    .backlog-decision-panel h3 {
      margin: 0;
      font-size: 0.9rem;
      line-height: 1.3;
    }

    .backlog-signal-list,
    .backlog-delivery-list {
      display: grid;
      gap: 7px;
      min-width: 0;
    }

    .backlog-signal-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      min-height: 40px;
      padding: 7px 8px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel-soft);
    }

    .backlog-signal-row strong {
      overflow-wrap: anywhere;
    }

    .backlog-delivery-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: start;
      min-width: 0;
      padding: 9px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
    }

    .backlog-delivery-main {
      display: grid;
      gap: 5px;
      min-width: 0;
    }

    .backlog-delivery-main strong {
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .backlog-delivery-main p {
      margin: 0;
      color: var(--muted);
      line-height: 1.42;
      overflow-wrap: anywhere;
    }

    .backlog-delivery-actions {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-end;
      min-width: 128px;
    }

    .backlog-delivery-actions button {
      min-height: 30px;
      padding: 6px 8px;
    }

    .backlog-split {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(274px, 320px);
      gap: 12px;
      align-items: start;
      min-width: 0;
    }

    .backlog-command-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(296px, 352px);
      gap: 12px;
      align-items: start;
      min-width: 0;
    }

    .backlog-primary,
    .backlog-insights {
      display: grid;
      gap: 12px;
      min-width: 0;
    }

    .backlog-support-drawer {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #fff;
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .backlog-support-drawer > summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 44px;
      padding: 12px;
      cursor: pointer;
      list-style: none;
      font-weight: 740;
    }

    .backlog-support-drawer > summary::-webkit-details-marker {
      display: none;
    }

    .backlog-support-drawer[open] > summary {
      border-bottom: 1px solid var(--line);
      background: var(--panel-soft);
    }

    .backlog-support-drawer .backlog-insights {
      padding: 12px;
      background: var(--surface);
    }

    .backlog-command-layout .backlog-planning-grid,
    .backlog-command-layout .backlog-decision-grid {
      grid-template-columns: 1fr;
    }

    .backlog-insights .backlog-queue-strip {
      grid-auto-flow: row;
      grid-auto-columns: auto;
    }

    .backlog-list-panel,
    .backlog-flow-panel {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #fff;
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .backlog-list-head,
    .backlog-flow-head {
      display: grid;
      gap: 6px;
      padding: 12px;
      border-bottom: 1px solid var(--line);
      background: #fff;
    }

    .backlog-table-head,
    .backlog-row {
      display: grid;
      grid-template-columns: var(--backlog-grid-template, minmax(250px, 1.35fr) minmax(142px, 0.66fr) minmax(166px, 0.78fr) minmax(150px, 0.7fr) minmax(174px, 0.82fr));
      gap: 10px;
      align-items: start;
    }

    .backlog-table-head {
      padding: 8px 12px;
      border-bottom: 1px solid var(--line);
      background: var(--panel-soft);
      color: var(--muted);
      font-size: 0.72rem;
      font-weight: 760;
    }

    .backlog-group-heading {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 10px 12px;
      border-top: 1px solid var(--line);
      background: #fbfcfd;
    }

    .backlog-group-heading:first-of-type {
      border-top: 0;
    }

    .backlog-group-heading strong {
      overflow-wrap: anywhere;
    }

    .backlog-row {
      width: 100%;
      min-height: 92px;
      padding: 11px 12px;
      border: 0;
      border-top: 1px solid var(--line);
      border-radius: 0;
      background: #fff;
      text-align: left;
      cursor: default;
    }

    .backlog-row:hover {
      background: #f7fbfa;
    }

    .backlog-row.batch-selected {
      background: #f7fbff;
    }

    .backlog-row.selected {
      background: #eef9f7;
      box-shadow: inset 3px 0 0 var(--accent);
    }

    .backlog-row-title,
    .backlog-cell {
      display: grid;
      gap: 5px;
      min-width: 0;
      align-content: start;
    }

    .backlog-row-main {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 8px;
      align-items: start;
      min-width: 0;
    }

    .backlog-row-check {
      margin-top: 3px;
    }

    .backlog-title-button {
      width: 100%;
      display: block;
      min-height: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }

    .backlog-title-button:hover {
      background: transparent;
      color: var(--accent-strong);
    }

    .backlog-title-button:focus-visible {
      outline-offset: 3px;
    }

    .backlog-row-title strong {
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .backlog-row-title p,
    .backlog-cell p {
      margin: 0;
      color: var(--muted);
      line-height: 1.42;
      overflow-wrap: anywhere;
    }

    .backlog-cell-label {
      display: none;
      color: var(--muted);
      font-size: 0.72rem;
      font-weight: 760;
    }

    .backlog-bulk-bar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: end;
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      background: #fbfcfd;
    }

    .backlog-bulk-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }

    .backlog-bulk-form {
      display: grid;
      grid-template-columns: minmax(110px, 1fr) minmax(130px, 1fr) minmax(120px, 1fr) auto;
      gap: 6px;
      align-items: end;
      min-width: min(100%, 620px);
    }

    .backlog-flow-list {
      display: grid;
      gap: 10px;
      padding: 10px;
      background: var(--panel-soft);
    }

    .backlog-flow-group {
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      overflow: hidden;
    }

    .backlog-flow-group-title {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      padding: 8px 10px;
      border-bottom: 1px solid var(--line);
      background: #fff;
    }

    .backlog-flow-group-title strong {
      overflow-wrap: anywhere;
    }

    .backlog-flow-item {
      width: 100%;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      min-height: 36px;
      padding: 7px 10px;
      border: 0;
      border-top: 1px solid var(--line);
      border-radius: 0;
      background: transparent;
      text-align: left;
    }

    .backlog-flow-item:first-of-type {
      border-top: 0;
    }

    .backlog-flow-item.active {
      background: #eef9f7;
      color: var(--accent-strong);
      font-weight: 720;
    }

    .backlog-flow-count {
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }

    .tree-board,
    .coverage-board,
    .milestone-board,
    .delivery-board,
    .team-board,
    .workflow-board,
    .evidence-board,
    .crud-board,
    .audit-board,
    .intake-board {
      display: grid;
      gap: 12px;
      align-items: start;
    }

    .tree-board-summary,
    .coverage-summary,
    .milestone-board-summary,
    .delivery-board-summary,
    .team-board-summary,
    .workflow-board-summary,
    .evidence-board-summary,
    .crud-summary-grid,
    .audit-summary-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }

    .team-board-summary,
    .coverage-summary,
    .milestone-board-summary,
    .delivery-board-summary,
    .evidence-board-summary,
    .crud-summary-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .workflow-board-summary {
      grid-template-columns: repeat(auto-fit, minmax(108px, 1fr));
    }

    .milestone-lanes {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(292px, 1fr);
      gap: 12px;
      align-items: start;
    }

    .planning-workbench {
      display: grid;
      grid-template-columns: minmax(0, 1.08fr) minmax(300px, 0.92fr);
      gap: 12px;
      align-items: start;
      min-width: 0;
    }

    .delivery-slice-workbench {
      grid-template-columns: minmax(0, 1fr) minmax(320px, 0.8fr);
    }

    .planning-panel-stack {
      display: grid;
      gap: 12px;
      min-width: 0;
    }

    .planning-panel,
    .milestone-lanes-panel {
      display: grid;
      gap: 10px;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #fff;
      padding: 12px;
      box-shadow: var(--shadow);
    }

    .planning-panel h3,
    .planning-panel summary,
    .milestone-lanes-panel summary {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.3;
      font-weight: 760;
    }

    .planning-panel summary,
    .milestone-lanes-panel summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      cursor: pointer;
      list-style: none;
    }

    .planning-panel summary::-webkit-details-marker,
    .milestone-lanes-panel summary::-webkit-details-marker {
      display: none;
    }

    .planning-timeline,
    .planning-scope-matrix,
    .planning-focus-list,
    .delivery-slice-queue,
    .planning-risk-list,
    .delivery-parent-map {
      display: grid;
      gap: 7px;
      min-width: 0;
    }

    .planning-timeline-row,
    .planning-scope-row,
    .planning-focus-row,
    .delivery-slice-row,
    .planning-risk-row,
    .delivery-parent-row {
      display: grid;
      gap: 8px;
      align-items: start;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel-soft);
      padding: 9px;
      text-align: left;
    }

    .planning-timeline-row {
      grid-template-columns: minmax(0, 1fr) minmax(172px, 0.48fr);
    }

    .planning-focus-row {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
    }

    .planning-scope-row {
      grid-template-columns: minmax(0, 1fr) minmax(150px, 0.42fr) minmax(150px, 0.42fr) auto;
      align-items: center;
    }

    .delivery-slice-row,
    .planning-risk-row,
    .delivery-parent-row {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .planning-timeline-row.ready,
    .planning-focus-row.ready,
    .planning-scope-row.ready,
    .delivery-slice-row.ready,
    .delivery-parent-row.ready {
      border-color: rgba(32, 116, 79, 0.24);
      background: #eff8f3;
    }

    .planning-timeline-row.warning,
    .planning-focus-row.warning,
    .planning-scope-row.warning,
    .delivery-slice-row.warning,
    .delivery-parent-row.warning,
    .planning-risk-row.warning {
      border-color: rgba(155, 98, 17, 0.28);
      background: #fff8ec;
    }

    .planning-timeline-row.blocking,
    .planning-focus-row.blocking,
    .planning-scope-row.blocking,
    .delivery-slice-row.blocking,
    .delivery-parent-row.blocking,
    .planning-risk-row.blocking {
      border-color: rgba(177, 66, 63, 0.26);
      background: #fff6f4;
    }

    .planning-row-main {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .planning-row-main strong {
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .planning-row-main p {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .planning-meter-group {
      display: grid;
      gap: 7px;
      min-width: 0;
    }

    .planning-meter {
      display: grid;
      gap: 5px;
      min-width: 0;
    }

    .planning-meter header {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 0;
      border: 0;
      background: transparent;
      position: static;
      font-size: 0.75rem;
      color: var(--muted);
    }

    .planning-meter-track {
      height: 6px;
      overflow: hidden;
      border-radius: 999px;
      background: #dfe8ed;
    }

    .planning-meter-fill {
      height: 100%;
      border-radius: inherit;
      background: var(--accent);
    }

    .delivery-slice-row button,
    .planning-risk-row button,
    .delivery-parent-row button {
      min-height: 30px;
      padding: 6px 8px;
      white-space: nowrap;
    }

    .milestone-lanes-panel .milestone-lanes {
      margin-top: 10px;
    }

    .team-lanes {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(292px, 1fr);
      gap: 12px;
      align-items: start;
    }

    .team-workbench {
      display: grid;
      grid-template-columns: minmax(0, 1.12fr) minmax(300px, 0.88fr);
      gap: 12px;
      align-items: start;
      min-width: 0;
    }

    .team-panel-stack {
      display: grid;
      gap: 12px;
      min-width: 0;
    }

    .team-panel,
    .team-lanes-panel {
      display: grid;
      gap: 10px;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #fff;
      padding: 12px;
      box-shadow: var(--shadow);
    }

    .team-panel h3,
    .team-lanes-panel summary {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.3;
      font-weight: 760;
    }

    .team-lanes-panel summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      cursor: pointer;
      list-style: none;
    }

    .team-lanes-panel summary::-webkit-details-marker {
      display: none;
    }

    .team-capacity-list,
    .team-assignment-list,
    .team-risk-list,
    .team-role-coverage-list {
      display: grid;
      gap: 7px;
      min-width: 0;
    }

    .team-capacity-row,
    .team-assignment-row,
    .team-risk-row,
    .team-role-coverage-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(136px, 0.36fr) auto;
      gap: 10px;
      align-items: center;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel-soft);
      padding: 9px;
      text-align: left;
    }

    .team-assignment-row,
    .team-risk-row {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
    }

    .team-capacity-row.ready,
    .team-role-coverage-row.ready {
      border-color: rgba(32, 116, 79, 0.24);
      background: #eff8f3;
    }

    .team-capacity-row.warning,
    .team-risk-row.warning,
    .team-role-coverage-row.warning {
      border-color: rgba(155, 98, 17, 0.28);
      background: #fff8ec;
    }

    .team-capacity-row.blocking,
    .team-risk-row.blocking,
    .team-role-coverage-row.blocking {
      border-color: rgba(177, 66, 63, 0.26);
      background: #fff6f4;
    }

    .team-row-main {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .team-row-main strong {
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .team-row-main p {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .team-capacity-meter {
      display: grid;
      gap: 5px;
      min-width: 0;
    }

    .team-capacity-meter span {
      color: var(--muted);
      font-size: 0.74rem;
      font-variant-numeric: tabular-nums;
      line-height: 1.25;
    }

    .team-role-lanes {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(286px, 1fr);
      gap: 12px;
      align-items: start;
      overflow-x: auto;
      padding-bottom: 3px;
    }

    .team-role-lane {
      min-height: 244px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 255, 255, 0.86);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .team-role-lane.warning {
      border-color: rgba(155, 98, 17, 0.28);
      background: #fffaf0;
    }

    .team-role-lane > header {
      position: static;
      display: grid;
      gap: 6px;
      padding: 10px 12px;
      background: #fff;
      border-bottom: 1px solid var(--line);
      backdrop-filter: none;
    }

    .team-role-lane > header strong {
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .team-work-card {
      width: 100%;
      display: grid;
      gap: 6px;
      min-height: 98px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      padding: 9px;
      color: var(--ink);
      text-align: left;
      cursor: pointer;
    }

    .team-work-card:hover {
      background: #f7fbfa;
    }

    .team-work-card.selected {
      border-color: var(--accent);
      background: #eef9f7;
      box-shadow: inset 3px 0 0 var(--accent);
    }

    .team-work-card strong {
      line-height: 1.32;
      overflow-wrap: anywhere;
    }

    .team-work-card p {
      margin: 0;
      color: var(--muted);
      line-height: 1.42;
      overflow-wrap: anywhere;
    }

    .workflow-lanes,
    .agile-lifecycle-lanes,
    .evidence-lanes {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(306px, 1fr);
      gap: 12px;
      align-items: start;
    }

    .workflow-workbench {
      display: grid;
      grid-template-columns: minmax(0, 1.14fr) minmax(304px, 0.86fr);
      gap: 12px;
      align-items: start;
      min-width: 0;
    }

    .workflow-panel-stack {
      display: grid;
      gap: 12px;
      min-width: 0;
    }

    .workflow-panel,
    .workflow-lanes-panel {
      display: grid;
      gap: 10px;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #fff;
      padding: 12px;
      box-shadow: var(--shadow);
    }

    .workflow-panel h3,
    .workflow-lanes-panel summary {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.3;
      font-weight: 760;
    }

    .workflow-lanes-panel summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      cursor: pointer;
      list-style: none;
    }

    .workflow-lanes-panel summary::-webkit-details-marker {
      display: none;
    }

    .workflow-stage-track {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      min-width: 0;
    }

    .workflow-stage-node {
      display: grid;
      grid-template-rows: auto auto minmax(46px, 1fr) auto;
      gap: 6px;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel-soft);
      padding: 10px;
    }

    .workflow-stage-node.ready {
      border-color: rgba(32, 116, 79, 0.26);
      background: #eff8f3;
    }

    .workflow-stage-node.active {
      border-color: rgba(0, 109, 119, 0.28);
      background: #eef9f7;
    }

    .workflow-stage-node.warning {
      border-color: rgba(155, 98, 17, 0.28);
      background: #fff8ec;
    }

    .workflow-stage-node.blocking {
      border-color: rgba(177, 66, 63, 0.26);
      background: #fff6f4;
    }

    .agile-lifecycle-panel {
      overflow: hidden;
    }

    .agile-lifecycle-panel > header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: start;
    }

    .agile-lifecycle-panel > header p {
      margin: 4px 0 0;
      color: var(--muted);
      line-height: 1.45;
    }

    .agile-lifecycle-lanes {
      grid-auto-columns: minmax(236px, 1fr);
      overflow-x: auto;
      padding-bottom: 3px;
      scrollbar-color: rgba(78, 91, 116, 0.28) transparent;
    }

    .agile-lifecycle-lane {
      display: grid;
      grid-template-rows: auto 1fr;
      min-height: 338px;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      overflow: hidden;
    }

    .agile-lifecycle-lane.blocking {
      border-color: rgba(177, 66, 63, 0.28);
      background: #fff8f6;
    }

    .agile-lifecycle-lane.gap {
      border-color: rgba(155, 98, 17, 0.3);
      background: #fffaf0;
    }

    .agile-lifecycle-lane.ready {
      border-color: rgba(32, 116, 79, 0.26);
      background: #f4fbf7;
    }

    .agile-lifecycle-lane > header {
      display: grid;
      gap: 8px;
      padding: 10px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.82);
    }

    .agile-lifecycle-lane > header strong,
    .agile-lifecycle-card strong {
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .agile-lifecycle-lane > header p {
      margin: 0;
      color: var(--muted);
      font-size: 0.82rem;
      line-height: 1.42;
      overflow-wrap: anywhere;
    }

    .agile-lifecycle-lane-body {
      display: grid;
      gap: 8px;
      align-content: start;
      padding: 10px;
      min-width: 0;
    }

    .agile-lifecycle-card {
      display: grid;
      gap: 6px;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.92);
      padding: 9px;
      text-align: left;
      cursor: pointer;
    }

    .agile-lifecycle-card.blocking {
      border-color: rgba(177, 66, 63, 0.28);
      background: #fff6f4;
    }

    .agile-lifecycle-card p {
      margin: 0;
      color: var(--muted);
      font-size: 0.82rem;
      line-height: 1.4;
      overflow-wrap: anywhere;
    }

    .workflow-stage-count {
      color: var(--ink);
      font-size: 1.48rem;
      font-weight: 760;
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }

    .workflow-stage-node strong,
    .workflow-row-main strong {
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .workflow-stage-node p,
    .workflow-row-main p {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .workflow-queue,
    .workflow-handoff-list,
    .workflow-blocker-list {
      display: grid;
      gap: 7px;
      min-width: 0;
    }

    .workflow-queue-row,
    .workflow-handoff-row,
    .workflow-blocker-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: start;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel-soft);
      padding: 9px;
      text-align: left;
    }

    .workflow-queue-row {
      width: 100%;
      cursor: pointer;
    }

    .workflow-queue-row.ready {
      border-color: rgba(32, 116, 79, 0.24);
      background: #eff8f3;
    }

    .workflow-queue-row.blocked,
    .workflow-blocker-row.blocking {
      border-color: rgba(177, 66, 63, 0.26);
      background: #fff6f4;
    }

    .workflow-queue-row.active,
    .workflow-handoff-row.active {
      border-color: rgba(0, 109, 119, 0.28);
      background: #eef9f7;
    }

    .workflow-row-main {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .workflow-row-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      min-width: 0;
    }

    .workflow-handoff-row button,
    .workflow-blocker-row button {
      min-height: 30px;
      padding: 6px 8px;
      white-space: nowrap;
    }

    .workflow-lanes-panel .workflow-lanes,
    .agile-lifecycle-panel .agile-lifecycle-lanes {
      margin-top: 10px;
    }

    .evidence-workbench {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(300px, 0.9fr);
      gap: 12px;
      align-items: start;
      min-width: 0;
    }

    .evidence-panel-stack {
      display: grid;
      gap: 12px;
      min-width: 0;
    }

    .evidence-panel,
    .evidence-lanes-panel {
      display: grid;
      gap: 10px;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #fff;
      padding: 12px;
      box-shadow: var(--shadow);
    }

    .evidence-panel h3,
    .evidence-lanes-panel summary {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.3;
      font-weight: 760;
    }

    .evidence-lanes-panel summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      cursor: pointer;
      list-style: none;
    }

    .evidence-lanes-panel summary::-webkit-details-marker {
      display: none;
    }

    .evidence-matrix {
      display: grid;
      gap: 7px;
      min-width: 0;
    }

    .evidence-matrix-row,
    .evidence-queue-row,
    .evidence-governance-row {
      display: grid;
      gap: 8px;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel-soft);
      padding: 9px;
    }

    .evidence-matrix-row {
      grid-template-columns: minmax(0, 1fr) minmax(132px, 0.42fr) auto;
      align-items: center;
    }

    .evidence-queue-row,
    .evidence-governance-row {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      text-align: left;
    }

    .evidence-queue-row.blocking,
    .evidence-governance-row.blocking {
      border-color: rgba(177, 66, 63, 0.26);
      background: #fff6f4;
    }

    .evidence-row-main {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .evidence-row-main strong {
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .evidence-row-main p {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .evidence-meter {
      display: grid;
      gap: 5px;
      min-width: 0;
    }

    .evidence-meter-track {
      height: 6px;
      overflow: hidden;
      border-radius: 999px;
      background: #dfe8ed;
    }

    .evidence-meter-fill {
      height: 100%;
      border-radius: inherit;
      background: var(--accent);
    }

    .evidence-meter span {
      color: var(--muted);
      font-size: 0.74rem;
      font-variant-numeric: tabular-nums;
      line-height: 1.25;
    }

    .evidence-queue,
    .evidence-governance-list {
      display: grid;
      gap: 7px;
      min-width: 0;
    }

    .evidence-queue-row button,
    .evidence-governance-row button {
      min-height: 30px;
      padding: 6px 8px;
      white-space: nowrap;
    }

    .workflow-board .coverage-row {
      grid-template-columns: minmax(0, 1fr);
    }

    .milestone-lane,
    .team-lane,
    .workflow-lane,
    .evidence-lane {
      min-height: 160px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 255, 255, 0.78);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .settings-board {
      display: grid;
      gap: 12px;
      align-items: start;
      max-width: 1120px;
    }

    .settings-panel {
      display: grid;
      gap: 10px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #fff;
      padding: 12px;
      box-shadow: var(--shadow);
    }

    .settings-panel h3 {
      margin: 0;
      font-size: 0.95rem;
    }

    .admin-workbench {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(320px, 0.76fr);
      gap: 12px;
      align-items: start;
      min-width: 0;
    }

    .admin-panel {
      display: grid;
      gap: 12px;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #fff;
      padding: 12px;
      box-shadow: var(--shadow);
    }

    .admin-panel-head {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .admin-panel-head h3 {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.3;
      font-weight: 760;
    }

    .admin-panel-head p {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .admin-status-grid {
      display: grid;
      gap: 0;
      min-width: 0;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
    }

    .admin-status-row {
      display: grid;
      grid-template-columns: minmax(120px, 0.32fr) minmax(0, 1fr);
      gap: 10px;
      align-items: start;
      min-width: 0;
      padding: 9px 0;
      border-top: 1px solid var(--line);
    }

    .admin-status-row:first-child {
      border-top: 0;
    }

    .admin-status-row span {
      color: var(--muted);
      font-size: 0.78rem;
      line-height: 1.35;
    }

    .admin-status-row strong {
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .admin-status-row.ready strong {
      color: var(--green);
    }

    .admin-status-row.warning strong {
      color: var(--amber);
    }

    .admin-status-row.blocking strong {
      color: var(--red);
    }

    .admin-form {
      display: grid;
      gap: 10px;
      min-width: 0;
      padding-top: 10px;
      border-top: 1px solid var(--line);
    }

    .admin-form .inline {
      align-items: end;
    }

    .admin-provider-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      min-width: 0;
    }

    .admin-provider-list button {
      flex: 1 1 132px;
    }

    .admin-token-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: end;
      min-width: 0;
    }

    .admin-empty-note {
      color: var(--muted);
      line-height: 1.45;
    }

    .crud-workbench {
      display: grid;
      gap: 12px;
      min-width: 0;
    }

    .crud-table-panel,
    .crud-gap-panel {
      display: grid;
      gap: 10px;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #fff;
      padding: 12px;
      box-shadow: var(--shadow);
    }

    .crud-table-panel h3,
    .crud-gap-panel h3 {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.3;
      font-weight: 760;
    }

    .crud-table {
      display: grid;
      gap: 7px;
      min-width: 0;
    }

    .crud-table-head,
    .crud-row {
      display: grid;
      grid-template-columns: minmax(160px, 0.92fr) minmax(0, 1.2fr) minmax(360px, 1.7fr) minmax(190px, 0.86fr);
      gap: 10px;
      align-items: start;
      min-width: 0;
    }

    .crud-table-head {
      color: var(--muted);
      font-size: 0.72rem;
      font-weight: 760;
      padding: 0 8px;
    }

    .crud-row {
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel-soft);
      padding: 9px;
    }

    .crud-row.ready {
      border-color: rgba(32, 116, 79, 0.24);
      background: #eff8f3;
    }

    .crud-row.warning {
      border-color: rgba(155, 98, 17, 0.28);
      background: #fff8ec;
    }

    .crud-row.blocking {
      border-color: rgba(177, 66, 63, 0.26);
      background: #fff6f4;
    }

    .crud-entity-main,
    .crud-policy,
    .crud-next {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .crud-entity-main strong,
    .crud-policy strong,
    .crud-next strong {
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .crud-entity-main p,
    .crud-policy p,
    .crud-next p {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .crud-operations {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 6px;
      min-width: 0;
    }

    .crud-chip {
      display: grid;
      gap: 3px;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      padding: 7px;
    }

    .crud-chip strong,
    .crud-chip span {
      overflow-wrap: anywhere;
    }

    .crud-chip strong {
      font-size: 0.76rem;
      line-height: 1.2;
    }

    .crud-chip span {
      color: var(--muted);
      font-size: 0.72rem;
      line-height: 1.25;
    }

    .crud-chip.implemented {
      border-color: rgba(32, 116, 79, 0.24);
      background: #eff8f3;
    }

    .crud-chip.partial,
    .crud-chip.planned {
      border-color: rgba(155, 98, 17, 0.28);
      background: #fff8ec;
    }

    .crud-chip.forbidden,
    .crud-chip.not_applicable {
      background: #f4f7f8;
    }

    .crud-gap-list {
      display: grid;
      gap: 7px;
      min-width: 0;
    }

    .crud-gap-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel-soft);
      padding: 8px;
    }

    .crud-gap-row strong,
    .crud-gap-row span {
      overflow-wrap: anywhere;
    }

    .audit-workbench {
      display: grid;
      gap: 12px;
      min-width: 0;
    }

    .audit-filter-bar {
      display: grid;
      grid-template-columns: minmax(136px, 0.9fr) minmax(154px, 1fr) minmax(136px, 0.82fr) minmax(140px, 1fr) repeat(2, minmax(132px, 0.74fr)) minmax(96px, 0.52fr) auto auto;
      gap: 8px;
      align-items: end;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #fff;
      padding: 12px;
      box-shadow: var(--shadow);
    }

    .audit-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(280px, 336px);
      gap: 12px;
      align-items: start;
      min-width: 0;
    }

    .audit-timeline-panel,
    .audit-summary-panel {
      display: grid;
      gap: 10px;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #fff;
      padding: 12px;
      box-shadow: var(--shadow);
    }

    .audit-timeline-panel h3,
    .audit-summary-panel h3 {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.3;
    }

    .audit-timeline,
    .audit-mini-timeline,
    .audit-target-list {
      display: grid;
      gap: 8px;
      min-width: 0;
    }

    .audit-event-row {
      display: grid;
      grid-template-columns: minmax(118px, 0.2fr) minmax(0, 1fr) auto;
      gap: 10px;
      align-items: start;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      padding: 10px;
    }

    .audit-event-row.compact {
      grid-template-columns: minmax(92px, 0.28fr) minmax(0, 1fr);
      padding: 8px;
    }

    .audit-event-time {
      color: var(--muted);
      font-size: 0.76rem;
      font-variant-numeric: tabular-nums;
      line-height: 1.35;
    }

    .audit-event-main {
      display: grid;
      gap: 5px;
      min-width: 0;
    }

    .audit-event-main strong,
    .audit-summary-row strong {
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .audit-event-main p {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }

    .audit-event-row button {
      min-height: 30px;
      padding: 6px 8px;
      white-space: nowrap;
    }

    .audit-summary-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel-soft);
      padding: 8px;
    }

    .intake-session-list {
      display: grid;
      gap: 8px;
      margin-top: 10px;
    }

    .intake-session-row {
      width: 100%;
      display: grid;
      gap: 5px;
      text-align: left;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #fff;
      padding: 9px;
    }

    .intake-session-row.selected {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(13, 104, 107, 0.12);
    }

    .intake-layout {
      display: grid;
      grid-template-columns: minmax(320px, 0.9fr) minmax(380px, 1.1fr);
      gap: 12px;
      align-items: start;
      min-width: 0;
    }

    .intake-workbench {
      display: grid;
      gap: 12px;
      min-width: 0;
    }

    .intake-session-bar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: start;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #fff;
      padding: 12px;
      box-shadow: var(--shadow);
    }

    .intake-session-bar h3 {
      margin: 0;
      font-size: 0.98rem;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .intake-session-bar p {
      margin: 4px 0 0;
      color: var(--muted);
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .intake-session-bar .meta {
      justify-content: flex-end;
    }

    .intake-capture-stack {
      display: grid;
      gap: 12px;
      min-width: 0;
    }

    .intake-panel {
      display: grid;
      gap: 12px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #fff;
      padding: 12px;
      box-shadow: var(--shadow);
      min-width: 0;
    }

    .intake-panel-head {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .intake-panel-head h3 {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.3;
      font-weight: 760;
    }

    .intake-panel-head p {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .intake-composer {
      display: grid;
      gap: 10px;
      min-width: 0;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel-soft);
    }

    .intake-composer textarea {
      min-height: 116px;
    }

    .intake-review-toolbar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      min-width: 0;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel-soft);
    }

    .intake-review-summary {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-width: 0;
    }

    .intake-chat,
    .candidate-list,
    .source-list {
      display: grid;
      gap: 8px;
    }

    .intake-message,
    .candidate-card,
    .source-card {
      display: grid;
      gap: 6px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #fff;
      padding: 10px;
      min-width: 0;
    }

    .candidate-card-header,
    .candidate-planning {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
    }

    .candidate-card-header strong {
      overflow-wrap: anywhere;
    }

    .candidate-select {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      color: var(--ink);
      font-size: 0.78rem;
      white-space: nowrap;
    }

    .candidate-select input {
      width: auto;
      min-width: 16px;
    }

    .candidate-planning {
      align-items: end;
    }

    .candidate-planning button {
      min-width: 72px;
    }

    .candidate-edit {
      display: grid;
      gap: 8px;
    }

    .trace-edit summary,
    .candidate-edit summary,
    .source-ref-list summary {
      color: var(--accent);
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 700;
    }

    .candidate-edit-form {
      margin-top: 8px;
      border-top: 1px solid var(--line);
      padding-top: 8px;
    }

    .candidate-edit-form textarea {
      min-height: 68px;
    }

    .source-ref-list {
      display: grid;
      gap: 8px;
      border-top: 1px solid var(--line);
      padding-top: 8px;
    }

    .source-ref-row {
      display: grid;
      gap: 5px;
      border-top: 1px solid var(--line);
      padding-top: 8px;
      min-width: 0;
    }

    .source-ref-row blockquote {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .intake-origin {
      display: grid;
      gap: 8px;
    }

    .intake-origin-summary {
      display: grid;
      gap: 5px;
      min-width: 0;
    }

    .intake-message.user {
      border-color: #bdd9d6;
      background: #f6fbfa;
    }

    .intake-message p,
    .candidate-card p,
    .source-card p {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }

    .intake-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .team-lane.over-limit {
      border-color: #e8d2a2;
      background: #fffaf0;
    }

    .milestone-lane > header,
    .team-lane > header,
    .workflow-lane > header,
    .evidence-lane > header {
      position: static;
      display: grid;
      gap: 6px;
      padding: 10px 12px;
      background: #fff;
      border-bottom: 1px solid var(--line);
      backdrop-filter: none;
    }

    .lane-block {
      display: grid;
      gap: 8px;
      padding: 10px;
      border-top: 1px solid var(--line);
    }

    .lane-block:first-of-type {
      border-top: 0;
    }

    .lane-block h3 {
      margin: 0;
      font-size: 0.8rem;
      line-height: 1.25;
      color: var(--muted);
    }

    .slice-card {
      min-height: 108px;
    }

    .team-meter,
    .capacity-bar {
      height: 7px;
      border-radius: 999px;
      background: #e7eef2;
      overflow: hidden;
    }

    .team-meter {
      margin: 10px 12px 0;
    }

    .team-meter span,
    .capacity-bar span {
      display: block;
      height: 100%;
      width: 0;
      border-radius: inherit;
      background: var(--accent);
    }

    .board-tree-node {
      display: grid;
      gap: 8px;
    }

    .board-tree-node .work-card {
      min-height: 96px;
    }

    .board-tree-children {
      display: grid;
      gap: 8px;
      margin-left: 22px;
      padding-left: 12px;
      border-left: 1px solid var(--line-strong);
    }

    .column {
      min-height: 160px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 255, 255, 0.78);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .column header {
      position: static;
      display: flex;
      padding: 10px 12px;
      background: #fff;
      border-bottom: 1px solid var(--line);
      backdrop-filter: none;
    }

    .column-title {
      font-weight: 700;
      text-transform: none;
    }

    .coverage-parent {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 255, 255, 0.82);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .coverage-parent > header {
      position: static;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      background: #fff;
      backdrop-filter: none;
    }

    .coverage-parent-link {
      border: 0;
      border-radius: 0;
      background: transparent;
      padding: 0;
      min-height: 0;
      text-align: left;
      color: var(--ink);
    }

    .coverage-parent-link:hover {
      background: transparent;
      color: var(--accent-strong);
    }

    .coverage-parent-title {
      display: block;
      font-weight: 720;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .coverage-grid {
      display: grid;
    }

    .coverage-row {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(96px, 0.45fr);
      gap: 10px;
      align-items: start;
      padding: 10px 12px;
      border-top: 1px solid var(--line);
    }

    .coverage-row:first-child {
      border-top: 0;
    }

    .coverage-row.coverage-gap {
      background: #fff7f4;
    }

    .coverage-row.coverage-duplicate {
      background: #fffaf0;
    }

    .coverage-cell {
      display: grid;
      gap: 5px;
      min-width: 0;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .count {
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }

    .card-list {
      display: grid;
      gap: 8px;
      padding: 10px;
    }

    .work-card {
      width: 100%;
      text-align: left;
      border-radius: var(--radius);
      background: #fff;
      border: 1px solid var(--line);
      padding: 10px;
      box-shadow: none;
      min-height: 128px;
    }

    .work-card.selected {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(13, 104, 107, 0.12);
    }

    .work-card strong {
      display: block;
      line-height: 1.35;
      margin-bottom: 6px;
      overflow-wrap: anywhere;
    }

    .card-code {
      display: block;
      color: var(--muted);
      font-size: 0.72rem;
      font-variant-numeric: tabular-nums;
      margin-bottom: 4px;
    }

    .card-summary {
      display: grid;
      gap: 6px;
    }

    .meta {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      color: var(--muted);
      font-size: 0.78rem;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      padding: 2px 7px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: var(--panel-soft);
      color: var(--muted);
      font-size: 0.75rem;
      line-height: 1.25;
      max-width: 100%;
      overflow-wrap: anywhere;
      white-space: normal;
    }

    .badge.type-epic,
    .badge.type-feature {
      color: var(--blue);
      background: #eef3fb;
      border-color: #c9d6ea;
    }

    .badge.type-requirement,
    .badge.type-story {
      color: var(--accent-strong);
      background: #edf7f5;
      border-color: #bdd9d6;
    }

    .badge.type-task,
    .badge.type-bug {
      color: var(--amber);
      background: #fff6df;
      border-color: #ead7a4;
    }

    .badge.blocking {
      color: var(--red);
      background: #fff2ef;
      border-color: #edc4bd;
    }

    .badge.warning {
      color: var(--amber);
      background: #fff7e4;
      border-color: #e8d2a2;
    }

    .badge.info {
      color: var(--blue);
      background: #eef3fb;
      border-color: #c9d6ea;
    }

    .badge.ready {
      color: var(--green);
      background: #edf8f1;
      border-color: #b9dcc9;
    }

    .badge.workflow {
      color: var(--violet);
      background: #f3f0fa;
      border-color: #d5cbe7;
    }

    .badge.priority-p0 {
      color: #fff;
      background: var(--red);
      border-color: var(--red);
    }

    .badge.priority-p1 {
      color: #fff;
      background: var(--amber);
      border-color: var(--amber);
    }

    .badge.priority-p2 {
      color: var(--blue);
      background: #eef3fb;
      border-color: #c9d6ea;
    }

    .badge.priority-p3 {
      color: var(--muted);
      background: var(--panel-soft);
      border-color: var(--line);
    }

    .tree {
      display: grid;
      gap: 4px;
    }

    .tree-node {
      display: grid;
      gap: 4px;
    }

    .tree-row {
      width: 100%;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      text-align: left;
      border: 1px solid transparent;
      background: transparent;
      padding: 7px 8px;
    }

    .tree-row:hover,
    .tree-row.selected {
      background: #fff;
      border-color: var(--line);
    }

    .tree-title {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tree-children {
      display: grid;
      gap: 4px;
      margin-left: 16px;
      padding-left: 10px;
      border-left: 1px solid var(--line);
    }

    .detail-title {
      margin: 0 0 12px;
      font-size: 1.05rem;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .field {
      padding: 10px 0;
      border-top: 1px solid var(--line);
    }

    .field:first-of-type {
      border-top: 0;
    }

    .field b {
      display: block;
      margin-bottom: 4px;
      font-size: 0.82rem;
    }

    .field p {
      margin: 0;
      color: var(--muted);
      line-height: 1.5;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }

    .criteria {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .criteria li {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 7px 8px;
      background: var(--panel-soft);
      overflow-wrap: anywhere;
    }

    .milestone-list {
      display: grid;
      gap: 8px;
      margin-top: 10px;
    }

    .team-list {
      display: grid;
      gap: 8px;
      margin-top: 10px;
    }

    .milestone-row,
    .team-row {
      display: grid;
      gap: 5px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #fff;
      padding: 9px;
    }

    .team-row {
      grid-template-columns: minmax(0, 1fr);
    }

    .milestone-row strong,
    .team-row strong {
      overflow-wrap: anywhere;
    }

    .coverage {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .metric {
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel-soft);
      padding: 8px;
      min-height: 58px;
    }

    .metric strong {
      display: block;
      font-size: 1rem;
      font-variant-numeric: tabular-nums;
    }

    .metric span {
      color: var(--muted);
      font-size: 0.76rem;
    }

    .detail-tabs {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }

    .detail-tabs .badge {
      min-height: 30px;
      padding: 6px 8px;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .delivery-gate-panel {
      display: grid;
      gap: 8px;
    }

    .delivery-gate-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-width: 0;
    }

    .delivery-gate-head b {
      margin-bottom: 0;
    }

    .delivery-gate-list {
      display: grid;
      gap: 6px;
      min-width: 0;
    }

    .delivery-gate-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: start;
      min-width: 0;
      padding: 8px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel-soft);
    }

    .delivery-gate-row.ready {
      border-color: rgba(32, 116, 79, 0.22);
      background: #f3fbf6;
    }

    .delivery-gate-row.blocking {
      border-color: rgba(177, 66, 63, 0.26);
      background: #fff6f4;
    }

    .delivery-gate-main {
      display: grid;
      gap: 3px;
      min-width: 0;
    }

    .delivery-gate-main strong {
      font-size: 0.82rem;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .delivery-gate-main p {
      margin: 0;
    }

    .status-actions {
      display: grid;
      gap: 8px;
    }

    .status-actions button.gate-blocked {
      border-color: rgba(177, 66, 63, 0.32);
      color: var(--red);
    }

    .status-action-summary {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .empty,
    .loading {
      border: 1px dashed var(--line-strong);
      border-radius: var(--radius);
      padding: 14px;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.55);
      line-height: 1.5;
    }

    @media (min-width: 1360px) {
      .workspace.has-detail {
        grid-template-columns: minmax(0, 1fr) minmax(340px, 420px);
      }

      .detail {
        border-top: 0;
        border-left: 1px solid var(--line);
      }
    }

    @media (max-width: 1500px) {
      .backlog-command-layout {
        grid-template-columns: 1fr;
      }

      .backlog-split {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 1100px) {
      .shell {
        grid-template-columns: 1fr;
        grid-template-rows: auto auto auto 1fr;
      }

      .module-rail {
        grid-column: 1;
        grid-row: 2;
        flex-direction: row;
        gap: 8px;
        padding: 10px 16px;
        border-right: 0;
        border-bottom: 1px solid var(--line);
      }

      .module-rail button {
        min-width: 118px;
        min-height: 38px;
      }

      .sidebar {
        grid-column: 1;
        grid-row: 4;
        border-right: 0;
        border-top: 1px solid var(--line);
        border-bottom: 0;
      }

      main {
        grid-column: 1;
        grid-row: 3;
      }

      .board-summary {
        grid-template-columns: 1fr;
      }

      .sidebar > .section:first-child {
        display: none;
      }

    }

    @media (max-width: 720px) {
      header {
        align-items: stretch;
        flex-direction: column;
      }

      .toolbar {
        justify-content: stretch;
      }

      .toolbar > * {
        flex: 1 1 160px;
      }

      .toolbar select,
      .toolbar button {
        width: 100%;
      }

      .toolbar .view-select-fallback {
        display: block;
      }

      .workspace-head {
        grid-template-columns: 1fr;
      }

      .view-tabs {
        display: none;
      }

      .view-tab {
        max-width: none;
      }

      .module-rail {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        overflow: visible;
      }

      .module-rail button {
        min-width: 0;
      }

      .columns {
        grid-auto-flow: row;
        grid-auto-columns: auto;
        grid-template-columns: 1fr;
      }

      .backlog-workbench-header,
      .backlog-view-manager,
      .backlog-view-save,
      .backlog-filter-grid,
      .admin-workbench,
      .admin-status-row,
      .admin-token-row,
      .audit-filter-bar,
      .audit-layout,
      .crud-table-head,
      .crud-row,
      .crud-gap-row,
      .backlog-level-grid,
      .backlog-planning-grid,
      .backlog-decision-grid,
      .backlog-delivery-row,
      .backlog-risk-grid {
        grid-template-columns: 1fr;
      }

      .backlog-filter-grid label:first-child {
        grid-column: auto;
      }

      .backlog-queue-strip {
        grid-auto-flow: row;
        grid-auto-columns: auto;
      }

      .backlog-split {
        grid-template-columns: 1fr;
      }

      .backlog-table-head {
        display: none;
      }

      .backlog-row {
        grid-template-columns: 1fr;
      }

      .backlog-bulk-bar,
      .backlog-bulk-form {
        grid-template-columns: 1fr;
      }

      .backlog-cell-label {
        display: block;
      }

      .milestone-lanes {
        grid-auto-flow: row;
        grid-auto-columns: auto;
        grid-template-columns: 1fr;
      }

      .team-lanes {
        grid-auto-flow: row;
        grid-auto-columns: auto;
        grid-template-columns: 1fr;
      }

      .team-role-lanes {
        grid-auto-flow: row;
        grid-auto-columns: auto;
        grid-template-columns: 1fr;
        overflow-x: visible;
      }

      .workflow-lanes,
      .evidence-lanes {
        grid-auto-flow: row;
        grid-auto-columns: auto;
        grid-template-columns: 1fr;
      }

      .agile-lifecycle-lanes {
        grid-auto-flow: column;
        grid-auto-columns: minmax(236px, 84vw);
        grid-template-columns: none;
        overflow-x: auto;
      }

      .intake-layout {
        grid-template-columns: 1fr;
      }

      .intake-session-bar,
      .intake-review-toolbar {
        grid-template-columns: 1fr;
      }

      .intake-session-bar .meta {
        justify-content: flex-start;
      }

      .candidate-card {
        margin-left: 0 !important;
      }

      .candidate-card-header,
      .candidate-planning {
        grid-template-columns: 1fr;
      }

      .candidate-select {
        justify-content: flex-start;
      }

      .coverage {
        grid-template-columns: 1fr;
      }

      .tree-board-summary,
      .coverage-summary,
      .milestone-board-summary,
      .delivery-board-summary,
      .workflow-board-summary,
      .evidence-board-summary,
      .team-board-summary,
      .crud-summary-grid,
      .audit-summary-grid,
      .coverage-row {
        grid-template-columns: 1fr;
      }

      .crud-table-head {
        display: none;
      }

      .crud-operations {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .audit-event-row,
      .audit-event-row.compact {
        grid-template-columns: 1fr;
      }

      .planning-workbench,
      .team-workbench,
      .planning-timeline-row,
      .planning-focus-row,
      .planning-scope-row,
      .delivery-slice-row,
      .planning-risk-row,
      .delivery-parent-row,
      .team-capacity-row,
      .team-assignment-row,
      .team-risk-row,
      .team-role-coverage-row {
        grid-template-columns: 1fr;
      }

      .workflow-workbench,
      .agile-lifecycle-panel > header,
      .workflow-stage-track,
      .workflow-queue-row,
      .workflow-handoff-row,
      .workflow-blocker-row {
        grid-template-columns: 1fr;
      }

      .evidence-workbench,
      .evidence-matrix-row,
      .evidence-queue-row,
      .evidence-governance-row {
        grid-template-columns: 1fr;
      }

      .delivery-gate-row {
        grid-template-columns: 1fr;
      }

      .board-tree-children {
        margin-left: 10px;
      }

      .health,
      .detail-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header>
      <div class="brand">
        <h1>HuntianLing Board</h1>
        <span id="surface-url"></span>
      </div>
      <div class="toolbar">
        <select id="project-select" aria-label="项目"></select>
        <select id="view-select" class="view-select-fallback" aria-label="看板视图">
        </select>
        <button id="refresh-button" type="button">刷新</button>
      </div>
    </header>

    <nav class="module-rail" aria-label="功能工作区">
      <button type="button" data-area-id="intake">录入</button>
      <button type="button" data-area-id="requirements">需求</button>
      <button type="button" data-area-id="planning">计划</button>
      <button type="button" data-area-id="team">团队</button>
      <button type="button" data-area-id="workflow">工作流</button>
      <button type="button" data-area-id="evidence">证据</button>
      <button type="button" data-area-id="settings">设置</button>
    </nav>

    <main>
      <section class="workspace-head" aria-labelledby="workspace-heading">
        <div class="workspace-head-copy">
          <span id="workspace-stage" class="workspace-stage">Backlog refinement</span>
          <h2 id="workspace-heading">需求 Backlog</h2>
          <p id="workspace-lede">管理需求拆分、分析、设计和验收覆盖。</p>
          <div id="workspace-context" class="workspace-context"></div>
        </div>
        <nav id="view-tabs" class="view-tabs" aria-label="当前工作区视图"></nav>
      </section>

      <section class="board-summary">
        <div id="message" class="status">正在连接</div>
        <section id="board-health" class="health"></section>
      </section>

      <div id="workspace" class="workspace">
        <section class="board">
          <section id="work-item-composer" class="section">
            <details id="item-composer" class="composer-panel">
              <summary>
                <span>新建工作项</span>
                <span class="muted">Epic / Feature / Story / Task</span>
              </summary>
              <form id="item-form" class="controls">
                <div class="inline">
                  <label>类型
                    <select id="item-type" name="type">
                      <option value="epic">Epic</option>
                      <option value="feature">Feature</option>
                      <option value="requirement">Requirement</option>
                      <option value="story">Story</option>
                      <option value="task">Task</option>
                      <option value="bug">Bug</option>
                      <option value="research">Research</option>
                    </select>
                  </label>
                  <label>父项
                    <select id="parent-select" name="parentId"></select>
                  </label>
                  <label>里程碑
                    <select id="item-milestone" name="milestoneId"></select>
                  </label>
                </div>
                <label>标题 <input id="item-title" name="title" autocomplete="off"></label>
                <label>说明 <textarea id="item-body" name="body"></textarea></label>
                <details class="trace-edit">
                  <summary>来源和拆分</summary>
                  <label>来源输入 <textarea id="item-source-input" name="sourceInput"></textarea></label>
                  <label>拆分原因 <textarea id="item-decomposition-reason" name="decompositionReason"></textarea></label>
                </details>
                <label>验收标准 <textarea id="item-acceptance" name="acceptance" placeholder="每行一条"></textarea></label>
                <button class="primary" type="submit">创建工作项</button>
              </form>
            </details>
          </section>
          <section class="section">
            <div class="section-heading">
              <h2 id="board-title">主看板</h2>
              <p id="view-description" class="muted"></p>
            </div>
            <div id="columns" class="columns loading">正在读取看板</div>
          </section>
        </section>

        <aside class="detail" id="detail">
          <h2 class="detail-title">选择一个工作项</h2>
          <p class="muted">需求分析、设计、验收覆盖和状态流转会显示在这里。</p>
        </aside>
      </div>
    </main>

    <aside class="sidebar">
      <section class="section">
        <h2 id="workspace-title">需求</h2>
        <p id="workspace-description" class="muted"></p>
      </section>

      <section class="section context-panel" data-area-panel="intake">
        <h2>录入会话</h2>
        <form id="intake-session-form" class="controls">
          <label>主题 <input id="intake-session-title" name="title" autocomplete="off"></label>
          <label>提交人 <input id="intake-submitter" name="submitter" autocomplete="off"></label>
          <button class="primary" type="submit">新建录入</button>
        </form>
        <div id="intake-sessions" class="intake-session-list empty">暂无录入会话</div>
      </section>

      <section class="section context-panel" data-area-panel="settings">
        <h2>项目</h2>
        <form id="project-form" class="controls">
          <label>名称 <input id="project-name" name="name" autocomplete="off"></label>
          <label>描述 <textarea id="project-description" name="description"></textarea></label>
          <button class="primary" type="submit">新建项目</button>
        </form>
      </section>

      <section class="section context-panel" data-area-panel="planning">
        <h2>里程碑</h2>
        <form id="milestone-form" class="controls">
          <label>标题 <input id="milestone-title" name="title" autocomplete="off"></label>
          <label>目标 <textarea id="milestone-goal" name="goal"></textarea></label>
          <div class="inline">
            <label>状态
              <select id="milestone-status" name="status">
                <option value="planned">已计划</option>
                <option value="active">进行中</option>
                <option value="completed">已完成</option>
                <option value="cancelled">已取消</option>
              </select>
            </label>
            <label>开始 <input id="milestone-start" name="startDate" type="date"></label>
            <label>截止 <input id="milestone-due" name="dueDate" type="date"></label>
          </div>
          <button class="primary" type="submit">新建里程碑</button>
        </form>
        <div id="milestones" class="milestone-list empty">暂无里程碑</div>
      </section>

      <section class="section context-panel" data-area-panel="team">
        <h2>团队</h2>
        <form id="team-form" class="controls">
          <label>名称 <input id="team-display-name" name="displayName" autocomplete="off"></label>
          <div class="inline">
            <label>类型
              <select id="team-member-type" name="memberType">
                <option value="human">人类成员</option>
                <option value="agent">Agent</option>
                <option value="service-account">服务账号</option>
                <option value="external-reviewer">外部评审</option>
              </select>
            </label>
            <label>角色
              <select id="team-role" name="roleId"></select>
            </label>
          </div>
          <div class="inline">
            <label>状态
              <select id="team-status" name="status">
                <option value="active">可工作</option>
                <option value="unavailable">不可用</option>
                <option value="observer">观察者</option>
                <option value="inactive">未启用</option>
                <option value="suspended">已暂停</option>
              </select>
            </label>
            <label>WIP <input id="team-wip" name="concurrentWorkLimit" type="number" min="1" step="1" value="1"></label>
            <label>容量 <input id="team-capacity" name="capacityUnits" type="number" min="0.1" step="0.1" value="1"></label>
          </div>
          <button class="primary" type="submit">新增成员</button>
        </form>
        <div id="team-members" class="team-list empty">暂无团队成员</div>
      </section>

      <section class="section context-panel" data-area-panel="requirements">
        <h2>需求树</h2>
        <div id="tree" class="tree loading">正在读取需求树</div>
      </section>

      <section class="section context-panel auth-panel-section" data-area-panel="settings">
        <h2>访问</h2>
        <div id="auth-panel" class="auth-card">
          <div id="auth-user" class="auth-user empty">正在读取登录状态</div>
          <form id="login-form" class="controls">
            <label>区域
              <select id="login-region" name="region">
                <option value="global">Global</option>
                <option value="cn">中国</option>
                <option value="auto">自动</option>
              </select>
            </label>
            <label>账号 <input id="login-username" name="username" autocomplete="username"></label>
            <label>密码 <input id="login-password" name="password" type="password" autocomplete="current-password"></label>
            <button class="primary" type="submit">登录</button>
          </form>
          <div id="provider-list" class="provider-list"></div>
          <button id="logout-button" type="button">退出登录</button>
          <form id="token-form" class="controls">
            <input id="write-token" type="password" autocomplete="off" placeholder="API token 或 Bearer token">
            <button id="save-token" type="button">保存 API token</button>
          </form>
        </div>
      </section>
    </aside>
  </div>

  <script>
    const state = {
      projects: [],
      milestones: [],
      teamMembers: [],
      intakeSessions: [],
      intakeBundle: null,
      selectedIntakeCandidateIds: new Set(),
      intakeSelectionSessionId: '',
      intakeKnownCandidateIds: new Set(),
      workItems: [],
      cards: [],
      mainBoard: null,
      projectId: new URLSearchParams(location.search).get('projectId') || '',
      selectedId: null,
      selectedIntakeSessionId: new URLSearchParams(location.search).get('intakeSessionId') || '',
      viewId: new URLSearchParams(location.search).get('viewId') || 'requirement-board',
      areaId: new URLSearchParams(location.search).get('areaId') || '',
      backlogFilters: {
        query: '',
        level: '',
        type: '',
        status: '',
        warning: '',
        milestoneId: '',
        sort: 'rank',
        hideDelivered: true,
      },
      selectedBacklogIds: new Set(),
      activeBacklogViewId: '',
      backlogSavedViews: [],
      backlogSettingsProjectId: '',
      backlogColumns: {
        plan: true,
        definition: true,
        trace: true,
        next: true,
      },
      audit: {
        events: [],
        loading: false,
        error: '',
        filters: {
          actorId: '',
          action: '',
          targetType: '',
          targetId: '',
          from: '',
          to: '',
          limit: '50',
        },
      },
      businessCrud: {
        data: null,
        loading: false,
        error: '',
      },
      token: localStorage.getItem('huntianling.writeToken') || '',
      auth: {
        enabled: false,
        authenticated: false,
        principal: null,
        session: null,
        providers: [],
        region: 'global',
      },
    };

    const typeLabels = {
      epic: 'Epic',
      feature: 'Feature',
      requirement: 'Requirement',
      story: 'Story',
      task: 'Task',
      bug: 'Bug',
      defect: 'Defect',
      research: 'Research',
      discussion: 'Discussion',
      meeting: 'Meeting',
      decision: 'Decision',
      brainstorm: 'Brainstorm',
    };

    const statusLabels = {
      inbox: 'Inbox',
      analyzing: '分析中',
      designing: '设计中',
      triaged: '已分流',
      planned: '已计划',
      ready: 'Ready',
      in_progress: '开发中',
      in_review: '评审中',
      verifying: '验证中',
      gates_passing: '门禁中',
      delivered: '已交付',
      rejected: '已拒绝',
      stopped: '已停止',
    };

    const viewSpecs = {
      'intake-board': {
        label: '录入队列',
        description: '把对话、文字和附件沉淀为可评审的需求候选。',
      },
      'requirement-board': {
        label: 'Backlog 工作台',
        description: '按层级、优先级、风险和 Ready 状态整理可交付的需求队列。',
      },
      'tree-board': {
        label: '层级树',
        description: '检查 Epic → Feature → Requirement/Story → Task 的父子关系和拆分完整性。',
      },
      'coverage-board': {
        label: '验收覆盖',
        description: '核对父需求验收标准是否被子项覆盖，识别未覆盖和重复覆盖。',
      },
      'milestone-board': {
        label: '里程碑路线图',
        description: '按时间和里程碑查看范围、进度和计划阻塞。',
      },
      'delivery-board': {
        label: '交付切片',
        description: '查看一个大需求如何被拆成多个里程碑范围并逐步交付。',
      },
      'team-board': {
        label: '容量矩阵',
        description: '按成员、角色、WIP 和可用性查看当前并发工作。',
      },
      'role-board': {
        label: '角色泳道',
        description: '按产品、开发和流程角色查看当前责任归属。',
      },
      'workflow-board': {
        label: '交付运行',
        description: '按 Story 优先级、运行状态、阻塞和交接查看端到端交付。',
      },
      'evidence-board': {
        label: '门禁矩阵',
        description: '按代码、PR、Review、CI、治理、安全、可靠性和可信证据检查交付结论。',
      },
      'admin-settings': {
        label: '访问设置',
        description: '管理项目、登录状态、认证区域和 API token。',
      },
      'business-crud': {
        label: '业务 CRUD',
        description: '查看每个业务对象的创建、读取、更新、生命周期和删除策略覆盖情况。',
      },
      'audit-board': {
        label: 'Audit Trail',
        description: '按项目、操作者、动作、对象和日期追溯重要变更。',
      },
    };

    const viewLabels = Object.fromEntries(
      Object.entries(viewSpecs).map(([viewId, spec]) => [viewId, spec.label]),
    );

    const workspaceAreas = {
      intake: {
        label: 'Intake',
        navTitle: '需求录入',
        stage: 'Idea intake',
        description: '通过对话、文字和附件收集 idea，并分析为候选需求。',
        owner: '业务/PO',
        object: 'Intake Session',
        output: '候选需求',
        views: ['intake-board'],
        boardTitle: '需求录入工作台',
        emptyDetail: '选择一个录入会话后查看来源材料和候选需求。',
      },
      requirements: {
        label: 'Backlog',
        navTitle: '需求 Backlog',
        stage: 'Backlog refinement',
        description: '整理需求层级、排序、拆分和 Ready 条件，输出可进入交付的 Story。',
        owner: 'PO/BA',
        object: 'WorkItem tree',
        output: 'Ready Story',
        views: ['requirement-board', 'tree-board', 'coverage-board'],
        boardTitle: '需求工作区',
        emptyDetail: '选择一个需求工作项后查看分析、设计、验收和子项。',
      },
      planning: {
        label: 'Plans',
        navTitle: '里程碑计划',
        stage: 'Release planning',
        description: '把需求映射到里程碑，管理发布范围和跨里程碑交付计划。',
        owner: 'PO/PM',
        object: 'Milestone',
        output: '交付范围',
        views: ['milestone-board', 'delivery-board'],
        boardTitle: '计划工作区',
        emptyDetail: '选择一个工作项后查看里程碑和交付切片。',
      },
      team: {
        label: 'Team',
        navTitle: '团队容量',
        stage: 'Capacity planning',
        description: '管理人类成员、Agent、角色、容量、WIP 和并发工作。',
        owner: 'Scrum Master',
        object: 'Team Member',
        output: '可执行分配',
        views: ['team-board', 'role-board'],
        boardTitle: '团队工作区',
        emptyDetail: '选择一个工作项后查看负责人和团队分配。',
      },
      workflow: {
        label: 'Runs',
        navTitle: '交付运行',
        stage: 'E2E delivery run',
        description: '跟踪 Story 从排队到实现、评审、验证、门禁和交接的运行状态。',
        owner: '敏捷团队',
        object: 'Workflow Run',
        output: '角色交接',
        views: ['workflow-board'],
        boardTitle: '工作流工作区',
        emptyDetail: '选择一个 Story 后查看调度状态和交接信息。',
      },
      evidence: {
        label: 'Evidence',
        navTitle: '证据门禁',
        stage: 'Verification',
        description: '把代码、PR、CI、Review、治理、安全、可靠性和可信证据绑定到需求交付。',
        owner: 'Reviewer/QA',
        object: 'Delivery Evidence',
        output: '可验收结论',
        views: ['evidence-board'],
        boardTitle: '证据治理工作区',
        emptyDetail: '选择一个工作项后查看交付证据和治理状态。',
      },
      settings: {
        label: 'Admin',
        navTitle: '系统管理',
        stage: 'Administration',
        description: '管理项目、访问、认证方式、本地部署入口和审计追溯。',
        owner: '管理员',
        object: 'Project/Auth/CRUD/Audit',
        output: '可治理工作区',
        views: ['admin-settings', 'business-crud', 'audit-board'],
        boardTitle: '系统管理',
        emptyDetail: '设置工作区不需要选择工作项。',
      },
    };

    const viewAreaIds = Object.fromEntries(
      Object.entries(workspaceAreas)
        .flatMap(([areaId, area]) => area.views.map((viewId) => [viewId, areaId])),
    );

    const milestoneStatusLabels = {
      planned: '已计划',
      active: '进行中',
      completed: '已完成',
      cancelled: '已取消',
    };

    const warningLabels = {
      missing_analysis: '缺分析',
      missing_design: '缺设计',
      missing_acceptance: '缺验收',
      uncovered_acceptance: '验收未覆盖',
      blocked_dependency: '有阻塞',
      blocked_by_work_items: '工作项阻塞',
      unfinished_children: '子项未完成',
      missing_milestone: '里程碑缺失',
      missing_assignee: '缺负责人',
      missing_acceptance_coverage: '覆盖证据缺失',
      missing_delivery_evidence: '交付证据缺失',
      not_ready_status: '状态未 Ready',
      waiting_approvals: '等待审批',
      waiting_reviews: '等待评审',
      blocked_workflow_steps: '步骤阻塞',
      failed_checks: '检查失败',
      assignee_over_wip_limit: '负责人 WIP 超限',
      missing_acceptance_evidence: '缺验收证据',
      missing_code_evidence: '缺代码证据',
      missing_review_evidence: '缺评审证据',
      missing_ci_evidence: '缺 CI 证据',
      missing_evidence_evidence: '缺交付证据',
      missing_governance_evidence: '缺治理证据',
      missing_security_evidence: '缺安全证据',
      missing_reliability_evidence: '缺可靠性证据',
      missing_trust_evidence: '缺可信证据',
      pending_acceptance_evidence: '验收待处理',
      pending_code_evidence: '代码待处理',
      pending_review_evidence: '评审待处理',
      pending_ci_evidence: 'CI 待处理',
      pending_evidence_evidence: '证据待处理',
      pending_governance_evidence: '治理待处理',
      pending_security_evidence: '安全待处理',
      pending_reliability_evidence: '可靠性待处理',
      pending_trust_evidence: '可信待处理',
      compliance_review_pending: '合规待审批',
      risk_acceptance_open: '风险待接受',
      scm_adapter_not_configured: 'SCM 未配置',
      tree_cycle_or_orphan: '树结构异常',
      tree_cycle: '树存在环',
      missing_parent: '父项缺失',
      orphan_without_parent: '孤立子项',
      invalid_parent_type: '父项类型错误',
      duplicate_acceptance_coverage: '重复覆盖',
      open_milestone_slices: '切片未完成',
      slice_without_acceptance_scope: '切片缺验收范围',
      slice_missing_evidence: '切片缺证据',
      unassigned_work: '未分配',
      unknown_assignee: '负责人未知',
      assignee_unavailable: '负责人不可用',
      member_over_wip_limit: 'WIP 超限',
      member_unavailable_with_work: '不可用成员有任务',
      workflow_waiting_approvals: '等待审批',
      workflow_waiting_reviews: '等待评审',
      workflow_blocked_steps: '步骤阻塞',
      workflow_failed_checks: '检查失败',
      workflow_lifecycle_blocked: '生命周期阻塞',
      workflow_lifecycle_evidence_gap: '生命周期证据缺口',
    };

    const workflowRunStatusLabels = {
      not_started: '未开始',
      ready: 'Ready',
      queued: '排队中',
      running: '运行中',
      waiting: '等待中',
      blocked: '已阻塞',
      in_review: '评审中',
      verifying: '验证中',
      completed: '已完成',
      failed: '失败',
      cancelled: '已取消',
    };

    const evidenceStatusLabels = {
      missing: '缺失',
      pending: '等待',
      passing: '通过',
      failing: '失败',
      blocked: '阻塞',
      waived: '豁免',
    };

    const evidenceAreaLabels = {
      acceptance: '验收',
      code: '代码',
      review: '评审',
      ci: 'CI',
      evidence: '交付证据',
      governance: '治理',
      security: '安全',
      reliability: '可靠性',
      trust: '可信',
    };

    const memberTypeLabels = {
      human: '人类成员',
      agent: 'Agent',
      'service-account': '服务账号',
      'external-reviewer': '外部评审',
    };

    const memberStatusLabels = {
      active: '可工作',
      inactive: '未启用',
      suspended: '已暂停',
      unavailable: '不可用',
      observer: '观察者',
    };

    const intakeStatusLabels = {
      collecting: '收集中',
      ready_for_analysis: '待分析',
      analyzing: '分析中',
      candidates_ready: '候选已生成',
      approved: '已批准',
      rejected: '已拒绝',
    };

    const parseStatusLabels = {
      pending: '待解析',
      parsed: '已解析',
      unsupported: '暂不支持',
      failed: '解析失败',
    };

    const sourceKindLabels = {
      text: '文字',
      image: '图片',
      word: 'Word',
      pdf: 'PDF',
      markdown: 'Markdown',
      'plain-text': '文本',
      file: '文件',
    };

    const auditActionLabels = {
      'project.created': '项目创建',
      'milestone.created': '里程碑创建',
      'milestone.updated': '里程碑更新',
      'work_item.created': '工作项创建',
      'work_item.updated': '工作项更新',
      'work_item.transitioned': '状态流转',
      'team_member.created': '成员创建',
      'team_member.updated': '成员更新',
      'work_item.assigned': '工作项分配',
      'workflow.updated': 'Workflow 更新',
      'delivery_evidence.updated': '证据更新',
      'intake_session.created': '录入会话创建',
      'intake_session.updated': '录入会话更新',
      'intake_message.created': '录入消息创建',
      'intake_source_document.created': '来源文件创建',
      'intake_candidate.created': '候选需求创建',
      'intake_candidate.updated': '候选需求更新',
      'intake_candidates.approved': '候选需求批准',
      'milestone_delivery_slice.created': '交付切片创建',
      'milestone_delivery_slice.updated': '交付切片更新',
    };

    const auditTargetTypeLabels = {
      project: 'Project',
      milestone: 'Milestone',
      work_item: 'WorkItem',
      team_member: 'Team Member',
      workflow_summary: 'Workflow',
      delivery_evidence: 'Evidence',
      intake_session: 'Intake Session',
      intake_message: 'Intake Message',
      intake_source_document: 'Source Document',
      intake_candidate: 'Intake Candidate',
      milestone_delivery_slice: 'Delivery Slice',
    };

    const candidateStatusLabels = {
      draft: '草稿',
      approved: '已批准',
      rejected: '已拒绝',
    };

    const priorityLabels = {
      p0: 'P0',
      p1: 'P1',
      p2: 'P2',
      p3: 'P3',
    };

    const crudOperationLabels = {
      create: '创建',
      read: '读取',
      update: '更新',
      lifecycle: '生命周期',
      delete: '删除/归档',
    };

    const crudStatusLabels = {
      implemented: '已实现',
      partial: '部分实现',
      planned: '计划中',
      not_applicable: '不适用',
      forbidden: '禁止硬删',
    };

    const crudEntityStatusLabels = {
      complete: '完整',
      usable: '可用',
      partial: '部分',
      planned: '计划中',
    };

    const priorityOrder = {
      p0: 0,
      p1: 1,
      p2: 2,
      p3: 3,
    };

    const closedStatuses = ['delivered', 'rejected', 'stopped'];

    const backlogTypeFilters = ['epic', 'feature', 'requirement', 'story', 'task', 'bug', 'research'];

    const backlogLevelFilters = [
      {
        id: 'portfolio',
        label: '组合 Backlog',
        shortLabel: 'Portfolio',
        description: 'Epic / Feature：长期目标、能力域和跨里程碑范围。',
        owner: 'PO/业务负责人',
        types: ['epic', 'feature'],
      },
      {
        id: 'product',
        label: '产品 Backlog',
        shortLabel: 'Product',
        description: 'Requirement / Story：可排序、可验收、可进入交付的价值单元。',
        owner: 'PO/BA',
        types: ['requirement', 'story'],
      },
      {
        id: 'execution',
        label: '执行 Backlog',
        shortLabel: 'Execution',
        description: 'Task：研发、测试、文档和验证的实施工作。',
        owner: '研发/QA',
        types: ['task'],
      },
      {
        id: 'discovery',
        label: '缺陷与研究',
        shortLabel: 'Discovery',
        description: 'Bug / Research：缺陷、风险、探索和待决问题。',
        owner: '敏捷团队',
        types: ['bug', 'defect', 'research'],
      },
    ];

    const backlogBuiltInViews = [
      {
        id: 'all',
        label: '全部 Backlog',
        filters: {
          query: '',
          level: '',
          type: '',
          status: '',
          warning: '',
          milestoneId: '',
          sort: 'rank',
          hideDelivered: true,
        },
      },
      {
        id: 'product-refinement',
        label: '产品 Refinement',
        filters: {
          query: '',
          level: 'product',
          type: '',
          status: '',
          warning: 'ready',
          milestoneId: '',
          sort: 'priority',
          hideDelivered: true,
        },
      },
      {
        id: 'milestone-gap',
        label: '未排里程碑',
        filters: {
          query: '',
          level: '',
          type: '',
          status: '',
          warning: '',
          milestoneId: 'no-milestone',
          sort: 'level',
          hideDelivered: true,
        },
      },
      {
        id: 'delivery-ready',
        label: 'Ready 交付',
        filters: {
          query: '',
          level: 'product',
          type: '',
          status: 'ready',
          warning: '',
          milestoneId: '',
          sort: 'priority',
          hideDelivered: true,
        },
      },
      {
        id: 'risk-watch',
        label: '风险队列',
        filters: {
          query: '',
          level: '',
          type: '',
          status: '',
          warning: 'ready',
          milestoneId: '',
          sort: 'priority',
          hideDelivered: true,
        },
      },
    ];

    const backlogColumnDefs = [
      { id: 'plan', label: '计划', template: 'minmax(142px, 0.66fr)' },
      { id: 'definition', label: '定义状态', template: 'minmax(166px, 0.78fr)' },
      { id: 'trace', label: '追踪', template: 'minmax(150px, 0.7fr)' },
      { id: 'next', label: '下一步', template: 'minmax(174px, 0.82fr)' },
    ];

    const backlogWarningFilters = [
      { id: 'coverage', label: '验收缺口', codes: ['uncovered_acceptance', 'missing_acceptance', 'missing_acceptance_coverage', 'missing_acceptance_evidence'] },
      { id: 'hierarchy', label: '层级问题', codes: ['tree_cycle_or_orphan', 'tree_cycle', 'missing_parent', 'orphan_without_parent', 'invalid_parent_type'] },
      { id: 'duplicate', label: '重复覆盖', codes: ['duplicate_acceptance_coverage'] },
      { id: 'ready', label: 'Ready 阻塞', codes: ['missing_analysis', 'missing_design', 'missing_milestone', 'blocked_dependency', 'blocked_by_work_items', 'not_ready_status'] },
    ];

    const parentTypesByType = {
      epic: [],
      feature: ['epic'],
      requirement: ['feature'],
      story: ['feature'],
      task: ['requirement', 'story'],
      bug: ['feature', 'requirement', 'story'],
      defect: ['feature', 'requirement', 'story'],
      research: ['epic', 'feature'],
      discussion: ['epic', 'feature', 'requirement', 'story', 'task', 'bug', 'defect', 'research'],
      meeting: ['epic', 'feature', 'requirement', 'story', 'task', 'bug', 'defect', 'research'],
      decision: ['epic', 'feature', 'requirement', 'story', 'task', 'bug', 'defect', 'research'],
      brainstorm: ['epic', 'feature', 'requirement', 'story', 'task', 'bug', 'defect', 'research'],
    };

    const statuses = [
      'inbox',
      'analyzing',
      'designing',
      'triaged',
      'planned',
      'ready',
      'in_progress',
      'in_review',
      'verifying',
      'gates_passing',
      'delivered',
      'rejected',
      'stopped',
    ];

    const implementationWorkItemTypes = ['story', 'task', 'bug', 'defect'];
    const acceptanceGateWorkItemTypes = ['requirement', 'story'];

    const statusOrder = Object.fromEntries(statuses.map((status, index) => [status, index]));

    const backlogFlowStages = [
      {
        id: 'refinement',
        label: '澄清与设计',
        description: '从 idea 到可评审需求。',
        statuses: ['inbox', 'analyzing', 'designing', 'triaged'],
      },
      {
        id: 'planning',
        label: '计划与 Ready',
        description: '排优先级、定范围、进入交付。',
        statuses: ['planned', 'ready'],
      },
      {
        id: 'delivery',
        label: '交付流水线',
        description: '开发、评审、验证和门禁。',
        statuses: ['in_progress', 'in_review', 'verifying', 'gates_passing'],
      },
      {
        id: 'closed',
        label: '完成或退出',
        description: '已交付、拒绝或停止。',
        statuses: ['delivered', 'rejected', 'stopped'],
      },
    ];

    const $ = (id) => document.getElementById(id);

    function backlogDefaultFilters() {
      return {
        query: '',
        level: '',
        type: '',
        status: '',
        warning: '',
        milestoneId: '',
        sort: 'rank',
        hideDelivered: true,
      };
    }

    function backlogDefaultColumns() {
      return {
        plan: true,
        definition: true,
        trace: true,
        next: true,
      };
    }

    function normalizeBacklogFilters(filters) {
      const defaults = backlogDefaultFilters();
      if (!filters || typeof filters !== 'object') return defaults;
      return {
        ...defaults,
        query: typeof filters.query === 'string' ? filters.query : defaults.query,
        level: typeof filters.level === 'string' ? filters.level : defaults.level,
        type: typeof filters.type === 'string' ? filters.type : defaults.type,
        status: typeof filters.status === 'string' ? filters.status : defaults.status,
        warning: typeof filters.warning === 'string' ? filters.warning : defaults.warning,
        milestoneId: typeof filters.milestoneId === 'string' ? filters.milestoneId : defaults.milestoneId,
        sort: typeof filters.sort === 'string' ? filters.sort : defaults.sort,
        hideDelivered: typeof filters.hideDelivered === 'boolean' ? filters.hideDelivered : defaults.hideDelivered,
      };
    }

    function normalizeBacklogColumns(columns) {
      const defaults = backlogDefaultColumns();
      if (!columns || typeof columns !== 'object') return defaults;
      return Object.fromEntries(
        backlogColumnDefs.map((column) => [column.id, typeof columns[column.id] === 'boolean' ? columns[column.id] : defaults[column.id]]),
      );
    }

    function backlogStorageKey(name) {
      return 'huntianling.backlog.' + (state.projectId || 'global') + '.' + name;
    }

    function readBacklogStorage(name, fallback) {
      try {
        const raw = localStorage.getItem(backlogStorageKey(name));
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    }

    function writeBacklogStorage(name, value) {
      try {
        localStorage.setItem(backlogStorageKey(name), JSON.stringify(value));
      } catch {
        setMessage('浏览器未允许保存 Backlog 偏好', true);
      }
    }

    function persistBacklogSavedViews() {
      writeBacklogStorage('savedViews', state.backlogSavedViews);
    }

    function persistBacklogColumns() {
      writeBacklogStorage('columns', state.backlogColumns);
    }

    function normalizeBacklogSavedViews(views) {
      if (!Array.isArray(views)) return [];
      return views
        .filter((view) => view && typeof view === 'object' && typeof view.id === 'string' && typeof view.label === 'string')
        .map((view) => ({
          id: view.id,
          label: view.label,
          filters: normalizeBacklogFilters(view.filters),
          columns: normalizeBacklogColumns(view.columns),
          updatedAt: typeof view.updatedAt === 'string' ? view.updatedAt : '',
        }));
    }

    function loadBacklogPreferences() {
      const preferenceProjectId = state.projectId || 'global';
      if (state.backlogSettingsProjectId === preferenceProjectId) return;
      state.backlogSettingsProjectId = preferenceProjectId;
      state.selectedBacklogIds.clear();
      state.activeBacklogViewId = '';
      state.backlogFilters = backlogDefaultFilters();
      state.backlogColumns = normalizeBacklogColumns(readBacklogStorage('columns', backlogDefaultColumns()));
      state.backlogSavedViews = normalizeBacklogSavedViews(readBacklogStorage('savedViews', []));
    }

    function visibleBacklogColumnDefs() {
      return backlogColumnDefs.filter((column) => state.backlogColumns[column.id]);
    }

    function backlogGridTemplate() {
      return ['minmax(250px, 1.35fr)', ...visibleBacklogColumnDefs().map((column) => column.template)].join(' ');
    }

    function applyBacklogView(view) {
      state.backlogFilters = normalizeBacklogFilters(view.filters);
      if (view.columns) {
        state.backlogColumns = normalizeBacklogColumns(view.columns);
        persistBacklogColumns();
      }
      state.activeBacklogViewId = view.id;
      state.selectedBacklogIds.clear();
      renderBoard();
    }

    function saveBacklogView(label, viewId = '') {
      const name = label.trim();
      if (!name) {
        setMessage('请先填写视图名称', true);
        return;
      }
      const existing = state.backlogSavedViews.find((view) => view.id === viewId);
      const now = new Date().toISOString();
      const savedView = {
        id: existing ? existing.id : 'custom-' + String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8),
        label: name,
        filters: normalizeBacklogFilters(state.backlogFilters),
        columns: normalizeBacklogColumns(state.backlogColumns),
        updatedAt: now,
      };
      state.backlogSavedViews = existing
        ? state.backlogSavedViews.map((view) => (view.id === existing.id ? savedView : view))
        : [...state.backlogSavedViews, savedView];
      state.activeBacklogViewId = savedView.id;
      persistBacklogSavedViews();
      setMessage(existing ? 'Backlog 视图已更新' : 'Backlog 视图已保存');
      renderBoard();
    }

    function deleteBacklogView(viewId) {
      const before = state.backlogSavedViews.length;
      state.backlogSavedViews = state.backlogSavedViews.filter((view) => view.id !== viewId);
      if (state.backlogSavedViews.length === before) return;
      if (state.activeBacklogViewId === viewId) state.activeBacklogViewId = '';
      persistBacklogSavedViews();
      setMessage('Backlog 视图已删除');
      renderBoard();
    }

    function reconcileBacklogSelection() {
      const ids = new Set((state.cards || []).map((card) => card.workItem.id));
      for (const id of [...state.selectedBacklogIds]) {
        if (!ids.has(id)) state.selectedBacklogIds.delete(id);
      }
    }

    function visibleSelectedBacklogIds(visibleCards) {
      const visibleIds = new Set(visibleCards.map((card) => card.workItem.id));
      return [...state.selectedBacklogIds].filter((id) => visibleIds.has(id));
    }

    function normalizeAreaId(areaId) {
      return Object.hasOwn(workspaceAreas, areaId) ? areaId : 'requirements';
    }

    function areaForView(viewId) {
      return viewAreaIds[viewId] || 'requirements';
    }

    function activeArea() {
      state.areaId = normalizeAreaId(state.areaId || areaForView(state.viewId));
      const area = workspaceAreas[state.areaId];
      if (area.views.length > 0 && !area.views.includes(state.viewId)) {
        state.viewId = area.views[0];
      }
      return area;
    }

    function updateLocationState() {
      const area = activeArea();
      const params = new URLSearchParams(location.search);
      params.set('areaId', state.areaId);
      if (state.projectId) params.set('projectId', state.projectId);
      else params.delete('projectId');
      if (state.areaId === 'intake' && state.selectedIntakeSessionId) {
        params.set('intakeSessionId', state.selectedIntakeSessionId);
      } else {
        params.delete('intakeSessionId');
      }
      if (area.views.length > 0 && state.viewId) params.set('viewId', state.viewId);
      else params.delete('viewId');
      history.replaceState(null, '', '?' + params.toString());
    }

    function renderWorkspaceChrome() {
      const area = activeArea();
      const view = viewSpecs[state.viewId] || { label: area.boardTitle, description: area.description };
      const sidebar = sidebarChromeForArea(area);
      document.title = view.label + ' · ' + area.label + ' · HuntianLing';
      document.body.dataset.currentAreaId = state.areaId;
      $('workspace-title').textContent = sidebar.title;
      $('workspace-description').textContent = sidebar.description;
      $('workspace-stage').textContent = area.stage;
      $('workspace-heading').textContent = area.navTitle;
      $('workspace-lede').textContent = area.description;
      $('board-title').textContent = view.label;
      $('view-description').textContent = view.description || area.description;
      $('work-item-composer').hidden = state.areaId !== 'requirements';
      renderWorkspaceContext(area, view);
      renderViewTabs(area);

      document.querySelectorAll('.module-rail [data-area-id]').forEach((button) => {
        const buttonArea = workspaceAreas[button.dataset.areaId];
        const active = button.dataset.areaId === state.areaId;
        if (buttonArea) {
          button.innerHTML = '<span class="module-label"></span><span class="module-stage"></span>';
          button.querySelector('.module-label').textContent = buttonArea.label;
          button.querySelector('.module-stage').textContent = buttonArea.navTitle;
        }
        button.classList.toggle('active', active);
        button.setAttribute('aria-current', active ? 'page' : 'false');
        button.disabled = state.auth.enabled && !state.auth.authenticated && button.dataset.areaId !== 'settings';
      });

      document.querySelectorAll('[data-area-panel]').forEach((panel) => {
        const areas = (panel.dataset.areaPanel || '').split(/\\s+/).filter(Boolean);
        panel.hidden = !areas.includes(state.areaId);
      });

      const select = $('view-select') || document.querySelector('select[aria-label="看板视图"]');
      if (!select) return;
      select.hidden = area.views.length <= 1;
      select.innerHTML = '';
      if (area.views.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '项目设置';
        select.append(option);
        select.disabled = true;
        return;
      }
      for (const viewId of area.views) {
        const option = document.createElement('option');
        option.value = viewId;
        option.textContent = viewLabels[viewId] || viewId;
        select.append(option);
      }
      select.value = state.viewId;
      select.disabled = area.views.length === 1 || (state.auth.enabled && !state.auth.authenticated);
    }

    function sidebarChromeForArea(area) {
      if (state.areaId === 'planning') {
        return {
          title: '里程碑维护',
          description: '维护里程碑目标、状态和日期。',
        };
      }
      return {
        title: area.navTitle,
        description: area.description,
      };
    }

    function renderWorkspaceContext(area, view) {
      const root = $('workspace-context');
      root.innerHTML = '';
      const project = currentProject();
      root.append(
        badge(project ? '项目 ' + project.name : '未选择项目', project ? 'ready' : 'warning'),
        badge('对象 ' + area.object),
        badge('产出 ' + area.output),
        badge('负责人 ' + area.owner),
        badge('视图 ' + view.label, 'workflow'),
      );
    }

    function renderViewTabs(area) {
      const root = $('view-tabs');
      root.innerHTML = '';
      root.hidden = area.views.length <= 1;
      for (const viewId of area.views) {
        const spec = viewSpecs[viewId] || { label: viewId, description: '' };
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'view-tab' + (viewId === state.viewId ? ' active' : '');
        button.disabled = state.auth.enabled && !state.auth.authenticated;
        button.setAttribute('aria-current', viewId === state.viewId ? 'page' : 'false');
        button.setAttribute('title', spec.description || spec.label);
        button.innerHTML = '<strong></strong><span></span>';
        button.querySelector('strong').textContent = spec.label;
        button.querySelector('span').textContent = spec.description;
        button.addEventListener('click', async () => {
          if (state.viewId === viewId || button.disabled) return;
          state.viewId = viewId;
          state.areaId = areaForView(viewId);
          clearWorkItemSelection();
          updateLocationState();
          await loadBoard();
        });
        root.append(button);
      }
    }

    function setMessage(text, isError = false) {
      const message = $('message');
      message.textContent = text;
      message.classList.toggle('error', isError);
    }

    function renderAuthPanel() {
      const auth = state.auth;
      const user = $('auth-user');
      const loginForm = $('login-form');
      const logoutButton = $('logout-button');
      const providers = $('provider-list');
      document.body.classList.toggle('auth-locked', auth.enabled && !auth.authenticated);
      if (auth.enabled && !auth.authenticated) {
        state.areaId = 'settings';
      }
      if (!auth.enabled) {
        user.textContent = '本地访问模式';
        loginForm.hidden = true;
        logoutButton.hidden = true;
        providers.replaceChildren();
        renderWorkspaceChrome();
        return;
      }
      loginForm.hidden = auth.authenticated;
      logoutButton.hidden = !auth.authenticated;
      if (auth.authenticated && auth.principal) {
        user.classList.remove('empty');
        user.innerHTML = '<strong></strong><span></span>';
        user.querySelector('strong').textContent = auth.principal.displayName;
        user.querySelector('span').textContent =
          auth.principal.kind === 'api-token'
            ? 'API token'
            : '账号 ' + auth.principal.username;
      } else {
        user.classList.add('empty');
        user.textContent = '请登录后访问项目看板';
      }
      providers.replaceChildren();
      for (const provider of auth.providers) {
        providers.append(renderAuthProviderButton(provider));
      }
      renderWorkspaceChrome();
    }

    function renderAuthProviderButton(provider) {
      const button = document.createElement('button');
      button.type = 'button';
      button.disabled = !provider.enabled;
      button.textContent = provider.enabled ? provider.label : provider.label + ' 未配置';
      if (provider.enabled && provider.loginUrl) {
        button.addEventListener('click', () => {
          location.href = provider.loginUrl;
        });
      }
      return button;
    }

    function applyAuthPayload(payload) {
      const providerSet = payload.auth && payload.auth.providers ? payload.auth.providers : null;
      state.auth = {
        enabled: Boolean(payload.auth && payload.auth.enabled),
        authenticated: Boolean(payload.authenticated),
        principal: payload.principal || null,
        session: payload.session || null,
        providers: providerSet ? providerSet.providers || [] : [],
        region: providerSet ? providerSet.region : state.auth.region,
      };
      $('login-region').value = state.auth.region;
      renderAuthPanel();
    }

    async function loadSession() {
      const payload = await api('/api/auth/session');
      applyAuthPayload(payload);
      return payload;
    }

    async function loadProviders(region) {
      const payload = await api('/api/auth/providers?region=' + encodeURIComponent(region));
      state.auth = {
        ...state.auth,
        providers: payload.providers || [],
        region: payload.region || region,
      };
      $('login-region').value = state.auth.region;
      renderAuthPanel();
    }

    async function login(form) {
      try {
        const payload = await api('/api/auth/password/login', {
          method: 'POST',
          body: JSON.stringify({
            username: form.elements.username.value.trim(),
            password: form.elements.password.value,
            region: form.elements.region.value,
          }),
        });
        if (payload.shellPath && payload.shellPath !== '/developer' && payload.shellPath !== '/board') {
          window.location.assign(payload.shellPath);
          return;
        }
        applyAuthPayload({
          auth: {
            enabled: true,
            providers: {
              region: state.auth.region,
              providers: state.auth.providers,
            },
          },
          authenticated: payload.authenticated,
          principal: payload.principal,
          session: payload.session,
        });
        form.elements.password.value = '';
        await loadProjects();
        await loadMilestones();
        await loadBoard();
        setMessage('已登录');
      } catch (error) {
        setMessage(error.message, true);
      }
    }

    async function logout() {
      try {
        await api('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
        await loadSession();
        state.projects = [];
        state.milestones = [];
        state.teamMembers = [];
        state.intakeSessions = [];
        state.intakeBundle = null;
        state.workItems = [];
        state.cards = [];
        state.mainBoard = null;
        state.selectedId = null;
        state.selectedIntakeSessionId = '';
        syncIntakeCandidateSelection();
        renderProjectSelect();
        renderMilestones();
        renderTeamMembers();
        renderIntakeSessions();
        renderTeamSelects();
        renderHealth();
        renderBoard();
        renderTree();
        await renderDetail();
        setMessage('已退出登录');
      } catch (error) {
        setMessage(error.message, true);
      }
    }

    function requestHeaders(withJson = false) {
      const headers = {};
      if (withJson) headers['content-type'] = 'application/json';
      if (state.token) headers.authorization = 'Bearer ' + state.token;
      return headers;
    }

    async function api(path, options = {}) {
      const response = await fetch(path, {
        ...options,
        credentials: 'same-origin',
        headers: { ...requestHeaders(Boolean(options.body)), ...(options.headers || {}) },
      });
      const text = await response.text();
      const payload = text ? JSON.parse(text) : null;
      if (!response.ok) {
        throw new Error(payload && payload.error ? payload.error : response.statusText);
      }
      return payload;
    }

    async function createProjectFromValues(nameValue, descriptionValue, afterCreate) {
      const name = nameValue.trim();
      if (!name) {
        setMessage('项目名称不能为空', true);
        return;
      }
      try {
        const project = await api('/api/projects', {
          method: 'POST',
          body: JSON.stringify({
            name,
            description: descriptionValue.trim(),
          }),
        });
        state.projectId = project.id;
        if (afterCreate) afterCreate();
        await loadProjects();
        await loadMilestones();
        await loadBoard();
        setMessage('项目已创建');
      } catch (error) {
        setMessage(error.message, true);
      }
    }

    function saveTokenValue(value) {
      state.token = value.trim();
      $('write-token').value = state.token;
      localStorage.setItem('huntianling.writeToken', state.token);
      setMessage('令牌已保存');
      if (state.areaId === 'settings' && state.viewId === 'admin-settings') {
        renderHealth();
        renderBoard();
      }
    }

    function itemById(id) {
      return state.workItems.find((item) => item.id === id) || null;
    }

    function milestoneById(id) {
      return state.milestones.find((milestone) => milestone.id === id) || null;
    }

    function intakeCandidateById(id) {
      const bundle = state.intakeBundle;
      return bundle ? bundle.candidates.find((candidate) => candidate.id === id) || null : null;
    }

    function intakeMessageById(id) {
      const bundle = state.intakeBundle;
      return bundle ? bundle.messages.find((message) => message.id === id) || null : null;
    }

    function intakeSourceDocumentById(id) {
      const bundle = state.intakeBundle;
      return bundle ? bundle.sourceDocuments.find((sourceDocument) => sourceDocument.id === id) || null : null;
    }

    function intakeSourceChunkById(sourceDocument, chunkId) {
      return sourceDocument ? sourceDocument.chunks.find((chunk) => chunk.id === chunkId) || null : null;
    }

    function intakeCandidateDepth(candidate) {
      const bundle = state.intakeBundle;
      if (!bundle) return 0;
      let depth = 0;
      let parentId = candidate.parentCandidateId;
      const visited = new Set([candidate.id]);
      while (parentId) {
        if (visited.has(parentId)) break;
        visited.add(parentId);
        const parent = bundle.candidates.find((item) => item.id === parentId);
        if (!parent) break;
        depth += 1;
        parentId = parent.parentCandidateId;
      }
      return depth;
    }

    function intakeCandidateDescendantIds(candidateId) {
      const bundle = state.intakeBundle;
      if (!bundle) return [];
      const descendants = [];
      const visit = (parentId) => {
        for (const child of bundle.candidates.filter((candidate) => candidate.parentCandidateId === parentId)) {
          descendants.push(child.id);
          visit(child.id);
        }
      };
      visit(candidateId);
      return descendants;
    }

    function syncIntakeCandidateSelection() {
      const bundle = state.intakeBundle;
      if (!bundle) {
        state.selectedIntakeCandidateIds = new Set();
        state.intakeSelectionSessionId = '';
        state.intakeKnownCandidateIds = new Set();
        return;
      }
      const candidateIds = new Set(bundle.candidates.map((candidate) => candidate.id));
      const draftIds = new Set(
        bundle.candidates
          .filter((candidate) => candidate.status === 'draft')
          .map((candidate) => candidate.id),
      );
      if (state.intakeSelectionSessionId !== bundle.session.id) {
        state.selectedIntakeCandidateIds = new Set(draftIds);
        state.intakeSelectionSessionId = bundle.session.id;
        state.intakeKnownCandidateIds = candidateIds;
        return;
      }
      for (const candidateId of [...state.selectedIntakeCandidateIds]) {
        if (!draftIds.has(candidateId)) state.selectedIntakeCandidateIds.delete(candidateId);
      }
      for (const candidate of bundle.candidates) {
        if (candidate.status === 'draft' && !state.intakeKnownCandidateIds.has(candidate.id)) {
          state.selectedIntakeCandidateIds.add(candidate.id);
        }
      }
      state.intakeKnownCandidateIds = candidateIds;
    }

    function selectedDraftIntakeCandidateIds(bundle = state.intakeBundle) {
      if (!bundle) return [];
      const draftIds = new Set(
        bundle.candidates
          .filter((candidate) => candidate.status === 'draft')
          .map((candidate) => candidate.id),
      );
      return [...state.selectedIntakeCandidateIds].filter((candidateId) => draftIds.has(candidateId));
    }

    function setIntakeCandidateSelected(candidateId, selected) {
      const candidate = intakeCandidateById(candidateId);
      if (!candidate || candidate.status !== 'draft') return;
      if (selected) {
        let current = candidate;
        while (current) {
          if (current.status === 'draft') state.selectedIntakeCandidateIds.add(current.id);
          current = current.parentCandidateId ? intakeCandidateById(current.parentCandidateId) : null;
        }
      } else {
        state.selectedIntakeCandidateIds.delete(candidateId);
        for (const descendantId of intakeCandidateDescendantIds(candidateId)) {
          state.selectedIntakeCandidateIds.delete(descendantId);
        }
      }
      renderBoard();
    }

    function childrenOf(parentId) {
      return state.workItems
        .filter((item) => item.parentId === parentId)
        .sort((left, right) => left.sortOrder - right.sortOrder);
    }

    function workItemDescendantIds(itemId) {
      const descendants = [];
      const seen = new Set([itemId]);
      const visit = (parentId) => {
        for (const child of state.workItems.filter((item) => item.parentId === parentId)) {
          if (seen.has(child.id)) continue;
          seen.add(child.id);
          descendants.push(child.id);
          visit(child.id);
        }
      };
      visit(itemId);
      return descendants;
    }

    function allowedParentTypesForType(type) {
      return parentTypesByType[type] || [];
    }

    function fillWorkItemParentSelect(select, type, selectedId = '', editingId = null) {
      const allowedTypes = allowedParentTypesForType(type);
      const excluded = new Set(editingId ? [editingId, ...workItemDescendantIds(editingId)] : []);
      const selectedValue = selectedId || '';
      let selectedOptionAdded = selectedValue === '';
      select.innerHTML = '<option value="">无父项</option>';
      if (allowedTypes.length > 0) {
        for (const item of state.workItems) {
          if (excluded.has(item.id) || !allowedTypes.includes(item.type)) continue;
          const option = document.createElement('option');
          option.value = item.id;
          option.textContent = typeLabels[item.type] + ' · ' + item.title;
          select.append(option);
          if (item.id === selectedValue) selectedOptionAdded = true;
        }
      }
      if (!selectedOptionAdded && selectedValue) {
        const currentParent = itemById(selectedValue);
        const option = document.createElement('option');
        option.value = selectedValue;
        option.textContent = currentParent
          ? '当前父项 · ' + typeLabels[currentParent.type] + ' · ' + currentParent.title
          : '缺失父项 · ' + selectedValue;
        select.append(option);
      }
      select.value = selectedValue;
    }

    function renderProjectSelect() {
      const select = $('project-select');
      select.innerHTML = '';
      for (const project of state.projects) {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        select.append(option);
      }
      select.value = state.projectId;
    }

    function renderParentSelect() {
      const select = $('parent-select');
      const typeInput = $('item-type');
      fillWorkItemParentSelect(select, typeInput ? typeInput.value : 'requirement');
    }

    function fillMilestoneSelect(select, selectedId = '') {
      select.innerHTML = '<option value="">未分配</option>';
      for (const milestone of state.milestones) {
        const option = document.createElement('option');
        option.value = milestone.id;
        option.textContent = milestone.title;
        select.append(option);
      }
      select.value = selectedId || '';
    }

    function currentProject() {
      return state.projects.find((project) => project.id === state.projectId) || null;
    }

    function fillRoleSelect(select, selectedId = '') {
      const project = currentProject();
      select.innerHTML = '<option value="">不绑定角色</option>';
      for (const role of project ? project.roles || [] : []) {
        const option = document.createElement('option');
        option.value = role.id;
        option.textContent = role.displayName;
        select.append(option);
      }
      select.value = selectedId || '';
    }

    function fillTeamMemberSelect(select, selectedId = '') {
      select.innerHTML = '<option value="">未分配</option>';
      for (const member of state.teamMembers) {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = member.displayName;
        select.append(option);
      }
      select.value = selectedId || '';
    }

    function renderMilestoneSelects() {
      fillMilestoneSelect($('item-milestone'));
      const detailSelect = document.querySelector('[name="detailMilestoneId"]');
      if (detailSelect) fillMilestoneSelect(detailSelect, detailSelect.dataset.selectedId || '');
    }

    function renderTeamSelects() {
      fillRoleSelect($('team-role'));
      const assigneeSelect = document.querySelector('[name="assignmentMemberId"]');
      if (assigneeSelect) fillTeamMemberSelect(assigneeSelect, assigneeSelect.dataset.selectedId || '');
      const assignmentRole = document.querySelector('[name="assignmentRoleId"]');
      if (assignmentRole) fillRoleSelect(assignmentRole, assignmentRole.dataset.selectedId || '');
    }

    function renderTeamMembers() {
      const root = $('team-members');
      root.className = 'team-list';
      root.innerHTML = '';
      if (state.teamMembers.length === 0) {
        root.className = 'team-list empty';
        root.textContent = '暂无团队成员';
        return;
      }
      const project = currentProject();
      const roleNames = new Map((project ? project.roles || [] : []).map((role) => [role.id, role.displayName]));
      const summaries = state.mainBoard && state.mainBoard.teamBoard
        ? state.mainBoard.teamBoard.capacity.members
        : [];
      for (const member of state.teamMembers) {
        const summary = summaries.find((item) => item.member.id === member.id);
        const row = document.createElement('div');
        row.className = 'team-row';
        row.innerHTML =
          '<strong></strong>' +
          '<span class="meta"></span>' +
          '<div class="capacity-bar"><span></span></div>';
        row.querySelector('strong').textContent = member.displayName;
        const meta = row.querySelector('.meta');
        meta.append(badge(memberTypeLabels[member.memberType] || member.memberType));
        meta.append(badge(memberStatusLabels[member.status] || member.status, member.status === 'active' ? 'ready' : 'warning'));
        const roleText = member.roleIds.length > 0
          ? member.roleIds.map((roleId) => roleNames.get(roleId) || roleId).join(' / ')
          : '未绑定角色';
        meta.append(document.createTextNode(roleText));
        if (summary) {
          meta.append(badge('WIP ' + String(summary.assignedCount) + '/' + String(member.concurrentWorkLimit), summary.overLimit ? 'warning' : ''));
          if (summary.blockedCount > 0) meta.append(badge('阻塞 ' + String(summary.blockedCount), 'blocking'));
          for (const warning of summary.warnings) {
            meta.append(badge(warningLabels[warning] || warning, warning === 'member_unavailable_with_work' ? 'blocking' : 'warning'));
          }
          const fill = row.querySelector('.capacity-bar span');
          const ratio = member.concurrentWorkLimit === 0
            ? 0
            : Math.min(1, summary.assignedCount / member.concurrentWorkLimit);
          fill.style.width = String(Math.round(ratio * 100)) + '%';
        }
        root.append(row);
      }
    }

    function renderIntakeSessions() {
      const root = $('intake-sessions');
      root.className = 'intake-session-list';
      root.innerHTML = '';
      if (state.intakeSessions.length === 0) {
        root.className = 'intake-session-list empty';
        root.textContent = '暂无录入会话';
        return;
      }
      for (const session of state.intakeSessions) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'intake-session-row' + (session.id === state.selectedIntakeSessionId ? ' selected' : '');
        row.innerHTML = '<strong></strong><span class="meta"></span>';
        row.querySelector('strong').textContent = session.title || '(无主题)';
        const meta = row.querySelector('.meta');
        meta.append(badge(intakeStatusLabels[session.status] || session.status, session.status === 'approved' ? 'ready' : 'workflow'));
        meta.append(badge('消息 ' + String(session.messageIds.length)));
        meta.append(badge('附件 ' + String(session.sourceDocumentIds.length)));
        meta.append(badge('候选 ' + String(session.candidateIds.length)));
        row.addEventListener('click', async () => {
          state.selectedIntakeSessionId = session.id;
          updateLocationState();
          await loadIntake();
          renderBoard();
          await renderDetail();
        });
        root.append(row);
      }
    }

    function renderMilestones() {
      const root = $('milestones');
      root.className = 'milestone-list';
      root.innerHTML = '';
      if (state.milestones.length === 0) {
        root.className = 'milestone-list empty';
        root.textContent = '暂无里程碑';
        return;
      }
      for (const milestone of state.milestones) {
        const row = document.createElement('div');
        row.className = 'milestone-row';
        const summary = state.mainBoard && state.mainBoard.milestoneSummaries
          ? state.mainBoard.milestoneSummaries.find((item) => item.milestone.id === milestone.id)
          : null;
        const count = summary
          ? summary.totalWorkItems
          : state.workItems.filter((item) => item.milestoneId === milestone.id).length;
        row.innerHTML = '<strong></strong><span class="meta"></span><p class="muted"></p>';
        row.querySelector('strong').textContent = milestone.title;
        row.querySelector('.meta').textContent =
          (milestoneStatusLabels[milestone.status] || milestone.status) +
          ' · ' +
          String(count) +
          ' 个工作项' +
          (summary ? ' · ' + String(summary.percentDelivered) + '% 已交付' : '');
        row.querySelector('p').textContent = milestone.goal || milestone.description || '未填写目标';
        root.append(row);
      }
    }

    function renderHealth() {
      const root = $('board-health');
      root.innerHTML = '';
      const compactHealth =
        (state.areaId === 'intake' && state.viewId === 'intake-board') ||
        (state.areaId === 'settings' && state.viewId === 'admin-settings');
      root.hidden = compactHealth;
      if (root.parentElement) root.parentElement.classList.toggle('compact', compactHealth);
      if (compactHealth) return;
      const board = state.mainBoard;
      if (!board) {
        root.append(metric('0', '工作项'), metric('0', '当前告警'), metric('0', '可用视图'));
        return;
      }
      const health = board.boardHealth;
      if (state.areaId === 'intake') {
        const bundle = state.intakeBundle;
        root.append(
          metric(String(state.intakeSessions.length), '录入会话'),
          metric(String(bundle ? bundle.messages.length : 0), '当前消息'),
          metric(String(bundle ? bundle.sourceDocuments.length : 0), '来源文件'),
          metric(String(bundle ? bundle.candidates.length : 0), '候选需求'),
          metric(String(selectedDraftIntakeCandidateIds(bundle).length), '待批准候选'),
        );
        return;
      }
      if (state.areaId === 'requirements') {
        const tree = board.tree || { roots: [], maxDepth: 0, warnings: [] };
        const coverage = board.coverage || { uncoveredCriteria: 0, duplicateCoveredCriteria: 0 };
        root.append(
          metric(String(health.total), '工作项'),
          metric(String(tree.roots.length), '根节点'),
          metric(String(tree.maxDepth), '最大层级'),
          metric(String(coverage.uncoveredCriteria), '验收缺口'),
          metric(String((coverage.duplicateCoveredCriteria || 0) + tree.warnings.length), '追踪告警'),
        );
        return;
      }
      if (state.areaId === 'planning') {
        const milestoneBoard = board.milestoneBoard || {
          totalSlices: 0,
          completedSlices: 0,
          openSlices: 0,
          percentSlicesComplete: 0,
        };
        root.append(
          metric(String(state.milestones.length), '里程碑'),
          metric(String(milestoneBoard.completedSlices) + '/' + String(milestoneBoard.totalSlices), '交付切片'),
          metric(String(milestoneBoard.percentSlicesComplete) + '%', '切片完成率'),
          metric(String(health.withoutMilestone), '未排里程碑'),
        );
        return;
      }
      if (state.areaId === 'team') {
        const capacity = board.teamBoard ? board.teamBoard.capacity : null;
        root.append(
          metric(capacity ? String(capacity.activeMembers) + '/' + String(capacity.totalMembers) : '0/0', '可工作成员'),
          metric(capacity ? String(capacity.unassignedWorkItems) : '0', '未分配工作'),
          metric(capacity ? String(capacity.overloadedMembers) : '0', 'WIP 超限'),
          metric(capacity ? String(capacity.unavailableMembers) : '0', '不可用成员'),
        );
        return;
      }
      if (state.areaId === 'workflow') {
        const workflow = board.workflowBoard || {
          storyQueue: { readyStoryIds: [], skippedStoryIds: [] },
          lifecycleCoverage: {
            totalLanes: 0,
            occupiedLanes: 0,
            blockedCards: 0,
            missingEvidenceCards: 0,
          },
          activeWorkflows: 0,
          blockedWorkflows: 0,
          waitingApprovals: 0,
          waitingReviews: 0,
          failedChecks: 0,
        };
        const coverage = workflowLifecycleCoverage(workflow);
        root.append(
          metric(String(workflow.storyQueue.readyStoryIds.length), '可启动 Story'),
          metric(String(workflow.activeWorkflows), '活动运行'),
          metric(String(coverage.blockedCards || workflow.blockedWorkflows), '阻塞工作'),
          metric(String(workflow.failedChecks), '失败检查'),
        );
        return;
      }
      if (state.areaId === 'evidence') {
        const rollup = board.evidenceBoard ? board.evidenceBoard.rollup : null;
        root.append(
          metric(rollup ? String(rollup.readyWorkItemIds.length) : '0', '证据可交付'),
          metric(rollup ? String(rollup.blockedWorkItemIds.length) : '0', '证据阻塞'),
          metric(rollup ? String(rollup.workItemsWithPullRequests) + '/' + String(rollup.workItemsWithCi) : '0/0', 'PR/CI'),
          metric(rollup ? String((rollup.unapprovedObligations || 0) + (rollup.openRiskAcceptances || 0)) : '0', '治理待办'),
        );
        return;
      }
      if (state.areaId === 'settings' && state.viewId === 'audit-board') {
        const events = state.audit.events || [];
        root.append(
          metric(state.audit.loading ? '读取中' : String(events.length), '审计事件'),
          metric(String(new Set(events.map((event) => event.action)).size), '动作'),
          metric(String(new Set(events.map((event) => event.targetType)).size), '对象类型'),
          metric(String(state.audit.filters.limit || '50'), '读取上限'),
        );
        return;
      }
      if (state.areaId === 'settings' && state.viewId === 'business-crud') {
        const summary = state.businessCrud.data ? state.businessCrud.data.summary : null;
        root.append(
          metric(summary ? String(summary.entities) : '0', '业务对象'),
          metric(summary ? String(summary.usable + summary.complete) : '0', '可用/完整'),
          metric(summary ? String(summary.gaps) : '0', '待补缺口'),
          metric(summary ? String(summary.partial + summary.planned) : '0', '未完成对象'),
        );
        return;
      }
      root.append(
        metric(String(state.projects.length), '项目'),
        metric(String(state.workItems.length), '工作项'),
        metric(String(state.milestones.length), '里程碑'),
        metric(String(state.teamMembers.length), '成员'),
        metric(state.auth.enabled ? '启用' : '本地', '认证'),
      );
    }

    function renderCard(card) {
      const item = card.workItem;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'work-card' + (item.id === state.selectedId ? ' selected' : '');
      button.dataset.itemId = item.id;
      button.innerHTML = '<span class="card-code"></span><strong></strong><span class="card-summary"></span>';
      button.querySelector('.card-code').textContent = item.id;
      button.querySelector('strong').textContent = item.title || '(无标题)';
      const summary = button.querySelector('.card-summary');
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.append(badge(typeLabels[item.type] || item.type, 'type-' + item.type));
      meta.append(priorityBadge(item.priority));
      meta.append(document.createTextNode(statusLabels[item.status] || item.status));
      if (card.milestone) meta.append(document.createTextNode('里程碑 ' + card.milestone.title));
      if (card.assigneeMember) meta.append(document.createTextNode('负责人 ' + card.assigneeMember.displayName));
      else if (item.assignee) meta.append(document.createTextNode('负责人 ' + item.assignee));
      summary.append(meta);

      const lineage = document.createElement('span');
      lineage.className = 'meta';
      const parentText = card.parentBreadcrumb.length > 0
        ? card.parentBreadcrumb.map((parent) => parent.title).join(' / ')
        : 'Root';
      lineage.append(document.createTextNode(parentText));
      if (card.childRollup.total > 0) {
        lineage.append(badge('子项 ' + String(card.childRollup.unfinished) + '/' + String(card.childRollup.total)));
      }
      if (card.acceptanceRollup.totalCriteria > 0) {
        const coverageText =
          '验收 ' +
          String(card.acceptanceRollup.coveredCriteria) +
          '/' +
          String(card.acceptanceRollup.totalCriteria);
        lineage.append(badge(coverageText, card.acceptanceRollup.complete ? 'ready' : 'blocking'));
      }
      summary.append(lineage);

      const signals = document.createElement('span');
      signals.className = 'meta';
      signals.append(badge(card.workflowSummary.nextAction, 'workflow'));
      if (card.workflowSummary.waitingApprovals.length > 0) {
        signals.append(badge('审批 ' + String(card.workflowSummary.waitingApprovals.length), 'warning'));
      }
      if (card.workflowSummary.waitingReviews.length > 0) {
        signals.append(badge('评审 ' + String(card.workflowSummary.waitingReviews.length), 'warning'));
      }
      if (card.workflowSummary.blockedSteps.length > 0) {
        signals.append(badge('阻塞步骤 ' + String(card.workflowSummary.blockedSteps.length), 'blocking'));
      }
      if (card.workflowSummary.failedChecks.length > 0) {
        signals.append(badge('失败检查 ' + String(card.workflowSummary.failedChecks.length), 'blocking'));
      }
      if (card.evidenceSummary.evidenceCount > 0) {
        signals.append(badge('证据 ' + String(card.evidenceSummary.evidenceCount), 'ready'));
      }
      if (card.evidenceSummary.pullRequestCount > 0) {
        signals.append(badge('PR ' + String(card.evidenceSummary.pullRequestCount), 'ready'));
      }
      if (card.evidenceSummary.reviewCount > 0) {
        signals.append(badge('Review ' + String(card.evidenceSummary.reviewCount), 'ready'));
      }
      if (card.evidenceSummary.ciRunCount > 0) {
        signals.append(badge('CI ' + String(card.evidenceSummary.ciRunCount), 'ready'));
      }
      if (card.evidenceSummary.missingRequiredChecks > 0) {
        signals.append(badge('缺必需检查 ' + String(card.evidenceSummary.missingRequiredChecks), 'blocking'));
      }
      if (card.governanceSummary.blockers.length > 0) {
        signals.append(badge('治理阻塞 ' + String(card.governanceSummary.blockers.length), 'blocking'));
      }
      for (const warning of card.warnings.slice(0, 3)) {
        signals.append(badge(warningLabels[warning.code] || warning.code, warning.severity));
      }
      summary.append(signals);

      button.addEventListener('click', () => selectItem(item.id));
      return button;
    }

    function renderTeamWorkCard(card) {
      const item = card.workItem;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'team-work-card' + (item.id === state.selectedId ? ' selected' : '');
      button.dataset.itemId = item.id;
      const code = document.createElement('span');
      code.className = 'card-code';
      code.textContent = item.id;
      const title = document.createElement('strong');
      title.textContent = item.title || '(无标题)';
      const detail = document.createElement('p');
      detail.textContent = (typeLabels[item.type] || item.type) + ' · ' + (statusLabels[item.status] || item.status);
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.append(priorityBadge(item.priority));
      if (card.assigneeMember) {
        meta.append(badge('负责人 ' + card.assigneeMember.displayName, 'ready'));
      } else if (item.assignee) {
        meta.append(badge('负责人 ' + item.assignee, 'warning'));
      } else {
        meta.append(badge('未分配', 'warning'));
      }
      if (item.claimedRoleId) meta.append(badge(teamRoleName(item.claimedRoleId), 'workflow'));
      for (const warning of teamWarningBadges(card)
        .filter((item) => item.code !== 'unassigned_work')
        .slice(0, 3)) {
        meta.append(badge(warningLabels[warning.code] || warning.code, warning.severity));
      }
      button.append(code, title, detail, meta);
      button.addEventListener('click', () => selectItem(item.id));
      return button;
    }

    function teamWarningBadges(card) {
      return (card.warnings || []).filter((warning) => [
        'unassigned_work',
        'unknown_assignee',
        'assignee_unavailable',
        'member_over_wip_limit',
      ].includes(warning.code));
    }

    function badge(text, extraClass = '') {
      const span = document.createElement('span');
      span.className = 'badge ' + extraClass;
      span.textContent = text;
      return span;
    }

    function formatFileSize(size) {
      if (!Number.isFinite(size) || size <= 0) return '0 B';
      if (size < 1024) return String(size) + ' B';
      if (size < 1024 * 1024) return String(Math.round(size / 1024)) + ' KB';
      return String((size / 1024 / 1024).toFixed(1)) + ' MB';
    }

    function priorityBadge(priority) {
      return badge(
        priority ? priorityLabels[priority] || priority.toUpperCase() : '未定优先级',
        priority ? 'priority-' + priority : '',
      );
    }

    function textSnippet(text, fallback = '未填写说明', maxLength = 96) {
      const value = String(text || '').replace(/\\s+/g, ' ').trim();
      if (!value) return fallback;
      return value.length > maxLength ? value.slice(0, maxLength - 1) + '…' : value;
    }

    function backlogLevelForType(type) {
      return backlogLevelFilters.find((level) => level.types.includes(type)) || {
        id: 'other',
        label: '其他工作',
        shortLabel: 'Other',
        description: '尚未归入标准 Backlog 层级的工作。',
        owner: '敏捷团队',
        types: [type],
      };
    }

    function backlogLevelById(levelId) {
      return backlogLevelFilters.find((level) => level.id === levelId) || null;
    }

    function cardHasBacklogRisk(card) {
      return backlogWarningFilters.some((filter) => backlogWarningFilterMatches(card, filter.id));
    }

    function isProductBacklogItem(card) {
      return ['requirement', 'story'].includes(card.workItem.type);
    }

    function isReadyStory(card) {
      return isProductBacklogItem(card) && card.workItem.status === 'ready';
    }

    function storyQueueItems() {
      return state.mainBoard && state.mainBoard.storyQueue ? state.mainBoard.storyQueue.items : [];
    }

    function storyQueueItemForWorkItem(workItemId) {
      return storyQueueItems().find((item) => item.workItemId === workItemId) || null;
    }

    function formatDateLabel(timestamp) {
      if (!Number.isFinite(timestamp)) return '无截止日';
      return new Date(timestamp).toISOString().slice(0, 10);
    }

    function storyReadinessChecksForCard(card) {
      const item = card.workItem;
      const queueItem = storyQueueItemForWorkItem(item.id);
      const reasons = new Set(queueItem ? queueItem.blockedReasons : card.warnings.map((warning) => warning.code));
      const activeStatuses = ['ready', 'in_progress', 'in_review', 'verifying', 'gates_passing'];
      const assigneeReady =
        item.assignee.trim() !== '' &&
        card.assigneeMember !== null &&
        card.assigneeMember.status === 'active' &&
        !reasons.has('assignee_over_wip_limit');
      const workflowReady =
        !reasons.has('waiting_approvals') &&
        !reasons.has('waiting_reviews') &&
        !reasons.has('blocked_workflow_steps') &&
        !reasons.has('failed_checks');
      return [
        {
          id: 'status',
          label: 'Ready 状态',
          passed: activeStatuses.includes(item.status),
          detail: statusLabels[item.status] || item.status,
          codes: ['not_ready_status'],
        },
        {
          id: 'analysis',
          label: '需求分析',
          passed: item.analysis.trim() !== '',
          detail: item.analysis.trim() !== '' ? '已填写' : '缺分析',
          codes: ['missing_analysis'],
        },
        {
          id: 'design',
          label: '需求设计',
          passed: item.design.trim() !== '',
          detail: item.design.trim() !== '' ? '已填写' : '缺设计',
          codes: ['missing_design'],
        },
        {
          id: 'acceptance',
          label: '验收标准',
          passed: item.acceptanceCriteria.length > 0,
          detail: String(item.acceptanceCriteria.length) + ' 条',
          codes: ['missing_acceptance'],
        },
        {
          id: 'milestone',
          label: '里程碑',
          passed: item.milestoneId !== null && card.milestone !== null,
          detail: card.milestone ? card.milestone.title : '未分配',
          codes: ['missing_milestone'],
        },
        {
          id: 'assignee',
          label: '负责人容量',
          passed: assigneeReady,
          detail: card.assigneeMember ? card.assigneeMember.displayName : '未分配',
          codes: ['missing_assignee', 'unknown_assignee', 'assignee_unavailable', 'assignee_over_wip_limit'],
        },
        {
          id: 'workflow',
          label: '审批/评审',
          passed: workflowReady,
          detail: queueItem && queueItem.blockedReasons.length > 0
            ? queueItem.blockedReasons.map((code) => warningLabels[code] || code).slice(0, 2).join(' / ')
            : '无等待项',
          codes: ['waiting_approvals', 'waiting_reviews', 'blocked_workflow_steps', 'failed_checks'],
        },
      ].map((check) => ({
        ...check,
        blocking: check.codes.some((code) => reasons.has(code)),
      }));
    }

    function deliverySignalChecksForCard(card) {
      return [
        {
          id: 'coverage',
          label: '验收覆盖',
          passed: card.acceptanceRollup.totalCriteria === 0 || card.acceptanceRollup.complete,
          detail:
            String(card.acceptanceRollup.coveredCriteria) +
            '/' +
            String(card.acceptanceRollup.totalCriteria),
        },
        {
          id: 'children',
          label: '子项完成',
          passed: card.childRollup.unfinished === 0,
          detail: String(card.childRollup.unfinished) + '/' + String(card.childRollup.total),
        },
        {
          id: 'evidence',
          label: '必需证据',
          passed:
            card.evidenceSummary.requiredChecks === 0 ||
            card.evidenceSummary.passingChecks === card.evidenceSummary.requiredChecks,
          detail:
            String(card.evidenceSummary.passingChecks) +
            '/' +
            String(card.evidenceSummary.requiredChecks),
        },
        {
          id: 'governance',
          label: '治理阻塞',
          passed: card.governanceSummary.blockers.length === 0,
          detail: String(card.governanceSummary.blockers.length),
        },
      ];
    }

    function storyRankExplanation(queueItem, card) {
      const dueDate = card ? formatDateLabel(card.workItem.dueDate) : '无截止日';
      return '排序依据：' + (queueItem.priority ? priorityLabels[queueItem.priority] || queueItem.priority : '未定优先级') +
        ' / 截止 ' + dueDate + ' / WorkItem 顺序';
    }

    function backlogWarningFilterMatches(card, filterId) {
      if (!filterId) return true;
      const filter = backlogWarningFilters.find((item) => item.id === filterId);
      if (!filter) return true;
      return card.warnings.some((warning) => filter.codes.includes(warning.code));
    }

    function backlogSearchText(card) {
      const item = card.workItem;
      return [
        item.id,
        item.title,
        item.body,
        item.analysis,
        item.design,
        item.sourceInput,
        item.decompositionReason,
        typeLabels[item.type] || item.type,
        statusLabels[item.status] || item.status,
        backlogLevelForType(item.type).label,
        item.priority ? priorityLabels[item.priority] || item.priority : '',
        card.milestone ? card.milestone.title : '',
        ...card.parentBreadcrumb.map((parent) => parent.title),
        ...card.warnings.map((warning) => warningLabels[warning.code] || warning.code),
      ].filter(Boolean).join(' ').toLowerCase();
    }

    function backlogCardMatches(card) {
      const filters = state.backlogFilters;
      const item = card.workItem;
      if (filters.hideDelivered && closedStatuses.includes(item.status)) return false;
      if (filters.level) {
        const level = backlogLevelById(filters.level);
        if (level && !level.types.includes(item.type)) return false;
      }
      if (filters.type && item.type !== filters.type) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (filters.milestoneId === 'no-milestone' && item.milestoneId !== null) return false;
      if (
        filters.milestoneId &&
        filters.milestoneId !== 'no-milestone' &&
        item.milestoneId !== filters.milestoneId
      ) return false;
      if (!backlogWarningFilterMatches(card, filters.warning)) return false;
      if (filters.query && !backlogSearchText(card).includes(filters.query.toLowerCase())) return false;
      return true;
    }

    function compareBacklogCards(left, right) {
      const leftItem = left.workItem;
      const rightItem = right.workItem;
      const comparePriority = (priorityOrder[leftItem.priority] ?? 4) - (priorityOrder[rightItem.priority] ?? 4);
      const compareSortOrder = leftItem.sortOrder - rightItem.sortOrder;
      const compareTitle = (leftItem.title || '').localeCompare(rightItem.title || '', 'zh-Hans-CN');
      if (state.backlogFilters.sort === 'level') {
        const leftLevel = backlogLevelFilters.findIndex((level) => level.types.includes(leftItem.type));
        const rightLevel = backlogLevelFilters.findIndex((level) => level.types.includes(rightItem.type));
        const compareLevel = (leftLevel === -1 ? 99 : leftLevel) - (rightLevel === -1 ? 99 : rightLevel);
        if (compareLevel !== 0) return compareLevel;
      }
      if (state.backlogFilters.sort === 'priority' && comparePriority !== 0) return comparePriority;
      if (state.backlogFilters.sort === 'status') {
        const compareStatus = (statusOrder[leftItem.status] ?? 99) - (statusOrder[rightItem.status] ?? 99);
        if (compareStatus !== 0) return compareStatus;
      }
      if (state.backlogFilters.sort === 'milestone') {
        const leftMilestone = left.milestone ? left.milestone.title : '未分配';
        const rightMilestone = right.milestone ? right.milestone.title : '未分配';
        const compareMilestone = leftMilestone.localeCompare(rightMilestone, 'zh-Hans-CN');
        if (compareMilestone !== 0) return compareMilestone;
      }
      if (state.backlogFilters.sort === 'type') {
        const compareType = (typeLabels[leftItem.type] || leftItem.type).localeCompare(
          typeLabels[rightItem.type] || rightItem.type,
          'zh-Hans-CN',
        );
        if (compareType !== 0) return compareType;
      }
      if (comparePriority !== 0) return comparePriority;
      if (compareSortOrder !== 0) return compareSortOrder;
      return compareTitle;
    }

    function sortBacklogCards(cards) {
      return [...cards].sort(compareBacklogCards);
    }

    function filteredBacklogCards() {
      return sortBacklogCards((state.cards || []).filter(backlogCardMatches));
    }

    function syncBacklogFiltersFromForm(form) {
      state.backlogFilters = {
        ...state.backlogFilters,
        query: form.elements.query.value.trim(),
        level: form.elements.level.value,
        type: form.elements.type.value,
        status: form.elements.status.value,
        warning: form.elements.warning.value,
        milestoneId: form.elements.milestoneId.value,
        sort: form.elements.sort.value,
        hideDelivered: form.elements.hideDelivered.checked,
      };
      state.activeBacklogViewId = '';
      state.selectedBacklogIds.clear();
    }

    function renderBacklogViewManager() {
      const panel = document.createElement('section');
      panel.className = 'backlog-view-manager';

      const viewTools = document.createElement('div');
      viewTools.className = 'backlog-view-tools';
      const viewTitle = document.createElement('h3');
      viewTitle.textContent = '视图';
      const presets = document.createElement('div');
      presets.className = 'backlog-view-presets';
      for (const view of backlogBuiltInViews) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = state.activeBacklogViewId === view.id ? 'active' : '';
        button.textContent = view.label;
        button.addEventListener('click', () => applyBacklogView(view));
        presets.append(button);
      }

      const saveForm = document.createElement('form');
      saveForm.className = 'backlog-view-save';
      saveForm.innerHTML =
        '<label>视图名称 <input name="label" autocomplete="off" placeholder="例如：P0 Ready Story"></label>' +
        '<label>已保存 <select name="viewId"></select></label>' +
        '<button class="primary" type="submit">保存</button>' +
        '<button name="deleteView" type="button">删除</button>';
      const savedSelect = saveForm.elements.viewId;
      savedSelect.innerHTML = '<option value="">新视图</option>';
      for (const view of state.backlogSavedViews) {
        const option = document.createElement('option');
        option.value = view.id;
        option.textContent = view.label;
        savedSelect.append(option);
      }
      const activeSavedView = state.backlogSavedViews.find((view) => view.id === state.activeBacklogViewId);
      if (activeSavedView) {
        savedSelect.value = activeSavedView.id;
        saveForm.elements.label.value = activeSavedView.label;
      }
      saveForm.elements.deleteView.disabled = !savedSelect.value;
      savedSelect.addEventListener('change', () => {
        const selectedView = state.backlogSavedViews.find((view) => view.id === savedSelect.value);
        saveForm.elements.label.value = selectedView ? selectedView.label : '';
        saveForm.elements.deleteView.disabled = !selectedView;
        if (selectedView) applyBacklogView(selectedView);
      });
      saveForm.addEventListener('submit', (event) => {
        event.preventDefault();
        saveBacklogView(saveForm.elements.label.value, savedSelect.value);
      });
      saveForm.elements.deleteView.addEventListener('click', () => deleteBacklogView(savedSelect.value));
      viewTools.append(viewTitle, presets, saveForm);

      const columnTools = document.createElement('div');
      columnTools.className = 'backlog-column-tools';
      const columnTitle = document.createElement('h3');
      columnTitle.textContent = '列配置';
      const columnChecks = document.createElement('div');
      columnChecks.className = 'backlog-column-checks';
      for (const column of backlogColumnDefs) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = Boolean(state.backlogColumns[column.id]);
        input.addEventListener('change', () => {
          state.backlogColumns = normalizeBacklogColumns({
            ...state.backlogColumns,
            [column.id]: input.checked,
          });
          state.activeBacklogViewId = '';
          persistBacklogColumns();
          renderBoard();
        });
        label.append(input, document.createTextNode(column.label));
        columnChecks.append(label);
      }
      const columnSummary = document.createElement('p');
      columnSummary.className = 'muted';
      columnSummary.textContent = '按角色隐藏不需要的列，减少评审、排期或执行时的噪音。';
      columnTools.append(columnTitle, columnChecks, columnSummary);

      panel.append(viewTools, columnTools);
      return panel;
    }

    function renderBacklogFilterControls() {
      const form = document.createElement('form');
      form.className = 'backlog-filter-grid';
      form.innerHTML =
        '<label>搜索 <input name="query" autocomplete="off" placeholder="标题、来源、验收、告警"></label>' +
        '<label>层级 <select name="level"></select></label>' +
        '<label>类型 <select name="type"></select></label>' +
        '<label>状态 <select name="status"></select></label>' +
        '<label>风险 <select name="warning"></select></label>' +
        '<label>里程碑 <select name="milestoneId"></select></label>' +
        '<label>排序 <select name="sort">' +
        '<option value="rank">队列顺序</option>' +
        '<option value="level">业务层级</option>' +
        '<option value="priority">优先级</option>' +
        '<option value="status">状态</option>' +
        '<option value="milestone">里程碑</option>' +
        '<option value="type">类型</option>' +
        '</select></label>' +
        '<label class="backlog-filter-check"><input name="hideDelivered" type="checkbox">隐藏已关闭</label>';

      const levelSelect = form.elements.level;
      levelSelect.innerHTML = '<option value="">全部层级</option>';
      for (const level of backlogLevelFilters) {
        const option = document.createElement('option');
        option.value = level.id;
        option.textContent = level.label;
        levelSelect.append(option);
      }

      const typeSelect = form.elements.type;
      typeSelect.innerHTML = '<option value="">全部类型</option>';
      for (const type of backlogTypeFilters) {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = typeLabels[type] || type;
        typeSelect.append(option);
      }

      const statusSelect = form.elements.status;
      statusSelect.innerHTML = '<option value="">全部状态</option>';
      for (const status of statuses) {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = statusLabels[status] || status;
        statusSelect.append(option);
      }

      const warningSelect = form.elements.warning;
      warningSelect.innerHTML = '<option value="">全部风险</option>';
      for (const filter of backlogWarningFilters) {
        const option = document.createElement('option');
        option.value = filter.id;
        option.textContent = filter.label;
        warningSelect.append(option);
      }

      const milestoneSelect = form.elements.milestoneId;
      milestoneSelect.innerHTML = '<option value="">全部里程碑</option><option value="no-milestone">未分配</option>';
      for (const milestone of state.milestones) {
        const option = document.createElement('option');
        option.value = milestone.id;
        option.textContent = milestone.title;
        milestoneSelect.append(option);
      }

      form.elements.query.value = state.backlogFilters.query;
      form.elements.level.value = state.backlogFilters.level;
      form.elements.type.value = state.backlogFilters.type;
      form.elements.status.value = state.backlogFilters.status;
      form.elements.warning.value = state.backlogFilters.warning;
      form.elements.milestoneId.value = state.backlogFilters.milestoneId;
      form.elements.sort.value = state.backlogFilters.sort;
      form.elements.hideDelivered.checked = state.backlogFilters.hideDelivered;

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        syncBacklogFiltersFromForm(form);
        renderBoard();
      });
      form.elements.query.addEventListener('change', () => {
        syncBacklogFiltersFromForm(form);
        renderBoard();
      });
      for (const control of form.querySelectorAll('select, input[type="checkbox"]')) {
        control.addEventListener('change', () => {
          syncBacklogFiltersFromForm(form);
          renderBoard();
        });
      }
      return form;
    }

    function renderBacklogBulkBar(visibleCards) {
      const selectedIds = visibleSelectedBacklogIds(visibleCards);
      const bar = document.createElement('div');
      bar.className = 'backlog-bulk-bar';

      const actions = document.createElement('div');
      actions.className = 'backlog-bulk-actions';
      actions.append(badge('已选 ' + String(selectedIds.length)));
      const selectVisible = document.createElement('button');
      selectVisible.type = 'button';
      selectVisible.textContent = '选择可见';
      selectVisible.disabled = visibleCards.length === 0 || selectedIds.length === visibleCards.length;
      selectVisible.addEventListener('click', () => {
        for (const card of visibleCards) state.selectedBacklogIds.add(card.workItem.id);
        renderBoard();
      });
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.textContent = '清除选择';
      clear.disabled = selectedIds.length === 0;
      clear.addEventListener('click', () => {
        state.selectedBacklogIds.clear();
        renderBoard();
      });
      actions.append(selectVisible, clear);

      const form = document.createElement('form');
      form.className = 'backlog-bulk-form';
      form.innerHTML =
        '<label>优先级 <select name="priority">' +
        '<option value="__nochange">不改</option>' +
        '<option value="">清空</option>' +
        '<option value="p0">P0</option>' +
        '<option value="p1">P1</option>' +
        '<option value="p2">P2</option>' +
        '<option value="p3">P3</option>' +
        '</select></label>' +
        '<label>里程碑 <select name="milestoneId"></select></label>' +
        '<label>状态 <select name="status"></select></label>' +
        '<button class="primary" type="submit">应用</button>';

      const milestoneSelect = form.elements.milestoneId;
      milestoneSelect.innerHTML = '<option value="__nochange">不改</option><option value="__clear">清空</option>';
      for (const milestone of state.milestones) {
        const option = document.createElement('option');
        option.value = milestone.id;
        option.textContent = milestone.title;
        milestoneSelect.append(option);
      }

      const statusSelect = form.elements.status;
      statusSelect.innerHTML = '<option value="__nochange">不改</option>';
      for (const status of statuses) {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = statusLabels[status] || status;
        statusSelect.append(option);
      }

      for (const control of form.querySelectorAll('select, button')) {
        control.disabled = selectedIds.length === 0;
      }
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        void applyBacklogBulkUpdate(form, visibleCards);
      });

      bar.append(actions, form);
      return bar;
    }

    async function applyBacklogBulkUpdate(form, visibleCards) {
      const selectedIds = visibleSelectedBacklogIds(visibleCards);
      if (selectedIds.length === 0) {
        setMessage('请先选择要批量更新的 Backlog 项', true);
        return;
      }

      const priority = form.elements.priority.value;
      const milestoneId = form.elements.milestoneId.value;
      const status = form.elements.status.value;
      const hasDetailPatch = priority !== '__nochange' || milestoneId !== '__nochange';
      const hasStatusPatch = status !== '__nochange';
      if (!hasDetailPatch && !hasStatusPatch) {
        setMessage('请选择至少一个批量修改字段', true);
        return;
      }

      let updated = 0;
      const failures = [];
      for (const id of selectedIds) {
        try {
          const patch = {};
          if (priority !== '__nochange') patch.priority = priority || null;
          if (milestoneId !== '__nochange') patch.milestoneId = milestoneId === '__clear' ? null : milestoneId;
          if (Object.keys(patch).length > 0) {
            await api('/api/v1/work-items/' + encodeURIComponent(id) + '/board-detail', {
              method: 'PATCH',
              body: JSON.stringify(patch),
            });
          }
          const card = (state.cards || []).find((candidate) => candidate.workItem.id === id);
          if (status !== '__nochange' && (!card || card.workItem.status !== status)) {
            await api('/api/work-items/' + encodeURIComponent(id) + '/transition', {
              method: 'POST',
              body: JSON.stringify({ status }),
            });
          }
          updated += 1;
        } catch (error) {
          failures.push(id + ': ' + error.message);
        }
      }

      state.selectedBacklogIds.clear();
      await loadBoard();
      if (failures.length > 0) {
        setMessage(
          '批量更新完成 ' + String(updated) + ' 项，失败 ' + String(failures.length) + ' 项：' + failures.slice(0, 2).join('；'),
          true,
        );
      } else {
        setMessage('批量更新完成 ' + String(updated) + ' 项');
      }
    }

    async function queueStoryDelivery(queueItem) {
      if (!queueItem.ready) {
        setMessage('Story 尚未通过 Ready 检查，不能排入交付', true);
        return;
      }
      if (queueItem.active) {
        setMessage('Story 已经处于活动工作流中', true);
        return;
      }
      const card = (state.cards || []).find((candidate) => candidate.workItem.id === queueItem.workItemId);
      try {
        await api('/api/v1/work-items/' + encodeURIComponent(queueItem.workItemId) + '/workflow', {
          method: 'PATCH',
          body: JSON.stringify({
            stage: card ? card.workItem.status : queueItem.status,
            runStatus: 'queued',
            activeOwner: card
              ? card.assigneeMember?.displayName || card.workItem.assignee || null
              : null,
            nextAction: '启动端到端 Story 交付',
            schedulerReason:
              'Backlog queue rank #' +
              String(queueItem.rank) +
              ' passed Ready checks and was queued for team delivery.',
            downstreamImpact: '后续需要完成实现、代码评审、CI、验证证据和 Definition of Done gates。',
          }),
        });
        await loadBoard();
        setMessage('已排入交付队列：#' + String(queueItem.rank) + ' ' + queueItem.title);
      } catch (error) {
        setMessage(error.message, true);
      }
    }

    function renderBacklogRiskGrid(cards) {
      const grid = document.createElement('div');
      grid.className = 'backlog-risk-grid';
      const activeCards = cards.filter((card) => !closedStatuses.includes(card.workItem.status));
      const summaries = {
        coverage: '父需求验收未闭合',
        hierarchy: '父子链路需要修复',
        duplicate: '多个子项覆盖同一验收',
        ready: '进入 Ready 前仍有缺口',
      };
      for (const filter of backlogWarningFilters) {
        const count = activeCards.filter((card) => backlogWarningFilterMatches(card, filter.id)).length;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'backlog-risk' + (state.backlogFilters.warning === filter.id ? ' active' : '');
        button.disabled = count === 0 && state.backlogFilters.warning !== filter.id;
        const number = document.createElement('strong');
        number.textContent = String(count);
        const label = document.createElement('span');
        label.textContent = filter.label + ' · ' + summaries[filter.id];
        button.append(number, label);
        button.addEventListener('click', () => {
          state.backlogFilters.warning = state.backlogFilters.warning === filter.id ? '' : filter.id;
          state.activeBacklogViewId = '';
          state.selectedBacklogIds.clear();
          renderBoard();
        });
        grid.append(button);
      }
      return grid;
    }

    function renderBacklogLevelGrid(cards, visibleCards) {
      const grid = document.createElement('div');
      grid.className = 'backlog-level-grid';
      for (const level of backlogLevelFilters) {
        const allLevelCards = cards.filter((card) => level.types.includes(card.workItem.type));
        const visibleLevelCards = visibleCards.filter((card) => level.types.includes(card.workItem.type));
        const riskCards = allLevelCards.filter((card) => !closedStatuses.includes(card.workItem.status) && cardHasBacklogRisk(card));
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'backlog-level' + (state.backlogFilters.level === level.id ? ' active' : '');
        button.setAttribute('aria-pressed', state.backlogFilters.level === level.id ? 'true' : 'false');
        const title = document.createElement('strong');
        title.textContent = level.label;
        const description = document.createElement('span');
        description.textContent = level.description;
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.append(
          badge('显示 ' + String(visibleLevelCards.length) + '/' + String(allLevelCards.length)),
          badge('负责人 ' + level.owner),
          badge('风险 ' + String(riskCards.length), riskCards.length > 0 ? 'warning' : 'ready'),
        );
        if (visibleLevelCards.some(isReadyStory)) {
          meta.append(badge('Ready ' + String(visibleLevelCards.filter(isReadyStory).length), 'ready'));
        }
        button.append(title, description, meta);
        button.addEventListener('click', () => {
          const nextLevel = state.backlogFilters.level === level.id ? '' : level.id;
          state.backlogFilters.level = nextLevel;
          if (nextLevel && state.backlogFilters.type && !level.types.includes(state.backlogFilters.type)) {
            state.backlogFilters.type = '';
          }
          state.activeBacklogViewId = '';
          state.selectedBacklogIds.clear();
          renderBoard();
        });
        grid.append(button);
      }
      return grid;
    }

    function renderBacklogQueueStrip() {
      const strip = document.createElement('div');
      strip.className = 'backlog-queue-strip';
      const queue = state.mainBoard ? state.mainBoard.storyQueue : null;
      const items = queue
        ? queue.items.filter((item) => {
            const card = (state.cards || []).find((candidate) => candidate.workItem.id === item.workItemId);
            return card ? backlogCardMatches(card) : true;
          }).slice(0, 6)
        : [];
      if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '暂无匹配的 Story 优先级队列。';
        strip.append(empty);
        return strip;
      }
      for (const item of items) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'backlog-queue-item' + (item.workItemId === state.selectedId ? ' selected' : '');
        const title = document.createElement('strong');
        title.textContent = '#' + String(item.rank) + ' ' + item.title;
        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.append(
          priorityBadge(item.priority),
          badge(item.ready ? 'Ready' : 'Skipped', item.ready ? 'ready' : 'warning'),
          badge(workflowRunStatusLabels[item.workflowSummary.runStatus] || item.workflowSummary.runStatus, 'workflow'),
        );
        const reason = document.createElement('span');
        reason.className = 'muted';
        reason.textContent = item.schedulerReason;
        button.append(title, meta, reason);
        button.addEventListener('click', () => selectItem(item.workItemId));
        strip.append(button);
      }
      return strip;
    }

    function renderBacklogPlanningPanels(visibleCards) {
      const grid = document.createElement('section');
      grid.className = 'backlog-planning-grid';
      grid.append(
        renderBacklogPortfolioPanel(),
        renderBacklogMilestonePanel(),
        renderBacklogRiskPanel(visibleCards),
      );
      return grid;
    }

    function renderBacklogPortfolioPanel() {
      const panel = document.createElement('section');
      panel.className = 'backlog-planning-panel';
      const title = document.createElement('h3');
      title.textContent = '组合需求';
      const description = document.createElement('p');
      description.className = 'muted';
      const portfolioCards = sortBacklogCards((state.cards || []).filter((card) => ['epic', 'feature'].includes(card.workItem.type)));
      const orphanProductItems = (state.cards || []).filter((card) => isProductBacklogItem(card) && !card.workItem.parentId);
      description.textContent =
        'Epic / Feature 承接业务目标，产品项未挂父级 ' + String(orphanProductItems.length) + ' 个。';
      const list = document.createElement('div');
      list.className = 'backlog-panel-list';
      if (portfolioCards.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '暂无组合需求。';
        list.append(empty);
      }
      for (const card of portfolioCards.slice(0, 5)) {
        const item = card.workItem;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'backlog-panel-item' + (state.selectedId === item.id ? ' selected' : '');
        const name = document.createElement('strong');
        name.textContent = item.title || '(无标题)';
        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.append(
          badge(typeLabels[item.type] || item.type, 'type-' + item.type),
          badge('子项 ' + String(card.childRollup.total)),
          badge('风险 ' + String(card.warnings.length), card.warnings.length > 0 ? 'warning' : 'ready'),
        );
        const summary = document.createElement('span');
        summary.className = 'muted';
        summary.textContent = textSnippet(item.body || item.analysis || item.design, '未填写目标说明', 72);
        button.append(name, meta, summary);
        button.addEventListener('click', () => selectItem(item.id));
        list.append(button);
      }
      panel.append(title, description, list);
      return panel;
    }

    function renderBacklogMilestonePanel() {
      const panel = document.createElement('section');
      panel.className = 'backlog-planning-panel';
      const title = document.createElement('h3');
      title.textContent = '里程碑范围';
      const description = document.createElement('p');
      description.className = 'muted';
      const unassigned = (state.cards || []).filter((card) => !closedStatuses.includes(card.workItem.status) && !card.workItem.milestoneId);
      description.textContent = '按里程碑收敛范围，未排里程碑 ' + String(unassigned.length) + ' 个。';
      const list = document.createElement('div');
      list.className = 'backlog-panel-list';

      const noMilestone = document.createElement('button');
      noMilestone.type = 'button';
      noMilestone.className = 'backlog-panel-item' + (state.backlogFilters.milestoneId === 'no-milestone' ? ' active' : '');
      noMilestone.append(
        Object.assign(document.createElement('strong'), { textContent: '未排里程碑' }),
        badge('打开 ' + String(unassigned.length), unassigned.length > 0 ? 'warning' : 'ready'),
      );
      noMilestone.addEventListener('click', () => {
        state.backlogFilters.milestoneId = state.backlogFilters.milestoneId === 'no-milestone' ? '' : 'no-milestone';
        state.activeBacklogViewId = '';
        state.selectedBacklogIds.clear();
        renderBoard();
      });
      list.append(noMilestone);

      for (const milestone of state.milestones) {
        const summary = state.mainBoard && state.mainBoard.milestoneSummaries
          ? state.mainBoard.milestoneSummaries.find((item) => item.milestone.id === milestone.id)
          : null;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'backlog-panel-item' + (state.backlogFilters.milestoneId === milestone.id ? ' active' : '');
        const name = document.createElement('strong');
        name.textContent = milestone.title;
        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.append(
          badge(milestoneStatusLabels[milestone.status] || milestone.status, 'workflow'),
          badge('工作项 ' + String(summary ? summary.totalWorkItems : 0)),
          badge(String(summary ? summary.percentDelivered : 0) + '% 已交付', summary && summary.percentDelivered === 100 ? 'ready' : ''),
        );
        if (summary && summary.blockedWorkItems > 0) meta.append(badge('阻塞 ' + String(summary.blockedWorkItems), 'blocking'));
        const goal = document.createElement('span');
        goal.className = 'muted';
        goal.textContent = textSnippet(milestone.goal || milestone.description, '未填写目标', 72);
        button.append(name, meta, goal);
        button.addEventListener('click', () => {
          state.backlogFilters.milestoneId = state.backlogFilters.milestoneId === milestone.id ? '' : milestone.id;
          state.activeBacklogViewId = '';
          state.selectedBacklogIds.clear();
          renderBoard();
        });
        list.append(button);
      }
      panel.append(title, description, list);
      return panel;
    }

    function renderBacklogRiskPanel(visibleCards) {
      const panel = document.createElement('section');
      panel.className = 'backlog-planning-panel';
      const title = document.createElement('h3');
      title.textContent = '风险入口';
      const description = document.createElement('p');
      description.className = 'muted';
      description.textContent = '用风险快速定位验收、层级、重复覆盖和 Ready 阻塞。';
      const list = document.createElement('div');
      list.className = 'backlog-panel-list';
      for (const filter of backlogWarningFilters) {
        const count = visibleCards.filter((card) => backlogWarningFilterMatches(card, filter.id)).length;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'backlog-panel-item' + (state.backlogFilters.warning === filter.id ? ' active' : '');
        button.disabled = count === 0 && state.backlogFilters.warning !== filter.id;
        const name = document.createElement('strong');
        name.textContent = filter.label;
        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.append(badge('可见 ' + String(count), count > 0 ? 'warning' : 'ready'));
        const codes = document.createElement('span');
        codes.className = 'muted';
        codes.textContent = filter.codes.map((code) => warningLabels[code] || code).slice(0, 3).join(' / ');
        button.append(name, meta, codes);
        button.addEventListener('click', () => {
          state.backlogFilters.warning = state.backlogFilters.warning === filter.id ? '' : filter.id;
          state.activeBacklogViewId = '';
          state.selectedBacklogIds.clear();
          renderBoard();
        });
        list.append(button);
      }
      panel.append(title, description, list);
      return panel;
    }

    function renderBacklogDecisionPanels(visibleCards) {
      const grid = document.createElement('section');
      grid.className = 'backlog-decision-grid';
      grid.append(renderBacklogReadinessPanel(visibleCards), renderBacklogStoryDeliveryPanel());
      return grid;
    }

    function renderBacklogReadinessPanel(visibleCards) {
      const panel = document.createElement('section');
      panel.className = 'backlog-decision-panel';
      const title = document.createElement('h3');
      title.textContent = 'Story Ready / Done 信号';
      const storyCards = visibleCards.filter((card) => card.workItem.type === 'story');
      const readyCount = storyCards.filter((card) =>
        storyReadinessChecksForCard(card).every((check) => check.passed),
      ).length;
      const doneReadyCount = storyCards.filter((card) =>
        deliverySignalChecksForCard(card).every((check) => check.passed),
      ).length;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.append(
        badge('Story ' + String(storyCards.length)),
        badge('DoR ' + String(readyCount) + '/' + String(storyCards.length), readyCount === storyCards.length ? 'ready' : 'warning'),
        badge('DoD 信号 ' + String(doneReadyCount) + '/' + String(storyCards.length), doneReadyCount === storyCards.length ? 'ready' : 'warning'),
      );

      const list = document.createElement('div');
      list.className = 'backlog-signal-list';
      if (storyCards.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '当前筛选结果没有 Story。';
        list.append(empty);
      } else {
        const checkIds = ['status', 'analysis', 'design', 'acceptance', 'milestone', 'assignee', 'workflow'];
        for (const checkId of checkIds) {
          const samples = storyCards.map((card) => storyReadinessChecksForCard(card).find((check) => check.id === checkId));
          const first = samples.find(Boolean);
          if (!first) continue;
          const passed = samples.filter((check) => check && check.passed).length;
          const blocked = samples.filter((check) => check && check.blocking).length;
          const row = document.createElement('div');
          row.className = 'backlog-signal-row';
          const name = document.createElement('strong');
          name.textContent = first.label;
          const rowMeta = document.createElement('div');
          rowMeta.className = 'meta';
          rowMeta.append(
            badge(String(passed) + '/' + String(storyCards.length), passed === storyCards.length ? 'ready' : 'warning'),
          );
          if (blocked > 0) rowMeta.append(badge('阻塞 ' + String(blocked), 'blocking'));
          row.append(name, rowMeta);
          list.append(row);
        }
      }
      panel.append(title, meta, list);
      return panel;
    }

    function renderBacklogStoryDeliveryPanel() {
      const panel = document.createElement('section');
      panel.className = 'backlog-decision-panel';
      const title = document.createElement('h3');
      title.textContent = 'Story 交付队列';
      const queue = state.mainBoard ? state.mainBoard.storyQueue : null;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.append(
        badge('Priority'),
        badge('Due date'),
        badge('WorkItem 顺序'),
      );
      if (queue) {
        meta.append(
          badge('Ready ' + String(queue.readyStoryIds.length), 'ready'),
          badge('Skipped ' + String(queue.skippedStoryIds.length), queue.skippedStoryIds.length > 0 ? 'warning' : ''),
        );
      }
      const list = document.createElement('div');
      list.className = 'backlog-delivery-list';
      const items = queue ? queue.items.slice(0, 5) : [];
      if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '当前项目暂无 Story 队列。';
        list.append(empty);
      } else {
        for (const item of items) list.append(renderBacklogStoryDeliveryRow(item));
      }
      panel.append(title, meta, list);
      return panel;
    }

    function renderBacklogStoryDeliveryRow(queueItem) {
      const card = (state.cards || []).find((candidate) => candidate.workItem.id === queueItem.workItemId) || null;
      const row = document.createElement('article');
      row.className = 'backlog-delivery-row';

      const main = document.createElement('div');
      main.className = 'backlog-delivery-main';
      const title = document.createElement('strong');
      title.textContent = '#' + String(queueItem.rank) + ' ' + queueItem.title;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.append(
        badge(queueItem.ready ? 'Ready' : 'Skipped', queueItem.ready ? 'ready' : 'warning'),
        priorityBadge(queueItem.priority),
        badge(statusLabels[queueItem.status] || queueItem.status, 'workflow'),
      );
      if (queueItem.active) {
        meta.append(badge(workflowRunStatusLabels[queueItem.workflowSummary.runStatus] || queueItem.workflowSummary.runStatus, 'ready'));
      }
      const rank = document.createElement('p');
      rank.textContent = storyRankExplanation(queueItem, card);
      const reason = document.createElement('p');
      reason.textContent = queueItem.schedulerReason;
      if (queueItem.blockedReasons.length > 0) {
        const blockers = document.createElement('div');
        blockers.className = 'meta';
        for (const code of queueItem.blockedReasons.slice(0, 4)) {
          blockers.append(badge(warningLabels[code] || code, 'warning'));
        }
        main.append(title, meta, rank, reason, blockers);
      } else {
        main.append(title, meta, rank, reason);
      }

      const actions = document.createElement('div');
      actions.className = 'backlog-delivery-actions';
      const open = document.createElement('button');
      open.type = 'button';
      open.textContent = '打开';
      open.addEventListener('click', () => selectItem(queueItem.workItemId));
      const start = document.createElement('button');
      start.type = 'button';
      start.className = queueItem.ready && !queueItem.active ? 'primary' : '';
      start.textContent = queueItem.active ? '已在运行' : queueItem.ready ? '排入交付' : '未就绪';
      start.disabled = !queueItem.ready || queueItem.active;
      start.addEventListener('click', () => {
        void queueStoryDelivery(queueItem);
      });
      actions.append(open, start);
      row.append(main, actions);
      return row;
    }

    function renderBacklogList(visibleCards) {
      const panel = document.createElement('section');
      panel.className = 'backlog-list-panel';
      const header = document.createElement('div');
      header.className = 'backlog-list-head';
      const title = document.createElement('h3');
      title.textContent = 'Backlog 列表';
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.append(
        badge('可见 ' + String(visibleCards.length)),
        badge('产品项 ' + String(visibleCards.filter(isProductBacklogItem).length)),
        badge('Ready ' + String(visibleCards.filter(isReadyStory).length), 'ready'),
        badge('风险 ' + String(visibleCards.filter(cardHasBacklogRisk).length), visibleCards.some(cardHasBacklogRisk) ? 'warning' : 'ready'),
      );
      header.append(title, meta);
      panel.append(header);
      panel.append(renderBacklogBulkBar(visibleCards));

      if (visibleCards.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '当前筛选条件下没有工作项。';
        panel.append(empty);
        return panel;
      }

      const tableHead = document.createElement('div');
      tableHead.className = 'backlog-table-head';
      tableHead.style.setProperty('--backlog-grid-template', backlogGridTemplate());
      for (const label of ['工作项', ...visibleBacklogColumnDefs().map((column) => column.label)]) {
        const cell = document.createElement('span');
        cell.textContent = label;
        tableHead.append(cell);
      }
      panel.append(tableHead);

      const groups = backlogLevelFilters
        .map((level) => ({
          level,
          cards: sortBacklogCards(visibleCards.filter((card) => level.types.includes(card.workItem.type))),
        }))
        .filter((group) => group.cards.length > 0);
      const standardTypes = new Set(backlogLevelFilters.flatMap((level) => level.types));
      const otherCards = sortBacklogCards(visibleCards.filter((card) => !standardTypes.has(card.workItem.type)));
      if (otherCards.length > 0) {
        groups.push({
          level: {
            id: 'other',
            label: '其他工作',
            shortLabel: 'Other',
            description: '尚未归入标准 Backlog 层级的工作。',
            owner: '敏捷团队',
            types: [],
          },
          cards: otherCards,
        });
      }

      for (const group of groups) {
        const heading = document.createElement('div');
        heading.className = 'backlog-group-heading';
        const copy = document.createElement('div');
        const groupTitle = document.createElement('strong');
        groupTitle.textContent = group.level.label;
        const groupDescription = document.createElement('p');
        groupDescription.className = 'muted';
        groupDescription.textContent = group.level.description;
        copy.append(groupTitle, groupDescription);
        const groupMeta = document.createElement('div');
        groupMeta.className = 'meta';
        groupMeta.append(
          badge(String(group.cards.length) + ' 项'),
          badge('风险 ' + String(group.cards.filter(cardHasBacklogRisk).length), group.cards.some(cardHasBacklogRisk) ? 'warning' : 'ready'),
        );
        heading.append(copy, groupMeta);
        panel.append(heading);
        for (const card of group.cards) panel.append(renderBacklogRow(card));
      }
      return panel;
    }

    function appendCellLabel(cell, label) {
      const span = document.createElement('span');
      span.className = 'backlog-cell-label';
      span.textContent = label;
      cell.append(span);
    }

    function renderBacklogRow(card) {
      const item = card.workItem;
      const level = backlogLevelForType(item.type);
      const queueItem = storyQueueItemForWorkItem(item.id);
      const row = document.createElement('article');
      row.className =
        'backlog-row' +
        (item.id === state.selectedId ? ' selected' : '') +
        (state.selectedBacklogIds.has(item.id) ? ' batch-selected' : '');
      row.dataset.itemId = item.id;
      row.style.setProperty('--backlog-grid-template', backlogGridTemplate());

      const titleCell = document.createElement('div');
      titleCell.className = 'backlog-row-main';
      const checkbox = document.createElement('input');
      checkbox.className = 'backlog-row-check';
      checkbox.type = 'checkbox';
      checkbox.checked = state.selectedBacklogIds.has(item.id);
      checkbox.setAttribute('aria-label', '选择 ' + (item.title || item.id));
      checkbox.addEventListener('click', (event) => event.stopPropagation());
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          state.selectedBacklogIds.add(item.id);
        } else {
          state.selectedBacklogIds.delete(item.id);
        }
        renderBoard();
      });
      const titleContent = document.createElement('div');
      titleContent.className = 'backlog-row-title';
      const code = document.createElement('span');
      code.className = 'card-code';
      code.textContent = item.id;
      const titleButton = document.createElement('button');
      titleButton.type = 'button';
      titleButton.className = 'backlog-title-button';
      const title = document.createElement('strong');
      title.textContent = item.title || '(无标题)';
      titleButton.append(title);
      titleButton.addEventListener('click', () => selectItem(item.id));
      const itemMeta = document.createElement('div');
      itemMeta.className = 'meta';
      itemMeta.append(
        badge(typeLabels[item.type] || item.type, 'type-' + item.type),
        priorityBadge(item.priority),
        badge(level.shortLabel, 'info'),
      );
      const parentPath = document.createElement('p');
      parentPath.textContent = card.parentBreadcrumb.length > 0
        ? '父级 ' + card.parentBreadcrumb.map((parent) => parent.title).join(' / ')
        : 'Root';
      const body = document.createElement('p');
      body.textContent = textSnippet(item.body || item.analysis || item.design);
      titleContent.append(code, titleButton, itemMeta, parentPath, body);
      titleCell.append(checkbox, titleContent);

      const planCell = document.createElement('div');
      planCell.className = 'backlog-cell';
      appendCellLabel(planCell, '计划');
      const planMeta = document.createElement('div');
      planMeta.className = 'meta';
      planMeta.append(
        badge(statusLabels[item.status] || item.status, closedStatuses.includes(item.status) ? 'info' : 'workflow'),
        badge(card.milestone ? card.milestone.title : '未排里程碑', card.milestone ? 'ready' : 'warning'),
      );
      const owner = document.createElement('p');
      owner.textContent = card.assigneeMember
        ? '负责人 ' + card.assigneeMember.displayName
        : item.assignee
          ? '负责人 ' + item.assignee
          : '未分配负责人';
      planCell.append(planMeta, owner);

      const definitionCell = document.createElement('div');
      definitionCell.className = 'backlog-cell';
      appendCellLabel(definitionCell, '定义状态');
      const definitionMeta = document.createElement('div');
      definitionMeta.className = 'meta';
      definitionMeta.append(
        badge('分析 ' + (item.analysis ? '已填' : '待补'), item.analysis ? 'ready' : 'warning'),
        badge('设计 ' + (item.design ? '已填' : '待补'), item.design ? 'ready' : 'warning'),
      );
      if (card.acceptanceRollup.totalCriteria > 0) {
        definitionMeta.append(
          badge(
            '验收 ' + String(card.acceptanceRollup.coveredCriteria) + '/' + String(card.acceptanceRollup.totalCriteria),
            card.acceptanceRollup.complete ? 'ready' : 'blocking',
          ),
        );
      } else {
        definitionMeta.append(badge('验收 待补', 'warning'));
      }
      const source = document.createElement('p');
      source.textContent = item.sourceInput ? '来源已记录' : '来源待补充';
      definitionCell.append(definitionMeta, source);

      const traceCell = document.createElement('div');
      traceCell.className = 'backlog-cell';
      appendCellLabel(traceCell, '追踪');
      const traceMeta = document.createElement('div');
      traceMeta.className = 'meta';
      traceMeta.append(
        badge('子项 ' + String(card.childRollup.unfinished) + '/' + String(card.childRollup.total), card.childRollup.unfinished > 0 ? 'warning' : 'ready'),
        badge('证据 ' + String(card.evidenceSummary.evidenceCount), card.evidenceSummary.evidenceCount > 0 ? 'ready' : ''),
      );
      if (card.warnings.length > 0) {
        traceMeta.append(badge('告警 ' + String(card.warnings.length), card.warnings.some((warning) => warning.severity === 'blocking') ? 'blocking' : 'warning'));
      } else {
        traceMeta.append(badge('无告警', 'ready'));
      }
      const decomposition = document.createElement('p');
      decomposition.textContent = item.decompositionReason ? '拆分原因已记录' : '拆分原因待补充';
      traceCell.append(traceMeta, decomposition);

      const nextCell = document.createElement('div');
      nextCell.className = 'backlog-cell';
      appendCellLabel(nextCell, '下一步');
      const nextMeta = document.createElement('div');
      nextMeta.className = 'meta';
      nextMeta.append(
        badge(card.workflowSummary.nextAction, 'workflow'),
        badge(workflowRunStatusLabels[card.workflowSummary.runStatus] || card.workflowSummary.runStatus, 'info'),
      );
      if (queueItem) {
        nextMeta.append(
          badge('#' + String(queueItem.rank), 'workflow'),
          badge(queueItem.ready ? 'Ready' : 'Skipped', queueItem.ready ? 'ready' : 'warning'),
        );
      }
      if (card.workflowSummary.waitingApprovals.length > 0) {
        nextMeta.append(badge('审批 ' + String(card.workflowSummary.waitingApprovals.length), 'warning'));
      }
      if (card.workflowSummary.waitingReviews.length > 0) {
        nextMeta.append(badge('评审 ' + String(card.workflowSummary.waitingReviews.length), 'warning'));
      }
      if (card.evidenceSummary.ciRunCount > 0) {
        nextMeta.append(badge('CI ' + String(card.evidenceSummary.ciRunCount), 'ready'));
      }
      const reason = document.createElement('p');
      reason.textContent = textSnippet(
        queueItem
          ? queueItem.schedulerReason
          : card.workflowSummary.schedulerReason || card.workflowSummary.downstreamImpact || '等待下一步调度',
        '等待下一步调度',
        88,
      );
      nextCell.append(nextMeta, reason);

      row.append(titleCell);
      if (state.backlogColumns.plan) row.append(planCell);
      if (state.backlogColumns.definition) row.append(definitionCell);
      if (state.backlogColumns.trace) row.append(traceCell);
      if (state.backlogColumns.next) row.append(nextCell);
      return row;
    }

    function renderBacklogFlowPanel(visibleCards) {
      const panel = document.createElement('section');
      panel.className = 'backlog-flow-panel';
      const header = document.createElement('div');
      header.className = 'backlog-flow-head';
      const title = document.createElement('h3');
      title.textContent = '执行流摘要';
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.append(
        badge('打开 ' + String(visibleCards.filter((card) => !closedStatuses.includes(card.workItem.status)).length)),
        badge('已关闭 ' + String(visibleCards.filter((card) => closedStatuses.includes(card.workItem.status)).length)),
      );
      if (state.backlogFilters.status) {
        meta.append(badge('状态筛选 ' + (statusLabels[state.backlogFilters.status] || state.backlogFilters.status), 'workflow'));
      }
      header.append(title, meta);
      const list = document.createElement('div');
      list.className = 'backlog-flow-list';
      for (const stage of backlogFlowStages) {
        const stageCards = visibleCards.filter((card) => stage.statuses.includes(card.workItem.status));
        const group = document.createElement('section');
        group.className = 'backlog-flow-group';
        const groupTitle = document.createElement('div');
        groupTitle.className = 'backlog-flow-group-title';
        const copy = document.createElement('div');
        const label = document.createElement('strong');
        label.textContent = stage.label;
        const description = document.createElement('span');
        description.className = 'muted';
        description.textContent = stage.description;
        copy.append(label, description);
        const count = document.createElement('span');
        count.className = 'backlog-flow-count';
        count.textContent = String(stageCards.length);
        groupTitle.append(copy, count);
        group.append(groupTitle);
        for (const status of stage.statuses) {
          const statusCards = visibleCards.filter((card) => card.workItem.status === status);
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'backlog-flow-item' + (state.backlogFilters.status === status ? ' active' : '');
          button.disabled = statusCards.length === 0 && state.backlogFilters.status !== status;
          const name = document.createElement('span');
          name.textContent = statusLabels[status] || status;
          const statusCount = document.createElement('span');
          statusCount.className = 'backlog-flow-count';
          statusCount.textContent = String(statusCards.length);
          button.append(name, statusCount);
          button.addEventListener('click', () => {
            state.backlogFilters.status = state.backlogFilters.status === status ? '' : status;
            state.activeBacklogViewId = '';
            state.selectedBacklogIds.clear();
            renderBoard();
          });
          group.append(button);
        }
        list.append(group);
      }
      panel.append(header, list);
      return panel;
    }

    function renderBacklogWorkbench(visibleCards) {
      const cards = state.cards || [];
      const openCards = cards.filter((card) => !closedStatuses.includes(card.workItem.status));
      const riskCount = openCards.filter((card) =>
        backlogWarningFilters.some((filter) => backlogWarningFilterMatches(card, filter.id)),
      ).length;
      const storyQueue = state.mainBoard ? state.mainBoard.storyQueue : null;
      const panel = document.createElement('section');
      panel.className = 'backlog-workbench';
      const header = document.createElement('div');
      header.className = 'backlog-workbench-header';
      const copy = document.createElement('div');
      copy.className = 'backlog-workbench-title';
      const title = document.createElement('h3');
      title.textContent = 'Backlog 工作台';
      const summary = document.createElement('span');
      summary.textContent = '组合需求、产品 Backlog、执行工作和风险信号';
      copy.append(title, summary);
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.append(
        badge('显示 ' + String(visibleCards.length) + '/' + String(cards.length)),
        badge('打开 ' + String(openCards.length)),
        badge('工作台风险 ' + String(riskCount), riskCount > 0 ? 'warning' : 'ready'),
        badge('Ready Story ' + String(storyQueue ? storyQueue.readyStoryIds.length : 0), 'ready'),
      );
      header.append(copy, meta);
      const tools = document.createElement('details');
      tools.className = 'workbench-tools-drawer';
      const toolsSummary = document.createElement('summary');
      toolsSummary.append(
        document.createTextNode('视图、层级和风险设置'),
        badge('按需展开'),
      );
      const toolsBody = document.createElement('div');
      toolsBody.className = 'workbench-tools-body';
      toolsBody.append(
        renderBacklogViewManager(),
        renderBacklogLevelGrid(cards, visibleCards),
        renderBacklogRiskGrid(cards),
      );
      tools.append(toolsSummary, toolsBody);
      panel.append(
        header,
        renderBacklogFilterControls(),
        tools,
      );
      return panel;
    }

    function renderBacklogStatusBoard(root) {
      const visibleCards = filteredBacklogCards();
      root.className = 'backlog-board';
      root.append(renderBacklogWorkbench(visibleCards));
      const layout = document.createElement('div');
      layout.className = 'backlog-command-layout';
      const primary = document.createElement('section');
      primary.className = 'backlog-primary';
      primary.append(renderBacklogList(visibleCards));
      const insights = document.createElement('aside');
      insights.className = 'backlog-insights';
      insights.append(
        renderBacklogDecisionPanels(visibleCards),
        renderBacklogPlanningPanels(visibleCards),
        renderBacklogQueueStrip(),
        renderBacklogFlowPanel(visibleCards),
      );
      const support = document.createElement('details');
      support.className = 'backlog-support-drawer';
      const supportSummary = document.createElement('summary');
      supportSummary.append(
        document.createTextNode('洞察与交付准备'),
        badge('风险 / 里程碑 / Ready / 流程'),
      );
      support.append(supportSummary, insights);
      layout.append(primary, support);
      root.append(layout);
    }

    function renderBoard() {
      renderWorkspaceChrome();
      const root = $('columns');
      root.className = 'columns';
      root.innerHTML = '';
      if (state.areaId === 'settings' && state.viewId === 'audit-board') {
        renderAuditBoard(root);
        return;
      }
      if (state.areaId === 'settings' && state.viewId === 'business-crud') {
        renderBusinessCrudBoard(root);
        return;
      }
      if (state.areaId === 'settings') {
        renderSettingsBoard(root);
        return;
      }
      if (state.areaId === 'intake') {
        renderIntakeBoard(root);
        return;
      }
      if (state.viewId === 'tree-board') {
        renderTreeBoard(root);
        return;
      }
      if (state.viewId === 'coverage-board') {
        renderCoverageBoard(root);
        return;
      }
      if (state.viewId === 'milestone-board') {
        renderMilestoneBoard(root);
        return;
      }
      if (state.viewId === 'delivery-board') {
        renderDeliveryBoard(root);
        return;
      }
      if (state.viewId === 'team-board') {
        renderTeamBoard(root);
        return;
      }
      if (state.viewId === 'role-board') {
        renderTeamRoleBoard(root);
        return;
      }
      if (state.viewId === 'workflow-board') {
        renderWorkflowBoard(root);
        return;
      }
      if (state.viewId === 'evidence-board') {
        renderEvidenceBoard(root);
        return;
      }
      if (!state.mainBoard || state.mainBoard.columns.length === 0) {
        root.className = 'empty';
        root.textContent = '当前项目暂无工作项。';
        return;
      }
      if (state.areaId === 'requirements' && state.viewId === 'requirement-board') {
        renderBacklogStatusBoard(root);
        return;
      }
      for (const column of state.mainBoard.columns) {
        const section = document.createElement('section');
        section.className = 'column';
        const header = document.createElement('header');
        header.innerHTML = '<span class="column-title"></span><span class="count"></span>';
        header.querySelector('.column-title').textContent = statusLabels[column.title] || column.title;
        header.querySelector('.count').textContent = String(column.cards.length);
        const list = document.createElement('div');
        list.className = 'card-list';
        for (const card of column.cards) list.append(renderCard(card));
        section.append(header, list);
        root.append(section);
      }
    }

    function renderBusinessCrudBoard(root) {
      root.className = 'crud-board';
      if (!state.projectId) {
        root.className = 'empty';
        root.textContent = '请先创建或选择项目后查看业务 CRUD 覆盖。';
        return;
      }
      const stateView = state.businessCrud;
      if (stateView.loading) {
        root.className = 'empty';
        root.textContent = '正在读取业务 CRUD 覆盖。';
        return;
      }
      if (stateView.error) {
        root.className = 'empty';
        root.textContent = stateView.error;
        return;
      }
      const data = stateView.data;
      if (!data) {
        root.className = 'empty';
        root.textContent = '业务 CRUD 覆盖尚未加载。';
        return;
      }

      const workbench = document.createElement('div');
      workbench.className = 'crud-workbench';

      const tablePanel = document.createElement('section');
      tablePanel.className = 'crud-table-panel';
      const tableTitle = document.createElement('h3');
      tableTitle.textContent = '业务对象 CRUD 覆盖';
      const table = document.createElement('div');
      table.className = 'crud-table';
      const head = document.createElement('div');
      head.className = 'crud-table-head';
      head.innerHTML = '<span>业务对象</span><span>生命周期策略</span><span>操作覆盖</span><span>下一步</span>';
      table.append(head);
      for (const entity of data.entities) table.append(renderBusinessCrudRow(entity));
      tablePanel.append(tableTitle, table);

      const gapPanel = document.createElement('section');
      gapPanel.className = 'crud-gap-panel';
      const gapTitle = document.createElement('h3');
      gapTitle.textContent = '待补切片';
      const gapList = document.createElement('div');
      gapList.className = 'crud-gap-list';
      const gapEntities = data.entities.filter((entity) => entity.gaps.length > 0);
      if (gapEntities.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '所有业务对象已经达到当前 CRUD 覆盖目标。';
        gapList.append(empty);
      } else {
        for (const entity of gapEntities) gapList.append(renderBusinessCrudGapRow(entity));
      }
      gapPanel.append(gapTitle, gapList);

      workbench.append(tablePanel, gapPanel);
      root.append(workbench);
    }

    function renderBusinessCrudRow(entity) {
      const row = document.createElement('article');
      row.className = 'crud-row ' + crudEntityTone(entity);

      const main = document.createElement('div');
      main.className = 'crud-entity-main';
      const title = document.createElement('strong');
      title.textContent = entity.name;
      const record = document.createElement('p');
      record.textContent = entity.record;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.append(
        badge(entity.areaId),
        badge(entity.owner),
        badge(crudEntityStatusLabels[entity.implementationStatus] || entity.implementationStatus),
      );
      main.append(title, record, meta);

      const policy = document.createElement('div');
      policy.className = 'crud-policy';
      const policyTitle = document.createElement('strong');
      policyTitle.textContent = entity.deletePolicy.includes('硬删除') ? '非硬删除策略' : '生命周期策略';
      const policyText = document.createElement('p');
      policyText.textContent = entity.deletePolicy;
      policy.append(policyTitle, policyText);

      const operations = document.createElement('div');
      operations.className = 'crud-operations';
      for (const operation of entity.operations) operations.append(renderCrudOperationChip(operation));

      const next = document.createElement('div');
      next.className = 'crud-next';
      const nextTitle = document.createElement('strong');
      nextTitle.textContent = '建议切片';
      const nextText = document.createElement('p');
      nextText.textContent = entity.recommendedNextSlice;
      const gaps = document.createElement('div');
      gaps.className = 'meta';
      for (const gap of entity.gaps.slice(0, 3)) gaps.append(badge(gap, 'warning'));
      next.append(nextTitle, nextText, gaps);

      row.append(main, policy, operations, next);
      return row;
    }

    function renderCrudOperationChip(operation) {
      const chip = document.createElement('div');
      chip.className = 'crud-chip ' + operation.status;
      const title = document.createElement('strong');
      title.textContent = crudOperationLabels[operation.kind] || operation.kind;
      const status = document.createElement('span');
      status.textContent = crudStatusLabels[operation.status] || operation.status;
      const endpoint = document.createElement('span');
      endpoint.textContent = operation.endpoints.length > 0
        ? operation.endpoints.slice(0, 2).join(' / ')
        : operation.label;
      chip.append(title, status, endpoint);
      return chip;
    }

    function renderBusinessCrudGapRow(entity) {
      const row = document.createElement('article');
      row.className = 'crud-gap-row';
      const main = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = entity.name;
      const gaps = document.createElement('div');
      gaps.className = 'meta';
      for (const gap of entity.gaps) gaps.append(badge(gap, 'warning'));
      main.append(title, gaps);
      row.append(main, badge(crudEntityStatusLabels[entity.implementationStatus] || entity.implementationStatus, crudEntityTone(entity)));
      return row;
    }

    function crudEntityTone(entity) {
      switch (entity.implementationStatus) {
        case 'complete':
        case 'usable':
          return 'ready';
        case 'partial':
          return 'warning';
        case 'planned':
          return 'blocking';
        default:
          return 'info';
      }
    }

    function renderSettingsBoard(root) {
      root.className = 'settings-board';
      const workbench = document.createElement('div');
      workbench.className = 'admin-workbench';
      const project = currentProject();
      workbench.append(renderAdminProjectPanel(project), renderAdminAccessPanel());
      root.append(workbench);
    }

    function renderAdminProjectPanel(project) {
      const projectPanel = document.createElement('section');
      projectPanel.className = 'admin-panel';
      projectPanel.append(
        renderAdminPanelHead('项目管理', '维护当前工作区的项目入口、项目说明和基础规模。'),
        renderAdminStatusGrid([
          ['当前项目', project ? project.name : '未选择项目', project ? 'ready' : 'warning'],
          ['项目描述', project && project.description ? project.description : '未填写描述', ''],
          [
            '项目规模',
            String(state.workItems.length) + ' 工作项 · ' +
              String(state.milestones.length) + ' 里程碑 · ' +
              String(state.teamMembers.length) + ' 成员',
            '',
          ],
          ['项目总数', String(state.projects.length) + ' 个项目', ''],
        ]),
        renderAdminProjectForm(),
      );
      return projectPanel;
    }

    function renderAdminProjectForm() {
      const form = document.createElement('form');
      form.className = 'admin-form';
      form.innerHTML =
        '<label>新项目名称 <input name="name" autocomplete="off"></label>' +
        '<label>项目描述 <textarea name="description"></textarea></label>' +
        '<button class="primary" type="submit">新建项目</button>';
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        await createProjectFromValues(
          form.elements.name.value,
          form.elements.description.value,
          () => form.reset(),
        );
      });
      return form;
    }

    function renderAdminAccessPanel() {
      const authPanel = document.createElement('section');
      authPanel.className = 'admin-panel';
      const principal = state.auth.principal
        ? state.auth.principal.displayName + (
          state.auth.principal.kind === 'api-token'
            ? ' · API token'
            : ' · ' + state.auth.principal.username
        )
        : '未登录';
      authPanel.append(
        renderAdminPanelHead('访问管理', '管理登录区域、认证状态、第三方登录入口和外部调用 token。'),
        renderAdminStatusGrid([
          ['认证模式', state.auth.enabled ? 'Web 登录已启用' : '本地访问模式', state.auth.enabled ? 'ready' : ''],
          [
            'Session',
            state.auth.enabled ? (state.auth.authenticated ? '已登录' : '未登录') : '无需登录',
            state.auth.authenticated || !state.auth.enabled ? 'ready' : 'warning',
          ],
          ['当前身份', state.auth.enabled ? principal : '本地匿名访问', state.auth.authenticated ? 'ready' : ''],
          ['登录区域', state.auth.region || 'global', ''],
          ['API token', state.token ? '已配置外部调用 token' : '未配置', state.token ? 'ready' : 'warning'],
        ]),
        renderAdminAuthForm(),
        renderAdminProviderList(),
        renderAdminTokenForm(),
      );
      return authPanel;
    }

    function renderAdminPanelHead(title, description) {
      const head = document.createElement('div');
      head.className = 'admin-panel-head';
      const heading = document.createElement('h3');
      heading.textContent = title;
      const copy = document.createElement('p');
      copy.textContent = description;
      head.append(heading, copy);
      return head;
    }

    function renderAdminStatusGrid(rows) {
      const grid = document.createElement('div');
      grid.className = 'admin-status-grid';
      for (const row of rows) grid.append(renderAdminStatusRow(row[0], row[1], row[2]));
      return grid;
    }

    function renderAdminStatusRow(label, value, tone) {
      const row = document.createElement('div');
      row.className = 'admin-status-row' + (tone ? ' ' + tone : '');
      const labelNode = document.createElement('span');
      labelNode.textContent = label;
      const valueNode = document.createElement('strong');
      valueNode.textContent = value;
      row.append(labelNode, valueNode);
      return row;
    }

    function renderAdminAuthForm() {
      const form = document.createElement('form');
      form.className = 'admin-form';
      const row = document.createElement('div');
      row.className = 'inline';
      const regionLabel = document.createElement('label');
      regionLabel.textContent = '登录区域';
      const region = document.createElement('select');
      region.name = 'region';
      region.innerHTML =
        '<option value="global">Global</option>' +
        '<option value="cn">中国</option>' +
        '<option value="auto">自动</option>';
      region.value = state.auth.region || 'global';
      region.addEventListener('change', async () => {
        try {
          await loadProviders(region.value);
          renderHealth();
          renderBoard();
        } catch (error) {
          setMessage(error.message, true);
        }
      });
      regionLabel.append(region);
      row.append(regionLabel);

      if (state.auth.enabled && !state.auth.authenticated) {
        const userLabel = document.createElement('label');
        userLabel.textContent = '账号';
        const username = document.createElement('input');
        username.name = 'username';
        username.autocomplete = 'username';
        userLabel.append(username);
        const passwordLabel = document.createElement('label');
        passwordLabel.textContent = '密码';
        const password = document.createElement('input');
        password.name = 'password';
        password.type = 'password';
        password.autocomplete = 'current-password';
        passwordLabel.append(password);
        const button = document.createElement('button');
        button.className = 'primary';
        button.type = 'submit';
        button.textContent = '登录';
        row.append(userLabel, passwordLabel, button);
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          void login(form);
        });
      } else {
        form.addEventListener('submit', (event) => event.preventDefault());
        if (state.auth.enabled && state.auth.authenticated) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = '退出登录';
          button.addEventListener('click', () => {
            void logout();
          });
          row.append(button);
        }
      }

      form.append(row);
      return form;
    }

    function renderAdminProviderList() {
      const list = document.createElement('div');
      list.className = 'admin-provider-list';
      if (state.auth.providers.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'admin-empty-note';
        empty.textContent = state.auth.enabled ? '暂无第三方登录提供方。' : '本地访问模式不需要第三方登录。';
        list.append(empty);
        return list;
      }
      for (const provider of state.auth.providers) list.append(renderAuthProviderButton(provider));
      return list;
    }

    function renderAdminTokenForm() {
      const form = document.createElement('form');
      form.className = 'admin-form';
      form.innerHTML =
        '<div class="admin-token-row">' +
          '<label>外部 API token <input name="token" type="password" autocomplete="off" placeholder="API token 或 Bearer token"></label>' +
          '<button type="submit">保存 token</button>' +
        '</div>';
      form.elements.token.value = state.token;
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        saveTokenValue(form.elements.token.value);
      });
      return form;
    }

    function renderAuditBoard(root) {
      root.className = 'audit-board';
      if (!state.projectId) {
        root.className = 'empty';
        root.textContent = '请先创建或选择项目后查看审计事件。';
        return;
      }
      const workbench = document.createElement('div');
      workbench.className = 'audit-workbench';
      workbench.append(renderAuditFilterForm());

      const layout = document.createElement('div');
      layout.className = 'audit-layout';

      const timelinePanel = document.createElement('section');
      timelinePanel.className = 'audit-timeline-panel';
      const timelineTitle = document.createElement('h3');
      timelineTitle.textContent = '项目审计时间线';
      const timelineMeta = document.createElement('div');
      timelineMeta.className = 'meta';
      timelineMeta.append(
        badge('事件 ' + String(state.audit.events.length), state.audit.events.length > 0 ? 'ready' : 'warning'),
        badge('Project ' + state.projectId),
      );
      const timeline = document.createElement('div');
      timeline.className = 'audit-timeline';
      if (state.audit.loading) {
        const loading = document.createElement('div');
        loading.className = 'loading';
        loading.textContent = '正在读取审计事件。';
        timeline.append(loading);
      } else if (state.audit.error) {
        const error = document.createElement('div');
        error.className = 'empty';
        error.textContent = state.audit.error;
        timeline.append(error);
      } else if (state.audit.events.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '当前筛选条件下没有审计事件。';
        timeline.append(empty);
      } else {
        for (const event of state.audit.events) timeline.append(renderAuditEventRow(event));
      }
      timelinePanel.append(timelineTitle, timelineMeta, timeline);

      const summaryPanel = document.createElement('section');
      summaryPanel.className = 'audit-summary-panel';
      const summaryTitle = document.createElement('h3');
      summaryTitle.textContent = '审计摘要';
      const summaryGrid = document.createElement('div');
      summaryGrid.className = 'audit-summary-grid';
      const events = state.audit.events || [];
      summaryGrid.append(
        metric(String(topAuditEntries(events, 'action').length), '动作种类'),
        metric(String(topAuditEntries(events, 'targetType').length), '对象种类'),
        metric(String(topAuditEntries(events, 'actorId').length), '操作者'),
        metric(String(events.filter((event) => event.changedFields.length > 0).length), '字段变更'),
      );
      summaryPanel.append(
        summaryTitle,
        summaryGrid,
        renderAuditSummaryList('高频动作', topAuditEntries(events, 'action'), auditActionLabels),
        renderAuditSummaryList('对象分布', topAuditEntries(events, 'targetType'), auditTargetTypeLabels),
        renderAuditSummaryList('操作者', topAuditEntries(events, 'actorId')),
      );

      layout.append(timelinePanel, summaryPanel);
      workbench.append(layout);
      root.append(workbench);
    }

    function renderAuditFilterForm() {
      const filters = state.audit.filters;
      const form = document.createElement('form');
      form.className = 'audit-filter-bar';
      form.innerHTML =
        '<label>操作者 <input name="actorId" autocomplete="off"></label>' +
        '<label>动作 <select name="auditAction"></select></label>' +
        '<label>对象类型 <select name="auditTargetType"></select></label>' +
        '<label>对象 ID <input name="targetId" autocomplete="off"></label>' +
        '<label>开始日期 <input name="from" type="date"></label>' +
        '<label>结束日期 <input name="to" type="date"></label>' +
        '<label>数量 <select name="limit">' +
        '<option value="25">25</option>' +
        '<option value="50">50</option>' +
        '<option value="100">100</option>' +
        '<option value="200">200</option>' +
        '</select></label>' +
        '<button class="primary" type="submit">应用筛选</button>' +
        '<button name="resetFilters" type="button">清空</button>';
      form.elements.actorId.value = filters.actorId || '';
      form.elements.targetId.value = filters.targetId || '';
      form.elements.from.value = filters.from || '';
      form.elements.to.value = filters.to || '';
      form.elements.limit.value = filters.limit || '50';
      fillAuditSelect(form.elements.auditAction, auditActionOptions(), auditActionLabels, '全部动作', filters.action);
      fillAuditSelect(
        form.elements.auditTargetType,
        auditTargetTypeOptions(),
        auditTargetTypeLabels,
        '全部对象',
        filters.targetType,
      );
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        void applyAuditFilters(event.currentTarget);
      });
      form.elements.resetFilters.addEventListener('click', () => {
        void clearAuditFilters();
      });
      return form;
    }

    function fillAuditSelect(select, values, labels, emptyLabel, selectedValue) {
      select.innerHTML = '';
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = emptyLabel;
      select.append(empty);
      for (const value of values) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = labels[value] ? labels[value] + ' · ' + value : value;
        select.append(option);
      }
      if (selectedValue && !values.includes(selectedValue)) {
        const option = document.createElement('option');
        option.value = selectedValue;
        option.textContent = labels[selectedValue] ? labels[selectedValue] + ' · ' + selectedValue : selectedValue;
        select.append(option);
      }
      select.value = selectedValue || '';
    }

    function auditActionOptions() {
      return auditDistinctValues('action', Object.keys(auditActionLabels));
    }

    function auditTargetTypeOptions() {
      return auditDistinctValues('targetType', Object.keys(auditTargetTypeLabels));
    }

    function auditDistinctValues(key, seedValues = []) {
      const values = new Set(seedValues);
      for (const event of state.audit.events || []) {
        if (event[key]) values.add(event[key]);
      }
      return [...values].sort((left, right) => left.localeCompare(right));
    }

    function renderAuditSummaryList(titleText, entries, labels = {}) {
      const section = document.createElement('section');
      section.className = 'audit-target-list';
      const title = document.createElement('h3');
      title.textContent = titleText;
      section.append(title);
      if (entries.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '暂无数据。';
        section.append(empty);
        return section;
      }
      for (const entry of entries.slice(0, 5)) {
        const row = document.createElement('div');
        row.className = 'audit-summary-row';
        const label = document.createElement('strong');
        label.textContent = labels[entry.value] ? labels[entry.value] : entry.value;
        row.append(label, badge(String(entry.count)));
        section.append(row);
      }
      return section;
    }

    function topAuditEntries(events, key) {
      const counts = new Map();
      for (const event of events) {
        const value = event[key] || 'unknown';
        counts.set(value, (counts.get(value) || 0) + 1);
      }
      return [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
    }

    function renderAuditEventRow(event, options = {}) {
      const compact = Boolean(options.compact);
      const row = document.createElement('article');
      row.className = 'audit-event-row' + (compact ? ' compact' : '');
      const time = document.createElement('time');
      time.className = 'audit-event-time';
      const createdAt = new Date(event.createdAt);
      time.dateTime = Number.isNaN(createdAt.getTime()) ? '' : createdAt.toISOString();
      time.textContent = formatAuditTime(event.createdAt, compact);

      const main = document.createElement('div');
      main.className = 'audit-event-main';
      const title = document.createElement('strong');
      title.textContent = auditEventTitle(event);
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.append(
        badge(event.actorId || 'system', 'workflow'),
        badge(auditTargetTypeLabels[event.targetType] || event.targetType),
        badge(event.requestSource || 'unknown source'),
      );
      if (event.changedFields.length > 0) {
        meta.append(badge('字段 ' + event.changedFields.join(', '), 'info'));
      }
      if (event.correlationId) meta.append(badge('关联 ' + event.correlationId));
      const body = document.createElement('p');
      body.textContent = event.reason || event.targetId;
      main.append(title, meta, body);

      row.append(time, main);
      if (!compact && event.targetType === 'work_item' && itemById(event.targetId)) {
        const open = document.createElement('button');
        open.type = 'button';
        open.textContent = '打开 WorkItem';
        open.addEventListener('click', () => {
          void selectItem(event.targetId);
        });
        row.append(open);
      }
      return row;
    }

    function auditEventTitle(event) {
      const action = auditActionLabels[event.action] || event.action;
      const target = event.targetLabel || event.targetId;
      return action + ' · ' + target;
    }

    function formatAuditTime(value, compact = false) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '时间未知';
      const options = compact
        ? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
        : { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
      return new Intl.DateTimeFormat('zh-CN', options).format(date);
    }

    function renderIntakeBoard(root) {
      root.className = 'intake-board';
      if (!state.projectId) {
        root.className = 'empty';
        root.textContent = '请先创建或选择项目。';
        return;
      }
      const bundle = state.intakeBundle;
      if (!bundle) {
        root.className = 'empty';
        root.textContent = '左侧新建一个录入会话后，可以通过对话和附件提交需求 idea。';
        return;
      }
      const workbench = document.createElement('div');
      workbench.className = 'intake-workbench';
      workbench.append(renderIntakeSessionBar(bundle));

      const layout = document.createElement('div');
      layout.className = 'intake-layout';

      const captureStack = document.createElement('div');
      captureStack.className = 'intake-capture-stack';
      captureStack.append(renderIntakeConversationPanel(bundle), renderIntakeSourcePanel(bundle));
      layout.append(captureStack, renderIntakeCandidateReviewPanel(bundle));
      workbench.append(layout);
      root.append(workbench);
    }

    function renderIntakeSessionBar(bundle) {
      const bar = document.createElement('section');
      bar.className = 'intake-session-bar';
      const main = document.createElement('div');
      const title = document.createElement('h3');
      title.textContent = bundle.session.title || '需求录入';
      const description = document.createElement('p');
      description.textContent =
        '提交人 ' + (bundle.session.submitter || '未填写') +
        ' · 渠道 ' + (bundle.session.sourceChannel || 'web-chat') +
        ' · 分析状态 ' + (bundle.session.analysisStatus || '未开始');
      main.append(title, description);
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.append(
        badge(intakeStatusLabels[bundle.session.status] || bundle.session.status, 'workflow'),
        badge('消息 ' + String(bundle.messages.length)),
        badge('来源 ' + String(bundle.sourceDocuments.length)),
        badge('候选 ' + String(bundle.candidates.length)),
      );
      bar.append(main, meta);
      return bar;
    }

    function renderIntakePanelHead(title, description) {
      const head = document.createElement('div');
      head.className = 'intake-panel-head';
      const heading = document.createElement('h3');
      heading.textContent = title;
      const copy = document.createElement('p');
      copy.textContent = description;
      head.append(heading, copy);
      return head;
    }

    function renderIntakeConversationPanel(bundle) {
      const chatPanel = document.createElement('section');
      chatPanel.className = 'intake-panel';
      chatPanel.append(
        renderIntakePanelHead('录入对话', '承接原始 idea、补充说明和附件上传，不直接写入正式 WorkItem。'),
      );
      const messages = document.createElement('div');
      messages.className = 'intake-chat';
      if (bundle.messages.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '还没有录入内容。';
        messages.append(empty);
      } else {
        for (const message of bundle.messages) messages.append(renderIntakeMessage(message));
      }
      const form = document.createElement('form');
      form.className = 'intake-composer';
      form.innerHTML =
        '<label>新消息 <textarea name="body" placeholder="输入用户场景、业务目标、约束或验收口径"></textarea></label>' +
        '<label>附件 <input name="files" type="file" multiple accept=".md,.txt,.pdf,.doc,.docx,image/*,text/plain,text/markdown,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></label>' +
        '<button class="primary" type="submit">发送 idea</button>';
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        void submitIntakeMessage(event.currentTarget);
      });
      chatPanel.append(form, messages);
      return chatPanel;
    }

    function renderIntakeSourcePanel(bundle) {
      const sourcePanel = document.createElement('section');
      sourcePanel.className = 'intake-panel';
      sourcePanel.append(
        renderIntakePanelHead('来源材料', '查看上传文件的解析状态，区分已解析文本和等待解析的图片、PDF、Word。'),
      );
      const sources = document.createElement('div');
      sources.className = 'source-list';
      if (bundle.sourceDocuments.length > 0) {
        for (const sourceDocument of bundle.sourceDocuments) sources.append(renderIntakeSource(sourceDocument));
      } else {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '暂无来源文件。';
        sources.append(empty);
      }
      sourcePanel.append(sources);
      return sourcePanel;
    }

    function renderIntakeCandidateReviewPanel(bundle) {
      const candidatePanel = document.createElement('section');
      candidatePanel.className = 'intake-panel';
      candidatePanel.append(
        renderIntakePanelHead('候选需求评审', '评审 AI 生成的候选层级，分配里程碑后再批准进入正式需求树。'),
      );
      const actions = document.createElement('div');
      actions.className = 'intake-review-toolbar';
      const selectedDraftIds = selectedDraftIntakeCandidateIds(bundle);
      const summary = document.createElement('div');
      summary.className = 'intake-review-summary';
      summary.append(
        badge('草稿 ' + String(bundle.candidates.filter((candidate) => candidate.status === 'draft').length)),
        badge('已选 ' + String(selectedDraftIds.length), selectedDraftIds.length > 0 ? 'ready' : 'warning'),
        badge('已批准 ' + String(bundle.candidates.filter((candidate) => candidate.status === 'approved').length), 'ready'),
        badge('已拒绝 ' + String(bundle.candidates.filter((candidate) => candidate.status === 'rejected').length), 'warning'),
      );
      const buttons = document.createElement('div');
      buttons.className = 'intake-actions';
      const analyze = document.createElement('button');
      analyze.type = 'button';
      analyze.textContent = '分析为候选需求';
      analyze.addEventListener('click', () => {
        void analyzeIntake();
      });
      const approve = document.createElement('button');
      approve.type = 'button';
      approve.className = 'primary';
      approve.textContent = '批准已选候选';
      approve.disabled = selectedDraftIds.length === 0;
      approve.addEventListener('click', () => {
        void approveIntake();
      });
      buttons.append(analyze, approve);
      actions.append(summary, buttons);
      const candidateList = document.createElement('div');
      candidateList.className = 'candidate-list';
      if (bundle.candidates.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '提交内容后点击分析，系统会生成可评审的 Epic、Feature、Story 和 Task 候选。';
        candidateList.append(empty);
      } else {
        for (const candidate of bundle.candidates) candidateList.append(renderIntakeCandidate(candidate));
      }
      candidatePanel.append(actions, candidateList);
      return candidatePanel;
    }

    function renderIntakeMessage(message) {
      const row = document.createElement('article');
      row.className = 'intake-message ' + message.role;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.append(
        badge(message.role === 'user' ? '用户' : message.role),
        document.createTextNode(message.author || '未署名'),
      );
      if (message.sourceDocumentIds.length > 0) {
        meta.append(badge('附件 ' + String(message.sourceDocumentIds.length)));
      }
      const body = document.createElement('p');
      body.textContent = message.body || '仅提交附件';
      row.append(meta, body);
      return row;
    }

    function renderIntakeSource(sourceDocument) {
      const row = document.createElement('article');
      row.className = 'source-card';
      const title = document.createElement('strong');
      title.textContent = sourceDocument.name || '(未命名文件)';
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.append(
        badge(sourceKindLabels[sourceDocument.kind] || sourceDocument.kind),
        badge(parseStatusLabels[sourceDocument.parseStatus] || sourceDocument.parseStatus, sourceDocument.parseStatus === 'parsed' ? 'ready' : 'warning'),
        badge(formatFileSize(sourceDocument.size)),
      );
      const body = document.createElement('p');
      body.textContent = sourceDocument.extractedText
        ? sourceDocument.extractedText.slice(0, 220)
        : (sourceDocument.parseError || '等待后续解析器提取正文。');
      row.append(title, meta, body);
      return row;
    }

    function renderIntakeCandidate(candidate) {
      const row = document.createElement('article');
      row.className = 'candidate-card';
      row.style.marginLeft = String(Math.min(intakeCandidateDepth(candidate), 4) * 14) + 'px';
      const header = document.createElement('div');
      header.className = 'candidate-card-header';
      const title = document.createElement('strong');
      title.textContent = candidate.title || '(无标题)';
      header.append(title);
      if (candidate.status === 'draft') {
        const selection = document.createElement('label');
        selection.className = 'candidate-select';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = state.selectedIntakeCandidateIds.has(candidate.id);
        checkbox.addEventListener('change', (event) => {
          setIntakeCandidateSelected(candidate.id, event.currentTarget.checked);
        });
        selection.append(checkbox, document.createTextNode('批准'));
        header.append(selection);
      }
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.append(
        badge(typeLabels[candidate.type] || candidate.type, 'type-' + candidate.type),
        badge(candidateStatusLabels[candidate.status] || candidate.status, candidate.status === 'approved' ? 'ready' : 'workflow'),
        badge('置信 ' + String(Math.round(candidate.confidence * 100)) + '%'),
        badge('来源 ' + String(candidate.sourceRefs.length)),
      );
      if (candidate.milestoneId) {
        const milestone = milestoneById(candidate.milestoneId);
        meta.append(badge('里程碑 ' + (milestone ? milestone.title : candidate.milestoneId), 'milestone'));
      }
      const body = document.createElement('p');
      body.textContent = candidate.body;
      const acceptance = document.createElement('div');
      acceptance.className = 'meta';
      for (const item of candidate.acceptance.slice(0, 3)) acceptance.append(badge(item));
      if (candidate.openQuestions.length > 0) {
        acceptance.append(badge('待确认 ' + String(candidate.openQuestions.length), 'warning'));
      }
      const sourceRefs = renderIntakeSourceRefs(candidate);
      const actions = document.createElement('div');
      actions.className = 'intake-actions';
      if (candidate.status === 'draft') {
        const planning = document.createElement('div');
        planning.className = 'candidate-planning';
        const milestoneLabel = document.createElement('label');
        milestoneLabel.textContent = '候选里程碑';
        const milestoneSelect = document.createElement('select');
        fillMilestoneSelect(milestoneSelect, candidate.milestoneId || '');
        milestoneSelect.addEventListener('change', (event) => {
          void updateIntakeCandidateMilestone(candidate.id, event.currentTarget.value || null);
        });
        milestoneLabel.append(milestoneSelect);
        const reject = document.createElement('button');
        reject.type = 'button';
        reject.textContent = '拒绝';
        reject.addEventListener('click', () => {
          void updateIntakeCandidateStatus(candidate.id, 'rejected');
        });
        actions.append(reject);
        planning.append(milestoneLabel, actions);
        row.append(header, meta, body, acceptance, sourceRefs, planning, renderIntakeCandidateEditor(candidate));
        return row;
      } else if (candidate.status === 'rejected') {
        const restore = document.createElement('button');
        restore.type = 'button';
        restore.textContent = '恢复草稿';
        restore.addEventListener('click', () => {
          void updateIntakeCandidateStatus(candidate.id, 'draft');
        });
        actions.append(restore);
      }
      row.append(header, meta, body, acceptance, sourceRefs);
      if (actions.childNodes.length > 0) row.append(actions);
      return row;
    }

    function renderIntakeSourceRefs(candidate) {
      const details = document.createElement('details');
      details.className = 'source-ref-list';
      const summary = document.createElement('summary');
      summary.textContent = '来源引用 ' + String(candidate.sourceRefs.length);
      details.append(summary);
      if (candidate.sourceRefs.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = '该候选需求还没有来源引用。';
        details.append(empty);
        return details;
      }
      candidate.sourceRefs.forEach((sourceRef, index) => {
        details.append(renderIntakeSourceRef(sourceRef, index));
      });
      return details;
    }

    function renderIntakeSourceRef(sourceRef, index) {
      const row = document.createElement('section');
      row.className = 'source-ref-row';
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.append(...intakeSourceRefBadges(sourceRef, index));
      const quote = document.createElement('blockquote');
      quote.textContent = sourceRef.quote || '未保留引用文本。';
      row.append(meta, quote);
      return row;
    }

    function intakeSourceRefBadges(sourceRef, index) {
      const badges = [];
      if (sourceRef.messageId) {
        const message = intakeMessageById(sourceRef.messageId);
        badges.push(badge('对话 ' + (message ? message.author || message.role : String(index + 1))));
      }
      if (sourceRef.sourceDocumentId) {
        const sourceDocument = intakeSourceDocumentById(sourceRef.sourceDocumentId);
        const sourceName = sourceDocument ? sourceDocument.name : sourceRef.sourceDocumentId;
        badges.push(badge(sourceName));
        if (sourceDocument) badges.push(badge(sourceKindLabels[sourceDocument.kind] || sourceDocument.kind));
        if (sourceRef.sourceChunkId) {
          const chunk = intakeSourceChunkById(sourceDocument, sourceRef.sourceChunkId);
          badges.push(badge('Chunk ' + String(chunk ? chunk.index + 1 : index + 1)));
        }
      }
      if (badges.length === 0) badges.push(badge('来源 ' + String(index + 1)));
      badges.push(badge('置信 ' + String(Math.round(sourceRef.confidence * 100)) + '%'));
      return badges;
    }

    function renderIntakeCandidateEditor(candidate) {
      const details = document.createElement('details');
      details.className = 'candidate-edit';
      const summary = document.createElement('summary');
      summary.textContent = '编辑候选字段';
      const form = document.createElement('form');
      form.className = 'controls candidate-edit-form';

      const titleLabel = document.createElement('label');
      titleLabel.textContent = '标题';
      const titleInput = document.createElement('input');
      titleInput.name = 'title';
      titleInput.value = candidate.title || '';
      titleInput.autocomplete = 'off';
      titleLabel.append(titleInput);

      const bodyLabel = intakeTextareaLabel('说明', 'body', candidate.body);
      const analysisLabel = intakeTextareaLabel('分析', 'analysis', candidate.analysis);
      const designLabel = intakeTextareaLabel('设计', 'design', candidate.design);
      const acceptanceLabel = intakeTextareaLabel('验收标准', 'acceptance', candidate.acceptance.join('\\n'));
      const openQuestionsLabel = intakeTextareaLabel(
        '待确认问题',
        'openQuestions',
        candidate.openQuestions.join('\\n'),
      );

      const save = document.createElement('button');
      save.type = 'submit';
      save.className = 'primary';
      save.textContent = '保存候选';
      form.append(titleLabel, bodyLabel, analysisLabel, designLabel, acceptanceLabel, openQuestionsLabel, save);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        void updateIntakeCandidateFields(candidate.id, event.currentTarget);
      });
      details.append(summary, form);
      return details;
    }

    function intakeTextareaLabel(text, name, value) {
      const label = document.createElement('label');
      label.textContent = text;
      const textarea = document.createElement('textarea');
      textarea.name = name;
      textarea.value = value || '';
      label.append(textarea);
      return label;
    }

    function renderTreeBoard(root) {
      const tree = state.mainBoard ? state.mainBoard.tree : null;
      root.className = 'tree-board';
      if (!tree || tree.roots.length === 0) {
        root.className = 'empty';
        root.textContent = '当前项目暂无工作项。';
        return;
      }
      const summary = document.createElement('div');
      summary.className = 'tree-board-summary';
      summary.append(
        metric(String(tree.total), '工作项'),
        metric(String(tree.roots.length), '根节点'),
        metric(String(tree.maxDepth), '最大层级'),
        metric(String(tree.warnings.length), '树告警'),
      );
      root.append(summary);
      if (tree.warnings.length > 0) {
        const warnings = document.createElement('div');
        warnings.className = 'meta';
        for (const warning of tree.warnings) {
          warnings.append(badge(warningLabels[warning.code] || warning.code, warning.severity));
        }
        root.append(warnings);
      }
      for (const node of tree.roots) root.append(renderBoardTreeNode(node));
    }

    function renderBoardTreeNode(node) {
      const wrap = document.createElement('section');
      wrap.className = 'board-tree-node';
      wrap.append(renderCard(node.card));
      if (node.children.length > 0) {
        const children = document.createElement('div');
        children.className = 'board-tree-children';
        for (const child of node.children) children.append(renderBoardTreeNode(child));
        wrap.append(children);
      }
      return wrap;
    }

    function renderCoverageBoard(root) {
      const coverage = state.mainBoard ? state.mainBoard.coverage : null;
      root.className = 'coverage-board';
      if (!coverage || coverage.parents.length === 0) {
        root.className = 'empty';
        root.textContent = '当前项目暂无验收标准。';
        return;
      }
      const summary = document.createElement('div');
      summary.className = 'coverage-summary';
      summary.append(
        metric(String(coverage.parents.length), '有验收父项'),
        metric(String(coverage.coveredCriteria) + '/' + String(coverage.totalCriteria), '验收覆盖'),
        metric(String(coverage.uncoveredCriteria), '未覆盖标准'),
        metric(String(coverage.duplicateCoveredCriteria || 0), '重复覆盖'),
        metric(coverage.complete ? '通过' : '有缺口', '覆盖状态'),
      );
      root.append(summary);
      for (const parent of coverage.parents) root.append(renderCoverageParent(parent));
    }

    function renderCoverageParent(parent) {
      const section = document.createElement('section');
      section.className = 'coverage-parent';
      const header = document.createElement('header');
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'coverage-parent-link';
      link.innerHTML = '<span class="coverage-parent-title"></span><span class="meta"></span>';
      link.querySelector('.coverage-parent-title').textContent = parent.parent.title || '(无标题)';
      const parentMeta = link.querySelector('.meta');
      parentMeta.append(badge(typeLabels[parent.parent.type] || parent.parent.type, 'type-' + parent.parent.type));
      parentMeta.append(document.createTextNode(
        '验收 ' + String(parent.coveredCriteria) + '/' + String(parent.totalCriteria),
      ));
      link.addEventListener('click', () => selectItem(parent.parent.id));
      const status = document.createElement('div');
      status.className = 'meta';
      status.append(badge(
        parent.uncoveredCriteria === 0 ? '覆盖完整' : '缺口 ' + String(parent.uncoveredCriteria),
        parent.uncoveredCriteria === 0 ? 'ready' : 'blocking',
      ));
      if (parent.coveringWorkItems.length > 0) {
        status.append(badge('覆盖子项 ' + String(parent.coveringWorkItems.length)));
      }
      if ((parent.duplicateCoveredCriteria || 0) > 0) {
        status.append(badge('重复覆盖 ' + String(parent.duplicateCoveredCriteria), 'warning'));
      }
      header.append(link, status);

      const rows = document.createElement('div');
      rows.className = 'coverage-grid';
      for (const criterion of parent.rows) rows.append(renderCoverageRow(criterion));
      section.append(header, rows);
      return section;
    }

    function renderCoverageRow(criterion) {
      const row = document.createElement('div');
      row.className =
        'coverage-row' +
        (criterion.complete ? '' : ' coverage-gap') +
        (criterion.duplicateCoverage ? ' coverage-duplicate' : '');
      const title = document.createElement('div');
      title.className = 'coverage-cell';
      title.append(badge(criterion.complete ? '已覆盖' : '未覆盖', criterion.complete ? 'ready' : 'blocking'));
      if (criterion.duplicateCoverage) title.append(badge('重复覆盖', 'warning'));
      const text = document.createElement('span');
      text.textContent = criterion.text;
      title.append(text);

      const coveredBy = document.createElement('div');
      coveredBy.className = 'coverage-cell';
      const coveredMeta = document.createElement('span');
      coveredMeta.className = 'meta';
      if (criterion.coveredBy.length === 0) {
        coveredMeta.append(badge('无子项覆盖', 'blocking'));
      } else {
        for (const child of criterion.coveredBy) {
          coveredMeta.append(badge(child.title, 'type-' + child.type));
        }
      }
      coveredBy.append(coveredMeta);

      const evidence = document.createElement('div');
      evidence.className = 'coverage-cell';
      evidence.append(badge(
        '证据 ' + String(criterion.evidenceCount),
        criterion.evidenceCount > 0 ? 'ready' : criterion.complete ? 'warning' : 'blocking',
      ));
      row.append(title, coveredBy, evidence);
      return row;
    }

    function renderMilestoneBoard(root) {
      const board = state.mainBoard ? state.mainBoard.milestoneBoard : null;
      root.className = 'milestone-board';
      if (!board) {
        root.className = 'empty';
        root.textContent = '当前项目暂无里程碑计划。';
        return;
      }
      if (board.lanes.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '请先在左侧创建里程碑。';
        root.append(empty);
        return;
      }
      const workbench = document.createElement('div');
      workbench.className = 'planning-workbench planning-roadmap-workbench';
      const side = document.createElement('div');
      side.className = 'planning-panel-stack';
      side.append(renderPlanningFocusPanel(board), renderMilestoneRiskPanel(board));
      workbench.append(renderMilestoneTimeline(board), side);
      root.append(workbench, renderPlanningScopeMatrix(board), renderMilestoneLanesPanel(board));
    }

    function renderDeliveryBoard(root) {
      const board = state.mainBoard ? state.mainBoard.milestoneBoard : null;
      root.className = 'delivery-board';
      if (!board) {
        root.className = 'empty';
        root.textContent = '当前项目暂无交付切片。';
        return;
      }
      const workbench = document.createElement('div');
      workbench.className = 'planning-workbench delivery-slice-workbench';
      const side = document.createElement('div');
      side.className = 'planning-panel-stack';
      side.append(renderDeliverySliceQueue(board, '交付切片队列', 12), renderMilestoneRiskPanel(board));
      workbench.append(renderDeliveryParentMap(board), side);
      root.append(workbench, renderMilestoneLanesPanel(board));
    }

    function renderMilestoneBoardSummary(board, className) {
      const rollup = milestoneBoardRollup(board);
      const summary = document.createElement('div');
      summary.className = className;
      summary.append(
        metric(String(rollup.milestones), '里程碑'),
        metric(String(rollup.deliveredWorkItems) + '/' + String(rollup.totalWorkItems), '工作项交付'),
        metric(String(board.completedSlices || 0) + '/' + String(board.totalSlices || 0), '交付切片'),
        metric(String(board.openSlices || 0), '未完成切片'),
        metric(String(rollup.blockers), '阻塞'),
      );
      return summary;
    }

    function renderMilestoneTimeline(board) {
      const panel = document.createElement('section');
      panel.className = 'planning-panel';
      const title = document.createElement('h3');
      title.textContent = '里程碑路线图';
      const timeline = document.createElement('div');
      timeline.className = 'planning-timeline';
      for (const lane of milestoneLanes(board)) timeline.append(renderMilestoneTimelineRow(lane));
      panel.append(title, timeline);
      return panel;
    }

    function renderPlanningFocusPanel(board) {
      const panel = document.createElement('section');
      panel.className = 'planning-panel planning-focus-panel';
      const title = document.createElement('h3');
      title.textContent = '计划焦点';
      const list = document.createElement('div');
      list.className = 'planning-focus-list';
      for (const item of planningFocusItems(board)) list.append(renderPlanningFocusRow(item));
      panel.append(title, list);
      return panel;
    }

    function renderPlanningFocusRow(item) {
      const row = document.createElement('div');
      row.className = 'planning-focus-row ' + item.tone;
      const main = document.createElement('div');
      main.className = 'planning-row-main';
      const title = document.createElement('strong');
      title.textContent = item.title;
      const detail = document.createElement('p');
      detail.textContent = item.detail;
      main.append(title, detail);
      row.append(main, badge(item.badge, item.tone));
      return row;
    }

    function renderMilestoneTimelineRow(lane) {
      const row = document.createElement('div');
      row.className = 'planning-timeline-row ' + milestoneLaneTone(lane);
      const main = document.createElement('div');
      main.className = 'planning-row-main';
      const title = document.createElement('strong');
      title.textContent = milestoneLaneTitle(lane);
      const detail = document.createElement('p');
      detail.textContent = milestoneLaneDetail(lane);
      const meta = document.createElement('div');
      meta.className = 'meta';
      if (lane.milestone) {
        meta.append(badge(milestoneStatusLabels[lane.milestone.status] || lane.milestone.status, 'workflow'));
        meta.append(badge(milestoneDateRange(lane.milestone)));
      } else {
        meta.append(badge('未排里程碑', 'warning'));
      }
      if (lane.rollup.blockedWorkItems + lane.rollup.blockedSlices > 0) {
        meta.append(badge('阻塞 ' + String(lane.rollup.blockedWorkItems + lane.rollup.blockedSlices), 'blocking'));
      }
      main.append(title, detail, meta);
      const meters = document.createElement('div');
      meters.className = 'planning-meter-group';
      meters.append(
        renderPlanningMeter('工作项', lane.rollup.deliveredWorkItems, lane.rollup.totalWorkItems, lane.rollup.percentDelivered),
        renderPlanningMeter('切片', lane.rollup.completedSlices, lane.rollup.totalSlices, lane.rollup.percentSlicesComplete),
      );
      row.append(main, meters);
      return row;
    }

    function renderPlanningScopeMatrix(board) {
      const panel = document.createElement('details');
      panel.className = 'planning-panel planning-scope-panel';
      const title = document.createElement('summary');
      const label = document.createElement('span');
      label.textContent = '范围矩阵';
      title.append(label, badge(String(milestoneLanes(board).length) + ' 组'));
      const matrix = document.createElement('div');
      matrix.className = 'planning-scope-matrix';
      for (const lane of milestoneLanes(board)) matrix.append(renderPlanningScopeRow(lane));
      panel.append(title, matrix);
      return panel;
    }

    function renderPlanningScopeRow(lane) {
      const row = document.createElement('div');
      row.className = 'planning-scope-row ' + milestoneLaneTone(lane);
      const main = document.createElement('div');
      main.className = 'planning-row-main';
      const title = document.createElement('strong');
      title.textContent = milestoneLaneTitle(lane);
      const detail = document.createElement('p');
      detail.textContent = lane.milestone
        ? textSnippet(lane.milestone.goal || lane.milestone.description, '未填写目标', 92)
        : '这些工作项没有进入任何里程碑，需要先完成计划归属。';
      main.append(title, detail);
      row.append(
        main,
        renderPlanningMeter('工作项', lane.rollup.deliveredWorkItems, lane.rollup.totalWorkItems, lane.rollup.percentDelivered),
        renderPlanningMeter('切片', lane.rollup.completedSlices, lane.rollup.totalSlices, lane.rollup.percentSlicesComplete),
        badge(planningLaneStatus(lane), milestoneLaneTone(lane)),
      );
      return row;
    }

    function renderDeliverySliceQueue(board, titleText, limit) {
      const panel = document.createElement('section');
      panel.className = 'planning-panel';
      const title = document.createElement('h3');
      title.textContent = titleText;
      const queue = document.createElement('div');
      queue.className = 'delivery-slice-queue';
      const items = deliverySliceItems(board).slice(0, limit);
      if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '当前项目暂无跨里程碑交付切片。';
        queue.append(empty);
      } else {
        for (const item of items) queue.append(renderDeliverySliceRow(item));
      }
      panel.append(title, queue);
      return panel;
    }

    function renderDeliverySliceRow(item) {
      const row = document.createElement('div');
      row.className = 'delivery-slice-row ' + deliverySliceTone(item);
      const main = document.createElement('div');
      main.className = 'planning-row-main';
      const title = document.createElement('strong');
      title.textContent = item.slice.title || item.slice.scope || '(无标题)';
      const detail = document.createElement('p');
      detail.textContent = item.parent.title + ' · ' + item.milestone.title + ' · ' + textSnippet(item.slice.scope, '未填写范围', 96);
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.append(badge((statusLabels[item.slice.status] || item.slice.status) + ' → ' + (statusLabels[item.slice.targetStatus] || item.slice.targetStatus)));
      meta.append(badge('验收 ' + String(item.acceptanceCriteria.length), item.acceptanceCriteria.length > 0 ? 'ready' : 'warning'));
      meta.append(badge('证据 ' + String(item.evidenceCount), item.evidenceCount > 0 ? 'ready' : 'warning'));
      if (item.slice.owner) meta.append(badge(item.slice.owner));
      for (const warning of item.warnings.slice(0, 3)) {
        meta.append(badge(warningLabels[warning.code] || warning.code, warning.severity));
      }
      if (item.warnings.length > 3) meta.append(badge('+' + String(item.warnings.length - 3)));
      main.append(title, detail, meta);
      const open = document.createElement('button');
      open.type = 'button';
      open.textContent = '打开父项';
      open.addEventListener('click', () => selectItem(item.parent.id));
      row.append(main, open);
      return row;
    }

    function renderMilestoneRiskPanel(board) {
      const panel = document.createElement('section');
      panel.className = 'planning-panel';
      const title = document.createElement('h3');
      title.textContent = '计划阻塞';
      const list = document.createElement('div');
      list.className = 'planning-risk-list';
      const items = milestoneRiskItems(board).slice(0, 7);
      if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '当前里程碑计划没有阻塞。';
        list.append(empty);
      } else {
        for (const item of items) list.append(renderMilestoneRiskRow(item));
      }
      panel.append(title, list);
      return panel;
    }

    function renderMilestoneRiskRow(item) {
      const row = document.createElement('div');
      row.className = 'planning-risk-row ' + item.tone;
      const main = document.createElement('div');
      main.className = 'planning-row-main';
      const title = document.createElement('strong');
      title.textContent = item.title;
      const detail = document.createElement('p');
      detail.textContent = item.detail;
      const meta = document.createElement('div');
      meta.className = 'meta';
      for (const label of item.labels) meta.append(badge(label, item.tone));
      main.append(title, detail, meta);
      if (item.workItemId) {
        const open = document.createElement('button');
        open.type = 'button';
        open.textContent = '打开';
        open.addEventListener('click', () => selectItem(item.workItemId));
        row.append(main, open);
      } else {
        row.append(main, badge(item.tone === 'blocking' ? '需处理' : '待计划', item.tone));
      }
      return row;
    }

    function renderDeliveryParentMap(board) {
      const panel = document.createElement('section');
      panel.className = 'planning-panel';
      const title = document.createElement('h3');
      title.textContent = '跨里程碑父需求';
      const map = document.createElement('div');
      map.className = 'delivery-parent-map';
      const groups = deliveryParentGroups(board);
      if (groups.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '当前没有父需求拆成跨里程碑切片。';
        map.append(empty);
      } else {
        for (const group of groups) map.append(renderDeliveryParentRow(group));
      }
      panel.append(title, map);
      return panel;
    }

    function renderDeliveryParentRow(group) {
      const row = document.createElement('div');
      row.className = 'delivery-parent-row ' + deliveryParentTone(group);
      const main = document.createElement('div');
      main.className = 'planning-row-main';
      const title = document.createElement('strong');
      title.textContent = group.parent.title;
      const detail = document.createElement('p');
      detail.textContent = group.milestoneTitles.join(' / ');
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.append(badge('切片 ' + String(group.completed) + '/' + String(group.total), group.open === 0 ? 'ready' : 'warning'));
      meta.append(badge('阻塞 ' + String(group.blocked), group.blocked > 0 ? 'blocking' : 'ready'));
      meta.append(badge(typeLabels[group.parent.type] || group.parent.type));
      main.append(title, detail, meta);
      const open = document.createElement('button');
      open.type = 'button';
      open.textContent = '打开父项';
      open.addEventListener('click', () => selectItem(group.parent.id));
      row.append(main, open);
      return row;
    }

    function renderMilestoneLanesPanel(board) {
      const panel = document.createElement('details');
      panel.className = 'milestone-lanes-panel';
      const summary = document.createElement('summary');
      const title = document.createElement('span');
      title.textContent = '里程碑泳道';
      summary.append(title, badge(String(board.lanes.length) + ' 泳道'));
      const lanes = document.createElement('div');
      lanes.className = 'milestone-lanes';
      for (const lane of milestoneLanes(board)) lanes.append(renderMilestoneLane(lane));
      panel.append(summary, lanes);
      return panel;
    }

    function milestoneBoardRollup(board) {
      const lanes = board.lanes || [];
      return {
        milestones: lanes.filter((lane) => lane.milestone).length,
        totalWorkItems: lanes.reduce((total, lane) => total + lane.rollup.totalWorkItems, 0),
        deliveredWorkItems: lanes.reduce((total, lane) => total + lane.rollup.deliveredWorkItems, 0),
        blockers: (board.blockedSlices || 0) + lanes.reduce((total, lane) => total + lane.rollup.blockedWorkItems, 0),
      };
    }

    function milestoneLanes(board) {
      return [...(board.lanes || [])].sort(compareMilestoneLanes);
    }

    function compareMilestoneLanes(left, right) {
      if (!left.milestone && right.milestone) return 1;
      if (left.milestone && !right.milestone) return -1;
      const leftDue = left.milestone && Number.isFinite(left.milestone.dueDate) ? left.milestone.dueDate : Number.MAX_SAFE_INTEGER;
      const rightDue = right.milestone && Number.isFinite(right.milestone.dueDate) ? right.milestone.dueDate : Number.MAX_SAFE_INTEGER;
      return leftDue - rightDue || left.title.localeCompare(right.title, 'zh-Hans-CN');
    }

    function milestoneLaneTone(lane) {
      if (lane.rollup.blockedWorkItems + lane.rollup.blockedSlices > 0) return 'blocking';
      if (!lane.milestone || lane.rollup.openWorkItems > 0 || lane.rollup.openSlices > 0) return 'warning';
      return 'ready';
    }

    function milestoneLaneDetail(lane) {
      if (!lane.milestone) return '未排里程碑的工作项需要进入计划后才能形成交付范围。';
      const goal = textSnippet(lane.milestone.goal || lane.milestone.description, '未填写目标', 112);
      return goal + ' · ' + milestoneDateRange(lane.milestone);
    }

    function milestoneDateRange(milestone) {
      const start = Number.isFinite(milestone.startDate) ? formatDateLabel(milestone.startDate) : '未设开始';
      const due = Number.isFinite(milestone.dueDate) ? formatDateLabel(milestone.dueDate) : '未设截止';
      return start + ' → ' + due;
    }

    function planningLaneStatus(lane) {
      if (!lane.milestone) return '待排期 ' + String(lane.rollup.totalWorkItems);
      if (lane.rollup.blockedWorkItems + lane.rollup.blockedSlices > 0) return '阻塞 ' + String(lane.rollup.blockedWorkItems + lane.rollup.blockedSlices);
      if (lane.rollup.openWorkItems + lane.rollup.openSlices > 0) return '进行中';
      return '完成';
    }

    function milestoneLaneTitle(lane) {
      return lane.milestone ? lane.title : '未排里程碑';
    }

    function planningFocusItems(board) {
      const lanes = milestoneLanes(board);
      const rollup = milestoneBoardRollup(board);
      const nextLane = lanes.find((lane) => lane.milestone && (lane.rollup.openWorkItems + lane.rollup.openSlices > 0))
        || lanes.find((lane) => lane.milestone);
      const unplannedLane = lanes.find((lane) => !lane.milestone);
      const unplannedCount = unplannedLane ? unplannedLane.rollup.totalWorkItems : 0;
      const totalSlices = board.totalSlices || 0;
      const openSlices = board.openSlices || 0;
      const completedSlices = board.completedSlices || 0;
      return [
        nextLane
          ? {
            title: '最近里程碑',
            detail: milestoneLaneTitle(nextLane) + ' · ' + milestoneDateRange(nextLane.milestone) + ' · ' + planningLaneStatus(nextLane),
            badge: milestoneStatusLabels[nextLane.milestone.status] || nextLane.milestone.status,
            tone: milestoneLaneTone(nextLane),
          }
          : {
            title: '最近里程碑',
            detail: '当前没有已创建的里程碑。',
            badge: '待创建',
            tone: 'warning',
          },
        {
          title: '未排范围',
          detail: unplannedCount > 0
            ? String(unplannedCount) + ' 个工作项没有里程碑归属。'
            : '所有工作项已有里程碑归属。',
          badge: unplannedCount > 0 ? String(unplannedCount) : '已归属',
          tone: unplannedCount > 0 ? 'warning' : 'ready',
        },
        {
          title: '跨里程碑切片',
          detail: totalSlices === 0
            ? '当前没有跨里程碑切片。'
            : String(completedSlices) + '/' + String(totalSlices) + ' 完成，' + String(openSlices) + ' 未完成。',
          badge: totalSlices === 0 ? '无切片' : openSlices === 0 ? '完成' : '未完成 ' + String(openSlices),
          tone: totalSlices === 0 ? '' : openSlices === 0 ? 'ready' : 'warning',
        },
        {
          title: '计划阻塞',
          detail: rollup.blockers > 0
            ? String(rollup.blockers) + ' 个阻塞项会影响里程碑交付。'
            : '当前没有计划阻塞。',
          badge: rollup.blockers > 0 ? String(rollup.blockers) : '无阻塞',
          tone: rollup.blockers > 0 ? 'blocking' : 'ready',
        },
      ];
    }

    function renderPlanningMeter(label, value, total, percentValue) {
      const meter = document.createElement('div');
      meter.className = 'planning-meter';
      const header = document.createElement('header');
      const left = document.createElement('span');
      left.textContent = label;
      const right = document.createElement('span');
      right.textContent = total === 0 ? '无范围' : String(value) + '/' + String(total);
      const track = document.createElement('div');
      track.className = 'planning-meter-track';
      const fill = document.createElement('div');
      fill.className = 'planning-meter-fill';
      fill.style.width = String(total === 0 ? 0 : percentValue) + '%';
      header.append(left, right);
      track.append(fill);
      meter.append(header, track);
      return meter;
    }

    function deliverySliceItems(board) {
      return (board.lanes || [])
        .flatMap((lane) => (lane.slices || []).map((item) => ({ ...item, lane })))
        .sort(compareDeliverySlices);
    }

    function compareDeliverySlices(left, right) {
      const leftBlocked = hasBlockingWarnings(left) ? 0 : 1;
      const rightBlocked = hasBlockingWarnings(right) ? 0 : 1;
      const leftComplete = deliverySliceComplete(left) ? 1 : 0;
      const rightComplete = deliverySliceComplete(right) ? 1 : 0;
      const leftDue = left.milestone && Number.isFinite(left.milestone.dueDate) ? left.milestone.dueDate : Number.MAX_SAFE_INTEGER;
      const rightDue = right.milestone && Number.isFinite(right.milestone.dueDate) ? right.milestone.dueDate : Number.MAX_SAFE_INTEGER;
      return leftBlocked - rightBlocked
        || leftComplete - rightComplete
        || leftDue - rightDue
        || left.parent.title.localeCompare(right.parent.title, 'zh-Hans-CN');
    }

    function deliverySliceTone(item) {
      if (hasBlockingWarnings(item)) return 'blocking';
      return deliverySliceComplete(item) ? 'ready' : 'warning';
    }

    function deliverySliceComplete(item) {
      return item.slice.status === item.slice.targetStatus;
    }

    function hasBlockingWarnings(item) {
      return (item.warnings || []).some((warning) => warning.severity === 'blocking');
    }

    function milestoneRiskItems(board) {
      const risks = [];
      for (const lane of milestoneLanes(board)) {
        const blockerCount = lane.rollup.blockedWorkItems + lane.rollup.blockedSlices;
        if (!lane.milestone && lane.rollup.totalWorkItems > 0) {
          risks.push({
            title: '未排里程碑',
            detail: String(lane.rollup.totalWorkItems) + ' 个工作项没有计划归属。',
            labels: ['待计划 ' + String(lane.rollup.totalWorkItems)],
            tone: 'warning',
            workItemId: lane.cards[0] ? lane.cards[0].workItem.id : '',
          });
        }
        if (blockerCount > 0) {
          risks.push({
            title: milestoneLaneTitle(lane),
            detail: '里程碑范围内存在阻塞，交付结论不能直接关闭。',
            labels: [
              '工作项阻塞 ' + String(lane.rollup.blockedWorkItems),
              '切片阻塞 ' + String(lane.rollup.blockedSlices),
            ],
            tone: 'blocking',
            workItemId: lane.cards.find((card) => card.workItem.blockedByIds.length > 0)?.workItem.id || '',
          });
        }
        if (lane.rollup.openSlices > 0 && lane.rollup.blockedSlices === 0) {
          risks.push({
            title: milestoneLaneTitle(lane),
            detail: String(lane.rollup.openSlices) + ' 个交付切片尚未达到目标状态。',
            labels: ['切片未完成 ' + String(lane.rollup.openSlices)],
            tone: 'warning',
            workItemId: lane.slices[0] ? lane.slices[0].parent.id : '',
          });
        }
      }
      return risks;
    }

    function deliveryParentGroups(board) {
      const groups = new Map();
      for (const item of deliverySliceItems(board)) {
        const key = item.parent.id;
        const existing = groups.get(key) || {
          parent: item.parent,
          items: [],
          milestoneTitles: [],
          total: 0,
          completed: 0,
          open: 0,
          blocked: 0,
        };
        existing.items.push(item);
        existing.total += 1;
        if (deliverySliceComplete(item)) existing.completed += 1;
        else existing.open += 1;
        if (hasBlockingWarnings(item)) existing.blocked += 1;
        if (!existing.milestoneTitles.includes(item.milestone.title)) existing.milestoneTitles.push(item.milestone.title);
        groups.set(key, existing);
      }
      return [...groups.values()].sort((left, right) =>
        right.blocked - left.blocked ||
        right.open - left.open ||
        left.parent.title.localeCompare(right.parent.title, 'zh-Hans-CN'),
      );
    }

    function deliveryParentTone(group) {
      if (group.blocked > 0) return 'blocking';
      if (group.open > 0) return 'warning';
      return 'ready';
    }

    function renderMilestoneLane(lane) {
      const section = document.createElement('section');
      section.className = 'milestone-lane';
      const header = document.createElement('header');
      header.innerHTML = '<span class="column-title"></span><span class="meta"></span>';
      header.querySelector('.column-title').textContent = milestoneLaneTitle(lane);
      const meta = header.querySelector('.meta');
      meta.append(badge('工作项 ' + String(lane.rollup.deliveredWorkItems) + '/' + String(lane.rollup.totalWorkItems)));
      meta.append(badge('切片 ' + String(lane.rollup.completedSlices) + '/' + String(lane.rollup.totalSlices)));
      if (lane.rollup.blockedWorkItems > 0 || lane.rollup.blockedSlices > 0) {
        meta.append(badge('阻塞 ' + String(lane.rollup.blockedWorkItems + lane.rollup.blockedSlices), 'blocking'));
      }
      section.append(header);

      if (lane.slices.length > 0) {
        const sliceBlock = document.createElement('div');
        sliceBlock.className = 'lane-block';
        const title = document.createElement('h3');
        title.textContent = '交付切片';
        sliceBlock.append(title);
        for (const slice of lane.slices) sliceBlock.append(renderDeliverySliceCard(slice));
        section.append(sliceBlock);
      }

      const cardBlock = document.createElement('div');
      cardBlock.className = 'lane-block';
      const cardTitle = document.createElement('h3');
      cardTitle.textContent = '工作项';
      cardBlock.append(cardTitle);
      if (lane.cards.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '暂无工作项。';
        cardBlock.append(empty);
      } else {
        for (const card of lane.cards) cardBlock.append(renderCard(card));
      }
      section.append(cardBlock);
      return section;
    }

    function renderDeliverySliceCard(sliceCard) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'work-card slice-card';
      button.innerHTML = '<span class="card-code"></span><strong></strong><span class="card-summary"></span>';
      button.querySelector('.card-code').textContent = sliceCard.slice.id;
      button.querySelector('strong').textContent = sliceCard.slice.title || sliceCard.slice.scope || '(无标题)';
      const summary = button.querySelector('.card-summary');
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.append(badge('Slice', 'workflow'));
      meta.append(document.createTextNode('父项 ' + sliceCard.parent.title));
      meta.append(document.createTextNode(
        (statusLabels[sliceCard.slice.status] || sliceCard.slice.status) +
        ' → ' +
        (statusLabels[sliceCard.slice.targetStatus] || sliceCard.slice.targetStatus),
      ));
      if (sliceCard.slice.owner) meta.append(document.createTextNode('负责人 ' + sliceCard.slice.owner));
      summary.append(meta);

      const scope = document.createElement('span');
      scope.className = 'meta';
      scope.append(document.createTextNode(sliceCard.slice.scope));
      scope.append(badge('验收 ' + String(sliceCard.acceptanceCriteria.length)));
      scope.append(badge('证据 ' + String(sliceCard.evidenceCount), sliceCard.evidenceCount > 0 ? 'ready' : 'warning'));
      summary.append(scope);

      const warnings = document.createElement('span');
      warnings.className = 'meta';
      for (const warning of sliceCard.warnings.slice(0, 3)) {
        warnings.append(badge(warningLabels[warning.code] || warning.code, warning.severity));
      }
      if (warnings.childNodes.length > 0) summary.append(warnings);
      button.addEventListener('click', () => selectItem(sliceCard.parent.id));
      return button;
    }

    function renderTeamBoard(root) {
      const board = state.mainBoard ? state.mainBoard.teamBoard : null;
      root.className = 'team-board';
      if (!board) {
        root.className = 'empty';
        root.textContent = '当前项目暂无团队容量数据。';
        return;
      }
      if (board.members.length === 0 && board.unassignedCards.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '请先在左侧创建团队成员。';
        root.append(empty);
        return;
      }
      const workbench = document.createElement('div');
      workbench.className = 'team-workbench';
      const side = document.createElement('div');
      side.className = 'team-panel-stack';
      side.append(renderTeamUnassignedPanel(board), renderTeamRiskPanel(board));
      workbench.append(renderTeamCapacityPanel(board), side);
      root.append(workbench, renderTeamMemberLanesPanel(board));
    }

    function renderTeamRoleBoard(root) {
      const board = state.mainBoard ? state.mainBoard.teamBoard : null;
      const columns = state.mainBoard ? state.mainBoard.columns || [] : [];
      root.className = 'team-board team-role-board';
      if (!board) {
        root.className = 'empty';
        root.textContent = '当前项目暂无角色责任数据。';
        return;
      }
      const workbench = document.createElement('div');
      workbench.className = 'team-workbench';
      const side = document.createElement('div');
      side.className = 'team-panel-stack';
      side.append(renderTeamRoleCoveragePanel(board, columns), renderTeamRiskPanel(board));
      workbench.append(renderTeamRoleLanes(columns), side);
      root.append(workbench, renderTeamMemberLanesPanel(board));
    }

    function renderTeamCapacityPanel(board) {
      const panel = document.createElement('section');
      panel.className = 'team-panel team-capacity-panel';
      const title = document.createElement('h3');
      title.textContent = '成员容量矩阵';
      const list = document.createElement('div');
      list.className = 'team-capacity-list';
      const members = [...board.members].sort(compareTeamMemberLanes);
      if (members.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '请先创建团队成员。';
        list.append(empty);
      } else {
        for (const lane of members) list.append(renderTeamCapacityRow(lane));
      }
      panel.append(title, list);
      return panel;
    }

    function renderTeamCapacityRow(lane) {
      const tone = teamMemberCapacityTone(lane);
      const row = document.createElement('div');
      row.className = 'team-capacity-row ' + tone;
      const main = document.createElement('div');
      main.className = 'team-row-main';
      const title = document.createElement('strong');
      title.textContent = lane.member.displayName;
      const detail = document.createElement('p');
      detail.textContent = teamMemberRoleLabel(lane);
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.append(badge(memberTypeLabels[lane.member.memberType] || lane.member.memberType));
      meta.append(badge(memberStatusLabels[lane.member.status] || lane.member.status, lane.member.status === 'active' ? 'ready' : 'warning'));
      if (lane.summary.blockedCount > 0) meta.append(badge('阻塞 ' + String(lane.summary.blockedCount), 'blocking'));
      for (const warning of lane.summary.warnings) {
        meta.append(badge(warningLabels[warning] || warning, warning === 'member_unavailable_with_work' ? 'blocking' : 'warning'));
      }
      main.append(title, detail, meta);
      const meter = document.createElement('div');
      meter.className = 'team-capacity-meter';
      const bar = document.createElement('div');
      bar.className = 'capacity-bar';
      const fill = document.createElement('span');
      const ratio = lane.member.concurrentWorkLimit === 0
        ? 0
        : Math.min(1, lane.summary.assignedCount / lane.member.concurrentWorkLimit);
      fill.style.width = String(Math.round(ratio * 100)) + '%';
      const count = document.createElement('span');
      count.textContent = 'WIP ' + String(lane.summary.assignedCount) + '/' + String(lane.member.concurrentWorkLimit);
      bar.append(fill);
      meter.append(bar, count);
      const stateLabel = lane.summary.overLimit
        ? '超限'
        : lane.member.status === 'active'
          ? '可工作'
          : '不可用';
      row.append(main, meter, badge(stateLabel, tone));
      return row;
    }

    function renderTeamUnassignedPanel(board) {
      const panel = document.createElement('section');
      panel.className = 'team-panel team-unassigned-panel';
      const title = document.createElement('h3');
      title.textContent = '未分配工作';
      const list = document.createElement('div');
      list.className = 'team-assignment-list';
      if (board.unassignedCards.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '当前没有未分配工作。';
        list.append(empty);
      } else {
        for (const card of board.unassignedCards.slice(0, 8)) list.append(renderTeamAssignmentRow(card));
        if (board.unassignedCards.length > 8) list.append(badge('+' + String(board.unassignedCards.length - 8) + ' 更多'));
      }
      panel.append(title, list);
      return panel;
    }

    function renderTeamAssignmentRow(card) {
      const item = card.workItem;
      const row = document.createElement('div');
      row.className = 'team-assignment-row warning';
      const main = document.createElement('div');
      main.className = 'team-row-main';
      const title = document.createElement('strong');
      title.textContent = item.title;
      const detail = document.createElement('p');
      detail.textContent = (typeLabels[item.type] || item.type) + ' · ' + (statusLabels[item.status] || item.status);
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.append(priorityBadge(item.priority));
      if (item.claimedRoleId) meta.append(badge(teamRoleName(item.claimedRoleId), 'workflow'));
      for (const warning of teamWarningBadges(card).slice(0, 3)) {
        meta.append(badge(warningLabels[warning.code] || warning.code, warning.severity));
      }
      main.append(title, detail, meta);
      const open = document.createElement('button');
      open.type = 'button';
      open.textContent = '查看分配';
      open.setAttribute('aria-label', '查看 ' + item.title + ' 的团队分配');
      open.addEventListener('click', () => selectItem(item.id));
      row.append(main, open);
      return row;
    }

    function renderTeamRiskPanel(board) {
      const panel = document.createElement('section');
      panel.className = 'team-panel team-risk-panel';
      const title = document.createElement('h3');
      title.textContent = '容量风险';
      const list = document.createElement('div');
      list.className = 'team-risk-list';
      const items = teamRiskItems(board).slice(0, 8);
      if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '当前没有容量风险。';
        list.append(empty);
      } else {
        for (const item of items) list.append(renderTeamRiskRow(item));
      }
      panel.append(title, list);
      return panel;
    }

    function renderTeamRiskRow(item) {
      const row = document.createElement('div');
      row.className = 'team-risk-row ' + item.tone;
      const main = document.createElement('div');
      main.className = 'team-row-main';
      const title = document.createElement('strong');
      title.textContent = item.title;
      const detail = document.createElement('p');
      detail.textContent = item.detail;
      const meta = document.createElement('div');
      meta.className = 'meta';
      for (const label of item.labels) meta.append(badge(label, item.tone));
      main.append(title, detail, meta);
      row.append(main, badge(item.action, item.tone));
      return row;
    }

    function renderTeamRoleLanes(columns) {
      const panel = document.createElement('section');
      panel.className = 'team-panel team-role-panel';
      const title = document.createElement('h3');
      title.textContent = '角色责任泳道';
      const lanes = document.createElement('div');
      lanes.className = 'team-role-lanes';
      if (columns.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '当前项目暂无角色责任数据。';
        lanes.append(empty);
      } else {
        for (const column of columns) lanes.append(renderTeamRoleLane(column));
      }
      panel.append(title, lanes);
      return panel;
    }

    function renderTeamRoleLane(column) {
      const section = document.createElement('section');
      section.className = 'team-role-lane' + (column.id === 'unclaimed' ? ' warning' : '');
      const members = state.teamMembers.filter((member) => member.roleIds.includes(column.id));
      const header = document.createElement('header');
      const title = document.createElement('strong');
      title.textContent = column.title === 'Unclaimed' ? '未声明角色' : column.title;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.append(badge('工作 ' + String(column.cards.length), column.cards.length > 0 ? 'workflow' : ''));
      meta.append(badge('成员 ' + String(members.length), members.length > 0 ? 'ready' : 'warning'));
      header.append(title, meta);
      const list = document.createElement('div');
      list.className = 'card-list';
      if (column.cards.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '暂无工作项。';
        list.append(empty);
      } else {
        for (const card of column.cards) list.append(renderTeamWorkCard(card));
      }
      section.append(header, list);
      return section;
    }

    function renderTeamRoleCoveragePanel(board, columns) {
      const panel = document.createElement('section');
      panel.className = 'team-panel team-role-coverage-panel';
      const title = document.createElement('h3');
      title.textContent = '角色覆盖';
      const list = document.createElement('div');
      list.className = 'team-role-coverage-list';
      for (const row of teamRoleCoverageRows(board, columns)) list.append(renderTeamRoleCoverageRow(row));
      panel.append(title, list);
      return panel;
    }

    function renderTeamRoleCoverageRow(row) {
      const item = document.createElement('div');
      item.className = 'team-role-coverage-row ' + row.tone;
      const main = document.createElement('div');
      main.className = 'team-row-main';
      const title = document.createElement('strong');
      title.textContent = row.title;
      const detail = document.createElement('p');
      detail.textContent = row.detail;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.append(badge('成员 ' + String(row.memberCount), row.memberCount > 0 ? 'ready' : 'warning'));
      meta.append(badge('可工作 ' + String(row.activeCount), row.activeCount > 0 ? 'ready' : 'warning'));
      main.append(title, detail, meta);
      item.append(main, badge('工作 ' + String(row.cardCount), row.tone === 'ready' ? 'workflow' : row.tone));
      return item;
    }

    function renderTeamMemberLanesPanel(board) {
      const panel = document.createElement('details');
      panel.className = 'team-lanes-panel';
      const summary = document.createElement('summary');
      const title = document.createElement('span');
      title.textContent = '成员工作泳道';
      summary.append(title, badge(String(board.members.length + (board.unassignedCards.length > 0 ? 1 : 0)) + ' lanes'));
      const lanes = document.createElement('div');
      lanes.className = 'team-lanes';
      for (const lane of board.members) lanes.append(renderTeamLane(lane));
      if (board.unassignedCards.length > 0) lanes.append(renderUnassignedTeamLane(board.unassignedCards));
      panel.append(summary, lanes);
      return panel;
    }

    function renderTeamLane(lane) {
      const section = document.createElement('section');
      section.className = 'team-lane' + (lane.summary.overLimit ? ' over-limit' : '');
      const header = document.createElement('header');
      header.innerHTML = '<span class="column-title"></span><span class="meta"></span>';
      header.querySelector('.column-title').textContent = lane.member.displayName;
      const meta = header.querySelector('.meta');
      meta.append(badge(memberTypeLabels[lane.member.memberType] || lane.member.memberType));
      meta.append(badge(memberStatusLabels[lane.member.status] || lane.member.status, lane.member.status === 'active' ? 'ready' : 'warning'));
      meta.append(badge('WIP ' + String(lane.summary.assignedCount) + '/' + String(lane.member.concurrentWorkLimit), lane.summary.overLimit ? 'warning' : ''));
      if (lane.summary.blockedCount > 0) meta.append(badge('阻塞 ' + String(lane.summary.blockedCount), 'blocking'));
      for (const roleName of lane.roleNames) meta.append(badge(roleName, 'workflow'));
      section.append(header);
      const meter = document.createElement('div');
      meter.className = 'team-meter';
      const fill = document.createElement('span');
      const ratio = lane.member.concurrentWorkLimit === 0
        ? 0
        : Math.min(1, lane.summary.assignedCount / lane.member.concurrentWorkLimit);
      fill.style.width = String(Math.round(ratio * 100)) + '%';
      meter.append(fill);
      section.append(meter);
      const list = document.createElement('div');
      list.className = 'card-list';
      if (lane.assignedCards.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '暂无分配工作。';
        list.append(empty);
      } else {
        for (const card of lane.assignedCards) list.append(renderTeamWorkCard(card));
      }
      section.append(list);
      return section;
    }

    function compareTeamMemberLanes(left, right) {
      return teamMemberCapacityToneRank(left) - teamMemberCapacityToneRank(right)
        || right.summary.assignedCount - left.summary.assignedCount
        || left.member.displayName.localeCompare(right.member.displayName, 'zh-Hans-CN');
    }

    function teamMemberCapacityToneRank(lane) {
      const tone = teamMemberCapacityTone(lane);
      if (tone === 'blocking') return 0;
      if (tone === 'warning') return 1;
      return 2;
    }

    function teamMemberCapacityTone(lane) {
      if (lane.summary.overLimit || lane.summary.warnings.includes('member_over_wip_limit')) return 'blocking';
      if (lane.summary.unavailable || lane.member.status !== 'active') return 'warning';
      return 'ready';
    }

    function teamMemberRoleLabel(lane) {
      return lane.roleNames.length > 0 ? lane.roleNames.join(' / ') : '未绑定角色';
    }

    function teamRoleName(roleId) {
      const project = currentProject();
      const role = project ? (project.roles || []).find((item) => item.id === roleId) : null;
      return role ? role.displayName : String(roleId);
    }

    function teamRiskItems(board) {
      const items = [];
      if (board.unassignedCards.length > 0) {
        items.push({
          title: '未分配工作',
          detail: String(board.unassignedCards.length) + ' 个工作项没有负责人，不能稳定进入并发交付。',
          labels: ['待分配 ' + String(board.unassignedCards.length)],
          tone: 'warning',
          action: '派活',
        });
      }
      const representedWarningCodes = new Set(board.unassignedCards.length > 0 ? ['unassigned_work'] : []);
      for (const lane of board.members) {
        if (lane.summary.overLimit) {
          representedWarningCodes.add('member_over_wip_limit');
          items.push({
            title: lane.member.displayName,
            detail: '当前 WIP 已超过成员并发上限。',
            labels: ['WIP ' + String(lane.summary.assignedCount) + '/' + String(lane.member.concurrentWorkLimit)],
            tone: 'blocking',
            action: '减载',
          });
        }
        if (lane.member.status !== 'active' && lane.summary.assignedCount > 0) {
          items.push({
            title: lane.member.displayName,
            detail: '不可工作成员仍然挂有任务。',
            labels: [memberStatusLabels[lane.member.status] || lane.member.status, '工作 ' + String(lane.summary.assignedCount)],
            tone: 'blocking',
            action: '改派',
          });
        }
        if (lane.summary.blockedCount > 0) {
          items.push({
            title: lane.member.displayName,
            detail: '成员名下存在阻塞工作，需要先清理依赖或门禁。',
            labels: ['阻塞 ' + String(lane.summary.blockedCount)],
            tone: 'warning',
            action: '跟进',
          });
        }
      }
      for (const warning of board.warnings) {
        if (representedWarningCodes.has(warning.code)) continue;
        const tone = warning.severity === 'blocking' ? 'blocking' : 'warning';
        items.push({
          title: warningLabels[warning.code] || warning.code,
          detail: warning.message || '团队容量存在需要处理的异常。',
          labels: [warningLabels[warning.code] || warning.code],
          tone,
          action: '检查',
        });
      }
      return items;
    }

    function teamRoleCoverageRows(board, columns) {
      const project = currentProject();
      const columnById = new Map(columns.map((column) => [column.id, column]));
      const roles = project ? project.roles || [] : [];
      const rows = roles.map((role) => {
        const members = board.members.filter((lane) => lane.member.roleIds.includes(role.id));
        const activeCount = members.filter((lane) => lane.member.status === 'active').length;
        const cardCount = columnById.get(role.id)?.cards.length || 0;
        return {
          title: role.displayName,
          memberCount: members.length,
          activeCount,
          cardCount,
          detail: members.length === 0
            ? '该角色没有绑定成员。'
            : members.map((lane) => lane.member.displayName).join(' / '),
          tone: members.length === 0 || (cardCount > 0 && activeCount === 0) ? 'warning' : 'ready',
        };
      });
      const unclaimedCount = columnById.get('unclaimed')?.cards.length || 0;
      rows.push({
        title: '未声明角色',
        memberCount: 0,
        activeCount: 0,
        cardCount: unclaimedCount,
        detail: unclaimedCount > 0 ? '存在没有声明角色的工作项。' : '没有未声明角色的工作项。',
        tone: unclaimedCount > 0 ? 'warning' : 'ready',
      });
      return rows;
    }

    function renderUnassignedTeamLane(cards) {
      const section = document.createElement('section');
      section.className = 'team-lane';
      const header = document.createElement('header');
      header.innerHTML = '<span class="column-title"></span><span class="meta"></span>';
      header.querySelector('.column-title').textContent = '未分配';
      header.querySelector('.meta').append(badge('待认领', 'warning'), badge(String(cards.length)));
      section.append(header);
      const list = document.createElement('div');
      list.className = 'card-list';
      for (const card of cards) list.append(renderTeamWorkCard(card));
      section.append(list);
      return section;
    }

    function renderWorkflowBoard(root) {
      const board = state.mainBoard ? state.mainBoard.workflowBoard : null;
      root.className = 'workflow-board';
      if (!board) {
        root.className = 'empty';
        root.textContent = '当前项目暂无工作流摘要。';
        return;
      }
      const workbench = document.createElement('div');
      workbench.className = 'workflow-workbench';
      const side = document.createElement('div');
      side.className = 'workflow-panel-stack';
      side.append(
        renderWorkflowStoryQueue(workflowStoryQueue(board)),
        renderWorkflowBlockerPanel(board),
        renderWorkflowSupportDrawer(board),
      );
      workbench.append(renderWorkflowLifecycleLanes(board), side);
      root.append(workbench, renderWorkflowLanesPanel(board));
    }

    function renderWorkflowBoardSummary(board) {
      const queue = workflowStoryQueue(board);
      const coverage = workflowLifecycleCoverage(board);
      const summary = document.createElement('div');
      summary.className = 'workflow-board-summary';
      summary.append(
        metric(String(coverage.totalLanes), '敏捷泳道'),
        metric(String(coverage.occupiedLanes), '有工作泳道'),
        metric(String(queue.readyStoryIds.length), 'Ready Story'),
        metric(String(board.activeWorkflows || 0), '活动运行'),
        metric(String(coverage.blockedCards || board.blockedWorkflows || 0), '阻塞工作'),
        metric(String(coverage.missingEvidenceCards || 0), '证据缺口'),
        metric(String(board.failedChecks || 0), '失败检查'),
      );
      return summary;
    }

    function renderWorkflowLifecycleLanes(board) {
      const panel = document.createElement('section');
      panel.className = 'workflow-panel agile-lifecycle-panel';
      const coverage = workflowLifecycleCoverage(board);
      const header = document.createElement('header');
      header.innerHTML = '<div><h3></h3><p></p></div><span class="meta"></span>';
      header.querySelector('h3').textContent = '敏捷生命周期泳道';
      header.querySelector('p').textContent = '按录入、分析、设计、拆分、计划、开发、评审、验证、门禁和交付查看需求进展。';
      const meta = header.querySelector('.meta');
      meta.append(
        badge(String(coverage.occupiedLanes) + '/' + String(coverage.totalLanes) + ' 有工作', 'workflow'),
        badge(
          coverage.unmappedStatuses.length === 0
            ? '状态全覆盖'
            : '未映射 ' + String(coverage.unmappedStatuses.length),
          coverage.unmappedStatuses.length === 0 ? 'ready' : 'blocking',
        ),
      );
      const lanes = document.createElement('div');
      lanes.className = 'agile-lifecycle-lanes';
      const lifecycleLanes = board.lifecycleLanes || [];
      if (lifecycleLanes.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '当前项目暂无生命周期泳道数据。';
        lanes.append(empty);
      } else {
        for (const lane of lifecycleLanes) lanes.append(renderWorkflowLifecycleLane(lane));
      }
      panel.append(header, lanes);
      return panel;
    }

    function renderWorkflowLifecycleLane(lane) {
      const section = document.createElement('section');
      section.className = 'agile-lifecycle-lane ' + workflowLifecycleLaneTone(lane);
      const header = document.createElement('header');
      const title = document.createElement('strong');
      title.textContent = lane.title;
      const detail = document.createElement('p');
      detail.textContent = lane.description;
      const meta = document.createElement('div');
      meta.className = 'workflow-row-meta';
      meta.append(
        badge(lane.owner, 'workflow'),
        badge('状态 ' + workflowStatusListLabel(lane.statuses)),
        badge(
          lane.evidenceAreas.length === 0
            ? '阶段证据按规则继承'
            : '证据 ' + lane.evidenceAreas.map((area) => evidenceAreaLabels[area] || area).join('/'),
          lane.missingEvidenceCards > 0 ? 'blocking' : '',
        ),
      );
      header.append(title, detail, meta);
      const body = document.createElement('div');
      body.className = 'agile-lifecycle-lane-body';
      if (lane.cards.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '暂无工作项。';
        body.append(empty);
      } else {
        for (const item of lane.cards.slice(0, 5)) body.append(renderWorkflowLifecycleCard(item));
        if (lane.cards.length > 5) body.append(badge('+' + String(lane.cards.length - 5) + ' 更多'));
      }
      section.append(header, body);
      return section;
    }

    function renderWorkflowLifecycleCard(item) {
      const card = item.card;
      const workItem = card.workItem;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'agile-lifecycle-card ' + (hasWorkflowCardBlocker(item) ? 'blocking' : '');
      const title = document.createElement('strong');
      title.textContent = workItem.title;
      const detail = document.createElement('p');
      detail.textContent = (typeLabels[workItem.type] || workItem.type) + ' · '
        + (statusLabels[workItem.status] || workItem.status) + ' · '
        + workflowDecisionReason(item.summary, item.schedulerReason);
      const meta = document.createElement('div');
      meta.className = 'workflow-row-meta';
      meta.append(
        priorityBadge(workItem.priority),
        badge(workflowRunStatusLabels[item.summary.runStatus] || item.summary.runStatus),
      );
      if (item.summary.activeOwner) meta.append(badge(item.summary.activeOwner, 'workflow'));
      for (const label of workflowCardLifecycleSignals(item).slice(0, 4)) meta.append(label);
      button.append(title, detail, meta);
      button.addEventListener('click', () => selectItem(workItem.id));
      return button;
    }

    function workflowLifecycleLaneTone(lane) {
      if (lane.blockedCards > 0) return 'blocking';
      if (lane.missingEvidenceCards > 0) return 'gap';
      if (lane.totalCards > 0 && lane.totalCards === lane.readyCards) return 'ready';
      return '';
    }

    function workflowCardLifecycleSignals(item) {
      const labels = [];
      if (item.summary.waitingApprovals.length > 0) {
        labels.push(badge('审批 ' + String(item.summary.waitingApprovals.length), 'warning'));
      }
      if (item.summary.waitingReviews.length > 0) {
        labels.push(badge('评审 ' + String(item.summary.waitingReviews.length), 'warning'));
      }
      if (item.summary.blockedSteps.length > 0) {
        labels.push(badge('步骤阻塞 ' + String(item.summary.blockedSteps.length), 'blocking'));
      }
      if (item.summary.failedChecks.length > 0) {
        labels.push(badge('检查失败 ' + String(item.summary.failedChecks.length), 'blocking'));
      }
      return labels;
    }

    function hasWorkflowCardBlocker(item) {
      return item.blockedReasonCodes.length > 0 ||
        item.summary.runStatus === 'blocked' ||
        item.summary.blockedSteps.length > 0 ||
        item.summary.failedChecks.length > 0;
    }

    function workflowStatusListLabel(statuses) {
      return statuses.map((status) => statusLabels[status] || status).join('/');
    }

    function workflowLifecycleCoverage(board) {
      const coverage = board.lifecycleCoverage || {};
      return {
        totalLanes: coverage.totalLanes || (board.lifecycleLanes || []).length,
        occupiedLanes: coverage.occupiedLanes || 0,
        totalCards: coverage.totalCards || 0,
        blockedCards: coverage.blockedCards || 0,
        missingEvidenceCards: coverage.missingEvidenceCards || 0,
        mappedStatuses: coverage.mappedStatuses || [],
        unmappedStatuses: coverage.unmappedStatuses || [],
      };
    }

    function renderWorkflowRunway(board) {
      const panel = document.createElement('section');
      panel.className = 'workflow-panel workflow-runway-panel';
      const title = document.createElement('h3');
      title.textContent = 'Story 调度摘要';
      const track = document.createElement('div');
      track.className = 'workflow-stage-track';
      for (const row of workflowStageRows(board)) track.append(renderWorkflowStageNode(row));
      panel.append(title, track);
      return panel;
    }

    function renderWorkflowStageNode(row) {
      const item = document.createElement('div');
      item.className = 'workflow-stage-node ' + row.tone;
      const count = document.createElement('span');
      count.className = 'workflow-stage-count';
      count.textContent = String(row.count);
      const title = document.createElement('strong');
      title.textContent = row.label;
      const detail = document.createElement('p');
      detail.textContent = row.detail;
      const meta = document.createElement('div');
      meta.className = 'workflow-row-meta';
      for (const label of row.meta) meta.append(badge(label, row.tone));
      item.append(count, title, detail, meta);
      return item;
    }

    function workflowStageRows(board) {
      const queue = workflowStoryQueue(board);
      const summaries = board.summaries || [];
      const waiting = (board.waitingApprovals || 0) + (board.waitingReviews || 0);
      const running = summaries.filter((item) => ['queued', 'running'].includes(item.summary.runStatus)).length;
      const verifying = summaries.filter((item) => ['in_review', 'verifying'].includes(item.summary.runStatus)).length;
      const completed = summaries.filter((item) => item.summary.runStatus === 'completed').length;
      return [
        {
          label: '候选排序',
          count: queue.items.length,
          detail: '按优先级、里程碑、风险和阻塞原因选择下一条 Story。',
          tone: queue.skippedStoryIds.length > 0 ? 'warning' : 'ready',
          meta: ['Ready ' + String(queue.readyStoryIds.length), 'Skipped ' + String(queue.skippedStoryIds.length)],
        },
        {
          label: '启动条件',
          count: queue.readyStoryIds.length,
          detail: 'DoR、负责人、审批、技能、工具和容量满足后才能启动。',
          tone: queue.readyStoryIds.length > 0 ? 'ready' : 'warning',
          meta: ['Active ' + String(queue.activeStoryIds.length), 'WIP 受控'],
        },
        {
          label: '实现执行',
          count: running,
          detail: 'Developer 或 Agent 执行子任务，并把代码、说明和证据绑定回来。',
          tone: running > 0 ? 'active' : '',
          meta: ['Queued/Running'],
        },
        {
          label: '角色交接',
          count: waiting,
          detail: '审批和评审由角色事件触发，并在状态与 owner 切换后完成。',
          tone: waiting > 0 ? 'warning' : 'ready',
          meta: ['Approval ' + String(board.waitingApprovals || 0), 'Review ' + String(board.waitingReviews || 0)],
        },
        {
          label: '验证门禁',
          count: verifying + (board.failedChecks || 0),
          detail: 'Review、CI、安全、可靠性和可信检查通过后才能进入交付结论。',
          tone: (board.failedChecks || 0) > 0 ? 'blocking' : verifying > 0 ? 'active' : 'ready',
          meta: ['Failed ' + String(board.failedChecks || 0), 'Verify ' + String(verifying)],
        },
        {
          label: '完成交付',
          count: completed,
          detail: 'Definition of Done 证明完整后，Story 才能被标记为 delivered。',
          tone: completed > 0 ? 'ready' : '',
          meta: ['DoD gated'],
        },
      ];
    }

    function renderWorkflowStoryQueue(queue) {
      const section = document.createElement('section');
      section.className = 'workflow-panel';
      const header = document.createElement('header');
      header.innerHTML = '<h3></h3><span class="meta"></span>';
      header.querySelector('h3').textContent = 'Story 优先级队列';
      header.querySelector('.meta').append(
        badge('Ready ' + String(queue.readyStoryIds.length), 'ready'),
        badge('Skipped ' + String(queue.skippedStoryIds.length), queue.skippedStoryIds.length > 0 ? 'warning' : ''),
      );
      const rows = document.createElement('div');
      rows.className = 'workflow-queue';
      if (queue.items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '当前项目暂无可调度 Story。';
        rows.append(empty);
      } else {
        for (const item of queue.items.slice(0, 8)) rows.append(renderWorkflowStoryQueueRow(item));
      }
      section.append(header, rows);
      return section;
    }

    function renderWorkflowStoryQueueRow(item) {
      const workflowSummary = item.workflowSummary || { runStatus: 'not_started' };
      const blockedReasons = item.blockedReasons || [];
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'workflow-queue-row '
        + (item.active ? 'active' : item.ready ? 'ready' : 'blocked');
      const main = document.createElement('div');
      main.className = 'workflow-row-main';
      const title = document.createElement('strong');
      title.textContent = item.title;
      const detail = document.createElement('p');
      detail.textContent = '#' + String(item.rank) + ' · '
        + (statusLabels[item.status] || item.status) + ' · ' + workflowDecisionReason(workflowSummary, item.schedulerReason);
      const meta = document.createElement('div');
      meta.className = 'workflow-row-meta';
      meta.append(badge(item.ready ? 'Ready' : 'Skipped', item.ready ? 'ready' : 'warning'));
      if (item.active) meta.append(badge('Active', 'workflow'));
      meta.append(priorityBadge(item.priority));
      meta.append(badge(workflowRunStatusLabels[workflowSummary.runStatus] || workflowSummary.runStatus));
      if (blockedReasons.length > 0) {
        for (const code of blockedReasons.slice(0, 4)) {
          meta.append(badge(warningLabels[code] || code, 'warning'));
        }
        if (blockedReasons.length > 4) meta.append(badge('+' + String(blockedReasons.length - 4)));
      }
      main.append(title, detail, meta);
      row.append(main, badge(item.ready ? '可启动' : '待补齐', item.ready ? 'ready' : 'warning'));
      row.addEventListener('click', () => selectItem(item.workItemId));
      return row;
    }

    function renderWorkflowHandoffPanel(board) {
      const panel = document.createElement('section');
      panel.className = 'workflow-panel';
      const title = document.createElement('h3');
      title.textContent = '角色交接与等待';
      const list = document.createElement('div');
      list.className = 'workflow-handoff-list';
      const items = workflowHandoffItems(board).slice(0, 6);
      if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '当前没有等待交接、审批或评审的运行。';
        list.append(empty);
      } else {
        for (const item of items) list.append(renderWorkflowHandoffRow(item));
      }
      panel.append(title, list);
      return panel;
    }

    function renderWorkflowHandoffRow(item) {
      const summary = item.summary;
      const row = document.createElement('div');
      row.className = 'workflow-handoff-row ' + (summary.runningSteps.length > 0 ? 'active' : '');
      const main = document.createElement('div');
      main.className = 'workflow-row-main';
      const title = document.createElement('strong');
      title.textContent = item.card.workItem.title;
      const detail = document.createElement('p');
      detail.textContent = workflowOwnerLabel(summary) + ' · ' + workflowDecisionReason(summary, item.schedulerReason);
      const meta = document.createElement('div');
      meta.className = 'workflow-row-meta';
      if (summary.activeRoleId) meta.append(badge(String(summary.activeRoleId), 'workflow'));
      if (summary.activeOwner) meta.append(badge(summary.activeOwner));
      if (summary.runningSteps.length > 0) meta.append(badge('执行 ' + String(summary.runningSteps.length), 'workflow'));
      if (summary.waitingApprovals.length > 0) meta.append(badge('审批 ' + String(summary.waitingApprovals.length), 'warning'));
      if (summary.waitingReviews.length > 0) meta.append(badge('评审 ' + String(summary.waitingReviews.length), 'warning'));
      if (summary.blockedSteps.length > 0) meta.append(badge('阻塞 ' + String(summary.blockedSteps.length), 'blocking'));
      main.append(title, detail, meta);
      const open = document.createElement('button');
      open.type = 'button';
      open.textContent = '打开';
      open.addEventListener('click', () => selectItem(item.card.workItem.id));
      row.append(main, open);
      return row;
    }

    function renderWorkflowBlockerPanel(board) {
      const panel = document.createElement('section');
      panel.className = 'workflow-panel';
      const title = document.createElement('h3');
      title.textContent = '阻塞与门禁';
      const list = document.createElement('div');
      list.className = 'workflow-blocker-list';
      const items = workflowBlockedItems(board).slice(0, 6);
      if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '当前没有工作流阻塞或失败检查。';
        list.append(empty);
      } else {
        for (const item of items) list.append(renderWorkflowBlockerRow(item));
      }
      panel.append(title, list);
      return panel;
    }

    function renderWorkflowBlockerRow(item) {
      const labels = workflowBlockerLabels(item);
      const row = document.createElement('div');
      row.className = 'workflow-blocker-row blocking';
      const main = document.createElement('div');
      main.className = 'workflow-row-main';
      const title = document.createElement('strong');
      title.textContent = item.card.workItem.title;
      const detail = document.createElement('p');
      detail.textContent = workflowDecisionReason(item.summary, item.schedulerReason);
      const meta = document.createElement('div');
      meta.className = 'workflow-row-meta';
      for (const label of labels.slice(0, 5)) meta.append(badge(label, 'blocking'));
      if (labels.length > 5) meta.append(badge('+' + String(labels.length - 5)));
      main.append(title, detail, meta);
      const open = document.createElement('button');
      open.type = 'button';
      open.textContent = '打开';
      open.addEventListener('click', () => selectItem(item.card.workItem.id));
      row.append(main, open);
      return row;
    }

    function renderWorkflowLanesPanel(board) {
      const panel = document.createElement('details');
      panel.className = 'workflow-lanes-panel';
      const summary = document.createElement('summary');
      const title = document.createElement('span');
      title.textContent = '运行状态泳道';
      summary.append(title, badge(String(board.lanes.length) + ' lanes'));
      const lanes = document.createElement('div');
      lanes.className = 'workflow-lanes';
      for (const lane of board.lanes) lanes.append(renderWorkflowLane(lane));
      panel.append(summary, lanes);
      return panel;
    }

    function renderWorkflowSupportDrawer(board) {
      const drawer = document.createElement('details');
      drawer.className = 'workflow-support-drawer';
      const summary = document.createElement('summary');
      summary.append(
        document.createTextNode('调度摘要与角色交接'),
        badge('诊断'),
      );
      const body = document.createElement('div');
      body.className = 'workflow-support-drawer-body';
      body.append(renderWorkflowRunway(board), renderWorkflowHandoffPanel(board));
      drawer.append(summary, body);
      return drawer;
    }

    function workflowStoryQueue(board) {
      const queue = board.storyQueue || {};
      return {
        items: queue.items || [],
        readyStoryIds: queue.readyStoryIds || [],
        skippedStoryIds: queue.skippedStoryIds || [],
        activeStoryIds: queue.activeStoryIds || [],
        warnings: queue.warnings || [],
      };
    }

    function workflowHandoffItems(board) {
      return [...(board.summaries || [])]
        .filter((item) =>
          item.summary.activeOwner ||
          item.summary.activeRoleId ||
          item.summary.runningSteps.length > 0 ||
          item.summary.waitingApprovals.length > 0 ||
          item.summary.waitingReviews.length > 0 ||
          item.summary.blockedSteps.length > 0)
        .sort(compareWorkflowItems);
    }

    function workflowBlockedItems(board) {
      return [...(board.summaries || [])]
        .filter((item) =>
          item.blockedReasonCodes.length > 0 ||
          item.summary.failedChecks.length > 0 ||
          item.summary.blockedSteps.length > 0)
        .sort(compareWorkflowItems);
    }

    function compareWorkflowItems(left, right) {
      return (priorityOrder[left.card.workItem.priority] ?? 9) - (priorityOrder[right.card.workItem.priority] ?? 9)
        || (statusOrder[left.card.workItem.status] ?? 99) - (statusOrder[right.card.workItem.status] ?? 99)
        || left.card.workItem.title.localeCompare(right.card.workItem.title);
    }

    function workflowOwnerLabel(summary) {
      if (summary.activeOwner && summary.activeRoleId) return summary.activeOwner + ' / ' + String(summary.activeRoleId);
      if (summary.activeOwner) return summary.activeOwner;
      if (summary.activeRoleId) return String(summary.activeRoleId);
      return '等待调度器分配 owner';
    }

    function workflowDecisionReason(summary, fallback) {
      return summary.schedulerReason || fallback || summary.nextAction || summary.downstreamImpact || '等待调度器更新。';
    }

    function workflowBlockerLabels(item) {
      const summary = item.summary;
      const labels = [
        ...(item.blockedReasonCodes || []).map((code) => warningLabels[code] || code),
        ...summary.waitingApprovals.map((wait) => '审批: ' + wait.title),
        ...summary.waitingReviews.map((wait) => '评审: ' + wait.title),
        ...summary.blockedSteps.map((step) => '步骤: ' + step.title),
        ...summary.failedChecks.map((check) => '检查: ' + check.title),
      ];
      return [...new Set(labels)];
    }

    function renderWorkflowLane(lane) {
      const section = document.createElement('section');
      section.className = 'workflow-lane';
      const header = document.createElement('header');
      header.innerHTML = '<span class="column-title"></span><span class="meta"></span>';
      header.querySelector('.column-title').textContent = workflowRunStatusLabels[lane.id] || lane.title;
      header.querySelector('.meta').append(badge(String(lane.cards.length)));
      section.append(header);
      const list = document.createElement('div');
      list.className = 'card-list';
      if (lane.cards.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '暂无工作项。';
        list.append(empty);
      } else {
        for (const item of lane.cards) {
          const card = renderCard(item.card);
          card.title = item.schedulerReason;
          list.append(card);
        }
      }
      section.append(list);
      return section;
    }

    function renderEvidenceBoard(root) {
      const board = state.mainBoard ? state.mainBoard.evidenceBoard : null;
      root.className = 'evidence-board';
      if (!board) {
        root.className = 'empty';
        root.textContent = '当前项目暂无交付证据摘要。';
        return;
      }
      const workbench = document.createElement('div');
      workbench.className = 'evidence-workbench';
      const rightColumn = document.createElement('div');
      rightColumn.className = 'evidence-panel-stack';
      rightColumn.append(renderEvidenceBlockerQueue(board), renderEvidenceGovernanceQueue(board));
      workbench.append(renderEvidenceMatrix(board), rightColumn);
      root.append(workbench, renderEvidenceLanesPanel(board));
    }

    function renderEvidenceBoardSummary(board) {
      const rollup = board.rollup || {};
      const summary = document.createElement('div');
      summary.className = 'evidence-board-summary';
      summary.append(
        metric(String((rollup.readyWorkItemIds || []).length) + '/' + String(rollup.totalWorkItems || 0), '可交付'),
        metric(String((rollup.blockedWorkItemIds || []).length), '阻塞项'),
        metric(String(rollup.workItemsWithPullRequests || 0), '有 PR'),
        metric(String(rollup.workItemsWithCi || 0), '有 CI'),
        metric(String((rollup.unapprovedObligations || 0) + (rollup.openRiskAcceptances || 0)), '治理待办'),
      );
      return summary;
    }

    function renderEvidenceMatrix(board) {
      const panel = document.createElement('section');
      panel.className = 'evidence-panel evidence-matrix-panel';
      const title = document.createElement('h3');
      title.textContent = '证据缺口矩阵';
      const matrix = document.createElement('div');
      matrix.className = 'evidence-matrix';
      for (const row of evidenceMatrixRows(board)) matrix.append(renderEvidenceMatrixRow(row));
      panel.append(title, matrix);
      return panel;
    }

    function renderEvidenceMatrixRow(row) {
      const item = document.createElement('div');
      item.className = 'evidence-matrix-row';
      const main = document.createElement('div');
      main.className = 'evidence-row-main';
      const label = document.createElement('strong');
      label.textContent = row.label;
      const detail = document.createElement('p');
      detail.textContent = row.detail;
      main.append(label, detail);
      const meter = document.createElement('div');
      meter.className = 'evidence-meter';
      const track = document.createElement('div');
      track.className = 'evidence-meter-track';
      const fill = document.createElement('div');
      fill.className = 'evidence-meter-fill';
      fill.style.width = String(row.percent) + '%';
      const count = document.createElement('span');
      count.textContent = row.total === 0
        ? '无配置'
        : String(row.ready) + '/' + String(row.total) + ' Ready';
      track.append(fill);
      meter.append(track, count);
      const tone = row.total === 0 ? '' : row.gap === 0 ? 'ready' : 'blocking';
      const statusLabel = row.total === 0 ? '未配置' : row.gap === 0 ? 'Ready' : '缺口 ' + String(row.gap);
      item.append(main, meter, badge(statusLabel, tone));
      return item;
    }

    function evidenceMatrixRows(board) {
      const summaries = board.summaries || [];
      return [
        evidenceMatrixRow(
          summaries,
          'acceptance',
          '验收覆盖',
          (item) => requiresAcceptanceEvidenceForCard(item.card),
          (item) => item.card.acceptanceRollup.totalCriteria > 0 && item.card.acceptanceRollup.complete,
        ),
        evidenceMatrixRow(
          summaries,
          'code',
          '代码证据',
          (item) => requiresImplementationEvidenceForCard(item.card),
          (item) => item.card.evidenceSummary.codeLinkCount + item.card.evidenceSummary.pullRequestCount > 0,
        ),
        evidenceMatrixRow(
          summaries,
          'review',
          '评审证据',
          (item) => requiresImplementationEvidenceForCard(item.card),
          (item) => item.card.evidenceSummary.reviewCount > 0,
        ),
        evidenceMatrixRow(
          summaries,
          'ci',
          'CI 验证',
          (item) => requiresImplementationEvidenceForCard(item.card),
          (item) => item.card.evidenceSummary.ciRunCount > 0,
        ),
        evidenceMatrixRow(
          summaries,
          'required-checks',
          '必需检查',
          (item) => item.card.evidenceSummary.requiredChecks > 0,
          (item) => requiredEvidenceBlockCount(item.card.evidenceSummary) === 0,
        ),
        evidenceMatrixRow(
          summaries,
          'security',
          '安全门禁',
          (item) => hasEvidenceAreaChecks(item.card, 'security'),
          (item) => evidenceAreaBlockCount(item.card, 'security') === 0,
        ),
        evidenceMatrixRow(
          summaries,
          'reliability',
          '可靠性门禁',
          (item) => hasEvidenceAreaChecks(item.card, 'reliability'),
          (item) => evidenceAreaBlockCount(item.card, 'reliability') === 0,
        ),
        evidenceMatrixRow(
          summaries,
          'trust',
          '可信门禁',
          (item) => hasEvidenceAreaChecks(item.card, 'trust'),
          (item) => evidenceAreaBlockCount(item.card, 'trust') === 0,
        ),
        evidenceMatrixRow(
          summaries,
          'governance',
          '治理风险',
          (item) => item.card.governanceSummary.required || governanceBlockCount(item.card.governanceSummary) > 0,
          (item) => governanceBlockCount(item.card.governanceSummary) === 0,
        ),
      ];
    }

    function evidenceMatrixRow(summaries, id, label, relevant, ready) {
      const scoped = summaries.filter(relevant);
      const readyCount = scoped.filter(ready).length;
      const gap = scoped.length - readyCount;
      return {
        id,
        label,
        ready: readyCount,
        total: scoped.length,
        gap,
        percent: scoped.length === 0 ? 100 : Math.round((readyCount / scoped.length) * 100),
        detail: evidenceMatrixDetail(id, scoped.length, gap),
      };
    }

    function evidenceMatrixDetail(id, total, gap) {
      const labels = {
        acceptance: '需求/Story 的验收标准必须被覆盖。',
        code: '实现类工作需要提交代码或 PR 链接。',
        review: '实现类工作需要保留代码评审结论。',
        ci: '实现类工作需要 CI run 或等效验证。',
        'required-checks': '配置为必需的检查必须通过或豁免。',
        security: '安全检查缺失、失败或阻塞时不能交付。',
        reliability: '可靠性检查缺失、失败或阻塞时不能交付。',
        trust: '可信检查缺失、失败或阻塞时不能交付。',
        governance: '义务待审或风险待接受会阻塞交付。',
      };
      if (total === 0) return labels[id] + ' 当前项目没有配置该类门禁。';
      if (gap === 0) return labels[id] + ' 当前范围全部 Ready。';
      return labels[id] + ' 仍有 ' + String(gap) + ' 个工作项存在缺口。';
    }

    function renderEvidenceBlockerQueue(board) {
      const panel = document.createElement('section');
      panel.className = 'evidence-panel';
      const title = document.createElement('h3');
      title.textContent = '阻塞队列';
      const queue = document.createElement('div');
      queue.className = 'evidence-queue';
      const items = evidenceQueueItems(board).slice(0, 8);
      if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '当前没有证据阻塞项。';
        queue.append(empty);
      } else {
        for (const item of items) queue.append(renderEvidenceQueueRow(item));
      }
      panel.append(title, queue);
      return panel;
    }

    function renderEvidenceQueueRow(item) {
      const card = item.card;
      const workItem = card.workItem;
      const gaps = evidenceGapLabels(item);
      const row = document.createElement('div');
      row.className = 'evidence-queue-row ' + (gaps.length > 0 ? 'blocking' : '');
      const main = document.createElement('div');
      main.className = 'evidence-row-main';
      const title = document.createElement('strong');
      title.textContent = workItem.title;
      const detail = document.createElement('p');
      detail.textContent = (typeLabels[workItem.type] || workItem.type) + ' · '
        + (statusLabels[workItem.status] || workItem.status) + ' · ' + evidenceNextAction(gaps);
      const meta = document.createElement('div');
      meta.className = 'meta';
      for (const gap of gaps.slice(0, 5)) meta.append(badge(gap, 'blocking'));
      if (gaps.length > 5) meta.append(badge('+' + String(gaps.length - 5)));
      main.append(title, detail, meta);
      const open = document.createElement('button');
      open.type = 'button';
      open.textContent = '打开';
      open.addEventListener('click', () => selectItem(workItem.id));
      row.append(main, open);
      return row;
    }

    function renderEvidenceGovernanceQueue(board) {
      const panel = document.createElement('section');
      panel.className = 'evidence-panel';
      const title = document.createElement('h3');
      title.textContent = '治理风险队列';
      const list = document.createElement('div');
      list.className = 'evidence-governance-list';
      const items = evidenceGovernanceItems(board).slice(0, 6);
      if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '当前没有治理阻塞或风险接受事项。';
        list.append(empty);
      } else {
        for (const item of items) list.append(renderEvidenceGovernanceRow(item));
      }
      panel.append(title, list);
      return panel;
    }

    function renderEvidenceGovernanceRow(item) {
      const card = item.card;
      const governance = card.governanceSummary;
      const row = document.createElement('div');
      row.className = 'evidence-governance-row blocking';
      const main = document.createElement('div');
      main.className = 'evidence-row-main';
      const title = document.createElement('strong');
      title.textContent = card.workItem.title;
      const detail = document.createElement('p');
      detail.textContent = String(governance.unapprovedObligations) + ' 个义务待审，'
        + String(governance.openRiskAcceptances) + ' 个风险待接受，'
        + String(governance.blockers.length) + ' 个治理阻塞。';
      const meta = document.createElement('div');
      meta.className = 'meta';
      for (const blocker of governance.blockers.slice(0, 4)) meta.append(badge(blocker, 'blocking'));
      if (governance.blockers.length > 4) meta.append(badge('+' + String(governance.blockers.length - 4)));
      main.append(title, detail, meta);
      const open = document.createElement('button');
      open.type = 'button';
      open.textContent = '打开';
      open.addEventListener('click', () => selectItem(card.workItem.id));
      row.append(main, open);
      return row;
    }

    function renderEvidenceLanesPanel(board) {
      const panel = document.createElement('details');
      panel.className = 'evidence-lanes-panel';
      const summary = document.createElement('summary');
      const title = document.createElement('span');
      title.textContent = '状态泳道';
      summary.append(title, badge(String(board.lanes.length) + ' lanes'));
      const lanes = document.createElement('div');
      lanes.className = 'evidence-lanes';
      for (const lane of board.lanes) lanes.append(renderEvidenceLane(lane));
      panel.append(summary, lanes);
      return panel;
    }

    function evidenceQueueItems(board) {
      return [...(board.summaries || [])]
        .map((item) => ({ ...item, gaps: evidenceGapLabels(item) }))
        .filter((item) => item.gaps.length > 0)
        .sort(compareEvidenceItems);
    }

    function evidenceGovernanceItems(board) {
      return [...(board.summaries || [])]
        .filter((item) => governanceBlockCount(item.card.governanceSummary) > 0)
        .sort(compareEvidenceItems);
    }

    function compareEvidenceItems(left, right) {
      const laneRank = { blocked: 0, missing: 1, pending: 2, passing: 3 };
      return (laneRank[left.laneId] ?? 9) - (laneRank[right.laneId] ?? 9)
        || right.gaps?.length - left.gaps?.length
        || (priorityOrder[left.card.workItem.priority] ?? 9) - (priorityOrder[right.card.workItem.priority] ?? 9)
        || (statusOrder[left.card.workItem.status] ?? 9) - (statusOrder[right.card.workItem.status] ?? 9)
        || left.card.workItem.title.localeCompare(right.card.workItem.title);
    }

    function evidenceGapLabels(item) {
      const card = item.card;
      const evidence = card.evidenceSummary;
      const governance = card.governanceSummary;
      const gaps = [];
      if (
        requiresAcceptanceEvidenceForCard(card) &&
        (card.acceptanceRollup.totalCriteria === 0 || !card.acceptanceRollup.complete)
      ) {
        gaps.push('验收覆盖');
      }
      if (
        requiresImplementationEvidenceForCard(card) &&
        evidence.codeLinkCount + evidence.pullRequestCount === 0
      ) {
        gaps.push('代码');
      }
      if (requiresImplementationEvidenceForCard(card) && evidence.reviewCount === 0) gaps.push('Review');
      if (requiresImplementationEvidenceForCard(card) && evidence.ciRunCount === 0) gaps.push('CI');
      if (evidence.missingRequiredChecks > 0) gaps.push('缺必需检查 ' + String(evidence.missingRequiredChecks));
      if (evidence.pendingChecks > 0) gaps.push('待处理检查 ' + String(evidence.pendingChecks));
      if (evidence.failedRequiredChecks + evidence.blockedRequiredChecks > 0) {
        gaps.push('失败/阻塞检查 ' + String(evidence.failedRequiredChecks + evidence.blockedRequiredChecks));
      }
      for (const area of ['security', 'reliability', 'trust']) {
        const blocks = evidenceAreaBlockCount(card, area);
        if (blocks > 0) gaps.push((evidenceAreaLabels[area] || area) + ' ' + String(blocks));
      }
      if (governance.unapprovedObligations > 0) gaps.push('合规待审 ' + String(governance.unapprovedObligations));
      if (governance.openRiskAcceptances > 0) gaps.push('风险待接受 ' + String(governance.openRiskAcceptances));
      if (governance.blockers.length > 0) gaps.push('治理阻塞 ' + String(governance.blockers.length));
      for (const code of item.blockedReasonCodes || []) gaps.push(warningLabels[code] || code);
      return [...new Set(gaps)];
    }

    function evidenceNextAction(gaps) {
      if (gaps.some((gap) => gap.includes('验收'))) return '补齐验收覆盖后再验证。';
      if (gaps.some((gap) => gap.includes('代码'))) return '链接代码提交、分支或 PR。';
      if (gaps.some((gap) => gap.includes('Review'))) return '补充评审结论。';
      if (gaps.some((gap) => gap.includes('CI'))) return '补充 CI run 或测试结果。';
      if (gaps.some((gap) => gap.includes('安全'))) return '处理安全阻塞并补充证据。';
      if (gaps.some((gap) => gap.includes('可靠性'))) return '处理可靠性阻塞并补充证据。';
      if (gaps.some((gap) => gap.includes('可信'))) return '处理可信阻塞并补充证据。';
      if (gaps.some((gap) => gap.includes('合规'))) return '完成合规义务审批。';
      if (gaps.some((gap) => gap.includes('风险'))) return '处理或批准风险接受。';
      return '处理阻塞检查并重新进入门禁。';
    }

    function requiresImplementationEvidenceForCard(card) {
      const workItem = card.workItem;
      return implementationWorkItemTypes.includes(workItem.type)
        || (workItem.type === 'requirement' && card.childRollup.total === 0);
    }

    function requiresAcceptanceEvidenceForCard(card) {
      return acceptanceGateWorkItemTypes.includes(card.workItem.type);
    }

    function requiredEvidenceBlockCount(evidence) {
      return evidence.missingRequiredChecks
        + evidence.pendingChecks
        + evidence.failedRequiredChecks
        + evidence.blockedRequiredChecks;
    }

    function hasEvidenceAreaChecks(card, area) {
      return card.evidenceSummary.summary.checks.some((check) => check.area === area);
    }

    function evidenceAreaBlockCount(card, area) {
      return card.evidenceSummary.summary.checks.filter((check) =>
        check.required &&
        check.area === area &&
        ['missing', 'pending', 'failing', 'blocked'].includes(check.status),
      ).length;
    }

    function governanceBlockCount(governance) {
      return governance.blockers.length
        + governance.unapprovedObligations
        + governance.openRiskAcceptances;
    }

    function renderEvidenceLane(lane) {
      const section = document.createElement('section');
      section.className = 'evidence-lane';
      const header = document.createElement('header');
      header.innerHTML = '<span class="column-title"></span><span class="meta"></span>';
      const titleLabels = {
        blocked: '证据阻塞',
        missing: '缺必需证据',
        pending: '证据待处理',
        passing: '证据通过',
      };
      header.querySelector('.column-title').textContent = titleLabels[lane.id] || lane.title;
      header.querySelector('.meta').append(badge(String(lane.cards.length)));
      section.append(header);
      const list = document.createElement('div');
      list.className = 'card-list';
      if (lane.cards.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '暂无工作项。';
        list.append(empty);
      } else {
        for (const item of lane.cards) {
          const card = renderCard(item.card);
          card.title = item.blockedReasonCodes.map((code) => warningLabels[code] || code).join(' / ');
          list.append(card);
        }
      }
      section.append(list);
      return section;
    }

    function renderTree() {
      const root = $('tree');
      root.className = 'tree';
      root.innerHTML = '';
      const roots = childrenOf(null);
      if (roots.length === 0) {
        root.className = 'empty';
        root.textContent = '当前项目暂无需求树。';
        return;
      }
      for (const item of roots) root.append(renderTreeNode(item));
    }

    function renderTreeNode(item) {
      const node = document.createElement('div');
      node.className = 'tree-node';
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'tree-row' + (item.id === state.selectedId ? ' selected' : '');
      row.innerHTML = '<span class="tree-title"></span><span class="badge"></span>';
      row.querySelector('.tree-title').textContent = item.title || '(无标题)';
      row.querySelector('.badge').textContent = typeLabels[item.type] || item.type;
      row.addEventListener('click', () => selectItem(item.id));
      node.append(row);
      const children = childrenOf(item.id);
      if (children.length > 0) {
        const childWrap = document.createElement('div');
        childWrap.className = 'tree-children';
        for (const child of children) childWrap.append(renderTreeNode(child));
        node.append(childWrap);
      }
      return node;
    }

    function setDetailPanelVisible(detail, visible) {
      detail.hidden = !visible;
      $('workspace').classList.toggle('has-detail', visible);
    }

    async function renderDetail() {
      const detail = $('detail');
      if (state.areaId === 'intake') {
        setDetailPanelVisible(detail, Boolean(state.intakeBundle));
        renderIntakeDetail(detail);
        return;
      }
      if (state.areaId === 'settings' && state.viewId !== 'audit-board') {
        setDetailPanelVisible(detail, false);
        detail.innerHTML = '';
        return;
      }
      const item = itemById(state.selectedId);
      if (!item) {
        setDetailPanelVisible(detail, false);
        detail.innerHTML = '';
        return;
      }
      setDetailPanelVisible(detail, true);
      let payload;
      try {
        payload = await api('/api/v1/work-items/' + encodeURIComponent(item.id) + '/board-detail');
      } catch (error) {
        setMessage(error.message, true);
        return;
      }
      const card = payload.card;
      let auditEvents = [];
      try {
        auditEvents = await loadWorkItemAuditEvents(item.id);
      } catch (error) {
        setMessage(error.message, true);
      }
      detail.innerHTML = '';
      const title = document.createElement('h2');
      title.className = 'detail-title';
      title.textContent = item.title || '(无标题)';
      const meta = document.createElement('div');
      meta.className = 'meta section';
      meta.append(badge(typeLabels[item.type] || item.type, 'type-' + item.type));
      meta.append(priorityBadge(item.priority));
      meta.append(document.createTextNode(statusLabels[item.status] || item.status));
      if (card.parentBreadcrumb.length > 0) {
        meta.append(document.createTextNode('父项 ' + card.parentBreadcrumb.map((parent) => parent.title).join(' / ')));
      }
      if (card.milestone) meta.append(document.createTextNode('里程碑 ' + card.milestone.title));
      detail.append(title, meta);
      detail.append(detailTabs({ ...payload.tabSummaries, audit: String(auditEvents.length) + ' audit event(s)' }));
      if (state.areaId === 'settings' && state.viewId === 'audit-board') {
        detail.append(auditField(auditEvents));
        return;
      }
      for (const section of detailSectionsForArea(payload, card, item, auditEvents)) {
        detail.append(section);
      }
    }

    function renderIntakeDetail(detail) {
      const bundle = state.intakeBundle;
      if (!bundle) {
        detail.innerHTML = '<h2 class="detail-title">需求录入</h2><p class="muted">选择或创建录入会话后，来源、解析状态和候选需求会显示在这里。</p>';
        return;
      }
      detail.innerHTML = '';
      const title = document.createElement('h2');
      title.className = 'detail-title';
      title.textContent = bundle.session.title || '需求录入';
      const summary = document.createElement('div');
      summary.className = 'detail-grid section';
      summary.append(
        metric(intakeStatusLabels[bundle.session.status] || bundle.session.status, '状态'),
        metric(String(bundle.messages.length), '消息'),
        metric(String(bundle.sourceDocuments.length), '来源文件'),
        metric(String(bundle.candidates.length), '候选需求'),
      );
      const next = document.createElement('section');
      next.className = 'field';
      const nextTitle = document.createElement('b');
      nextTitle.textContent = '下一步';
      const nextText = document.createElement('p');
      nextText.className = 'muted';
      nextText.textContent = intakeSessionNextAction(bundle);
      next.append(nextTitle, nextText);
      const sourceSummary = document.createElement('section');
      sourceSummary.className = 'field';
      const sourceTitle = document.createElement('b');
      sourceTitle.textContent = '来源状态';
      const sourceMeta = document.createElement('div');
      sourceMeta.className = 'meta';
      sourceMeta.append(
        badge('已解析 ' + String(bundle.sourceDocuments.filter((source) => source.parseStatus === 'parsed').length), 'ready'),
        badge('待解析 ' + String(bundle.sourceDocuments.filter((source) => source.parseStatus === 'pending').length), 'warning'),
        badge('失败 ' + String(bundle.sourceDocuments.filter((source) => source.parseStatus === 'failed').length), 'blocking'),
      );
      sourceSummary.append(sourceTitle, sourceMeta);
      const candidates = document.createElement('section');
      candidates.className = 'field';
      const candidateTitle = document.createElement('b');
      candidateTitle.textContent = '候选摘要';
      const candidateMeta = document.createElement('div');
      candidateMeta.className = 'meta';
      candidateMeta.append(
        badge('草稿 ' + String(bundle.candidates.filter((candidate) => candidate.status === 'draft').length)),
        badge('批准 ' + String(bundle.candidates.filter((candidate) => candidate.status === 'approved').length), 'ready'),
        badge('拒绝 ' + String(bundle.candidates.filter((candidate) => candidate.status === 'rejected').length), 'warning'),
      );
      candidates.append(candidateTitle, candidateMeta);
      detail.append(title, summary, next, sourceSummary, candidates);
    }

    function intakeSessionNextAction(bundle) {
      if (bundle.messages.length === 0 && bundle.sourceDocuments.length === 0) {
        return '先在录入对话中提交 idea、补充说明或附件。';
      }
      if (bundle.candidates.length === 0) {
        return '点击“分析为候选需求”，把原始输入转成可评审的 Epic、Feature、Story 和 Task。';
      }
      const selected = selectedDraftIntakeCandidateIds(bundle).length;
      if (selected > 0) {
        return '检查候选内容、来源引用和里程碑后，批准已选候选进入正式需求树。';
      }
      if (bundle.candidates.some((candidate) => candidate.status === 'draft')) {
        return '选择需要进入正式需求树的候选需求，或拒绝暂不采纳的候选。';
      }
      return '候选需求已处理，可回到 Backlog 跟踪正式 WorkItem。';
    }

    function detailTabs(summaries) {
      const nav = document.createElement('nav');
      nav.className = 'detail-tabs';
      const labels = detailTabLabelsForArea();
      for (const [key, label] of labels) {
        const item = badge(label);
        item.title = summaries && summaries[key] ? summaries[key] : label;
        nav.append(item);
      }
      return nav;
    }

    function detailTabLabelsForArea() {
      if (state.areaId === 'planning') {
        return [['summary', '摘要'], ['milestone', '里程碑'], ['children', '子项'], ['audit', '审计']];
      }
      if (state.areaId === 'team') {
        return [['summary', '摘要'], ['team', '团队'], ['audit', '审计']];
      }
      if (state.areaId === 'workflow') {
        return [['workflow', 'Workflow'], ['summary', '摘要'], ['audit', '审计']];
      }
      if (state.areaId === 'evidence') {
        return [['evidence', '证据'], ['governance', '治理'], ['summary', '摘要'], ['audit', '审计']];
      }
      if (state.areaId === 'settings' && state.viewId === 'audit-board') {
        return [['audit', '审计'], ['summary', '摘要']];
      }
      return [
        ['summary', '摘要'],
        ['analysis', '分析'],
        ['design', '设计'],
        ['acceptance', '验收'],
        ['source', '来源'],
        ['children', '子项'],
        ['audit', '审计'],
      ];
    }

    function detailSectionsForArea(payload, card, item, auditEvents) {
      if (state.areaId === 'planning') {
        return [
          detailRollups(card),
          milestonePlanField(payload.milestonePlan),
          childrenField(payload.children),
          auditField(auditEvents),
          deliveryGateField(card, payload.milestonePlan),
          statusActions(item, card, payload.milestonePlan),
        ];
      }
      if (state.areaId === 'team') {
        return [
          assignmentField(payload),
          detailRollups(card),
          auditField(auditEvents),
          deliveryGateField(card, payload.milestonePlan),
          statusActions(item, card, payload.milestonePlan),
        ];
      }
      if (state.areaId === 'workflow') {
        return [
          workflowField(card),
          detailRollups(card),
          auditField(auditEvents),
          deliveryGateField(card, payload.milestonePlan),
          statusActions(item, card, payload.milestonePlan),
        ];
      }
      if (state.areaId === 'evidence') {
        return [
          evidenceField(card),
          governanceField(card),
          detailRollups(card),
          auditField(auditEvents),
          deliveryGateField(card, payload.milestonePlan),
          statusActions(item, card, payload.milestonePlan),
        ];
      }
      return [
        detailRollups(card),
        sourceTraceField(payload, item),
        detailEditor(item),
        childrenField(payload.children),
        auditField(auditEvents),
        deliveryGateField(card, payload.milestonePlan),
        statusActions(item, card, payload.milestonePlan),
      ];
    }

    function sourceTraceField(payload, item) {
      const origin = payload.intakeOrigin;
      const section = document.createElement('section');
      section.className = 'field intake-origin';
      const title = document.createElement('b');
      title.textContent = '来源追踪';
      const manualTrace = document.createElement('div');
      manualTrace.className = 'intake-origin-summary';
      const sourceInput = document.createElement('p');
      sourceInput.textContent = item.sourceInput || '未填写来源输入。';
      const decompositionReason = document.createElement('p');
      decompositionReason.textContent = item.decompositionReason || '未填写拆分原因。';
      const manualMeta = document.createElement('div');
      manualMeta.className = 'meta';
      manualMeta.append(
        badge(item.sourceInput ? '来源已记录' : '来源待补充', item.sourceInput ? 'ready' : 'warning'),
        badge(item.decompositionReason ? '拆分原因已记录' : '拆分原因待补充', item.decompositionReason ? 'ready' : 'warning'),
      );
      manualTrace.append(manualMeta, sourceInput, decompositionReason);
      if (!origin) {
        const empty = document.createElement('p');
        empty.textContent = '这个工作项没有关联 intake 候选需求。';
        section.append(title, manualTrace, empty);
        return section;
      }
      const summary = document.createElement('div');
      summary.className = 'intake-origin-summary';
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.append(
        badge(origin.session.title || '录入会话'),
        badge(typeLabels[origin.candidate.type] || origin.candidate.type, 'type-' + origin.candidate.type),
        badge(candidateStatusLabels[origin.candidate.status] || origin.candidate.status, 'ready'),
        badge('来源 ' + String(origin.sourceRefs.length)),
      );
      const candidateTitle = document.createElement('p');
      candidateTitle.textContent = origin.candidate.title || '(无标题候选需求)';
      summary.append(meta, candidateTitle);
      const refs = document.createElement('div');
      refs.className = 'source-ref-list';
      if (origin.sourceRefs.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = '该候选需求没有保留来源引用。';
        refs.append(empty);
      } else {
        origin.sourceRefs.forEach((sourceRef, index) => {
          refs.append(renderWorkItemIntakeSourceRef(sourceRef, index));
        });
      }
      section.append(title, manualTrace, summary, refs);
      return section;
    }

    function renderWorkItemIntakeSourceRef(enrichedRef, index) {
      const row = document.createElement('section');
      row.className = 'source-ref-row';
      const meta = document.createElement('div');
      meta.className = 'meta';
      const sourceRef = enrichedRef.sourceRef;
      if (enrichedRef.message) {
        meta.append(badge('对话 ' + (enrichedRef.message.author || enrichedRef.message.role)));
      } else if (sourceRef.messageId) {
        meta.append(badge('对话 ' + sourceRef.messageId));
      }
      if (enrichedRef.sourceDocument) {
        meta.append(
          badge(enrichedRef.sourceDocument.name),
          badge(sourceKindLabels[enrichedRef.sourceDocument.kind] || enrichedRef.sourceDocument.kind),
          badge(
            parseStatusLabels[enrichedRef.sourceDocument.parseStatus] || enrichedRef.sourceDocument.parseStatus,
            enrichedRef.sourceDocument.parseStatus === 'parsed' ? 'ready' : 'warning',
          ),
        );
      } else if (sourceRef.sourceDocumentId) {
        meta.append(badge(String(sourceRef.sourceDocumentId)));
      }
      if (enrichedRef.chunk) {
        meta.append(badge('Chunk ' + String(enrichedRef.chunk.index + 1)));
      } else if (sourceRef.sourceChunkId) {
        meta.append(badge('Chunk ' + String(index + 1)));
      }
      if (meta.childNodes.length === 0) meta.append(badge('来源 ' + String(index + 1)));
      meta.append(badge('置信 ' + String(Math.round(sourceRef.confidence * 100)) + '%'));
      const quote = document.createElement('blockquote');
      quote.textContent = sourceRef.quote || enrichedRef.chunk?.text || enrichedRef.message?.body || '未保留引用文本。';
      row.append(meta, quote);
      return row;
    }

    function detailRollups(card) {
      const section = document.createElement('section');
      section.className = 'field';
      const title = document.createElement('b');
      title.textContent = '交付汇总';
      const grid = document.createElement('div');
      grid.className = 'detail-grid';
      grid.append(
        metric(String(card.childRollup.unfinished) + '/' + String(card.childRollup.total), '未完成子项'),
        metric(String(card.acceptanceRollup.coveredCriteria) + '/' + String(card.acceptanceRollup.totalCriteria), '验收覆盖'),
        metric(String(card.evidenceSummary.evidenceCount), '证据'),
        metric(String(card.warnings.length), '告警'),
      );
      if (card.warnings.length > 0) {
        const warnings = document.createElement('div');
        warnings.className = 'meta';
        for (const warning of card.warnings) {
          warnings.append(badge(warningLabels[warning.code] || warning.code, warning.severity));
        }
        section.append(title, grid, warnings);
      } else {
        section.append(title, grid);
      }
      return section;
    }

    function detailEditor(item) {
      const section = document.createElement('section');
      section.className = 'field';
      const title = document.createElement('b');
      title.textContent = '编辑详情';
      const form = document.createElement('form');
      form.className = 'controls';
      form.innerHTML =
        '<label>标题 <input name="title" autocomplete="off"></label>' +
        '<label>说明 <textarea name="body"></textarea></label>' +
        '<label>需求分析 <textarea name="analysis"></textarea></label>' +
        '<label>需求设计 <textarea name="design"></textarea></label>' +
        '<label>来源输入 <textarea name="sourceInput"></textarea></label>' +
        '<label>拆分原因 <textarea name="decompositionReason"></textarea></label>' +
        '<div class="inline">' +
        '<label>父项 <select name="detailParentId"></select></label>' +
        '<label>优先级 <select name="priority">' +
        '<option value="">未定</option>' +
        '<option value="p0">P0</option>' +
        '<option value="p1">P1</option>' +
        '<option value="p2">P2</option>' +
        '<option value="p3">P3</option>' +
        '</select></label>' +
        '<label>里程碑 <select name="detailMilestoneId"></select></label>' +
        '</div>' +
        '<label>验收标准 <textarea name="acceptance"></textarea></label>' +
        '<button class="primary" type="submit">保存详情</button>';
      form.elements.title.value = item.title || '';
      form.elements.body.value = item.body || '';
      form.elements.analysis.value = item.analysis || '';
      form.elements.design.value = item.design || '';
      form.elements.sourceInput.value = item.sourceInput || '';
      form.elements.decompositionReason.value = item.decompositionReason || '';
      fillWorkItemParentSelect(form.elements.detailParentId, item.type, item.parentId || '', item.id);
      form.elements.priority.value = item.priority || '';
      form.elements.detailMilestoneId.dataset.selectedId = item.milestoneId || '';
      fillMilestoneSelect(form.elements.detailMilestoneId, item.milestoneId || '');
      form.elements.acceptance.value = (item.acceptanceCriteria || [])
        .map((criterion) => criterion.text)
        .join('\\n');
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        void updateItemDetails(item, form);
      });
      section.append(title, form);
      return section;
    }

    async function updateItemDetails(item, form) {
      const lines = form.elements.acceptance.value
        .split('\\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const acceptanceCriteria = lines.map((text, index) => ({
        id: item.acceptanceCriteria[index] ? item.acceptanceCriteria[index].id : item.id + ':ac-' + String(index + 1),
        text,
      }));
      try {
        await api('/api/v1/work-items/' + encodeURIComponent(item.id) + '/board-detail', {
          method: 'PATCH',
          body: JSON.stringify({
            title: form.elements.title.value.trim(),
            body: form.elements.body.value,
            analysis: form.elements.analysis.value,
            design: form.elements.design.value,
            sourceInput: form.elements.sourceInput.value,
            decompositionReason: form.elements.decompositionReason.value,
            parentId: form.elements.detailParentId.value || null,
            priority: form.elements.priority.value || null,
            milestoneId: form.elements.detailMilestoneId.value || null,
            acceptanceCriteria,
          }),
        });
        await loadBoard();
        setMessage('详情已保存');
      } catch (error) {
        setMessage(error.message, true);
      }
    }

    function assignmentField(payload) {
      const item = payload.card.workItem;
      const section = document.createElement('section');
      section.className = 'field';
      const title = document.createElement('b');
      title.textContent = '团队分配';
      const form = document.createElement('form');
      form.className = 'controls';
      form.innerHTML =
        '<div class="inline">' +
        '<label>成员 <select name="assignmentMemberId"></select></label>' +
        '<label>角色 <select name="assignmentRoleId"></select></label>' +
        '</div>' +
        '<button class="primary" type="submit">分配工作项</button>';
      form.elements.assignmentMemberId.dataset.selectedId = item.assignee || '';
      fillTeamMemberSelect(form.elements.assignmentMemberId, item.assignee || '');
      const selectedRole = item.claimedRoleId || '';
      form.elements.assignmentRoleId.dataset.selectedId = selectedRole;
      fillRoleSelect(form.elements.assignmentRoleId, selectedRole);
      if (payload.assignedMember) {
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.append(
          badge(payload.assignedMember.displayName, 'ready'),
          badge(memberTypeLabels[payload.assignedMember.memberType] || payload.assignedMember.memberType),
          badge(memberStatusLabels[payload.assignedMember.status] || payload.assignedMember.status),
        );
        section.append(title, meta, form);
      } else {
        section.append(title, form);
      }
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        void assignWorkItem(item.id, form);
      });
      return section;
    }

    async function assignWorkItem(workItemId, form) {
      const memberId = form.elements.assignmentMemberId.value;
      if (!memberId) {
        setMessage('请选择团队成员', true);
        return;
      }
      try {
        await api('/api/v1/work-items/' + encodeURIComponent(workItemId) + '/assignments', {
          method: 'POST',
          body: JSON.stringify({
            memberId,
            roleId: form.elements.assignmentRoleId.value || undefined,
            actorId: 'web-user',
          }),
        });
        await loadBoard();
        setMessage('工作项已分配');
      } catch (error) {
        setMessage(error.message, true);
      }
    }

    function childrenField(children) {
      const section = document.createElement('section');
      section.className = 'field';
      const title = document.createElement('b');
      title.textContent = '子项';
      const list = document.createElement('div');
      list.className = children.length === 0 ? 'empty' : 'tree';
      if (children.length === 0) {
        list.textContent = '暂无子项。';
      } else {
        for (const child of children) {
          const row = document.createElement('button');
          row.type = 'button';
          row.className = 'tree-row';
          row.innerHTML = '<span class="tree-title"></span><span class="badge"></span>';
          row.querySelector('.tree-title').textContent = child.title;
          row.querySelector('.badge').textContent = typeLabels[child.type] || child.type;
          row.addEventListener('click', () => selectItem(child.id));
          list.append(row);
        }
      }
      section.append(title, list);
      return section;
    }

    function milestonePlanField(plan) {
      const section = document.createElement('section');
      section.className = 'field';
      const title = document.createElement('b');
      title.textContent = '里程碑计划';
      const summary = document.createElement('div');
      summary.className = 'detail-grid';
      summary.append(
        metric(String(plan.completedSlices) + '/' + String(plan.totalSlices), '交付切片'),
        metric(String(plan.openSlices), '未完成切片'),
        metric(String(plan.milestoneRollups.length), '涉及里程碑'),
        metric(String(plan.percentComplete) + '%', '切片完成率'),
      );
      section.append(title, summary);
      if (plan.slices.length > 0) {
        const list = document.createElement('div');
        list.className = 'lane-block';
        for (const slice of plan.slices) list.append(renderDeliverySliceCard(slice));
        section.append(list);
      }
      if (['epic', 'feature', 'requirement', 'story'].includes(plan.parent.workItem.type)) {
        section.append(milestoneSliceForm(plan.parent.workItem));
      } else {
        const note = document.createElement('p');
        note.textContent = 'Task、Bug 和 Research 通过父需求的交付切片纳入跨里程碑计划。';
        section.append(note);
      }
      return section;
    }

    function milestoneSliceForm(item) {
      const form = document.createElement('form');
      form.className = 'controls';
      form.innerHTML =
        '<label>里程碑 <select name="milestoneId"></select></label>' +
        '<label>标题 <input name="title" autocomplete="off"></label>' +
        '<label>范围 <textarea name="scope"></textarea></label>' +
        '<label>负责人 <input name="owner" autocomplete="off"></label>' +
        '<label>预期证据 <textarea name="expectedEvidence" placeholder="每行一条"></textarea></label>' +
        '<button class="primary" type="submit">新增交付切片</button>';
      fillMilestoneSelect(form.elements.milestoneId);
      const criteria = document.createElement('ul');
      criteria.className = 'criteria';
      for (const criterion of item.acceptanceCriteria || []) {
        const row = document.createElement('li');
        const label = document.createElement('label');
        label.className = 'inline';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = 'sliceCriterion';
        input.value = criterion.id;
        label.append(input, document.createTextNode(criterion.text));
        row.append(label);
        criteria.append(row);
      }
      if (criteria.childNodes.length > 0) {
        const heading = document.createElement('b');
        heading.textContent = '验收范围';
        form.insertBefore(heading, form.querySelector('button'));
        form.insertBefore(criteria, form.querySelector('button'));
      }
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        void createMilestoneSlice(item.id, form);
      });
      return form;
    }

    async function createMilestoneSlice(workItemId, form) {
      if (!form.elements.milestoneId.value) {
        setMessage('请选择里程碑', true);
        return;
      }
      const acceptanceCriterionIds = Array
        .from(form.querySelectorAll('input[name="sliceCriterion"]:checked'))
        .map((input) => input.value);
      const expectedEvidence = form.elements.expectedEvidence.value
        .split('\\n')
        .map((line) => line.trim())
        .filter(Boolean);
      try {
        await api('/api/v1/work-items/' + encodeURIComponent(workItemId) + '/milestone-slices', {
          method: 'POST',
          body: JSON.stringify({
            milestoneId: form.elements.milestoneId.value,
            title: form.elements.title.value.trim() || undefined,
            scope: form.elements.scope.value.trim(),
            owner: form.elements.owner.value.trim() || undefined,
            acceptanceCriterionIds,
            expectedEvidence,
          }),
        });
        await loadBoard();
        setMessage('交付切片已创建');
      } catch (error) {
        setMessage(error.message, true);
      }
    }

    function workflowField(card) {
      const section = document.createElement('section');
      section.className = 'field';
      const title = document.createElement('b');
      title.textContent = 'Workflow 摘要';
      const summary = card.workflowSummary;
      const wrap = document.createElement('div');
      wrap.className = 'detail-grid';
      wrap.append(
        metric(statusLabels[summary.stage] || summary.stage, '阶段'),
        metric(workflowRunStatusLabels[summary.runStatus] || summary.runStatus, '运行状态'),
        metric(String(summary.waitingApprovals.length), '等待审批'),
        metric(String(summary.waitingReviews.length), '等待评审'),
        metric(String(summary.blockedSteps.length), '阻塞步骤'),
        metric(String(summary.failedChecks.length), '失败检查'),
      );
      const meta = document.createElement('div');
      meta.className = 'meta';
      if (summary.activeOwner) meta.append(badge('负责人 ' + summary.activeOwner, 'ready'));
      if (summary.activeRoleId) meta.append(badge('角色 ' + summary.activeRoleId, 'workflow'));
      for (const control of summary.controls) meta.append(badge(control));
      const reason = document.createElement('p');
      reason.textContent = summary.schedulerReason || summary.nextAction;
      const impact = document.createElement('p');
      impact.textContent = summary.downstreamImpact || '暂无下游影响说明。';
      section.append(title, wrap, meta, reason, impact, workflowSummaryForm(card.workItem.id, summary));
      return section;
    }

    function workflowSummaryForm(workItemId, summary) {
      const form = document.createElement('form');
      form.className = 'controls';
      form.innerHTML =
        '<div class="inline">' +
        '<label>运行状态 <select name="runStatus"></select></label>' +
        '<label>当前负责人 <input name="activeOwner" autocomplete="off"></label>' +
        '</div>' +
        '<label>下一步 <textarea name="nextAction"></textarea></label>' +
        '<label>调度原因 <textarea name="schedulerReason"></textarea></label>' +
        '<label>下游影响 <textarea name="downstreamImpact"></textarea></label>' +
        '<label>等待审批 <textarea name="waitingApprovals" placeholder="每行一条"></textarea></label>' +
        '<label>等待评审 <textarea name="waitingReviews" placeholder="每行一条"></textarea></label>' +
        '<label>阻塞步骤 <textarea name="blockedSteps" placeholder="每行一条"></textarea></label>' +
        '<label>失败检查 <textarea name="failedChecks" placeholder="每行一条"></textarea></label>' +
        '<button class="primary" type="submit">保存 Workflow 摘要</button>';
      const runStatus = form.elements.runStatus;
      for (const [value, label] of Object.entries(workflowRunStatusLabels)) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        runStatus.append(option);
      }
      runStatus.value = summary.runStatus;
      form.elements.activeOwner.value = summary.activeOwner || '';
      form.elements.nextAction.value = summary.nextAction || '';
      form.elements.schedulerReason.value = summary.schedulerReason || '';
      form.elements.downstreamImpact.value = summary.downstreamImpact || '';
      form.elements.waitingApprovals.value = summary.waitingApprovals.map((item) => item.title).join('\\n');
      form.elements.waitingReviews.value = summary.waitingReviews.map((item) => item.title).join('\\n');
      form.elements.blockedSteps.value = summary.blockedSteps.map((item) => item.title).join('\\n');
      form.elements.failedChecks.value = summary.failedChecks.map((item) => item.title).join('\\n');
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        void updateWorkflowSummary(workItemId, form);
      });
      return form;
    }

    function workflowLines(value) {
      return value
        .split('\\n')
        .map((line) => line.trim())
        .filter(Boolean);
    }

    async function updateWorkflowSummary(workItemId, form) {
      const waitingApprovals = workflowLines(form.elements.waitingApprovals.value)
        .map((title, index) => ({
          id: 'approval-' + String(index + 1),
          type: 'approval',
          title,
          status: 'waiting',
          roleId: null,
          owner: null,
          dueAt: null,
          links: [],
        }));
      const waitingReviews = workflowLines(form.elements.waitingReviews.value)
        .map((title, index) => ({
          id: 'review-' + String(index + 1),
          type: 'review',
          title,
          status: 'waiting',
          roleId: null,
          owner: null,
          dueAt: null,
          links: [],
        }));
      const blockedSteps = workflowLines(form.elements.blockedSteps.value)
        .map((title, index) => ({
          id: 'blocked-step-' + String(index + 1),
          title,
          status: 'blocked',
          owner: null,
          roleId: null,
          dependsOnStepIds: [],
          reason: title,
          links: [],
        }));
      const failedChecks = workflowLines(form.elements.failedChecks.value)
        .map((title, index) => ({
          id: 'failed-check-' + String(index + 1),
          title,
          status: 'failing',
          reason: title,
          links: [],
        }));
      try {
        await api('/api/v1/work-items/' + encodeURIComponent(workItemId) + '/workflow', {
          method: 'PATCH',
          body: JSON.stringify({
            runStatus: form.elements.runStatus.value,
            activeOwner: form.elements.activeOwner.value.trim() || null,
            nextAction: form.elements.nextAction.value.trim(),
            schedulerReason: form.elements.schedulerReason.value.trim(),
            downstreamImpact: form.elements.downstreamImpact.value.trim(),
            waitingApprovals,
            waitingReviews,
            blockedSteps,
            failedChecks,
          }),
        });
        await loadBoard();
        setMessage('Workflow 摘要已保存');
      } catch (error) {
        setMessage(error.message, true);
      }
    }

    function evidenceField(card) {
      const section = document.createElement('section');
      section.className = 'field';
      const title = document.createElement('b');
      title.textContent = '证据';
      const summary = card.evidenceSummary.summary;
      const grid = document.createElement('div');
      grid.className = 'detail-grid';
      grid.append(
        metric(String(card.evidenceSummary.evidenceCount), '证据链接'),
        metric(String(card.evidenceSummary.codeLinkCount), '代码'),
        metric(String(card.evidenceSummary.pullRequestCount), 'PR'),
        metric(String(card.evidenceSummary.reviewCount), 'Review'),
        metric(String(card.evidenceSummary.ciRunCount), 'CI'),
        metric(
          String(card.evidenceSummary.passingChecks) + '/' + String(card.evidenceSummary.requiredChecks),
          '必需检查',
        ),
      );
      const content = document.createElement('div');
      content.className = 'meta';
      if (card.evidenceSummary.hasAcceptanceEvidence) content.append(badge('验收已覆盖', 'ready'));
      for (const missing of card.evidenceSummary.missingEvidence) {
        content.append(badge('缺 ' + missing, 'warning'));
      }
      for (const check of summary.checks.slice(0, 6)) {
        const tone = check.status === 'passing' || check.status === 'waived'
          ? 'ready'
          : check.status === 'pending'
            ? 'warning'
            : 'blocking';
        content.append(badge(
          (evidenceAreaLabels[check.area] || check.area) + ' ' + (evidenceStatusLabels[check.status] || check.status),
          tone,
        ));
      }
      section.append(title, grid, content, evidenceSummaryForm(card.workItem.id, summary));
      return section;
    }

    function evidenceSummaryForm(workItemId, summary) {
      const form = document.createElement('form');
      form.className = 'controls';
      form.innerHTML =
        '<label>代码证据 <textarea name="codeLinks"></textarea></label>' +
        '<label>Pull Requests <textarea name="pullRequests"></textarea></label>' +
        '<label>代码评审 <textarea name="reviewLinks"></textarea></label>' +
        '<label>CI Runs <textarea name="ciRuns"></textarea></label>' +
        '<label>交付证据 <textarea name="evidenceLinks"></textarea></label>' +
        '<label>通过检查 <textarea name="passingChecks"></textarea></label>' +
        '<label>缺失检查 <textarea name="missingChecks"></textarea></label>' +
        '<label>安全阻塞 <textarea name="securityBlocks"></textarea></label>' +
        '<label>可靠性阻塞 <textarea name="reliabilityBlocks"></textarea></label>' +
        '<label>可信阻塞 <textarea name="trustBlocks"></textarea></label>' +
        '<label>治理义务 <textarea name="obligations"></textarea></label>' +
        '<label>风险接受 <textarea name="riskAcceptances"></textarea></label>' +
        '<label>备注 <textarea name="notes"></textarea></label>' +
        '<button class="primary" type="submit">保存证据治理</button>';
      form.elements.codeLinks.value = summary.codeLinks.map((link) => link.label).join('\\n');
      form.elements.pullRequests.value = summary.pullRequests.map((link) => link.label).join('\\n');
      form.elements.reviewLinks.value = summary.reviewLinks.map((link) => link.label).join('\\n');
      form.elements.ciRuns.value = summary.ciRuns.map((link) => link.label).join('\\n');
      form.elements.evidenceLinks.value = summary.evidenceLinks.map((link) => link.label).join('\\n');
      form.elements.passingChecks.value = summary.checks
        .filter((check) => check.status === 'passing')
        .map((check) => check.title)
        .join('\\n');
      form.elements.missingChecks.value = summary.checks
        .filter((check) => check.status === 'missing')
        .map((check) => check.title)
        .join('\\n');
      form.elements.securityBlocks.value = summary.checks
        .filter((check) => check.area === 'security' && ['missing', 'failing', 'blocked'].includes(check.status))
        .map((check) => check.title)
        .join('\\n');
      form.elements.reliabilityBlocks.value = summary.checks
        .filter((check) => check.area === 'reliability' && ['missing', 'failing', 'blocked'].includes(check.status))
        .map((check) => check.title)
        .join('\\n');
      form.elements.trustBlocks.value = summary.checks
        .filter((check) => check.area === 'trust' && ['missing', 'failing', 'blocked'].includes(check.status))
        .map((check) => check.title)
        .join('\\n');
      form.elements.obligations.value = summary.obligations.map((item) => item.title).join('\\n');
      form.elements.riskAcceptances.value = summary.riskAcceptances.map((item) => item.title).join('\\n');
      form.elements.notes.value = summary.notes || '';
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        void updateEvidenceSummary(workItemId, form);
      });
      return form;
    }

    function evidenceLinkLines(value, kind, prefix) {
      return workflowLines(value).map((line, index) => ({
        kind,
        id: prefix + '-' + String(index + 1),
        label: line,
        url: /^https?:\\/\\//.test(line) ? line : null,
        acceptanceCriterionIds: [],
      }));
    }

    function evidenceCheckLines(value, area, status, prefix) {
      return workflowLines(value).map((line, index) => ({
        id: prefix + '-' + String(index + 1),
        area,
        title: line,
        status,
        required: true,
        reason: line,
        evidenceIds: [],
        acceptanceCriterionIds: [],
        links: [],
      }));
    }

    async function updateEvidenceSummary(workItemId, form) {
      const checks = [
        ...evidenceCheckLines(form.elements.passingChecks.value, 'evidence', 'passing', 'passing-check'),
        ...evidenceCheckLines(form.elements.missingChecks.value, 'evidence', 'missing', 'missing-check'),
        ...evidenceCheckLines(form.elements.securityBlocks.value, 'security', 'blocked', 'security-check'),
        ...evidenceCheckLines(form.elements.reliabilityBlocks.value, 'reliability', 'blocked', 'reliability-check'),
        ...evidenceCheckLines(form.elements.trustBlocks.value, 'trust', 'blocked', 'trust-check'),
      ];
      const obligations = workflowLines(form.elements.obligations.value).map((title, index) => ({
        id: 'obligation-' + String(index + 1),
        title,
        jurisdiction: '',
        source: '',
        status: 'pending_review',
        owner: '',
        reviewer: '',
        effectiveDate: null,
        reviewDate: null,
        controlIds: [],
        links: [],
      }));
      const riskAcceptances = workflowLines(form.elements.riskAcceptances.value).map((title, index) => ({
        id: 'risk-' + String(index + 1),
        area: 'security',
        title,
        status: 'requested',
        approver: '',
        reason: title,
        expiresAt: null,
        links: [],
      }));
      try {
        await api('/api/v1/work-items/' + encodeURIComponent(workItemId) + '/delivery-evidence', {
          method: 'PATCH',
          body: JSON.stringify({
            codeLinks: evidenceLinkLines(form.elements.codeLinks.value, 'commit', 'code'),
            pullRequests: evidenceLinkLines(form.elements.pullRequests.value, 'pull-request', 'pr'),
            reviewLinks: evidenceLinkLines(form.elements.reviewLinks.value, 'code-review', 'review'),
            ciRuns: evidenceLinkLines(form.elements.ciRuns.value, 'ci-run', 'ci'),
            evidenceLinks: evidenceLinkLines(form.elements.evidenceLinks.value, 'evidence-record', 'evidence'),
            checks,
            obligations,
            riskAcceptances,
            notes: form.elements.notes.value,
          }),
        });
        await loadBoard();
        setMessage('证据治理已保存');
      } catch (error) {
        setMessage(error.message, true);
      }
    }

    function governanceField(card) {
      const section = document.createElement('section');
      section.className = 'field';
      const title = document.createElement('b');
      title.textContent = '治理';
      const grid = document.createElement('div');
      grid.className = 'detail-grid';
      grid.append(
        metric(String(card.governanceSummary.obligations), '义务'),
        metric(String(card.governanceSummary.unapprovedObligations), '待审义务'),
        metric(String(card.governanceSummary.openRiskAcceptances), '待接受风险'),
        metric(String(card.governanceSummary.blockers.length), '治理阻塞'),
      );
      const content = document.createElement('div');
      content.className = 'meta';
      if (!card.governanceSummary.required) {
        content.append(badge('无治理要求'));
      } else if (card.governanceSummary.blockers.length === 0) {
        content.append(badge('治理 Ready', 'ready'));
      } else {
        for (const blocker of card.governanceSummary.blockers.slice(0, 6)) {
          content.append(badge(blocker, 'blocking'));
        }
      }
      section.append(title, grid, content);
      return section;
    }

    function auditField(events) {
      const section = document.createElement('section');
      section.className = 'field audit-detail';
      const title = document.createElement('b');
      title.textContent = '审计';
      const timeline = document.createElement('div');
      timeline.className = 'audit-mini-timeline';
      if (!events || events.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '当前工作项暂无审计事件。';
        timeline.append(empty);
      } else {
        for (const event of events) timeline.append(renderAuditEventRow(event, { compact: true }));
      }
      section.append(title, timeline);
      return section;
    }

    function deliveryGateField(card, milestonePlan) {
      const items = deliveryGateItems(card, milestonePlan);
      const blockers = deliveryGateBlocks(card, milestonePlan);
      const section = document.createElement('section');
      section.className = 'field delivery-gate-panel';
      const head = document.createElement('div');
      head.className = 'delivery-gate-head';
      const title = document.createElement('b');
      title.textContent = '交付前门禁';
      head.append(
        title,
        badge(blockers.length === 0 ? 'Ready for delivery' : '阻塞 ' + String(blockers.length), blockers.length === 0 ? 'ready' : 'blocking'),
      );
      const grid = document.createElement('div');
      grid.className = 'detail-grid';
      grid.append(
        metric(String(items.filter((item) => item.ready).length) + '/' + String(items.length), '门禁 Ready'),
        metric(String(card.evidenceSummary.passingChecks) + '/' + String(card.evidenceSummary.requiredChecks), '必需检查'),
        metric(String(card.workflowSummary.waitingApprovals.length + card.workflowSummary.waitingReviews.length), '审批/评审等待'),
        metric(String(card.governanceSummary.blockers.length), '治理阻塞'),
      );
      const list = document.createElement('div');
      list.className = 'delivery-gate-list';
      for (const item of items) list.append(renderDeliveryGateRow(item));
      section.append(head, grid, list);
      return section;
    }

    function renderDeliveryGateRow(item) {
      const row = document.createElement('div');
      row.className = 'delivery-gate-row ' + (item.ready ? 'ready' : 'blocking');
      const main = document.createElement('div');
      main.className = 'delivery-gate-main';
      const label = document.createElement('strong');
      label.textContent = item.label;
      const detail = document.createElement('p');
      detail.textContent = item.detail;
      main.append(label, detail);
      row.append(main, badge(item.ready ? 'Ready' : '阻塞', item.ready ? 'ready' : 'blocking'));
      return row;
    }

    function deliveryGateBlocks(card, milestonePlan) {
      return deliveryGateItems(card, milestonePlan)
        .filter((item) => item.blocking && !item.ready);
    }

    function deliveryGateItems(card, milestonePlan) {
      const workItem = card.workItem;
      const childRollup = card.childRollup;
      const acceptanceRollup = card.acceptanceRollup;
      const evidence = card.evidenceSummary;
      const governance = card.governanceSummary;
      const workflow = card.workflowSummary;
      const requiresImplementationEvidence = requiresImplementationEvidenceForCard(card);
      const requiresAcceptance = requiresAcceptanceEvidenceForCard(card);
      const hasCodeEvidence = evidence.codeLinkCount + evidence.pullRequestCount > 0;
      const requiredCheckBlockers = evidence.missingRequiredChecks
        + evidence.failedRequiredChecks
        + evidence.blockedRequiredChecks
        + evidence.pendingChecks;
      const waitingWorkflow = workflow.waitingApprovals.length
        + workflow.waitingReviews.length
        + workflow.blockedSteps.length
        + workflow.failedChecks.length;
      const governanceBlockers = governance.blockers.length
        + governance.unapprovedObligations
        + governance.openRiskAcceptances;
      const dependencyBlockers = (workItem.blockedByIds || []).length;
      const openSlices = milestonePlan ? milestonePlan.openSlices : 0;
      const totalSlices = milestonePlan ? milestonePlan.totalSlices : 0;
      const acceptanceReady = requiresAcceptance
        ? acceptanceRollup.totalCriteria > 0 && acceptanceRollup.complete
        : acceptanceRollup.totalCriteria === 0 || acceptanceRollup.complete;
      return [
        {
          id: 'acceptance',
          label: '验收覆盖',
          ready: acceptanceReady,
          blocking: requiresAcceptance || acceptanceRollup.totalCriteria > 0,
          detail: acceptanceRollup.totalCriteria === 0
            ? (requiresAcceptance ? '缺少验收标准。' : '无独立验收标准。')
            : String(acceptanceRollup.coveredCriteria) + '/' + String(acceptanceRollup.totalCriteria) + ' 条已覆盖。',
        },
        {
          id: 'children',
          label: '子项完成',
          ready: childRollup.unfinished === 0,
          blocking: childRollup.total > 0,
          detail: childRollup.total === 0
            ? '没有子项。'
            : String(childRollup.unfinished) + '/' + String(childRollup.total) + ' 个子项未完成。',
        },
        {
          id: 'milestone-slices',
          label: '跨里程碑切片',
          ready: openSlices === 0,
          blocking: totalSlices > 0,
          detail: totalSlices === 0
            ? '没有交付切片。'
            : String(openSlices) + '/' + String(totalSlices) + ' 个切片未完成。',
        },
        {
          id: 'workflow',
          label: '协作流程',
          ready: waitingWorkflow === 0,
          blocking: waitingWorkflow > 0,
          detail: String(workflow.waitingApprovals.length) + ' 个审批，'
            + String(workflow.waitingReviews.length) + ' 个评审，'
            + String(workflow.blockedSteps.length) + ' 个阻塞步骤，'
            + String(workflow.failedChecks.length) + ' 个失败检查。',
        },
        {
          id: 'code',
          label: '代码证据',
          ready: !requiresImplementationEvidence || hasCodeEvidence,
          blocking: requiresImplementationEvidence,
          detail: requiresImplementationEvidence
            ? String(evidence.codeLinkCount) + ' 个代码链接，' + String(evidence.pullRequestCount) + ' 个 PR。'
            : '该类型不要求独立代码证据。',
        },
        {
          id: 'review',
          label: '评审证据',
          ready: !requiresImplementationEvidence || evidence.reviewCount > 0,
          blocking: requiresImplementationEvidence,
          detail: requiresImplementationEvidence
            ? String(evidence.reviewCount) + ' 个 Review。'
            : '该类型不要求独立评审证据。',
        },
        {
          id: 'ci',
          label: 'CI 验证',
          ready: !requiresImplementationEvidence || evidence.ciRunCount > 0,
          blocking: requiresImplementationEvidence,
          detail: requiresImplementationEvidence
            ? String(evidence.ciRunCount) + ' 个 CI run。'
            : '该类型不要求独立 CI 证据。',
        },
        {
          id: 'required-checks',
          label: '必需检查',
          ready: requiredCheckBlockers === 0,
          blocking: evidence.requiredChecks > 0,
          detail: String(evidence.passingChecks) + '/' + String(evidence.requiredChecks)
            + ' 已通过，' + String(requiredCheckBlockers) + ' 个未通过或等待。',
        },
        {
          id: 'governance',
          label: '治理与风险',
          ready: governanceBlockers === 0,
          blocking: governance.required || governanceBlockers > 0,
          detail: String(governance.blockers.length) + ' 个治理阻塞，'
            + String(governance.unapprovedObligations) + ' 个义务待审，'
            + String(governance.openRiskAcceptances) + ' 个风险待接受。',
        },
        {
          id: 'dependencies',
          label: '外部阻塞',
          ready: dependencyBlockers === 0,
          blocking: dependencyBlockers > 0,
          detail: String(dependencyBlockers) + ' 个前置 WorkItem 未解除。',
        },
      ];
    }

    function deliveryGateButtonReason(blockers) {
      return '交付门禁未通过：' + blockers.map((item) => item.label).join('、');
    }

    function metric(value, label) {
      const div = document.createElement('div');
      div.className = 'metric';
      div.innerHTML = '<strong></strong><span></span>';
      div.querySelector('strong').textContent = value;
      div.querySelector('span').textContent = label;
      return div;
    }

    function statusActions(item, card, milestonePlan) {
      const blockers = deliveryGateBlocks(card, milestonePlan);
      const section = document.createElement('section');
      section.className = 'field status-actions';
      const title = document.createElement('b');
      title.textContent = '状态流转';
      const summary = document.createElement('div');
      summary.className = 'status-action-summary';
      summary.append(
        badge(blockers.length === 0 ? '交付门禁 Ready' : '交付阻塞 ' + String(blockers.length), blockers.length === 0 ? 'ready' : 'blocking'),
      );
      const wrap = document.createElement('div');
      wrap.className = 'inline';
      for (const status of statuses) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = statusLabels[status] || status;
        button.disabled = status === item.status;
        if (status === 'delivered' && item.status !== 'delivered' && blockers.length > 0) {
          button.disabled = true;
          button.classList.add('gate-blocked');
          button.title = deliveryGateButtonReason(blockers);
          button.setAttribute('aria-label', deliveryGateButtonReason(blockers));
        }
        button.addEventListener('click', () => transitionItem(item.id, status));
        wrap.append(button);
      }
      section.append(title, summary, wrap);
      return section;
    }

    async function transitionItem(id, status) {
      try {
        await api('/api/work-items/' + encodeURIComponent(id) + '/transition', {
          method: 'POST',
          body: JSON.stringify({ status }),
        });
        await loadBoard();
        setMessage('状态已更新');
      } catch (error) {
        setMessage(error.message, true);
      }
    }

    function defaultAuditFilters() {
      return {
        actorId: '',
        action: '',
        targetType: '',
        targetId: '',
        from: '',
        to: '',
        limit: '50',
      };
    }

    function auditLimit(value) {
      return ['25', '50', '100', '200'].includes(value) ? value : '50';
    }

    function auditDateTimestamp(value, endOfDay = false) {
      if (!value) return '';
      const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00.000';
      const date = new Date(value + suffix);
      return Number.isNaN(date.getTime()) ? '' : String(date.getTime());
    }

    function auditQueryString() {
      const filters = state.audit.filters;
      const params = new URLSearchParams();
      if (filters.actorId) params.set('actorId', filters.actorId);
      if (filters.action) params.set('action', filters.action);
      if (filters.targetType) params.set('targetType', filters.targetType);
      if (filters.targetId) params.set('targetId', filters.targetId);
      const from = auditDateTimestamp(filters.from);
      const to = auditDateTimestamp(filters.to, true);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      params.set('limit', auditLimit(filters.limit));
      return params.toString();
    }

    async function loadProjectAuditEvents() {
      if (!state.projectId) {
        state.audit.events = [];
        state.audit.error = '';
        state.audit.loading = false;
        return;
      }
      state.audit.loading = true;
      state.audit.error = '';
      try {
        const query = auditQueryString();
        const payload = await api(
          '/api/v1/projects/' + encodeURIComponent(state.projectId) + '/audit-events' + (query ? '?' + query : ''),
        );
        state.audit.events = payload.auditEvents || [];
      } catch (error) {
        state.audit.events = [];
        state.audit.error = error.message;
      } finally {
        state.audit.loading = false;
      }
    }

    async function loadBusinessCrudCoverage() {
      if (!state.projectId) {
        state.businessCrud.data = null;
        state.businessCrud.error = '';
        state.businessCrud.loading = false;
        return;
      }
      state.businessCrud.loading = true;
      state.businessCrud.error = '';
      try {
        state.businessCrud.data = await api(
          '/api/v1/projects/' + encodeURIComponent(state.projectId) + '/business-crud',
        );
      } catch (error) {
        state.businessCrud.data = null;
        state.businessCrud.error = error.message;
      } finally {
        state.businessCrud.loading = false;
      }
    }

    async function loadWorkItemAuditEvents(workItemId) {
      const payload = await api(
        '/api/v1/work-items/' + encodeURIComponent(workItemId) + '/audit-events?limit=12',
      );
      return payload.auditEvents || [];
    }

    async function applyAuditFilters(form) {
      state.audit.filters = {
        actorId: form.elements.actorId.value.trim(),
        action: form.elements.auditAction.value,
        targetType: form.elements.auditTargetType.value,
        targetId: form.elements.targetId.value.trim(),
        from: form.elements.from.value,
        to: form.elements.to.value,
        limit: auditLimit(form.elements.limit.value),
      };
      state.audit.loading = true;
      renderHealth();
      renderBoard();
      await loadProjectAuditEvents();
      renderHealth();
      renderBoard();
      setMessage(state.audit.error ? state.audit.error : '审计筛选已应用', Boolean(state.audit.error));
    }

    async function clearAuditFilters() {
      state.audit.filters = defaultAuditFilters();
      state.audit.loading = true;
      renderHealth();
      renderBoard();
      await loadProjectAuditEvents();
      renderHealth();
      renderBoard();
      setMessage(state.audit.error ? state.audit.error : '审计筛选已清空', Boolean(state.audit.error));
    }

    async function selectItem(id) {
      state.selectedId = id;
      renderBoard();
      renderTree();
      await renderDetail();
    }

    function clearWorkItemSelection() {
      state.selectedId = null;
      state.selectedBacklogIds.clear();
    }

    async function loadProjects() {
      const payload = await api('/api/projects');
      state.projects = payload.projects || [];
      if (!state.projectId && state.projects[0]) state.projectId = state.projects[0].id;
      renderProjectSelect();
    }

    async function loadMilestones() {
      if (!state.projectId) {
        state.milestones = [];
      } else {
        const params = new URLSearchParams({ projectId: state.projectId });
        const payload = await api('/api/milestones?' + params.toString());
        state.milestones = payload.milestones || [];
      }
      renderMilestones();
      renderMilestoneSelects();
    }

    async function loadIntake() {
      if (!state.projectId) {
        state.intakeSessions = [];
        state.intakeBundle = null;
        state.selectedIntakeSessionId = '';
        syncIntakeCandidateSelection();
        renderIntakeSessions();
        return;
      }
      const payload = await api(
        '/api/v1/projects/' + encodeURIComponent(state.projectId) + '/intake/sessions',
      );
      state.intakeSessions = payload.sessions || [];
      if (
        state.selectedIntakeSessionId &&
        !state.intakeSessions.some((session) => session.id === state.selectedIntakeSessionId)
      ) {
        state.selectedIntakeSessionId = '';
      }
      if (!state.selectedIntakeSessionId && state.intakeSessions[0]) {
        state.selectedIntakeSessionId = state.intakeSessions[0].id;
      }
      state.intakeBundle = state.selectedIntakeSessionId
        ? await api('/api/v1/intake/sessions/' + encodeURIComponent(state.selectedIntakeSessionId))
        : null;
      syncIntakeCandidateSelection();
      renderIntakeSessions();
    }

    async function submitIntakeMessage(form) {
      if (!state.selectedIntakeSessionId) {
        setMessage('请先选择录入会话', true);
        return;
      }
      const body = form.elements.body.value.trim();
      const files = Array.from(form.elements.files.files || []);
      if (!body && files.length === 0) {
        setMessage('请输入需求想法或选择附件', true);
        return;
      }
      try {
        const sourceDocumentIds = await uploadIntakeFiles(files);
        await api('/api/v1/intake/sessions/' + encodeURIComponent(state.selectedIntakeSessionId) + '/messages', {
          method: 'POST',
          body: JSON.stringify({
            role: 'user',
            author: state.auth.principal ? state.auth.principal.displayName : 'web',
            body,
            sourceDocumentIds,
          }),
        });
        form.reset();
        await loadIntake();
        renderBoard();
        await renderDetail();
        setMessage('录入内容已保存');
      } catch (error) {
        setMessage(error.message, true);
      }
    }

    async function uploadIntakeFiles(files) {
      const ids = [];
      for (const file of files) {
        const payload = await fileToIntakePayload(file);
        const sourceDocument = await api(
          '/api/v1/intake/sessions/' + encodeURIComponent(state.selectedIntakeSessionId) + '/source-documents',
          {
            method: 'POST',
            body: JSON.stringify(payload),
          },
        );
        ids.push(sourceDocument.id);
      }
      return ids;
    }

    async function fileToIntakePayload(file) {
      const kind = intakeKindForFile(file);
      const textLike = kind === 'markdown' || kind === 'plain-text' || kind === 'text';
      const bytes = new Uint8Array(await file.arrayBuffer());
      const extractedText = textLike ? new TextDecoder().decode(bytes).slice(0, 800000) : '';
      return {
        kind,
        name: file.name,
        mimeType: file.type || '',
        size: file.size,
        contentBase64: bytesToBase64(bytes),
        ...(extractedText ? { extractedText, parseStatus: 'parsed' } : {}),
      };
    }

    function bytesToBase64(bytes) {
      let binary = '';
      const chunk = 0x8000;
      for (let index = 0; index < bytes.length; index += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
      }
      return btoa(binary);
    }

    function intakeKindForFile(file) {
      const type = file.type || '';
      const name = file.name.toLowerCase();
      if (type.startsWith('image/')) return 'image';
      if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
      if (
        type === 'application/msword' ||
        type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        name.endsWith('.doc') ||
        name.endsWith('.docx')
      ) {
        return 'word';
      }
      if (type === 'text/markdown' || name.endsWith('.md') || name.endsWith('.markdown')) return 'markdown';
      if (type.startsWith('text/') || name.endsWith('.txt')) return 'plain-text';
      return 'file';
    }

    async function analyzeIntake() {
      if (!state.selectedIntakeSessionId) {
        setMessage('请先选择录入会话', true);
        return;
      }
      try {
        state.intakeBundle = await api(
          '/api/v1/intake/sessions/' + encodeURIComponent(state.selectedIntakeSessionId) + '/analyze',
          { method: 'POST', body: JSON.stringify({}) },
        );
        await loadIntake();
        renderBoard();
        await renderDetail();
        setMessage('候选需求已生成');
      } catch (error) {
        setMessage(error.message, true);
      }
    }

    async function approveIntake() {
      if (!state.selectedIntakeSessionId) {
        setMessage('请先选择录入会话', true);
        return;
      }
      const candidateIds = selectedDraftIntakeCandidateIds();
      if (candidateIds.length === 0) {
        setMessage('请选择要批准的候选需求', true);
        return;
      }
      try {
        await api(
          '/api/v1/intake/sessions/' + encodeURIComponent(state.selectedIntakeSessionId) + '/approve',
          {
            method: 'POST',
            body: JSON.stringify({
              candidateIds,
              actorId: state.auth.principal ? state.auth.principal.username || state.auth.principal.displayName : 'web',
            }),
          },
        );
        await loadBoard();
        setMessage('候选需求已生成正式工作项');
      } catch (error) {
        setMessage(error.message, true);
      }
    }

    async function updateIntakeCandidateMilestone(candidateId, milestoneId) {
      try {
        await api('/api/v1/intake/candidates/' + encodeURIComponent(candidateId), {
          method: 'PATCH',
          body: JSON.stringify({ milestoneId }),
        });
        await loadIntake();
        renderBoard();
        await renderDetail();
        setMessage('候选需求里程碑已更新');
      } catch (error) {
        setMessage(error.message, true);
      }
    }

    function lines(value) {
      return value
        .split('\\n')
        .map((line) => line.trim())
        .filter(Boolean);
    }

    async function updateIntakeCandidateFields(candidateId, form) {
      const title = form.elements.title.value.trim();
      if (!title) {
        setMessage('候选需求标题不能为空', true);
        return;
      }
      try {
        await api('/api/v1/intake/candidates/' + encodeURIComponent(candidateId), {
          method: 'PATCH',
          body: JSON.stringify({
            title,
            body: form.elements.body.value.trim(),
            analysis: form.elements.analysis.value.trim(),
            design: form.elements.design.value.trim(),
            acceptance: lines(form.elements.acceptance.value),
            openQuestions: lines(form.elements.openQuestions.value),
          }),
        });
        await loadIntake();
        renderBoard();
        await renderDetail();
        setMessage('候选需求字段已保存');
      } catch (error) {
        setMessage(error.message, true);
      }
    }

    async function updateIntakeCandidateStatus(candidateId, status) {
      try {
        await api('/api/v1/intake/candidates/' + encodeURIComponent(candidateId), {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
        await loadIntake();
        renderBoard();
        await renderDetail();
        setMessage('候选需求已更新');
      } catch (error) {
        setMessage(error.message, true);
      }
    }

    async function loadBoard() {
      activeArea();
      if (!state.projectId) {
        state.workItems = [];
        state.teamMembers = [];
        state.intakeSessions = [];
        state.intakeBundle = null;
        state.selectedIntakeSessionId = '';
        syncIntakeCandidateSelection();
        state.selectedBacklogIds.clear();
        state.audit.events = [];
        state.audit.error = '';
        state.audit.loading = false;
        state.businessCrud.data = null;
        state.businessCrud.error = '';
        state.businessCrud.loading = false;
        state.cards = [];
        state.mainBoard = null;
        renderHealth();
        renderBoard();
        renderTree();
        renderIntakeSessions();
        renderParentSelect();
        renderMilestones();
        renderMilestoneSelects();
        renderTeamMembers();
        renderTeamSelects();
        await renderDetail();
        return;
      }
      const path =
        '/api/v1/projects/' +
        encodeURIComponent(state.projectId) +
        '/main-board?viewId=' +
        encodeURIComponent(
          state.areaId === 'settings' || state.areaId === 'intake' ? 'requirement-board' : state.viewId,
        );
      state.mainBoard = await api(path);
      state.cards = state.mainBoard.cards || [];
      state.milestones = state.mainBoard.milestones || [];
      state.teamMembers = state.mainBoard.teamMembers || [];
      state.workItems = state.mainBoard.workItems || state.cards.map((card) => card.workItem);
      loadBacklogPreferences();
      reconcileBacklogSelection();
      if (state.areaId === 'intake') await loadIntake();
      if (state.areaId === 'settings' && state.viewId === 'business-crud') await loadBusinessCrudCoverage();
      if (state.areaId === 'settings' && state.viewId === 'audit-board') await loadProjectAuditEvents();
      if (state.selectedId && !itemById(state.selectedId)) state.selectedId = null;
      renderHealth();
      renderBoard();
      renderTree();
      renderParentSelect();
      renderMilestones();
      renderMilestoneSelects();
      renderTeamMembers();
      renderTeamSelects();
      await renderDetail();
    }

    async function bootstrap() {
      $('write-token').value = state.token;
      renderAuthPanel();
      try {
        const session = await loadSession();
        if (session.auth && session.auth.enabled && !session.authenticated) {
          renderWorkspaceChrome();
          updateLocationState();
          setMessage('请登录后访问项目看板');
          return;
        }
        const status = await api('/api/status');
        $('surface-url').textContent = status.web.url || '';
        await loadProjects();
        await loadMilestones();
        await loadBoard();
        setMessage(state.projectId ? '已连接' : '请先创建项目');
      } catch (error) {
        setMessage(error.message, true);
      }
    }

    $('project-select').addEventListener('change', async (event) => {
      state.projectId = event.target.value;
      clearWorkItemSelection();
      updateLocationState();
      await loadMilestones();
      await loadBoard();
    });

    $('view-select').addEventListener('change', async (event) => {
      state.viewId = event.target.value;
      state.areaId = areaForView(state.viewId);
      clearWorkItemSelection();
      updateLocationState();
      await loadBoard();
    });

    document.querySelectorAll('.module-rail [data-area-id]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (button.disabled) return;
        const previousAreaId = state.areaId;
        state.areaId = normalizeAreaId(button.dataset.areaId || '');
        const area = activeArea();
        if (area.views.length > 0 && !area.views.includes(state.viewId)) {
          state.viewId = area.views[0];
        }
        if (state.areaId !== previousAreaId) clearWorkItemSelection();
        renderWorkspaceChrome();
        updateLocationState();
        await loadBoard();
      });
    });

    $('refresh-button').addEventListener('click', async () => {
      await loadProjects();
      await loadMilestones();
      await loadBoard();
      setMessage('已刷新');
    });

    $('save-token').addEventListener('click', () => {
      saveTokenValue($('write-token').value);
    });

    $('login-region').addEventListener('change', async (event) => {
      try {
        await loadProviders(event.target.value);
      } catch (error) {
        setMessage(error.message, true);
      }
    });

    $('login-form').addEventListener('submit', (event) => {
      event.preventDefault();
      void login(event.currentTarget);
    });

    $('logout-button').addEventListener('click', () => {
      void logout();
    });

    $('project-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      await createProjectFromValues(
        $('project-name').value,
        $('project-description').value,
        () => {
          $('project-name').value = '';
          $('project-description').value = '';
        },
      );
    });

    $('intake-session-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!state.projectId) {
        setMessage('请先选择项目', true);
        return;
      }
      const title = $('intake-session-title').value.trim();
      if (!title) {
        setMessage('录入主题不能为空', true);
        return;
      }
      try {
        const session = await api(
          '/api/v1/projects/' + encodeURIComponent(state.projectId) + '/intake/sessions',
          {
            method: 'POST',
            body: JSON.stringify({
              title,
              sourceChannel: 'web-chat',
              submitter: $('intake-submitter').value.trim(),
            }),
          },
        );
        state.areaId = 'intake';
        state.viewId = 'intake-board';
        state.selectedIntakeSessionId = session.id;
        $('intake-session-title').value = '';
        $('intake-submitter').value = '';
        updateLocationState();
        await loadBoard();
        setMessage('录入会话已创建');
      } catch (error) {
        setMessage(error.message, true);
      }
    });

    function dateToTimestamp(value) {
      if (!value) return null;
      return new Date(value + 'T00:00:00.000Z').getTime();
    }

    $('milestone-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!state.projectId) {
        setMessage('请先选择项目', true);
        return;
      }
      const title = $('milestone-title').value.trim();
      if (!title) {
        setMessage('里程碑标题不能为空', true);
        return;
      }
      try {
        await api('/api/milestones', {
          method: 'POST',
          body: JSON.stringify({
            projectId: state.projectId,
            title,
            goal: $('milestone-goal').value.trim(),
            status: $('milestone-status').value,
            startDate: dateToTimestamp($('milestone-start').value),
            dueDate: dateToTimestamp($('milestone-due').value),
          }),
        });
        $('milestone-title').value = '';
        $('milestone-goal').value = '';
        $('milestone-start').value = '';
        $('milestone-due').value = '';
        await loadMilestones();
        await loadBoard();
        setMessage('里程碑已创建');
      } catch (error) {
        setMessage(error.message, true);
      }
    });

    $('team-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!state.projectId) {
        setMessage('请先选择项目', true);
        return;
      }
      const displayName = $('team-display-name').value.trim();
      if (!displayName) {
        setMessage('成员名称不能为空', true);
        return;
      }
      const roleId = $('team-role').value;
      try {
        await api('/api/v1/projects/' + encodeURIComponent(state.projectId) + '/team/members', {
          method: 'POST',
          body: JSON.stringify({
            displayName,
            memberType: $('team-member-type').value,
            status: $('team-status').value,
            roleIds: roleId ? [roleId] : [],
            capacityUnits: Number($('team-capacity').value || 1),
            concurrentWorkLimit: Number($('team-wip').value || 1),
          }),
        });
        $('team-display-name').value = '';
        await loadBoard();
        setMessage('团队成员已创建');
      } catch (error) {
        setMessage(error.message, true);
      }
    });

    $('item-type').addEventListener('change', () => {
      renderParentSelect();
    });

    $('item-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!state.projectId) {
        setMessage('请先选择项目', true);
        return;
      }
      const title = $('item-title').value.trim();
      if (!title) {
        setMessage('标题不能为空', true);
        return;
      }
      const acceptance = $('item-acceptance').value
        .split('\\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const parentId = $('parent-select').value || null;
      try {
        const item = await api('/api/work-items', {
          method: 'POST',
          body: JSON.stringify({
            projectId: state.projectId,
            type: $('item-type').value,
            parentId,
            milestoneId: $('item-milestone').value || null,
            title,
            body: $('item-body').value.trim(),
            sourceInput: $('item-source-input').value.trim(),
            decompositionReason: $('item-decomposition-reason').value.trim(),
            acceptance,
          }),
        });
        state.selectedId = item.id;
        $('item-title').value = '';
        $('item-body').value = '';
        $('item-source-input').value = '';
        $('item-decomposition-reason').value = '';
        $('item-acceptance').value = '';
        await loadBoard();
        setMessage('工作项已创建');
      } catch (error) {
        setMessage(error.message, true);
      }
    });

    bootstrap();
  </script>
</body>
</html>`;
}
