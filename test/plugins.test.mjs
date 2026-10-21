/**
 * 插件页签（宿主侧）测试。
 *
 * 覆盖三块：
 *   A. 插件广场源（awesome-dsh-plugin 的 plugins.json）：归一化、安装规格解析、
 *      搜索/分类筛选、offset 分页、排序、上游分类表；
 *   B. profile 插件视图：listPlugins/listBundles 归一化、降级读清单、
 *      pendingBuilds、ChangeResult 归一化；
 *   C. 安装/卸载管线：走 pluginManager.installBundle / removeBundle，
 *      以及服务缺失时的明确报错。
 *
 * 网络与 pnpm 全部用桩顶掉：断言的是「远端 JSON → 面板形状 → 写操作调用」这条链路。
 *
 * 运行：node test/plugins.test.mjs（需先 pnpm build）
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CatalogInstaller, SourceRegistry } from '../build/catalog-install.js';
import { describeCapabilities, probeService, service } from '../build/capabilities.js';
import { categoryList, PLUGIN_CATEGORIES } from '../build/catalog-categories.js';
import { CatalogExporter, MySubmissionsSource, submissionsCatalogPath } from '../build/catalog-export.js';
import { AwesomeDshPluginsSource, catalogItemFromRaw, pluginSpecOf } from '../build/catalog-sources.js';
import { CachedFetcher, CatalogError } from '../build/catalog.js';
import { ConnectorsDomain } from '../build/connectors.js';
import { ExpertsDomain } from '../build/experts.js';
import {
  bundleErrorText,
  localizedText,
  markInstalledPlugins,
  normalizePluginsView,
  profileFromContext,
  profileLocation,
  readPendingBuilds,
  readProfileManifest,
  readProfilePlugins,
  toChangeResult,
  withProfileInstallCommand,
} from '../build/plugins.js';
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

/** 断言抛错并比对 code。 */
async function checkThrows(action, code, message) {
  try {
    await action();
    check(false, message, '没有抛错');
  } catch (error) {
    const actual = error instanceof CatalogError ? error.code : `not-catalog-error:${String(error)}`;
    check(actual === code, message, `code=${actual}`);
  }
}

const tmp = await mkdtemp(join(tmpdir(), 'square-plugins-'));
const ctx = { logger: { info() {}, warn() {}, debug() {} } };

/** 配置（只填源与安装器用到的字段）。 */
const config = {
  enablePlaza: true,
  skillsGithubRepos: [],
  githubTokenEnv: 'GITHUB_TOKEN',
  expertsMarketUrl: 'https://dsh-market.test',
  mcpRegistryUrl: 'https://registry.test/v0',
  pluginsCatalogUrl: 'https://awesome.test/plugins.json',
  customCatalogs: [],
  catalogTtlMs: 60000,
  catalogPageSize: 2,
  catalogParseLimit: 60,
  allowRemoteInstall: true,
  userSkillRoot: join(tmp, 'skills'),
  projectSkillDir: '.dsh/skills',
  projectAgentsSkillDir: '.agents/skills',
  customSkillDirs: [],
  maxSkillBytes: 65536,
  maxImportBytes: 5 * 1024 * 1024,
  redactSecrets: true,
  connectorTimeoutMs: 5000,
};
const paths = { dshHome: tmp, agentsHome: join(tmp, 'agents'), userSkillRoot: config.userSkillRoot };

/** 插件广场快照（结构照抄真实响应，条目为构造数据）。 */
const CATALOG = {
  name: 'awesome-dsh-plugin',
  updated: '2026-09-29',
  count: 4,
  categories: {
    agi: { en: 'AGI Architecture Exploration', zh: 'AGI 架构探索' },
    ui: { en: 'UI Enhancements', zh: 'UI 增强' },
    dev: { en: 'Development & Runtime', zh: '开发与运行时' },
  },
  plugins: [
    {
      name: 'dsh-j-space',
      owner: 'AnonyJcy',
      url: 'https://github.com/AnonyJcy/dsh-j-space',
      page: 'https://awesome-dsh-plugin.com/p/AnonyJcy/dsh-j-space/',
      category: 'agi',
      description: { en: 'Cognition suite', zh: '认知套件' },
      npm: '@anonyjcy/dsh-j-space',
      version: '1.2.2',
      stars: 3,
      downloads: 673,
      capabilities: ['fs-write', 'fs-read', 'env'],
      capabilityRedLines: ['shell'],
      install: 'dsh plugin --profile web add @anonyjcy/dsh-j-space',
      added: '2026-09-20',
    },
    {
      name: 'dsh-quality-review',
      owner: 'CAI-MH',
      url: 'https://github.com/CAI-MH/dsh-quality-review',
      page: 'https://awesome-dsh-plugin.com/p/CAI-MH/dsh-quality-review/',
      category: 'dev',
      description: { en: 'Review helper', zh: '评审助手' },
      version: null,
      stars: 40,
      downloads: 1200,
      install: 'dsh plugin --profile web add github:CAI-MH/dsh-quality-review',
      added: '2026-09-25',
    },
    {
      name: 'dsh-plugin-crypto-ticker',
      owner: 'ticker-dev',
      url: 'https://github.com/ticker-dev/dsh-plugin-crypto-ticker',
      page: 'https://awesome-dsh-plugin.com/p/ticker-dev/dsh-plugin-crypto-ticker/',
      category: 'ui',
      description: { en: 'Ticker', zh: '行情条' },
      version: null,
      stars: 7,
      downloads: 300,
      install:
        'dsh plugin --profile web add "https://github.com/ticker-dev/dsh-plugin-crypto-ticker/releases/download/v0.1.0/x.tgz"',
      added: '2026-09-28',
    },
    {
      name: 'dsh-no-install-field',
      owner: 'nobody',
      url: 'https://github.com/nobody/dsh-no-install-field',
      page: 'https://awesome-dsh-plugin.com/p/nobody/dsh-no-install-field/',
      category: 'dev',
      description: { en: 'Only repo', zh: '只有仓库' },
      stars: 1,
      downloads: 10,
      added: '2026-09-01',
    },
  ],
};

