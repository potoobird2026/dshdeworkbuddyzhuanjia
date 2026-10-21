/**
 * 面板用到的极小图标集（内联 SVG，不引入任何图标包）。
 *
 * 全部使用 currentColor 描边，尺寸默认 16，跟随所在胶囊/按钮的文字颜色。
 */

import type { SVGProps } from 'react';

/** 公共属性。 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/** 统一外壳。 */
function Shell({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** 放大镜。 */
export function IconSearch(props: IconProps) {
  return (
    <Shell {...props}>
      <circle cx="7.2" cy="7.2" r="4.4" />
      <path d="M10.5 10.5 13.6 13.6" />
    </Shell>
  );
}

/** 加号。 */
export function IconPlus(props: IconProps) {
  return (
    <Shell {...props}>
      <path d="M8 3.4v9.2M3.4 8h9.2" />
    </Shell>
  );
}

/** 更多（水平三点）。 */
export function IconMore(props: IconProps) {
  return (
    <Shell strokeWidth="0" {...props}>
      <circle cx="3.6" cy="8" r="1.15" fill="currentColor" />
      <circle cx="8" cy="8" r="1.15" fill="currentColor" />
      <circle cx="12.4" cy="8" r="1.15" fill="currentColor" />
    </Shell>
  );
}

/** 对勾。 */
export function IconCheck(props: IconProps) {
  return (
    <Shell {...props}>
      <path d="M3.4 8.6 6.5 11.6 12.6 4.8" />
    </Shell>
  );
}

/** 刷新。 */
export function IconRefresh(props: IconProps) {
  return (
    <Shell {...props}>
      <path d="M13 8a5 5 0 1 1-1.6-3.7" />
      <path d="M13.2 2.6v3.2h-3.2" />
    </Shell>
  );
}

/** 专家（人像 + 徽标）。 */
export function IconExpert(props: IconProps) {
  return (
    <Shell {...props}>
      <circle cx="6.8" cy="5.6" r="2.6" />
      <path d="M2.6 13.2c0-2.3 1.9-3.6 4.2-3.6 1.3 0 2.4.4 3.2 1.1" />
      <path d="M10.9 10.4 12 11.5l2.2-2.2" />
    </Shell>
  );
}

/** 技能（星芒）。 */
export function IconSkill(props: IconProps) {
  return (
    <Shell {...props}>
      <path d="M8 2.4 9.5 6 13.2 7.5 9.5 9 8 12.6 6.5 9 2.8 7.5 6.5 6z" />
      <path d="M12.6 11.6l.5 1.1 1.1.5-1.1.5-.5 1.1-.5-1.1-1.1-.5 1.1-.5z" />
    </Shell>
  );
}

/** 连接器（插头）。 */
export function IconConnector(props: IconProps) {
  return (
    <Shell {...props}>
      <path d="M6.2 2.4v3.1M9.8 2.4v3.1" />
      <path d="M4.4 5.5h7.2v2a3.6 3.6 0 0 1-3.6 3.6A3.6 3.6 0 0 1 4.4 7.5z" />
      <path d="M8 11.1v2.5" />
    </Shell>
  );
}

/** 插件包（拼图块：上方一个凹槽、右侧一个凸起）。 */
export function IconPlugin(props: IconProps) {
  return (
    <Shell {...props}>
      <path d="M3.4 3h2.9a1.7 1.7 0 0 0 3.4 0h2.9a.8.8 0 0 1 .8.8v2.5a1.7 1.7 0 0 1 0 3.4v2.5a.8.8 0 0 1-.8.8H3.4a.8.8 0 0 1-.8-.8V3.8a.8.8 0 0 1 .8-.8z" />
    </Shell>
  );
}

/** 用户组（专家团）。 */
export function IconUsers(props: IconProps) {
  return (
    <Shell {...props}>
      <circle cx="6" cy="5.8" r="2.3" />
      <path d="M2.2 13c0-2.1 1.7-3.3 3.8-3.3S9.8 10.9 9.8 13" />
      <path d="M10.4 4.1a2.1 2.1 0 0 1 0 3.9" />
      <path d="M11.4 9.9c1.4.3 2.4 1.4 2.4 3.1" />
    </Shell>
  );
}

/** 地球（精选/推荐）。 */
export function IconSparkle(props: IconProps) {
  return (
    <Shell {...props}>
      <path d="M8 2.6l1.3 2.9 2.9 1.3-2.9 1.3L8 11l-1.3-2.9L3.8 6.8l2.9-1.3z" />
      <path d="M3.2 12.2h3.1M10.6 12.2h2.2" />
    </Shell>
  );
}

/** 关闭。 */
export function IconClose(props: IconProps) {
  return (
    <Shell {...props}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Shell>
  );
}

/** 下载（托盘 + 向下箭头）。 */
export function IconDownload(props: IconProps) {
  return (
    <Shell {...props}>
      <path d="M8 2.6v7.2M4.9 7l3.1 3 3.1-3M3.2 12.8h9.6" />
    </Shell>
  );
}

/** 收藏（实心星）。 */
export function IconFavorite(props: IconProps) {
  return (
    <Shell strokeWidth="0" {...props}>
      <path
        d="M8 2.3l1.7 3.5 3.8.5-2.8 2.7.7 3.8L8 11l-3.4 1.8.7-3.8L2.5 6.3l3.8-.5z"
        fill="currentColor"
      />
    </Shell>
  );
}

/** 文件夹 / 路径。 */
export function IconFolder(props: IconProps) {
  return (
    <Shell {...props}>
      <path d="M2.4 4.4h3.4l1.2 1.6h6.6v5.6a1 1 0 0 1-1 1H3.4a1 1 0 0 1-1-1z" />
    </Shell>
  );
}
