/**
 * 插件配置（schemastery）。
 *
 * 字段全部带 `.default()`，因此运行时的 config 每个字段都存在；
 * `SquareConfig` 手写为全必填接口（schemastery 没有 z.infer）。
 */

import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import z from '@deepseek-ai/schemastery';

/** 插件配置类型。 */
export interface SquareConfig {
  /** 注册侧边栏面板与 HTTP 数据面。 */
  enableUi: boolean;
  /** 启用技能管理。 */
  enableSkills: boolean;
  /** 启用专家管理。 */
  enableExperts: boolean;
  /** 启用连接器管理。 */
  enableConnectors: boolean;
  /** 启用插件（profile bundle）管理页签。 */
  enablePlugins: boolean;
  /** 注册 square_status 只读诊断工具。 */
  enableTool: boolean;
  /** 全局面板 id（同时是 main 插槽的 key）。 */
  panelId: string;
  /** HTTP 路由前缀（客户端镜像时去掉前导斜杠）。 */
  routePrefix: string;
  /** DSH home；缺省取 $DSH_HOME，再缺省 ~/.dsh。 */
  dshHome: string;
  /** agents home；缺省取 $DSH_AGENTS_HOME，再缺省 ~/.agents。 */
  agentsHome: string;
  /** 额外扫描的技能目录（对应 customSkillDirs）。 */
  customSkillDirs: string[];
  /** 项目内技能目录名（相对项目根）。 */
  projectSkillDir: string;
  /** 项目内 agents 技能目录名（相对项目根）。 */
  projectAgentsSkillDir: string;
  /** 新建技能的用户根（绝对路径；空则用 <dshHome>/skills）。 */
  userSkillRoot: string;
  /** 请求体上限（字节）。 */
  maxBodyBytes: number;
  /** 单个 SKILL.md 正文上限（字节）。 */
  maxSkillBytes: number;
  /** 连接器连接与测试的超时（毫秒）。 */
  connectorTimeoutMs: number;
  /** 在响应里脱敏连接器的 env/headers 值。 */
  redactSecrets: boolean;
  /** 「创建技能」调用的技能名（默认 skill-creator）。 */
  creatorSkill: string;
  /** 导入技能（zip / 文件夹）解码后的总字节上限。 */
  maxImportBytes: number;
  // ---------------------------------------------------------------- 广场
  /** 是否启用「广场」视图与 /catalog 数据面。 */
  enablePlaza: boolean;
  /** 技能广场扫描的 GitHub 仓库（owner/repo）。 */
  skillsGithubRepos: string[];
  /** DSH 社区精选技能目录（dsh-skills-market 的单文件 catalog.json）。 */
  skillsMarketUrl: string;
  /** GitHub token 所在的环境变量名（匿名限流 60 次/时）。 */
  githubTokenEnv: string;
  /** 社区预设市场基址（目录 + /assets/presets/）。 */
  expertsMarketUrl: string;
  /** agency-agents 上游仓库（owner/repo）：人设按 divisions.json 白名单枚举。 */
  agencyAgentsRepo: string;
  /** 官方 MCP Registry 基址。 */
  mcpRegistryUrl: string;
  /** 插件广场数据源（awesome-dsh-plugin 的 plugins.json）。 */
  pluginsCatalogUrl: string;
  /** 插件广场数据源的单次请求超时（毫秒；5MB+ 的源比默认 20s 需要更长）。 */
  pluginsCatalogTimeoutMs: number;
  /** 自托管目录 URL 列表（square-catalog/1）。 */
  customCatalogs: string[];
  /** 目录缓存 TTL（毫秒）。 */
  catalogTtlMs: number;
  /** 目录分页大小。 */
  catalogPageSize: number;
  /** 列表页最多解析多少个技能的 frontmatter（避免首次加载打太多请求）。 */
  catalogParseLimit: number;
  /** 是否允许从广场安装（关掉后广场只读）。 */
  allowRemoteInstall: boolean;
}

