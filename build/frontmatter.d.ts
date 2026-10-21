/**
 * SKILL.md frontmatter 的零依赖解析 / 改写。
 *
 * 目标不是实现完整 YAML，而是在**不破坏未知键与既有排版**的前提下读写
 * 面板关心的几个键（name / description / whenToUse / disable-model-invocation /
 * user-invocable）。做法的关键是「按行保留」：解析时记下每个键占据的行区间，
 * 改写时只替换目标键的行区间，其余行原样回填。
 *
 * 解析能力：普通标量、单/双引号标量、`|` / `>` 块标量（含 chomping 修饰符）、
 * `#` 行注释、空行。不支持的 YAML 特性（锚点、流式集合等）按普通标量处理并
 * 在 `warnings` 里提示，绝不静默丢弃内容。
 */
/** 解析结果。 */
export interface Frontmatter {
    /** 是否存在合法的 `---` 包裹块。 */
    present: boolean;
    /** 键顺序（首次出现顺序）。 */
    order: string[];
    /** 键 -> 解码后的字符串值。 */
    values: Record<string, string>;
    /** 原文里的注释行/无法识别的行（只读展示）。 */
    warnings: string[];
    /** 正文（闭合 `---` 之后的内容，去除紧随的一个换行）。 */
    body: string;
    /** 覆盖若干键后重新序列化的完整文本；`null` 表示删除该键。 */
    render(overrides: Record<string, string | null>): string;
}
/** 解析 SKILL.md 文本。 */
export declare function parseFrontmatter(text: string): Frontmatter;
/** 把 YAML 布尔字样解析为 boolean（无法识别时返回 undefined）。 */
export declare function parseBoolean(value: string | undefined): boolean | undefined;
