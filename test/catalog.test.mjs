/**
 * 广场测试：源适配器（真实响应快照/结构）+ 三条安装管线 + 组合解析。
 *
 * 网络全部用桩 SourceCtx 顶掉，不打真实请求；断言的是「远端数据 → 归一化条目 →
 * 安装落地」这条链路的形状与副作用。
 *
 * 运行：node test/catalog.test.mjs（需先 pnpm build）
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CatalogInstaller, SourceRegistry, encodeFanoutCursor, makeSourceCtx, parseFanoutCursor } from '../build/catalog-install.js';
import { CatalogExporter, MySubmissionsSource } from '../build/catalog-export.js';
import { categoryList, normalizeCategory } from '../build/catalog-categories.js';
import { displayStats } from '../build/catalog-stats.js';
import {
  AgencyAgentsSource,
  CustomCatalogSource,
  DshMarketExpertsSource,
  DshSkillsMarketSource,
  GitHubSkillsSource,
  McpOfficialSource,
  connectorFromHint,
  sanitizeServerName,
} from '../build/catalog-sources.js';
import { CachedFetcher } from '../build/catalog.js';
import { ConnectorsDomain } from '../build/connectors.js';
import { ExpertsDomain, parseComposition } from '../build/experts.js';
import { parseBoolean, parseFrontmatter } from '../build/frontmatter.js';
import { SkillsDomain } from '../build/skills.js';
import { DeckStore } from '../build/store.js';

let failures = 0;
let checks = 0;

/** 断言。 */
function check(condition, message, detail) {
  checks += 1;
  if (condition) {
    console.log(`  ok  ${message}`);
    return;
  }
  failures += 1;
  console.error(`  FAIL ${message}${detail === undefined ? '' : ` → ${String(detail)}`}`);
}

const tmp = await mkdtemp(join(tmpdir(), 'square-catalog-'));
const skillRoot = join(tmp, 'skills');

/** 配置。 */
const config = {
  enablePlaza: true,
  skillsGithubRepos: ['anthropics/skills'],
  skillsMarketUrl: 'https://community.test/catalog.json',
  githubTokenEnv: 'GITHUB_TOKEN',
  expertsMarketUrl: 'https://dsh-market.test',
  agencyAgentsRepo: 'agency.test/agents',
  mcpRegistryUrl: 'https://registry.test/v0',
  customCatalogs: ['https://team.test/square.json'],
  catalogTtlMs: 60000,
  catalogPageSize: 24,
  catalogParseLimit: 60,
  allowRemoteInstall: true,
  userSkillRoot: skillRoot,
  projectSkillDir: '.dsh/skills',
  projectAgentsSkillDir: '.agents/skills',
  customSkillDirs: [],
  maxSkillBytes: 65536,
  maxImportBytes: 5 * 1024 * 1024,
  redactSecrets: true,
  connectorTimeoutMs: 5000,
};
const paths = { dshHome: tmp, agentsHome: join(tmp, 'agents'), userSkillRoot: skillRoot };
const ctx = { logger: { info() {}, warn() {}, debug() {} } };

/** 真实树/文件快照（取自 anthropics/skills 的实际结构）。 */
const TREE = {
  tree: [
    { path: 'README.md', type: 'blob' },
    { path: 'skills/skill-creator/SKILL.md', type: 'blob' },
    { path: 'skills/skill-creator/references/schemas.md', type: 'blob' },
    { path: 'skills/skill-creator/scripts/run.py', type: 'blob' },
    { path: 'skills/pdf/SKILL.md', type: 'blob' },
  ],
};
const SKILL_MD = [
  '---',
  'name: skill-creator',
  'description: Create and refine DSH skills.',
  '---',
  '',
  '# Skill Creator',
].join('\n');

/** agency-agents 的人设文件快照（frontmatter + Markdown 正文）。 */
const AGENCY_UI_MD = [
  '---',
  'name: UI Designer',
  'description: Expert UI designer specializing in visual design systems',
  'color: purple',
  'emoji: 🎨',
  'vibe: Creates beautiful, consistent, accessible interfaces.',
  '---',
  '',
  '# UI Designer Agent Personality',
  '',
  'You are **UI Designer**, an expert user interface designer.',
].join('\n');

