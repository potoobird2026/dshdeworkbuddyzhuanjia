/**
 * 宿主上下文的最小类型面 + 可选服务能力探测。
 *
 * 本插件刻意**不**从 `@deepseek-ai/dsh-skill`、`dsh-host-webserver`、
 * `dsh-storage-domain` 等包做运行时导入：它们由宿主的 Cordis 容器提供，
 * 在这里只用最小结构化类型描述，缺失时降级而不是加载失败。
 * 这样插件在只有基础服务的部署（headless、CI、老版本 profile）里也能装配。
 */
/** Cordis 返回的清理函数。 */
export type Disposer = () => void;
/** Cordis 子插件句柄（`ctx.plugin()` 的返回值）。 */
export interface Fiber {
    dispose(): Promise<void> | void;
    /** 某些版本提供就绪 Promise；不存在时由调用方自行轮询。 */
    ready?: Promise<unknown>;
}
/** 宿主 Cordis 上下文里本插件真正用到的部分。 */
export interface HostCtx {
    logger: {
        info(...args: unknown[]): void;
        warn(...args: unknown[]): void;
        debug(...args: unknown[]): void;
    };
    effect(callback: () => void | Disposer | Iterable<Disposer>, label?: string): Disposer;
    on(event: string, listener: (...args: unknown[]) => void): Disposer;
    /** 服务可用/变化时运行回调（回调返回的 disposer 会在服务替换或卸载时执行）。 */
    inject(deps: string[], callback: (ctx: HostCtx) => void | Disposer): Disposer;
    get(name: string, strict?: boolean): unknown;
    plugin(plugin: unknown, config?: unknown): Fiber;
}
/**
 * 取一个服务；不存在返回 undefined（不抛错）。
 *
 * 先按 Cordis 的**严格**语义取（`ctx.get(name)` 只认「提供方 fiber 当前 active」
 * 的服务），拿不到再退一步用非严格取值。原因：管理类服务（如 `pluginManager`）
 * 由宿主在启动期注册，其 fiber 状态与消费方看到的时机可能不同步，严格取值会
 * 稳定拿到 undefined —— 而服务本身其实可用（实机踩过一次）。
 */
