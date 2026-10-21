/**
 * Square 服务门面：把存储、技能域、专家域、连接器域与本插件的
 * 运行期状态（降级项、最近错误）收在一处，供路由与模型工具使用。
 */

import type { SquareConfig, ResolvedPaths } from './config.js';
import type { ChangeResultLike, DetectedServices, HostCtx, PluginManagerService } from './capabilities.js';
import { describeCapabilities, detectServices, probeService } from './capabilities.js';
import { ConnectorsDomain } from './connectors.js';
import { ExpertsDomain } from './experts.js';
import { SkillsDomain } from './skills.js';
import { CachedFetcher, CatalogError } from './catalog.js';
import type { CatalogDetail, CatalogItem, CatalogKind, CatalogQuery, SourceStatus } from './catalog.js';
import { CatalogInstaller, SourceRegistry, changeErrorText, makeSourceCtx } from './catalog-install.js';
import { CatalogExporter, MySubmissionsSource, submissionsCatalogPath, type SubmitInput, type SubmitOutcome } from './catalog-export.js';
import {
  AgencyAgentsSource,
  AwesomeDshPluginsSource,
  CustomCatalogSource,
  DshMarketExpertsSource,
  DshSkillsMarketSource,
  GitHubSkillsSource,
  McpOfficialSource,
  SkillHubPluginsSource,
  SkillHubSkillsSource,
  specSourceOf,
} from './catalog-sources.js';
import { categoryList } from './catalog-categories.js';
import type { LocalPluginExport } from './catalog-export.js';
import {
  detectRuntimeMode,
  manualPluginCommand,
  markInstalledPlugins,
  normalizePluginsView,
  profileFromContext,
  profileLocation,
  readPendingBuilds,
  readProfileManifest,
  readProfilePlugins,
  toChangeResult,
  withProfileInstallCommand,
} from './plugins.js';
import type { RuntimeMode } from './plugins.js';
import { DeckStore } from './store.js';
import type {
  Capabilities,
  ConnectorRecord,
  DeckStatus,
  PluginChangeResult,
  PluginsView,
} from './types.js';

/** 最近错误上限。 */
const MAX_ERRORS = 20;

/** 插件运行期状态与各领域的收口。 */
export class SquareService {
  readonly skills: SkillsDomain;
  readonly connectors: ConnectorsDomain;
  readonly experts: ExpertsDomain;

  /** 广场：源注册表与安装器（enablePlaza 为假时不初始化）。 */
  readonly registry?: SourceRegistry;
  readonly installer?: CatalogInstaller;
  /** 广场：本地 → 目录 JSON 导出器（提交用）。 */
  readonly exporter?: CatalogExporter;

  private readonly errors: string[] = [];

  /** 广场取数器（缓存预热用；enablePlaza 关掉时为 undefined）。 */
  private readonly fetcher?: CachedFetcher;

