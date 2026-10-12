/**
 * 内置数据源适配器：
 *   - skills-github      GitHub 仓库里的 SKILL.md（默认 anthropics/skills）
 *   - experts-dsh-market dsh-market 社区预设
 *   - mcp-official       官方 MCP Registry
 *   - plugins-awesome    awesome-dsh-plugin 的 plugins.json（DSH 插件广场）
 *   - custom-catalog     用户自托管的 square-catalog/1 JSON
 *
 * 每个源只做两件事：把远端数据归一化成 CatalogItem；在 item() 里给出安装载荷。
 * 网络细节（缓存/超时/错误）统一走 SourceCtx 注入的取数器。
 */

import { createHash } from 'node:crypto';
import type {
  CatalogDetail,
  CatalogFile,
  CatalogItem,
  CatalogPage,
  CatalogQuery,
  CatalogSource,
  SourceCtx,
} from './catalog.js';
import { CatalogError } from './catalog.js';
// 只有人设正文的外部专家源（agency-agents）靠它合成与自建专家同形的组合。
import { personaComposition } from './experts.js';
import { parseFrontmatter } from './frontmatter.js';

/** 一批 JSON 里安全取数组。 */
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** 安全取字符串字段。 */
function str(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** 取本地化文本（支持 {zh,en} 或纯字符串）。 */
function pickText(value: unknown, language: 'name' | 'description'): { text: string; textEn?: string } {
  if (typeof value === 'string') return { text: value };
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const zh = str(record['zh']) ?? str(record['en']) ?? '';
    const en = str(record['en']);
    void language;
    return { text: zh, ...(en === undefined ? {} : { textEn: en }) };
  }
  return { text: '' };
}

// ===========================================================================
// 1) GitHub 仓库里的技能
// ===========================================================================

/** GitHub 仓库树里的一条文件。 */
interface TreeEntry {
  path: string;
  type: string;
  size?: number;
}

/** GitHub API 基址与常用请求头。 */
function githubHeaders(tokenEnv: string): Record<string, string> {
  const token = process.env[tokenEnv];
  return {
    accept: 'application/vnd.github+json',
    ...(token === undefined || token === '' ? {} : { authorization: `Bearer ${token}` }),
  };
}

/** 拉仓库默认分支（缓存）。 */
async function defaultBranch(repo: string, ctx: SourceCtx): Promise<string> {
  const info = (await ctx.json(`https://api.github.com/repos/${repo}`, {
    headers: githubHeaders(ctx.config.githubTokenEnv),
    ttlMs: 24 * 60 * 60 * 1000,
  })) as Record<string, unknown>;
  const branch = str(info['default_branch']);
  if (branch === undefined) throw new CatalogError(`仓库 ${repo} 没有默认分支信息`, 'bad-repo');
  return branch;
}

/** 拉仓库全量文件树（一次调用，缓存）。 */
async function repoTree(repo: string, ctx: SourceCtx): Promise<string[]> {
  const branch = await defaultBranch(repo, ctx);
  const data = (await ctx.json(
    `https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { headers: githubHeaders(ctx.config.githubTokenEnv), cacheKey: `#${branch}` },
  )) as Record<string, unknown>;
  return asArray(data['tree'])
    .filter((entry): entry is TreeEntry => {
      const record = entry as Record<string, unknown>;
      return record['type'] === 'blob' && typeof record['path'] === 'string';
    })
    .map((entry) => entry.path);
}

/** 仓库里所有「含 SKILL.md 的目录」→ 该目录下的文件列表。 */
async function githubSkills(repo: string, ctx: SourceCtx): Promise<Map<string, string[]>> {
  const paths = await repoTree(repo, ctx);
  const groups = new Map<string, string[]>();
  for (const path of paths) {
    const segments = path.split('/');
    if (segments[segments.length - 1]?.toUpperCase() !== 'SKILL.MD') continue;
    const dir = segments.slice(0, -1).join('/');
    groups.set(dir, []);
  }
  for (const path of paths) {
    for (const dir of groups.keys()) {
      if (dir === '' || path.startsWith(`${dir}/`)) {
        const list = groups.get(dir);
        if (list !== undefined && path !== `${dir}/`) list.push(path);
      }
    }
  }
  return groups;
}

/** 取一个技能目录下的全部文件内容（文本即可，二进制转 base64）。 */
async function githubDirFiles(repo: string, dir: string, paths: string[], ctx: SourceCtx): Promise<CatalogFile[]> {
  const branch = await defaultBranch(repo, ctx);
  const files: CatalogFile[] = [];
  for (const path of paths) {
    const url = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
    const relative = dir === '' ? path : path.slice(dir.length + 1);
    files.push({ path: relative, url });
  }
  return files;
}

/** 技能源。 */
export class GitHubSkillsSource implements CatalogSource {
  readonly id = 'skills-github';
  readonly label = 'GitHub 技能库';
  readonly kind = 'skill' as const;
  readonly installable = true;

  list(query: CatalogQuery, ctx: SourceCtx): Promise<CatalogPage> {
    return this.collect(query, ctx);
  }

  async item(id: string, ctx: SourceCtx): Promise<CatalogDetail> {
    const [repo, dir] = splitRepoId(id);
    const groups = await githubSkills(repo, ctx);
    const paths = groups.get(dir);
    if (paths === undefined) throw new CatalogError(`仓库 ${repo} 里找不到技能目录 ${dir}`, 'not-found', 404);
    const files = await githubDirFiles(repo, dir, paths, ctx);
    const skillFile = files.find((file) => file.path === 'SKILL.md');
    const preview = skillFile?.url === undefined ? undefined : await ctx.text(skillFile.url);
    return {
      item: this.toItem(repo, dir, paths.length, preview),
      files,
      ...(preview === undefined ? {} : { preview }),
    };
  }

