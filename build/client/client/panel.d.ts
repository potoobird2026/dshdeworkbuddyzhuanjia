/**
 * 主面板：胶囊页签 + 搜索胶囊 + 右行动作的顶栏，下接内容区。
 *
 * 交互模型（v2）：
 *   - 四个页签（专家 / 技能 / 连接器 / 插件）默认只展示**广场**数据。
 *   - 顶栏右上角「我的专家 / 我的技能 / 我的 MCP / 我的插件」按钮 → 进入独立子页面，
 *     查看本地已安装内容；子页面顶部有返回按钮回到广场。
 *   - 页签内部不再有「本地/广场」切换控件。
 */
import { type T } from './components.js';
import type { ClientCtx } from './context.js';
type Tab = 'experts' | 'skills' | 'connectors' | 'plugins';
/** 面板主体。 */
export declare function SquarePage({ ctx, t, initialTab, }: {
    ctx: ClientCtx;
    t: T;
    /** 初始页签（静态预览用，默认插件页）。 */
    initialTab?: Tab;
}): import("react").JSX.Element;
export {};
