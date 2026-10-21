/**
 * Square 宿主半共享类型。
 *
 * 这些类型同时是 HTTP 路由的响应契约与客户端 `src/client/api.ts` 的类型来源；
 * 两边保持同步的方式是：客户端只导入本文件的类型（`import type`，编译期擦除，
 * 不产生运行时依赖）。
 */
/** 技能来源（与 @deepseek-ai/dsh-skill 的 source 取值一致，开放联合）。 */
export type SkillSource = 'project-dsh' | 'project-agents' | 'custom' | 'user-dsh' | 'user-agents' | 'bundled' | 'runtime' | (string & {});
/** 技能目录里的一行。 */
export interface SkillRow {
    name: string;
    description: string;
    whenToUse?: string;
    source: SkillSource;
    provider: string;
    /** 磁盘路径；bundled/runtime 等无文件的技能为空。 */
    path?: string;
    /** 模型可否主动加载 / 用户可否调用。 */
    invocation: {
        modelInvocable: boolean;
        userInvocable: boolean;
    };
    /** 是否允许在面板里启用/禁用（需要可写文件路径）。 */
    toggleable: boolean;
    /** 当前是否被禁用（= !modelInvocable）。 */
    disabled: boolean;
}
/** 技能详情（编辑表单数据）。 */
export interface SkillDetail {
    name: string;
    description: string;
    whenToUse?: string;
    content: string;
    disabled: boolean;
    userInvocable: boolean;
    path: string;
    source: SkillSource;
    /** 其余未知 frontmatter 键（只读展示）。 */
    extraKeys: string[];
    warnings: string[];
}
/** 自建专家的能力开关（映射到真实预设组合行）。 */
export interface ExpertCapabilities {
    /** 终端（bash / pwsh 按平台选择）。 */
    shell: boolean;
    /** 文件读写与检索。 */
    fs: boolean;
    /** 技能目录与技能加载工具。 */
    skills: boolean;
    /** 待办工具。 */
    todo: boolean;
    /** 联网检索。 */
    web: boolean;
    /** 向用户提问。 */
    ask: boolean;
    /** 子代理与后台任务。 */
    subagents: boolean;
    /** 上下文压缩与 /compact。 */
    compaction: boolean;
}
/** 专家来源：local = 面板自建；market = 广场安装（自带完整组合）。 */
export type ExpertKind = 'local' | 'market';
/** 自建专家记录。 */
export interface ExpertRecord {
    id: string;
    /** 缺省视为 local（兼容旧记录）。 */
    kind?: ExpertKind;
    /** market 专家的组合原文与展示元数据。 */
    compositionYaml?: string;
    presetYaml?: string;
    /** market 专家的来源溯源。 */
    provenance?: {
        sourceId: string;
        itemId: string;
        version?: string;
    };
    name: string;
    description: string;
    /** emoji 或短文本图标。 */
    icon: string;
    tags: string[];
    /** 专家人格（persona prefix）。 */
    systemPrompt: string;
    capabilities: ExpertCapabilities;
    /** 绑定的技能名（写入 persona 说明）。 */
    skillNames: string[];
    /** 绑定的连接器 id（展开为 mcp-client 组合行）。 */
    connectorIds: string[];
    createdAt: string;
    updatedAt: string;
}
/** 官方预设摘要。 */
export interface PresetRow {
    id: string;
    name?: string;
    description?: string;
    order?: number;
    isDefault: boolean;
    broken?: string;
    /** 是否由本插件注册（自建专家）。 */
    mine: boolean;
}
/** 连接器传输方式。 */
export type ConnectorTransport = 'stdio' | 'streamable-http';
/** 连接器定义（持久化部分）。 */
export interface ConnectorRecord {
    id: string;
    /** 展示名。 */
    label: string;
    description: string;
    transport: ConnectorTransport;
    /** 模型侧工具前缀：mcp__<serverName>__<tool>。 */
    serverName: string;
    command: string;
    args: string[];
    env: Record<string, string>;
    cwd: string;
    url: string;
    headers: Record<string, string>;
    toolCallTimeoutMs: number;
    failOnStartupError: boolean;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}
