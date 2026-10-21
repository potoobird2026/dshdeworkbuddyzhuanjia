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

import yaml from 'js-yaml';
import type { SquareConfig } from './config.js';
import type {
  AgentPresetDefinition,
  AgentPresetsService,
  DetectedServices,
  HostCtx,
} from './capabilities.js';
import { mcpClientConfig } from './connectors.js';
import type { ConnectorRecord, ExpertCapabilities, ExpertRecord, PresetRow } from './types.js';
import type { DeckStore } from './store.js';

/** 官方默认预设的设置命名空间（profile 条目 id）。 */
export const PRESET_REGISTRY_NS = 'agent-preset-registry';

/** 自建专家预设 id 前缀。 */
export const EXPERT_PREFIX = 'square-';

/** 预设排序：排在官方预设（order 1–3）之后。 */
const EXPERT_ORDER_BASE = 900;

/** 专家输入校验错误。 */
export class ExpertInputError extends Error {
  constructor(
    message: string,
    readonly code = 'invalid-expert',
  ) {
    super(message);
    this.name = 'ExpertInputError';
  }
}

/** 能力开关 → 预设组合行。 */
export function composeRows(
  expert: ExpertRecord,
  connectors: ConnectorRecord[],
  platform: NodeJS.Platform = process.platform,
): unknown[] {
  const rows: unknown[] = [];
  const skillsLine =
    expert.skillNames.length === 0
      ? ''
      : `\n优先使用这些技能：${expert.skillNames.join('、')}。`;
  rows.push({
    id: 'persona',
    name: '@deepseek-ai/dsh-persona',
    config: {
      prefix: expert.systemPrompt,
      ...(skillsLine === '' ? {} : { suffix: skillsLine.trimStart() }),
      complete: true,
      includeRuntimeContext: false,
    },
  });
  rows.push({
    id: 'agent-instructions',
    name: '@deepseek-ai/dsh-agent-instructions',
    config: { maxBytes: 65536 },
  });
  const caps: ExpertCapabilities = expert.capabilities;
  if (caps.shell) {
    if (platform === 'win32') {
      rows.push({ id: 'tool-pwsh', name: '@deepseek-ai/dsh-tool-pwsh' });
    } else {
      rows.push({ id: 'tool-bash', name: '@deepseek-ai/dsh-tool-bash' });
    }
  }
  if (caps.fs) {
    rows.push({ id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs' });
    rows.push({
      id: 'tool-fs-search',
      name: '@deepseek-ai/dsh-tool-fs-search',
      config: { sampleOverCapGlobResults: false },
    });
  }
  if (caps.skills) {
    rows.push({ id: 'skill-filesystem', name: '@deepseek-ai/dsh-skill-filesystem' });
    rows.push({ id: 'tool-skill', name: '@deepseek-ai/dsh-tool-skill' });
  }
  if (caps.todo) rows.push({ id: 'tool-todo', name: '@deepseek-ai/dsh-tool-todo' });
  if (caps.web) rows.push({ id: 'tool-web', name: '@deepseek-ai/dsh-tool-web' });
  if (caps.ask) rows.push({ id: 'tool-ask-user', name: '@deepseek-ai/dsh-tool-ask-user' });
  if (caps.subagents) {
    rows.push({ id: 'tool-jobs', name: '@deepseek-ai/dsh-tool-jobs' });
    // 子代理必须放在 isolate 组里（官方 preset-standard 的 delegation 组同形）。
    rows.push({
      id: 'delegation',
      name: 'cordis:group',
      group: true,
      isolate: { workflowEngine: true },
      config: [
        { id: 'tool-subagent-control', name: '@deepseek-ai/dsh-tool-subagent-control' },
        {
          id: 'tool-subagent-list-agents',
          name: '@deepseek-ai/dsh-tool-subagent-control/list-agents',
        },
        {
          id: 'tool-subagent',
          name: '@deepseek-ai/dsh-tool-subagent',
          config: { provider: 'spawn', toolName: 'subagent', backgroundMode: 'continuable' },
        },
        {
          id: 'tool-subagent-fork',
          name: '@deepseek-ai/dsh-tool-subagent',
          config: { provider: 'fork', toolName: 'subagent_fork', backgroundMode: 'continuable' },
        },
      ],
    });
  }
  if (caps.compaction) {
    // 压缩服务要求 isolate realm（官方 preset-standard 的 compaction 组同形）。
    rows.push({
      id: 'compaction',
      name: 'cordis:group',
      group: true,
      isolate: { compaction: true, toolResultPruner: true },
      config: [
        { id: 'compaction-basic', name: '@deepseek-ai/dsh-compaction-basic' },
        { id: 'command-compact', name: '@deepseek-ai/dsh-command-compact' },
        {
          id: 'tool-result-pruner',
          name: '@deepseek-ai/dsh-compaction-tool-result-pruner',
          config: { thresholdChars: 8192, headChars: 4096, tailChars: 1024 },
        },
      ],
    });
  }
  for (const connector of connectors) {
    rows.push({
      id: `connector-${connector.id}`,
      name: '@deepseek-ai/dsh-mcp-client',
      config: mcpClientConfig(connector),
    });
  }
  return rows;
}

/** 专家记录 → 预设声明。 */
export function composeDefinition(
  expert: ExpertRecord,
  connectors: ConnectorRecord[],
  order: number,
): AgentPresetDefinition {
  return {
    id: `${EXPERT_PREFIX}${expert.id}`,
    name: expert.name,
    description: expert.description,
    order,
    plugins: composeRows(expert, connectors),
  };
}

/**
 * 只有人设正文的外部专家源（如 agency-agents）用：把正文合成一份
 * **与自建专家同形**的组合 YAML（persona + 标准能力行）。
 *
 * 这些上游只提供人格文本、不提供 `agent.cordis.yml`，直接落库会缺 persona 行。
 * 走 `composeRows` 合成的好处是：能力行清单、顺序与平台差异（bash / pwsh）与
 * 自建专家完全一致，产出的组合又能直接喂给 `createFromComposition`，
 * 安装管线一行不用改。
 */
export function personaComposition(input: {
  id: string;
  name: string;
  description: string;
  icon?: string;
  tags?: string[];
  systemPrompt: string;
}): string {
  const now = new Date().toISOString();
  const expert: ExpertRecord = {
    id: input.id,
    name: input.name,
    description: input.description,
    icon: input.icon ?? '🤖',
    tags: input.tags ?? [],
    systemPrompt: input.systemPrompt,
    capabilities: defaultCaps(),
    skillNames: [],
    connectorIds: [],
    createdAt: now,
    updatedAt: now,
  };
  // lineWidth: -1 关掉折行（人设正文是块标量，折了不好读）；noRefs 避免锚点。
  return yaml.dump(composeRows(expert, []), { lineWidth: -1, noRefs: true });
}

/** 专家域实现。 */
export class ExpertsDomain {
  private readonly disposers = new Map<string, () => Promise<void>>();
  private readonly broken = new Map<string, string>();
  private readonly connectors: { list(): ConnectorRecord[] };

  constructor(
    private readonly ctx: HostCtx,
    private readonly config: SquareConfig,
    private readonly store: DeckStore,
    private readonly services: DetectedServices,
    connectors: { list(): ConnectorRecord[] },
  ) {
    this.connectors = connectors;
  }

  /** 列出官方预设与自建专家。 */
  async listAll(): Promise<{
    official: PresetRow[];
    mine: ExpertRecord[];
    defaultId?: string;
    broken: Record<string, string>;
  }> {
    const mine = this.store.listExperts();
    const official: PresetRow[] = [];
    if (this.services.agentPresets !== undefined) {
      try {
        const rows = await this.services.agentPresets.list();
        for (const row of rows) {
          const isMine = row.id.startsWith(EXPERT_PREFIX);
          if (isMine) continue;
          official.push({
            id: row.id,
            ...(row.name === undefined ? {} : { name: row.name }),
            ...(row.description === undefined ? {} : { description: row.description }),
            ...(row.order === undefined ? {} : { order: row.order }),
            isDefault: false,
            ...(row.broken === undefined ? {} : { broken: describeBroken(row.broken) }),
            mine: false,
          });
        }
      } catch (error) {
        this.ctx.logger.warn('[square] agentPresets.list failed: %o', error);
      }
    }
    const defaultId = this.readDefaultId();
    for (const row of official) row.isDefault = row.id === defaultId;
    return {
      official,
      mine,
      ...(defaultId === undefined ? {} : { defaultId }),
      broken: Object.fromEntries(this.broken),
    };
  }

  /** 读取一个专家的详情；id 以 `preset:` 前缀表示官方预设。 */
  async read(id: string): Promise<{
    mine?: ExpertRecord;
    official?: {
      id: string;
      name?: string;
      description?: string;
      isDefault: boolean;
      broken?: string;
      compositionYaml?: string;
    };
  }> {
    const mine = this.store.getExpert(id);
    if (mine !== undefined) return { mine };
    if (this.services.agentPresets === undefined) return {};
    const { official } = await this.listAll();
    const row = official.find((entry) => entry.id === id);
    if (row === undefined) return {};
    let compositionYaml: string | undefined;
    try {
      const document = await this.services.agentPresets.readDocument?.(id);
      compositionYaml = document?.content;
    } catch (error) {
      this.ctx.logger.debug('[square] readDocument failed: %o', error);
    }
    return {
      official: {
        id: row.id,
        ...(row.name === undefined ? {} : { name: row.name }),
        ...(row.description === undefined ? {} : { description: row.description }),
        isDefault: row.isDefault,
        ...(row.broken === undefined ? {} : { broken: row.broken }),
        ...(compositionYaml === undefined ? {} : { compositionYaml }),
      },
    };
  }

  /** 新建自建专家并注册为预设。 */
  async create(input: Partial<ExpertRecord>): Promise<{ expert: ExpertRecord; broken?: string }> {
    const expert = normalizeExpert(input, undefined);
    if (this.store.getExpert(expert.id) !== undefined) {
      throw new ExpertInputError(`专家 ${expert.id} 已存在`, 'already-exists');
    }
    await this.store.putExpert(expert);
    await this.register(expert);
    return { expert, ...(this.broken.get(expert.id) === undefined ? {} : { broken: this.broken.get(expert.id) }) };
  }

  /** 修改自建专家并重新注册。 */
  async update(input: Partial<ExpertRecord> & { id: string }): Promise<{ expert: ExpertRecord; broken?: string }> {
    const existing = this.store.getExpert(input.id);
    if (existing === undefined) {
      throw new ExpertInputError(`专家 ${input.id} 不存在`, 'not-found');
    }
    const expert = normalizeExpert(input, existing);
    await this.unregister(existing.id);
    await this.store.putExpert(expert);
    await this.register(expert);
    return { expert, ...(this.broken.get(expert.id) === undefined ? {} : { broken: this.broken.get(expert.id) }) };
  }

  /** 删除自建专家。 */
  async remove(id: string): Promise<boolean> {
    await this.unregister(id);
    return this.store.deleteExpert(id);
  }

  /** 复制（自建专家或官方预设的展示信息）为新的自建专家。 */
  async duplicate(id: string): Promise<ExpertRecord> {
    const source = this.store.getExpert(id);
    if (source !== undefined) {
      const copy = normalizeExpert(
        { ...source, id: undefined, name: `${source.name} 副本` },
        undefined,
      );
      await this.store.putExpert(copy);
      await this.register(copy);
      return copy;
    }
    const { official } = await this.listAll();
    const row = official.find((entry) => entry.id === id);
    if (row === undefined) throw new ExpertInputError(`预设 ${id} 不存在`, 'not-found');
    const copy = normalizeExpert(
      {
        name: `${row.name ?? row.id} 副本`,
        description: row.description ?? '',
        systemPrompt: `你是一个名为「${row.name ?? row.id}」的专家。`,
      },
      undefined,
    );
    await this.store.putExpert(copy);
    await this.register(copy);
    return copy;
  }

  /** 设为默认预设（写注册表的 selectedDefault）。 */
  async setDefault(id: string): Promise<void> {
    if (this.services.settings === undefined) {
      throw new ExpertInputError('ctx.settings 不可用，无法修改默认预设', 'no-settings');
    }
    if (this.services.settings.writable === false) {
      throw new ExpertInputError('当前 profile 的设置不可写', 'read-only');
    }
    await this.services.settings.update(PRESET_REGISTRY_NS, { selectedDefault: id });
  }

  /**
   * 广场安装：把社区预设的组合原文注册成运行时预设。
   *
   * 组合是标准插件行 YAML；`!!js` 按生态约定转成 `{ __jsExpr: <表达式> }` 数据
   * （与 @linxin666/dsh-client-ui-preset-center 的处理一致），不在这里求值。
   */
  async createFromComposition(input: {
    id: string;
    name: string;
    description: string;
    icon: string;
    tags: string[];
    composition: string;
    presetYaml?: string;
    provenance: { sourceId: string; itemId: string; version?: string };
  }): Promise<{ expert: ExpertRecord; broken?: string }> {
    const rows = parseComposition(input.composition);
    const id = input.id.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 64);
    if (id === '') throw new ExpertInputError('预设 id 非法', 'invalid-id');
    if (this.store.getExpert(id) !== undefined) {
      // 已安装过：先注销再覆盖（更新路径）。
      await this.unregister(id);
    }
    const now = new Date().toISOString();
    const expert: ExpertRecord = {
      id,
      kind: 'market',
      name: input.name,
      description: input.description,
      icon: input.icon,
      tags: input.tags,
      systemPrompt: '',
      capabilities: {
        shell: false,
        fs: false,
        skills: false,
        todo: false,
        web: false,
        ask: false,
        subagents: false,
        compaction: false,
      },
      skillNames: [],
      connectorIds: [],
      compositionYaml: input.composition,
      ...(input.presetYaml === undefined ? {} : { presetYaml: input.presetYaml }),
      provenance: input.provenance,
      createdAt: now,
      updatedAt: now,
    };
    await this.store.putExpert(expert);
    await this.registerMarket(expert, rows);
    return {
      expert,
      ...(this.broken.get(expert.id) === undefined ? {} : { broken: this.broken.get(expert.id) }),
    };
  }

  /** 注册市场预设（直接用其自带组合行，不经过能力开关合成）。 */
  private async registerMarket(expert: ExpertRecord, rows: unknown[]): Promise<void> {
    if (this.services.agentPresets?.register === undefined) {
      this.broken.set(expert.id, 'ctx.agentPresets.register 不可用：当前部署不支持运行时注册预设');
      return;
    }
    await this.unregister(expert.id);
    if (rows.length === 0) {
      this.broken.set(expert.id, '组合为空：agent.cordis.yml 里没有插件行');
      return;
    }
    try {
      const dispose = await this.services.agentPresets.register({
        id: `${EXPERT_PREFIX}${expert.id}`,
        name: expert.name,
        description: expert.description,
        order: EXPERT_ORDER_BASE,
        plugins: rows,
      });
      this.disposers.set(expert.id, dispose);
      this.broken.delete(expert.id);
      await this.refreshBroken(expert.id);
    } catch (error) {
      this.broken.set(expert.id, error instanceof Error ? error.message : String(error));
      this.ctx.logger.warn('[square] market preset register failed for %s: %o', expert.id, error);
    }
  }

  /** 按存储内容重算全部预设注册（apply 时与连接器变化后调用）。 */
  async reconcile(): Promise<void> {
    for (const id of [...this.disposers.keys()]) await this.unregister(id);
    const experts = this.store.listExperts();
    for (const [index, expert] of experts.entries()) {
      await this.register(expert, EXPERT_ORDER_BASE + index);
    }
  }

  /** 释放全部自建预设（插件卸载）。 */
  async disposeAll(): Promise<void> {
    for (const id of [...this.disposers.keys()]) await this.unregister(id);
  }

  /** 注册一个问题专家的预设（覆盖旧注册）。 */
  private async register(expert: ExpertRecord, order = EXPERT_ORDER_BASE): Promise<void> {
    if (expert.kind === 'market') {
      await this.registerMarket(expert, parseComposition(expert.compositionYaml ?? ''));
      return;
    }
    if (this.services.agentPresets?.register === undefined) {
      this.broken.set(expert.id, 'ctx.agentPresets.register 不可用：当前部署不支持运行时注册预设');
      return;
    }
    await this.unregister(expert.id);
    const connectors = expert.connectorIds
      .map((id) => this.store.getConnector(id))
      .filter((row): row is ConnectorRecord => row !== undefined);
    const definition = composeDefinition(expert, connectors, order);
    try {
      const dispose = await this.services.agentPresets.register(definition);
      this.disposers.set(expert.id, dispose);
      this.broken.delete(expert.id);
      await this.refreshBroken(expert.id);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      this.broken.set(expert.id, text);
      this.ctx.logger.warn('[square] preset register failed for %s: %o', expert.id, error);
    }
  }

  /** 注销一个专家的预设。 */
  private async unregister(expertId: string): Promise<void> {
    const dispose = this.disposers.get(expertId);
    this.disposers.delete(expertId);
    if (dispose === undefined) return;
    try {
      await dispose();
    } catch (error) {
      this.ctx.logger.warn('[square] preset dispose failed for %s: %o', expertId, error);
    }
  }

  /** 注册后回读注册表，抓取激活诊断。 */
  private async refreshBroken(expertId: string): Promise<void> {
    const service = this.services.agentPresets;
    if (service === undefined) return;
    try {
      const rows = await service.list();
      const row = rows.find((entry) => entry.id === `${EXPERT_PREFIX}${expertId}`);
      if (row?.broken !== undefined) this.broken.set(expertId, describeBroken(row.broken));
    } catch {
      /* 诊断失败不影响注册结果 */
    }
  }

  /** 读取当前默认预设 id。 */
  private readDefaultId(): string | undefined {
    const settings = this.services.settings;
    if (settings?.describe === undefined) return undefined;
    try {
      const descriptors = settings.describe({ redactSecrets: true });
      const entry = descriptors.find((descriptor) => descriptor.ns === PRESET_REGISTRY_NS);
      const value = entry?.value;
      if (value !== null && typeof value === 'object' && 'selectedDefault' in value) {
        const selected = (value as { selectedDefault?: unknown }).selectedDefault;
        if (typeof selected === 'string' && selected !== '') return selected;
      }
    } catch {
      /* 读不到就当没有默认值 */
    }
    return undefined;
  }
}

/** 规范化专家输入（新建时补默认值，更新时以旧值兜底）。 */
function normalizeExpert(input: Partial<ExpertRecord>, existing: ExpertRecord | undefined): ExpertRecord {
  const name = (input.name ?? existing?.name ?? '').trim();
  if (name === '') throw new ExpertInputError('专家名称不能为空', 'invalid-name');
  const id = (input.id ?? existing?.id ?? slug(name)).trim();
  if (id === '' || id.startsWith(EXPERT_PREFIX)) {
    throw new ExpertInputError(`专家 id 非法：${id}`, 'invalid-id');
  }
  const row: ExpertRecord = {
    id,
    name,
    description: (input.description ?? existing?.description ?? '').trim(),
    icon: (input.icon ?? existing?.icon ?? '🤖').trim(),
    tags: input.tags ?? existing?.tags ?? [],
    systemPrompt: (input.systemPrompt ?? existing?.systemPrompt ?? '').trim(),
    capabilities: input.capabilities ?? existing?.capabilities ?? defaultCaps(),
    skillNames: input.skillNames ?? existing?.skillNames ?? [],
    connectorIds: input.connectorIds ?? existing?.connectorIds ?? [],
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (row.systemPrompt === '') {
    throw new ExpertInputError('专家系统提示词不能为空', 'invalid-prompt');
  }
  return row;
}

/** 名称 → id（保 ASCII，中文名退化为时间戳后缀）。 */
function slug(name: string): string {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const suffix = Math.random().toString(36).slice(2, 6);
  if (ascii === '') return `expert-${Date.now().toString(36)}-${suffix}`;
  return `${ascii}-${suffix}`;
}

/** 新建专家时的默认能力。 */
function defaultCaps(): ExpertCapabilities {
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

/** 把 broken 值转成可读文本。 */
function describeBroken(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** 组合 YAML → 插件行数组；`!!js` 转成 `{ __jsExpr }` 数据。 */
export function parseComposition(text: string): unknown[] {
  if (text.trim() === '') return [];
  const schema = yaml.DEFAULT_SCHEMA.extend([
    new yaml.Type('tag:yaml.org,2002:js', {
      kind: 'scalar',
      construct: (data: unknown) => ({ __jsExpr: String(data) }),
    }),
  ]);
  const parsed = yaml.load(text, { schema });
  if (!Array.isArray(parsed)) throw new ExpertInputError('组合必须是插件行数组', 'bad-composition');
  return parsed as unknown[];
}
