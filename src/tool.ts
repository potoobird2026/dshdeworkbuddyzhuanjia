/**
 * 模型侧唯一的工具：`square_status`（只读诊断）。
 *
 * 刻意手写 ToolDefinition 而不是导入 `defineTool`：本插件除
 * `@deepseek-ai/dsh-mcp-client` 外不依赖任何 @deepseek-ai/* 运行时模块，
 * 这样在 profile/runtime 版本混杂时也不会踩到重复实例问题。
 */

import type { HostCtx } from './capabilities.js';
import type { SquareService } from './service.js';

/** 内部工具签名（只用到宿主 register 的一小部分字段）。 */
interface ToolDefinitionLike {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  output: {
    schema: Record<string, unknown>;
    render: (args: unknown, value: unknown) => Array<{ type: 'text'; text: string }>;
  };
  execute: (args: unknown, exec: unknown) => Promise<unknown>;
}

/** 注册诊断工具。 */
export function registerStatusTool(ctx: HostCtx, service: SquareService): void {
  const tools = ctx.get('tools') as { register(definition: ToolDefinitionLike): unknown } | undefined;
  if (tools === undefined || typeof tools.register !== 'function') {
    ctx.logger.warn('[square] ctx.tools unavailable; skipping square_status tool');
    return;
  }
  const definition: ToolDefinitionLike = {
    name: 'square_status',
    description:
      'Square 面板的状态快照：技能数、官方/自建专家数、MCP 连接器状态与工具数、' +
      '当前 profile 已安装的插件包数量、当前部署缺失的宿主服务、最近一次错误。只读，不返回连接器密钥。',
    // 必须是合法 JSON Schema：无参数工具也要显式声明 type=object，
    // 否则模型侧会拒绝**整个请求**（"schema must be a JSON Schema of 'type: object'"）。
    // 这里再过一道归零函数，任何未来的误改都不会把整轮请求打挂。
    parameters: objectSchema(),
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }],
    },
    execute: async () => service.statusText(),
  };
  // tools.register 返回的正是注销该工具的 disposer：直接作为 effect 的清理函数。
  ctx.effect(
    () => tools.register(definition) as unknown as () => void,
    'square: status tool',
  );
}

/** 归零函数：无论如何都返回一个合法的无参对象 schema。 */
function objectSchema(): Record<string, unknown> {
  return { type: 'object', properties: {}, additionalProperties: false };
}
