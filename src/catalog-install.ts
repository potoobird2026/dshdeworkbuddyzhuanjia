/**
 * 源注册表（多源聚合、状态跟踪）与安装器（技能/专家/连接器三条安装管线）。
 *
 * 安装器只依赖各领域已有的能力（SkillsDomain / ExpertsDomain / ConnectorsDomain），
 * 自身负责：取详情 → 落盘/注册/挂载 → 写溯源 → 失败回滚。
 */

import type { SquareConfig, ResolvedPaths } from './config.js';
import type { ChangeResultLike, HostCtx, PluginManagerService } from './capabilities.js';
import type {
  CatalogDetail,
  CatalogItem,
  CatalogKind,
  CatalogPage,
  CatalogQuery,
  CatalogSource,
  SourceCtx,
  SourceStatus,
} from './catalog.js';
import { CatalogError } from './catalog.js';
import { normalizeCategory, categoryList } from './catalog-categories.js';
import { displayStats } from './catalog-stats.js';
import { connectorFromHint, hashContent } from './catalog-sources.js';
import { normalizeConnector } from './connectors.js';
import type { ConnectorsDomain } from './connectors.js';
import type { ExpertsDomain } from './experts.js';
import { parseFrontmatter } from './frontmatter.js';
import type { SkillsDomain } from './skills.js';
import type { DeckStore, InstalledRecord } from './store.js';
import type { CachedFetcher } from './catalog.js';

/** 判断文件是否为文本（按扩展名）。 */
const TEXT_EXT = /\.(md|markdown|txt|json|ya?ml|toml|csv|tsv|js|mjs|cjs|ts|tsx|py|sh|bash|zsh|ps1|html|css|svg|xml|ini|conf|env|gitignore|license|rst|sql)$/i;

/** 多源列表结果。 */
export interface CatalogListResult extends CatalogPage {
  sources: SourceStatus[];
}

/**
 * 多源扇出用的**复合游标**。
 *
 * 技能 / 专家 / 连接器这三类没有单一大目录（是多个源拼出来的），每个源自己也不
 * 认游标，所以注册表层自己记「每个源已经读到第几条」：
 *
 *   `fo1:experts-dsh-market=24|experts-agency-agents=18`
 *
 * 只有 offset > 0 的源会写进游标；源 id 里不会出现 `=` 或 `|`（见各源声明），
 * 因此解析用最后一个 `=` 切分即可。解析失败一律当「从头开始」，绝不 500。
 */
const FANOUT_CURSOR_PREFIX = 'fo1:';

/** offset 表 → 复合游标（没有源需要记录时返回空前缀串，但调用方只在 hasMore 时才用）。 */
export function encodeFanoutCursor(offsets: Map<string, number>): string {
  const parts: string[] = [];
  for (const [id, offset] of offsets) {
    if (offset > 0) parts.push(`${id}=${String(offset)}`);
  }
  return `${FANOUT_CURSOR_PREFIX}${parts.join('|')}`;
}

/** 复合游标 → offset 表；非法/缺失/旧格式一律返回空表（= 第一页）。 */
export function parseFanoutCursor(cursor: string | undefined): Map<string, number> {
  const offsets = new Map<string, number>();
  if (cursor === undefined || !cursor.startsWith(FANOUT_CURSOR_PREFIX)) return offsets;
  for (const part of cursor.slice(FANOUT_CURSOR_PREFIX.length).split('|')) {
    const at = part.lastIndexOf('=');
    if (at <= 0) continue;
    const offset = Number.parseInt(part.slice(at + 1), 10);
    if (Number.isFinite(offset) && offset >= 0) offsets.set(part.slice(0, at), offset);
  }
  return offsets;
}

/** 源注册表。 */
export class SourceRegistry {
  private readonly statuses = new Map<string, SourceStatus>();

  constructor(
    private readonly sources: CatalogSource[],
    private readonly ctx: SourceCtx,
  ) {
    for (const source of sources) {
      this.statuses.set(source.id, {
        id: source.id,
        label: source.label,
        kind: source.kind,
        enabled: true,
        installable: source.installable,
        ok: true,
        ttlMs: ctx.config.catalogTtlMs,
      });
    }
  }

