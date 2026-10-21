/**
 * 广场提交：把本地已安装的技能 / 专家 / 连接器 / 插件直接提交进广场。
 *
 * 落地方式：条目写入本地目录文件 `<dshHome>/square/catalog.json`
 * （square-catalog/1 格式），MySubmissionsSource 把它作为一个数据源
 * 注册进广场 —— 提交完成后条目立即出现在广场列表里（源标签「我的提交」），
 * 可搜索、可安装、可分享（把该文件托管到任意静态服务器并加进
 * customCatalogs，其他机器的广场也能看到）。
 *
 * 四条导出管线：
 *   - skill     读技能目录全部文件（文本内联、二进制 base64），剥离绝对路径。
 *   - expert    market 专家带组合原文；local 专家由能力开关现场合成组合。
 *   - connector 导出连接参数，env 值一律脱敏为空串（键进 envRequired）。
 *   - plugin    只导出安装规格（npm 名 / github:owner/repo / .tgz 地址）+ 包版本。
 */
import type { SquareConfig, ResolvedPaths } from './config.js';
import type { HostCtx } from './capabilities.js';
import type { CatalogDetail, CatalogPage, CatalogQuery, CatalogSource, SourceCtx } from './catalog.js';
import type { ConnectorsDomain } from './connectors.js';
import type { SkillsDomain } from './skills.js';
import type { ConnectorRecord, ExpertRecord } from './types.js';
/** 提交输入。 */
export interface SubmitInput {
    kind: 'skill' | 'expert' | 'connector' | 'plugin';
    /** 技能名 / 专家记录 id / 连接器 id / 插件包名。 */
    id: string;
    /** 技能所在路径（技能目录；专家/连接器忽略）。 */
    path?: string;
    /** 技能 cwd（project 级技能解析用）。 */
    cwd?: string;
    /** 覆盖展示名（缺省用本地名）。 */
    name?: string;
    /** 一句话简介（缺省用本地描述）。 */
    description?: string;
    /** 分类标签。 */
    tags?: string[];
}
/** 本机已安装插件的导出信息（插件导出用）。 */
export interface LocalPluginExport {
    /** 安装规格：npm 包名 / `github:owner/repo` / .tgz 地址。 */
    spec: string;
    source: 'npm' | 'github' | 'tarball';
    version?: string;
    title?: string;
    description?: string;
    homepage?: string;
}
/** 提交结果。 */
export interface SubmitOutcome {
    item: Record<string, unknown>;
    /** 内容指纹（sha256 前 16 位）。 */
    sha256: string;
    /** 大致字节数。 */
    bytes: number;
    /** 使用指引。 */
    hints: string[];
}
/** 提交目录文件路径。 */
export declare function submissionsCatalogPath(paths: ResolvedPaths): string;
/**
 * 「我的提交」源：把本地提交目录（square-catalog/1 JSON 文件）当作一个
 * 广场数据源。提交完成后条目立即出现在广场列表里。
 *
 * 条目归一化复用 catalogItemFromRaw；详情（安装载荷）与 CustomCatalogSource
 * 同构：技能给 files、专家给 composition、连接器给 mcp。
 */
export declare class MySubmissionsSource implements CatalogSource {
    private readonly filePath;
    readonly id = "my-submissions";
    readonly label = "\u6211\u7684\u63D0\u4EA4";
    readonly kind: "all";
    readonly installable = true;
    constructor(filePath: string);
    list(query: CatalogQuery, _ctx: SourceCtx): Promise<CatalogPage>;
    item(id: string, _ctx: SourceCtx): Promise<CatalogDetail>;
    /** 读目录原始条目（无提交/读失败给空数组）。 */
    private loadRawItems;
}
/**
 * 导出器：生成条目并写入本地提交目录。
 */
export declare class CatalogExporter {
    private readonly ctx;
    private readonly config;
    private readonly paths;
    private readonly skills;
    private readonly connectors;
    /** 记录 id → 专家记录。 */
    private readonly getExpert;
    /** 记录 id → 连接器记录。 */
    private readonly getConnector;
    /**
     * 插件包名 → 本机已安装插件的导出信息（规格/版本/描述）。
     *
     * 插件不是我们自己的数据（装在 profile 里），所以这里只做只读查询：
     * 拿不到就没有可提交的条目。
     */
    private readonly getPlugin?;
    constructor(ctx: HostCtx, config: SquareConfig, paths: ResolvedPaths, skills: SkillsDomain, connectors: ConnectorsDomain, 
    /** 记录 id → 专家记录。 */
    getExpert: (id: string) => ExpertRecord | undefined, 
    /** 记录 id → 连接器记录。 */
    getConnector: (id: string) => ConnectorRecord | undefined, 
    /**
     * 插件包名 → 本机已安装插件的导出信息（规格/版本/描述）。
     *
     * 插件不是我们自己的数据（装在 profile 里），所以这里只做只读查询：
     * 拿不到就没有可提交的条目。
     */
    getPlugin?: ((name: string) => Promise<LocalPluginExport | undefined>) | undefined);
    /** 目录文件路径。 */
    get catalogPath(): string;
    /** 提交：生成本地条目 → 写入提交目录（同 id 覆盖，最旧淘汰）。 */
    submit(input: SubmitInput): Promise<SubmitOutcome>;
    /**
     * 插件：只导出**安装规格**（npm 名 / `github:owner/repo` / .tgz 地址）。
     *
     * 插件代码本身不在我们这里（它在 npm 或某个仓库），广场条目只需要告诉
     * 安装方「装哪个规格」；版本、描述、首页从 profile 里读到的信息补齐。
     */
    private submitPlugin;
    /** 技能：读目录全部文件 → 内联。 */
    private submitSkill;
    /** 专家：market 带组合原文；local 现场合成组合。 */
    private submitExpert;
    /** 连接器：连接参数（env 值脱敏为空串）。 */
    private submitConnector;
    /** 写入目录（覆盖同 kind+id 条目，超出上限淘汰最旧）。 */
    private finish;
    /** 读当前提交目录（损坏时重建骨架并告警）。 */
    private loadCatalog;
    /** 使用指引。 */
    private hints;
    /** 递归读目录（≤4 层、≤200 文件、文本按扩展名内联）。 */
    private readDirFiles;
}