  private constructor(
    private readonly ctx: HostCtx,
    readonly config: SquareConfig,
    readonly paths: ResolvedPaths,
    /** 装配时的服务快照（技能/预设/设置/存储在 apply 时已就绪）。 */
    private readonly services: DetectedServices,
    /** `@deepseek-ai/dsh-mcp-client` 是否可解析。 */
    private readonly mcpClientAvailable: boolean,
    readonly store: DeckStore,
  ) {
    this.skills = new SkillsDomain(ctx, config, paths, services);
    this.connectors = new ConnectorsDomain(ctx, config, paths, services);
    this.experts = new ExpertsDomain(ctx, config, store, services, {
      list: () => this.store.listConnectors(),
    });
    if (config.enablePlaza) {
      const fetcher = new CachedFetcher(ctx, paths, config.catalogTtlMs);
      this.fetcher = fetcher;
      // 远程内容源按配置启用：留空即不注册——本 fork 默认不拉取任何公开社区目录，
      // 广场只呈现「我的提交」与「自建目录」，内容由部署方的配置自行接入。
      const sources = [
        new MySubmissionsSource(submissionsCatalogPath(paths)),
        ...(config.skillsGithubRepos.length > 0 ? [new GitHubSkillsSource()] : []),
        ...(config.skillsMarketUrl !== '' ? [new DshSkillsMarketSource()] : []),
        ...(config.expertsMarketUrl !== '' ? [new DshMarketExpertsSource()] : []),
        ...(config.agencyAgentsRepo !== '' ? [new AgencyAgentsSource()] : []),
        ...(config.mcpRegistryUrl !== '' ? [new McpOfficialSource()] : []),
        ...(config.pluginsCatalogUrl !== '' ? [new AwesomeDshPluginsSource()] : []),
        ...(config.skillHubApiUrl !== ''
          ? [new SkillHubSkillsSource(), new SkillHubPluginsSource()]
          : []),
        new CustomCatalogSource(),
      ];
      this.registry = new SourceRegistry(sources, makeSourceCtx(ctx, config, paths, fetcher));
      this.installer = new CatalogInstaller({
        ctx,
        config,
        paths,
        store,
        skills: this.skills,
        experts: this.experts,
        connectors: this.connectors,
        registry: this.registry,
        fetcher,
        connectorsChanged: () => this.connectorsChanged(),
        pluginManager: () => this.livePluginManager(),
        installHint: (verb, spec) =>
          manualPluginCommand(this.runtimeMode(), this.profile().name, verb, spec),
      });
      this.exporter = new CatalogExporter(
        ctx,
        config,
        paths,
        this.skills,
        this.connectors,
        (id) => this.store.getExpert(id),
        (id) => this.store.getConnector(id),
        (name) => this.localPluginExport(name),
      );
    }
  }

  /**
   * 能力快照 —— **每次现算**。
   *
   * 原因：`webServer` / `connection` 往往在插件 apply 之后才激活（connection
   * 还要等 webRuntime），装配时探测会误报「不可用」。这里按当前上下文重新探测，
   * 面板看到的永远是此刻的真实状态。
   */
  get capabilities(): Capabilities {
    const detected = detectServices(this.ctx, this.mcpClientAvailable);
    // 每个服务的口径：**现取的优先，装配时的快照兜底**（服务被替换/晚到时
    // 快照仍然有效）。这里必须逐字段写全 —— describeCapabilities 的入参类型
    // 用 Required 映射，漏一个字段直接编译报错（曾经漏传 pluginManager，
    // 结果把可用服务误报成「不可用」，面板白挂一条降级说明）。
    const described = describeCapabilities({
      skills: detected.skills ?? this.services.skills,
      agentPresets: detected.agentPresets ?? this.services.agentPresets,
      settings: detected.settings ?? this.services.settings,
      storageDomain: detected.storageDomain ?? this.services.storageDomain,
      webServer: detected.webServer ?? this.services.webServer,
      connection: detected.connection ?? this.services.connection,
      pluginManager: detected.pluginManager ?? this.services.pluginManager,
      mcpClient: detected.mcpClient,
    });
    return { ...described.flags, notes: described.notes };
  }

  /** 降级说明（与 capabilities 同时现算）。 */
  get notes(): string[] {
    return this.capabilities.notes;
  }

  /** 每请求现取 connection 服务（可能被替换，也可能晚于插件激活）。 */
  liveConnection(): DetectedServices['connection'] {
    return detectServices(this.ctx, this.mcpClientAvailable).connection;
  }

  /** 装配时的服务快照（诊断用）。 */
  get detectedServices(): DetectedServices {
    return this.services;
  }

  /** 组装服务（含存储打开）。 */
  static async create(
    ctx: HostCtx,
    config: SquareConfig,
    paths: ResolvedPaths,
    services: DetectedServices,
    mcpClientAvailable: boolean,
  ): Promise<SquareService> {
    const store = await DeckStore.open(ctx);
    return new SquareService(ctx, config, paths, services, mcpClientAvailable, store);
  }

  /** 启动时对齐：先挂连接器，再按连接器重算专家组合。 */
  async init(): Promise<void> {
    await this.connectors.reconcile(this.store.listConnectors());
    await this.experts.reconcile();
    // 目录预热放后台：插件广场整份 5MB+，第一次点开面板不该让用户干等。
    void this.warmCatalog();
  }

