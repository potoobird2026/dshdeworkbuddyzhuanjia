/**
 * ============================================================================
 * dsh-squares —— Square 插件入口
 * ============================================================================
 *
 * 一个包、两半：
 *   - 宿主半（本文件与 src/*.ts）：Node 进程里的 Cordis 插件。注册一个只读
 *     诊断工具、一组 `/api/dsh-squares/*` HTTP 路由，并管理技能 / 专家 /
 *     连接器三个领域（专家与连接器都落在真实的宿主能力上）。
 *   - 浏览器半（src/client/*，构建为 lib/client.js）：Web UI 插件，向
 *     `sidebar.panellist` 注册一个全局面板图标行、向 `main` 注册面板本体。
 *
 * 加载方式（profile 插件行）：
 *   dsh plugin --profile web add /path/to/packages/dsh-squares
 *   # 或把 cordis.patch.yml 的 insert 段合并进 profile 的 cordis.patch.yml
 *
 * 所有注册都走"返回 disposer 的 API"或 ctx.effect，插件卸载/热重载时干净回滚。
 * ============================================================================
 */
import type { Context } from '@deepseek-ai/cordis';
import type { SquareConfig } from './config.js';
import { Config } from './config.js';
export { Config };
export type { SquareConfig };
/** 插件名（= npm 包名，必须与 profile 条目里的 name 一致）。 */
export declare const name = "dsh-squares";
/**
 * 静态依赖：只需要工具注册表（挂载 MCP 连接器与注册诊断工具都要用它）。
 * 其余服务（skills / agentPresets / settings / storageDomain / webServer /
 * connection）都是可选的，一律用 ctx.get() 探测后降级。
 */
export declare const inject: string[];
/**
 * 插件主体。
 *
 * apply 只做同步注册（生命周期 effect），真正的装配（打开存储、挂载连接器、
 * 注册预设）在后台 Promise 里完成；若在此之前插件就被卸载，装配会自行放弃。
 */
export declare function apply(ctx: Context, config: SquareConfig): void;