  /** 汇总所有配置仓库里的技能。 */
  private async collect(query: CatalogQuery, ctx: SourceCtx): Promise<CatalogPage> {
    const items: CatalogItem[] = [];
    const errors: string[] = [];
    let parsed = 0;
    for (const repo of ctx.config.skillsGithubRepos) {
      let groups: Map<string, string[]>;
      try {
        groups = await githubSkills(repo, ctx);
      } catch (error) {
        errors.push(`${repo}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      for (const [dir, paths] of groups) {
        const name = dir.split('/').pop() ?? dir;
        const skillFile = paths.find((path) => path.endsWith('SKILL.md'));
        let description = '';
        let title = name;
        if (skillFile !== undefined && parsed < ctx.config.catalogParseLimit) {
          parsed += 1;
          try {
            const branch = await defaultBranch(repo, ctx);
            const text = await ctx.text(`https://raw.githubusercontent.com/${repo}/${branch}/${skillFile}`);
            const fm = parseFrontmatter(text);
            title = fm.values.name ?? name;
            description = fm.values.description ?? '';
          } catch {
            /* 单条解析失败不影响整页 */
          }
        }
        if (query.q !== undefined && query.q !== '') {
          const needle = query.q.toLowerCase();
          if (!title.toLowerCase().includes(needle) && !description.toLowerCase().includes(needle) && !name.includes(needle)) {
            continue;
          }
        }
        items.push(
          this.toItem(repo, dir, paths.length, undefined, { title, description, name }),
        );
      }
    }
    if (items.length === 0 && errors.length > 0) {
      throw new CatalogError(errors.join('；'), 'source-failed');
    }
    return { items: sortItems(items, query.sort), total: items.length };
  }

  /** 归一化成 CatalogItem。 */
  private toItem(
    repo: string,
    dir: string,
    fileCount: number,
    preview?: string,
    fields?: { title?: string; description?: string; name?: string },
  ): CatalogItem {
    const name = fields?.title ?? fields?.name ?? dir.split('/').pop() ?? dir;
    const description =
      fields?.description ??
      (preview === undefined ? '' : (parseFrontmatter(preview).values.description ?? ''));
    const hasScripts = false;
    return {
      sourceId: this.id,
      kind: 'skill',
      id: `${repo}::${dir}`,
      name,
      description: description === '' ? `${repo} / ${dir}` : description,
      repo: `https://github.com/${repo}`,
      homepage: `https://github.com/${repo}/tree/HEAD/${dir}`,
      author: repo.split('/')[0],
      tags: dir.split('/').slice(0, -1),
      category: dir.split('/')[0] ?? 'skills',
      trust: { official: repo.startsWith('anthropics/') },
      install: { kind: 'skill', fileCount, hasScripts },
    };
  }
}

/** `repo::dir` → [repo, dir]。 */
function splitRepoId(id: string): [string, string] {
  const index = id.indexOf('::');
  if (index === -1) throw new CatalogError(`条目 id 形态不正确：${id}`, 'bad-id', 400);
  return [id.slice(0, index), id.slice(index + 2)];
}

// ===========================================================================
// 2) dsh-market 社区预设（专家）
// ===========================================================================

/** 专家源。 */
export class DshMarketExpertsSource implements CatalogSource {
  readonly id = 'experts-dsh-market';
  readonly label = 'DSH 市场预设';
  readonly kind = 'expert' as const;
  readonly installable = true;

  async list(query: CatalogQuery, ctx: SourceCtx): Promise<CatalogPage> {
    const base = ctx.config.expertsMarketUrl.replace(/\/+$/, '');
    const payload = (await ctx.json(`${base}/manifest/presets.json`, {
      ttlMs: ctx.config.catalogTtlMs,
    })) as Record<string, unknown>;
    const items = asArray(payload['items'])
      .map((raw) => this.toItem(raw as Record<string, unknown>))
      .filter((item): item is CatalogItem => item !== undefined)
      .filter((item) => (query.q === undefined || query.q === '' ? true : matchQuery(item, query.q)))
      .filter((item) => (query.category === undefined || query.category === '' ? true : item.category === query.category));
    return { items: sortItems(items, query.sort), total: items.length };
  }

  async item(id: string, ctx: SourceCtx): Promise<CatalogDetail> {
    const base = ctx.config.expertsMarketUrl.replace(/\/+$/, '');
    const composition = await ctx.text(`${base}/assets/presets/${encodeURIComponent(id)}/agent.cordis.yml`);
    let metadata = '';
    try {
      metadata = await ctx.text(`${base}/assets/presets/${encodeURIComponent(id)}/preset.yml`);
    } catch {
      /* 允许没有 preset.yml */
    }
    const rows = composition
      .split('\n')
      .map((line) => /^\s*-\s+name:\s*'?"?([^'"\s]+)/.exec(line)?.[1])
      .filter((value): value is string => value !== undefined);
    return {
      item: {
        sourceId: this.id,
        kind: 'expert',
        id,
        name: id,
        description: '',
        tags: [],
        install: { kind: 'expert', pluginRows: rows, hasJsExpr: composition.includes('!!js') },
      },
      composition,
      metadata,
    };
  }

  /** manifest 条目 → CatalogItem。 */
  private toItem(raw: Record<string, unknown>): CatalogItem | undefined {
    const id = str(raw['id']);
    if (id === undefined) return undefined;
    const description = pickText(raw['description'], 'description');
    const nameEn = str(raw['nameEn']);
    const tags = asArray(raw['tags']).filter((tag): tag is string => typeof tag === 'string');
    return {
      sourceId: this.id,
      kind: 'expert',
      id,
      name: str(raw['name']) ?? id,
      description: description.text,
      ...(nameEn === undefined ? {} : { nameEn }),
      ...(description.textEn === undefined ? {} : { descriptionEn: description.textEn }),
      ...(str(raw['author']) === undefined ? {} : { author: str(raw['author']) }),
      ...(str(raw['repo']) === undefined ? {} : { repo: str(raw['repo']) }),
      ...(str(raw['version']) === undefined ? {} : { version: str(raw['version']) }),
      ...(str(raw['category']) === undefined ? {} : { category: str(raw['category']) }),
      tags,
      stats: { rank: typeof raw['rank'] === 'number' ? raw['rank'] : undefined },
      install: { kind: 'expert' },
    };
  }
}

// ===========================================================================
// 3) 官方 MCP Registry（连接器）
// ===========================================================================

/** 连接器源。 */
export class McpOfficialSource implements CatalogSource {
  readonly id = 'mcp-official';
  readonly label = 'MCP Registry';
  readonly kind = 'connector' as const;
  readonly installable = true;
  /**
   * Registry 自己就有分页（`metadata.nextCursor`，一页最多 100）。
   *
   * 必须声明出来：注册表只在「唯一分页源」时才回传它的游标，否则这个源会被
   * 当成一次性源塞进扇出、上游游标被丢掉——MCP 页签就永远停在第一页。
   */
  readonly paginated = true;