  /** 全部源状态。 */
  listSources(): SourceStatus[] {
    return [...this.statuses.values()];
  }

  /** 取一个源。 */
  source(id: string): CatalogSource | undefined {
    return this.sources.find((source) => source.id === id);
  }

  /** 该种类可用的源。 */
  private forKind(kind: CatalogKind): CatalogSource[] {
    return this.sources.filter((source) => source.kind === kind || source.kind === 'all');
  }

  /** 列表：指定源则单源分页，否则多源扇出（复合游标推进，见 `parseFanoutCursor`）。 */
  async list(query: CatalogQuery): Promise<CatalogListResult> {
    const limit = query.limit ?? this.ctx.config.catalogPageSize;
    // category 在注册表层按归一后的标准分类统一过滤（各源原始分类口径不同，
    // 例如 dsh-market 是 roleplay 标签），不下发给源，避免源内误过滤。
    // 例外：源自带分类体系（实现了 categories()，如插件广场）时，过滤必须
    // 下发给源——否则分页会在上游按全量走、在这里被过滤掉大半。
    const sourceQuery: CatalogQuery = { ...query, category: undefined };
    if (query.source !== undefined && query.source !== '') {
      const source = this.source(query.source);
      if (source === undefined) throw new CatalogError(`未知数据源：${query.source}`, 'unknown-source', 400);
      const ownsCategories = typeof source.categories === 'function';
      const page = await this.run(source, () =>
        source.list(
          {
            ...sourceQuery,
            ...(ownsCategories && query.category !== undefined && query.category !== ''
              ? { category: query.category }
              : {}),
            limit,
          },
          this.ctx,
        ),
      );
      // 归一分类 + 补展示计数（下载/收藏），再按标准分类过滤。
      const poolSize = page.items.reduce((max, item) => Math.max(max, item.stats?.rank ?? 0), 0);
      const normalized = page.items
        .map((item) => ({ ...item, category: normalizeCategory(item), stats: displayStats(item, poolSize) }))
        .filter(
          (item) =>
            ownsCategories ||
            query.category === undefined ||
            query.category === '' ||
            item.category === query.category,
        );
      return { ...page, items: normalized, sources: this.listSources() };
    }
    const sources = this.forKind(query.kind);
    // 分页源（`paginated: true`，如插件广场 4392 条）与一次性源（自建目录 /
    // 我的提交这类本地小集合）分开处理：前者决定游标与总数，后者只在第一页
    // 补进来。否则「每源均分」会按 24/3=8 把大目录切碎，游标也一起丢掉。
    const paged = sources.filter((source) => source.paginated === true);
    const extras = sources.filter((source) => source.paginated !== true);
    const loadingMore = query.cursor !== undefined && query.cursor !== '';
    const failures: string[] = [];
    const localItems: CatalogItem[] = [];
    const pagedItems: CatalogItem[] = [];
    let nextCursor: string | undefined;
    let reportedTotal: number | undefined;
    /** 多源扇出时用它给出总数（各源归一后条目池之和），避免被本页切片口径带偏。 */
    let outTotal: number | undefined;

    /**
     * 拉一个源：归一分类 + 补展示计数，返回**该源归一后的完整条目池**。
     *
     * 分类过滤对「自带分类体系」的源不下发也不再过滤（它自己按标准分类过滤过），
     * 其余源在这里按归一后的标准分类过滤。
     */
    const pull = async (
      source: CatalogSource,
      sourceLimit: number,
    ): Promise<{ items: CatalogItem[]; page: CatalogPage } | undefined> => {
      try {
        const ownsCategories = typeof source.categories === 'function';
        const page = await this.run(source, () =>
          source.list(
            {
              ...sourceQuery,
              ...(ownsCategories && query.category !== undefined && query.category !== ''
                ? { category: query.category }
                : {}),
              limit: sourceLimit,
            },
            this.ctx,
          ),
        );
        const poolSize = page.items.reduce((max, item) => Math.max(max, item.stats?.rank ?? 0), 0);
        const items: CatalogItem[] = [];
        for (const item of page.items) {
          item.category = normalizeCategory(item);
          item.stats = displayStats(item, poolSize);
          if (
            ownsCategories ||
            query.category === undefined ||
            query.category === '' ||
            item.category === query.category
          ) {
            items.push(item);
          }
        }
        return { items, page };
      } catch (error) {
        failures.push(`${source.label}：${error instanceof Error ? error.message : String(error)}`);
        return undefined;
      }
    };

    if (paged.length === 0) {
      // 多源扇出：这些源都不自带游标，就在注册表层用**复合游标**推进——
      // 每个源记自己的 offset，页与页之间不重不漏，「加载更多」也随之出现。
      // （顺序填充的取舍：第一个源先填满本页；源间交错留待下一步。）
      const offsets = parseFanoutCursor(query.cursor);
      const next = new Map<string, number>();
      let remaining = limit;
      let poolTotal = 0;
      let hasMore = false;
      for (const source of sources) {
        const offset = offsets.get(source.id) ?? 0;
        // 按 limit 截断的源（官方 MCP Registry）也要交出 [0, offset+remaining) 这一段，
        // 好在本地按 offset 切片；不理会 limit 的源照旧返回全量池。
        const pulled = await pull(source, offset + Math.max(remaining, 1));
        if (pulled === undefined) {
          next.set(source.id, offset);
          continue;
        }
        const pool = pulled.items;
        poolTotal += pool.length;
        const slice = remaining > 0 ? pool.slice(offset, offset + remaining) : [];
        localItems.push(...slice);
        remaining -= slice.length;
        const reached = offset + slice.length;
        next.set(source.id, reached);
        if (reached < pool.length) hasMore = true;
      }
      // 没有任何一个源还有剩余 => 分页到此为止（不再下发游标）。
      if (hasMore) nextCursor = encodeFanoutCursor(next);
      outTotal = poolTotal;
    } else {
      // 有分页源：本地/自建条目先占位（最多 limit-1 条，给目录留至少 1 条），
      // 剩下的额度按用户要的条数给分页源；「加载更多」只翻分页源。
      const single = paged.length === 1;
      const extraBudget = Math.max(1, limit - 1);
      if (!loadingMore) {
        for (const source of extras) {
          if (localItems.length >= extraBudget) break;
          const pulled = await pull(source, extraBudget - localItems.length);
          if (pulled !== undefined) localItems.push(...pulled.items);
        }
        // 有些源不理会 limit（自建目录 / 我的提交是一次性返回全量的）：这里硬截断，
        // 保证分页源至少拿到 1 条，游标才能推进。
        if (localItems.length > extraBudget) localItems.length = extraBudget;
      }
      const budget = Math.max(1, limit - localItems.length);
      const perSource = single ? budget : Math.max(4, Math.ceil(budget / paged.length));
      for (const source of paged) {
        const pulled = await pull(source, perSource);
        if (pulled === undefined) continue;
        pagedItems.push(...pulled.items);
        if (single) {
          nextCursor = pulled.page.nextCursor;
          reportedTotal = pulled.page.total;
        }
      }
    }

    const items = [...localItems, ...pagedItems];
    if (items.length === 0 && failures.length > 0) {
      throw new CatalogError(failures.join('；'), 'all-sources-failed');
    }
    return {
      items: items.slice(0, limit),
      total: outTotal ?? (reportedTotal === undefined ? items.length : reportedTotal + localItems.length),
      ...(nextCursor === undefined ? {} : { nextCursor }),
      sources: this.listSources(),
    };
  }

