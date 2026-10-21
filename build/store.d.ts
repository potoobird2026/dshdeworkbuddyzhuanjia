/**
 * 专家 / 连接器的持久化层。
 *
 * 首选 `ctx.storageDomain`（dsh-storage-domain，json 后端），它提供 zod 校验、
 * 原子落盘与 `domain/changed` 事件；服务缺失（headless / CI / 老 profile）时
 * 退化为进程内 Map，插件其余功能不受影响。
 *
 * 两点实现约束：
 *  1. 这里**不**从 `@deepseek-ai/dsh-storage-domain` 导入任何东西 —— 域声明用
 *     普通对象字面量构造（`defineDomain` 只是同构的身份校验），服务通过 ctx 取。
 *  2. 域句柄没有「列键」API，所以键索引存在域的 global 槽里（put/delete 时同步
 *     维护）；读取时对失效键做惰性修剪。
 */
import { z } from 'zod';
import type { DomainSpecLike, HostCtx } from './capabilities.js';
import type { ConnectorRecord, ExpertCapabilities, ExpertRecord } from './types.js';
/** 专家记录 schema（`kind` 缺省视为 local，兼容旧记录）。 */
export declare const ExpertSchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<"local">, z.ZodLiteral<"market">]>>;
    compositionYaml: z.ZodOptional<z.ZodString>;
    presetYaml: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    description: z.ZodString;
    icon: z.ZodString;
    tags: z.ZodArray<z.ZodString>;
    systemPrompt: z.ZodString;
    capabilities: z.ZodObject<{
        shell: z.ZodBoolean;
        fs: z.ZodBoolean;
        skills: z.ZodBoolean;
        todo: z.ZodBoolean;
        web: z.ZodBoolean;
        ask: z.ZodBoolean;
        subagents: z.ZodBoolean;
        compaction: z.ZodBoolean;
    }, z.core.$strip>;
    skillNames: z.ZodArray<z.ZodString>;
    connectorIds: z.ZodArray<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
/** 连接器记录 schema。 */
export declare const ConnectorSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    description: z.ZodString;
    transport: z.ZodEnum<{
        stdio: "stdio";
        "streamable-http": "streamable-http";
    }>;
    serverName: z.ZodString;
    command: z.ZodString;
    args: z.ZodArray<z.ZodString>;
    env: z.ZodRecord<z.ZodString, z.ZodString>;
    cwd: z.ZodString;
    url: z.ZodString;
    headers: z.ZodRecord<z.ZodString, z.ZodString>;
    toolCallTimeoutMs: z.ZodNumber;
    failOnStartupError: z.ZodBoolean;
    enabled: z.ZodBoolean;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
/** 广场安装溯源记录。 */
export declare const InstalledSchema: z.ZodObject<{
    key: z.ZodString;
    kind: z.ZodUnion<readonly [z.ZodLiteral<"skill">, z.ZodLiteral<"expert">, z.ZodLiteral<"connector">, z.ZodLiteral<"plugin">]>;
    sourceId: z.ZodString;
    itemId: z.ZodString;
    version: z.ZodOptional<z.ZodString>;
    sha256: z.ZodOptional<z.ZodString>;
    installedAt: z.ZodString;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
/** 广场安装溯源记录类型。 */
export type InstalledRecord = z.infer<typeof InstalledSchema>;
/** 域声明：两张表 + 一个键索引 global。 */
export declare function deckDomainSpec(): DomainSpecLike;
/** 存储门面：所有读写都经过它，屏蔽 domain / memory 差异。 */
export declare class DeckStore {
    /** 实际使用的存储形态（诊断用）。 */
    readonly kind: 'domain' | 'memory';
    private readonly experts;
    private readonly connectors;
    private readonly installed;
    private readonly domain?;
    private readonly global?;
    private index;
    private constructor();
    /** 打开存储：优先 domain，失败/缺失退化内存。 */
    static open(ctx: HostCtx): Promise<DeckStore>;
    /** 全部专家（按名称排序）。 */
    listExperts(): ExpertRecord[];
    /** 全部连接器（按 label 排序）。 */
    listConnectors(): ConnectorRecord[];
    getExpert(id: string): ExpertRecord | undefined;
    getConnector(id: string): ConnectorRecord | undefined;
    putExpert(record: ExpertRecord): Promise<void>;
    putConnector(record: ConnectorRecord): Promise<void>;
    deleteExpert(id: string): Promise<boolean>;
    deleteConnector(id: string): Promise<boolean>;
    /** 全部安装溯源记录。 */
    listInstalled(): InstalledRecord[];
    getInstalled(key: string): InstalledRecord | undefined;
    putInstalled(record: InstalledRecord): Promise<void>;
    deleteInstalled(key: string): Promise<void>;
    /** 关闭底层域（内存形态为 no-op）。 */
    close(): Promise<void>;
    /** 维护键索引并落盘。 */
    private track;
}
/** 默认能力开关：一个"能干活"的专家。 */
export declare function defaultCapabilities(): ExpertCapabilities;