  async list(query: CatalogQuery, ctx: SourceCtx): Promise<CatalogPage> {
    const base = ctx.config.mcpRegistryUrl.replace(/\/+$/, '');
    const limit = Math.min(query.limit ?? ctx.config.catalogPageSize, 100);
    const seen = new Set<string>();
    const items: CatalogItem[] = [];
    let cursor = query.cursor;
    let nextCursor: string | undefined;
    // Registry 按**原始行**分页，而同一服务器的多个版本会连续占满整页；去重后这一页
    // 可能一条不剩。这时继续拿上游游标往后翻（最多 5 次），否则用户点「加载更多」
    // 只会看到一个空列表、却仍然挂着下一页按钮。
    // 最多 12 个窗口（首个 24 行 + 11×100 行 ≈ 1100 行）：普通情况下第一个窗口就有
    // 一页条目，只有碰到「几百个版本的服务器」时才会连续多翻几个窗口。
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const url = new URL(`${base}/servers`);
      // 第一次按调用方要的页大小；如果整页都被去重吃掉，后续窗口就放到上游上限
      // （100），好尽快跳过那些「几百个版本、去重后什么都不剩」的服务器。
      url.searchParams.set('limit', String(attempt === 0 ? limit : 100));
      if (cursor !== undefined && cursor !== '') url.searchParams.set('cursor', cursor);
      if (query.q !== undefined && query.q !== '') url.searchParams.set('search', query.q);
      const payload = (await ctx.json(url.toString(), { ttlMs: ctx.config.catalogTtlMs })) as Record<string, unknown>;
      // 同一服务器会返回多个版本：优先 isLatest，其次按版本号降序，最后按名称去重。
      const ranked = asArray(payload['servers'])
        .map((raw) => raw as Record<string, unknown>)
        .map((row) => ({ row, latest: isLatestRow(row) }))
        .sort((a, b) => Number(b.latest) - Number(a.latest));
      // 游标是 `名字:版本`：它指向上一页最后一条**原始行**，而这个服务器（更早的版本）
      // 上一页已经去重展示过了。不去掉的话，翻页时同一张卡会在两页各出现一次。
      const boundary = cursorServerName(cursor);
      for (const { row } of ranked) {
        const item = this.toItem(row);
        if (item === undefined || seen.has(item.id)) continue;
        if (boundary !== undefined && item.id === boundary) continue;
        seen.add(item.id);
        items.push(item);
      }
      const metadata = payload['metadata'] as Record<string, unknown> | undefined;
      nextCursor = metadata === undefined ? undefined : str(metadata['nextCursor']);
      if (items.length > 0 || nextCursor === undefined || nextCursor === '') break;
      cursor = nextCursor;
    }
    return { items: sortItems(items, query.sort), ...(nextCursor === undefined || nextCursor === '' ? {} : { nextCursor }) };
  }

  async item(id: string, ctx: SourceCtx): Promise<CatalogDetail> {
    const page = await this.list({ kind: 'connector', q: id, limit: 20 }, ctx);
    const item = page.items.find((entry) => entry.id === id) ?? page.items[0];
    if (item === undefined) throw new CatalogError(`MCP Registry 里找不到 ${id}`, 'not-found', 404);
    const connector = connectorFromHint(item);
    return { item, ...(connector === undefined ? {} : { connector }) };
  }

  /** registry 条目 → CatalogItem（安装提示已含连接参数）。 */
  private toItem(raw: Record<string, unknown>): CatalogItem | undefined {
    const server = raw['server'] as Record<string, unknown> | undefined;
    if (server === undefined) return undefined;
    const name = str(server['name']);
    if (name === undefined) return undefined;
    const remotes = asArray(server['remotes']) as Array<Record<string, unknown>>;
    const packages = asArray(server['packages']) as Array<Record<string, unknown>>;
    const hint = connectorHint(remotes, packages);
    return {
      sourceId: this.id,
      kind: 'connector',
      id: name,
      name: str(server['title']) ?? name,
      description: str(server['description']) ?? '',
      version: str(server['version']),
      author: name.split('/')[0],
      homepage: `https://registry.modelcontextprotocol.io/v0/servers?search=${encodeURIComponent(name)}`,
      tags: [],
      trust: { official: name.startsWith('io.modelcontextprotocol/') },
      install: hint,
    };
  }
}

/** Registry 条目是否标记为最新版（缺标记按 true 处理）。 */
function isLatestRow(row: Record<string, unknown>): boolean {
  const meta = row['_meta'] as Record<string, unknown> | undefined;
  const official = meta?.['io.modelcontextprotocol.registry/official'] as Record<string, unknown> | undefined;
  const flag = official?.['isLatest'];
  return flag === undefined ? true : flag === true;
}

/**
 * Registry 游标 → 它指向的服务器名（翻页时用来丢掉边界上重复的那张卡）。
 *
 * 游标形如 `ac.inference.sh/mcp:2.0.0`；名字里可能带 `/`，所以从**最后一个** `:` 切。
 * 没有游标 / 切不出名字时返回 undefined（不做任何丢弃）。
 */
function cursorServerName(cursor: string | undefined): string | undefined {
  if (cursor === undefined || cursor === '') return undefined;
  let decoded = cursor;
  try {
    decoded = decodeURIComponent(cursor);
  } catch {
    /* 原样使用 */
  }
  const at = decoded.lastIndexOf(':');
  return at > 0 ? decoded.slice(0, at) : undefined;
}