/** 桩 SourceCtx：plugins.json 由内存快照提供。 */
function stubCtx(payload = CATALOG) {
  return {
    config,
    paths,
    log: () => {},
    json: async () => payload,
    text: async () => '',
    bytes: async () => new Uint8Array(),
  };
}

const source = new AwesomeDshPluginsSource();

// ---------------------------------------------------------------------------
console.log('\n[A] 插件广场源');
// ---------------------------------------------------------------------------
{
  const page = await source.list({ kind: 'plugin', limit: 10 }, stubCtx());
  check(page.total === 4, 'total 是过滤后的总数', page.total);
  const first = page.items.find((item) => item.id === 'AnonyJcy/dsh-j-space');
  check(first !== undefined, '条目 id 是 owner/name');
  check(first?.name === 'dsh-j-space', 'name 原样透传', first?.name);
  check(first?.category === 'AGI 架构探索', '分类键翻成中文展示名', first?.category);
  check(first?.author === 'AnonyJcy', 'author 取 owner');
  check(
    first?.homepage === 'https://awesome-dsh-plugin.com/p/AnonyJcy/dsh-j-space/',
    'homepage 取 page 字段',
  );
  check(first?.repo === 'https://github.com/AnonyJcy/dsh-j-space', 'repo 取 url 字段');
  check(first?.description === '认知套件', '描述取 zh');
  check(first?.descriptionEn === 'Cognition suite', '描述保留 en');
  check(first?.stats?.downloads === 673, '真实下载量透传', first?.stats?.downloads);
  check(first?.stats?.stars === 3, '真实 star 透传', first?.stats?.stars);
  check(
    JSON.stringify(first?.trust?.capabilities) === JSON.stringify(['fs-write', 'fs-read', 'env']),
    '能力进 trust.capabilities',
  );
  check(
    JSON.stringify(first?.trust?.redLines) === JSON.stringify(['shell']),
    '红线进 trust.redLines',
  );
  check(
    first?.install.kind === 'plugin' && first.install.package === '@anonyjcy/dsh-j-space',
    'npm 条目：安装规格取包名',
    first?.install.kind === 'plugin' ? first.install.package : first?.install.kind,
  );
  check(
    first?.install.kind === 'plugin' && first.install.source === 'npm',
    'npm 条目：source=npm',
  );
  check(
    first?.install.kind === 'plugin' &&
      first.install.command === 'dsh plugin --profile web add @anonyjcy/dsh-j-space',
    '保留上游安装命令原文',
  );

  const gh = page.items.find((item) => item.id === 'CAI-MH/dsh-quality-review');
  check(
    gh?.install.kind === 'plugin' && gh.install.package === 'github:CAI-MH/dsh-quality-review',
    'github 条目：规格取 add 后面的 github:owner/repo',
  );
  check(gh?.install.kind === 'plugin' && gh.install.source === 'github', 'github 条目：source=github');
  check(gh?.version === undefined, '没有版本时不塞空版本');

  const tgz = page.items.find((item) => item.id === 'ticker-dev/dsh-plugin-crypto-ticker');
  check(
    tgz?.install.kind === 'plugin' && tgz.install.source === 'tarball',
    'tgz 条目：source=tarball',
  );
  check(
    tgz?.install.kind === 'plugin' && tgz.install.package.endsWith('.tgz'),
    'tgz 条目：规格是去掉引号的地址',
  );

  const fallback = page.items.find((item) => item.id === 'nobody/dsh-no-install-field');
  check(
    fallback?.install.kind === 'plugin' &&
      fallback.install.package === 'github:nobody/dsh-no-install-field',
    '既无 npm 又无可用 add 段：从仓库地址合成 github 规格',
  );

  const hot = await source.list({ kind: 'plugin', sort: 'hot', limit: 10 }, stubCtx());
  check(hot.items[0]?.id === 'CAI-MH/dsh-quality-review', 'hot 按下载量降序', hot.items[0]?.id);
  const fresh = await source.list({ kind: 'plugin', sort: 'new', limit: 10 }, stubCtx());
  check(fresh.items[0]?.id === 'ticker-dev/dsh-plugin-crypto-ticker', 'new 按 added 降序', fresh.items[0]?.id);

  const searched = await source.list({ kind: 'plugin', q: '认知', limit: 10 }, stubCtx());
  check(searched.total === 1 && searched.items[0]?.name === 'dsh-j-space', '搜索命中中文描述', searched.total);

  const filtered = await source.list({ kind: 'plugin', category: '开发与运行时', limit: 10 }, stubCtx());
  check(filtered.total === 2, '按分类筛选（含兜底合成条目）', filtered.total);

  // 分页：pageSize=2
  const p1 = await source.list({ kind: 'plugin', limit: 2 }, stubCtx());
  check(p1.items.length === 2, '第一页 2 条', p1.items.length);
  check(p1.nextCursor === '2', '第一页给出 offset 游标', p1.nextCursor);
  check(p1.total === 4, '分页时 total 仍是总数', p1.total);
  const p2 = await source.list({ kind: 'plugin', limit: 2, cursor: p1.nextCursor }, stubCtx());
  check(p2.items.length === 2, '第二页 2 条', p2.items.length);
  check(p2.nextCursor === undefined, '末页没有游标');
  check(
    p1.items[0]?.id !== p2.items[0]?.id,
    '两页内容不重复',
    `${p1.items[0]?.id} / ${p2.items[0]?.id}`,
  );

  const categories = await source.categories(stubCtx());
  check(
    JSON.stringify(categories) === JSON.stringify(['AGI 架构探索', 'UI 增强', '开发与运行时']),
    '分类表来自 upstream，保持声明顺序且用中文',
    JSON.stringify(categories),
  );

  const detail = await source.item('AnonyJcy/dsh-j-space', stubCtx());
  check(detail.item.id === 'AnonyJcy/dsh-j-space', 'item() 命中条目');
  check(detail.plugin?.['npm'] === '@anonyjcy/dsh-j-space', 'item() 带回原始条目');
  await checkThrows(
    () => source.item('nobody/does-not-exist', stubCtx()),
    'not-found',
    'item() 未命中报 not-found',
  );

  check(
    pluginSpecOf({ npm: 'x', install: 'dsh plugin add other' })?.spec === 'x',
    'npm 优先于 install 命令',
  );
  check(pluginSpecOf({ url: 'https://gitlab.com/a/b' }) === undefined, '非 GitHub 仓库无法合成规格');
}

