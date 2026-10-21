/**
 * 面板用到的极小图标集（内联 SVG，不引入任何图标包）。
 *
 * 全部使用 currentColor 描边，尺寸默认 16，跟随所在胶囊/按钮的文字颜色。
 */
import type { SVGProps } from 'react';
/** 公共属性。 */
type IconProps = SVGProps<SVGSVGElement> & {
    size?: number;
};
/** 放大镜。 */
export declare function IconSearch(props: IconProps): import("react").JSX.Element;
/** 加号。 */
export declare function IconPlus(props: IconProps): import("react").JSX.Element;
/** 更多（水平三点）。 */
export declare function IconMore(props: IconProps): import("react").JSX.Element;
/** 对勾。 */
export declare function IconCheck(props: IconProps): import("react").JSX.Element;
/** 刷新。 */
export declare function IconRefresh(props: IconProps): import("react").JSX.Element;
/** 专家（人像 + 徽标）。 */
export declare function IconExpert(props: IconProps): import("react").JSX.Element;
/** 技能（星芒）。 */
export declare function IconSkill(props: IconProps): import("react").JSX.Element;
/** 连接器（插头）。 */
export declare function IconConnector(props: IconProps): import("react").JSX.Element;
/** 插件包（拼图块：上方一个凹槽、右侧一个凸起）。 */
export declare function IconPlugin(props: IconProps): import("react").JSX.Element;
/** 用户组（专家团）。 */
export declare function IconUsers(props: IconProps): import("react").JSX.Element;
/** 地球（精选/推荐）。 */
export declare function IconSparkle(props: IconProps): import("react").JSX.Element;
/** 关闭。 */
export declare function IconClose(props: IconProps): import("react").JSX.Element;
/** 下载（托盘 + 向下箭头）。 */
export declare function IconDownload(props: IconProps): import("react").JSX.Element;
/** 收藏（实心星）。 */
export declare function IconFavorite(props: IconProps): import("react").JSX.Element;
/** 文件夹 / 路径。 */
export declare function IconFolder(props: IconProps): import("react").JSX.Element;
export {};