  /**
   * 后台预热目录缓存。
   *
   * 1) 先把磁盘上还没过期的缓存读回内存（重启后不必重下 5MB）；
   * 2) 再后台拉一次插件广场（命中内存缓存就是白跑一趟，否则把大文件取回来）。
   *
   * 全程 best-effort：失败只记 debug 日志，绝不影响插件启动。
   */
  private async warmCatalog(): Promise<void> {
    if (this.fetcher === undefined || this.registry === undefined) return;
    try {
      const loaded = await this.fetcher.warm(this.config.catalogTtlMs);
      if (loaded > 0) this.ctx.logger.debug('[square] catalog cache warmed: %d entries', loaded);
      await this.registry.list({ kind: 'plugin', limit: 1 });
      this.ctx.logger.debug('[square] plugin catalog prefetched');
    } catch (error) {
      this.ctx.logger.debug('[square] catalog warm failed: %o', error);
    }
  }

  /** 卸载：释放连接器、预设与存储。 */
  async dispose(): Promise<void> {
    await this.experts.disposeAll();
    await this.connectors.disposeAll();
    await this.store.close();
  }

  /** 连接器定义变化后同步：挂载/卸载 + 重算专家组合。 */
  async connectorsChanged(): Promise<void> {
    await this.connectors.reconcile(this.store.listConnectors());
    await this.experts.reconcile();
  }

  /** 记一条错误（供 /status 与诊断工具展示）。 */
  noteError(text: string): void {
    this.errors.unshift(`${new Date().toISOString()} ${text}`);
    if (this.errors.length > MAX_ERRORS) this.errors.length = MAX_ERRORS;
  }

  /** 取一个连接器记录（不存在抛错，由路由转 404）。 */
  requireConnector(id: string): ConnectorRecord {
    const record = this.store.getConnector(id);
    if (record === undefined) throw new Error(`连接器 ${id} 不存在`);
    return record;
  }

  /** 广场：源状态。 */
  catalogSources(): SourceStatus[] {
    return this.registry?.listSources() ?? [];
  }

  /** 广场：列表（多源扇出或单源分页）。 */
  async catalogList(query: CatalogQuery): Promise<{
    items: CatalogDetail['item'][];
    nextCursor?: string;
    total?: number;
    sources: SourceStatus[];
  }> {
    if (this.registry === undefined) throw new Error('广场未启用（enablePlaza=false）');
    const page = await this.registry.list(query);
    const installed = this.installer?.installedIndex() ?? {};
    // 插件的安装键是 `plugin:<包名>`（不等于条目 id 的 owner/name），而且可能是
    // 在 Square 之外装进 profile 的——那类没有溯源记录，profile 清单也算一份。
    const profileNames = query.kind === 'plugin' ? await this.profilePluginNames() : undefined;
    const items = page.items.map((item) => {
      const key =
        item.install.kind === 'plugin' ? `plugin:${item.install.package}` : `${item.kind}:${item.id}`;
      const record = installed[key];
      const styled = this.withProfileCommand(item);
      if (record !== undefined) {
        return {
          ...styled,
          installed: {
            key,
            ...(record.version === undefined ? {} : { version: record.version }),
            updatable: false,
          },
        };
      }
      if (item.install.kind === 'plugin' && profileNames?.has(item.install.package) === true) {
        return { ...styled, installed: { key, updatable: false } };
      }
      return styled;
    });
    return {
      items,
      ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
      ...(page.total === undefined ? {} : { total: page.total }),
      sources: page.sources,
    };
  }

  /** 广场：目录分类（上游源自带分类时以上游为准）。 */
  async catalogCategories(kind: CatalogKind): Promise<string[]> {
    if (this.registry === undefined) return categoryList(kind);
    return this.registry.categories(kind);
  }

  /**
   * 当前 profile 的位置。
   *
   * **优先问宿主的 `ctx.profileContext`**（桌面端由 Electron 拉起宿主进程，
   * `DSH_PROFILE*` 未必在它的环境里），环境变量只作兜底。
   */
  profile(): { name: string; dir: string } {
    return profileFromContext(this.ctx) ?? profileLocation();
  }

