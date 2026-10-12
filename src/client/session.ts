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

/** 最小结构：会话列表快照。 */
interface SessionsLike {
  list?: { getSnapshot?: () => { ids?: string[] } };
  binding?: (id: string) => { session?: { prompt?: PromptFn } } | undefined;
}

type PromptFn = (
  content: Array<{ type: 'text'; text: string }>,
  mode: 'queue' | 'steer',
) => Promise<{ ok: boolean; error?: { message?: string; code?: string } }>;

/** 发送结果。 */
export interface SendOutcome {
  ok: boolean;
  /** sent = 已投递到会话；copied = 已复制到剪贴板。 */
  mode: 'sent' | 'copied';
  error?: string;
}

/** 侧边栏里当前选中的会话 id。 */
function selectedSessionId(): string | undefined {
  try {
    const element = document.querySelector('[data-row-key][aria-selected="true"]');
    const key = element?.getAttribute('data-row-key');
    if (typeof key === 'string' && key !== '') return key;
  } catch {
    /* DOM 不可用时忽略 */
  }
  return undefined;
}

/** 把面板切回会话（best-effort）。 */
function showConversation(ctx: ClientCtx): void {
  try {
    const layout = ctx.get?.('layout') as { selectPanel?: (id: string) => void } | undefined;
    layout?.selectPanel?.('conversation');
  } catch {
    /* 忽略 */
  }
}

/** 复制到剪贴板（best-effort）。 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** 发送提示词：优先投递进会话，失败则复制到剪贴板。 */
export async function sendPrompt(ctx: ClientCtx, text: string): Promise<SendOutcome> {
  try {
    const sessions = ctx.get?.('sessions') as SessionsLike | undefined;
    const sessionId = selectedSessionId() ?? sessions?.list?.getSnapshot?.().ids?.[0];
    if (sessions !== undefined && typeof sessionId === 'string') {
      const binding = sessions.binding?.(sessionId);
      const prompt = binding?.session?.prompt;
      if (typeof prompt === 'function') {
        const result = await prompt([{ type: 'text', text }], 'queue');
        if (result?.ok === true) {
          showConversation(ctx);
          return { ok: true, mode: 'sent' };
        }
        return {
          ok: false,
          mode: 'sent',
          error: result?.error?.message ?? '发送失败',
        };
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const copied = await copyToClipboard(text);
    return { ok: copied, mode: 'copied', error: message };
  }
  const copied = await copyToClipboard(text);
  return copied
    ? { ok: true, mode: 'copied' }
    : { ok: false, mode: 'copied', error: '当前部署没有会话 API，且剪贴板不可用' };
}
