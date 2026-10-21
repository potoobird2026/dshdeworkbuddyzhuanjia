/**
 * 面板共用 UI 原子件（对齐 WorkBuddy 视觉语言，纯 React + 内联 SVG，无 UI 库依赖）。
 */
import { type ReactNode } from 'react';
/** 文案函数签名。 */
export type T = (key: string, vars?: Record<string, string | number>) => string;
/** 顶部胶囊页签的一项。 */
export interface TabItem<T extends string> {
    key: T;
    label: string;
    icon: ReactNode;
    /** 右上角小徽标（可选）。 */
    badge?: string;
}
/** 顶部胶囊页签组。 */
export declare function PillTabs<T extends string>({ items, value, onChange, }: {
    items: Array<TabItem<T>>;
    value: T;
    onChange: (next: T) => void;
}): import("react").JSX.Element;
/** 搜索胶囊。 */
export declare function SearchPill({ value, onChange, placeholder, }: {
    value: string;
    onChange: (next: string) => void;
    placeholder: string;
}): import("react").JSX.Element;
/** 胶囊按钮。 */
export declare function ActionButton({ children, onClick, primary, danger, disabled, title, }: {
    children: ReactNode;
    onClick: () => void;
    primary?: boolean;
    danger?: boolean;
    disabled?: boolean;
    title?: string;
}): import("react").JSX.Element;
/** 卡片溢出菜单项。 */
export interface MenuItem {
    label: string;
    onSelect: () => void;
    danger?: boolean;
    disabled?: boolean;
}
/** 卡片右上角的 ⋯ 菜单（点击外部自动关闭）。 */
export declare function CardMenu({ items, label }: {
    items: MenuItem[];
    label: string;
}): import("react").JSX.Element | null;
/** 分类 chips 行。 */
export declare function Chips<T extends string>({ items, value, onChange, }: {
    items: Array<{
        key: T;
        label: string;
    }>;
    value: T;
    onChange: (next: T) => void;
}): import("react").JSX.Element;
/** 章节小页签（专家 | 专家团）。 */
export declare function Subtabs<T extends string>({ items, value, onChange, }: {
    items: Array<{
        key: T;
        label: string;
    }>;
    value: T;
    onChange: (next: T) => void;
}): import("react").JSX.Element;
/** 排序段控件。 */
export declare function SortSegments<T extends string>({ items, value, onChange, }: {
    items: Array<{
        key: T;
        label: string;
    }>;
    value: T;
    onChange: (next: T) => void;
}): import("react").JSX.Element;
/** 图标底座（卡片左侧的圆角方块）。 */
export declare function Tile({ children, tone }: {
    children: ReactNode;
    tone?: number;
}): import("react").JSX.Element;
/** 标签。 */
export declare function Tag({ children, tone }: {
    children: ReactNode;
    tone?: 'ok' | 'error' | 'accent';
}): import("react").JSX.Element;
/** 章节标题行。 */
export declare function SectionHead({ title, count, children, }: {
    title: ReactNode;
    count?: number;
    children?: ReactNode;
}): import("react").JSX.Element;
/** 提示条。 */
export declare function Banner({ children, tone }: {
    children: ReactNode;
    tone?: 'error' | 'info';
}): import("react").JSX.Element;
/** 通知（info toast）：3 秒自动消失。返回 [当前文案, 设置函数]。 */
export declare function useNotice(): [string | undefined, (message: string) => void];
/** 空态。 */
export declare function Empty({ t }: {
    t: T;
}): import("react").JSX.Element;
/** 加载态：SVG 旋转动画，居中于列表区域。 */
export declare function Loading({ t }: {
    t: T;
}): import("react").JSX.Element;
/** 表单行。 */
export declare function Field({ label, hint, children }: {
    label: string;
    hint?: string;
    children: ReactNode;
}): import("react").JSX.Element;
/** 勾选项。 */
export declare function Checkbox({ label, checked, onChange, }: {
    label: string;
    checked: boolean;
    onChange: (next: boolean) => void;
}): import("react").JSX.Element;
/** 弹窗。 */
export declare function Modal({ title, subtitle, onClose, children, footer, t, }: {
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    t: T;
}): import("react").JSX.Element;
/** KEY=VALUE 文本 → 记录（忽略空行与注释）。 */
export declare function linesToRecord(text: string): Record<string, string>;
/** 记录 → KEY=VALUE 文本。 */
export declare function recordToLines(record: Record<string, string>): string;
/** 逗号/换行分隔 → 数组。 */
export declare function splitList(text: string): string[];
/** 依据字符串挑一个稳定的底色 tone（0–5）。 */
export declare function toneOf(seed: string): number;
