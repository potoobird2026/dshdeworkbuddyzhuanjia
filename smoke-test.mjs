/**
 * Square 冒烟测试（宿主半）。
 *
 * 覆盖：
 *   A. 真实 Cordis 生命周期：挂载 → 注册路由/工具 → 卸载回滚；
 *   B. HTTP 路由手感：绕过网络，直接用假 req/res 调 handler（含栅栏/方法/超大 body）；
 *   C. frontmatter 解析与改写（保留未知键、块标量、布尔别名）；
 *   D. 技能域文件操作（临时目录：新建 / 读 / 启停 / 编辑 / 删除到回收站）；
 *   E. 存储域声明能被真实 defineDomain/domainTable 接受；
 *   F. 连接器校验与 mcp-client 配置整形（含脱敏占位符回填）；
 *   G. 专家组合生成（不含 !!js、平台分支、绑定连接器行）。
 *
 * 运行：node smoke-test.mjs（需先 pnpm build）
 */

import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain';
import { REDACTED, normalizeConnector, mcpClientConfig } from './build/connectors.js';
import { composeRows } from './build/experts.js';
import { parseBoolean, parseFrontmatter } from './build/frontmatter.js';
import * as plugin from './build/index.js';
import { SkillsDomain } from './build/skills.js';
import { deckDomainSpec } from './build/store.js';

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

/** 等待条件成立（异步装配用）。 */
async function waitFor(predicate, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await predicate();
    if (value) return value;
    if (Date.now() > deadline) return undefined;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/** 假响应对象。 */
function fakeResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      this.body = body ?? '';
    },
  };
}

/** 假请求对象。 */
function fakeRequest({ method = 'GET', url = '/', body, headers = {} } = {}) {
  const payload = body === undefined ? [] : [Buffer.from(JSON.stringify(body), 'utf8')];
  return {
    method,
    url,
    headers: { host: '127.0.0.1:12345', ...headers },
    socket: { remoteAddress: '127.0.0.1' },
    async *[Symbol.asyncIterator]() {
      for (const chunk of payload) yield chunk;
    },
    resume() {},
  };
}

const tmp = await mkdtemp(join(tmpdir(), 'square-smoke-'));
const skillRoot = join(tmp, 'skills');