  /**
   * 某个 kind 的目录分类。
   *
   * 上游自带分类体系的源（`categories()`）为权威答案；没有或拉取失败时退回
   * 静态标准分类表，保证分类筛选条不会空。
   */
  async categories(kind: CatalogKind): Promise<string[]> {
    const owner = this.forKind(kind).find((source) => typeof source.categories === 'function');
    if (owner?.categories === undefined) return categoryList(kind);
    try {
      const list = await this.run(owner, () => (owner.categories as NonNullable<typeof owner.categories>)(this.ctx));
      return list.length === 0 ? categoryList(kind) : list;
    } catch {
      return categoryList(kind);
    }
  }

  /** 详情。 */
  async item(sourceId: string, id: string): Promise<CatalogDetail> {
    const source = this.source(sourceId);
    if (source === undefined) throw new CatalogError(`未知数据源：${sourceId}`, 'unknown-source', 400);
    return this.run(source, () => source.item(id, this.ctx));
  }

  /** 跑一次源调用并记录状态。 */
  private async run<T>(source: CatalogSource, action: () => Promise<T>): Promise<T> {
    const status = this.statuses.get(source.id);
    try {
      const value = await action();
      if (status !== undefined) {
        status.ok = true;
        delete status.lastError;
        status.fetchedAt = new Date().toISOString();
      }
      return value;
    } catch (error) {
      if (status !== undefined) {
        status.ok = false;
        status.lastError = error instanceof Error ? error.message : String(error);
      }
      throw error;
    }
  }
}