/** 桩 SourceCtx：把 URL 映射到固定响应。 */
function stubCtx(overrides = {}) {
  return {
    config,
    paths,
    log: () => {},
    json: async (url) => {
      if (url.includes('api.github.com/repos/anthropics/skills/git/trees')) return TREE;
      if (url.includes('api.github.com/repos/anthropics/skills')) return { default_branch: 'main' };
      if (url.includes('/manifest/presets.json')) {
        return {
          generated: '2026-09-29',
          items: [
            {
              id: 'roleplay-chengwei',
              name: '角色扮演 · 程未',
              description: '与咖啡馆咖啡师对话',
              author: 'dongshuyan',
              category: 'roleplay',
              tags: ['roleplay'],
              rank: 1,
              version: '1.0.0',
              files: ['agent.cordis.yml', 'preset.yml'],
            },
          ],
        };
      }
      if (url.includes('registry.test/v0/servers')) {
        return {
          servers: [
            {
              server: {
                name: 'ac.inference.sh/mcp',
                title: 'inference.sh',
                description: 'Run AI apps',
                version: '1.0.0',
                remotes: [{ type: 'streamable-http', url: 'https://api.inference.sh/mcp' }],
              },
            },
            {
              server: {
                name: 'com.pulsemcp/remote-filesystem',
                description: 'GCS filesystem',
                version: '0.1.2',
                packages: [
                  {
                    registryType: 'npm',
                    identifier: 'remote-filesystem-mcp-server',
                    runtimeHint: 'npx',
                    transport: { type: 'stdio' },
                    environmentVariables: [
                      { name: 'GCS_BUCKET', isRequired: true },
                      { name: 'GCS_PROJECT_ID' },
                    ],
                  },
                ],
              },
            },
            {
              server: {
                name: 'io.example/oci-only',
                description: 'OCI image only',
                version: '2.0.0',
                packages: [{ registryType: 'oci', identifier: 'ghcr.io/x/y' }],
              },
            },
          ],
          metadata: { nextCursor: 'com.pulsemcp/remote-filesystem:0.1.2', count: 3 },
        };
      }
      if (url.includes('team.test/square.json')) {
        return {
          schema: 'square-catalog/1',
          name: '团队目录',
          items: [
            {
              kind: 'skill',
              id: 'weekly-report',
              name: '周报生成',
              description: '把本周改动整理成周报',
              files: [{ path: 'SKILL.md', text: '---\nname: weekly-report\ndescription: 周报生成\n---\n\n正文\n' }],
            },
            {
              kind: 'connector',
              id: 'inner-kb',
              name: '内部知识库',
              mcp: { transport: 'stdio', command: 'uvx', args: ['inner-kb'], envRequired: ['TOKEN'] },
            },
          ],
        };
      }
      if (url.includes('community.test/catalog.json')) {
        return [
          {
            id: 'frontend-design',
            name: 'frontend-design',
            title: 'Frontend Design',
            description: 'Guidance for distinctive, intentional visual design.',
            tags: ['frontend', 'design'],
            author: 'anthropics',
            category: 'frontend',
            repo: 'anthropics/skills',
            branch: 'main',
            path: 'skills/frontend-design/SKILL.md',
            raw: 'https://raw.test/community/frontend-design/SKILL.md',
            license: null,
          },
          {
            id: 'react-best-practices',
            name: 'react-best-practices',
            title: 'React Best Practices',
            description: 'React and Next.js performance guidelines.',
            tags: ['react'],
            author: 'vercel-labs',
            category: 'frontend',
            repo: 'vercel-labs/agent-skills',
            branch: 'main',
            path: 'skills/react-best-practices/SKILL.md',
            raw: 'https://raw.test/community/react-best-practices/SKILL.md',
            license: 'MIT',
          },
          // 缺 raw 的条目：登记不完整，应当被丢弃
          { id: 'no-raw', name: 'no-raw', title: 'No raw' },
        ];
      }
      if (url.includes('api.github.com/repos/agency.test/agents/git/trees')) {
        return {
          tree: [
            { path: 'README.md', type: 'blob' },
            { path: 'design/design-ui-designer.md', type: 'blob' },
            { path: 'design/README.md', type: 'blob' },
            { path: 'design/assets', type: 'tree' },
            { path: 'engineering/engineering-backend.md', type: 'blob' },
            { path: 'game-development/unity/unity-architect.md', type: 'blob' },
            { path: 'integrations/foo.md', type: 'blob' },
          ],
        };
      }
      if (url.includes('agency.test/agents/HEAD/divisions.json')) {
        return {
          divisions: {
            design: { label: 'Design', icon: 'PenTool', color: '#EC4899' },
            engineering: { label: 'Engineering', icon: 'Code', color: '#3B82F6' },
            'game-development': { label: 'Game Development', icon: 'Gamepad2', color: '#A855F7' },
          },
        };
      }
      throw new Error(`unexpected url: ${url}`);
    },
    text: async (url) => {
      if (url.includes('skill-creator/SKILL.md')) return SKILL_MD;
      if (url.includes('pdf/SKILL.md')) return '---\nname: pdf\ndescription: PDF toolkit\n---\n';
      if (url.includes('community/frontend-design/SKILL.md')) {
        return '---\nname: frontend-design\ndescription: 前沿视觉设计\n---\n\n正文\n';
      }
      if (url.includes('agency.test/agents/HEAD/design/design-ui-designer.md')) return AGENCY_UI_MD;
      if (url.includes('agency.test/agents/HEAD/engineering/engineering-backend.md')) {
        return '---\nname: Backend Architect\ndescription: 后端架构师\nemoji: 🧱\n---\n\nYou are a backend architect.\n';
      }
      if (url.includes('agency.test/agents/HEAD/game-development/unity/unity-architect.md')) {
        return '---\nname: Unity Architect\ndescription: Unity 架构师\nemoji: 🎮\n---\n\nYou are a Unity architect.\n';
      }
      if (url.includes('/assets/presets/roleplay-chengwei/agent.cordis.yml')) {
        return "- id: persona\n  name: '@deepseek-ai/dsh-persona'\n  config:\n    prefix: |-\n      咖啡馆人设\n";
      }
      if (url.includes('/assets/presets/roleplay-chengwei/preset.yml')) return 'name: 角色扮演 · 程未\norder: 4\n';
      throw new Error(`unexpected text url: ${url}`);
    },
    bytes: async (url) => new TextEncoder().encode(`bytes:${url}`),
    ...overrides,
  };
}

