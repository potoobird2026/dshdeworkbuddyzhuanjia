// 一次性探针：用真实 API 验证 SkillHub 两个源的映射（不进构建产物）。
import { SkillHubSkillsSource, SkillHubPluginsSource } from '../build/catalog-sources.js';

const ttl = 60_000;
const ctx = {
  config: {
    skillHubApiUrl: 'https://api.skillhub.cn',
    catalogPageSize: 5,
    catalogTtlMs: ttl,
  },
  json: async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json();
  },
  text: async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.text();
  },
  bytes: async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return new Uint8Array(await res.arrayBuffer());
  },
  log: (m) => console.log('[log]', m),
};

const skills = await new SkillHubSkillsSource().list({ kind: 'skill' }, ctx);
console.log('技能源 total =', skills.total, ' 本页 =', skills.items.length, ' nextCursor =', skills.nextCursor);
for (const item of skills.items.slice(0, 3)) {
  console.log('  -', item.name, '|', item.id, '| v' + (item.version ?? '?'), '|', item.category, '| tags:', item.tags.slice(0, 3).join('/'));
}

const plugins = await new SkillHubPluginsSource().list({ kind: 'plugin' }, ctx);
console.log('插件源 total =', plugins.total, ' 本页 =', plugins.items.length);
for (const item of plugins.items.slice(0, 3)) {
  console.log('  -', item.name, '|', item.id, '| stars', item.stats?.stars, '| install:', JSON.stringify(item.install));
}

// 安装载荷：下载 zip 并展开
const first = skills.items[0];
if (first !== undefined) {
  const detail = await new SkillHubSkillsSource().item(first.id, ctx);
  const md = detail.files.find((f) => f.path.endsWith('SKILL.md'));
  console.log(`安装载荷 ${first.id}: 文件 ${detail.files.length} 个，SKILL.md ${md ? md.text.length + ' 字节' : '缺失'}`);
  console.log('  paths:', detail.files.slice(0, 5).map((f) => f.path).join(', '));
}