/** 安装器依赖。 */
export interface InstallerDeps {
  ctx: HostCtx;
  config: SquareConfig;
  paths: ResolvedPaths;
  store: DeckStore;
  skills: SkillsDomain;
  experts: ExpertsDomain;
  connectors: ConnectorsDomain;
  registry: SourceRegistry;
  /** 带缓存的取数器（安装时下载二进制）。 */
  fetcher: CachedFetcher;
  /** 连接器集合变化后的对齐（挂载/卸载 + 重算专家组合）。 */
  connectorsChanged: () => Promise<void>;
  /**
   * 现取 profile 插件管理服务（`ctx.pluginManager`）。
   *
   * 必须是 getter：服务可能晚于本插件激活，也可能在降级部署里根本不存在。
   */
  pluginManager: () => PluginManagerService | undefined;
}

/** 安装选项。 */
export interface InstallOptions {
  /** 技能是否安装后立即可用（默认 false：第三方内容默认禁用）。 */
  enable?: boolean;
  /** 技能安装根。 */
  root?: 'user' | 'project';
  cwd?: string;
  /** 连接器密钥等。 */
  env?: Record<string, string>;
}

/** 安装结果。 */
export interface InstallOutcome {
  kind: CatalogKind;
  key: string;
  /** 该种类下的落地标识（技能名 / 预设 id / 连接器 id）。 */
  id: string;
  /** 需要用户补齐的必填项（安装未完成时）。 */
  missing?: string[];
  warnings: string[];
}

/** 安装器。 */
export class CatalogInstaller {
  constructor(private readonly deps: InstallerDeps) {}

  /** 已安装索引：`${kind}:${key}` → 溯源。 */
  installedIndex(): Record<string, InstalledRecord> {
    const out: Record<string, InstalledRecord> = {};
    for (const record of this.deps.store.listInstalled()) out[record.key] = record;
    return out;
  }

  /** 安装一个条目。 */
  async install(sourceId: string, id: string, options: InstallOptions = {}): Promise<InstallOutcome> {
    if (!this.deps.config.allowRemoteInstall) {
      throw new CatalogError('当前配置禁止从广场安装（allowRemoteInstall=false）', 'install-disabled', 403);
    }
    const detail = await this.deps.registry.item(sourceId, id);
    const item = detail.item;
    const hint = item.install;
    if (hint.kind === 'unsupported') {
      throw new CatalogError(hint.reason, 'unsupported-package', 400);
    }
    switch (item.kind) {
      case 'skill':
        return this.installSkill(item, detail, options);
      case 'expert':
        return this.installExpert(item, detail, options);
      case 'connector':
        return this.installConnector(item, detail, options);
      case 'plugin':
        return this.installPlugin(item, detail, options);
      default:
        throw new CatalogError(`不支持的条目种类：${String(item.kind)}`, 'bad-kind', 400);
    }
  }

