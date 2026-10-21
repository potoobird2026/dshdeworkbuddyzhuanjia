/**
 * 专家域：官方 Agent Preset 的浏览/设默认 + 自建专家的完整 CRUD。
 *
 * 自建专家的落地方式是**运行时注册真实 Agent Preset**
 * （`ctx.agentPresets.register({ id, name, description, order, plugins })`）：
 * 组合行由本插件按专家的能力开关拼装（persona + 官方能力行 + 绑定的
 * MCP 连接器行），不使用 `!!js` 表达式（平台分支在宿主直接求值）。因此
 * 自建专家会出现在官方预设列表里，也能被新会话选用。
 *
 * 这里同样只依赖 ctx 服务与本地类型，不导入任何 @deepseek-ai/* 运行时模块。
 */
import type { SquareConfig } from './config.js';
import type { AgentPresetDefinition, DetectedServices, HostCtx } from './capabilities.js';
import type { ConnectorRecord, ExpertRecord, PresetRow } from './types.js';
import type { DeckStore } from './store.js';
/** 官方默认预设的设置命名空间（profile 条目 id）。 */
export declare const PRESET_REGISTRY_NS = "agent-preset-registry";
/** 自建专家预设 id 前缀。 */
export declare const EXPERT_PREFIX = "square-";
/** 专家输入校验错误。 */
export declare class ExpertInputError extends Error {
    readonly code: string;
    constructor(message: string, code?: string);
}
/** 能力开关 → 预设组合行。 */
export declare function composeRows(expert: ExpertRecord, connectors: ConnectorRecord[], platform?: NodeJS.Platform): unknown[];
/** 专家记录 → 预设声明。 */
export declare function composeDefinition(expert: ExpertRecord, connectors: ConnectorRecord[], order: number): AgentPresetDefinition;
/**
 * 只有人设正文的外部专家源（如 agency-agents）用：把正文合成一份
 * **与自建专家同形**的组合 YAML（persona + 标准能力行）。
 *
 * 这些上游只提供人格文本、不提供 `agent.cordis.yml`，直接落库会缺 persona 行。
 * 走 `composeRows` 合成的好处是：能力行清单、顺序与平台差异（bash / pwsh）与
 * 自建专家完全一致，产出的组合又能直接喂给 `createFromComposition`，
 * 安装管线一行不用改。
 */
export declare function personaComposition(input: {
    id: string;
    name: string;
    description: string;
    icon?: string;
    tags?: string[];
    systemPrompt: string;
}): string;
/** 专家域实现。 */
export declare class ExpertsDomain {
    private readonly ctx;
    private readonly config;
    private readonly store;
    private readonly services;
    private readonly disposers;
    private readonly broken;
    private readonly connectors;
    constructor(ctx: HostCtx, config: SquareConfig, store: DeckStore, services: DetectedServices, connectors: {
        list(): ConnectorRecord[];
    });
    /** 列出官方预设与自建专家。 */
    listAll(): Promise<{
        official: PresetRow[];
        mine: ExpertRecord[];
        defaultId?: string;
        broken: Record<string, string>;
    }>;
    /** 读取一个专家的详情；id 以 `preset:` 前缀表示官方预设。 */
    read(id: string): Promise<{
        mine?: ExpertRecord;
        official?: {
            id: string;
            name?: string;
            description?: string;
            isDefault: boolean;
            broken?: string;
            compositionYaml?: string;
        };
    }>;
    /** 新建自建专家并注册为预设。 */
    create(input: Partial<ExpertRecord>): Promise<{
        expert: ExpertRecord;
        broken?: string;
    }>;
    /** 修改自建专家并重新注册。 */
    update(input: Partial<ExpertRecord> & {
        id: string;
    }): Promise<{
        expert: ExpertRecord;
        broken?: string;
    }>;
    /** 删除自建专家。 */
    remove(id: string): Promise<boolean>;
    /** 复制（自建专家或官方预设的展示信息）为新的自建专家。 */
    duplicate(id: string): Promise<ExpertRecord>;
    /** 设为默认预设（写注册表的 selectedDefault）。 */
    setDefault(id: string): Promise<void>;
    /**
     * 广场安装：把社区预设的组合原文注册成运行时预设。
     *
     * 组合是标准插件行 YAML；`!!js` 按生态约定转成 `{ __jsExpr: <表达式> }` 数据
     * （与 @linxin666/dsh-client-ui-preset-center 的处理一致），不在这里求值。
     */
    createFromComposition(input: {
        id: string;
        name: string;
        description: string;
        icon: string;
        tags: string[];
        composition: string;
        presetYaml?: string;
        provenance: {
            sourceId: string;
            itemId: string;
            version?: string;
        };
    }): Promise<{
        expert: ExpertRecord;
        broken?: string;
    }>;
    /** 注册市场预设（直接用其自带组合行，不经过能力开关合成）。 */
    private registerMarket;
    /** 按存储内容重算全部预设注册（apply 时与连接器变化后调用）。 */
    reconcile(): Promise<void>;
    /** 释放全部自建预设（插件卸载）。 */
    disposeAll(): Promise<void>;
    /** 注册一个问题专家的预设（覆盖旧注册）。 */
    private register;
    /** 注销一个专家的预设。 */
    private unregister;
    /** 注册后回读注册表，抓取激活诊断。 */
    private refreshBroken;
    /** 读取当前默认预设 id。 */
    private readDefaultId;
}
/** 组合 YAML → 插件行数组；`!!js` 转成 `{ __jsExpr }` 数据。 */
export declare function parseComposition(text: string): unknown[];
