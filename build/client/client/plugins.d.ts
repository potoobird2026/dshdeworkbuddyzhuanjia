/**
 * 插件页签：拆成两个视图。
 *
 *   - PluginsTab（默认）：插件广场（PlazaView，kind='plugin'，
 *     数据来自 awesome-dsh-plugin 目录）。
 *   - MyPluginsPage：**自己装的**插件 —— 只列 profile 的 dependencies
 *     （宿主用 `mine` 标出来，App 自带的 bundle 不列）。卡片与广场同形：
 *     点卡片打开详情弹窗，启用/禁用、卸载都在弹窗里操作。
 *
 * 与技能/连接器的区别：插件行活在宿主进程里，启停写的是 profile 的
 * cordis.patch.yml，多数变更要重启 App 才生效，所以写操作结果里的
 * warnings / application 必须原样反馈给用户，不能只当作成功处理。
 */
import { type T } from './components.js';
/** 插件广场（默认视图）。 */
export declare function PluginsTab({ t, query }: {
    t: T;
    query: string;
}): import("react").JSX.Element;
/** 我的插件页面（顶栏「我的插件」进入）：只列自己装的插件。 */
export declare function MyPluginsPage({ t, query }: {
    t: T;
    query: string;
}): import("react").JSX.Element;
