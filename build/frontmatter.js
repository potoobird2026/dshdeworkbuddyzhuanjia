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
const KEY_PATTERN = /^([A-Za-z0-9_.$-]+)\s*:\s*(.*)$/;
/** 解析 YAML 标量（普通 / 单引号 / 双引号）。 */
function decodeScalar(raw) {
    const value = raw.trim();
    if (value === '')
        return '';
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
        return value
            .slice(1, -1)
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
    }
    if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
        return value.slice(1, -1).replace(/''/g, "'");
    }
    // 普通标量：去掉「空格 + #」起始的行尾注释。
    const hash = value.search(/\s#/);
    return hash === -1 ? value : value.slice(0, hash).trimEnd();
}
/** 编码为 YAML 标量（必要时加双引号）。 */
function encodeScalar(value) {
    const plain = /^[A-Za-z0-9\u00a1-\uffff][A-Za-z0-9 _.,;:!?@#$%&*+=/()[\]{}<>'"~-]*$/u;
    const reserved = /^(true|false|null|yes|no|on|off|~|-?\d+(\.\d+)?)$/i;
    const safe = plain.test(value) &&
        !reserved.test(value) &&
        !value.includes(': ') &&
        !value.includes(' #') &&
        value === value.trim();
    if (safe)
        return value;
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t')}"`;
}
/** 判断第 index 行是否更深的缩进（属于上一个键的块）。 */
function isContinuation(line, keyIndent) {
    if (line.trim() === '')
        return true;
    const indent = line.length - line.trimStart().length;
    return indent > keyIndent;
}
/** 解析块标量（`|` / `>` 系列）。 */
function decodeBlock(lines, indicator) {
    const chomp = indicator.slice(1);
    const text = lines.join('\n');
    const folded = indicator.startsWith('>');
    const logical = folded ? text.replace(/\n(?!\n)/g, ' ') : text;
    if (chomp === '-')
        return logical.replace(/\n+$/, '');
    if (chomp === '+')
        return logical;
    return logical.replace(/\n+$/, '\n');
}
/** 解析 SKILL.md 文本。 */
export function parseFrontmatter(text) {
    const warnings = [];
    const lines = text.split('\n');
    const firstNonEmpty = lines.findIndex((line) => line.trim() !== '');
    if (firstNonEmpty === -1 || lines[firstNonEmpty]?.trim() !== '---') {
        return {
            present: false,
            order: [],
            values: {},
            warnings,
            body: text,
            render: () => text,
        };
    }
    // 找到闭合的 ---。
    let close = -1;
    for (let index = firstNonEmpty + 1; index < lines.length; index += 1) {
        if (lines[index]?.trim() === '---') {
            close = index;
            break;
        }
    }
    if (close === -1) {
        warnings.push('frontmatter 缺少闭合的 ---，按无 frontmatter 处理');
        return {
            present: false,
            order: [],
            values: {},
            warnings,
            body: text,
            render: () => text,
        };
    }
    const fmStart = firstNonEmpty + 1;
    const fmLines = lines.slice(fmStart, close);
    const body = lines.slice(close + 1).join('\n');
    const entries = [];
    const values = {};
    const order = [];
    let cursor = 0;
    while (cursor < fmLines.length) {
        const line = fmLines[cursor] ?? '';
        const trimmed = line.trim();
        if (trimmed === '' || trimmed.startsWith('#')) {
            cursor += 1;
            continue;
        }
        const match = KEY_PATTERN.exec(line);
        if (match === null) {
            warnings.push(`无法解析的 frontmatter 行：${trimmed}`);
            cursor += 1;
            continue;
        }
        const key = match[1] ?? '';
        const rawValue = (match[2] ?? '').trim();
        const keyIndent = line.length - line.trimStart().length;
        const start = cursor;
        let end = cursor;
        let decoded = '';
        if (rawValue === '' || /^[|>][+-]?[0-9]*$/.test(rawValue)) {
            const block = [];
            let scan = cursor + 1;
            while (scan < fmLines.length && isContinuation(fmLines[scan] ?? '', keyIndent)) {
                block.push(fmLines[scan] ?? '');
                scan += 1;
            }
            // 块首尾的空行不属于内容。
            while (block.length > 0 && (block[0] ?? '').trim() === '')
                block.shift();
            while (block.length > 0 && (block[block.length - 1] ?? '').trim() === '')
                block.pop();
            const indents = block
                .filter((entry) => entry.trim() !== '')
                .map((entry) => entry.length - entry.trimStart().length);
            const baseIndent = indents.length > 0 ? Math.min(...indents) : 0;
            const dedented = block.map((entry) => entry.slice(baseIndent));
            decoded = rawValue === '' ? dedented.join('\n') : decodeBlock(dedented, rawValue);
            end = scan - 1;
            cursor = scan;
        }
        else {
            decoded = decodeScalar(rawValue);
            cursor += 1;
        }
        if (!Object.prototype.hasOwnProperty.call(values, key)) {
            values[key] = decoded;
            order.push(key);
            entries.push({ key, start, end });
        }
    }
    const order_ = order;
    const render = (overrides) => {
        const handled = new Set();
        const out = [];
        let cursor = 0;
        for (const entry of entries) {
            // 复制 entry.start 之前未被任何 entry 覆盖的行（注释 / 空行）。
            for (let index = cursor; index < entry.start; index += 1)
                out.push(fmLines[index] ?? '');
            const override = Object.prototype.hasOwnProperty.call(overrides, entry.key)
                ? overrides[entry.key]
                : undefined;
            if (override === undefined) {
                for (let index = entry.start; index <= entry.end; index += 1)
                    out.push(fmLines[index] ?? '');
            }
            else {
                handled.add(entry.key);
                if (override !== null)
                    out.push(`${entry.key}: ${encodeScalar(override)}`);
            }
            cursor = entry.end + 1;
        }
        for (let index = cursor; index < fmLines.length; index += 1)
            out.push(fmLines[index] ?? '');
        // 追加新增的键（保持调用方给出的顺序）。
        for (const [key, value] of Object.entries(overrides)) {
            if (handled.has(key) || value === null)
                continue;
            if (order_.includes(key))
                continue;
            out.push(`${key}: ${encodeScalar(value)}`);
        }
        const header = out.length > 0 ? `${out.join('\n')}\n` : '';
        return `---\n${header}---\n${body}`;
    };
    return { present: true, order, values, warnings, body, render };
}
/** 把 YAML 布尔字样解析为 boolean（无法识别时返回 undefined）。 */
export function parseBoolean(value) {
    if (value === undefined)
        return undefined;
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', 'on', '1'].includes(normalized))
        return true;
    if (['false', 'no', 'off', '0'].includes(normalized))
        return false;
    return undefined;
}
