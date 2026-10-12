/**
 * 客户端 bundle 校验：包装形态、注册 id、外部依赖白名单，以及在
 * "真实 loader 语义 + 桩 React/桩 ctx" 下模拟一次物化与 apply。
 *
 * 这套断言对应官方 loader 的三条硬约束：
 *   1. `window.__ModuleLoader__.load({ id, factory })` 的 id 必须等于包名，
 *      否则报 "loaded without registering … via __ModuleLoader__.load"；
 *   2. bundle 里的 `require(spec)` 必须命中平台基线表（或已声明的 external），
 *      否则报 "require(spec) missed the module table"；
 *   3. factory 返回的对象要能被 Cordis 当插件用（有 apply/inject）。
 *
 * 运行：node scripts/check-client-bundle.mjs（需先 pnpm build）
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const code = await readFile(join(root, 'build', 'client.js'), 'utf8');

const BASELINE = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]);

const failures = [];
const check = (condition, message) => {
  if (condition) return;
  failures.push(message);
};

// ---- 1. 包装形态 -----------------------------------------------------------
check(code.startsWith('window.__ModuleLoader__.load({'), 'bundle 必须以 window.__ModuleLoader__.load({ 开头');
check(code.includes(`\tid: ${JSON.stringify(pkg.name)},`), `bundle 的 id 必须是包名 ${pkg.name}`);
check(code.includes('factory: (require) => {'), 'bundle 必须使用 factory: (require) => { 形态');
check(code.trimEnd().endsWith('});'), 'bundle 必须以 }); 结尾');
check(code.includes('return module.exports;'), 'factory 必须返回 module.exports');
check(code.includes('Object.defineProperty(exports, Symbol.toStringTag'), '缺少 Symbol.toStringTag 标记');

// ---- 2. 外部依赖白名单 -----------------------------------------------------
const specs = new Set();
for (const match of code.matchAll(/require\((["'])([^"']+)\1\)/gu)) specs.add(match[2]);
for (const spec of specs) {
  check(BASELINE.has(spec), `require("${spec}") 不在平台基线表内（需要 dsh.client.external）`);
}
check(specs.has('react/jsx-runtime'), 'bundle 应当 require("react/jsx-runtime")（JSX 运行时）');
check(
  !/react\.production\.min\.js|__SECRET_INTERNALS_DO_NOT_USE/u.test(code),
  'bundle 内似乎打进了 React 实现（外部化失效）',
);

// ---- 3. 模拟物化 + apply ---------------------------------------------------
let registration;
const sandbox = {
  window: {
    __ModuleLoader__: {
      load(entry) {
        registration = entry;
      },
    },
  },
};
const reactStub = { createElement: () => null, Fragment: null, useState: () => [undefined, () => {}] };
const requireStub = (spec) => {
  if (spec === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null, Fragment: null };
  if (spec === 'react') return reactStub;
  if (spec === 'react-dom/client') return { createRoot: () => ({ render: () => {}, unmount: () => {} }) };
  return {};
};
vm.runInNewContext(code, sandbox, { filename: 'build/client.js' });
check(registration !== undefined, 'bundle 执行后没有调用 __ModuleLoader__.load');
check(registration?.id === pkg.name, `注册 id 应为 ${pkg.name}，实际 ${String(registration?.id)}`);

const exportsObject = registration.factory(requireStub);
check(typeof exportsObject?.apply === 'function', 'factory 返回值缺少 apply');
check(Array.isArray(exportsObject?.inject), 'factory 返回值缺少 inject 数组');

const registrations = [];
const fakeCtx = {
  slots: {
    inject(_slot, callback) {
      callback();
      return () => {};
    },
    register(spec) {
      registrations.push(spec);
      return () => {};
    },
  },
  locale: {
    register: () => () => {},
    bind: () => (key) => key,
    subscribe: () => () => {},
  },
  effect: () => () => {},
};
exportsObject.apply(fakeCtx);

const panellist = registrations.find((spec) => spec.name === 'sidebar.panellist');
const main = registrations.find((spec) => spec.name === 'main');
check(panellist !== undefined, 'apply 未注册 sidebar.panellist');
check(main !== undefined, 'apply 未注册 main');
check(
  panellist !== undefined && main !== undefined && panellist.id === main.key,
  'sidebar.panellist.id 必须等于 main.key（否则侧边栏行点不开）',
);

console.log(`[square] client bundle specs: ${[...specs].join(', ')}`);
console.log(`[square] registrations: ${registrations.map((spec) => `${spec.name}:${spec.id ?? spec.key}`).join(', ')}`);

if (failures.length > 0) {
  console.error('[square] client bundle check FAILED:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('[square] client bundle check PASSED');
