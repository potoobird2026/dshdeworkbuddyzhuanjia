/**
 * 广场视图（技能 / 专家 / 连接器 / 插件共用）。
 *
 * 数据来自宿主的 `/catalog*`：宿主侧抓公开目录（GitHub 技能库、dsh-market 预设、
 * 官方 MCP Registry、自建目录、awesome-dsh-plugin），这里只负责展示、筛选与触发安装。
 *
 * 安装一律经过确认弹窗——四类内容分别会落成文件、宿主插件组合、MCP 进程、
 * profile 插件包，确认框里展示的就是「将要发生什么」（文件清单 / 插件行 /
 * 连接参数 / 安装规格与红线能力）。
 */
import { type T } from './components.js';
/** 广场支持的种类（含插件包）。 */
export type PlazaKind = 'skill' | 'expert' | 'connector' | 'plugin';
/** 可提交到广场的种类（与广场种类一致：四类都能提交）。 */
export type SubmitKind = PlazaKind;
/** 属性。 */
export interface PlazaViewProps {
    kind: PlazaKind;
    t: T;
    /** 顶栏搜索词。 */
    query: string;
    /** 安装/卸载成功后的回调（父级刷新本地视图）。 */
    onChanged: () => void;
}
/** 提交弹窗（提交本地条目到广场）。 */
export declare function SubmitModal({ kind, t, onClose, onSubmitted, }: {
    kind: SubmitKind;
    t: T;
    onClose: () => void;
    onSubmitted: () => void;
}): import("react").JSX.Element;
/** 提交下拉菜单（顶栏 / 广场共用）：展开后选择要提交的种类。 */
export declare function SubmitMenu({ kind, t, onPick, }: {
    /** 当前页签对应的种类（排下拉第一位）。 */
    kind: SubmitKind;
    t: T;
    onPick: (next: SubmitKind) => void;
}): import("react").JSX.Element;
/** 广场视图。 */
export declare function PlazaView({ kind, t, query, onChanged }: PlazaViewProps): import("react").JSX.Element;