  /**
   * 卸载一个已安装条目。
   *
   * key 允许两种写法：完整键（`expert:roleplay-chengwei`，面板拿的就是它）
   * 或裸标识（`roleplay-chengwei`）。先按完整键找，找不到再补前缀。
   */
  async uninstall(kind: CatalogKind, key: string): Promise<void> {
    const record =
      this.deps.store.getInstalled(key) ?? this.deps.store.getInstalled(`${kind}:${key}`);
    if (kind === 'plugin') {
      // 插件可能是在 Square 之外装进 profile 的（CLI / App 的插件页），
      // 那种情况没有溯源记录，这里按 key 里的包名照样卸载。
      const spec = record?.meta?.['package'] ?? key.replace(/^plugin:/, '');
      if (spec === '') throw new CatalogError('缺少插件包名', 'missing-package', 400);
      await this.removePlugin(spec);
      if (record !== undefined) await this.deps.store.deleteInstalled(record.key);
      return;
    }
    if (record === undefined) throw new CatalogError(`没有 ${kind} 的安装记录：${key}`, 'not-installed', 404);
    const recordKey = record.key;
    if (kind === 'skill') {
      const name = record.meta?.['name'] ?? key;
      const path = record.meta?.['path'];
      if (path !== undefined) {
        await this.deps.skills.remove({ name, path, ...(record.meta?.['cwd'] === undefined ? {} : { cwd: record.meta['cwd'] }) });
      }
    } else if (kind === 'expert') {
      const recordId = record.meta?.['recordId'] ?? key;
      await this.deps.experts.remove(recordId);
    } else {
      const connectorId = record.meta?.['connectorId'] ?? key;
      await this.deps.connectors.unmount(connectorId, 'disabled');
      await this.deps.store.deleteConnector(connectorId);
      await this.deps.connectorsChanged();
    }
    await this.deps.store.deleteInstalled(recordKey);
  }

  /** 技能安装：拉文件 → 复用 importSkill。 */
  private async installSkill(
    item: CatalogItem,
    detail: CatalogDetail,
    options: InstallOptions,
  ): Promise<InstallOutcome> {
    const files = detail.files ?? [];
    if (files.length === 0) throw new CatalogError(`${item.name} 没有可安装的文件`, 'empty-skill');
    const payload: Array<{ path: string; text?: string; base64?: string }> = [];
    for (const file of files) {
      if (file.text !== undefined) {
        payload.push({ path: file.path, text: file.text });
        continue;
      }
      if (file.url === undefined) continue;
      const bytes = await this.deps.fetcher.raw(file.url);
      if (TEXT_EXT.test(file.path) || file.path === 'SKILL.md') {
        payload.push({ path: file.path, text: new TextDecoder().decode(bytes) });
      } else {
        payload.push({ path: file.path, base64: Buffer.from(bytes).toString('base64') });
      }
    }
    const skillFile = payload.find((file) => file.path === 'SKILL.md');
    if (skillFile?.text === undefined) throw new CatalogError('缺少 SKILL.md', 'missing-skill-md', 400);
    const parsed = parseFrontmatter(skillFile.text);
    const name = (parsed.values.name ?? item.name).trim();
    const result = await this.deps.skills.importSkill({
      root: options.root ?? 'user',
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      source: 'files',
      files: payload,
      enable: options.enable === true,
    });
    await this.deps.store.putInstalled({
      key: `skill:${result.name}`,
      kind: 'skill',
      sourceId: item.sourceId,
      itemId: item.id,
      ...(item.version === undefined ? {} : { version: item.version }),
      sha256: hashContent(payload.map((file) => `${file.path}:${file.text ?? file.base64 ?? ''}`)),
      installedAt: new Date().toISOString(),
      meta: {
        name: result.name,
        path: result.path,
        ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
        repo: item.repo ?? '',
      },
    });
    return { kind: 'skill', key: `skill:${result.name}`, id: result.name, warnings: result.warnings };
  }

