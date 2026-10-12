/**
 * 面板样式（对齐 WorkBuddy「专家·技能·连接器」的视觉语言）。
 *
 * 必须**在 factory 闭包内**注入（模块体副作用只在 factory 物化时执行）：
 * loader 会在这个时机调用 `claimStyles(id)` 把没有 `data-plugin` 标记的
 * `<style>` 归到本包名下，并在插件卸载时按 `data-plugin` 回收，避免样式泄漏。
 *
 * 颜色：优先跟随 DSH 主题变量（`--dsw-alias-*`），但**设计基线是浅色**，
 * 每个变量都给浅色回退值，因此在深色主题下也不会失去对比度。
 */

/** 样式标记（loader 用 data-plugin-css 去重同一份样式）。 */
export const STYLE_ID = 'dsh-squares/client.css';

/** 面板 CSS。 */
export const CSS = `
.adk-root {
  --adk-page: var(--dsw-alias-bg-l1, #f5f6f8);
  --adk-surface: var(--dsw-alias-bg-base, #ffffff);
  --adk-line: var(--dsw-alias-border-l1, #e9eaee);
  --adk-line-strong: var(--dsw-alias-border-l2, #dcdee3);
  --adk-text: var(--dsw-alias-label-primary, #1f2329);
  --adk-muted: var(--dsw-alias-label-secondary, #8a8f99);
  --adk-body: var(--dsw-alias-label-tertiary, #5b6068);
  --adk-chip: var(--dsw-alias-bg-l2, #f2f3f5);
  --adk-ink: #1f2329;
  --adk-danger: var(--dsw-alias-label-danger, #e5484d);
  --adk-ok: var(--dsw-alias-label-success, #16a34a);
  --adk-radius: 14px;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--adk-text);
  background: var(--adk-page);
  font-size: 13px;
  line-height: 1.5;
}
.adk-root * { box-sizing: border-box; }

/* ---------------------------------------------------------------- 顶栏 */
.adk-top {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px 10px;
  flex: none;
}
.adk-tabs { display: inline-flex; align-items: center; gap: 2px; }
.adk-tab {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 15px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--adk-body);
  font-size: 13.5px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.adk-tab:hover { background: var(--adk-chip); }
.adk-tab[data-active="true"] { background: var(--adk-ink); color: #fff; }
.adk-tab[data-active="true"]:hover { background: var(--adk-ink); }
.adk-top-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }

.adk-back {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 8px 14px;
  border: 1px solid var(--adk-line);
  border-radius: 999px;
  background: var(--adk-surface);
  color: var(--adk-text);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;
}
.adk-back:hover { background: var(--adk-chip); }
.adk-page-title { font-size: 15px; font-weight: 600; color: var(--adk-text); }

.adk-search {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 220px;
  padding: 8px 14px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--adk-chip);
  color: var(--adk-muted);
}
.adk-search:focus-within { border-color: var(--adk-line-strong); background: var(--adk-surface); }
.adk-search input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--adk-text);
  font-size: 13px;
  font-family: inherit;
}
.adk-search input::placeholder { color: var(--adk-muted); }

.adk-action {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  border: 1px solid var(--adk-line);
  border-radius: 999px;
  background: var(--adk-surface);
  color: var(--adk-text);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;
}
.adk-action:hover:not(:disabled) { background: var(--adk-chip); }
.adk-action:disabled { opacity: 0.45; cursor: not-allowed; }
.adk-action[data-primary="true"] { background: var(--adk-ink); color: #fff; border-color: var(--adk-ink); }
.adk-action[data-primary="true"]:hover:not(:disabled) { opacity: 0.88; background: var(--adk-ink); }
.adk-action[data-danger="true"] { color: var(--adk-danger); }

/* ------------------------------------------------------------ 提示条 */
.adk-banner {
  margin: 0 20px 10px;
  padding: 9px 12px;
  border: 1px solid var(--adk-line);
  border-radius: 10px;
  background: var(--adk-surface);
  color: var(--adk-body);
  font-size: 12.5px;
  white-space: pre-wrap;
}
.adk-banner[data-tone="error"] { border-color: var(--adk-danger); color: var(--adk-danger); }

/* -------------------------------------------------------------- 主体 */
.adk-body { flex: 1; min-height: 0; overflow: auto; padding: 4px 20px 32px; }
.adk-section { margin-bottom: 26px; }
.adk-section-head { display: flex; align-items: center; gap: 12px; margin: 8px 0 12px; }
.adk-section-title { font-size: 17px; font-weight: 600; letter-spacing: 0.2px; }
.adk-section-count { font-size: 12px; color: var(--adk-muted); }
.adk-section-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }

.adk-subtabs { display: flex; align-items: center; gap: 16px; }
.adk-subtab {
  padding: 2px 0;
  border: none;
  background: none;
  color: var(--adk-muted);
  font-size: 13.5px;
  cursor: pointer;
}
.adk-subtab[data-active="true"] { color: var(--adk-text); font-weight: 600; }

.adk-sort { display: inline-flex; padding: 2px; border-radius: 9px; background: var(--adk-chip); }
.adk-sort button {
  padding: 4px 11px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--adk-body);
  font-size: 12.5px;
  cursor: pointer;
}
.adk-sort button[data-active="true"] { background: var(--adk-surface); color: var(--adk-text); font-weight: 600; }

.adk-chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 14px; scrollbar-width: thin; }
.adk-chips::-webkit-scrollbar { height: 6px; }
.adk-chips::-webkit-scrollbar-thumb { background: var(--adk-line-strong); border-radius: 3px; }
.adk-chip {
  flex: none;
  padding: 6px 13px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: var(--adk-chip);
  color: var(--adk-body);
  font-size: 12.5px;
  cursor: pointer;
  white-space: nowrap;
}
.adk-chip:hover { background: var(--adk-line); }
.adk-chip[data-active="true"] { background: var(--adk-ink); color: #fff; }

/* -------------------------------------------------------------- 卡片 */
.adk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(296px, 1fr)); gap: 14px; }
.adk-strip { display: flex; gap: 14px; overflow-x: auto; padding-bottom: 8px; }
.adk-strip > .adk-card { flex: none; width: 316px; }
.adk-strip::-webkit-scrollbar { height: 6px; }
.adk-strip::-webkit-scrollbar-thumb { background: var(--adk-line-strong); border-radius: 3px; }

.adk-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 15px 16px 14px;
  border: 1px solid var(--adk-line);
  border-radius: var(--adk-radius);
  background: var(--adk-surface);
  transition: box-shadow 0.15s, border-color 0.15s;
}
.adk-card:hover { border-color: var(--adk-line-strong); box-shadow: 0 6px 20px rgba(16, 24, 40, 0.07); }
.adk-card[data-broken="true"] { border-color: var(--adk-danger); }
.adk-card-head { display: flex; align-items: center; gap: 12px; }
.adk-card-hit {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
  padding: 0;
  border: none;
  background: none;
  text-align: left;
  font: inherit;
  cursor: pointer;
  color: var(--adk-text);
}
.adk-card-hitblock { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
.adk-card-title-line { display: flex; align-items: center; gap: 7px; min-width: 0; }
.adk-card-hit .adk-card-title-text { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; }
.adk-card-hit:hover .adk-card-title-text { text-decoration: underline; text-underline-offset: 3px; }
.adk-card-hit .adk-card-meta { margin-top: 0; }
.adk-card-titleblock { min-width: 0; flex: 1; }
.adk-card-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 14px;
  font-weight: 600;
  color: var(--adk-text);
}
.adk-card-title-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.adk-card-title .adk-menu-wrap { flex: none; margin-left: auto; }
.adk-card-title .adk-menu-trigger { width: 24px; height: 24px; }
.adk-card-meta {
  margin-top: 3px;
  font-size: 12px;
  line-height: 1;
  color: var(--adk-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
}
.adk-card-meta span { display: inline-flex; align-items: center; gap: 3px; line-height: 1; }
.adk-card-meta span + span::before { content: '·'; margin: 0 5px; opacity: 0.6; }
.adk-card-meta span svg { flex: none; opacity: 0.85; }
/* 卡片/弹窗内的提示条：贴齐父容器，不再吃 20px 外边距。 */
.adk-card .adk-banner,
.adk-modal .adk-banner { margin: 0 0 10px; }
.adk-card-desc {
  font-size: 12.5px;
  color: var(--adk-body);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
.adk-card-desc[data-lines="2"] { -webkit-line-clamp: 2; }
.adk-tile {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: 11px;
  background: var(--adk-chip);
  font-size: 20px;
  line-height: 1;
  overflow: hidden;
}
.adk-tile svg { width: 20px; height: 20px; }
.adk-tile[data-tone="0"] { background: #eef2ff; }
.adk-tile[data-tone="1"] { background: #fef3e7; }
.adk-tile[data-tone="2"] { background: #e8f7ef; }
.adk-tile[data-tone="3"] { background: #fdeef2; }
.adk-tile[data-tone="4"] { background: #eef7fb; }
.adk-tile[data-tone="5"] { background: #f3eefc; }


.adk-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: auto; padding-top: 4px; }
.adk-tag {
  padding: 3px 9px;
  border-radius: 7px;
  background: var(--adk-chip);
  color: var(--adk-body);
  font-size: 11.5px;
  white-space: nowrap;
}
.adk-tag[data-tone="ok"] { color: var(--adk-ok); }
.adk-tag[data-tone="error"] { color: var(--adk-danger); }
.adk-tag[data-tone="accent"] { color: var(--adk-ink); background: var(--adk-line); }

/* 卡片内展开的插件行：比卡片轻一级（页面底色 + 更小圆角）。 */
.adk-rows { display: flex; flex-direction: column; gap: 8px; margin-top: 2px; }
.adk-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 9px 11px;
  border: 1px solid var(--adk-line);
  border-radius: 10px;
  background: var(--adk-page);
}
.adk-row-head { display: flex; align-items: center; gap: 10px; min-width: 0; }
.adk-row-head .adk-check { min-width: 0; }
.adk-row-title {
  min-width: 0;
  overflow: hidden;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--adk-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.adk-row-head .adk-mono {
  flex: none;
  margin-left: auto;
  max-width: 46%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* -------------------------------------------------------- 溢出菜单 */
.adk-menu-wrap { position: relative; flex: none; margin-left: 6px; }
.adk-caret { margin-left: 2px; font-size: 10px; opacity: 0.8; }
.adk-menu-wrap .adk-action .adk-caret { display: inline; }
.adk-menu-trigger {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--adk-muted);
  cursor: pointer;
}
.adk-menu-trigger:hover { background: var(--adk-chip); color: var(--adk-text); }
.adk-menu {
  position: absolute;
  right: 0;
  top: 32px;
  z-index: 30;
  display: flex;
  flex-direction: column;
  min-width: 150px;
  padding: 5px;
  border: 1px solid var(--adk-line);
  border-radius: 11px;
  background: var(--adk-surface);
  box-shadow: 0 12px 32px rgba(16, 24, 40, 0.14);
}
/* 顶栏「提交」下拉等窄菜单。 */
.adk-menu.adk-menu-compact { min-width: 0; width: max-content; max-width: 180px; }
.adk-menu-compact button { display: flex; align-items: center; gap: 7px; white-space: nowrap; }
.adk-menu-icon { display: inline-flex; align-items: center; flex: none; color: var(--adk-muted); }
.adk-menu button {
  padding: 8px 10px;
  border: none;
  border-radius: 7px;
  background: none;
  color: var(--adk-text);
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
}
.adk-menu button:hover { background: var(--adk-chip); }
.adk-menu button[data-danger="true"] { color: var(--adk-danger); }

/* 卡片内的下拉菜单：固定窄版（100px）。 */
.adk-card-head .adk-menu,
.adk-card-title .adk-menu,
.adk-card-hit .adk-menu {
  min-width: 0;
  width: 100px;
}
.adk-card-head .adk-menu button,
.adk-card-title .adk-menu button,
.adk-card-hit .adk-menu button {
  padding: 6px 10px;
  white-space: nowrap;
}

/* ------------------------------------------------------ 状态与空态 */
.adk-dot { width: 8px; height: 8px; flex: none; border-radius: 50%; background: var(--adk-muted); }
.adk-dot[data-state="connected"] { background: var(--adk-ok); }
.adk-dot[data-state="error"] { background: var(--adk-danger); }
.adk-dot[data-state="connecting"] { background: #d4a017; }
.adk-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 36px 0;
  color: var(--adk-muted);
  font-size: 13px;
}
.adk-loading { min-height: 220px; display: flex; align-items: center; justify-content: center; color: var(--adk-muted); transform: translateY(120px); }
.adk-detail-desc {
  margin-top: 2px;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--adk-body);
  word-break: break-word;
  white-space: pre-line;
  max-height: 180px;
  overflow-y: auto;
}
.adk-detail-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 0;
  margin: 2px 0 14px;
  font-size: 12px;
  color: var(--adk-muted);
}
.adk-detail-meta span { display: inline-flex; align-items: center; gap: 3px; line-height: 1; }
.adk-detail-meta span + span::before { content: '·'; margin: 0 5px; opacity: 0.6; }
.adk-detail-meta span svg { flex: none; opacity: 0.85; }
.adk-spin { animation: adk-spin 0.9s linear infinite; }
@keyframes adk-spin { to { transform: rotate(360deg); } }
.adk-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: var(--adk-muted); word-break: break-all; }

/* ------------------------------------------------------------- 弹窗 */
.adk-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(17, 20, 24, 0.35);
}
.adk-modal {
  width: min(680px, 92vw);
  max-height: 86vh;
  overflow: auto;
  padding: 20px;
  border-radius: 16px;
  background: var(--adk-surface);
  color: var(--adk-text);
  font-size: 13px;
  box-shadow: 0 24px 60px rgba(16, 24, 40, 0.24);
}
.adk-modal-title { margin-bottom: 14px; font-size: 16px; font-weight: 600; }
.adk-modal-subtitle { margin-top: 3px; font-size: 11.5px; font-weight: 400; line-height: 1.6; color: var(--adk-muted); }
.adk-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
.adk-field > label { font-size: 12px; color: var(--adk-muted); }
.adk-input, .adk-select, .adk-textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--adk-line);
  border-radius: 9px;
  background: var(--adk-surface);
  color: var(--adk-text);
  font-size: 13px;
  font-family: inherit;
  outline: none;
}
.adk-input:focus, .adk-select:focus, .adk-textarea:focus { border-color: var(--adk-line-strong); }
.adk-textarea { min-height: 92px; resize: vertical; }
.adk-textarea[data-tall="true"] { min-height: 150px; }
.adk-checkrow { display: flex; flex-wrap: wrap; gap: 10px 14px; max-height: 168px; overflow: auto; }
.adk-check { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--adk-body); cursor: pointer; }
.adk-inline { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }
.adk-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.adk-hint { font-size: 11.5px; color: var(--adk-muted); }
.adk-pre {
  max-height: 320px;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--adk-line);
  border-radius: 10px;
  background: var(--adk-chip);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px;
  line-height: 1.6;
  white-space: pre-wrap;
}
/* ------------------------------------------------- 选择卡 / 上传 / 组合 */
.adk-choices { display: flex; flex-direction: column; gap: 10px; }
.adk-choice {
  display: grid;
  grid-template-columns: 24px 1fr;
  grid-template-rows: auto auto;
  gap: 2px 12px;
  align-items: center;
  padding: 14px 16px;
  border: 1px solid var(--adk-line);
  border-radius: 12px;
  background: var(--adk-surface);
  color: var(--adk-text);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.adk-choice:hover { border-color: var(--adk-line-strong); background: var(--adk-chip); }
.adk-choice > svg { grid-row: 1 / span 2; color: var(--adk-body); }
.adk-choice-title { font-size: 13.5px; font-weight: 600; }
.adk-choice-desc { font-size: 12px; color: var(--adk-muted); }

.adk-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 26px 16px;
  border: 1px dashed var(--adk-line-strong);
  border-radius: 12px;
  background: var(--adk-surface);
  color: var(--adk-body);
  text-align: center;
}
.adk-drop[data-over="true"] { border-color: var(--adk-ink); background: var(--adk-chip); }
.adk-drop-title { font-size: 13.5px; font-weight: 600; color: var(--adk-text); }
.adk-requirements { margin-top: 16px; font-size: 12.5px; color: var(--adk-body); line-height: 1.8; }

.adk-composer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--adk-line);
  border-radius: 999px;
  background: var(--adk-surface);
}
.adk-composer:focus-within { border-color: var(--adk-line-strong); }
.adk-skill-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--adk-chip);
  color: var(--adk-text);
  font-size: 12px;
  white-space: nowrap;
  flex: none;
}
.adk-composer-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--adk-text);
  font-size: 13.5px;
  font-family: inherit;
}
`;

/** 在 factory 闭包内注入样式（幂等）。 */
export function injectStyles(): void {
  if (typeof document === 'undefined') return;
  const selector = `style[data-plugin-css="${STYLE_ID}"]`;
  if (document.querySelector(selector) !== null) return;
  const tag = document.createElement('style');
  tag.dataset.plugin = 'dsh-squares';
  tag.dataset.pluginCss = STYLE_ID;
  tag.textContent = CSS;
  document.head.appendChild(tag);
}
