/**
 * 浏览器半入口：把 Square 挂进 Web GUI。
 *
 * 两个注册（与官方 `dsh-client-ui-plugin-manager` 同一形态）：
 *   1) `sidebar.panellist`（list 插槽）：侧边栏里的一行（图标 + 文案），
 *      `options.id` 就是它要打开的主面板 key；
 *   2) `main`（keyed 插槽）：主区域页面，`options.key` 必须与上面的 id 相同。
 *
 * 两者的对应关系由 ui-sidebar + ui-layout 完成：侧边栏行点击时
 * `ctx.layout.selectPanel(id)`，布局渲染 `main` 插槽里 key 相等的注册。
 *
 * 注意区分两个 inject：
 *   - 本文件的 `inject`（Cordis 客户端服务名）→ ['slots','locale']；
 *   - package.json 的 `dsh.client.inject`（包名顺序提示）→ 见 package.json。
 */

import { SquarePage } from './panel.js';
import type { ClientCtx } from './context.js';
import { createTranslator, NS } from './i18n.js';
import { injectStyles } from './styles.js';

/** 全局面板 id（= main 插槽 key）。 */
export const PANEL_ID = 'square';

/** 依赖的客户端服务。 */
export const inject = ['slots', 'locale'];

/** 侧边栏图标（内联 SVG，避免依赖 UI 图标包）。 */
function PanelIcon({ size }: { size?: number }) {
  const edge = typeof size === 'number' && size > 0 ? size : 16;
  return (
    <svg
      width={edge}
      height={edge}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="1.5" y="3" width="13" height="10" rx="2" />
      <path d="M5.5 3v10" />
      <path d="M8.2 6.4h4.2M8.2 9.6h4.2" />
    </svg>
  );
}

/** 客户端插件主体。 */
export function apply(ctx: ClientCtx): void {
  // 样式必须在 factory 物化时注入，loader 才会在卸载时按 data-plugin 回收。
  injectStyles();

  const t = createTranslator(ctx);

  // 侧边栏一行：id 与下面的 main key 相同。
  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register(
      {
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 30,
        label: () => t('panel.title'),
        locale: NS,
      },
      PanelIcon,
    ),
  );

  // 主区域页面。
  ctx.slots.inject('main', () =>
    ctx.slots.register(
      {
        name: 'main',
        key: PANEL_ID,
        locale: NS,
      },
      () => <SquarePage ctx={ctx} t={t} />,
    ),
  );
}
