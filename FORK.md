# 本仓库是 dsh-squares 的个人定制分支
#
# 起点：github.com/ai-tool-labs/dsh-squares（MIT，见 LICENSE）
# 同步上游：git fetch upstream && git merge upstream/master
#
# 与上游的差异：
#   1. package.json exports 补上 "./package.json"（修复桌面客户端静默丢失 UI 的 bug）
#   2. .gitignore 允许提交 build/（git 源安装没有 prepare 脚本，必须随仓库带构建产物）
#   3. pnpm-workspace.yaml 允许 esbuild 构建脚本
#   4. 插件安装流程识别桌面端 / Web 端并生成对应的安装命令，避免装错 profile
#      （桌面端 `dsh plugin add <spec>` 由 App 托管；Web 端 `--profile web`）
#   5. 取消上游默认拉取公开社区目录：全部远程内容源改为配置启用（留空 = 不注册），
#      默认一个不拉；广场只保留「我的提交」与「自建目录」
#   6. 当前为「纯插件」形态：不捆绑技能/专家/连接器内容；内容格式见 catalog/README.md
#   7. 新增 SkillHub 内容源（技能 + 插件）：skillHubApiUrl 留空 = 不启用，
#      本部署在 cordis.patch.yml 里显式启用 https://api.skillhub.cn
#      （技能 = /api/skills + zip 安装；插件 = /api/v1/plugins + github 规格）
#
# 构建：pnpm install && pnpm build
# 安装：
#   桌面端 dsh plugin add github:potoobird2026/dshdeworkbuddyzhuanjia
#   Web 端 dsh plugin --profile web add github:potoobird2026/dshdeworkbuddyzhuanjia
