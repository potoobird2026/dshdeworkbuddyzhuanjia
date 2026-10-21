/**
 * 面板共用 UI 原子件（对齐 WorkBuddy 视觉语言，纯 React + 内联 SVG，无 UI 库依赖）。
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconCheck, IconClose, IconMore, IconPlus, IconSearch } from './icons.js';

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
export function PillTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: Array<TabItem<T>>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="adk-tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          className="adk-tab"
          data-active={value === item.key ? 'true' : 'false'}
          aria-selected={value === item.key}
          onClick={() => onChange(item.key)}
        >
          {item.icon}
          <span>{item.label}</span>
          {item.badge === undefined ? null : <span style={{ opacity: 0.7 }}>{item.badge}</span>}
        </button>
      ))}
    </div>
  );
}

/** 搜索胶囊。 */
export function SearchPill({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  return (
    <label className="adk-search">
      <IconSearch size={15} />
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

/** 胶囊按钮。 */
export function ActionButton({
  children,
  onClick,
  primary,
  danger,
  disabled,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      className="adk-action"
      data-primary={primary === true ? 'true' : 'false'}
      data-danger={danger === true ? 'true' : 'false'}
      disabled={disabled === true}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** 卡片溢出菜单项。 */
export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** 卡片右上角的 ⋯ 菜单（点击外部自动关闭）。 */
export function CardMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocumentClick = (event: MouseEvent): void => {
      if (ref.current !== null && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocumentClick);
    return () => document.removeEventListener('mousedown', onDocumentClick);
  }, [open]);

  if (items.length === 0) return null;
  return (
    <div className="adk-menu-wrap" ref={ref}>
      <button
        type="button"
        className="adk-menu-trigger"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <IconMore size={16} />
      </button>
      {open ? (
        <div className="adk-menu" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              data-danger={item.danger === true ? 'true' : 'false'}
              disabled={item.disabled === true}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** 分类 chips 行。 */
export function Chips<T extends string>({
  items,
  value,
  onChange,
}: {
  items: Array<{ key: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="adk-chips">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className="adk-chip"
          data-active={value === item.key ? 'true' : 'false'}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** 章节小页签（专家 | 专家团）。 */
export function Subtabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: Array<{ key: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="adk-subtabs">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className="adk-subtab"
          data-active={value === item.key ? 'true' : 'false'}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** 排序段控件。 */
export function SortSegments<T extends string>({
  items,
  value,
  onChange,
}: {
  items: Array<{ key: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="adk-sort">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          data-active={value === item.key ? 'true' : 'false'}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** 图标底座（卡片左侧的圆角方块）。 */
export function Tile({ children, tone }: { children: ReactNode; tone?: number }) {
  return (
    <div className="adk-tile" data-tone={tone === undefined ? undefined : String(tone % 6)}>
      {children}
    </div>
  );
}

/** 标签。 */
export function Tag({ children, tone }: { children: ReactNode; tone?: 'ok' | 'error' | 'accent' }) {
  return (
    <span className="adk-tag" data-tone={tone}>
      {children}
    </span>
  );
}

/** 章节标题行。 */
export function SectionHead({
  title,
  count,
  children,
}: {
  title: ReactNode;
  count?: number;
  children?: ReactNode;
}) {
  return (
    <div className="adk-section-head">
      <span className="adk-section-title">{title}</span>
      {count === undefined ? null : <span className="adk-section-count">{String(count)}</span>}
      {children === undefined ? null : <span className="adk-section-right">{children}</span>}
    </div>
  );
}

/** 提示条。 */
export function Banner({ children, tone }: { children: ReactNode; tone?: 'error' | 'info' }) {
  return (
    <div className="adk-banner" data-tone={tone === 'error' ? 'error' : 'info'}>
      {children}
    </div>
  );
}

/** 通知（info toast）：3 秒自动消失。返回 [当前文案, 设置函数]。 */
export function useNotice(): [string | undefined, (message: string) => void] {
  const [notice, setNotice] = useState<string | undefined>();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = (message: string): void => {
    setNotice(message);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(undefined), 3000);
  };
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  return [notice, show];
}

/** 空态。 */
export function Empty({ t }: { t: T }) {
  return <div className="adk-empty">{t('panel.empty')}</div>;
}

/** 加载态：SVG 旋转动画，居中于列表区域。 */
export function Loading({ t }: { t: T }) {
  return (
    <div className="adk-loading" role="status" aria-label={t('panel.loading')}>
      <svg className="adk-spin" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <circle cx="11" cy="11" r="8.5" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.4" />
        <path d="M11 2.5a8.5 8.5 0 0 1 8.5 8.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** 表单行。 */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="adk-field">
      <label>{label}</label>
      {children}
      {hint === undefined ? null : <span className="adk-hint">{hint}</span>}
    </div>
  );
}

/** 勾选项。 */
export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="adk-check">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

/** 弹窗。 */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  t,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  t: T;
}) {
  return (
    <div
      className="adk-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="adk-modal" role="dialog" aria-label={title}>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <div className="adk-modal-title" style={{ flex: 1 }}>
            {title}
            {subtitle === undefined ? null : <div className="adk-modal-subtitle">{subtitle}</div>}
          </div>
          <button type="button" className="adk-menu-trigger" aria-label={t('action.close')} onClick={onClose}>
            <IconClose size={15} />
          </button>
        </div>
        {children}
        <div className="adk-modal-actions">
          {footer}
          <button type="button" className="adk-action" onClick={onClose}>
            {t('action.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** KEY=VALUE 文本 → 记录（忽略空行与注释）。 */
export function linesToRecord(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index <= 0) continue;
    out[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return out;
}

/** 记录 → KEY=VALUE 文本。 */
export function recordToLines(record: Record<string, string>): string {
  return Object.entries(record)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

/** 逗号/换行分隔 → 数组。 */
export function splitList(text: string): string[] {
  return text
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

/** 依据字符串挑一个稳定的底色 tone（0–5）。 */
export function toneOf(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 9973;
  }
  return hash % 6;
}