// =====================================================================
console.log('\n[广场] 源适配器');
{
  const skills = new GitHubSkillsSource();
  const page = await skills.list({ kind: 'skill' }, stubCtx());
  check(page.items.length === 2, 'GitHub 源列出 2 个技能', String(page.items.length));
  const creator = page.items.find((item) => item.name === 'skill-creator');
  check(creator !== undefined, '解析出 frontmatter 里的技能名');
  check(creator?.description === 'Create and refine DSH skills.', '解析出 description');
  check(creator?.trust?.official === true, 'anthropics/* 标记为官方');
  const detail = await skills.item(creator.id, stubCtx());
  check(detail.files?.length === 3, '详情返回该技能目录下的全部文件', String(detail.files?.length));
  check(detail.preview?.startsWith('---'), '详情带 SKILL.md 预览');

  const experts = new DshMarketExpertsSource();
  const expertPage = await experts.list({ kind: 'expert' }, stubCtx());
  check(expertPage.items.length === 1 && expertPage.items[0].id === 'roleplay-chengwei', '市场源列出预设');
  const expertDetail = await experts.item('roleplay-chengwei', stubCtx());
  check(expertDetail.composition?.includes('dsh-persona'), '详情返回组合原文');
  check(expertDetail.metadata?.includes('order'), '详情返回 preset.yml');

  const mcp = new McpOfficialSource();
  const mcpPage = await mcp.list({ kind: 'connector' }, stubCtx());
  check(mcpPage.items.length === 3, 'MCP Registry 列出 3 条');
  check(mcpPage.nextCursor === 'com.pulsemcp/remote-filesystem:0.1.2', '分页游标透传');
  const remote = mcpPage.items.find((item) => item.id === 'ac.inference.sh/mcp');
  check(remote?.install.kind === 'connector' && remote.install.transport === 'streamable-http', 'remote 条目映射成 streamable-http');
  const pkg = mcpPage.items.find((item) => item.id === 'com.pulsemcp/remote-filesystem');
  check(pkg?.install.kind === 'connector' && pkg.install.command === 'npx', 'npm 包映射成 npx stdio');
  check(pkg?.install.envRequired?.join(',') === 'GCS_BUCKET', '只有 isRequired 的环境变量进 envRequired');
  const oci = mcpPage.items.find((item) => item.id === 'io.example/oci-only');
  check(oci?.install.kind === 'unsupported', 'OCI 分发标记为不支持');
  check(mcp.paginated === true, 'MCP Registry 声明为分页源（否则上游游标会被丢掉）');
  // 游标 `名字:版本` 指向上一页最后一条原始行：那个服务器上一页已经展示过，
  // 翻页时必须丢掉，否则同一张卡会在两页各出现一次。
  const mcpNext = await mcp.list({ kind: 'connector', cursor: 'com.pulsemcp/remote-filesystem:0.1.2' }, stubCtx());
  check(mcpNext.items.length === 2, '翻页丢掉游标边界上的服务器', String(mcpNext.items.length));
  check(mcpNext.items.every((item) => item.id !== 'com.pulsemcp/remote-filesystem'), '边界服务器不再重复出现');

  check(sanitizeServerName('ac.inference.sh/mcp') === 'mcp', 'serverName 取末段', sanitizeServerName('ac.inference.sh/mcp'));
  check(sanitizeServerName('com.x/remote-filesystem') === 'remote-filesystem', 'serverName 归一化');
  const connector = connectorFromHint(pkg);
  check(connector?.transport === 'stdio' && connector.command === 'npx', '安装提示 → 连接器定义');

  const custom = new CustomCatalogSource();
  const customPage = await custom.list({ kind: 'skill' }, stubCtx());
  check(customPage.items.length === 1 && customPage.items[0].id === 'weekly-report', '自建目录按 kind 过滤');
  const customDetail = await custom.item('inner-kb', stubCtx());
  check(customDetail.connector?.command === 'uvx', '自建目录的 connector 载荷');
}

// =====================================================================
console.log('\n[广场] 社区精选技能源（dsh-skills-market）');
{
  const source = new DshSkillsMarketSource();
  const page = await source.list({ kind: 'skill' }, stubCtx());
  check(page.items.length === 2, '缺 raw 的条目被丢弃', String(page.items.length));
  check(page.items[0].id === 'frontend-design' && page.items[0].name === 'Frontend Design', '名称取 title');
  check(page.items[0].trust?.official === true, 'anthropics/* 标记为官方');
  check(
    page.items[0].install.kind === 'skill' && page.items[0].install.fileCount === 1,
    '安装提示只登记 SKILL.md 一个文件',
  );
  check(
    page.items[0].homepage === 'https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md',
    'homepage 指向仓库里的 SKILL.md',
    page.items[0].homepage,
  );
  const filtered = await source.list({ kind: 'skill', q: 'react' }, stubCtx());
  check(filtered.items.length === 1 && filtered.items[0].id === 'react-best-practices', '按关键词过滤');
  const detail = await source.item('frontend-design', stubCtx());
  check(
    detail.files?.length === 1 && detail.files[0].path === 'SKILL.md' && detail.files[0].url?.startsWith('https://raw.test/'),
    '详情给单文件 SKILL.md 载荷',
  );
  check(detail.preview?.startsWith('---'), '详情带 SKILL.md 预览');
  let notInstallable = false;
  try {
    await source.item('no-raw', stubCtx());
  } catch (error) {
    notInstallable = error?.code === 'not-installable';
  }
  check(notInstallable, '缺 raw 的条目详情报 not-installable');
}

// =====================================================================
console.log('\n[广场] agency-agents 专家源（人设 → 组合）');
{
  const source = new AgencyAgentsSource();
  const page = await source.list({ kind: 'expert' }, stubCtx());
  check(page.items.length === 3, '按 divisions 白名单过滤非人设目录', String(page.items.length));
  check(
    page.items.map((item) => item.id).join(',') ===
      'design/design-ui-designer,engineering/engineering-backend,game-development/unity/unity-architect',
    'id = 路径去 .md（含多级目录）',
    page.items.map((item) => item.id).join(','),
  );
  const ui = page.items[0];
  check(ui.name === 'UI Designer' && ui.icon === '🎨', '名称/图标来自 frontmatter');
  check(ui.tags.join(',') === 'Design,agency-agents', '分区标签进 tags', ui.tags.join(','));
  check(ui.install.kind === 'expert', '安装提示是 expert');
  const unity = page.items.find((item) => item.id.startsWith('game-development/'));
  check(
    unity?.tags.join(',') === 'Game Development,unity,agency-agents',
    '多级目录的中间层进 tags',
    unity?.tags.join(','),
  );
  const filtered = await source.list({ kind: 'expert', q: 'unity' }, stubCtx());
  check(filtered.items.length === 1 && filtered.items[0].name === 'Unity Architect', '按关键词过滤');

  const detail = await source.item('design/design-ui-designer', stubCtx());
  check(typeof detail.composition === 'string', '详情返回合成组合');
  const rows = parseComposition(detail.composition);
  check(rows[0]?.id === 'persona' && rows[0]?.name === '@deepseek-ai/dsh-persona', '组合首行是 persona 行');
  check(
    rows[0]?.config?.complete === true && String(rows[0]?.config?.prefix).includes('You are **UI Designer**'),
    '人设正文进 persona.prefix',
  );
  check(rows.length > 1, '组合带标准能力行', String(rows.length));

  let badId = false;
  try {
    await source.item('../etc/passwd', stubCtx());
  } catch (error) {
    badId = error?.code === 'bad-id';
  }
  check(badId, '非法 id 被拒绝');
  let unknownDivision = false;
  try {
    await source.item('examples/nope', stubCtx());
  } catch (error) {
    unknownDivision = error?.code === 'bad-id';
  }
  check(unknownDivision, '非白名单分区被拒绝');
}