/** 连接器运行态（不持久化）。 */
export interface ConnectorStatus {
    state: 'disabled' | 'connecting' | 'connected' | 'error';
    toolCount: number;
    tools: string[];
    lastError?: string;
    connectedAt?: string;
}
/** 连接器列表行：定义 + 运行态（含脱敏后的 env/headers）。 */
export interface ConnectorRow extends ConnectorRecord {
    status: ConnectorStatus;
    /** env/headers 中被脱敏的键名。 */
    redactedKeys: string[];
}
/** 只读展示：profile 里已配置的 mcp-client 行。 */
export interface ProfileConnectorRow {
    entryId: string;
    serverName: string;
    transport: string;
    enabled: boolean;
    source: 'cordis.yml' | 'cordis.patch.yml';
}
/** 能力探测结果：客户端据此做降级。 */
export interface Capabilities {
    skills: boolean;
    agentPresets: boolean;
    settings: boolean;
    storageDomain: boolean;
    webServer: boolean;
    connection: boolean;
    mcpClient: boolean;
    /** `@deepseek-ai/dsh-plugin-manager`（profile 插件管理）是否可用。 */
    pluginManager: boolean;
    /** 降级/缺失说明，直接展示给用户。 */
    notes: string[];
}
/** 本地（profile）插件行：dsh-plugin-manager 的 listPlugins 归一而来。 */
export interface PluginEntryRow {
    /** Loader 条目 id（启停写的就是它）。 */
    entryId: string;
    /** 模块名（= 包名）。 */
    moduleName: string;
    /** 展示标题（本地化优先中文）。 */
    title: string;
    /** 展示描述。 */
    description: string;
    icon?: string;
    /** 当前是否启用。 */
    enabled: boolean;
    /** 运行期阶段（active / pending / …）。 */
    fiberPhase: string;
    /** 可写的 patch 目标 id；缺省表示这一行只能读。 */
    patchId?: string;
    /** 只读原因。 */
    readOnlyReason?: string;
    /** 所属 bundle（由 bundle.rows 反查）。 */
    bundle?: string;
}
/** 本地（profile）插件包：dsh-plugin-manager 的 listBundles 归一而来。 */
export interface PluginBundleRow {
    name: string;
    version?: string;
    /** 本地化标题（上游 meta.title）；缺省时面板用 name。 */
    title?: string;
    description: string;
    /** 是否被选中为 profile 的一层（选中 ≠ 加载成功）。 */
    enabled: boolean;
    /** 依赖是否已安装。 */
    installed: boolean;
    /** 由 dsh 安装自带（不可移除）。 */
    optional: boolean;
    /** 是否可移除。 */
    removable: boolean;
    /** 只读原因（如管理组件自身）。 */
    readOnlyReason?: string;
    /** 加载/管理错误原文。 */
    error?: string;
    /** 该 bundle 声明的插件行 id。 */
    rows: string[];
    /** 被该 bundle 覆盖的既有行 id。 */
    overrides: string[];
    /**
     * 是否是**用户自己装的**插件：在 profile 的 `dependencies` 里。
     *
     * 「我的插件」页只列这些——App 自带/随安装提供的 bundle（如 `@deepseek-ai/dsh-base`）
     * 不在 dependencies 里，不该出现在「我装的插件」列表中。
     */
    mine?: boolean;
    /** 安装规格（依赖值：`^0.6.1` / `github:owner/repo` / `link:/path`）。 */
    spec?: string;
}
/** 本地插件页数据。 */
export interface PluginsView {
    /** 宿主是否提供 pluginManager 服务（false 时为只读降级视图）。 */
    available: boolean;
    profile: {
        name: string;
        dir: string;
    };
    bundles: PluginBundleRow[];
    rows: PluginEntryRow[];
    /** pnpm 11 拦下的依赖脚本（安装未完成时提示）。 */
    pendingBuilds: string[];
    notes: string[];
}
/** 插件管理写操作结果（installBundle / removeBundle / 启停共用）。 */
export interface PluginChangeResult {
    changed: boolean;
    /** applied / restart-required / overridden / failed / cancelled。 */
    application: string;
    stage: string;
    target: string;
    enabled?: boolean;
    error?: string;
    warnings: string[];
    pendingBuilds?: string[];
}
/** 插件整体状态（/status 与 square_status 工具共用）。 */
export interface DeckStatus {
    version: string;
    panelId: string;
    routePrefix: string;
    capabilities: Capabilities;
    counts: {
        skills: number;
        officialPresets: number;
        myExperts: number;
        connectors: number;
        connectorsConnected: number;
        connectorTools: number;
        /** 当前 profile 已安装的插件包（bundle）数量。 */
        plugins: number;
    };
    connectors: Array<{
        id: string;
        label: string;
        serverName: string;
    } & ConnectorStatus>;
    recentErrors: string[];
    storage: 'domain' | 'memory';
}