/** 从 remotes/packages 推出安装提示；没有可支持的传输时标记 unsupported。 */
function connectorHint(
  remotes: Array<Record<string, unknown>>,
  packages: Array<Record<string, unknown>>,
): CatalogItem['install'] {
  const remote = remotes.find((entry) => str(entry['url']) !== undefined);
  if (remote !== undefined) {
    return { kind: 'connector', transport: 'streamable-http', url: str(remote['url']) };
  }
  const pkg = packages.find((entry) => {
    const type = str(entry['registryType']);
    return type === 'npm' || type === 'pypi';
  });
  if (pkg !== undefined) {
    const runtime = str(pkg['runtimeHint']) ?? (str(pkg['registryType']) === 'pypi' ? 'uvx' : 'npx');
    const identifier = str(pkg['identifier']) ?? '';
    const envRequired = (asArray(pkg['environmentVariables']) as Array<Record<string, unknown>>)
      .filter((entry) => entry['isRequired'] === true)
      .map((entry) => str(entry['name']) ?? '')
      .filter((name) => name !== '');
    return { kind: 'connector', transport: 'stdio', command: runtime, envRequired };
  }
  const unsupported = packages[0];
  const type = unsupported === undefined ? undefined : str(unsupported['registryType']);
  return { kind: 'unsupported', reason: `暂不支持该分发方式（${type ?? '未知'}），请手动配置` };
}

/** 安装提示 → 可直接落库的连接器定义。 */
export function connectorFromHint(item: CatalogItem): Record<string, unknown> | undefined {
  const hint = item.install;
  if (hint.kind !== 'connector') return undefined;
  if (hint.transport === 'streamable-http') {
    return {
      transport: 'streamable-http',
      serverName: sanitizeServerName(item.id),
      label: item.name,
      description: item.description,
      url: hint.url ?? '',
      headers: {},
    };
  }
  return {
    transport: 'stdio',
    serverName: sanitizeServerName(item.id),
    label: item.name,
    description: item.description,
    command: hint.command ?? 'npx',
    args: ['-y', item.id],
    env: Object.fromEntries((hint.envRequired ?? []).map((name) => [name, ''])),
  };
}

/** MCP 名字 → 合法 serverName。 */
export function sanitizeServerName(raw: string): string {
  const tail = raw.split('/').pop() ?? raw;
  const cleaned = tail.replace(/[^A-Za-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return (cleaned === '' ? 'mcp' : cleaned).slice(0, 32);
}

// ===========================================================================
// 4) awesome-dsh-plugin（插件广场）
// ===========================================================================

/**
 * 插件广场源：`https://awesome-dsh-plugin.com/plugins.json`。
 *
 * 一份 5MB 左右的静态 JSON（4000+ 条），顶层自带 `categories` 分类表与
 * `plugins` 数组；分类键 → 中文展示名在这里就地翻译，条目归一成 CatalogItem。
 * 分页在宿主侧做（offset 游标），因为整份清单一次返回给浏览器太重。
 */
export class AwesomeDshPluginsSource implements CatalogSource {
  readonly id = 'plugins-awesome';
  readonly label = 'Awesome DSH Plugin';
  readonly kind = 'plugin' as const;
  readonly installable = true;
  /** 自己按 offset 游标分页（整份 4392 条，不可能一次返回）。 */
  readonly paginated = true;

  async list(query: CatalogQuery, ctx: SourceCtx): Promise<CatalogPage> {
    const payload = await this.payload(ctx);
    const categories = categoryTable(payload);
    // 归一后再带一份排序用的原始字段（added / downloads），避免把内部字段塞进 CatalogItem。
    const entries: Array<{ item: CatalogItem; added: string; downloads: number }> = [];
    for (const raw of asArray(payload['plugins'])) {
      const record = raw as Record<string, unknown>;
      const item = this.toItem(record, categories);
      if (item === undefined) continue;
      if (query.q !== undefined && query.q !== '' && !matchQuery(item, query.q)) continue;
      if (query.category !== undefined && query.category !== '' && item.category !== query.category) {
        continue;
      }
      entries.push({
        item,
        added: str(record['added']) ?? '',
        downloads: typeof record['downloads'] === 'number' ? record['downloads'] : 0,
      });
    }
    if (query.sort === 'hot') entries.sort((a, b) => b.downloads - a.downloads);
    else if (query.sort === 'new') entries.sort((a, b) => b.added.localeCompare(a.added));
    const limit = Math.max(1, Math.min(query.limit ?? ctx.config.catalogPageSize, 100));
    const offset = Math.max(0, Number.parseInt(query.cursor ?? '', 10) || 0);
    const slice = entries.slice(offset, offset + limit);
    const next = offset + limit < entries.length ? String(offset + limit) : undefined;
    return {
      items: slice.map((entry) => entry.item),
      total: entries.length,
      ...(next === undefined ? {} : { nextCursor: next }),
    };
  }

  async item(id: string, ctx: SourceCtx): Promise<CatalogDetail> {
    const payload = await this.payload(ctx);
    const categories = categoryTable(payload);
    const record = asArray(payload['plugins'])
      .map((entry) => entry as Record<string, unknown>)
      .find((entry) => pluginIdOf(entry) === id);
    if (record === undefined) {
      throw new CatalogError(`插件广场里找不到 ${id}`, 'not-found', 404);
    }
    const item = this.toItem(record, categories);
    if (item === undefined) throw new CatalogError(`插件条目 ${id} 缺少安装信息`, 'not-installable', 400);
    return { item, plugin: record };
  }

  /** 上游分类表（中文优先）。 */
  async categories(ctx: SourceCtx): Promise<string[]> {
    const payload = await this.payload(ctx);
    return [...categoryTable(payload).values()];
  }

  /** 拉取（走 CachedFetcher，带 TTL 与 ETag）。 */
  private async payload(ctx: SourceCtx): Promise<Record<string, unknown>> {
    // 整份 plugins.json 有 5MB+（gzip 后仍近 1MB），默认 20s 超时不够：
    // 本源用自己的超时（config.pluginsCatalogTimeoutMs）。
    return (await ctx.json(ctx.config.pluginsCatalogUrl, {
      ttlMs: ctx.config.catalogTtlMs,
      timeoutMs: ctx.config.pluginsCatalogTimeoutMs,
    })) as Record<string, unknown>;
  }

  /** 原始条目 → CatalogItem。 */
  private toItem(
    raw: Record<string, unknown>,
    categories: Map<string, string>,
  ): CatalogItem | undefined {
    const id = pluginIdOf(raw);
    if (id === undefined) return undefined;
    const spec = pluginSpecOf(raw);
    if (spec === undefined) return undefined;
    const description = pickText(raw['description'], 'description');
    const categoryKey = str(raw['category']);
    const capabilities = asArray(raw['capabilities']).filter(
      (entry): entry is string => typeof entry === 'string',
    );
    const redLines = asArray(raw['capabilityRedLines']).filter(
      (entry): entry is string => typeof entry === 'string',
    );
    const downloads = typeof raw['downloads'] === 'number' ? raw['downloads'] : undefined;
    const stars = typeof raw['stars'] === 'number' ? raw['stars'] : undefined;
    const version = str(raw['version']);
    const command = str(raw['install']);
    const category =
      categoryKey === undefined ? undefined : (categories.get(categoryKey) ?? categoryKey);
    return {
      sourceId: this.id,
      kind: 'plugin',
      id,
      name: str(raw['name']) ?? id,
      description: description.text,
      ...(description.textEn === undefined ? {} : { descriptionEn: description.textEn }),
      ...(str(raw['owner']) === undefined ? {} : { author: str(raw['owner']) }),
      ...(str(raw['page']) === undefined ? {} : { homepage: str(raw['page']) }),
      ...(str(raw['url']) === undefined ? {} : { repo: str(raw['url']) }),
      ...(version === undefined ? {} : { version }),
      // 能力标签直接进 tags：卡片能一眼看出插件要读写什么，搜索也能命中。
      tags: capabilities.slice(0, 3),
      ...(category === undefined ? {} : { category }),
      stats: {
        ...(stars === undefined ? {} : { stars }),
        ...(downloads === undefined ? {} : { downloads }),
      },
      trust: {
        official: false,
        ...(capabilities.length === 0 ? {} : { capabilities }),
        ...(redLines.length === 0 ? {} : { redLines }),
      },
      install: {
        kind: 'plugin',
        package: spec.spec,
        ...(version === undefined ? {} : { version }),
        source: spec.source,
        ...(command === undefined ? {} : { command }),
        ...(capabilities.length === 0 ? {} : { capabilities }),
        ...(redLines.length === 0 ? {} : { redLines }),
      },
    };
  }
}

/** 条目唯一 id：`owner/name`（全库唯一，且与 npm 包名解耦）。 */
function pluginIdOf(raw: Record<string, unknown>): string | undefined {
  const name = str(raw['name']);
  if (name === undefined) return undefined;
  const owner = str(raw['owner']);
  return owner === undefined ? name : `${owner}/${name}`;
}

/** 分类键 → 展示名（zh → en → key），保持 JSON 声明顺序。 */
function categoryTable(payload: Record<string, unknown>): Map<string, string> {
  const table = new Map<string, string>();
  const raw = payload['categories'];
  if (raw === null || typeof raw !== 'object') return table;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value !== null && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      table.set(key, str(record['zh']) ?? str(record['en']) ?? key);
    } else {
      table.set(key, str(value) ?? key);
    }
  }
  return table;
}

