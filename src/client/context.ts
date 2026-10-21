/**
 * 浏览器侧的 Cordis 上下文最小类型面。
 *
 * 客户端半刻意**不**导入 `@deepseek-ai/dsh-client-ui-slots` 等包：
 *   - 运行时只需要 `ctx.slots` / `ctx.locale` 两个对象上的方法；
 *   - 类型导入会拉到未发布的类型路径，且擦除后不留运行时依赖（见
 *     scripts/check-client-bundle.mjs 对 require() 说明符的断言）。
 */

/** 组件可用的插槽席位（注册进 sidebar.panellist 时是 {size, active}）。 */
export interface SlotOwnerProps {
  size?: number;
  active?: boolean;
}

/** 插槽注册描述（只列出本插件用到的字段）。 */
export interface SlotRegistration {
  name: string;
  key?: string;
  id?: string;
  order?: number;
  label?: () => string;
  locale?: string;
}

/** 插槽服务（由 dsh-client-ui-renderer 提供）。 */
export interface SlotsService {
  inject(slot: string, callback: () => unknown): unknown;
  register(spec: SlotRegistration, component: unknown): unknown;
}

/** 文案服务（由 dsh-client-locale 提供）。 */
export interface LocaleService {
  register(namespace: string, dictionaries: Record<string, Record<string, string>>): unknown;
  bind(namespace: string): (key: string, vars?: Record<string, string | number>) => string;
  subscribe?(listener: () => void): unknown;
  /** 当前语言（部分版本提供）。 */
  current?: () => string;
}

/** 浏览器侧上下文。 */
export interface ClientCtx {
  slots: SlotsService;
  locale: LocaleService;
  effect(callback: () => void | (() => void), label?: string): () => void;
  on?(event: string, listener: (...args: unknown[]) => void): () => void;
  /** 取子服务（sessions / layout 等），缺失时返回 undefined。 */
  get?(name: string): unknown;
  logger?: { info(...args: unknown[]): void; warn(...args: unknown[]): void };
}

/** 安全取子服务（浏览器侧没有 ctx.get 的统一实现时返回 undefined）。 */
export function maybeEffect(ctx: ClientCtx, callback: () => void | (() => void), label: string): void {
  try {
    ctx.effect(callback, label);
  } catch (error) {
    console.warn(`[square] effect failed: ${label}`, error);
  }
}