  /** 当前宿主形态：桌面客户端 / Web 端（安装命令与托管语义按此分流）。 */
  runtimeMode(): RuntimeMode {
    return detectRuntimeMode(this.ctx, this.profile().name);
  }

  /** 当前 profile 已安装的包名（dependencies），用于广场的「已安装」标记。 */
  private async profilePluginNames(): Promise<Set<string>> {
    const rows = await readProfilePlugins(this.profile().dir);
    return new Set(rows.filter((row) => row.installed).map((row) => row.name));
  }

  /** 现取 profile 插件管理服务（可能晚到，也可能不存在）。 */
  private livePluginManager(): PluginManagerService | undefined {
    return detectServices(this.ctx, this.mcpClientAvailable).pluginManager;
  }

  /** 写操作前取插件管理服务；不存在时明确报「此部署不支持」。 */
  private requirePluginManager(): PluginManagerService {
    const manager = this.livePluginManager();
    if (manager === undefined) {
      throw new CatalogError(
        '当前部署没有 profile 插件管理服务（ctx.pluginManager），无法启停/安装插件',
        'plugin-manager-unavailable',
        400,
      );
    }
    return manager;
  }

  /**
   * 本地插件页：**自己装的**插件（profile 的 dependencies）与它们的插件行。
   *
   * `pluginManager` 缺失或读取失败时退化成「直接读 profile 清单」的只读视图，
   * 面板仍然可用（只是按钮禁用）。
   */
  async pluginsView(): Promise<PluginsView> {
    const profile = this.profile();
    const [manifest, pendingBuilds] = await Promise.all([
      readProfileManifest(profile.dir),
      readPendingBuilds(profile.dir),
    ]);
    // 目录解析不出来就没法判定「哪些是自己装的」：把原因说出来，别让页面莫名其妙空着。
    const profileNotes =
      profile.dir === ''
        ? ['读不到当前 profile 目录（profileContext 与环境变量都不可用）：无法判定哪些插件是你自己装的。']
        : [];
    const manager = this.livePluginManager();
    if (manager === undefined) {
      return {
        available: false,
        profile,
        bundles: markInstalledPlugins(await readProfilePlugins(profile.dir), manifest),
        rows: [],
        pendingBuilds,
        notes: ['ctx.pluginManager 不可用：只能查看 profile 清单，无法启停/安装插件。', ...profileNotes],
      };
    }
    try {
      const [entries, bundles] = await Promise.all([manager.listPlugins(), manager.listBundles()]);
      const normalized = normalizePluginsView(entries, bundles);
      return {
        available: true,
        profile,
        bundles: markInstalledPlugins(normalized.bundles, manifest),
        rows: normalized.rows,
        pendingBuilds,
        notes: profileNotes,
      };
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      this.noteError(`plugins: ${text}`);
      return {
        available: false,
        profile,
        bundles: markInstalledPlugins(await readProfilePlugins(profile.dir), manifest),
        rows: [],
        pendingBuilds,
        notes: [`插件清单读取失败（已退化为只读）：${text}`, ...profileNotes],
      };
    }
  }

  /** 启停单个插件行（写 profile 的 cordis.patch.yml 覆盖）。 */
  async pluginSetEnabled(id: string, enabled: boolean): Promise<PluginChangeResult> {
    const result = await this.requirePluginManager().setPluginEnabled(id, enabled);
    return toChangeResult(result, id);
  }

  /**
   * 启用 / 禁用（= 选中 / 取消选中该插件的 bundle 层，依赖保留）。
   *
   * 护栏：**取消选中只允许对自己装的插件**（在 profile dependencies 里）。
   * App 自带/随安装提供的 bundle（`@deepseek-ai/dsh-base`、语音输入、Agent Teams…）
   * 一旦被取消选中，重启后对应能力就没了——那不属于「管理我装的插件」，
   * 需要的话请用 App 自带的插件页操作。
   */
  async pluginBundleSetEnabled(name: string, enabled: boolean): Promise<PluginChangeResult> {
    if (!enabled) {
      const manifest = await readProfileManifest(this.profile().dir);
      if (!(name in manifest.dependencies)) {
        throw new CatalogError(
          `${name} 不是你安装的插件（不在 profile 的 dependencies 里），Square 不会取消选中它；` +
            'App 自带的能力包请用 App 自带的插件页管理。',
          'not-user-plugin',
          400,
        );
      }
    }
    const result = await this.requirePluginManager().setBundleEnabled(name, enabled);
    return toChangeResult(result, name);
  }

