/**
 * 路由集成测试（专家 / 连接器写路径）。
 *
 * 与 smoke-test.mjs 同构：真实 Cordis 生命周期 + 假 webServer/tools，
 * 但重点覆盖需要存储参与的写路径（内存降级存储）。
 * 连接器一律以 enabled:false 创建，避免测试期间真的拉起 MCP 子进程。
 *
 * 运行：node test/routes.test.mjs（需先 pnpm build）
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import * as plugin from '../build/index.js';

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

/** 假响应。 */
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

/** 假请求。 */
function fakeRequest({ method = 'GET', url = '/', body } = {}) {
  const payload = body === undefined ? [] : [Buffer.from(JSON.stringify(body), 'utf8')];
  return {
    method,
    url,
    headers: { host: '127.0.0.1:12345' },
    socket: { remoteAddress: '127.0.0.1' },
    async *[Symbol.asyncIterator]() {
      for (const chunk of payload) yield chunk;
    },
    resume() {},
  };
}

/** 等待条件。 */
async function waitFor(predicate, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (predicate()) return true;
    if (Date.now() > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

const tmp = await mkdtemp(join(tmpdir(), 'square-routes-'));
const routes = new Map();
const ctx = new Context();
ctx.provide('tools', {
  register: () => () => {},
  schemas: () => [],
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
  enableTool: false,
  panelId: 'square',
  routePrefix: '/api/dsh-squares',
  dshHome: tmp,
  agentsHome: join(tmp, 'agents'),
  customSkillDirs: [],
  projectSkillDir: '.dsh/skills',
  projectAgentsSkillDir: '.agents/skills',
  userSkillRoot: join(tmp, 'skills'),
  maxBodyBytes: 65536,
  maxSkillBytes: 65536,
  connectorTimeoutMs: 5000,
  redactSecrets: true,
});
await fiber;
await waitFor(() => routes.has('/api/dsh-squares/connectors'));

/** 调一个路由（path 可带查询串，路由表按去查询的路径匹配）。 */
async function call(path, { method = 'GET', body } = {}) {
  const route = routes.get(path.split('?')[0]);
  if (route === undefined) throw new Error(`route missing: ${path}`);
  const res = fakeResponse();
  await route.handler(fakeRequest({ method, url: path, body }), res);
  let payload;
  try {
    payload = JSON.parse(res.body);
  } catch {
    payload = res.body;
  }
  return { status: res.statusCode, payload };
}

const BASE = '/api/dsh-squares';

console.log('\n[路由] 连接器生命周期（内存存储）');
{
  const created = await call(`${BASE}/connectors/create`, {
    method: 'POST',
    body: {
      label: '本地文件',
      serverName: 'files',
      transport: 'stdio',
      command: 'node',
      args: ['server.js'],
      env: { TOKEN: 'secret-value' },
      enabled: false,
    },
  });
  check(created.status === 200, '创建连接器返回 200', JSON.stringify(created.payload));
  const id = created.payload?.connector?.id;
  check(typeof id === 'string' && id.length > 0, '返回了新连接器 id', id);
  check(created.payload?.connector?.env?.TOKEN === 'secret-value', '写入时保留原始密钥（不回显）');

  const listed = await call(`${BASE}/connectors`);
  check(listed.status === 200, 'GET /connectors 返回 200');
  const row = listed.payload?.connectors?.find((item) => item.id === id);
  check(row !== undefined, '列表里能找到新建的连接器');
  check(row?.env?.TOKEN === '••••••', '列表响应里 env 被脱敏', row?.env?.TOKEN);
  check(
    Array.isArray(listed.payload?.profileConfigured),
    'profile 只读列表字段存在',
  );

  const updated = await call(`${BASE}/connectors/update`, {
    method: 'POST',
    body: {
      id,
      label: '本地文件（改）',
      serverName: 'files',
      transport: 'stdio',
      command: 'node',
      args: ['server.js'],
      env: { TOKEN: '••••••' },
      enabled: false,
    },
  });
  check(updated.status === 200, '更新连接器返回 200', JSON.stringify(updated.payload));
  check(updated.payload?.connector?.label === '本地文件（改）', 'label 已更新');
  check(updated.payload?.connector?.env?.TOKEN === 'secret-value', '脱敏占位符回填原密钥');

  const dup = await call(`${BASE}/connectors/create`, {
    method: 'POST',
    body: { label: 'dup', serverName: 'files', transport: 'stdio', command: 'node', enabled: false },
  });
  check(dup.status === 400, '重复 serverName 被拒绝（400）', String(dup.status));

  const badName = await call(`${BASE}/connectors/create`, {
    method: 'POST',
    body: { label: 'bad', serverName: 'has space', transport: 'stdio', command: 'node' },
  });
  check(badName.status === 400, '非法 serverName 返回 400', String(badName.status));

  const deleted = await call(`${BASE}/connectors/delete`, { method: 'POST', body: { id } });
  check(deleted.status === 200, '删除连接器返回 200');
  const afterDelete = await call(`${BASE}/connectors`);
  check(
    !afterDelete.payload.connectors.some((item) => item.id === id),
    '删除后列表里不再出现',
  );
}

console.log('\n[路由] 专家（无 agentPresets 服务时降级）');
{
  const created = await call(`${BASE}/experts/create`, {
    method: 'POST',
    body: {
      name: '测试专家',
      description: '冒烟',
      systemPrompt: '你是一个测试专家。',
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
    },
  });
  check(created.status === 200, '创建专家返回 200', JSON.stringify(created.payload));
  check(typeof created.payload?.broken === 'string', '注册不可用时返回 broken 诊断', created.payload?.broken);
  const id = created.payload?.expert?.id;

  const listed = await call(`${BASE}/experts`);
  check(listed.status === 200, 'GET /experts 返回 200');
  check(
    (listed.payload?.mine ?? []).some((item) => item.id === id),
    '自建专家出现在列表里',
  );
  check(Array.isArray(listed.payload?.official), 'official 字段存在（此处为空数组）');

  const missingPrompt = await call(`${BASE}/experts/update`, {
    method: 'POST',
    body: { id, name: '缺提示词', systemPrompt: '' },
  });
  check(missingPrompt.status === 400, '空提示词被拒绝（400）', String(missingPrompt.status));

  const duplicated = await call(`${BASE}/experts/duplicate`, { method: 'POST', body: { id } });
  check(duplicated.status === 200, '复制专家返回 200', JSON.stringify(duplicated.payload));
  check(duplicated.payload?.expert?.id !== id, '副本使用新的 id');

  const noSettings = await call(`${BASE}/experts/set-default`, { method: 'POST', body: { id } });
  check(noSettings.status === 400, '设置不可用时设默认返回 400', String(noSettings.status));

  const read = await call(`${BASE}/experts/read?id=${String(id)}`);
  check(read.status === 200 && read.payload?.mine?.id === id, 'GET /experts/read 返回该专家');

  const removed = await call(`${BASE}/experts/delete`, { method: 'POST', body: { id } });
  check(removed.status === 200 && removed.payload?.removed === true, '删除专家返回 removed=true');
}

console.log('\n[路由] 广场提交（candidates + submit）');
{
  const candidates = await call(`${BASE}/catalog/submit/candidates?kind=expert`);
  check(candidates.status === 200 && Array.isArray(candidates.payload?.candidates), 'GET /catalog/submit/candidates 返回候选数组');
  const bad = await call(`${BASE}/catalog/submit/candidates?kind=bogus`);
  check(bad.status === 400 && bad.payload?.code === 'invalid-kind', '非法 kind 400');

  // 先造一个专家（无 agentPresets 时降级注册），再提交。
  const created = await call(`${BASE}/experts/create`, {
    method: 'POST',
    body: { name: '提交专家', description: '路由测试', systemPrompt: '你是提交专家' },
  });
  check(created.status === 200, '创建专家 200');
  const expertId = created.payload?.expert?.id;
  const submit = await call(`${BASE}/catalog/submit`, {
    method: 'POST',
    body: { kind: 'expert', id: expertId, name: '提交专家', description: '提交到广场' },
  });
  check(submit.status === 200 && submit.payload?.item?.kind === 'expert', 'POST /catalog/submit 返回条目');
  check(
    typeof submit.payload?.item?.composition === 'string' && String(submit.payload.item.composition).includes('agent-persona'),
    '提交条目带合成组合',
  );
  check(Array.isArray(submit.payload?.hints) && submit.payload.hints.length > 0, '提交结果带指引');

  // 「我的提交」源出现在源列表里。
  const sources = await call(`${BASE}/catalog/sources`);
  check(
    sources.payload?.sources?.some((source) => source.id === 'my-submissions'),
    '源列表包含 my-submissions',
  );

  const missing = await call(`${BASE}/catalog/submit`, { method: 'POST', body: { kind: 'expert' } });
  check(missing.status === 400 && missing.payload?.code === 'missing-parameter', '缺 id 400');

  const notFound = await call(`${BASE}/catalog/submit`, { method: 'POST', body: { kind: 'expert', id: 'nope' } });
  check(notFound.status === 404 && notFound.payload?.code === 'expert-not-found', '不存在的专家 404');
}

console.log('\n[路由] 状态与能力');
{
  const status = await call(`${BASE}/status`);
  check(status.status === 200, 'GET /status 返回 200');
  check(status.payload?.storage === 'memory', '无 storageDomain 时降级为内存存储', status.payload?.storage);
  check(status.payload?.capabilities?.mcpClient === true, '能解析 mcp-client（依赖已安装）');
  check(typeof status.payload?.counts?.skills === 'number', 'counts.skills 是数字');

  const caps = await call(`${BASE}/capabilities`);
  check(caps.status === 200 && caps.payload?.panelId === 'square', '/capabilities 返回面板 id');
  check(caps.payload?.ui?.plugins === true, '/capabilities 报出插件页签开关');
}

console.log('\n[路由] 插件（profile）管理');
{
  // 这个测试宿主没有 pluginManager：走降级路径——只读 profile 清单 + 写操作明确报错。
  const profileDir = join(tmp, 'profiles', 'test');
  await mkdir(profileDir, { recursive: true });
  await writeFile(
    join(profileDir, 'package.json'),
    JSON.stringify({
      name: 'dsh-profile-test',
      dependencies: { 'dsh-squares': 'link:/tmp/square' },
      dsh: { profile: { bundles: ['dsh-squares'] } },
    }),
  );
  const savedDir = process.env.DSH_PROFILE_DIR;
  const savedName = process.env.DSH_PROFILE;
  process.env.DSH_PROFILE_DIR = profileDir;
  process.env.DSH_PROFILE = 'test';

  const view = await call(`${BASE}/plugins`);
  check(view.status === 200, 'GET /plugins 返回 200', JSON.stringify(view.payload));
  check(view.payload?.available === false, '没有 pluginManager 时 available=false');
  check(
    Array.isArray(view.payload?.bundles) && view.payload.bundles.length === 1,
    '降级路径列出 profile 清单',
    JSON.stringify(view.payload?.bundles),
  );
  check(view.payload?.bundles?.[0]?.name === 'dsh-squares', '清单里是依赖名');
  check(view.payload?.bundles?.[0]?.enabled === true, '已选中的 bundle 标记 enabled');
  check(view.payload?.bundles?.[0]?.mine === true, '自己装的插件标 mine（我的插件页只列这些）');
  check(view.payload?.profile?.name === 'test', '返回 profile 名');
  check(Array.isArray(view.payload?.notes) && view.payload.notes.length > 0, '降级时给出说明');

  const toggled = await call(`${BASE}/plugins/set-enabled`, {
    method: 'POST',
    body: { id: 'square', enabled: false },
  });
  check(
    toggled.status === 400 && toggled.payload?.code === 'plugin-manager-unavailable',
    '缺少 pluginManager 时启停返回 400 + 明确 code',
    JSON.stringify(toggled.payload),
  );

  const removed = await call(`${BASE}/plugins/remove`, {
    method: 'POST',
    body: { name: 'dsh-squares' },
  });
  check(removed.status === 400, '缺少 pluginManager 时卸载返回 400');

  const missingName = await call(`${BASE}/plugins/set-bundle-enabled`, {
    method: 'POST',
    body: {},
  });
  check(missingName.status === 400, '缺少 name 返回 400');

  // 护栏：取消选中只允许对自己装的插件；App 自带的 bundle 一律拒绝
  //（旧版页面能点到它们，一次误操作就让语音输入 / Agent Teams 在重启后消失）。
  const guard = await call(`${BASE}/plugins/set-bundle-enabled`, {
    method: 'POST',
    body: { name: '@deepseek-ai/dsh-base', enabled: false },
  });
  check(
    guard.status === 400 && guard.payload?.code === 'not-user-plugin',
    '拒绝取消选中 App 自带的 bundle',
    JSON.stringify(guard.payload),
  );

  const badKind = await call(`${BASE}/catalog?kind=nonsense`);
  check(badKind.status === 400, 'kind 非法仍返回 400');

  // 提交：四个页签共用，插件页签也走同一套候选/提交接口。
  const candidates = await call(`${BASE}/catalog/submit/candidates?kind=plugin`);
  check(candidates.status === 200, '插件提交候选返回 200', JSON.stringify(candidates.payload));
  check(
    Array.isArray(candidates.payload?.candidates) && candidates.payload.candidates.length === 1,
    '候选里列出 profile 已安装的插件包',
    JSON.stringify(candidates.payload?.candidates),
  );
  check(
    candidates.payload?.candidates?.[0]?.id === 'dsh-squares',
    '候选 id 是插件包名',
    candidates.payload?.candidates?.[0]?.id,
  );

  if (savedDir === undefined) delete process.env.DSH_PROFILE_DIR;
  else process.env.DSH_PROFILE_DIR = savedDir;
  if (savedName === undefined) delete process.env.DSH_PROFILE;
  else process.env.DSH_PROFILE = savedName;
}

await fiber.dispose();
const cleaned = await waitFor(() => routes.size === 0);
check(cleaned, '卸载后路由清空');

await rm(tmp, { recursive: true, force: true });

console.log(`\n[square] routes: ${String(checks - failures)}/${String(checks)} checks passed`);
if (failures > 0) {
  console.error(`[square] routes FAILED (${String(failures)} failures)`);
  process.exit(1);
}
console.log('[square] routes PASSED');