/** 配置 schema。（构造结果整体断言为 any 传入端：运行时 schemastery 只当 schema 用） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Config: any = z.object({
  enableUi: z.boolean().default(true).description('注册侧边栏 Square 面板与宿主 HTTP 数据面'),
  enableSkills: z.boolean().default(true).description('启用技能管理页签'),
  enableExperts: z.boolean().default(true).description('启用专家管理页签（官方预设 + 自建专家）'),
  enableConnectors: z.boolean().default(true).description('启用连接器（MCP）管理页签'),
  enablePlugins: z.boolean().default(true).description('启用插件（profile bundle）管理页签'),
  enableTool: z.boolean().default(true).description('注册 square_status 只读诊断工具'),
  panelId: z.string().default('square').description('全局面板 id（= main 插槽 key）'),
  routePrefix: z.string().default('/api/dsh-squares').description('宿主 HTTP 路由前缀'),
  dshHome: z.string().default('').description('DSH home（空 = $DSH_HOME 或 ~/.dsh）'),
  agentsHome: z.string().default('').description('agents home（空 = $DSH_AGENTS_HOME 或 ~/.agents）'),
  customSkillDirs: z.array(String).default([]).description('额外扫描的技能目录'),
  projectSkillDir: z.string().default('.dsh/skills').description('项目内技能目录（相对项目根）'),
  projectAgentsSkillDir: z.string().default('.agents/skills').description('项目内 agents 技能目录'),
  userSkillRoot: z.string().default('').description('新建技能的用户根目录（空 = <dshHome>/skills）'),
  maxBodyBytes: z.natural().default(65536).description('HTTP 请求体上限（字节）'),
  maxSkillBytes: z.natural().default(65536).description('单个 SKILL.md 正文上限（字节）'),
  connectorTimeoutMs: z.natural().default(30000).description('连接器连接/测试超时（毫秒）'),
  redactSecrets: z.boolean().default(true).description('在接口响应里脱敏连接器 env/headers 值'),
  creatorSkill: z
    .string()
    .default('skill-creator')
    .description('「创建技能」按钮调用的技能名（该技能不存在时退化为纯提示词）'),
  maxImportBytes: z
    .natural()
    .default(5 * 1024 * 1024)
    .description('导入技能时允许的解码后总字节上限（zip / 文件夹）'),
  enablePlaza: z.boolean().default(true).description('启用「广场」视图与 /catalog 数据面'),
  skillsGithubRepos: z
    .array(String)
    .default([])
    .description('技能广场扫描的 GitHub 仓库（owner/repo，可多个；留空 = 不启用该源）'),
  skillsMarketUrl: z
    .string()
    .default('')
    .description('单文件技能目录 URL（条目自带 SKILL.md 的 raw 地址；留空 = 不启用该源）'),
  githubTokenEnv: z.string().default('GITHUB_TOKEN').description('GitHub token 所在的环境变量名'),
  expertsMarketUrl: z
    .string()
    .default('')
    .description('专家预设市场基址（/manifest/presets.json 与 /assets/presets/<id>/<file>；留空 = 不启用该源）'),
  agencyAgentsRepo: z
    .string()
    .default('')
    .description('agency-agents 人设仓库（owner/repo；divisions.json 白名单枚举；留空 = 不启用该源）'),
  mcpRegistryUrl: z
    .string()
    .default('')
    .description('官方 MCP Registry 基址（留空 = 不启用该源）'),
  pluginsCatalogUrl: z
    .string()
    .default('')
    .description('插件目录数据源（plugins.json；留空 = 不启用该源）'),
  pluginsCatalogTimeoutMs: z
    .natural()
    .default(120000)
    .description('插件广场数据源的单次请求超时（毫秒；整份 JSON 5MB+，默认 2 分钟）'),
  customCatalogs: z.array(String).default([]).description('自托管目录 URL（square-catalog/1）'),
  catalogTtlMs: z.natural().default(30 * 60 * 1000).description('目录缓存 TTL（毫秒）'),
  catalogPageSize: z.natural().default(24).description('广场每页条目数'),
  catalogParseLimit: z
    .natural()
    .default(60)
    .description('列表页最多解析多少个技能/预设的详细字段'),
  allowRemoteInstall: z.boolean().default(true).description('允许从广场安装（关掉后广场只读）'),
});

/** 解析后的路径集合。 */
export interface ResolvedPaths {
  dshHome: string;
  agentsHome: string;
  userSkillRoot: string;
}

/** 把配置里的家目录/技能根解析成绝对路径。 */
export function resolvePaths(config: SquareConfig): ResolvedPaths {
  const dshHome =
    config.dshHome !== ''
      ? resolve(expandHome(config.dshHome))
      : process.env.DSH_HOME !== undefined && process.env.DSH_HOME !== ''
        ? resolve(process.env.DSH_HOME)
        : join(homedir(), '.dsh');
  const agentsHome =
    config.agentsHome !== ''
      ? resolve(expandHome(config.agentsHome))
      : process.env.DSH_AGENTS_HOME !== undefined && process.env.DSH_AGENTS_HOME !== ''
        ? resolve(process.env.DSH_AGENTS_HOME)
        : join(homedir(), '.agents');
  const userSkillRoot =
    config.userSkillRoot !== '' ? resolve(expandHome(config.userSkillRoot)) : join(dshHome, 'skills');
  return { dshHome, agentsHome, userSkillRoot };
}

/** 展开 `~` 前缀（其余路径原样返回）。 */
export function expandHome(path: string): string {
  if (path === '~') return homedir();
  if (path.startsWith('~/')) return join(homedir(), path.slice(2));
  return path;
}
