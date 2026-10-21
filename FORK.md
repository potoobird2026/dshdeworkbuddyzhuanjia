# 本仓库是 dsh-squares 的个人定制分支
#
# 起点：github.com/ai-tool-labs/dsh-squares（MIT，见 LICENSE）
# 同步上游：git fetch upstream && git merge upstream/master
#
# 与上游的差异：
#   1. package.json exports 补上 "./package.json"（修复客户端 UI 被静默丢弃的 bug）
#   2. .gitignore 允许提交 build/（git 源安装没有 prepare 脚本，必须随仓库带构建产物）
#   3. cordis.patch.yml 默认内容源指向本仓库的 catalog/ 目录
#   4. pnpm-workspace.yaml 允许 esbuild 构建脚本
#
# 构建：pnpm install && pnpm build
# 安装：dsh plugin add github:potoobird2026/dshdeworkbuddyzhuanjia