// =====================================================================
console.log('\n[广场] 社区精选技能安装（url 形式的 SKILL.md）');
{
  const store = await DeckStore.open(ctx);
  const services = {
    skills: { snapshot: async () => ({ skills: [], complete: true }) },
    agentPresets: { list: async () => [], register: async () => async () => {} },
    settings: undefined,
    storageDomain: undefined,
    webServer: undefined,
    connection: undefined,
    mcpClient: false,
  };
  const skills = new SkillsDomain(ctx, config, paths, services);
  const connectors = new ConnectorsDomain(ctx, config, paths, services);
  const experts = new ExpertsDomain(ctx, config, store, services, { list: () => store.listConnectors() });
  const source = new DshSkillsMarketSource();
  const fileText = '---\nname: frontend-design\ndescription: 前沿视觉设计\n---\n\n正文\n';
  const installer = new CatalogInstaller({
    ctx,
    config,
    paths,
    store,
    skills,
    experts,
    connectors,
    // 安装器按 url 取字节——这里给桩，避免真打网络
    registry: { item: async (_sourceId, id) => source.item(id, stubCtx()) },
    fetcher: { raw: async () => new TextEncoder().encode(fileText) },
    connectorsChanged: async () => {},
  });
  const outcome = await installer.install('skills-dsh-market', 'frontend-design');
  check(outcome.key === 'skill:frontend-design', '技能安装键用 frontmatter 里的 name', outcome.key);
  const written = parseFrontmatter(await readFile(join(skillRoot, 'frontend-design', 'SKILL.md'), 'utf8'));
  check(written.values['name'] === 'frontend-design', 'SKILL.md 落盘');
  check(parseBoolean(written.values['disable-model-invocation']) === true, '第三方技能默认禁用');
  check(store.getInstalled('skill:frontend-design') !== undefined, '写入技能溯源');
}

// =====================================================================
console.log('\n[广场] makeSourceCtx 的取数器绑定（回归：不能丢 this）');
{
  const fetcher = new CachedFetcher(ctx, paths, 1000);
  const calls = [];
  fetcher.text = async function (url) {
    calls.push(url);
    // 故意读实例属性：绑定丢了这里就会抛
    if (this.memory === undefined) throw new Error('this lost');
    return 'ok';
  };
  const sourceCtx = makeSourceCtx(ctx, config, paths, fetcher);
  const value = await sourceCtx.text('https://example.test/x');
  check(value === 'ok' && calls.length === 1, 'text 经包装后仍带 this');
  check(typeof sourceCtx.json === 'function' && typeof sourceCtx.bytes === 'function', 'json/bytes 都被包装成函数');
}

// =====================================================================
console.log('\n[广场] 组合解析（!!js → __jsExpr）');
{
  const rows = parseComposition(
    "- id: a\n  name: '@x/a'\n- id: b\n  name: '@x/b'\n  disabled: !!js process.platform === 'win32'\n",
  );
  check(rows.length === 2, '解析出 2 行');
  const second = rows[1];
  check(second.disabled?.__jsExpr === "process.platform === 'win32'", '!!js 转成 __jsExpr 数据', JSON.stringify(second.disabled));
  let rejected = false;
  try {
    parseComposition('id: not-a-list\n');
  } catch (error) {
    rejected = error?.code === 'bad-composition';
  }
  check(rejected, '非数组组合被拒绝');
}