// =====================================================================
// A. 真实 Cordis 生命周期
// =====================================================================
console.log('\n[A] Cordis 生命周期：挂载 / 注册 / 卸载回滚');
{
  const routes = new Map();
  const tools = new Map();
  const ctx = new Context();
  ctx.provide('tools', {
    register(definition) {
      tools.set(definition.name, definition);
      return () => tools.delete(definition.name);
    },
    schemas: () => [...tools.values()].map((definition) => ({ name: definition.name })),
  });
  ctx.provide('webServer', {
    register(route) {
      routes.set(route.path, route);
      return () => routes.delete(route.path);
    },
  });

  const fiber = ctx.plugin(plugin, {
    enableUi: true,
    enableSkills: true,
    enableExperts: true,
    enableConnectors: true,
    enableTool: true,
    panelId: 'square',
    routePrefix: '/api/dsh-squares',
    dshHome: tmp,
    agentsHome: join(tmp, 'agents'),
    customSkillDirs: [],
    projectSkillDir: '.dsh/skills',
    projectAgentsSkillDir: '.agents/skills',
    userSkillRoot: skillRoot,
    maxBodyBytes: 4096,
    maxSkillBytes: 65536,
    connectorTimeoutMs: 5000,
    redactSecrets: true,
  });
  await fiber;

  const ready = await waitFor(() => routes.size > 0 && tools.size > 0);
  check(ready !== undefined, `路由与工具已注册（routes=${String(routes.size)}, tools=${String(tools.size)}）`);
  check(routes.has('/api/dsh-squares/skills'), '注册了 /skills 路由');
  check(routes.has('/api/dsh-squares/capabilities'), '注册了 /capabilities 路由');
  check(routes.has('/api/dsh-squares/skills/import'), '注册了 /skills/import 路由（上传技能）');
  check(routes.has('/api/dsh-squares/skills/creator-prompt'), '注册了 /skills/creator-prompt 路由（AI 创建）');
  check(tools.has('square_status'), '注册了 square_status 工具');
  {
    // 回归护栏：无参数工具的 parameters 也必须是合法 JSON Schema（type=object），
    // 否则模型侧会整轮报错 "schema must be a JSON Schema of 'type: object'"。
    const definition = tools.get('square_status');
    check(definition?.parameters?.type === 'object', 'square_status 的 parameters 是 type=object');
    check(
      typeof definition?.parameters?.properties === 'object',
      'square_status 的 parameters 带 properties',
    );
  }
  check(
    routes.size >= 15,
    `路由数量合理（${String(routes.size)} 条）`,
    [...routes.keys()].join(','),
  );

  // ---- B. 路由手感 -------------------------------------------------------
  console.log('\n[B] HTTP 路由（假 req/res）');
  const listRoute = routes.get('/api/dsh-squares/skills');
  const res = fakeResponse();
  await listRoute.handler(fakeRequest({ url: `/api/dsh-squares/skills?cwd=${tmp}` }), res);
  check(res.statusCode === 200, 'GET /skills 返回 200', `${String(res.statusCode)} ${res.body}`);
  const payload = JSON.parse(res.body);
  check(Array.isArray(payload.skills), 'GET /skills 返回 skills 数组');
  check(payload.cwd === tmp, 'cwd 透传正确');

  const wrongMethod = fakeResponse();
  await listRoute.handler(fakeRequest({ method: 'POST', url: '/api/dsh-squares/skills' }), wrongMethod);
  check(wrongMethod.statusCode === 405, '方法不符返回 405', String(wrongMethod.statusCode));

  const forbidden = fakeResponse();
  await listRoute.handler(
    fakeRequest({ url: '/api/dsh-squares/skills', headers: { host: 'evil.example.com' } }),
    forbidden,
  );
  check(forbidden.statusCode === 403, '非 loopback Host 被拒绝（403）', String(forbidden.statusCode));

  const createRoute = routes.get('/api/dsh-squares/skills/create');
  const tooBig = fakeResponse();
  await createRoute.handler(
    fakeRequest({ method: 'POST', url: '/api/dsh-squares/skills/create', body: { padding: 'x'.repeat(9000) } }),
    tooBig,
  );
  check(tooBig.statusCode === 413, '超大请求体返回 413', String(tooBig.statusCode));

  const badName = fakeResponse();
  await createRoute.handler(
    fakeRequest({
      method: 'POST',
      url: '/api/dsh-squares/skills/create',
      body: { root: 'user', name: 'Bad Name', description: 'd', content: 'x' },
    }),
    badName,
  );
  check(badName.statusCode === 400, '非法技能名返回 400', String(badName.statusCode));

  // ---- 卸载回滚 ----------------------------------------------------------
  await fiber.dispose();
  const cleaned = await waitFor(() => routes.size === 0 && tools.size === 0);
  check(cleaned !== undefined, '卸载后路由与工具全部回收');
}

// =====================================================================
// C. frontmatter
// =====================================================================
console.log('\n[C] frontmatter 解析 / 改写');
{
  const text = [
    '---',
    'name: demo-skill',
    'description: >-',
    '  一行很长的',
    '  描述',
    'whenToUse: 需要时',
    'disable-model-invocation: yes',
    'custom-key: keep-me',
    '---',
    '',
    '# 正文',
    '内容',
  ].join('\n');
  const fm = parseFrontmatter(text);
  check(fm.present, '识别 frontmatter');
  check(fm.values.name === 'demo-skill', 'name 解析正确', fm.values.name);
  check(fm.values.description === '一行很长的 描述', '块标量折叠正确', fm.values.description);
  check(parseBoolean(fm.values['disable-model-invocation']) === true, '布尔别名 yes → true');
  check(fm.body.includes('# 正文'), '正文保留');

  const enabled = fm.render({ 'disable-model-invocation': 'false' });
  const reparsed = parseFrontmatter(enabled);
  check(parseBoolean(reparsed.values['disable-model-invocation']) === false, '改写后禁用位翻转');
  check(reparsed.values['custom-key'] === 'keep-me', '未知键在改写后仍然保留');
  check(reparsed.values.description === '一行很长的 描述', '描述未被改动');
  check(reparsed.body.includes('内容'), '正文未被改动');

  const added = parseFrontmatter(fm.render({ whenToUse: '新的时机' }));
  check(added.values.whenToUse === '新的时机', '既有键被覆盖');
  const appended = parseFrontmatter(fm.render({ newKey: 'added' }));
  check(appended.values.newKey === 'added', '新键被追加');
}

