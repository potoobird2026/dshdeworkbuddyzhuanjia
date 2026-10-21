/**
 * 连接器页签：拆成两个视图。
 *
 *   - ConnectorsTab（默认）：MCP 广场（PlazaView）。
 *   - MyConnectorsPage：本地连接器管理 —— MCP 服务器卡片网格 + profile 只读列表，
 *     从顶栏「我的 MCP」进入。
 *
 * 卡片主操作（圆形按钮）= 启用/停用（运行时挂载/卸载官方 dsh-mcp-client，
 * 立即生效）；⋯ 菜单里是 测试 / 重连 / 编辑 / 删除。
 */
import { type T } from './components.js';
/** MCP 广场（默认视图）。 */
export declare function ConnectorsTab({ t, query }: {
    t: T;
    query: string;
}): import("react").JSX.Element;
/** 我的连接器页面（顶栏「我的 MCP」进入；「自定义连接器」按钮也在本页顶栏）。 */
export declare function MyConnectorsPage({ t, query, addOpen, onCloseAdd, }: {
    t: T;
    query: string;
    /** 顶栏「自定义连接器」的开关（打开即弹新建表单）。 */
    addOpen: boolean;
    onCloseAdd: () => void;
}): import("react").JSX.Element;
