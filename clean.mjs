/**
 * 清理构建产物：删除整个 build/ 目录（含 .tmp/ 中转区）。
 *
 * 运行：node clean.mjs（或 pnpm clean）
 */

import { rmSync } from 'node:fs';

rmSync('build', { recursive: true, force: true });
console.log('[square] clean: build/ removed');
