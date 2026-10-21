/**
 * 专家页签：拆成两个视图。
 *
 *   - ExpertsTab（默认）：专家广场（PlazaView）。
 *   - MyExpertsPage：本地专家管理 —— 我的专家（可编辑，注册成真实 Agent Preset）
 *     + 专家团（官方预设，只读），从顶栏「我的专家」进入。
 *
 * 卡片主操作（圆形按钮）= 设为默认；⋯ 菜单里是 编辑 / 复制 / 查看组合 / 删除。
 */
import { type T } from './components.js';
/** 专家广场（默认视图）。 */
export declare function ExpertsTab({ t, query }: {
    t: T;
    query: string;
}): import("react").JSX.Element;
/** 我的专家页面（顶栏「我的专家」进入；「新建专家」按钮也在本页顶栏）。 */
export declare function MyExpertsPage({ t, query, addOpen, onCloseAdd, }: {
    t: T;
    query: string;
    /** 顶栏「新建专家」的开关（打开即弹新建表单）。 */
    addOpen: boolean;
    onCloseAdd: () => void;
}): import("react").JSX.Element;