  /** 卸载一个 bundle（同时移除依赖）。 */
  async pluginRemove(name: string): Promise<PluginChangeResult> {
    const result = await this.requirePluginManager().removeBundle(name);
    return toChangeResult(result, name);
  }

  /** 广场：详情。 */
  async catalogItem(sourceId: string, id: string): Promise<CatalogDetail> {
    if (this.registry === undefined) throw new Error('广场未启用（enablePlaza=false）');
    const detail = await this.registry.item(sourceId, id);
    return { ...detail, item: this.withProfileCommand(detail.item) };
  }

  /**
   * 按**当前环境**补插件条目的安装命令（实现见 `withProfileInstallCommand`）。
   *
   * 上游 awesome-dsh-plugin 的 `install` 字段写死了 `--profile web`，照抄到别的
   * profile（比如桌面端）就是错的。
   */
  private withProfileCommand(item: CatalogItem): CatalogItem {
    return withProfileInstallCommand(item, this.profile().name, this.runtimeMode());
  }

  /** 广场：安装。 */
  async catalogInstall(
    sourceId: string,
    id: string,
    options: { enable?: boolean; root?: 'user' | 'project'; cwd?: string; env?: Record<string, string> } = {},
  ): Promise<Awaited<ReturnType<CatalogInstaller['install']>>> {
    if (this.installer === undefined) throw new Error('广场未启用（enablePlaza=false）');
    return this.installer.install(sourceId, id, options);
  }

  /** 广场：卸载。 */
  async catalogUninstall(kind: CatalogKind, key: string): Promise<void> {
    if (this.installer === undefined) throw new Error('广场未启用（enablePlaza=false）');
    await this.installer.uninstall(kind, key);
  }

  /** 广场：已安装清单。 */
  catalogInstalled(): ReturnType<CatalogInstaller['installedIndex']> {
    return this.installer?.installedIndex() ?? {};
  }

  /** 广场：提交（本地条目 → square-catalog/1 JSON）。 */
  async catalogSubmit(input: SubmitInput): Promise<SubmitOutcome> {
    if (this.exporter === undefined) throw new Error('广场未启用（enablePlaza=false）');
    return this.exporter.submit(input);
  }

