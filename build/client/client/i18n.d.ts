/**
 * 面板文案（zh 为键集真源，en 对照补齐）。
 *
 * 走 DSH 的 locale 服务：`ctx.locale.register(NS, { zh, en })` 注册字典，
 * `ctx.locale.bind(NS)` 取到当前语言的 `t`。服务不可用（老版本/测试环境）时
 * 回退到 zh 字典的本地查找，面板仍可渲染。
 */
import type { ClientCtx } from './context.js';
/** 文案命名空间。 */
export declare const NS = "square";
/** 简体中文（键集真源）。 */
export declare const zh: Record<string, string>;
/** English. */
export declare const en: Record<string, string>;
/** 取一个翻译函数：优先 locale 服务，其次本地 zh 字典。 */
export declare function createTranslator(ctx: ClientCtx, onLocaleChange?: () => void): (key: string, vars?: Record<string, string | number>) => string;
/** `{name}` 插值。 */
export declare function format(template: string, vars?: Record<string, string | number>): string;