/**
 * 安装规格：
 *   1) 有 `npm` 字段 → 直接用包名（最可靠）；
 *   2) 否则解析上游给的 `dsh plugin --profile web add <spec>`，规格可能是
 *      `github:owner/repo`、npm 包名或带引号的 .tgz 地址；
 *   3) 再兜底：从仓库地址合成 `github:owner/repo`。
 */
export function pluginSpecOf(
  raw: Record<string, unknown>,
): { spec: string; source: 'npm' | 'github' | 'tarball' } | undefined {
  const npmName = str(raw['npm']);
  if (npmName !== undefined) return { spec: npmName, source: 'npm' };
  const command = str(raw['install']) ?? '';
  const marker = ' add ';
  const at = command.lastIndexOf(marker);
  const tail =
    at === -1 ? '' : command.slice(at + marker.length).trim().replace(/^["']|["']$/g, '');
  if (tail !== '' && !tail.includes(' ')) {
    return { spec: tail, source: specSourceOf(tail) };
  }
  const repo = str(raw['url']);
  const match = repo === undefined ? null : /github\.com\/([^/]+)\/([^/?#]+)/i.exec(repo);
  if (match !== null) return { spec: `github:${match[1]}/${match[2]}`, source: 'github' };
  return undefined;
}

// ===========================================================================
// 5) 自托管目录（square-catalog/1）
// ===========================================================================

/** 自托管目录源。 */
/** 自建目录条目 → CatalogItem（CustomCatalogSource 与「我的提交」源共用）。 */
export function catalogItemFromRaw(raw: Record<string, unknown>, sourceId: string): CatalogItem | undefined {
  const id = str(raw['id']);
  const kind = str(raw['kind']);
  if (
    id === undefined ||
    (kind !== 'skill' && kind !== 'expert' && kind !== 'connector' && kind !== 'plugin')
  ) {
    return undefined;
  }
  const mcp = raw['mcp'] as Record<string, unknown> | undefined;
  const files = asArray(raw['files']);
  // 插件条目：安装规格 = `package` 字段（缺省退回 id），来源按形态推断。
  const spec = kind === 'plugin' ? (str(raw['package']) ?? id) : '';
  const specVersion = kind === 'plugin' ? (str(raw['packageVersion']) ?? str(raw['version'])) : undefined;
  const capabilities = asArray(raw['capabilities']).filter(
    (entry): entry is string => typeof entry === 'string',
  );
  const redLines = asArray(raw['redLines']).filter(
    (entry): entry is string => typeof entry === 'string',
  );
  const install: CatalogItem['install'] =
    kind === 'plugin'
      ? {
          kind: 'plugin',
          package: spec,
          ...(specVersion === undefined ? {} : { version: specVersion }),
          source: specSourceOf(spec, str(raw['specSource'])),
          ...(capabilities.length === 0 ? {} : { capabilities }),
          ...(redLines.length === 0 ? {} : { redLines }),
        }
      : kind === 'connector'
        ? {
            kind: 'connector',
            transport: str(mcp?.['transport']) === 'streamable-http' ? 'streamable-http' : 'stdio',
            ...(str(mcp?.['url']) === undefined ? {} : { url: str(mcp?.['url']) }),
            ...(str(mcp?.['command']) === undefined ? {} : { command: str(mcp?.['command']) }),
            envRequired: asArray(mcp?.['envRequired']).filter((name): name is string => typeof name === 'string'),
          }
        : kind === 'expert'
          ? { kind: 'expert' }
          : { kind: 'skill', fileCount: files.length };
  return {
    sourceId,
    kind,
    id,
    name: str(raw['name']) ?? id,
    description: str(raw['description']) ?? '',
    ...(str(raw['author']) === undefined ? {} : { author: str(raw['author']) }),
    ...(str(raw['homepage']) === undefined ? {} : { homepage: str(raw['homepage']) }),
    ...(str(raw['repo']) === undefined ? {} : { repo: str(raw['repo']) }),
    ...(kind === 'plugin' ? (specVersion === undefined ? {} : { version: specVersion }) : str(raw['version']) === undefined ? {} : { version: str(raw['version']) }),
    ...(str(raw['category']) === undefined ? {} : { category: str(raw['category']) }),
    ...(str(raw['icon']) === undefined ? {} : { icon: str(raw['icon']) }),
    tags: asArray(raw['tags']).filter((tag): tag is string => typeof tag === 'string'),
    trust: {
      official: false,
      ...(capabilities.length === 0 ? {} : { capabilities }),
      ...(redLines.length === 0 ? {} : { redLines }),
    },
    install,
  };
}

/** 安装规格的来源：显式声明优先，否则按形态推断。 */
export function specSourceOf(
  spec: string,
  declared?: string,
): 'npm' | 'github' | 'tarball' {
  if (declared === 'npm' || declared === 'github' || declared === 'tarball') return declared;
  if (/^https?:/i.test(spec)) return 'tarball';
  if (spec.startsWith('github:') || /^git(\+|@|:)/i.test(spec)) return 'github';
  return 'npm';
}

export class CustomCatalogSource implements CatalogSource {
  readonly id = 'custom-catalog';
  readonly label = '自建目录';
  readonly kind = 'all' as const;
  readonly installable = true;

  async list(query: CatalogQuery, ctx: SourceCtx): Promise<CatalogPage> {
    const items: CatalogItem[] = [];
    const errors: string[] = [];
    for (const url of ctx.config.customCatalogs) {
      try {
        const payload = (await ctx.json(url, { ttlMs: ctx.config.catalogTtlMs })) as Record<string, unknown>;
        const schema = str(payload['schema']);
        if (schema !== undefined && schema !== 'square-catalog/1') {
          throw new CatalogError(`目录 schema 不受支持：${schema}`, 'bad-schema');
        }
        for (const raw of asArray(payload['items'])) {
          const item = catalogItemFromRaw(raw as Record<string, unknown>, this.id);
          if (item === undefined || item.kind !== query.kind) continue;
          if (query.q !== undefined && query.q !== '' && !matchQuery(item, query.q)) continue;
          items.push(item);
        }
      } catch (error) {
        errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (items.length === 0 && errors.length > 0) throw new CatalogError(errors.join('；'), 'source-failed');
    return { items: sortItems(items, query.sort), total: items.length };
  }

  async item(id: string, ctx: SourceCtx): Promise<CatalogDetail> {
    for (const url of ctx.config.customCatalogs) {
      const payload = (await ctx.json(url, { ttlMs: ctx.config.catalogTtlMs })) as Record<string, unknown>;
      const raw = asArray(payload['items'])
        .map((entry) => entry as Record<string, unknown>)
        .find((entry) => str(entry['id']) === id);
      if (raw === undefined) continue;
      const files = asArray(raw['files']).map((entry) => entry as Record<string, unknown>);
      const mcp = raw['mcp'] as Record<string, unknown> | undefined;
      if (mcp !== undefined) {
        return { item: catalogItemFromRaw(raw, this.id) as CatalogItem, connector: { ...mcp, label: str(raw['name']) ?? id } };
      }
      const catalogFiles: CatalogFile[] = files.map((entry) => {
        const url = str(entry['url']);
        const text = str(entry['text']);
        return {
          path: str(entry['path']) ?? 'file',
          ...(url === undefined ? {} : { url }),
          ...(text === undefined ? {} : { text }),
        };
      });
      // 技能：内联文本即可直接导入。
      return {
        item: catalogItemFromRaw(raw, this.id) as CatalogItem,
        files: catalogFiles,
        ...(typeof raw['composition'] === 'string' ? { composition: raw['composition'] } : {}),
      };
    }
    throw new CatalogError(`自建目录里找不到 ${id}`, 'not-found', 404);
  }
}

// ===========================================================================
// 6) DSH 社区精选技能（dsh-skills-market 的 catalog.json）
// ===========================================================================

/**
 * 社区精选技能源：一份静态 JSON（24 条左右），条目自带 SKILL.md 的 `raw` 地址。
 *
 * 取数代价最低——列表 1 次请求、raw.githubusercontent 不计 GitHub API 配额。
 * 代价是它**只登记 SKILL.md 一个文件**（没有 references/scripts 清单），
 * 所以安装载荷就是这一个文件；要整目录得回 GitHub tree（吃 token 配额）。
 */
export class DshSkillsMarketSource implements CatalogSource {
  readonly id = 'skills-dsh-market';
  readonly label = 'DSH 社区精选';
  readonly kind = 'skill' as const;
  readonly installable = true;

  async list(query: CatalogQuery, ctx: SourceCtx): Promise<CatalogPage> {
    const items: CatalogItem[] = [];
    for (const raw of await this.rows(ctx)) {
      const item = this.toItem(raw);
      if (item === undefined) continue;
      if (query.q !== undefined && query.q !== '' && !matchQuery(item, query.q)) continue;
      items.push(item);
    }
    return { items: sortItems(items, query.sort), total: items.length };
  }

  async item(id: string, ctx: SourceCtx): Promise<CatalogDetail> {
    const raw = (await this.rows(ctx)).find((entry) => str(entry['id']) === id);
    if (raw === undefined) throw new CatalogError(`社区精选里找不到 ${id}`, 'not-found', 404);
    const item = this.toItem(raw);
    const url = str(raw['raw']);
    if (item === undefined || url === undefined) {
      throw new CatalogError(`条目 ${id} 缺少 SKILL.md 地址`, 'not-installable', 400);
    }
    const preview = await ctx.text(url);
    return { item, files: [{ path: 'SKILL.md', url }], preview };
  }

  /** 读目录（数组或 `{ items: [] }` 两种形态都兼容）。 */
  private async rows(ctx: SourceCtx): Promise<Array<Record<string, unknown>>> {
    const payload = await ctx.json(ctx.config.skillsMarketUrl, { ttlMs: ctx.config.catalogTtlMs });
    const list = Array.isArray(payload) ? payload : asArray((payload as Record<string, unknown>)['items']);
    return list.map((entry) => entry as Record<string, unknown>);
  }

  /** 目录条目 → CatalogItem。 */
  private toItem(raw: Record<string, unknown>): CatalogItem | undefined {
    const id = str(raw['id']);
    const url = str(raw['raw']);
    if (id === undefined || url === undefined) return undefined;
    const repo = str(raw['repo']);
    const branch = str(raw['branch']) ?? 'HEAD';
    const path = str(raw['path']) ?? 'SKILL.md';
    const description = pickText(raw['description'], 'description');
    return {
      sourceId: this.id,
      kind: 'skill',
      id,
      name: str(raw['title']) ?? str(raw['name']) ?? id,
      description: description.text,
      ...(description.textEn === undefined ? {} : { descriptionEn: description.textEn }),
      ...(str(raw['author']) === undefined ? {} : { author: str(raw['author']) }),
      ...(repo === undefined
        ? {}
        : {
            repo: `https://github.com/${repo}`,
            homepage: `https://github.com/${repo}/blob/${branch}/${path}`,
          }),
      ...(str(raw['category']) === undefined ? {} : { category: str(raw['category']) }),
      tags: asArray(raw['tags']).filter((tag): tag is string => typeof tag === 'string'),
      trust: { official: repo !== undefined && repo.startsWith('anthropics/') },
      install: { kind: 'skill', fileCount: 1 },
    };
  }
}

// ===========================================================================
// 7) agency-agents（上游人设仓库 → 专家）
// ===========================================================================

/** divisions.json 的一个分区。 */
interface AgencyDivision {
  label?: string;
  icon?: string;
  color?: string;
}

/**
 * 人设条目 id 的合法形态（= 文件路径去掉 `.md`）。
 *
 * 每段必须以字母/数字开头，因此 `..`、空段、前导斜杠都被挡掉；
 * 段数不设上限（上游有 `game-development/unity/xxx` 这类多级目录）。
 */
const AGENCY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

/**
 * agency-agents 专家源。
 *
 * 枚举方式刻意选**上游仓库**而不是它的派生快照（dsh-agency-market 等）：
 * `git/trees?recursive=1` 一次调用就能拿到全部人设路径，再用 `divisions.json`
 * 的 18 个分区做白名单过滤（排除 integrations/scripts/examples 等非人设目录）；
 * 正文与 frontmatter 都走 raw.githubusercontent，**不占 GitHub API 配额**。
 *
 * 上游只有人设正文、没有 `agent.cordis.yml`，所以详情里用
 * `personaComposition()` 合成组合（见 experts.ts）。
 */
export class AgencyAgentsSource implements CatalogSource {
  readonly id = 'experts-agency-agents';
  readonly label = 'Agency Agents';
  readonly kind = 'expert' as const;
  readonly installable = true;

  async list(query: CatalogQuery, ctx: SourceCtx): Promise<CatalogPage> {
    const divisions = await this.divisions(ctx);
    const paths = await this.personaPaths(ctx, divisions);
    const items: CatalogItem[] = [];
    // 列表页只解析前 N 条的 frontmatter（与 GitHub 技能源同一取舍：
    // 300+ 条人设全解析会在首屏打几百个请求）。
    let parsed = 0;
    for (const path of paths) {
      let meta: { name?: string; description?: string; emoji?: string } | undefined;
      if (parsed < ctx.config.catalogParseLimit) {
        parsed += 1;
        try {
          meta = frontmatterOf(await ctx.text(this.rawUrl(ctx, path)));
        } catch {
          /* 单条解析失败不影响整页 */
        }
      }
      const item = this.toItem(ctx, path, divisions, meta);
      if (query.q !== undefined && query.q !== '' && !matchQuery(item, query.q)) continue;
      items.push(item);
    }
    return { items: sortItems(items, query.sort), total: items.length };
  }

  async item(id: string, ctx: SourceCtx): Promise<CatalogDetail> {
    const segments = id.split('/');
    const division = segments[0] ?? '';
    if (!AGENCY_ID_PATTERN.test(id) || segments.length < 2) {
      throw new CatalogError(`条目 id 形态不正确：${id}`, 'bad-id', 400);
    }
    const divisions = await this.divisions(ctx);
    if (!divisions.has(division)) throw new CatalogError(`未知分区：${division}`, 'bad-id', 400);
    const path = `${id}.md`;
    const text = await ctx.text(this.rawUrl(ctx, path));
    const meta = frontmatterOf(text);
    const persona = meta.body.trim();
    if (persona === '') throw new CatalogError(`${id} 的人设正文为空`, 'empty-persona', 400);
    const item = this.toItem(ctx, path, divisions, meta);
    return {
      item,
      preview: text.slice(0, 4096),
      composition: personaComposition({
        id,
        name: item.name,
        description: item.description,
        ...(meta.emoji === undefined ? {} : { icon: meta.emoji }),
        tags: item.tags,
        systemPrompt: persona,
      }),
    };
  }

  /** divisions.json → 分区键 → 分区信息。 */
  private async divisions(ctx: SourceCtx): Promise<Map<string, AgencyDivision>> {
    const payload = (await ctx.json(this.rawUrl(ctx, 'divisions.json'), {
      ttlMs: ctx.config.catalogTtlMs,
    })) as Record<string, unknown>;
    const raw = payload['divisions'];
    const table = new Map<string, AgencyDivision>();
    if (raw === null || typeof raw !== 'object') return table;
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      table.set(key, (value ?? {}) as AgencyDivision);
    }
    return table;
  }

  /** 仓库全量文件树 → 白名单内的人设路径（分区下的任意层级 `.md`）。 */
  private async personaPaths(ctx: SourceCtx, divisions: Map<string, AgencyDivision>): Promise<string[]> {
    const repo = ctx.config.agencyAgentsRepo;
    const data = (await ctx.json(
      `https://api.github.com/repos/${repo}/git/trees/HEAD?recursive=1`,
      { headers: githubHeaders(ctx.config.githubTokenEnv), ttlMs: ctx.config.catalogTtlMs, cacheKey: '#HEAD' },
    )) as Record<string, unknown>;
    return asArray(data['tree'])
      .map((entry) => entry as TreeEntry)
      .filter((entry) => entry.type === 'blob' && typeof entry.path === 'string')
      .map((entry) => entry.path)
      .filter((path) => {
        // 分区白名单挡掉 integrations/scripts/examples/.github；
        // 分区内的多级目录要保留（game-development/unity/… 这 15 条是真人格）。
        const id = agencyIdOf(path);
        return id !== undefined && divisions.has(id.split('/')[0] ?? '');
      })
      .sort();
  }

  /** 人设文件的 raw 地址（HEAD 跟随默认分支）。 */
  private rawUrl(ctx: SourceCtx, path: string): string {
    return `https://raw.githubusercontent.com/${ctx.config.agencyAgentsRepo}/HEAD/${path}`;
  }

  /** 人设路径 → CatalogItem。 */
  private toItem(
    ctx: SourceCtx,
    path: string,
    divisions: Map<string, AgencyDivision>,
    meta?: { name?: string; description?: string; emoji?: string },
  ): CatalogItem {
    const id = agencyIdOf(path) ?? path;
    const segments = id.split('/');
    const division = segments[0] ?? '';
    const slug = segments[segments.length - 1] ?? id;
    const groups = segments.slice(1, -1);
    const label = divisions.get(division)?.label ?? division;
    const description = meta?.description ?? '';
    return {
      sourceId: this.id,
      kind: 'expert',
      id,
      name: meta?.name ?? slug,
      description: description === '' ? `${label} / ${slug}` : description,
      ...(meta?.emoji === undefined ? {} : { icon: meta.emoji }),
      author: ctx.config.agencyAgentsRepo.split('/')[0],
      repo: `https://github.com/${ctx.config.agencyAgentsRepo}`,
      homepage: `https://github.com/${ctx.config.agencyAgentsRepo}/blob/HEAD/${path}`,
      // 中间层级（如 unity / unreal-engine）进 tags：面板能一眼看出是哪个引擎。
      tags: [label, ...groups, 'agency-agents'],
      trust: { official: false },
      install: { kind: 'expert' },
    };
  }
}

/** 人设路径 → 条目 id（去掉 `.md`）；非人设（README / 顶层散文件 / 非法段）返回 undefined。 */
function agencyIdOf(path: string): string | undefined {
  if (!path.toLowerCase().endsWith('.md')) return undefined;
  const id = path.slice(0, -3);
  if (!AGENCY_ID_PATTERN.test(id)) return undefined;
  const segments = id.split('/');
  const slug = segments[segments.length - 1] ?? '';
  if (segments.length < 2 || slug === '' || slug.toLowerCase() === 'readme') return undefined;
  return id;
}

/** 人设文件 → 面板关心的 frontmatter 字段 + 正文。 */
function frontmatterOf(text: string): { name?: string; description?: string; emoji?: string; body: string } {
  const parsed = parseFrontmatter(text);
  const values = parsed.values;
  return {
    ...(values['name'] === undefined || values['name'] === '' ? {} : { name: values['name'] }),
    ...(values['description'] === undefined || values['description'] === '' ? {} : { description: values['description'] }),
    ...(values['emoji'] === undefined || values['emoji'] === '' ? {} : { emoji: values['emoji'] }),
    body: parsed.body,
  };
}

// ===========================================================================
// 公共工具
// ===========================================================================

/** 文本匹配（名称/描述/标签）。 */
function matchQuery(item: CatalogItem, query: string): boolean {
  const needle = query.toLowerCase();
  return (
    item.name.toLowerCase().includes(needle) ||
    item.description.toLowerCase().includes(needle) ||
    item.tags.some((tag) => tag.toLowerCase().includes(needle))
  );
}

/** 排序：综合（源内原始顺序） / 最热 / 最新。 */
export function sortItems(items: CatalogItem[], sort: CatalogQuery['sort']): CatalogItem[] {
  if (sort === 'hot') {
    return [...items].sort((a, b) => (b.stats?.downloads ?? b.stats?.stars ?? 0) - (a.stats?.downloads ?? a.stats?.stars ?? 0));
  }
  if (sort === 'new') {
    return [...items].sort((a, b) => (b.version ?? '').localeCompare(a.version ?? '', undefined, { numeric: true }));
  }
  return items;
}

/** 计算安装溯源用的哈希。 */
export function hashContent(parts: string[]): string {
  const hash = createHash('sha256');
  for (const part of parts) hash.update(part);
  return hash.digest('hex').slice(0, 16);
}
