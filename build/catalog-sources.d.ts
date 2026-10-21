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
import type { CatalogDetail, CatalogItem, CatalogPage, CatalogQuery, CatalogSource, SourceCtx } from './catalog.js';
/** 技能源。 */
export declare class GitHubSkillsSource implements CatalogSource {
    readonly id = "skills-github";
    readonly label = "GitHub \u6280\u80FD\u5E93";
    readonly kind: "skill";
    readonly installable = true;
    list(query: CatalogQuery, ctx: SourceCtx): Promise<CatalogPage>;
    item(id: string, ctx: SourceCtx): Promise<CatalogDetail>;
    /** 汇总所有配置仓库里的技能。 */
    private collect;
    /** 归一化成 CatalogItem。 */
    private toItem;
}
/** 专家源。 */
export declare class DshMarketExpertsSource implements CatalogSource {
    readonly id = "experts-dsh-market";
    readonly label = "DSH \u5E02\u573A\u9884\u8BBE";
    readonly kind: "expert";
    readonly installable = true;
    list(query: CatalogQuery, ctx: SourceCtx): Promise<CatalogPage>;
    item(id: string, ctx: SourceCtx): Promise<CatalogDetail>;
    /** manifest 条目 → CatalogItem。 */
    private toItem;
}
/** 连接器源。 */
export declare class McpOfficialSource implements CatalogSource {
    readonly id = "mcp-official";
    readonly label = "MCP Registry";
    readonly kind: "connector";
    readonly installable = true;
    /**
     * Registry 自己就有分页（`metadata.nextCursor`，一页最多 100）。
     *
     * 必须声明出来：注册表只在「唯一分页源」时才回传它的游标，否则这个源会被
     * 当成一次性源塞进扇出、上游游标被丢掉——MCP 页签就永远停在第一页。
     */
    readonly paginated = true;
    list(query: CatalogQuery, ctx: SourceCtx): Promise<CatalogPage>;
    item(id: string, ctx: SourceCtx): Promise<CatalogDetail>;
    /** registry 条目 → CatalogItem（安装提示已含连接参数）。 */
    private toItem;
}
/** 安装提示 → 可直接落库的连接器定义。 */
export declare function connectorFromHint(item: CatalogItem): Record<string, unknown> | undefined;
/** MCP 名字 → 合法 serverName。 */
export declare function sanitizeServerName(raw: string): string;
/**
 * 插件广场源：`https://awesome-dsh-plugin.com/plugins.json`。
 *
 * 一份 5MB 左右的静态 JSON（4000+ 条），顶层自带 `categories` 分类表与
 * `plugins` 数组；分类键 → 中文展示名在这里就地翻译，条目归一成 CatalogItem。
 * 分页在宿主侧做（offset 游标），因为整份清单一次返回给浏览器太重。
 */
export declare class AwesomeDshPluginsSource implements CatalogSource {
    readonly id = "plugins-awesome";
    readonly label = "Awesome DSH Plugin";
    readonly kind: "plugin";
    readonly installable = true;
    /** 自己按 offset 游标分页（整份 4392 条，不可能一次返回）。 */
    readonly paginated = true;
    list(query: CatalogQuery, ctx: SourceCtx): Promise<CatalogPage>;
    item(id: string, ctx: SourceCtx): Promise<CatalogDetail>;
    /** 上游分类表（中文优先）。 */
    categories(ctx: SourceCtx): Promise<string[]>;
    /** 拉取（走 CachedFetcher，带 TTL 与 ETag）。 */
    private payload;
    /** 原始条目 → CatalogItem。 */
    private toItem;
}
/**
 * 安装规格：
 *   1) 有 `npm` 字段 → 直接用包名（最可靠）；
 *   2) 否则解析上游给的 `dsh plugin --profile web add <spec>`，规格可能是
 *      `github:owner/repo`、npm 包名或带引号的 .tgz 地址；
 *   3) 再兜底：从仓库地址合成 `github:owner/repo`。
 */
export declare function pluginSpecOf(raw: Record<string, unknown>): {
    spec: string;
    source: 'npm' | 'github' | 'tarball';
} | undefined;
/** 自托管目录源。 */
/** 自建目录条目 → CatalogItem（CustomCatalogSource 与「我的提交」源共用）。 */
export declare function catalogItemFromRaw(raw: Record<string, unknown>, sourceId: string): CatalogItem | undefined;
/** 安装规格的来源：显式声明优先，否则按形态推断。 */
export declare function specSourceOf(spec: string, declared?: string): 'npm' | 'github' | 'tarball';
export declare class CustomCatalogSource implements CatalogSource {
    readonly id = "custom-catalog";
    readonly label = "\u81EA\u5EFA\u76EE\u5F55";
    readonly kind: "all";
    readonly installable = true;
    list(query: CatalogQuery, ctx: SourceCtx): Promise<CatalogPage>;
    item(id: string, ctx: SourceCtx): Promise<CatalogDetail>;
}
/**
 * 社区精选技能源：一份静态 JSON（24 条左右），条目自带 SKILL.md 的 `raw` 地址。
 *
 * 取数代价最低——列表 1 次请求、raw.githubusercontent 不计 GitHub API 配额。
 * 代价是它**只登记 SKILL.md 一个文件**（没有 references/scripts 清单），
 * 所以安装载荷就是这一个文件；要整目录得回 GitHub tree（吃 token 配额）。
 */
export declare class DshSkillsMarketSource implements CatalogSource {
    readonly id = "skills-dsh-market";
    readonly label = "DSH \u793E\u533A\u7CBE\u9009";
    readonly kind: "skill";
    readonly installable = true;
    list(query: CatalogQuery, ctx: SourceCtx): Promise<CatalogPage>;
    item(id: string, ctx: SourceCtx): Promise<CatalogDetail>;
    /** 读目录（数组或 `{ items: [] }` 两种形态都兼容）。 */
    private rows;
    /** 目录条目 → CatalogItem。 */
    private toItem;
}
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
export declare class AgencyAgentsSource implements CatalogSource {
    readonly id = "experts-agency-agents";
    readonly label = "Agency Agents";
    readonly kind: "expert";
    readonly installable = true;
    list(query: CatalogQuery, ctx: SourceCtx): Promise<CatalogPage>;
    item(id: string, ctx: SourceCtx): Promise<CatalogDetail>;
    /** divisions.json → 分区键 → 分区信息。 */
    private divisions;
    /** 仓库全量文件树 → 白名单内的人设路径（分区下的任意层级 `.md`）。 */
    private personaPaths;
    /** 人设文件的 raw 地址（HEAD 跟随默认分支）。 */
    private rawUrl;
    /** 人设路径 → CatalogItem。 */
    private toItem;
}
/** 排序：综合（源内原始顺序） / 最热 / 最新。 */
export declare function sortItems(items: CatalogItem[], sort: CatalogQuery['sort']): CatalogItem[];
/** 计算安装溯源用的哈希。 */
export declare function hashContent(parts: string[]): string;