// ---------------------------------------------------------------------------
console.log('\n[B] 注册表：源自带分类');
// ---------------------------------------------------------------------------
{
  const registry = new SourceRegistry([source], stubCtx());
  const categories = await registry.categories('plugin');
  check(categories.length === 3, '注册表用源自己的分类表', categories.length);

  const broken = new SourceRegistry(
    [new (class extends AwesomeDshPluginsSource {})()],
    {
      ...stubCtx(),
      json: async () => {
        throw new Error('offline');
      },
    },
  );
  const fallback = await broken.categories('plugin');
  check(
    JSON.stringify(fallback) === JSON.stringify(categoryList('plugin')),
    '上游拉不到时退回静态分类表',
    fallback.length,
  );
  check(
    JSON.stringify(categoryList('plugin')) === JSON.stringify(PLUGIN_CATEGORIES),
    'categoryList(plugin) 就是静态兜底表',
  );

  // 单源扇出：保留游标（多源扇出没有跨源游标）
  const page = await registry.list({ kind: 'plugin', limit: 2 });
  check(page.nextCursor === '2', '单源扇出保留源的游标', page.nextCursor);
  check(page.items.length === 2, '单源扇出不截断', page.items.length);
  check(page.total === 4, '单源扇出透传总数', page.total);

  // 回归：分页源 + 一次性源（自建目录 / 我的提交）混在一起时，不能按「每源均分」
  // 把大目录切碎——插件广场曾因此在面板上只显示 24/3=8 条，且丢掉游标。
  const extras = {
    id: 'my-submissions',
    label: '我的提交',
    kind: 'all',
    installable: true,
    list: async () => ({
      items: [
        {
          sourceId: 'my-submissions',
          kind: 'plugin',
          id: 'me/local-plugin',
          name: '本地提交的插件',
          description: '',
          tags: [],
          install: { kind: 'plugin', package: 'local-plugin' },
        },
      ],
      total: 1,
    }),
    item: async () => {
      throw new Error('测试不调用 item()');
    },
  };
  const mixed = new SourceRegistry([source, extras], stubCtx());
  const page1 = await mixed.list({ kind: 'plugin', limit: 3 });
  check(page1.items.length === 3, '混入一次性源仍按 limit 取分页源（回归 24/3=8）', page1.items.length);
  check(page1.items[0]?.id === 'me/local-plugin', '本地提交排在第一页最前', page1.items[0]?.id);
  check(page1.nextCursor === '2', '游标仍是分页源的 offset', page1.nextCursor);
  check(page1.total === 5, 'total = 分页源总数 + 本地条目数', page1.total);
  const page2 = await mixed.list({ kind: 'plugin', limit: 3, cursor: page1.nextCursor });
  check(
    page2.items.some((item) => item.id === 'me/local-plugin') === false,
    '翻页不再重复本地条目',
  );
  check(page2.items.length === 2, '第二页拿到剩余条目', page2.items.length);
  check(page2.nextCursor === undefined, '最后一页没有游标', page2.nextCursor);

  // 一次性源自己撑满一页时，也要给分页源留至少 1 条（游标才能推进）。
  const bulky = {
    ...extras,
    list: async () => ({
      items: Array.from({ length: 10 }, (_unused, index) => ({
        sourceId: 'my-submissions',
        kind: 'plugin',
        id: `me/bulk-${String(index)}`,
        name: `批量 ${String(index)}`,
        description: '',
        tags: [],
        install: { kind: 'plugin', package: `bulk-${String(index)}` },
      })),
      total: 10,
    }),
  };
  const crowded = new SourceRegistry([source, bulky], stubCtx());
  const crowdedPage = await crowded.list({ kind: 'plugin', limit: 3 });
  check(crowdedPage.items.length === 3, '本地条目撑满时仍截到 limit', crowdedPage.items.length);
  check(
    crowdedPage.items.some((item) => item.install.kind === 'plugin' && item.install.package.startsWith('@')),
    '仍然给分页源留了位置',
    crowdedPage.items.map((item) => item.id).join(','),
  );
  check(crowdedPage.nextCursor === '1', '分页源游标仍在推进', crowdedPage.nextCursor);
}

