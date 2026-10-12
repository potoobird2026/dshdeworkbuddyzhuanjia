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
import type {
  DomainGlobalLike,
  DomainLike,
  DomainSpecLike,
  DomainTableLike,
  HostCtx,
  StorageDomainService,
} from './capabilities.js';
import { service } from './capabilities.js';
import type { ConnectorRecord, ExpertCapabilities, ExpertRecord } from './types.js';

/** 专家能力开关 schema。 */
const CapabilitySchema = z.object({
  shell: z.boolean(),
  fs: z.boolean(),
  skills: z.boolean(),
  todo: z.boolean(),
  web: z.boolean(),
  ask: z.boolean(),
  subagents: z.boolean(),
  compaction: z.boolean(),
});

/** 专家记录 schema（`kind` 缺省视为 local，兼容旧记录）。 */
export const ExpertSchema = z.object({
  id: z.string().min(1),
  /** local = 面板自建（能力开关合成）；market = 广场安装（自带完整组合）。 */
  kind: z.union([z.literal('local'), z.literal('market')]).optional(),
  /** market 专家的组合原文（agent.cordis.yml）。 */
  compositionYaml: z.string().optional(),
  /** market 专家的展示元数据原文（preset.yml）。 */
  presetYaml: z.string().optional(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  tags: z.array(z.string()),
  systemPrompt: z.string(),
  capabilities: CapabilitySchema,
  skillNames: z.array(z.string()),
  connectorIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** 连接器记录 schema。 */
export const ConnectorSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  description: z.string(),
  transport: z.enum(['stdio', 'streamable-http']),
  serverName: z.string(),
  command: z.string(),
  args: z.array(z.string()),
  env: z.record(z.string(), z.string()),
  cwd: z.string(),
  url: z.string(),
  headers: z.record(z.string(), z.string()),
  toolCallTimeoutMs: z.number(),
  failOnStartupError: z.boolean(),
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** 广场安装溯源记录。 */
export const InstalledSchema = z.object({
  /** `${kind}:${安装键}`，例如 `skill:weekly-report`。 */
  key: z.string().min(1),
  kind: z.union([z.literal('skill'), z.literal('expert'), z.literal('connector'), z.literal('plugin')]),
  sourceId: z.string(),
  itemId: z.string(),
  version: z.string().optional(),
  sha256: z.string().optional(),
  installedAt: z.string(),
  /** 安装时的附加信息（路径 / 预设 id / serverName 等）。 */
  meta: z.record(z.string(), z.string()).optional(),
});

/** 广场安装溯源记录类型。 */
export type InstalledRecord = z.infer<typeof InstalledSchema>;

/** 键索引（存在域的 global 槽）。 */
const IndexSchema = z.object({
  experts: z.array(z.string()),
  connectors: z.array(z.string()),
  installed: z.array(z.string()).optional(),
});

type DeckIndex = { experts: string[]; connectors: string[]; installed: string[] };

/** 域声明：两张表 + 一个键索引 global。 */
export function deckDomainSpec(): DomainSpecLike {
  return {
    name: 'square',
    version: 1,
    layout: 'single',
    invalidRecords: 'backup-and-skip',
    global: {
      schema: IndexSchema,
      initial: { experts: [], connectors: [], installed: [] } satisfies DeckIndex,
    },
    tables: {
      experts: { valueSchema: ExpertSchema },
      connectors: { valueSchema: ConnectorSchema },
      installed: { valueSchema: InstalledSchema },
    },
  };
}

/** 进程内表：与 DomainTableLike 同形，供降级路径复用。 */
class MemoryTable<V> implements DomainTableLike<V> {
  private readonly rows = new Map<string, V>();

  get(key: string): V | undefined {
    return this.rows.get(key);
  }

  async put(key: string, value: V): Promise<void> {
    this.rows.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.rows.delete(key);
  }

  async update(key: string, fn: (current: V) => V): Promise<V> {
    const current = this.rows.get(key);
    if (current === undefined) throw new Error(`square: missing key ${key}`);
    const next = fn(current);
    this.rows.set(key, next);
    return next;
  }
}

/** 存储门面：所有读写都经过它，屏蔽 domain / memory 差异。 */
export class DeckStore {
  /** 实际使用的存储形态（诊断用）。 */
  readonly kind: 'domain' | 'memory';

  private readonly experts: DomainTableLike<ExpertRecord>;
  private readonly connectors: DomainTableLike<ConnectorRecord>;
  private readonly installed: DomainTableLike<InstalledRecord>;
  private readonly domain?: DomainLike;
  private readonly global?: DomainGlobalLike<unknown>;
  private index: DeckIndex;

  private constructor(
    kind: 'domain' | 'memory',
    experts: DomainTableLike<ExpertRecord>,
    connectors: DomainTableLike<ConnectorRecord>,
    installed: DomainTableLike<InstalledRecord>,
    index: DeckIndex,
    domain?: DomainLike,
  ) {
    this.kind = kind;
    this.experts = experts;
    this.connectors = connectors;
    this.installed = installed;
    this.index = index;
    this.domain = domain;
    this.global = domain?.global;
  }

  /** 打开存储：优先 domain，失败/缺失退化内存。 */
  static async open(ctx: HostCtx): Promise<DeckStore> {
    const facility = service<StorageDomainService>(ctx, 'storageDomain');
    if (facility !== undefined) {
      try {
        const domain = await facility.open(deckDomainSpec());
        const stored = domain.global?.get() as Partial<DeckIndex> | undefined;
        const index: DeckIndex = {
          experts: Array.isArray(stored?.experts) ? stored.experts : [],
          connectors: Array.isArray(stored?.connectors) ? stored.connectors : [],
          installed: Array.isArray(stored?.installed) ? stored.installed : [],
        };
        return new DeckStore(
          'domain',
          domain.table<ExpertRecord>('experts'),
          domain.table<ConnectorRecord>('connectors'),
          domain.table<InstalledRecord>('installed'),
          index,
          domain,
        );
      } catch (error) {
        ctx.logger.warn('[square] storageDomain.open failed; falling back to memory: %o', error);
      }
    } else {
      ctx.logger.warn('[square] ctx.storageDomain unavailable; using in-memory store');
    }
    return new DeckStore(
      'memory',
      new MemoryTable<ExpertRecord>(),
      new MemoryTable<ConnectorRecord>(),
      new MemoryTable<InstalledRecord>(),
      { experts: [], connectors: [], installed: [] },
    );
  }

  /** 全部专家（按名称排序）。 */
  listExperts(): ExpertRecord[] {
    const rows: ExpertRecord[] = [];
    for (const id of this.index.experts) {
      const row = this.experts.get(id);
      if (row === undefined) continue;
      rows.push(row);
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** 全部连接器（按 label 排序）。 */
  listConnectors(): ConnectorRecord[] {
    const rows: ConnectorRecord[] = [];
    for (const id of this.index.connectors) {
      const row = this.connectors.get(id);
      if (row === undefined) continue;
      rows.push(row);
    }
    return rows.sort((a, b) => a.label.localeCompare(b.label));
  }

  getExpert(id: string): ExpertRecord | undefined {
    return this.experts.get(id);
  }

  getConnector(id: string): ConnectorRecord | undefined {
    return this.connectors.get(id);
  }

  async putExpert(record: ExpertRecord): Promise<void> {
    await this.experts.put(record.id, record);
    await this.track('experts', record.id, true);
  }

  async putConnector(record: ConnectorRecord): Promise<void> {
    await this.connectors.put(record.id, record);
    await this.track('connectors', record.id, true);
  }

  async deleteExpert(id: string): Promise<boolean> {
    const removed = await this.experts.delete(id);
    await this.track('experts', id, false);
    return removed;
  }

  async deleteConnector(id: string): Promise<boolean> {
    const removed = await this.connectors.delete(id);
    await this.track('connectors', id, false);
    return removed;
  }

  /** 全部安装溯源记录。 */
  listInstalled(): InstalledRecord[] {
    const rows: InstalledRecord[] = [];
    for (const key of this.index.installed ?? []) {
      const row = this.installed.get(key);
      if (row !== undefined) rows.push(row);
    }
    return rows;
  }

  getInstalled(key: string): InstalledRecord | undefined {
    return this.installed.get(key);
  }

  async putInstalled(record: InstalledRecord): Promise<void> {
    await this.installed.put(record.key, record);
    await this.track('installed', record.key, true);
  }

  async deleteInstalled(key: string): Promise<void> {
    await this.installed.delete(key);
    await this.track('installed', key, false);
  }

  /** 关闭底层域（内存形态为 no-op）。 */
  async close(): Promise<void> {
    try {
      await this.domain?.close();
    } catch {
      /* 关闭失败不影响插件卸载 */
    }
  }

  /** 维护键索引并落盘。 */
  private async track(
    table: 'experts' | 'connectors' | 'installed',
    id: string,
    present: boolean,
  ): Promise<void> {
    const list = new Set<string>(this.index[table] ?? []);
    if (present) list.add(id);
    else list.delete(id);
    this.index = { ...this.index, [table]: [...list] };
    try {
      await this.global?.set(this.index);
    } catch {
      /* 索引写失败只影响重启后的列表完整性，不阻塞主操作 */
    }
  }
}

/** 默认能力开关：一个"能干活"的专家。 */
export function defaultCapabilities(): ExpertCapabilities {
  return {
    shell: true,
    fs: true,
    skills: true,
    todo: true,
    web: true,
    ask: true,
    subagents: false,
    compaction: true,
  };
}
