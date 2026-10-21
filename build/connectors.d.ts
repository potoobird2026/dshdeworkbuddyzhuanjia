/**
 * 连接器域：MCP 服务器定义的增删改查、运行时挂载/卸载、状态与工具统计。
 *
 * 落地方式是**运行时挂载官方 `@deepseek-ai/dsh-mcp-client`**：
 *   `await ctx.plugin({ name, inject, apply }, config)` → 返回的 Fiber 即一个
 * 已连接的 MCP 服务器；`fiber.dispose()` 断开并撤销它注册的工具。这样
 * 添加/删除连接器不需要改 profile 配置，也不需要重启。
 *
 * 只有 `@deepseek-ai/dsh-mcp-client` 是真实运行时导入；其余服务都通过 ctx 取。
 */
import type { SquareConfig, ResolvedPaths } from './config.js';
import type { DetectedServices, HostCtx } from './capabilities.js';
import type { ConnectorRecord, ConnectorRow, ConnectorStatus, ProfileConnectorRow } from './types.js';
/** 脱敏占位符：客户端原样回传时视为「不修改」。 */
export declare const REDACTED = "\u2022\u2022\u2022\u2022\u2022\u2022";
/** MCP serverName 规范（与 dsh-mcp-client 一致）。 */
export declare const SERVER_NAME_PATTERN: RegExp;
/** 传入的原始连接器输入。 */
export interface ConnectorInput {
    id?: string;
    label?: string;
    description?: string;
    transport?: string;
    serverName?: string;
    command?: string;
    args?: unknown;
    env?: unknown;
    cwd?: string;
    url?: string;
    headers?: unknown;
    toolCallTimeoutMs?: number;
    failOnStartupError?: boolean;
    enabled?: boolean;
}
/** 带状态码的输入错误。 */
export declare class ConnectorInputError extends Error {
    readonly code: string;
    constructor(message: string, code?: string);
}
/** 把原始输入规范化成一条记录；existing 用于保留脱敏字段与不可变字段。 */
export declare function normalizeConnector(raw: unknown, existing: ConnectorRecord | undefined): ConnectorRecord;
/** 记录 → `@deepseek-ai/dsh-mcp-client` 的 Config（只保留它认识的字段）。 */
export declare function mcpClientConfig(record: ConnectorRecord): Record<string, unknown>;
/** 连接器域实现。 */
export declare class ConnectorsDomain {
    private readonly ctx;
    private readonly config;
    private readonly paths;
    private readonly services;
    private readonly fibers;
    private readonly statuses;
    private modulePromise;
    constructor(ctx: HostCtx, config: SquareConfig, paths: ResolvedPaths, services: DetectedServices);
    /** 列出连接器（含运行态与脱敏）。 */
    list(records: ConnectorRecord[]): ConnectorRow[];
    /** 单个连接器的运行态。 */
    status(record: ConnectorRecord): ConnectorStatus;
    /** 按记录启用状态挂载/卸载。 */
    reconcile(records: ConnectorRecord[]): Promise<void>;
    /** 挂载一个连接器（失败记录在状态里，不抛出）。 */
    mount(record: ConnectorRecord): Promise<ConnectorStatus>;
    /** 卸载一个连接器。 */
    unmount(id: string, state?: ConnectorStatus['state']): Promise<void>;
    /** 断开重连。 */
    reconnect(record: ConnectorRecord): Promise<ConnectorStatus>;
    /** 测试：挂载 → 收集工具 → 卸载（不改变启用状态）。 */
    test(record: ConnectorRecord): Promise<{
        ok: boolean;
        tools: string[];
        error?: string;
    }>;
    /** 释放全部连接器（插件卸载）。 */
    disposeAll(): Promise<void>;
    /** 统计所有已连接连接器的工具数。 */
    totalTools(): number;
    /** 所有连接器的运行态快照。 */
    statusSnapshot(): ConnectorStatus[];
    /** 只读：profile 里已配置的 mcp-client 行。 */
    profileRows(): Promise<ProfileConnectorRow[]>;
    /** 动态导入官方 MCP 桥（只导一次）。 */
    private loadModule;
    /** 从 ctx.tools 里收集某连接器注册出来的工具名。 */
    private collectStatus;
}
