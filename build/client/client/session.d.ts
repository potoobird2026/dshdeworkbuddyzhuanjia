/**
 * 把提示词送进会话（「AI 创建技能」等入口用）。
 *
 * DSH 客户端没有「选中会话」的公开 API（选择权在侧边栏的 UI 层），所以：
 *   1. 先读侧边栏里被选中的那一行（`[data-row-key][aria-selected="true"]`）；
 *   2. 读不到就退回到会话列表里最新的一条；
 *   3. 拿到 id 后用 `ctx.sessions.binding(id).session.prompt(...)` 发送；
 *   4. 任何一步不可用 → 退回「复制到剪贴板」，让用户自己粘到输入框。
 *
 * 全程 try/catch：这是锦上添花的入口，绝不能把面板打崩。
 */
import type { ClientCtx } from './context.js';
/** 发送结果。 */
export interface SendOutcome {
    ok: boolean;
    /** sent = 已投递到会话；copied = 已复制到剪贴板。 */
    mode: 'sent' | 'copied';
    error?: string;
}
/** 发送提示词：优先投递进会话，失败则复制到剪贴板。 */
export declare function sendPrompt(ctx: ClientCtx, text: string): Promise<SendOutcome>;