// ---------------------------------------------------------------------------
console.log('\n[C] profile 插件视图归一化');
// ---------------------------------------------------------------------------
{
  check(localizedText('x') === 'x', 'localizedText：字符串原样');
  check(localizedText({ en: 'E', zh: '中' }) === '中', 'localizedText：中文优先');
  check(localizedText({ en: 'E' }) === 'E', 'localizedText：退回英文');
  check(localizedText(undefined, 'fallback') === 'fallback', 'localizedText：兜底');
  check(bundleErrorText('boom') === 'boom', 'bundleErrorText：字符串');
  check(
    bundleErrorText({ code: 'not-bundle', diagnostic: 'no patch' }) === 'not-bundle: no patch',
    'bundleErrorText：code + diagnostic',
  );
  check(bundleErrorText(undefined) === undefined, 'bundleErrorText：空');

  const { bundles, rows } = normalizePluginsView(
    [
      {
        entryId: 'entry-1',
        moduleName: 'dsh-squares',
        meta: { title: { zh: 'Square', en: 'Square' }, description: { zh: '一体化工作台' } },
        enabled: true,
        fiberPhase: 'active',
        patchId: 'square',
      },
      {
        entryId: 'entry-2',
        moduleName: '@deepseek-ai/dsh-host-webserver',
        enabled: false,
        fiberPhase: 'pending',
        readOnlyReason: 'management-required',
      },
    ],
    [
      {
        name: 'dsh-squares',
        version: '0.1.0',
        description: 'raw description',
        enabled: true,
        installed: true,
        removable: true,
        rows: [{ rowId: 'square', moduleName: 'dsh-squares', entryId: 'entry-1' }],
        overrides: [],
      },
      {
        name: '@deepseek-ai/dsh-base',
        enabled: false,
        installed: true,
        optional: true,
        removable: false,
        readOnlyReason: 'management-required',
        error: { code: 'not-bundle' },
        rows: [],
      },
    ],
  );
  check(rows.length === 2, '行全部保留', rows.length);
  check(rows[0]?.bundle === 'dsh-squares', '行反查到所属 bundle', rows[0]?.bundle);
  check(rows[0]?.title === 'Square', '行标题取本地化 meta.title');
  check(rows[0]?.patchId === 'square', '行保留可写的 patchId');
  check(rows[1]?.bundle === undefined, '无主的行不挂 bundle');
  check(rows[1]?.readOnlyReason === 'management-required', '只读原因透传');
  check(bundles[0]?.title === undefined, 'bundle 无标题时不塞空字段');
  check(bundles[0]?.description === 'raw description', 'bundle 描述退回 description 字段');
  check(bundles[1]?.optional === true && bundles[1]?.removable === false, 'bundle 的 optional/removable');
  check(bundles[1]?.error === 'not-bundle', 'bundle 错误压成一行');
  // 行的键优先用运行期 entry id（客户端拿它去 listPlugins 里找行）；
  // 宿主没给 entryId 时才退回 patch 行 id。
  check(bundles[0]?.rows[0] === 'entry-1', 'bundle 行用 entryId（宿主给了就用它）');
  const fallbackRow = normalizePluginsView([], [
    {
      name: 'x',
      enabled: true,
      installed: true,
      rows: [{ rowId: 'only-row', moduleName: 'x' }],
    },
  ]);
  check(fallbackRow.bundles[0]?.rows[0] === 'only-row', '没有 entryId 时退回 rowId');
  check(toChangeResult({ changed: true, application: 'applied', target: 'x' }, 'y').application === 'applied', 'ChangeResult：applied');
  const failedChange = toChangeResult(
    { changed: false, application: 'failed', target: 'x', error: { code: 'incompatible-version' }, pendingBuilds: ['esbuild'] },
    'y',
  );
  check(failedChange.error === 'incompatible-version', 'ChangeResult：错误压成文本');
  check(failedChange.pendingBuilds?.[0] === 'esbuild', 'ChangeResult：pendingBuilds 透传');
  check(
    toChangeResult({}, 'fallback').target === 'fallback',
    'ChangeResult：缺 target 时用兜底',
  );

  // 「我的插件」只列自己装的：以 profile 清单的 dependencies 为准。
  const marked = markInstalledPlugins(bundles, {
    dependencies: { 'dsh-squares': 'link:/tmp/square' },
    bundles: ['@deepseek-ai/dsh-base', 'dsh-squares'],
  });
  check(
    marked.find((bundle) => bundle.name === 'dsh-squares')?.mine === true,
    '依赖命中的 bundle 标 mine=true',
  );
  check(
    marked.find((bundle) => bundle.name === 'dsh-squares')?.spec === 'link:/tmp/square',
    '带上安装规格（依赖值）',
  );
  check(
    marked.find((bundle) => bundle.name === '@deepseek-ai/dsh-base')?.mine === false,
    'App 自带的 bundle 不标 mine',
  );
  // 已安装但被取消选中的依赖不会出现在 listBundles 里 → 从清单补一行，别让它消失。
  const restored = markInstalledPlugins([], {
    dependencies: { 'dsh-neo-skin': 'github:0nt-one/dsh-neo-skin' },
    bundles: ['dsh-neo-skin'],
  });
  check(
    restored.length === 1 && restored[0]?.name === 'dsh-neo-skin' && restored[0]?.mine === true,
    '列表里缺失的依赖补一行',
    JSON.stringify(restored),
  );
  check(restored[0]?.enabled === true && restored[0]?.installed === true, '补的行的启用/安装状态');
  check(restored[0]?.spec === 'github:0nt-one/dsh-neo-skin', '补的行带安装规格');
}

