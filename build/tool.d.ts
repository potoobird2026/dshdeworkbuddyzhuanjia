/**
 * 模型侧唯一的工具：`square_status`（只读诊断）。
 *
 * 刻意手写 ToolDefinition 而不是导入 `defineTool`：本插件除
 * `@deepseek-ai/dsh-mcp-client` 外不依赖任何 @deepseek-ai/* 运行时模块，
 * 这样在 profile/runtime 版本混杂时也不会踩到重复实例问题。
 */
import type { HostCtx } from './capabilities.js';
import type { SquareService } from './service.js';
/** 注册诊断工具。 */
export declare function registerStatusTool(ctx: HostCtx, service: SquareService): void;
