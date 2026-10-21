/**
 * Square 服务门面：把存储、技能域、专家域、连接器域与本插件的
 * 运行期状态（降级项、最近错误）收在一处，供路由与模型工具使用。
 */
import type { SquareConfig, ResolvedPaths } from './config.js';
import type { DetectedServices, HostCtx } from './capabilities.js';
import { ConnectorsDomain } from './connectors.js';
import { ExpertsDomain } from './experts.js';
import { SkillsDomain } from './skills.js';
import type { CatalogDetail, CatalogKind, CatalogQuery, SourceStatus } from './catalog.js';
import { CatalogInstaller, SourceRegistry } from './catalog-install.js';
import { CatalogExporter, type SubmitInput, type SubmitOutcome } from './catalog-export.js';
import type { RuntimeMode } from './plugins.js';
import { DeckStore } from './store.js';
import type { Capabilities, ConnectorRecord, DeckStatus, PluginChangeResult, PluginsView } from './types.js';
/** 插件运行期状态与各领域的收口。 */
export declare class SquareService {
    private readonly ctx;
    readonly config: SquareConfig;
    readonly paths: ResolvedPaths;
    /** 装配时的服务快照（技能/预设/设置/存储在 apply 时已就绪）。 */
    private readonly services;
    /** `@deepseek-ai/dsh-mcp-client` 是否可解析。 */
    private readonly mcpClientAvailable;
    readonly store: DeckStore;
    readonly skills: SkillsDomain;
    readonly connectors: ConnectorsDomain;
    readonly experts: ExpertsDomain;
    /** 广场：源注册表与安装器（enablePlaza 为假时不初始化）。 */
    readonly registry?: SourceRegistry;
    readonly installer?: CatalogInstaller;
    /** 广场：本地 → 目录 JSON 导出器（提交用）。 */
    readonly exporter?: CatalogExporter;
    private readonly errors;
    /** 广场取数器（缓存预热用；enablePlaza 关掉时为 undefined）。 */
    private readonly fetcher?;
    private constructor();
    /**
     * 能力快照 —— **每次现算**。
     *
     * 原因：`webServer` / `connection` 往往在插件 apply 之后才激活（connection
     * 还要等 webRuntime），装配时探测会误报「不可用」。这里按当前上下文重新探测，
     * 面板看到的永远是此刻的真实状态。
     */
    get capabilities(): Capabilities;
    /** 降级说明（与 capabilities 同时现算）。 */
    get notes(): string[];
    /** 每请求现取 connection 服务（可能被替换，也可能晚于插件激活）。 */
    liveConnection(): DetectedServices['connection'];
    /** 装配时的服务快照（诊断用）。 */
    get detectedServices(): DetectedServices;
    /** 组装服务（含存储打开）。 */
    static create(ctx: HostCtx, config: SquareConfig, paths: ResolvedPaths, services: DetectedServices, mcpClientAvailable: boolean): Promise<SquareService>;
    /** 启动时对齐：先挂连接器，再按连接器重算专家组合。 */
    init(): Promise<void>;
    /**
     * 后台预热目录缓存。
     *
     * 1) 先把磁盘上还没过期的缓存读回内存（重启后不必重下 5MB）；
     * 2) 再后台拉一次插件广场（命中内存缓存就是白跑一趟，否则把大文件取回来）。
     *
     * 全程 best-effort：失败只记 debug 日志，绝不影响插件启动。
     */
    private warmCatalog;
    /** 卸载：释放连接器、预设与存储。 */
    dispose(): Promise<void>;
    /** 连接器定义变化后同步：挂载/卸载 + 重算专家组合。 */
    connectorsChanged(): Promise<void>;
    /** 记一条错误（供 /status 与诊断工具展示）。 */
    noteError(text: string): void;
    /** 取一个连接器记录（不存在抛错，由路由转 404）。 */
    requireConnector(id: string): ConnectorRecord;
    /** 广场：源状态。 */
    catalogSources(): SourceStatus[];
    /** 广场：列表（多源扇出或单源分页）。 */
    catalogList(query: CatalogQuery): Promise<{
        items: CatalogDetail['item'][];
        nextCursor?: string;
        total?: number;
        sources: SourceStatus[];
    }>;
    /** 广场：目录分类（上游源自带分类时以上游为准）。 */
    catalogCategories(kind: CatalogKind): Promise<string[]>;
    /**
     * 当前 profile 的位置。
     *
     * **优先问宿主的 `ctx.profileContext`**（桌面端由 Electron 拉起宿主进程，
     * `DSH_PROFILE*` 未必在它的环境里），环境变量只作兜底。
     */
    profile(): {
        name: string;
        dir: string;
    };
    /** 当前宿主形态：桌面客户端 / Web 端（安装命令与托管语义按此分流）。 */
    runtimeMode(): RuntimeMode;
    /** 当前 profile 已安装的包名（dependencies），用于广场的「已安装」标记。 */
    private profilePluginNames;
    /** 现取 profile 插件管理服务（可能晚到，也可能不存在）。 */
    private livePluginManager;
    /** 写操作前取插件管理服务；不存在时明确报「此部署不支持」。 */
    private requirePluginManager;
    /**
     * 本地插件页：**自己装的**插件（profile 的 dependencies）与它们的插件行。
     *
     * `pluginManager` 缺失或读取失败时退化成「直接读 profile 清单」的只读视图，
     * 面板仍然可用（只是按钮禁用）。
     */
    pluginsView(): Promise<PluginsView>;
    /** 启停单个插件行（写 profile 的 cordis.patch.yml 覆盖）。 */
    pluginSetEnabled(id: string, enabled: boolean): Promise<PluginChangeResult>;
    /**
     * 启用 / 禁用（= 选中 / 取消选中该插件的 bundle 层，依赖保留）。
     *
     * 护栏：**取消选中只允许对自己装的插件**（在 profile dependencies 里）。
     * App 自带/随安装提供的 bundle（`@deepseek-ai/dsh-base`、语音输入、Agent Teams…）
     * 一旦被取消选中，重启后对应能力就没了——那不属于「管理我装的插件」，
     * 需要的话请用 App 自带的插件页操作。
     */
    pluginBundleSetEnabled(name: string, enabled: boolean): Promise<PluginChangeResult>;
    /** 卸载一个 bundle（同时移除依赖）。 */
    pluginRemove(name: string): Promise<PluginChangeResult>;
    /** 广场：详情。 */
    catalogItem(sourceId: string, id: string): Promise<CatalogDetail>;
    /**
     * 按**当前环境**补插件条目的安装命令（实现见 `withProfileInstallCommand`）。
     *
     * 上游 awesome-dsh-plugin 的 `install` 字段写死了 `--profile web`，照抄到别的
     * profile（比如桌面端）就是错的。
     */
    private withProfileCommand;
    /** 广场：安装。 */
    catalogInstall(sourceId: string, id: string, options?: {
        enable?: boolean;
        root?: 'user' | 'project';
        cwd?: string;
        env?: Record<string, string>;
    }): Promise<Awaited<ReturnType<CatalogInstaller['install']>>>;
    /** 广场：卸载。 */
    catalogUninstall(kind: CatalogKind, key: string): Promise<void>;
    /** 广场：已安装清单。 */
    catalogInstalled(): ReturnType<CatalogInstaller['installedIndex']>;
    /** 广场：提交（本地条目 → square-catalog/1 JSON）。 */
    catalogSubmit(input: SubmitInput): Promise<SubmitOutcome>;
    /** 广场：可提交的本地条目（按 kind 给出候选清单）。 */
    catalogSubmitCandidates(kind: SubmitInput['kind']): Promise<Array<{
        id: string;
        name: string;
        description: string;
        extra?: string;
    }>>;
    /**
     * 插件提交用：包名 → 本机已安装插件的导出信息。
     *
     * 规格优先取 Square 的安装溯源（`meta.spec`，装 github/tgz 时不是包名），
     * 没有溯源（在 Square 之外装的）就退回包名当 npm 规格。
     */
    private localPluginExport;
    /** 整体状态快照。 */
    status(): Promise<DeckStatus>;
    /** 给模型工具用的紧凑文本快照。 */
    statusText(): Promise<string>;
}