// ---------------------------------------------------------------------------
console.log('\n[D] 降级：直接读 profile 清单');
// ---------------------------------------------------------------------------
{
  const profileDir = join(tmp, 'profiles', 'desktop');
  await mkdir(profileDir, { recursive: true });
  await writeFile(
    join(profileDir, 'package.json'),
    JSON.stringify({
      name: 'dsh-profile-desktop',
      dependencies: { 'dsh-squares': 'link:/tmp/square' },
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', 'dsh-squares'] } },
    }),
  );
  const rows = await readProfilePlugins(profileDir);
  check(rows.length === 2, '清单里的依赖与选中 bundle 都列出', rows.length);
  const square = rows.find((row) => row.name === 'dsh-squares');
  check(square?.enabled === true && square?.installed === true, 'link 依赖：已安装且已选中');
  check(square?.mine === true && square?.spec === 'link:/tmp/square', '依赖行标 mine 并带规格');
  const base = rows.find((row) => row.name === '@deepseek-ai/dsh-base');
  check(base?.installed === false && base?.enabled === true, '随安装自带的 bundle：选中但不在依赖里');
  check(base?.mine === undefined, '自带 bundle 不标 mine');
  check((await readProfilePlugins(join(tmp, 'nope')))?.length === 0, '读不到清单时返回空数组');

  const manifest = await readProfileManifest(profileDir);
  check(manifest.dependencies['dsh-squares'] === 'link:/tmp/square', '清单读到依赖规格');
  check(manifest.bundles.length === 2, '清单读到选中的 bundle', manifest.bundles.length);
  check(
    (await readProfileManifest(join(tmp, 'nope'))).bundles.length === 0,
    '读不到清单时返回空清单',
  );

  await mkdir(join(profileDir, 'node_modules'), { recursive: true });
  await writeFile(
    join(profileDir, 'node_modules', '.modules.yaml'),
    ['hoistPattern:', '  - "*"', 'pendingBuilds:', '  - esbuild', '  - sharp', ''].join('\n'),
  );
  const pending = await readPendingBuilds(profileDir);
  check(JSON.stringify(pending) === JSON.stringify(['esbuild', 'sharp']), 'pendingBuilds 从 .modules.yaml 读出', JSON.stringify(pending));
  check((await readPendingBuilds(join(tmp, 'nope')))?.length === 0, '没有 .modules.yaml 时返回空数组');
}

