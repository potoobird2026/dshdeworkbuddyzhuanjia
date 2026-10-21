/**
 * 源注册表（多源聚合、状态跟踪）与安装器（技能/专家/连接器三条安装管线）。
 *
 * 安装器只依赖各领域已有的能力（SkillsDomain / ExpertsDomain / ConnectorsDomain），
 * 自身负责：取详情 → 落盘/注册/挂载 → 写溯源 → 失败回滚。
 */
import type { SquareConfig, ResolvedPaths } from './config.js';
import type { ChangeResultLike, HostCtx, PluginManagerService } from './capabilities.js';
import type { CatalogDetail, CatalogKind, CatalogPage, CatalogQuery, CatalogSource, SourceCtx, SourceStatus } from './catalog.js';
import type { ConnectorsDomain } from './connectors.js';
import type { ExpertsDomain } from './experts.js';
import type { SkillsDomain } from './skills.js';
import type { DeckStore, InstalledRecord } from './store.js';
import type { CachedFetcher } from './catalog.js';
/** 多源列表结果。 */
export interface CatalogListResult extends CatalogPage {
    sources: SourceStatus[];
}
/** offset 表 → 复合游标（没有源需要记录时返回空前缀串，但调用方只在 hasMore 时才用）。 */
export declare function encodeFanoutCursor(offsets: Map<string, number>): string;
/** 复合游标 → offset 表；非法/缺失/旧格式一律返回空表（= 第一页）。 */
export declare function parseFanoutCursor(cursor: string | undefined): Map<string, number>;
/** 源注册表。 */
export declare class SourceRegistry {
    private readonly sources;
    private readonly ctx;
    private readonly statuses;
    constructor(sources: CatalogSource[], ctx: SourceCtx);
    /** 全部源状态。 */
    listSources(): SourceStatus[];
    /** 取一个源。 */
    source(id: string): CatalogSource | undefined;
    /** 该种类可用的源。 */
    private forKind;
    /** 列表：指定源则单源分页，否则多源扇出（复合游标推进，见 `parseFanoutCursor`）。 */
    list(query: CatalogQuery): Promise<CatalogListResult>;
    /**
     * 某个 kind 的目录分类。
     *
     * 上游自带分类体系的源（`categories()`）为权威答案；没有或拉取失败时退回
     * 静态标准分类表，保证分类筛选条不会空。
     */
    categories(kind: CatalogKind): Promise<string[]>;
    /** 详情。 */
    item(sourceId: string, id: string): Promise<CatalogDetail>;
    /** 跑一次源调用并记录状态。 */
    private run;
}
/** 安装器依赖。 */
export interface InstallerDeps {
    ctx: HostCtx;
    config: SquareConfig;
    paths: ResolvedPaths;
    store: DeckStore;
    skills: SkillsDomain;
    experts: ExpertsDomain;
    connectors: ConnectorsDomain;
    registry: SourceRegistry;
    /** 带缓存的取数器（安装时下载二进制）。 */
    fetcher: CachedFetcher;
    /** 连接器集合变化后的对齐（挂载/卸载 + 重算专家组合）。 */
    connectorsChanged: () => Promise<void>;
    /**
     * 现取 profile 插件管理服务（`ctx.pluginManager`）。
     *
     * 必须是 getter：服务可能晚于本插件激活，也可能在降级部署里根本不存在。
     */
    pluginManager: () => PluginManagerService | undefined;
    /**
     * 按当前运行形态（桌面端 / Web 端）生成手动 `dsh plugin` 命令文本。
     * 只用于错误提示与面板展示；实际安装走 pluginManager，天然落在当前 profile。
     */
    installHint: (verb: 'add' | 'remove', spec: string) => string;
}
/** 安装选项。 */
export interface InstallOptions {
    /** 技能是否安装后立即可用（默认 false：第三方内容默认禁用）。 */
    enable?: boolean;
    /** 技能安装根。 */
    root?: 'user' | 'project';
    cwd?: string;
    /** 连接器密钥等。 */
    env?: Record<string, string>;
}
/** 安装结果。 */
export interface InstallOutcome {
    kind: CatalogKind;
    key: string;
    /** 该种类下的落地标识（技能名 / 预设 id / 连接器 id）。 */
    id: string;
    /** 需要用户补齐的必填项（安装未完成时）。 */
    missing?: string[];
    warnings: string[];
}
/** 安装器。 */
export declare class CatalogInstaller {
    private readonly deps;
    constructor(deps: InstallerDeps);
    /** 已安装索引：`${kind}:${key}` → 溯源。 */
    installedIndex(): Record<string, InstalledRecord>;
    /** 安装一个条目。 */
    install(sourceId: string, id: string, options?: InstallOptions): Promise<InstallOutcome>;
    /**
     * 卸载一个已安装条目。
     *
     * key 允许两种写法：完整键（`expert:roleplay-chengwei`，面板拿的就是它）
     * 或裸标识（`roleplay-chengwei`）。先按完整键找，找不到再补前缀。
     */
    uninstall(kind: CatalogKind, key: string): Promise<void>;
    /** 技能安装：拉文件 → 复用 importSkill。 */
    private installSkill;
    /** 专家安装：组合原文 → 注册为运行时预设。 */
    private installExpert;
    /** 连接器安装：registry 条目 → 连接器记录 → 运行时挂载。 */
    private installConnector;
    /**
     * 插件安装：交给 profile 的 `ctx.pluginManager.installBundle`。
     *
     * 等价于 `dsh plugin --profile <profile> add <spec>`：写 profile 的
     * package.json 依赖 + 选中 bundle 层 + 跑 pnpm。桌面端由 Electron shell
     * 提供同一套实现，因此这里不自己碰 profile 文件。
     */
    private installPlugin;
    /** 插件卸载：同样交给 pluginManager（= `dsh plugin remove`）。 */
    private removePlugin;
    /** 取 profile 插件管理服务；缺失时把可手动执行的等价命令写进错误里。 */
    private requirePluginManager;
}
/** ChangeResult 的错误 → 一行文本（pluginManager 各写操作共用）。 */
export declare function changeErrorText(error: ChangeResultLike['error']): string | undefined;
/** 供 service 复用：构建 SourceCtx。 */
export declare function makeSourceCtx(ctx: HostCtx, config: SquareConfig, paths: ResolvedPaths, fetcher: CachedFetcher): SourceCtx;
