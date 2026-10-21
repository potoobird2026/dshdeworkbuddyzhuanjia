/**
 * 技能页签：拆成两个视图。
 *
 *   - SkillsTab（默认）：技能广场（PlazaView）。
 *   - MySkillsPage：本地技能管理 —— 推荐横滑区 + 分类 chips + 卡片网格，
 *     从顶栏「我的技能」进入。
 *
 * 卡片主操作（右上角圆形按钮）= 启用/停用（改写 SKILL.md 的
 * disable-model-invocation）；编辑 / 删除在 ⋯ 菜单里。
 */
import { type T } from './components.js';
import type { ClientCtx } from './context.js';
/** 技能广场（默认视图）。 */
export declare function SkillsTab({ t, query }: {
    t: T;
    query: string;
}): import("react").JSX.Element;
/** 我的技能页面（顶栏「我的技能」进入；「添加技能」按钮也在本页顶栏）。 */
export declare function MySkillsPage({ t, query, cwd, addOpen, onCloseAdd, ctx, }: {
    t: T;
    query: string;
    cwd?: string;
    /** 顶栏「添加技能」的开关（打开即弹三选一）。 */
    addOpen: boolean;
    onCloseAdd: () => void;
    ctx: ClientCtx;
}): import("react").JSX.Element;
