/**
 * profile 插件（bundle）视图。
 *
 * 两条数据路径，同一种输出：
 *   1) 宿主提供 `ctx.pluginManager`（`@deepseek-ai/dsh-plugin-manager`）时，
 *      用它的 `listPlugins()/listBundles()`——那是 profile 组合的权威答案
 *      （bundle 选中状态、加载错误、每行的启停与被谁覆盖都在里面）；
 *   2) 没有该服务的部署（老 profile / headless）退化成**直接读 profile 清单**：
 *      `package.json` 的 dependencies 与 `dsh.profile.bundles`，只读展示。
 *
 * 所有上游字段都按可选处理：宿主版本间可能增减字段，缺了就兜底，不抛错。
 */
import type { BundleInfoLike, ChangeResultLike, LocalizedTextLike, PluginEntryInfoLike } from './capabilities.js';
import type { HostCtx } from './capabilities.js';
import type { CatalogItem } from './catalog.js';
import type { PluginBundleRow, PluginChangeResult, PluginEntryRow } from './types.js';
/** 归一后的本地插件视图（bundle + 行）。 */
export interface NormalizedPlugins {
    bundles: PluginBundleRow[];
    rows: PluginEntryRow[];
}
/** 取本地化文案（zh → en → 原串 → 兜底）。 */
export declare function localizedText(value: LocalizedTextLike | undefined, fallback?: string): string;
/** bundle 的 error 字段可能是对象或字符串。 */
export declare function bundleErrorText(error: BundleInfoLike['error']): string | undefined;
/** 当前 profile 的名字与目录（拿不到目录时 dir 为空串）。 */
export declare function profileLocation(): {
    name: string;
    dir: string;
};
/** `ctx.profileContext` 的服务面（由宿主 launcher / App 提供）。 */
export interface ProfileContextLike {
    name?: string;
    dir?: string;
    patchPath?: string;
}
/**
 * 从 `ctx.profileContext` 读当前 profile —— **首选来源**。
 *
 * 桌面端由 Electron 拉起宿主进程，`DSH_PROFILE*` 不一定在它的环境里：只认环境
 * 变量时这里会解析出空目录，于是「自己装的插件」判定全部落空、页面直接空掉
 * （实机踩过）。环境变量路径只作为 CLI/headless 场景的兜底。
 */
export declare function profileFromContext(ctx: HostCtx): {
    name: string;
    dir: string;
} | undefined;
/** listPlugins/listBundles 的原始结果 → 面板要的形状。 */
export declare function normalizePluginsView(entries: PluginEntryInfoLike[], bundles: BundleInfoLike[]): NormalizedPlugins;
/** profile 清单里与插件有关的两段：依赖（= 我装的）与选中的 bundle 层。 */
export interface ProfileManifest {
    dependencies: Record<string, string>;
    bundles: string[];
}
/** 读 profile 的 `package.json`（读不到给空清单）。 */
export declare function readProfileManifest(profileDir: string): Promise<ProfileManifest>;
/**
 * 标出「用户自己装的插件」并补齐缺失的行。
 *
 * `listBundles()` 只保证列出可管理的 bundle：一个**已安装但被取消选中**的依赖
 * 会从它的结果里消失（README：未选中的普通依赖不列出），面板就会少一行。所以这里
 * 以 profile 清单的 dependencies 为准：命中的标 `mine` 并带上安装规格，缺的补一行。
 */
export declare function markInstalledPlugins(bundles: PluginBundleRow[], manifest: ProfileManifest): PluginBundleRow[];
/**
 * 降级路径：直接读 profile 的 `package.json`。
 *
 * 只读——启停/安装/卸载都需要 pluginManager，缺失时面板会禁用这些操作。
 */
export declare function readProfilePlugins(profileDir: string): Promise<PluginBundleRow[]>;
/**
 * pnpm 11 拦下的依赖脚本（`node_modules/.modules.yaml` 的 pendingBuilds）。
 *
 * 安装报 failed 时面板要能把「待批准脚本」说清楚，否则用户只看到一个失败。
 */
export declare function readPendingBuilds(profileDir: string): Promise<string[]>;
/** `ctx.pluginManager` 的写操作结果 → 面板要的形状。 */
export declare function toChangeResult(result: ChangeResultLike, target: string): PluginChangeResult;
/**
 * 插件条目 → 带**当前环境**安装命令的条目。
 *
 * 上游 awesome-dsh-plugin 的 `install` 字段写死了 `dsh plugin --profile web add …`，
 * 照抄到别的 profile（比如桌面端）就是错的：这里按宿主真正运行的 profile 重新拼
 * 命令，并把上游原文降级成「仅供参考」。桌面端 profile 的包操作由 App 独占
 * （`dsh plugin --profile desktop` 会被 CLI 拒绝），额外标 `managed` 供面板提示。
 */
export declare function withProfileInstallCommand(item: CatalogItem, profile: string): CatalogItem;