// =====================================================================
// D. 技能域文件操作
// =====================================================================
console.log('\n[D] 技能域文件操作');
{
  const config = {
    userSkillRoot: skillRoot,
    projectSkillDir: '.dsh/skills',
    projectAgentsSkillDir: '.agents/skills',
    customSkillDirs: [],
    maxSkillBytes: 65536,
  };
  const paths = { dshHome: tmp, agentsHome: join(tmp, 'agents'), userSkillRoot: skillRoot };
  const ctx = { logger: { info() {}, warn() {}, debug() {} } };
  const domain = new SkillsDomain(ctx, config, paths, {});

  const created = await domain.create({
    root: 'user',
    name: 'smoke-skill',
    description: '冒烟测试技能',
    whenToUse: '仅测试',
    content: '# 冒烟\n内容',
  });
  check(created.path.endsWith(join('smoke-skill', 'SKILL.md')), '新建技能路径正确', created.path);

  const listed = await domain.list(tmp);
  check(listed.skills.some((row) => row.name === 'smoke-skill'), '新建的技能出现在列表里');

  await domain.setEnabled({ name: 'smoke-skill', path: created.path, cwd: tmp, enabled: false });
  const disabled = await domain.read('smoke-skill', created.path, tmp);
  check(disabled.disabled === true, '禁用后读取到 disabled=true');

  await domain.update({
    name: 'smoke-skill',
    path: created.path,
    cwd: tmp,
    description: '改了描述',
    content: '# 改过的正文',
  });
  const updated = await domain.read('smoke-skill', created.path, tmp);
  check(updated.description === '改了描述', '描述已更新', updated.description);
  check(updated.disabled === true, '编辑保留了禁用状态');
  check(updated.content.includes('改过的正文'), '正文已更新');

  let stale = false;
  try {
    await domain.read('smoke-skill', join(tmp, 'elsewhere', 'SKILL.md'), tmp);
  } catch (error) {
    stale = error?.status === 409;
  }
  check(stale, '路径漂移返回 409');

  const trashed = await domain.remove({ name: 'smoke-skill', path: created.path, cwd: tmp });
  check(trashed.trashedTo.includes('.trash'), '删除进入回收站', trashed.trashedTo);
  const after = await domain.list(tmp);
  check(!after.skills.some((row) => row.name === 'smoke-skill'), '删除后不在列表里');
  const stillThere = await readFile(join(trashed.trashedTo, 'SKILL.md'), 'utf8');
  check(stillThere.includes('改过的正文'), '回收站里仍保留内容');
}

// =====================================================================
// E. 存储域声明
// =====================================================================
console.log('\n[E] 存储域声明能被真实 API 接受');
{
  const spec = deckDomainSpec();
  const declared = defineDomain({
    name: spec.name,
    version: spec.version,
    layout: spec.layout,
    invalidRecords: spec.invalidRecords,
    global: spec.global,
    tables: {
      experts: domainTable(spec.tables.experts.valueSchema),
      connectors: domainTable(spec.tables.connectors.valueSchema),
    },
  });
  check(declared.name === 'square' && declared.version === 1, 'defineDomain 接受了本插件的域声明');
  check(Object.keys(declared.tables).length === 2, '两张表都在声明里');
  const bad = declared.tables.experts.valueSchema.safeParse({ id: 'x' });
  check(bad.success === false, '记录 schema 会拒绝残缺记录');
}

// =====================================================================
// F. 连接器校验 / 配置整形
// =====================================================================
console.log('\n[F] 连接器校验与配置整形');
{
  const stdio = normalizeConnector(
    { label: 'fs', serverName: 'fs', transport: 'stdio', command: 'npx', args: ['-y', 'x'], env: { TOKEN: 'secret' } },
    undefined,
  );
  check(stdio.transport === 'stdio' && stdio.command === 'npx', 'stdio 记录规范化成功');
  const config = mcpClientConfig(stdio);
  check(config.transport === 'stdio' && config.serverName === 'fs', 'mcp-client 配置包含传输与 serverName');
  check(!('id' in config) && !('label' in config), 'mcp-client 配置不夹带本插件字段');
  check(config.command === 'npx' && Array.isArray(config.args), 'stdio 配置带 command/args');

  const http = mcpClientConfig(
    normalizeConnector({ serverName: 'remote', transport: 'streamable-http', url: 'http://x/mcp' }, undefined),
  );
  check(http.transport === 'streamable-http' && http.url === 'http://x/mcp', 'http 配置带 url');

  let rejected = false;
  try {
    normalizeConnector({ serverName: 'bad name', transport: 'stdio', command: 'x' }, undefined);
  } catch {
    rejected = true;
  }
  check(rejected, '非法 serverName 被拒绝');

  rejected = false;
  try {
    normalizeConnector({ serverName: 'ok', transport: 'stdio' }, undefined);
  } catch {
    rejected = true;
  }
  check(rejected, 'stdio 缺 command 被拒绝');

  const updated = normalizeConnector(
    { serverName: 'fs', transport: 'stdio', command: 'npx', env: { TOKEN: REDACTED } },
    stdio,
  );
  check(updated.env.TOKEN === 'secret', '脱敏占位符回填为原值', updated.env.TOKEN);
}