  /** 专家安装：组合原文 → 注册为运行时预设。 */
  private async installExpert(
    item: CatalogItem,
    detail: CatalogDetail,
    _options: InstallOptions,
  ): Promise<InstallOutcome> {
    if (detail.composition === undefined) {
      throw new CatalogError(`${item.name} 缺少 agent.cordis.yml`, 'missing-composition', 400);
    }
    const created = await this.deps.experts.createFromComposition({
      id: item.id,
      name: item.name,
      description: item.description,
      // 源给了图标就用它（如 agency-agents 的 frontmatter emoji），否则退回默认。
      icon: item.icon ?? '🧩',
      tags: item.tags,
      composition: detail.composition,
      ...(detail.metadata === undefined ? {} : { presetYaml: detail.metadata }),
      provenance: {
        sourceId: item.sourceId,
        itemId: item.id,
        ...(item.version === undefined ? {} : { version: item.version }),
      },
    });
    const key = `expert:${created.expert.id}`;
    await this.deps.store.putInstalled({
      key,
      kind: 'expert',
      sourceId: item.sourceId,
      itemId: item.id,
      ...(item.version === undefined ? {} : { version: item.version }),
      sha256: hashContent([detail.composition, detail.metadata ?? '']),
      installedAt: new Date().toISOString(),
      meta: { recordId: created.expert.id, presetId: `square-${created.expert.id}` },
    });
    return {
      kind: 'expert',
      key,
      id: created.expert.id,
      warnings: created.broken === undefined ? [] : [`预设激活诊断：${created.broken}`],
    };
  }

  /** 连接器安装：registry 条目 → 连接器记录 → 运行时挂载。 */
  private async installConnector(
    item: CatalogItem,
    detail: CatalogDetail,
    options: InstallOptions,
  ): Promise<InstallOutcome> {
    const raw = detail.connector ?? connectorFromHint(item);
    if (raw === undefined) throw new CatalogError(`${item.name} 没有可用的连接参数`, 'missing-connector', 400);
    const env = { ...(typeof raw['env'] === 'object' && raw['env'] !== null ? (raw['env'] as Record<string, string>) : {}), ...(options.env ?? {}) };
    const missing = Object.entries(env)
      .filter(([, value]) => value === '')
      .map(([name]) => name);
    const record = normalizeConnector(
      { ...raw, env, enabled: missing.length === 0 },
      undefined,
    );
    for (const other of this.deps.store.listConnectors()) {
      if (other.serverName === record.serverName) {
        throw new CatalogError(`serverName "${record.serverName}" 已被连接器「${other.label}」占用`, 'duplicate-server-name', 409);
      }
    }
    await this.deps.store.putConnector(record);
    await this.deps.connectorsChanged();
    await this.deps.store.putInstalled({
      key: `connector:${record.id}`,
      kind: 'connector',
      sourceId: item.sourceId,
      itemId: item.id,
      ...(item.version === undefined ? {} : { version: item.version }),
      installedAt: new Date().toISOString(),
      meta: { connectorId: record.id, serverName: record.serverName },
    });
    return {
      kind: 'connector',
      key: `connector:${record.id}`,
      id: record.id,
      ...(missing.length === 0 ? {} : { missing }),
      warnings: missing.length === 0 ? [] : [`需要填写 ${missing.join(', ')} 后才能启用（当前已安装但停用）`],
    };
  }

