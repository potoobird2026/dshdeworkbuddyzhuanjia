/**
 * 面板 → 宿主的数据面客户端。
 *
 * 关键约定：**文档相对路径**（无前导斜杠）。宿主把 GUI 以 `<base href="./">`
 * 提供给子路径部署，根绝对路径 `/api/...` 会逃出该前缀；桌面端
 * `dsh-app://app/` 的协议处理器同样按文档相对路径解析后再转发给宿主 HTTP 服务，
 * 因此这一种写法在 Web 端与桌面端都正确。
 */
import type { Capabilities, ConnectorRecord, ConnectorRow, ConnectorStatus, DeckStatus, ExpertRecord, PluginChangeResult, PluginsView, PresetRow, ProfileConnectorRow, SkillDetail, SkillRow } from '../types.js';
/** 路由基址（与宿主 config.routePrefix 对应，必须无前导斜杠）。 */
export declare const API_BASE = "api/dsh-squares";
/** 接口错误。 */
export declare class ApiError extends Error {
    readonly status: number;
    readonly code?: string | undefined;
    constructor(message: string, status: number, code?: string | undefined);
}
/** 能力快照响应。 */
export interface CapabilitiesResponse {
    panelId: string;
    routePrefix: string;
    capabilities: Capabilities;
    notes: string[];
    storage: 'domain' | 'memory';
    ui: {
        skills: boolean;
        experts: boolean;
        connectors: boolean;
        plugins?: boolean;
        plaza?: boolean;
    };
}
/** 技能列表响应。 */
export interface SkillsResponse {
    cwd: string;
    complete: boolean;
    skills: SkillRow[];
}
/** 专家列表响应。 */
export interface ExpertsResponse {
    official: PresetRow[];
    mine: ExpertRecord[];
    defaultId?: string;
    broken: Record<string, string>;
}
/** 专家详情响应。 */
export interface ExpertReadResponse {
    mine?: ExpertRecord;
    official?: {
        id: string;
        name?: string;
        description?: string;
        isDefault: boolean;
        broken?: string;
        compositionYaml?: string;
    };
}
/** 连接器列表响应。 */
export interface ConnectorsResponse {
    connectors: ConnectorRow[];
    profileConfigured: ProfileConnectorRow[];
    available: boolean;
}
/** 连接器写操作响应。 */
export interface ConnectorWriteResponse {
    connector: ConnectorRecord;
    status: ConnectorStatus;
}
/** 测试响应。 */
export interface ConnectorTestResponse {
    ok: boolean;
    tools: string[];
    error?: string;
}
/** 广场：源状态。 */
export interface CatalogSourceStatus {
    id: string;
    label: string;
    kind: 'skill' | 'expert' | 'connector' | 'plugin' | 'all';
    enabled: boolean;
    installable: boolean;
    ok: boolean;
    lastError?: string;
    fetchedAt?: string;
}
/** 广场：归一化条目。 */
export interface CatalogItem {
    sourceId: string;
    kind: 'skill' | 'expert' | 'connector' | 'plugin';
    id: string;
    name: string;
    nameEn?: string;
    description: string;
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
    install: {
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
        source?: 'npm' | 'github' | 'tarball';
        /** 当前 profile 下可执行的安装命令（宿主按环境生成）。 */
        command?: string;
        /** 上游原始命令（写死了别的 profile，仅供参考）。 */
        upstreamCommand?: string;
        /** 当前 profile 名。 */
        profile?: string;
        /** 该 profile 的包操作由 App 独占（CLI 会被拒绝）。 */
        managed?: boolean;
        capabilities?: string[];
        redLines?: string[];
    } | {
        kind: 'unsupported';
        reason: string;
    };
    installed?: {
        key: string;
        version?: string;
        updatable?: boolean;
    };
}
/** 广场：已安装记录。 */
export interface CatalogInstalledRecord {
    sourceId: string;
    itemId: string;
    version: string;
    installedAt: string;
}
/** 广场：列表响应。 */
export interface CatalogPageResponse {
    items: CatalogItem[];
    nextCursor?: string;
    total?: number;
    sources: CatalogSourceStatus[];
    installed: Record<string, CatalogInstalledRecord>;
}
/** 广场：详情响应。 */
export interface CatalogItemResponse {
    item: CatalogItem;
    files?: Array<{
        path: string;
    }>;
    preview?: string;
    compositionPreview?: string;
    connector?: Record<string, unknown>;
    /** plugin：awesome-dsh-plugin 原始条目（能力/红线/截图/安装命令等）。 */
    plugin?: Record<string, unknown>;
}
/** 广场：安装结果。 */
export interface CatalogInstallResult {
    kind: 'skill' | 'expert' | 'connector' | 'plugin';
    key: string;
    id: string;
    missing?: string[];
    warnings: string[];
}
/** 广场：可提交的本地条目。 */
export interface CatalogSubmitCandidate {
    id: string;
    name: string;
    description: string;
    extra?: string;
}
/** 广场：提交结果。 */
export interface CatalogSubmitResult {
    item: Record<string, unknown>;
    sha256: string;
    bytes: number;
    hints: string[];
}
/** 全部接口。 */
export declare const api: {
    capabilities: () => Promise<CapabilitiesResponse>;
    status: () => Promise<DeckStatus>;
    skills: (cwd?: string) => Promise<SkillsResponse>;
    skillRead: (name: string, path: string | undefined, cwd?: string) => Promise<SkillDetail>;
    skillCreate: (input: {
        root: "user" | "project";
        cwd?: string;
        name: string;
        description: string;
        whenToUse?: string;
        content: string;
    }) => Promise<{
        path: string;
    }>;
    skillUpdate: (input: {
        name: string;
        path: string;
        cwd?: string;
        description: string;
        whenToUse?: string;
        content: string;
    }) => Promise<{
        path: string;
    }>;
    skillSetEnabled: (input: {
        name: string;
        path: string;
        cwd?: string;
        enabled: boolean;
    }) => Promise<{
        disabled: boolean;
        path: string;
    }>;
    skillDelete: (input: {
        name: string;
        path: string;
        cwd?: string;
    }) => Promise<{
        trashedTo: string;
    }>;
    skillImport: (input: {
        root: "user" | "project";
        cwd?: string;
        source: "archive" | "files" | "markdown";
        dataBase64?: string;
        files?: Array<{
            path: string;
            text?: string;
            base64?: string;
        }>;
        fileName?: string;
        enable?: boolean;
    }) => Promise<{
        name: string;
        path: string;
        files: number;
        enabled: boolean;
        warnings: string[];
    }>;
    skillCreatorPrompt: (requirement: string) => Promise<{
        skill: string;
        available: boolean;
        prompt: string;
        userSkillRoot: string;
    }>;
    experts: () => Promise<ExpertsResponse>;
    expertRead: (id: string) => Promise<ExpertReadResponse>;
    expertCreate: (input: Partial<ExpertRecord>) => Promise<{
        expert: ExpertRecord;
        broken?: string;
    }>;
    expertUpdate: (input: Partial<ExpertRecord> & {
        id: string;
    }) => Promise<{
        expert: ExpertRecord;
        broken?: string;
    }>;
    expertDelete: (id: string) => Promise<{
        removed: boolean;
    }>;
    expertDuplicate: (id: string) => Promise<{
        expert: ExpertRecord;
    }>;
    catalogSources: () => Promise<{
        enabled: boolean;
        sources: CatalogSourceStatus[];
    }>;
    catalogCategories: (kind: "skill" | "expert" | "connector" | "plugin") => Promise<{
        categories: string[];
    }>;
    catalog: (query: {
        kind: "skill" | "expert" | "connector" | "plugin";
        source?: string;
        q?: string;
        category?: string;
        sort?: "default" | "hot" | "new";
        cursor?: string;
        limit?: number;
    }) => Promise<CatalogPageResponse>;
    catalogItem: (source: string, id: string) => Promise<CatalogItemResponse>;
    catalogInstall: (input: {
        source: string;
        id: string;
        enable?: boolean;
        root?: "user" | "project";
        cwd?: string;
        env?: Record<string, string>;
    }) => Promise<CatalogInstallResult>;
    catalogUninstall: (kind: "skill" | "expert" | "connector" | "plugin", key: string) => Promise<{
        ok: true;
    }>;
    catalogInstalled: () => Promise<{
        installed: Record<string, CatalogInstalledRecord>;
    }>;
    catalogSubmitCandidates: (kind: "skill" | "expert" | "connector" | "plugin") => Promise<{
        candidates: CatalogSubmitCandidate[];
    }>;
    catalogSubmit: (input: {
        kind: "skill" | "expert" | "connector" | "plugin";
        id: string;
        path?: string;
        cwd?: string;
        name?: string;
        description?: string;
        tags?: string[];
    }) => Promise<CatalogSubmitResult>;
    expertSetDefault: (id: string) => Promise<{
        ok: true;
    }>;
    /** 本地插件页：当前 profile 的 bundle 与插件行。 */
    plugins: () => Promise<PluginsView>;
    /** 启停单个插件行（写 profile 的 cordis.patch.yml）。 */
    pluginSetEnabled: (id: string, enabled: boolean) => Promise<{
        result: PluginChangeResult;
    }>;
    /** 选中/取消一个 bundle 层（保留已安装依赖）。 */
    pluginBundleSetEnabled: (name: string, enabled: boolean) => Promise<{
        result: PluginChangeResult;
    }>;
    /** 卸载一个 bundle（同时移除依赖）。 */
    pluginRemove: (name: string) => Promise<{
        result: PluginChangeResult;
    }>;
    connectors: () => Promise<ConnectorsResponse>;
    connectorCreate: (input: Partial<ConnectorRecord>) => Promise<ConnectorWriteResponse>;
    connectorUpdate: (input: Partial<ConnectorRecord> & {
        id: string;
    }) => Promise<ConnectorWriteResponse>;
    connectorDelete: (id: string) => Promise<{
        ok: true;
    }>;
    connectorSetEnabled: (id: string, enabled: boolean) => Promise<{
        status: ConnectorStatus;
    }>;
    connectorReconnect: (id: string) => Promise<{
        status: ConnectorStatus;
    }>;
    connectorTest: (input: {
        id?: string;
    } & Partial<ConnectorRecord>) => Promise<ConnectorTestResponse>;
};