// =====================================================================
// G. 专家组合
// =====================================================================
console.log('\n[G] 专家组合生成');
{
  const expert = {
    id: 'demo',
    name: '演示专家',
    description: '',
    icon: '🤖',
    tags: [],
    systemPrompt: '你是一个演示专家。',
    capabilities: {
      shell: true,
      fs: true,
      skills: true,
      todo: false,
      web: false,
      ask: false,
      subagents: false,
      compaction: true,
    },
    skillNames: ['smoke-skill'],
    connectorIds: ['c1'],
    createdAt: '',
    updatedAt: '',
  };
  const connector = normalizeConnector(
    { id: 'c1', serverName: 'fs', transport: 'stdio', command: 'npx' },
    undefined,
  );
  const rows = composeRows(expert, [connector], 'darwin');
  const names = rows.map((row) => row.name);
  check(names[0] === '@deepseek-ai/dsh-persona', '首行是 persona');
  check(names.includes('@deepseek-ai/dsh-tool-bash'), '非 Windows 使用 bash 行');
  check(!names.includes('@deepseek-ai/dsh-tool-pwsh'), '非 Windows 不含 pwsh 行');
  check(names.includes('@deepseek-ai/dsh-mcp-client'), '绑定连接器生成 mcp-client 行');
  check(!names.includes('@deepseek-ai/dsh-tool-todo'), '未开启的能力不生成行');
  const compactionGroup = rows.find(
    (row) => row.name === 'cordis:group' && row.isolate?.compaction === true,
  );
  check(compactionGroup !== undefined, '压缩能力生成 isolate 组（官方同形）');
  check(
    (compactionGroup?.config ?? []).some((child) => child.name === '@deepseek-ai/dsh-compaction-basic'),
    '压缩组内含 compaction-basic',
  );
  check(
    compactionGroup?.isolate?.toolResultPruner === true,
    '压缩组 isolate 覆盖 toolResultPruner',
  );
  const persona = rows[0].config;
  check(persona.prefix === '你是一个演示专家。', 'persona 使用专家提示词');
  check(typeof persona.suffix === 'string' && persona.suffix.includes('smoke-skill'), '绑定技能写入 persona 说明');

  const winRows = composeRows(expert, [], 'win32');
  const winNames = winRows.map((row) => row.name);
  check(winNames.includes('@deepseek-ai/dsh-tool-pwsh'), 'Windows 使用 pwsh 行');
  check(!winNames.includes('@deepseek-ai/dsh-tool-bash'), 'Windows 不含 bash 行');

  check(JSON.stringify(rows).includes('!!js') === false, '组合里没有 !!js 表达式');

  const subagentExpert = {
    ...expert,
    capabilities: { ...expert.capabilities, subagents: true },
  };
  const subagentRows = composeRows(subagentExpert, [], 'darwin');
  const delegation = subagentRows.find(
    (row) => row.name === 'cordis:group' && row.isolate?.workflowEngine === true,
  );
  check(delegation !== undefined, '子代理能力生成 isolate 组');
  check(
    (delegation?.config ?? []).some((child) => child.name === '@deepseek-ai/dsh-tool-subagent'),
    '子代理组内含 tool-subagent',
  );
}