export declare function service<T>(ctx: HostCtx, name: string): T | undefined;
/** 诊断探针：一个服务是严格可见、非严格可见，还是完全不可见。 */
export declare function probeService(ctx: HostCtx, name: string): 'strict' | 'non-strict' | 'absent';
/** `ctx.skills` 的服务面（dsh-skill）。 */
export interface SkillsService {
    snapshot(options?: {
        cwd?: string;
        signal?: AbortSignal;
    }): Promise<{
        skills: SkillSummaryLike[];
        complete?: boolean;
    }>;
    list(options?: {
        cwd?: string;
        signal?: AbortSignal;
    }): Promise<SkillSummaryLike[]>;
    get(name: string, options?: {
        cwd?: string;
        signal?: AbortSignal;
    }): Promise<SkillDefinitionLike | undefined>;
}
/** 技能摘要（0.2.0 起含 path；旧版本没有）。 */
export interface SkillSummaryLike {
    name: string;
    description: string;
    whenToUse?: string;
    source?: string;
    provider?: string;
    path?: string;
    invocation?: {
        modelInvocable?: boolean;
        userInvocable?: boolean;
    };
}
/** 技能定义（含正文）。 */
export interface SkillDefinitionLike extends SkillSummaryLike {
    content?: string;
    metadata?: Record<string, unknown>;
}
/** `ctx.agentPresets` 的服务面（dsh-agent-preset-registry）。 */
export interface AgentPresetsService {
    list(): Promise<Array<{
        id: string;
        name?: string;
        description?: string;
        order?: number;
        broken?: unknown;
    }>>;
    readDocument?(id: string): Promise<{
        agentPreset: string;
        content: string;
        name?: string;
        description?: string;
    }>;
    register?(definition: AgentPresetDefinition): Promise<() => Promise<void>>;
}
/** 预设声明（@deepseek-ai/dsh-agent-preset 的 Config）。 */
export interface AgentPresetDefinition {
    id: string;
    name?: string;
    description?: string;
    order?: number;
    plugins: unknown[];
}
/** `ctx.settings` 的服务面（dsh-settings）。 */
export interface SettingsDescriptorLike {
    ns: string;
    value?: unknown;
    writable?: boolean;
}
export interface SettingsService {
    readonly writable?: boolean;
    describe?(options?: {
        redactSecrets?: boolean;
    }): SettingsDescriptorLike[];
    update(ns: string, patch: Record<string, unknown>, expectedRevision?: number): Promise<void>;
}
/** `ctx.storageDomain` 的服务面（dsh-storage-domain）。 */
export interface StorageDomainService {
    open(spec: DomainSpecLike): Promise<DomainLike>;
}
export interface DomainSpecLike {
    name: string;
    version: number;
    layout?: 'single' | 'per-record';
    invalidRecords?: 'backup-and-skip';
    /** 可选的 global 单例槽（dsh-storage-domain 的 DomainGlobalSpec）。 */
    global?: {
        schema: unknown;
        initial: unknown;
    };
    tables: Record<string, unknown>;
}
/** global 单例句柄。 */
export interface DomainGlobalLike<V> {
    get(): V;
    set(value: V): Promise<void>;
}
export interface DomainTableLike<V> {
    get(key: string): V | undefined;
    put(key: string, value: V): Promise<void>;
    delete(key: string): Promise<boolean>;
    update(key: string, fn: (current: V) => V): Promise<V>;
}
export interface DomainLike {
    table<V>(name: string): DomainTableLike<V>;
    /** global 单例句柄（未声明 global 的域可能不存在）。 */
    global?: DomainGlobalLike<unknown>;
    close(): Promise<void>;
}
/** `ctx.webServer` 的服务面（dsh-host-webserver）。 */
export interface WebServerService {
    register(route: {
        kind: 'exact' | 'prefix';
        path: string;
        handler: (req: IncomingLike, res: ServerResponseLike) => void | Promise<void>;
    }): Disposer;
}
/** node:http 请求/响应的最小结构（避免引入 @types/node 之外的宿主类型）。 */
export interface IncomingLike {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
    socket?: {
        remoteAddress?: string;
    };
    [Symbol.asyncIterator](): AsyncIterator<Uint8Array>;
    resume(): void;
}
export interface ServerResponseLike {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(body?: string): void;
    headersSent?: boolean;
}
/** `ctx.connection` 的服务面（dsh-client-connection）的信任栅栏。 */
export interface ConnectionService {
    requestRejection?(req: unknown): 401 | 403 | undefined;
}
/** 本地化文案（string 或 { en, zh, ... }）。 */
export type LocalizedTextLike = string | {
    en?: string;
    zh?: string;
    [locale: string]: string | undefined;
};
/** 插件展示元数据。 */
export interface PluginMetaLike {
    title?: LocalizedTextLike;
    description?: LocalizedTextLike;
    icon?: string;
    error?: string;
}
/** listPlugins() 的一行。 */
export interface PluginEntryInfoLike {
    entryId: string;
    moduleName: string;
    meta?: PluginMetaLike;
    enabled: boolean;
    fiberPhase?: string;
    /** 可写 patch 目标；只读行没有这个字段。 */
    patchId?: string;
    readOnlyReason?: string;
}
/** listBundles() 里的一行（bundle 声明的插件行）。 */
export interface BundleRowInfoLike {
    rowId: string;
    moduleName: string;
    meta?: PluginMetaLike;
    entryId?: string;
}
/** listBundles() 的一个 bundle。 */
export interface BundleInfoLike {
    name: string;
    version?: string;
    description?: string;
    meta?: PluginMetaLike;
    enabled: boolean;
    installed: boolean;
    optional?: boolean;
    removable?: boolean;
    readOnlyReason?: string;
    error?: {
        code?: string;
        diagnostic?: string;
    } | string;
    rows?: BundleRowInfoLike[];
    overrides?: string[];
}
/** 写操作结果（installBundle / removeBundle / setPluginEnabled / setBundleEnabled）。 */
export interface ChangeResultLike {
    changed?: boolean;
    application?: string;
    stage?: string;
    target?: string;
    enabled?: boolean;
    error?: {
        code?: string;
        diagnostic?: string;
    } | string;
    warnings?: string[];
    bundle?: string;
    pendingBuilds?: string[];
}
/** `ctx.pluginManager` 的服务面。 */
export interface PluginManagerService {
    listPlugins(): Promise<PluginEntryInfoLike[]>;
    listBundles(): Promise<BundleInfoLike[]>;
    setPluginEnabled(id: string, enabled: boolean): Promise<ChangeResultLike>;
    setBundleEnabled(name: string, enabled: boolean): Promise<ChangeResultLike>;
    installBundle(spec: string, options?: {
        enabled?: boolean;
        registry?: string | null;
        approvedBuilds?: string[];
    }): Promise<ChangeResultLike>;
    removeBundle(name: string): Promise<ChangeResultLike>;
}
/**
 * 能力探测结果（每个服务键都**必填**，值可以是 undefined）。
 *
 * 键必填是有意的：`describeCapabilities` / 各调用方漏写一个字段就会编译报错。
 * 踩过的坑——调用方手写入参时漏了 `pluginManager`（当时它是可选键），结果把
 * 可用的服务误报成「不可用」，面板白挂一条降级说明。
 */
export interface DetectedServices {
    skills: SkillsService | undefined;
    agentPresets: AgentPresetsService | undefined;
    settings: SettingsService | undefined;
    storageDomain: StorageDomainService | undefined;
    webServer: WebServerService | undefined;
    connection: ConnectionService | undefined;
    pluginManager: PluginManagerService | undefined;
    mcpClient: boolean;
}
/** `describeCapabilities` 的入参（与探测结果同形）。 */
export type ServiceProbe = DetectedServices;
/** 探测宿主提供了哪些可选服务。 */
export declare function detectServices(ctx: HostCtx, mcpClientAvailable: boolean): DetectedServices;
/** 把探测结果压成对客户端友好的布尔 + 说明。 */
export declare function describeCapabilities(services: ServiceProbe): {
    flags: {
        skills: boolean;
        agentPresets: boolean;
        settings: boolean;
        storageDomain: boolean;
        webServer: boolean;
        connection: boolean;
        mcpClient: boolean;
        pluginManager: boolean;
    };
    notes: string[];
};
