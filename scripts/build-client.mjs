/**
 * 构建浏览器半 bundle：esbuild 打包 CJS body → 套上 DSH 的
 * `window.__ModuleLoader__.load({ id, factory })` 外壳 → 写 build/client.js。
 *
 * 外壳形态来自官方产物（例如 @deepseek-ai/dsh-client-ui-brand-official）：
 *   - id 必须等于包名（loader 用 manifest 包名匹配注册 id）；
 *   - body 每行加两个 tab；
 *   - factory 返回 module.exports，loader 的 unwrapExports 对「无 default 的
 *     具名导出对象」原样返回；
 *   - require 是 loader 注入的参数，按平台基线表解析，因此 react 等一律保持
 *     外部引用，不打进 bundle。
 *
 * esbuild 中转文件写到 build/.tmp/（加壳后即删；.tmp/ 已被 .gitignore 覆盖）。
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

/** 平台基线模块（PLATFORM_MODULES）：可以 require，但绝不能打进 bundle。 */
const BASELINE = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
];

const bodyFile = join(root, 'build', '.tmp', 'client.body.js');
const outFile = join(root, 'build', 'client.js');

await mkdir(dirname(bodyFile), { recursive: true });
await mkdir(dirname(outFile), { recursive: true });

await build({
  entryPoints: [join(root, 'src', 'client', 'index.tsx')],
  outfile: bodyFile,
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'warning',
  external: BASELINE,
});

const raw = await readFile(bodyFile, 'utf8');
const body = raw
  .replace(/\n?\/\/# sourceMappingURL=[^\n]*\n?$/u, '')
  .replace(/^\s*"use strict";\s*\n/u, '')
  .replace(/\n$/u, '');

const indented = body
  .split('\n')
  .map((line) => (line === '' ? '' : `\t\t${line}`))
  .join('\n');

const head = [
  'window.__ModuleLoader__.load({',
  `\tid: ${JSON.stringify(pkg.name)},`,
  '\tfactory: (require) => {',
  '\t\tvar module = { exports: {} };',
  '\t\tvar exports = module.exports;',
  '\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
].join('\n');

const tail = ['', '\t\treturn module.exports;', '\t}', '});', ''].join('\n');

await writeFile(outFile, `${head}\n${indented}${tail}`, 'utf8');
await rm(bodyFile, { force: true });

const size = Buffer.byteLength(await readFile(outFile, 'utf8'), 'utf8');
console.log(`[square] client bundle → build/client.js (${String(size)} bytes)`);