// =====================================================================
console.log('\n[广场] 安装 / 卸载管线');
{
  const store = await DeckStore.open(ctx);
  const registered = [];
  const services = {
    skills: { snapshot: async () => ({ skills: [], complete: true }) },
    agentPresets: {
      list: async () => [],
      register: async (definition) => {
        registered.push(definition);
        return async () => {};
      },
    },
    settings: undefined,
    storageDomain: undefined,
    webServer: undefined,
    connection: undefined,
    mcpClient: false,
  };
  const skills = new SkillsDomain(ctx, config, paths, services);
  const connectors = new ConnectorsDomain(ctx, config, paths, services);
  const experts = new ExpertsDomain(ctx, config, store, services, { list: () => store.listConnectors() });

  /** 桩注册表：直接返回给定详情。 */
  const detailFor = (detail) => ({ item: async () => detail });
  const registry = new SourceRegistry([], stubCtx());

  const installer = new CatalogInstaller({
    ctx,
    config,
    paths,
    store,
    skills,
    experts,
    connectors,
    registry,
    fetcher: new CachedFetcher(ctx, paths, 1000),
    connectorsChanged: async () => {},
  });
  // 用桩替换 registry（安装器只用到 item）
  installer.deps.registry = detailFor;

  // —— 技能
  const skillDetail = {
    item: {
      sourceId: 'skills-github',
      kind: 'skill',
      id: 'anthropics/skills::skills/weekly-report',
      name: 'weekly-report',
      description: '周报',
      tags: [],
      install: { kind: 'skill' },
    },
    files: [{ path: 'SKILL.md', text: '---\nname: weekly-report\ndescription: 周报生成\n---\n\n正文\n' }],
  };
  installer.deps.registry = detailFor(skillDetail);
  const skillOutcome = await installer.install('skills-github', skillDetail.item.id, { enable: false });
  check(skillOutcome.key === 'skill:weekly-report', '技能安装键正确', skillOutcome.key);
  const written = await readFile(join(skillRoot, 'weekly-report', 'SKILL.md'), 'utf8');
  const writtenFm = parseFrontmatter(written);
  check(
    parseBoolean(writtenFm.values['disable-model-invocation']) === true,
    '技能文件落盘并写入禁用位',
    writtenFm.values['disable-model-invocation'],
  );
  check(store.getInstalled('skill:weekly-report') !== undefined, '写入了技能溯源');

  // 用 URL 形式再装一个（走 bytes 分支）
  const urlSkill = {
    item: { ...skillDetail.item, id: 'anthropics/skills::skills/url-skill', name: 'url-skill' },
    files: [{ path: 'SKILL.md', url: 'https://raw.test/url-skill/SKILL.md', text: undefined }],
  };
  installer.deps.registry = {
    item: async () => ({
      ...urlSkill,
      files: [
        {
          path: 'SKILL.md',
          url: 'https://raw.test/url-skill/SKILL.md',
        },
      ],
    }),
  };
  // bytes 返回的文本不是合法 frontmatter，应当报错且不留溯源
  let failed = false;
  try {
    await installer.install('skills-github', 'anthropics/skills::skills/url-skill');
  } catch {
    failed = true;
  }
  check(failed, '下载内容不含 frontmatter 时安装失败');
  check(store.getInstalled('skill:url-skill') === undefined, '失败不留溯源');

  // —— 专家
  const expertDetail = {
    item: {
      sourceId: 'experts-dsh-market',
      kind: 'expert',
      id: 'roleplay-chengwei',
      name: '角色扮演 · 程未',
      description: '',
      tags: [],
      install: { kind: 'expert' },
    },
    composition: "- id: persona\n  name: '@deepseek-ai/dsh-persona'\n",
    metadata: 'name: 角色未\norder: 4\n',
  };
  installer.deps.registry = detailFor(expertDetail);
  const expertOutcome = await installer.install('experts-dsh-market', 'roleplay-chengwei');
  check(expertOutcome.kind === 'expert' && expertOutcome.id === 'roleplay-chengwei', '专家安装返回记录 id');
  check(registered.length === 1, '预设注册被调用一次');
  check(registered[0].plugins.length === 1 && registered[0].plugins[0].name === '@deepseek-ai/dsh-persona', '注册用的插件行来自组合原文');
  const stored = store.getExpert('roleplay-chengwei');
  check(stored?.kind === 'market' && stored.compositionYaml?.includes('dsh-persona'), '专家记录带 kind=market 与组合原文');

  // —— 人设型专家源（agency-agents）：只有正文，靠 personaComposition 合成组合后走同一条管线
  const agencySource = new AgencyAgentsSource();
  installer.deps.registry = { item: async (_sourceId, id) => agencySource.item(id, stubCtx()) };
  const agencyOutcome = await installer.install('experts-agency-agents', 'design/design-ui-designer');
  check(
    agencyOutcome.kind === 'expert' && agencyOutcome.id === 'design-design-ui-designer',
    '人设型专家装成预设 id（斜杠归一化）',
    agencyOutcome.id,
  );
  check(registered.length === 2, '预设注册被调用两次', String(registered.length));
  const agencyDefinition = registered[1];
  check(agencyDefinition.name === 'UI Designer', '预设名取 frontmatter 的 name', agencyDefinition.name);
  check(
    agencyDefinition.plugins[0]?.id === 'persona' &&
      String(agencyDefinition.plugins[0]?.config?.prefix).includes('UI Designer Agent Personality'),
    '合成的 persona 行带人设正文',
  );
  const agencyStored = store.getExpert('design-design-ui-designer');
  // 溯源落在 installed 表（ExpertSchema 不持久化 provenance 字段）
  const agencyInstalled = store.getInstalled('expert:design-design-ui-designer');
  check(
    agencyStored?.kind === 'market' &&
      agencyStored.icon === '🎨' &&
      agencyInstalled?.sourceId === 'experts-agency-agents' &&
      agencyInstalled.itemId === 'design/design-ui-designer',
    '人设型专家落库为 market 并带溯源',
  );

  // —— 连接器
  const connectorDetail = {
    item: {
      sourceId: 'mcp-official',
      kind: 'connector',
      id: 'com.pulsemcp/remote-filesystem',
      name: 'remote-filesystem',
      description: '',
      tags: [],
      install: { kind: 'connector', transport: 'stdio', command: 'npx', envRequired: ['GCS_BUCKET'] },
    },
    connector: {
      transport: 'stdio',
      serverName: 'remote-filesystem',
      label: 'remote-filesystem',
      command: 'npx',
      args: ['-y', 'remote-filesystem-mcp-server'],
      env: { GCS_BUCKET: '' },
    },
  };
  installer.deps.registry = detailFor(connectorDetail);
  const connectorOutcome = await installer.install('mcp-official', 'com.pulsemcp/remote-filesystem');
  check(connectorOutcome.missing?.join(',') === 'GCS_BUCKET', '缺少必填密钥时给出 missing');
  const record = store.listConnectors()[0];
  check(record?.enabled === false, '缺密钥的连接器安装为停用');
  check(store.getInstalled(`connector:${record.id}`) !== undefined, '写入了连接器溯源');

  // —— 卸载（面板传的是完整键，这里两种写法都覆盖）
  await installer.uninstall('connector', `connector:${record.id}`);
  check(store.listConnectors().length === 0, '卸载连接器删除记录');
  check(store.getInstalled(`connector:${record.id}`) === undefined, '卸载清除溯源');
  await installer.uninstall('expert', 'roleplay-chengwei');
  check(store.getInstalled('expert:roleplay-chengwei') === undefined, '裸标识卸载同样生效');
  check(store.getExpert('roleplay-chengwei') === undefined, '卸载专家删除记录');
  await installer.uninstall('skill', 'weekly-report');
  check(store.getInstalled('skill:weekly-report') === undefined, '卸载技能清除溯源');

  // —— 禁止安装
  const blocked = new CatalogInstaller({
    ctx,
    config: { ...config, allowRemoteInstall: false },
    paths,
    store,
    skills,
    experts,
    connectors,
    registry: detailFor(skillDetail),
    fetcher: new CachedFetcher(ctx, paths, 1000),
    connectorsChanged: async () => {},
  });
  let refused = false;
  try {
    await blocked.install('skills-github', skillDetail.item.id);
  } catch (error) {
    refused = error?.code === 'install-disabled';
  }
  check(refused, 'allowRemoteInstall=false 时拒绝安装');
}