  /**
   * 插件安装：交给 profile 的 `ctx.pluginManager.installBundle`。
   *
   * 等价于 `dsh plugin --profile <profile> add <spec>`：写 profile 的
   * package.json 依赖 + 选中 bundle 层 + 跑 pnpm。桌面端由 Electron shell
   * 提供同一套实现，因此这里不自己碰 profile 文件。
   */
  private async installPlugin(
    item: CatalogItem,
    _detail: CatalogDetail,
    _options: InstallOptions,
  ): Promise<InstallOutcome> {
    const hint = item.install;
    if (hint.kind !== 'plugin') {
      throw new CatalogError(`条目 ${item.name} 不是插件`, 'bad-kind', 400);
    }
    const command = hint.command ?? `dsh plugin --profile <profile> add ${hint.package}`;
    const manager = this.requirePluginManager(command);
    let result: ChangeResultLike;
    try {
      result = await manager.installBundle(hint.package, { enabled: true });
    } catch (error) {
      throw new CatalogError(
        `安装 ${hint.package} 失败：${error instanceof Error ? error.message : String(error)}`,
        'install-failed',
        502,
      );
    }
    const failure = changeErrorText(result.error);
    if (failure !== undefined || result.application === 'failed' || result.application === 'cancelled') {
      throw new CatalogError(
        `安装 ${hint.package} 失败：${failure ?? String(result.application ?? '未知原因')}`,
        'install-failed',
        502,
      );
    }
    const warnings = [...(result.warnings ?? [])];
    if (result.application === 'restart-required') {
      warnings.push('需要重启 harness 后新插件才会加载');
    }
    const pending = result.pendingBuilds ?? [];
    if (pending.length > 0) {
      warnings.push(`pnpm 拦下了依赖脚本：${pending.join(', ')}（批准后重装才完整）`);
    }
    const key = `plugin:${hint.package}`;
    await this.deps.store.putInstalled({
      key,
      kind: 'plugin',
      sourceId: item.sourceId,
      itemId: item.id,
      ...(item.version === undefined ? {} : { version: item.version }),
      installedAt: new Date().toISOString(),
      meta: {
        package: hint.package,
        spec: hint.package,
        name: item.name,
        repo: item.repo ?? '',
      },
    });
    return { kind: 'plugin', key, id: hint.package, warnings };
  }

  /** 插件卸载：同样交给 pluginManager（= `dsh plugin remove`）。 */
  private async removePlugin(spec: string): Promise<void> {
    const manager = this.requirePluginManager(`dsh plugin --profile <profile> remove ${spec}`);
    let result: ChangeResultLike;
    try {
      result = await manager.removeBundle(spec);
    } catch (error) {
      throw new CatalogError(
        `卸载 ${spec} 失败：${error instanceof Error ? error.message : String(error)}`,
        'uninstall-failed',
        502,
      );
    }
    const failure = changeErrorText(result.error);
    if (failure !== undefined || result.application === 'failed') {
      throw new CatalogError(
        `卸载 ${spec} 失败：${failure ?? String(result.application ?? '未知原因')}`,
        'uninstall-failed',
        502,
      );
    }
  }

  /** 取 profile 插件管理服务；缺失时把可手动执行的等价命令写进错误里。 */
  private requirePluginManager(manual: string): PluginManagerService {
    const manager = this.deps.pluginManager();
    if (manager === undefined) {
      throw new CatalogError(
        `当前部署没有 profile 插件管理服务（ctx.pluginManager）；可手动执行：${manual}`,
        'plugin-manager-unavailable',
        400,
      );
    }
    return manager;
  }
}

/** ChangeResult 的错误 → 一行文本（pluginManager 各写操作共用）。 */
export function changeErrorText(error: ChangeResultLike['error']): string | undefined {
  if (error === undefined) return undefined;
  if (typeof error === 'string') return error === '' ? undefined : error;
  const parts = [error.code, error.diagnostic].filter(
    (part): part is string => typeof part === 'string' && part !== '',
  );
  return parts.length === 0 ? undefined : parts.join(': ');
}

/** 供 service 复用：构建 SourceCtx。 */
export function makeSourceCtx(
  ctx: HostCtx,
  config: SquareConfig,
  paths: ResolvedPaths,
  fetcher: CachedFetcher,
): SourceCtx {
  // 注意：必须用箭头函数包一层。直接传 `fetcher.json` 会丢掉 this，
  // 取数器内部读 `this.memory` 时会炸（实机踩过一次）。
  return {
    config,
    paths,
    log: (message) => ctx.logger.debug(`[square] ${message}`),
    json: (url, options) => fetcher.json(url, options),
    text: (url, options) => fetcher.text(url, options),
    bytes: (url) => fetcher.raw(url),
  };
}