  /** 广场：可提交的本地条目（按 kind 给出候选清单）。 */
  async catalogSubmitCandidates(kind: SubmitInput['kind']): Promise<
    Array<{ id: string; name: string; description: string; extra?: string }>
  > {
    if (kind === 'skill') {
      const rows = (await this.skills.list(undefined)).skills.filter((row) => row.path !== undefined);
      return rows.map((row) => ({
        id: row.name,
        name: row.name,
        description: row.description,
        extra: row.path,
      }));
    }
    if (kind === 'expert') {
      return this.store.listExperts().map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        extra: row.kind === 'market' ? 'market' : 'local',
      }));
    }
    if (kind === 'plugin') {
      // 只列**当前 profile 已安装**的插件包：没装的插件没有可导出的规格。
      const view = await this.pluginsView();
      return view.bundles
        .filter((bundle) => bundle.installed && bundle.removable)
        .map((bundle) => ({
          id: bundle.name,
          name: bundle.title ?? bundle.name,
          description: bundle.description,
          ...(bundle.version === undefined ? {} : { extra: bundle.version }),
        }));
    }
    return this.store.listConnectors().map((row) => ({
      id: row.id,
      name: row.label,
      description: row.description,
      extra: row.serverName,
    }));
  }

  /**
   * 插件提交用：包名 → 本机已安装插件的导出信息。
   *
   * 规格优先取 Square 的安装溯源（`meta.spec`，装 github/tgz 时不是包名），
   * 没有溯源（在 Square 之外装的）就退回包名当 npm 规格。
   */
  private async localPluginExport(name: string): Promise<LocalPluginExport | undefined> {
    const view = await this.pluginsView();
    const bundle = view.bundles.find((entry) => entry.name === name);
    if (bundle === undefined || !bundle.installed) return undefined;
    const record = this.store
      .listInstalled()
      .find(
        (entry) =>
          entry.kind === 'plugin' &&
          (entry.meta?.['package'] ?? entry.key.replace(/^plugin:/, '')) === name,
      );
    const spec = record?.meta?.['spec'] ?? record?.meta?.['package'] ?? name;
    const version = bundle.version ?? record?.version;
    return {
      spec,
      source: specSourceOf(spec, undefined),
      ...(version === undefined ? {} : { version }),
      ...(bundle.title === undefined ? {} : { title: bundle.title }),
      description: bundle.description,
    };
  }

  /** 整体状态快照。 */
  async status(): Promise<DeckStatus> {
    let skillCount = 0;
    try {
      skillCount = (await this.skills.list(undefined)).skills.length;
    } catch (error) {
      this.ctx.logger.debug('[square] skill count failed: %o', error);
    }
    let officialPresets = 0;
    try {
      officialPresets = (await this.experts.listAll()).official.length;
    } catch (error) {
      this.ctx.logger.debug('[square] preset count failed: %o', error);
    }
    const connectors = this.store.listConnectors();
    let connected = 0;
    for (const record of connectors) {
      if (this.connectors.status(record).state === 'connected') connected += 1;
    }
    let plugins = 0;
    try {
      // 「我的插件」的口径 = 用户自己装的（profile dependencies）。
      plugins = (await this.pluginsView()).bundles.filter((bundle) => bundle.mine === true).length;
    } catch (error) {
      this.ctx.logger.debug('[square] plugin count failed: %o', error);
    }
    return {
      version: '0.1.0',
      panelId: this.config.panelId,
      routePrefix: this.config.routePrefix,
      capabilities: this.capabilities,
      counts: {
        skills: skillCount,
        officialPresets,
        myExperts: this.store.listExperts().length,
        connectors: connectors.length,
        connectorsConnected: connected,
        connectorTools: this.connectors.totalTools(),
        plugins,
      },
      connectors: connectors.map((record) => ({
        id: record.id,
        label: record.label,
        serverName: record.serverName,
        ...this.connectors.status(record),
      })),
      recentErrors: [...this.errors],
      storage: this.store.kind,
    };
  }

  /** 给模型工具用的紧凑文本快照。 */
  async statusText(): Promise<string> {
    const status = await this.status();
    const unavailable = Object.entries(status.capabilities)
      .filter(([, value]) => !value)
      .map(([key]) => key);
    const lines = [
      `Square ${status.version}（存储：${status.storage}）`,
      `技能 ${String(status.counts.skills)} · 官方预设 ${String(status.counts.officialPresets)} · ` +
        `自建专家 ${String(status.counts.myExperts)} · 连接器 ` +
        `${String(status.counts.connectorsConnected)}/${String(status.counts.connectors)} ` +
        `（工具 ${String(status.counts.connectorTools)}）· 插件 ${String(status.counts.plugins)}`,
      unavailable.length === 0 ? '全部宿主服务可用' : `不可用服务：${unavailable.join(', ')}`,
      // 诊断：区分「服务不存在」与「严格取值拿不到」（Cordis 的 get 只认已
      // active 的提供方 fiber）。排查宿主差异时这一行比布尔能力位有用得多。
      `诊断：profileContext=${probeService(this.ctx, 'profileContext')} · ` +
        `pluginManager=${probeService(this.ctx, 'pluginManager')} · ` +
        `profile=${this.profile().dir === '' ? '未知' : this.profile().dir}`,
        `mode=${this.runtimeMode()}`,
    ];
    if (status.connectors.length > 0) {
      lines.push(
        `连接器：${status.connectors
          .map((entry) => `${entry.serverName}=${entry.state}(${String(entry.toolCount)})`)
          .join(' ')}`,
      );
    }
    if (status.recentErrors.length > 0) {
      lines.push(`最近错误：${status.recentErrors[0] ?? ''}`);
    }
    return lines.join('\n');
  }
}