// =====================================================================
console.log('\n[广场] 提交管线（本地条目 → 广场「我的提交」源）');
{
  const store = await DeckStore.open(ctx);
  const registered = [];
  const services = {
    skills: { snapshot: async () => ({ skills: [], complete: true }) },
    agentPresets: {
      list: async () => [],
      register: async (definition) => {
        registered.push(definition);
        return async () => {};
      },
    },
    settings: undefined,
    storageDomain: undefined,
    webServer: undefined,
    connection: undefined,
    mcpClient: false,
  };
  const skills = new SkillsDomain(ctx, config, paths, services);
  const connectors = new ConnectorsDomain(ctx, config, paths, services);
  const experts = new ExpertsDomain(ctx, config, store, services, { list: () => store.listConnectors() });

  // 先造一个本地技能（走真实 importSkill 管线）。
  await skills.importSkill({
    root: 'user',
    source: 'files',
    files: [{ path: 'SKILL.md', text: SKILL_MD }],
    enable: true,
  });

  const exporter = new CatalogExporter(ctx, config, paths, skills, connectors, (id) => store.getExpert(id), (id) =>
    store.getConnector(id),
  );

  // —— 提交技能
  const outcome = await exporter.submit({ kind: 'skill', id: 'skill-creator', tags: ['demo'] });
  check(outcome.item['kind'] === 'skill', '提交结果 kind=skill');
  check(outcome.hints.length > 0, '提交结果带指引');
  const catalogFile = join(tmp, 'square', 'catalog.json');
  const saved = JSON.parse(await readFile(catalogFile, 'utf8'));
  check(saved.schema === 'square-catalog/1', '提交目录 schema 正确');
  check(Array.isArray(saved.items) && saved.items.length === 1, '提交目录包含条目');
  check(saved.items[0].files?.some((file) => file.path === 'SKILL.md'), '技能文件内联 SKILL.md');

  // —— 「我的提交」源：列表 + 详情（安装载荷）
  const mySource = new MySubmissionsSource(catalogFile);
  const listPage = await mySource.list({ kind: 'skill' }, stubCtx());
  check(listPage.items.length === 1 && listPage.items[0].id === 'skill-creator', '我的提交源列出该技能');
  check(listPage.items[0].install.kind === 'skill', '列表条目归一化 install');
  const detail = await mySource.item('skill-creator', stubCtx());
  check(detail.files?.some((file) => file.text !== undefined && file.text.includes('Skill Creator')), '详情给内联文件');

  // —— 提交专家（local：由能力开关合成组合）
  const created = await experts.create({
    name: '演示专家',
    description: '提交管线测试',
    systemPrompt: '你是演示专家',
    tags: ['demo'],
  });
  const expertOutcome = await exporter.submit({ kind: 'expert', id: created.expert.id });
  check(expertOutcome.item['kind'] === 'expert', '专家提交 kind=expert');
  check(
    typeof expertOutcome.item['composition'] === 'string' && String(expertOutcome.item['composition']).includes('agent-persona'),
    'local 专家合成组合',
  );
  const expertList = await mySource.list({ kind: 'expert' }, stubCtx());
  check(expertList.items.length === 1 && expertList.items[0].install.kind === 'expert', '我的提交源列出该专家');

  // —— 提交连接器（env 值脱敏）
  await store.putConnector({
    id: 'demo-mcp',
    label: 'Demo MCP',
    description: '演示连接器',
    transport: 'stdio',
    serverName: 'demo-mcp',
    command: 'npx',
    args: ['-y', 'demo-mcp'],
    env: { DEMO_KEY: 'super-secret' },
    cwd: '',
    url: '',
    headers: {},
    toolCallTimeoutMs: 30000,
    failOnStartupError: false,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const connectorOutcome = await exporter.submit({ kind: 'connector', id: 'demo-mcp' });
  const mcp = connectorOutcome.item['mcp'];
  check(mcp?.env?.DEMO_KEY === '', '连接器 env 值脱敏为空串');
  check(Array.isArray(mcp?.envRequired) && mcp.envRequired[0] === 'DEMO_KEY', 'envRequired 保留键名');
  check(mcp?.command === 'npx', 'stdio 参数保留');
  const connectorList = await mySource.list({ kind: 'connector' }, stubCtx());
  check(connectorList.items.length === 1, '我的提交源列出该连接器');
  const connectorDetail = await mySource.item('demo-mcp', stubCtx());
  check(connectorDetail.connector?.command === 'npx', '连接器详情给安装载荷');

  // —— 同 id 重复提交：覆盖而非追加
  await exporter.submit({ kind: 'skill', id: 'skill-creator', tags: ['v2'] });
  const reread = JSON.parse(await readFile(catalogFile, 'utf8'));
  check(reread.items.length === 3, '重复提交覆盖同条目（3 种各一条）');

  // —— 闭环：从「我的提交」源装回本机（skill 管线；换独立技能根避免与本块开头冲突）
  const roundtripSkills = new SkillsDomain(ctx, config, { ...paths, userSkillRoot: join(tmp, 'skills-roundtrip') }, services);
  const registry = new SourceRegistry([mySource], stubCtx());
  const installer = new CatalogInstaller({
    ctx,
    config: { ...config },
    paths: {
      ...paths,
      userSkillRoot: join(tmp, 'skills-roundtrip'),
    },
    store,
    skills: roundtripSkills,
    experts,
    connectors,
    registry,
    fetcher: new CachedFetcher(ctx, paths, 1000),
    connectorsChanged: async () => {},
  });
  const roundtrip = await installer.install('my-submissions', 'skill-creator');
  check(roundtrip.key === 'skill:skill-creator', '闭环安装键正确');
  check(store.getInstalled('skill:skill-creator') !== undefined, '闭环安装写溯源');
}

// =====================================================================
console.log('\n[广场] 目录分类归一（关键词 → 标准分类）');
{
  const base = (kind, fields = {}) => ({
    sourceId: 'test',
    kind,
    id: 'x',
    name: '',
    description: '',
    tags: [],
    install: { kind },
    ...fields,
  });
  check(
    normalizeCategory(base('expert', { name: '角色扮演 · 程未', description: '沉浸式角色扮演', tags: ['roleplay'] })) === '游戏空间',
    '角色扮演专家 → 游戏空间',
  );
  check(
    normalizeCategory(base('expert', { name: '代码评审专家', description: '严格审查代码缺陷与测试缺口' })) === '技术工程',
    '代码评审专家 → 技术工程',
  );
  check(
    normalizeCategory(base('expert', { name: '文案策划', description: '内容创作与文案打磨' })) === '内容创作',
    '文案专家 → 内容创作',
  );
  check(
    normalizeCategory(base('skill', { name: 'pdf', description: 'PDF 文档处理工具' })) === '办公协同',
    'PDF 技能 → 办公协同',
  );
  check(
    normalizeCategory(base('skill', { name: 'webapp-testing', description: '端到端测试 web 应用' })) === '开发工具',
    '测试技能 → 开发工具',
  );
  check(
    normalizeCategory(base('skill', { name: 'brand-guidelines', description: '品牌与设计规范守则' })) === '内容创作',
    '品牌规范 → 内容创作（技能侧）',
  );
  check(normalizeCategory(base('connector', { name: 'notion' })) === 'MCP 工具', '连接器一律归默认分类');
  check(
    normalizeCategory(base('expert', { name: '股票分析', description: 'A股市场投资研究' })) === '金融投资',
    '投资专家 → 金融投资',
  );
  check(
    normalizeCategory(base('skill', { name: 'excel 报表', description: '数据分析与可视化图表' })) === '数据分析',
    '数据分析技能 → 数据分析',
  );
  check(categoryList('expert').length === 15, '专家分类共 15 类');
  check(categoryList('skill').length === 12, '技能分类共 12 类');
  check(categoryList('connector').length === 1, '连接器目前单一分类');
}

// =====================================================================
console.log('\n[广场] 分类筛选在注册表层统一过滤（不下发源）');
{
  // 桩源：记录收到的 query.category，返回一个专家条目（原始分类 roleplay）。
  const seenCategories = [];
  const stubSource = {
    id: 'stub-experts',
    label: '桩源',
    kind: 'expert',
    installable: true,
    list: async (query) => {
      seenCategories.push(query.category);
      return {
        items: [
          {
            sourceId: 'stub-experts',
            kind: 'expert',
            id: 'roleplay-demo',
            name: '角色扮演 · 演示',
            description: '沉浸式角色扮演',
            tags: ['roleplay'],
            category: 'roleplay',
            install: { kind: 'expert' },
          },
        ],
        total: 1,
      };
    },
    item: async () => {
      throw new Error('not used');
    },
  };
  const fetcher = new CachedFetcher(ctx, paths, 1000);
  const registry = new SourceRegistry([stubSource], makeSourceCtx(ctx, config, paths, fetcher));

  // 选中标准分类「游戏空间」：category 不应下发给源（源内会按 roleplay 过滤失败）。
  const filtered = await registry.list({ kind: 'expert', category: '游戏空间' });
  check(seenCategories.every((value) => value === undefined), 'category 未下发给源');
  check(filtered.items.length === 1, '归一后按标准分类命中（roleplay → 游戏空间）');
  check(filtered.items[0].category === '游戏空间', '返回条目带归一分类');

  // 不选分类：全量返回且同样归一。
  const all = await registry.list({ kind: 'expert' });
  check(all.items.length === 1 && all.items[0].category === '游戏空间', '未选分类时全量归一返回');

  // 选一个归一后不存在的分类：结果为空。
  const none = await registry.list({ kind: 'expert', category: '法务安全' });
  check(none.items.length === 0, '归一后不匹配的分类返回空');
  // 展示计数（下载/收藏）也被补全（桩源走 rank/派生路径）。
  const stubItem = filtered.items[0];
  check(
    typeof stubItem.stats?.downloads === 'number' && stubItem.stats.downloads > 0,
    '卡片下载量已补全',
  );
  check(
    typeof stubItem.stats?.favorites === 'number' && stubItem.stats.favorites > 0,
    '卡片收藏量已补全',
  );
}

// =====================================================================
console.log('\n[广场] 展示计数（下载/收藏）派生稳定且单调');
{
  const make = (id, stats) => ({
    sourceId: 's', kind: 'skill', id, name: id, description: '', tags: [], stats, install: { kind: 'skill' },
  });
  // 稳定性：同一 id 两次调用结果一致。
  const once = displayStats(make('anthropics/skills::docx'));
  const twice = displayStats(make('anthropics/skills::docx'));
  check(once.downloads === twice.downloads && once.favorites === twice.favorites, '同 id 派生结果稳定');
  // rank 越靠前（数字越小）下载量越高。
  const hot = displayStats(make('a', { rank: 1 }), 32).downloads;
  const cold = displayStats(make('a', { rank: 32 }), 32).downloads;
  check(hot > cold, 'rank=1 比 rank=32 下载量高');
  // 真实上游 downloads 透传，favorites 仍按比例派生。
  const real = displayStats(make('b', { downloads: 1000 }));
  check(real.downloads === 1000, '上游真实下载量透传');
  check(real.favorites > 0 && real.favorites < 1000, '收藏量按下载量折算');
  // 收藏量低于下载量。
  const plain = displayStats(make('c'));
  check(plain.favorites < plain.downloads, '收藏量低于下载量');
  // stars 路径。
  const starred = displayStats(make('d', { stars: 5000 }));
  check(starred.downloads > 5000, '有 star 时下载量放大（下载通常高于 star）');
  check(typeof starred.favorites === 'number', 'star 路径收藏量也有值');
}

// =====================================================================
console.log('\n[广场] 多源扇出的复合游标（加载更多 / 跨页不重不漏）');
{
  /** 桩源：返回固定条数，且**不理会 limit**（与 GitHub / 社区目录 / dsh-market 同形态）。 */
  const makeSource = (id, count) => ({
    id,
    label: id,
    kind: 'expert',
    installable: true,
    calls: 0,
    async list() {
      this.calls += 1;
      return {
        items: Array.from({ length: count }, (_, index) => ({
          sourceId: id,
          kind: 'expert',
          id: `${id}-${String(index)}`,
          name: `${id}-${String(index)}`,
          description: '',
          tags: [],
          install: { kind: 'expert' },
        })),
        total: count,
      };
    },
    async item() {
      throw new Error('不需要');
    },
  });

  const sourceA = makeSource('src-a', 30);
  const sourceB = makeSource('src-b', 20);
  const registry = new SourceRegistry([sourceA, sourceB], stubCtx());

  const page1 = await registry.list({ kind: 'expert' });
  check(page1.items.length === 24, '第一页按 catalogPageSize 截断', String(page1.items.length));
  check(page1.total === 50, '顶栏总数 = 各源条目池之和（不受本页切片影响）', String(page1.total));
  check(typeof page1.nextCursor === 'string' && page1.nextCursor.startsWith('fo1:'), '第一页给出复合游标', page1.nextCursor);
  check(page1.items.every((item) => item.sourceId === 'src-a'), '顺序填槽：第一个源先填满本页');

  const page2 = await registry.list({ kind: 'expert', cursor: page1.nextCursor });
  check(page2.items.length === 24, '第二页同样满页', String(page2.items.length));
  check(page2.items[0].id === 'src-a-24', '第二页从第一个源的第 25 条接着读', page2.items[0].id);
  check(page2.items[5].id === 'src-a-29', '第一个源读完后接第二个源', page2.items[5].id);
  check(page2.items[6].id === 'src-b-0', '第二个源从第 1 条开始', page2.items[6].id);
  check(page2.total === 50, '总数跨页稳定', String(page2.total));

  const page3 = await registry.list({ kind: 'expert', cursor: page2.nextCursor });
  check(page3.items.length === 2, '最后一页只剩第二个源的尾巴', String(page3.items.length));
  check(page3.items.map((item) => item.id).join(',') === 'src-b-18,src-b-19', '最后一页内容正确', page3.items.map((item) => item.id).join(','));
  check(page3.nextCursor === undefined, '读完后不再下发游标（没有「加载更多」）');

  const seen = [...page1.items, ...page2.items, ...page3.items].map((item) => item.id);
  check(new Set(seen).size === 50, '三页并集恰好 50 条，跨页不重不漏', String(new Set(seen).size));
  check(seen.length === 50, '三页没有重复条目', String(seen.length));

  const dirty = await registry.list({ kind: 'expert', cursor: '不是游标' });
  check(dirty.items.length === 24 && dirty.items[0].id === 'src-a-0', '脏游标当第一页处理，不报错');
  const legacy = await registry.list({ kind: 'expert', cursor: 'com.pulsemcp/x:0.1.2' });
  check(legacy.items.length === 24 && legacy.items[0].id === 'src-a-0', '旧格式游标也退回第一页');

  const encoded = encodeFanoutCursor(new Map([['src-a', 30], ['src-b', 0]]));
  check(encoded === 'fo1:src-a=30', '只有 offset>0 的源写进游标', encoded);
  const parsed = parseFanoutCursor(encoded);
  check(parsed.get('src-a') === 30 && parsed.get('src-b') === undefined, '游标可往返');

  // 源失败时保留进度，不让整页挂掉
  const flaky = makeSource('src-c', 5);
  flaky.list = async () => {
    throw new Error('源挂了');
  };
  const mixed = new SourceRegistry([flaky, sourceB], stubCtx());
  const mixedPage = await mixed.list({ kind: 'expert' });
  check(mixedPage.items.length === 20, '单个源失败时其余源照常出结果', String(mixedPage.items.length));
  check(mixedPage.items[0].id === 'src-b-0', '失败源不占用条目槽');
}

await rm(tmp, { recursive: true, force: true });

console.log(`\n[square] catalog: ${String(checks - failures)}/${String(checks)} checks passed`);
if (failures > 0) {
  console.error(`[square] catalog FAILED (${String(failures)} failures)`);
  process.exit(1);
}
console.log('[square] catalog PASSED');