// ---------------------------------------------------------------------------
console.log('\n[E] 安装 / 卸载（pluginManager）');
// ---------------------------------------------------------------------------
{
  /** 桩源：直接给出一个插件条目。 */
  const stubSource = {
    id: 'plugins-awesome',
    label: 'stub',
    kind: 'plugin',
    installable: true,
    list: async () => ({ items: [] }),
    item: async (id) => ({
      item: {
        sourceId: 'plugins-awesome',
        kind: 'plugin',
        id,
        name: 'dsh-j-space',
        description: '认知套件',
        repo: 'https://github.com/AnonyJcy/dsh-j-space',
        version: '1.2.2',
        tags: [],
        install: {
          kind: 'plugin',
          package: '@anonyjcy/dsh-j-space',
          version: '1.2.2',
          source: 'npm',
          command: 'dsh plugin --profile web add @anonyjcy/dsh-j-space',
        },
      },
    }),
  };

  /** 构造安装器。 */
  async function makeInstaller(manager) {
    const store = await DeckStore.open(ctx);
    const registry = new SourceRegistry([stubSource], stubCtx());
    const fetcher = new CachedFetcher(ctx, paths, 60000);
    const installer = new CatalogInstaller({
      ctx,
      config,
      paths,
      store,
      skills: new SkillsDomain(ctx, config, paths, {}),
      experts: new ExpertsDomain(ctx, config, store, {}, { list: () => [] }),
      connectors: new ConnectorsDomain(ctx, config, paths, {}),
      registry,
      fetcher,
      connectorsChanged: async () => {},
      pluginManager: () => manager,
    });
    return { installer, store };
  }

  const calls = [];
  const manager = {
    listPlugins: async () => [],
    listBundles: async () => [],
    setPluginEnabled: async () => ({ changed: true, application: 'applied' }),
    setBundleEnabled: async () => ({ changed: true, application: 'applied' }),
    installBundle: async (spec, options) => {
      calls.push({ spec, options });
      return { changed: true, application: 'restart-required', target: spec, bundle: spec, pendingBuilds: ['esbuild'] };
    },
    removeBundle: async (name) => {
      calls.push({ remove: name });
      return { changed: true, application: 'applied', target: name };
    },
  };

  const { installer, store } = await makeInstaller(manager);
  const outcome = await installer.install('plugins-awesome', 'AnonyJcy/dsh-j-space');
  check(outcome.kind === 'plugin', '安装结果 kind=plugin', outcome.kind);
  check(outcome.key === 'plugin:@anonyjcy/dsh-j-space', '安装键是 plugin:<包名>', outcome.key);
  check(outcome.id === '@anonyjcy/dsh-j-space', '安装 id 是包名', outcome.id);
  check(calls[0]?.spec === '@anonyjcy/dsh-j-space', '调用 installBundle 的是包名', calls[0]?.spec);
  check(calls[0]?.options?.enabled === true, '安装默认选中该 bundle');
  check(
    outcome.warnings.some((text) => text.includes('重启')),
    'restart-required 会转成警告',
    outcome.warnings.join('；'),
  );
  check(
    outcome.warnings.some((text) => text.includes('esbuild')),
    'pendingBuilds 会转成警告',
    outcome.warnings.join('；'),
  );
  const record = store.getInstalled('plugin:@anonyjcy/dsh-j-space');
  check(record?.kind === 'plugin' && record.itemId === 'AnonyJcy/dsh-j-space', '写入了溯源记录');
  check(record?.meta?.['package'] === '@anonyjcy/dsh-j-space', '溯源记录里带包名');

  await installer.uninstall('plugin', 'plugin:@anonyjcy/dsh-j-space');
  check(calls[1]?.remove === '@anonyjcy/dsh-j-space', '卸载调用 removeBundle(包名)', calls[1]?.remove);
  check(store.getInstalled('plugin:@anonyjcy/dsh-j-space') === undefined, '卸载后删除溯源记录');

  // 没有溯源记录（Square 之外装的）也能卸载
  await installer.uninstall('plugin', 'plugin:some-other-plugin');
  check(calls[2]?.remove === 'some-other-plugin', '无溯源记录时按 key 里的包名卸载', calls[2]?.remove);

  // 失败结果
  const failing = {
    ...manager,
    installBundle: async () => ({
      changed: false,
      application: 'failed',
      target: 'x',
      error: { code: 'incompatible-version', diagnostic: 'peer @deepseek-ai/dsh offline' },
    }),
  };
  const { installer: failingInstaller } = await makeInstaller(failing);
  await checkThrows(
    () => failingInstaller.install('plugins-awesome', 'AnonyJcy/dsh-j-space'),
    'install-failed',
    'application=failed 时抛出 install-failed',
  );

  // 服务缺失
  const { installer: noManager } = await makeInstaller(undefined);
  await checkThrows(
    () => noManager.install('plugins-awesome', 'AnonyJcy/dsh-j-space'),
    'plugin-manager-unavailable',
    '没有 pluginManager 时抛出明确错误',
  );
  await checkThrows(
    () => noManager.uninstall('plugin', 'plugin:x'),
    'plugin-manager-unavailable',
    '卸载同样要求 pluginManager',
  );

  // 安装开关
  const { installer: blocked } = await makeInstaller(manager);
  const strictConfig = { ...config, allowRemoteInstall: false };
  const blockedInstaller = new CatalogInstaller({
    ctx,
    config: strictConfig,
    paths,
    store: await DeckStore.open(ctx),
    skills: new SkillsDomain(ctx, strictConfig, paths, {}),
    experts: new ExpertsDomain(ctx, strictConfig, await DeckStore.open(ctx), {}, { list: () => [] }),
    connectors: new ConnectorsDomain(ctx, strictConfig, paths, {}),
    registry: new SourceRegistry([stubSource], stubCtx()),
    fetcher: new CachedFetcher(ctx, paths, 60000),
    connectorsChanged: async () => {},
    pluginManager: () => manager,
  });
  await checkThrows(
    () => blockedInstaller.install('plugins-awesome', 'AnonyJcy/dsh-j-space'),
    'install-disabled',
    'allowRemoteInstall=false 时拒绝安装',
  );
  void blocked;
}

