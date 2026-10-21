/**
 * 数据源框架：统一条目模型、磁盘/内存缓存、源注册表。
 *
 * 设计要点：
 *   - **所有网络访问都在宿主侧**（Node fetch），避开 CORS、可缓存、token 不出主进程；
 *   - 源是可插拔的：每个源实现 `list/item`，返回归一化后的 CatalogItem；
 *   - 缓存按「源 + URL」记忆，带 TTL 与 ETag；**过期且拉取失败时报错，不静默用旧数据**
 *     （与 dshmarket 的取舍一致：过期答案不是「差一点」，而是「错的」）。
 */
import type { SquareConfig, ResolvedPaths } from './config.js';
import type { HostCtx } from './capabilities.js';
/** 条目种类。 */
export type CatalogKind = 'skill' | 'expert' | 'connector' | 'plugin';
/** 归一化条目（前端只认这个形状）。 */
export interface CatalogItem {
    sourceId: string;
    kind: CatalogKind;
    id: string;
    name: string;
    nameEn?: string;
    description: string;
    descriptionEn?: string;
    icon?: string;
    author?: string;
    homepage?: string;
    repo?: string;
    version?: string;
    tags: string[];
    category?: string;
    stats?: {
        stars?: number;
        downloads?: number;
        favorites?: number;
        rank?: number;
    };
    trust?: {
        official?: boolean;
        capabilities?: string[];
        redLines?: string[];
    };
    /** 安装所需的最小信息（详情接口会补全）。 */
    install: CatalogInstallHint;
}
/** 安装提示：足够画确认对话框，不必再拉详情。 */
export type CatalogInstallHint = {
    kind: 'skill';
    fileCount?: number;
    hasScripts?: boolean;
} | {
    kind: 'expert';
    pluginRows?: string[];
    hasJsExpr?: boolean;
} | {
    kind: 'connector';
    transport: 'stdio' | 'streamable-http';
    command?: string;
    url?: string;
    envRequired?: string[];
} | {
    kind: 'plugin';
    /** 安装规格：npm 包名或 `github:owner/repo`。 */
    package: string;
    version?: string;
    /** 规格来源，决定确认弹窗的措辞。 */
    source?: 'npm' | 'github' | 'tarball';
    /**
     * 可执行的安装命令。
     *
     * 由宿主按**当前运行形态**生成（桌面端 `dsh plugin add <spec>`；
     * Web 端 `dsh plugin --profile web add <spec>`），不照抄上游——上游那份
     * 写死 `--profile web`，照搬到桌面端就会装错 profile。
     */
    command?: string;
    /** 上游原始命令（可能写死别的 profile，只作参考）。 */
    upstreamCommand?: string;
    /** 当前 profile 名（未知时为空串）。 */
    profile?: string;
    /** 桌面端：该 profile 的包操作由 App 独占（`--profile desktop` 会被 CLI 拒绝）。 */
    managed?: boolean;
    /** 插件声明的能力（fs-read / shell / network …）。 */
    capabilities?: string[];
    /** 需要人工确认的红线能力。 */
    redLines?: string[];
} | {
    kind: 'unsupported';
    reason: string;
};
/** 技能安装所需的文件内容。 */
export interface CatalogFile {
    path: string;
    url?: string;
    text?: string;
    base64?: string;
}
/** 详情：列表字段 + 安装载荷。 */
export interface CatalogDetail {
    item: CatalogItem;
    /** skill：该技能目录下的全部文件。 */
    files?: CatalogFile[];
    /** skill：SKILL.md 预览。 */
    preview?: string;
    /** expert：组合原文与元数据。 */
    composition?: string;
    metadata?: string;
    /** connector：可直接落库的连接器定义片段。 */
    connector?: Record<string, unknown>;
    /** plugin：awesome-dsh-plugin 原始条目（能力/红线/安装命令等）。 */
    plugin?: Record<string, unknown>;
}
/** 源状态（前端展示可达性）。 */
export interface SourceStatus {
    id: string;
    label: string;
    kind: CatalogKind | 'all';
    enabled: boolean;
    installable: boolean;
    ok: boolean;
    lastError?: string;
    fetchedAt?: string;
    ttlMs: number;
}
/** 查询参数。 */
export interface CatalogQuery {
    kind: CatalogKind;
    source?: string;
    q?: string;
    category?: string;
    sort?: 'default' | 'hot' | 'new';
    cursor?: string;
    limit?: number;
}
/** 一页结果。 */
export interface CatalogPage {
    items: CatalogItem[];
    nextCursor?: string;
    total?: number;
}
/** 宿主动力学给源用的工具。 */
export interface SourceCtx {
    config: SquareConfig;
    paths: ResolvedPaths;
    log: (message: string) => void;
    /** 带缓存/超时/代理的 JSON 拉取。 */
    json: (url: string, options?: FetchOptions) => Promise<unknown>;
    /** 带缓存的文本拉取。 */
    text: (url: string, options?: FetchOptions) => Promise<string>;
    /** 二进制拉取（不缓存，用于安装）。 */
    bytes: (url: string) => Promise<Uint8Array>;
}
/** 拉取选项。 */
export interface FetchOptions {
    /** 该源的 TTL（毫秒）。 */
    ttlMs?: number;
    /** 单次请求超时（毫秒；缺省 20s，大目录如 plugins.json 需要更长）。 */
    timeoutMs?: number;
    headers?: Record<string, string>;
    /** 缓存键后缀（同一 URL 不同查询）。 */
    cacheKey?: string;
    /** 跳过缓存直取。 */
    noCache?: boolean;
}
/** 一个数据源。 */
export interface CatalogSource {
    readonly id: string;
    readonly label: string;
    readonly kind: CatalogKind | 'all';
    readonly installable: boolean;
    /**
     * 该源是否**自己分页**（返回 `nextCursor` / `total`）。
     *
     * 为 `true` 时注册表以它为准做游标分页，其余源只在第一页补进来——否则
     * 「每源均分」会把大目录切成 limit/源数 条，游标也一起丢掉（插件广场 4392
     * 条曾因此在面板上只显示 8 条）。
     */
    readonly paginated?: boolean;
    list(query: CatalogQuery, ctx: SourceCtx): Promise<CatalogPage>;
    item(id: string, ctx: SourceCtx): Promise<CatalogDetail>;
    /**
     * 该源自己的目录分类（可选）。
     *
     * 上游自带分类体系的源（如 awesome-dsh-plugin 的 plugins.json）实现它，
     * 注册表就以上游为准；没实现的源退回静态标准分类表。
     */
    categories?(ctx: SourceCtx): Promise<string[]>;
}
/** 网络/协议错误（带状态码，路由层可直接映射）。 */
export declare class CatalogError extends Error {
    readonly code: string;
    readonly status: number;
    constructor(message: string, code: string, status?: number);
}
/** 带缓存的拉取器。 */
export declare class CachedFetcher {
    private readonly ctx;
    private readonly paths;
    private readonly defaultTtlMs;
    private readonly memory;
    constructor(ctx: HostCtx, paths: ResolvedPaths, defaultTtlMs: number);
    /** 拉文本；命中未过期缓存直接返回。 */
    text(url: string, options?: FetchOptions): Promise<string>;
    /** 拉 JSON。 */
    json(url: string, options?: FetchOptions): Promise<unknown>;
    /** 拉二进制（安装用，不缓存）。 */
    raw(url: string): Promise<Uint8Array>;
    /** 磁盘缓存目录。 */
    private cacheDir;
    /** 异步落盘（失败只记日志）。 */
    private persist;
    /** 启动时预热磁盘缓存（只读未过期条目）。 */
    warm(ttlMs: number): Promise<number>;
}