// =====================================================================
// H. 技能导入（zip / .md）
// =====================================================================
console.log('\n[H] 技能导入');
{
  /** 手搓一个 store(0) 的 zip（本插件只读签名/大小/方法，不校验 CRC）。 */
  const makeZip = (files) => {
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const [name, content] of Object.entries(files)) {
      const nameBytes = Buffer.from(name, 'utf8');
      const data = Buffer.from(content, 'utf8');
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(0, 8);
      local.writeUInt32LE(data.length, 18);
      local.writeUInt32LE(data.length, 22);
      local.writeUInt16LE(nameBytes.length, 26);
      locals.push(local, nameBytes, data);

      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0);
      central.writeUInt16LE(20, 4);
      central.writeUInt16LE(20, 6);
      central.writeUInt32LE(data.length, 20);
      central.writeUInt32LE(data.length, 24);
      central.writeUInt16LE(nameBytes.length, 28);
      central.writeUInt32LE(offset, 42);
      centrals.push(central, nameBytes);
      offset += local.length + nameBytes.length + data.length;
    }
    const centralBuf = Buffer.concat(centrals);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(Object.keys(files).length, 8);
    eocd.writeUInt16LE(Object.keys(files).length, 10);
    eocd.writeUInt32LE(centralBuf.length, 12);
    eocd.writeUInt32LE(offset, 16);
    return Buffer.concat([Buffer.concat(locals), centralBuf, eocd]).toString('base64');
  };

  const config = {
    userSkillRoot: skillRoot,
    projectSkillDir: '.dsh/skills',
    projectAgentsSkillDir: '.agents/skills',
    customSkillDirs: [],
    maxSkillBytes: 65536,
    maxImportBytes: 5 * 1024 * 1024,
  };
  const paths = { dshHome: tmp, agentsHome: join(tmp, 'agents'), userSkillRoot: skillRoot };
  const ctx = { logger: { info() {}, warn() {}, debug() {} } };
  const domain = new SkillsDomain(ctx, config, paths, {});

  const skillMd = [
    '---',
    'name: imported-demo',
    'description: 从 zip 导入的示例技能',
    '---',
    '',
    '# 示例',
    '正文',
  ].join('\n');

  const imported = await domain.importSkill({
    root: 'user',
    source: 'archive',
    dataBase64: makeZip({
      'imported-demo/SKILL.md': skillMd,
      'imported-demo/references/notes.md': '参考内容',
    }),
    enable: true,
  });
  check(imported.name === 'imported-demo', 'zip 导入解析出技能名', imported.name);
  check(imported.files === 2, 'zip 导入写入 2 个文件', String(imported.files));
  const detail = await domain.read('imported-demo', imported.path, tmp);
  check(detail.description === '从 zip 导入的示例技能', 'frontmatter 描述进入技能目录');
  check(detail.disabled === false, '勾选自动安装时技能处于启用状态');
  const nested = await readFile(join(skillRoot, 'imported-demo', 'references', 'notes.md'), 'utf8');
  check(nested === '参考内容', '包装目录下的子文件按相对路径落盘');

  const importedOff = await domain.importSkill({
    root: 'user',
    source: 'markdown',
    fileName: 'plain.md',
    files: [
      {
        path: 'SKILL.md',
        text: '---\nname: imported-off\ndescription: 单文件导入且不自动启用\n---\n\n正文\n',
      },
    ],
    enable: false,
  });
  const off = await domain.read(importedOff.name, importedOff.path, tmp);
  check(off.disabled === true, '未勾选自动安装时导入为禁用状态');

  const failures = [
    [{ source: 'archive', dataBase64: makeZip({ 'a/readme.md': 'no skill here' }) }, 'missing-skill-md'],
    [
      { source: 'archive', dataBase64: makeZip({ 'x/SKILL.md': '---\nname: Bad Name\ndescription: d\n---\n' }) },
      'invalid-name',
    ],
    [
      { source: 'archive', dataBase64: makeZip({ 'y/SKILL.md': '---\ndescription: 没有名字\n---\n' }) },
      'invalid-name',
    ],
    [{ source: 'files', files: [{ path: '../escape/SKILL.md', text: skillMd }] }, 'unsafe-path'],
    [
      { source: 'archive', dataBase64: makeZip({ 'imported-demo/SKILL.md': skillMd }) },
      'already-exists',
    ],
  ];
  for (const [input, expected] of failures) {
    let code;
    try {
      await domain.importSkill({ root: 'user', ...input });
    } catch (error) {
      code = error?.code;
    }
    check(code === expected, `导入拒绝用例（期望 ${expected}）`, String(code));
  }

  const creator = await domain.creatorPrompt('把周报转成飞书文档');
  check(creator.prompt.includes('把周报转成飞书文档'), '创建提示词包含用户需求');
  check(
    creator.prompt.includes(creator.skill) === creator.available,
    `技能可用时才指名 ${creator.skill}（available=${String(creator.available)}）`,
  );
  check(creator.userSkillRoot === skillRoot, '创建提示词带上落盘目录');
}

await rm(tmp, { recursive: true, force: true });

console.log(`\n[square] smoke: ${String(checks - failures)}/${String(checks)} checks passed`);
if (failures > 0) {
  console.error(`[square] smoke FAILED (${String(failures)} failures)`);
  process.exit(1);
}
console.log('[square] smoke PASSED');