// ---------------------------------------------------------------------------
console.log('\n[F] profile 位置解析');
// ---------------------------------------------------------------------------
{
  const saved = {
    dir: process.env.DSH_PROFILE_DIR,
    name: process.env.DSH_PROFILE,
    home: process.env.DSH_HOME,
  };
  process.env.DSH_PROFILE_DIR = '/tmp/x/profiles/desktop';
  process.env.DSH_PROFILE = 'desktop';
  delete process.env.DSH_HOME;
  const location = profileLocation();
  check(location.name === 'desktop' && location.dir === '/tmp/x/profiles/desktop', 'DSH_PROFILE_DIR 优先');
  delete process.env.DSH_PROFILE_DIR;
  process.env.DSH_HOME = '/tmp/x';
  check(profileLocation().dir === join('/tmp/x', 'profiles', 'desktop'), '退回 DSH_HOME/profiles/<name>');

  // 首选来源是宿主的 profileContext：桌面端宿主进程里没有 DSH_PROFILE*，
  // 只认环境变量会解析出空目录，「我的插件」因此整页空掉（实机踩过）。
  const ctxProfile = {
    get: (name) =>
      name === 'profileContext' ? { name: 'desktop', dir: '/Users/me/.dsh/profiles/desktop' } : undefined,
  };
  check(
    profileFromContext(ctxProfile)?.dir === '/Users/me/.dsh/profiles/desktop',
    'profileContext 优先于环境变量',
  );
  check(
    profileFromContext({ get: () => undefined }) === undefined,
    '没有 profileContext 时返回 undefined（由调用方退回环境变量）',
  );
  check(profileFromContext({ get: () => ({ dir: '' }) }) === undefined, 'dir 为空视为不可用');
  check(
    profileFromContext({ get: () => ({ dir: '/Users/me/.dsh/profiles/web' }) })?.name === 'web',
    'name 缺失时从目录名推',
  );
  for (const [key, value] of [
    ['DSH_PROFILE_DIR', saved.dir],
    ['DSH_PROFILE', saved.name],
    ['DSH_HOME', saved.home],
  ]) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

// ---------------------------------------------------------------------------
console.log('\n[G] 提交插件（广场「我的提交」源）');
// ---------------------------------------------------------------------------
{
  // 1) square-catalog/1 的插件条目 → CatalogItem
  const raw = {
    id: 'dshmarket',
    kind: 'plugin',
    name: '插件市场',
    description: '安装/启停 profile 插件',
    package: 'dshmarket',
    packageVersion: '1.66.6',
    specSource: 'npm',
    tags: ['market'],
    capabilities: ['network'],
  };
  const item = catalogItemFromRaw(raw, 'custom-catalog');
  check(item?.kind === 'plugin', '目录里的插件条目能归一', item?.kind);
  check(
    item?.install.kind === 'plugin' && item.install.package === 'dshmarket',
    '安装规格取 package 字段',
    item?.install.kind === 'plugin' ? item.install.package : item?.install.kind,
  );
  check(
    item?.install.kind === 'plugin' && item.install.version === '1.66.6',
    '包版本优先于提交时间',
    item?.install.kind === 'plugin' ? item.install.version : '',
  );
  check(
    item?.install.kind === 'plugin' && item.install.source === 'npm',
    '来源用显式声明',
  );
  check(item?.version === '1.66.6', '条目 version 也是包版本');

  const github = catalogItemFromRaw(
    { id: 'x', kind: 'plugin', name: 'x', package: 'github:o/r' },
    'custom-catalog',
  );
  check(
    github?.install.kind === 'plugin' && github.install.source === 'github',
    'github 规格按形态推断',
    github?.install.kind === 'plugin' ? github.install.source : '',
  );
  const tarball = catalogItemFromRaw(
    { id: 'y', kind: 'plugin', name: 'y', package: 'https://example.com/y.tgz' },
    'custom-catalog',
  );
  check(
    tarball?.install.kind === 'plugin' && tarball.install.source === 'tarball',
    'https 地址推断为 tarball',
    tarball?.install.kind === 'plugin' ? tarball.install.source : '',
  );
  const noPackage = catalogItemFromRaw({ id: 'z', kind: 'plugin', name: 'z' }, 'custom-catalog');
  check(
    noPackage?.install.kind === 'plugin' && noPackage.install.package === 'z',
    '没有 package 字段时退回 id',
  );

  // 2) 导出器：本地已安装插件 → 提交条目
  const dshHome = join(tmp, 'submit-home');
  const submitPaths = { dshHome, agentsHome: join(tmp, 'agents'), userSkillRoot: join(dshHome, 'skills') };
  const exporter = new CatalogExporter(
    ctx,
    config,
    submitPaths,
    new SkillsDomain(ctx, config, submitPaths, {}),
    new ConnectorsDomain(ctx, config, submitPaths, {}),
    () => undefined,
    () => undefined,
    async (name) =>
      name === 'dshmarket'
        ? {
            spec: 'dshmarket',
            source: /** @type {const} */ ('npm'),
            version: '1.66.6',
            title: '插件市场',
            description: '安装/启停 profile 插件',
          }
        : undefined,
  );
  const outcome = await exporter.submit({
    kind: 'plugin',
    id: 'dshmarket',
    name: '插件市场（我的提交）',
    tags: ['market'],
  });
  check(outcome.item['kind'] === 'plugin', '提交结果的 kind=plugin');
  check(outcome.item['package'] === 'dshmarket', '提交结果带安装规格', outcome.item['package']);
  check(outcome.item['version'] === '1.66.6', '提交不覆盖包版本', outcome.item['version']);
  check(
    outcome.item['specSource'] === 'npm',
    '提交结果带规格来源',
    outcome.item['specSource'],
  );
  check(
    outcome.hints.some((line) => line.includes('安装规格')),
    '插件提交给出说明',
    outcome.hints.join('；'),
  );
  // 导出器按既有约定抛 HttpError（专家/连接器同理），这里只校验 code。
  try {
    await exporter.submit({ kind: 'plugin', id: 'not-installed' });
    check(false, '未安装的插件包不能提交', '没有抛错');
  } catch (error) {
    check(error?.code === 'plugin-not-found', '未安装的插件包不能提交', `code=${String(error?.code)}`);
  }

  // 3) 提交后立刻能从「我的提交」源读到，并且可安装
  const source = new MySubmissionsSource(submissionsCatalogPath(submitPaths));
  const page = await source.list({ kind: 'plugin' }, stubCtx());
  check(page.items.length === 1, '「我的提交」源里出现该插件', page.items.length);
  check(page.items[0]?.name === '插件市场（我的提交）', '展示名用提交时的覆盖值', page.items[0]?.name);
  check(
    page.items[0]?.install.kind === 'plugin' && page.items[0].install.package === 'dshmarket',
    '广场条目带可安装规格',
  );
  const detail = await source.item('dshmarket', stubCtx());
  check(detail.item.kind === 'plugin', '详情接口能取到该条目');
}

// ---------------------------------------------------------------------------
console.log('\n[H] 服务取值回退（Cordis 严格 get）');
// ---------------------------------------------------------------------------
{
  const provided = { listPlugins: async () => [] };
  // 只在非严格取值下可见（提供方 fiber 未 active 的实机情形）。
  const laxCtx = { get: (_name, strict) => (strict === false ? provided : undefined) };
  check(service(laxCtx, 'pluginManager') === provided, '严格取不到时退回非严格取值');
  check(
    probeService(laxCtx, 'pluginManager') === 'non-strict',
    '诊断报 non-strict',
    probeService(laxCtx, 'pluginManager'),
  );

  const strictCtx = { get: () => provided };
  check(probeService(strictCtx, 'pluginManager') === 'strict', '诊断报 strict');
  check(service(strictCtx, 'pluginManager') === provided, '严格可见时直接用');

  const emptyCtx = {
    get: () => {
      throw new Error('service not found');
    },
  };
  check(service(emptyCtx, 'pluginManager') === undefined, '两边都拿不到时返回 undefined（不抛错）');
  check(probeService(emptyCtx, 'pluginManager') === 'absent', '诊断报 absent');

  const nullCtx = { get: () => null };
  check(service(nullCtx, 'pluginManager') === undefined, 'null 视为不可用');
  check(probeService(nullCtx, 'pluginManager') === 'absent', 'null 诊断报 absent');

  // 能力位：入参传了就绝不能报「不可用」（曾经漏传字段导致误报降级说明）。
  const withManager = describeCapabilities({
    skills: {},
    pluginManager: { listPlugins: async () => [] },
    mcpClient: true,
  });
  check(withManager.flags.pluginManager === true, '能力位：传了 pluginManager 就是 true');
  check(
    withManager.notes.some((note) => note.includes('pluginManager')) === false,
    '传了 pluginManager 就不产生降级说明',
    withManager.notes.join('；'),
  );
  const withoutManager = describeCapabilities({ mcpClient: true });
  check(withoutManager.flags.pluginManager === false, '能力位：没传就是 false');
  check(
    withoutManager.notes.some((note) => note.includes('pluginManager')),
    '没传时给出降级说明',
  );
}

// ---------------------------------------------------------------------------
console.log('\n[I] 安装命令按当前环境生成（不照抄上游的 --profile web）');
// ---------------------------------------------------------------------------
{
  const item = {
    sourceId: 'plugins-awesome',
    kind: 'plugin',
    id: 'AnonyJcy/dsh-j-space',
    name: 'dsh-j-space',
    description: '',
    tags: [],
    install: {
      kind: 'plugin',
      package: '@anonyjcy/dsh-j-space',
      version: '1.2.2',
      source: 'npm',
      command: 'dsh plugin --profile web add @anonyjcy/dsh-j-space',
    },
  };
  const desktop = withProfileInstallCommand(item, 'desktop');
  check(
    desktop.install.kind === 'plugin' &&
      desktop.install.command === 'dsh plugin --profile desktop add @anonyjcy/dsh-j-space',
    '桌面端：命令按当前 profile 生成',
    desktop.install.kind === 'plugin' ? desktop.install.command : '',
  );
  check(
    desktop.install.kind === 'plugin' &&
      desktop.install.upstreamCommand === 'dsh plugin --profile web add @anonyjcy/dsh-j-space',
    '上游命令降级为「仅供参考」',
  );
  check(
    desktop.install.kind === 'plugin' && desktop.install.profile === 'desktop' && desktop.install.managed === true,
    '桌面端标 managed=true（CLI 会拒绝）',
  );
  check(
    desktop.install.kind === 'plugin' &&
      desktop.install.package === '@anonyjcy/dsh-j-space' &&
      desktop.install.source === 'npm',
    '其余安装字段原样保留',
  );

  const web = withProfileInstallCommand(item, 'web');
  check(
    web.install.kind === 'plugin' &&
      web.install.command === 'dsh plugin --profile web add @anonyjcy/dsh-j-space',
    'web 端命令与上游一致',
  );
  check(
    web.install.kind === 'plugin' && web.install.upstreamCommand === undefined,
    '与上游一致时不重复展示上游命令',
  );
  check(web.install.kind === 'plugin' && web.install.managed === false, 'web 端不标 managed');

  const unknown = withProfileInstallCommand(item, '');
  check(
    unknown.install.kind === 'plugin' &&
      unknown.install.command === 'dsh plugin --profile <profile> add @anonyjcy/dsh-j-space',
    'profile 未知时给占位符',
    unknown.install.kind === 'plugin' ? unknown.install.command : '',
  );

  const skillItem = {
    sourceId: 'skills-github',
    kind: 'skill',
    id: 'a/b::c',
    name: 'c',
    description: '',
    tags: [],
    install: { kind: 'skill', fileCount: 1 },
  };
  check(withProfileInstallCommand(skillItem, 'desktop') === skillItem, '非插件条目原样返回（不改引用）');
}

await rm(tmp, { recursive: true, force: true });

console.log(`\n[square] plugins: ${String(checks - failures)}/${String(checks)} checks passed`);
if (failures > 0) {
  console.error(`[square] plugins FAILED (${String(failures)} failures)`);
  process.exit(1);
}
console.log('[square] plugins PASSED');
